# routers/evaluation.py — POST /evaluations/run
#
# The main calculation endpoint.  Receives the user's column and metric
# selections from the Setup page, runs all chosen metrics, and returns a
# complete EvaluationResult for the Results dashboard.
#
# Processing order:
#   1. Load CSVs from disk using the IDs stored during upload.
#   2. Filter to selected columns only.
#   3. Snapshot missing rates (BEFORE any row-drop or imputation).
#   4. Apply missing-value handling (ignore / drop / impute).
#   5. Infer (or accept user-overridden) column types.
#   6. Run per-column metrics via compute_metric().
#   7. Run correlation difference (needs the full DataFrame, not one column).
#   8. Build metric matrix, variable ranking, detail views, summary cards.
#   9. Generate automated insights.
#  10. Run multivariate analysis.
#  11. Return EvaluationResult.

import uuid
import math
import statistics
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, HTTPException

from schemas import (
    DataTypeLabel, EvaluationMetric,
    RunEvaluationRequest, EvaluationResult, EvaluationSummary, AnalysisContext,
    VariableRankingItem, MetricMatrix, MetricMatrixCell,
    VariableDetailView, DetailViewMetric,
)
from constants import NULL_VALUES
import state
from services.type_inference import infer_type
from services.metrics import compute_metric, compute_correlation_difference
from services.detail_views import build_detail_series
from services.multivariate import compute_multivariate_results

router = APIRouter()

# correlation_difference measures a column's average correlation shift relative to
# ALL other numerical columns — it is a cross-variable metric, not a property of
# the column in isolation.  Including it in a column's sim_score would unfairly
# penalise (or reward) a column based on what its neighbours look like.
# It still appears in raw_results so the metric matrix and detail panel can show it.
_CROSS_VARIABLE_METRICS = {EvaluationMetric.correlation_difference}

# Metric sets used to compute the three sub-scores shown in the summary cards.
_NUM_METRICS  = {EvaluationMetric.mean_difference, EvaluationMetric.ks_test, EvaluationMetric.wasserstein_distance}
_CAT_METRICS  = {EvaluationMetric.chi_square, EvaluationMetric.category_proportion_difference}
_CORR_METRICS = {EvaluationMetric.correlation_difference}


@router.post("/evaluations/run", response_model=EvaluationResult)
def run_evaluation(req: RunEvaluationRequest):
    real_path = state.uploaded_files.get(req.realDatasetId)
    syn_path  = state.uploaded_files.get(req.syntheticDatasetId)

    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    config  = req.config
    real_df = pd.read_csv(real_path, na_values=NULL_VALUES)
    syn_df  = pd.read_csv(syn_path,  na_values=NULL_VALUES)

    # Normalise whitespace-only strings to NaN so missing value handling is consistent.
    real_df = real_df.replace(r'^\s*$', pd.NA, regex=True)
    syn_df  = syn_df.replace(r'^\s*$', pd.NA, regex=True)

    # Intersect user selection with columns that actually exist in both files.
    # The Setup page shows only shared columns, so mismatches are unlikely, but
    # a stale session or re-upload could cause a column to disappear.
    shared_cols = set(real_df.columns) & set(syn_df.columns)
    selected = [col for col in config.selectedColumns if col in shared_cols]
    if not selected:
        raise HTTPException(status_code=400, detail="No valid shared columns selected.")

    real_df = real_df[selected]
    syn_df  = syn_df[selected]

    # ── Step 3: snapshot missing rates ───────────────────────────────────────
    # Must happen BEFORE dropna() or fillna() because those operations destroy NaN
    # rows.  If we snapshotted after "drop" handling, every column would show 0%
    # missing — misleading the user into thinking the data was clean to begin with.
    real_missing_rates: dict[str, float] = {
        col: round(real_df[col].isna().mean() * 100, 1) for col in selected
    }

    # ── Step 4: missing value handling ───────────────────────────────────────
    # ignore      : keep NaN as-is; each metric calls dropna() internally.
    # drop        : remove any row with at least one NaN in the selected columns.
    #               Guarantees all metrics see the same rows, but can lose a lot of data.
    # simple_impute: fill numeric columns with median (robust to outliers),
    #               categorical columns with mode (most frequent value).
    #               Mode fallback "unknown" handles the edge case of an all-NaN column.
    if config.missingValueHandling == "drop":
        real_df = real_df.dropna()
        syn_df  = syn_df.dropna()
    elif config.missingValueHandling == "simple_impute":
        for col in selected:
            if pd.api.types.is_numeric_dtype(real_df[col]):
                real_df[col] = real_df[col].fillna(real_df[col].median())
                syn_df[col]  = syn_df[col].fillna(syn_df[col].median())
            else:
                mode_val = real_df[col].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else "unknown"
                real_df[col] = real_df[col].fillna(fill_val)
                syn_df[col]  = syn_df[col].fillna(fill_val)

    # ── Step 5: column type inference ────────────────────────────────────────
    # User overrides from the Setup page take precedence over automatic inference.
    # Invalid override values fall back to auto-inference instead of raising an error,
    # so a stale frontend payload cannot crash the whole evaluation.
    overrides = config.columnTypeOverrides or {}
    col_types: dict[str, DataTypeLabel] = {}
    for col in selected:
        if col in overrides:
            try:
                col_types[col] = DataTypeLabel(overrides[col])
            except ValueError:
                col_types[col] = infer_type(real_df[col], col)
        else:
            col_types[col] = infer_type(real_df[col], col)

    numerical_cols   = [col for col in selected if col_types[col] == DataTypeLabel.numerical]
    categorical_cols = [col for col in selected if col_types[col] == DataTypeLabel.categorical]

    # ── Step 6: per-column, per-metric scores ─────────────────────────────────
    # raw_results[col][metric] = (raw_value, normalized_score)
    # Using a nested dict lets us look up results by both dimensions later
    # (metric matrix needs col→metric→score; ranking needs col→all scores).
    raw_results: dict[str, dict[EvaluationMetric, tuple[float, float]]] = {col: {} for col in selected}

    for col in selected:
        for metric in config.selectedMetrics:
            try:
                result = compute_metric(metric, real_df[col], syn_df[col], col_types[col])
                if result is not None:
                    raw_results[col][metric] = result
            except Exception:
                # Skip this metric for this column rather than failing the whole request.
                # Causes: empty series after dropna, all-NaN column, constant column.
                # The column will still appear in the ranking if other metrics succeed.
                pass

    # ── Step 7: correlation difference ───────────────────────────────────────
    # compute_correlation_difference() needs the full DataFrame to build the
    # correlation matrix — it cannot be called inside the per-column loop.
    # Requires at least 2 numerical columns; silently skipped otherwise.
    if EvaluationMetric.correlation_difference in config.selectedMetrics and len(numerical_cols) >= 2:
        corr_results = compute_correlation_difference(real_df, syn_df, numerical_cols)
        for col, result in corr_results.items():
            raw_results[col][EvaluationMetric.correlation_difference] = result

    # ── Step 8a: metric matrix (heatmap) ─────────────────────────────────────
    cells: list[MetricMatrixCell] = [
        MetricMatrixCell(variable=col, metric=metric, normalizedScore=round(score, 4))
        for col in selected
        for metric, (_, score) in raw_results[col].items()
    ]

    # ── Step 8b: variable ranking ─────────────────────────────────────────────
    # sim_score = mean of all univariate normalized scores for the column.
    # Cross-variable metrics (correlation_difference) are excluded from this average
    # so that a column is judged on its own distribution, not its neighbours'.
    # top_metric = the metric with the LOWEST score (the most problematic one),
    # shown in the table to help the user understand why a column ranks poorly.
    # Sorted ascending: worst-similarity columns appear first in the table.
    ranking: list[VariableRankingItem] = []
    for col in selected:
        univariate = {
            metric: result
            for metric, result in raw_results[col].items()
            if metric not in _CROSS_VARIABLE_METRICS
        }
        if not univariate:
            continue  # no applicable metrics for this column — exclude from ranking
        scores     = [score for _, score in univariate.values()]
        sim_score  = round(statistics.mean(scores), 4)
        # result tuples are (raw_value, normalized_score); [1] picks the score
        top_metric = min(univariate, key=lambda m: univariate[m][1])
        # Thresholds: 0.80 = good, 0.65–0.80 = moderate, <0.65 = poor.
        # These are calibrated so that common EHR columns (age, diagnosis) typically
        # land in "good" when the generator is working correctly.
        if sim_score >= 0.80:
            status = "good"
        elif sim_score >= 0.65:
            status = "moderate"
        else:
            status = "poor"
        ranking.append(VariableRankingItem(
            variable=col,
            type=col_types[col].value if col_types[col] in (DataTypeLabel.numerical, DataTypeLabel.categorical) else "numerical",
            similarityScore=sim_score,
            status=status,
            topContributingMetric=top_metric,
            realMissingRate=real_missing_rates.get(col, 0.0),
        ))
    ranking.sort(key=lambda item: item.similarityScore)

    # ── Metric matrix variable order ──────────────────────────────────────────
    # Group numerical first then categorical, within each group sort by
    # similarity score ascending (worst first) so the most divergent rows
    # sit at the top of each type block — mirroring the column grouping
    # (numerical metrics left, categorical metrics right).
    # Variables with no ranking entry (no applicable metric) go at the end.
    _ranking_lookup = {r.variable: r for r in ranking}
    matrix_variables: list[str] = (
        sorted(
            [c for c in selected if c in _ranking_lookup and _ranking_lookup[c].type == "numerical"],
            key=lambda c: _ranking_lookup[c].similarityScore,
        )
        + sorted(
            [c for c in selected if c in _ranking_lookup and _ranking_lookup[c].type == "categorical"],
            key=lambda c: _ranking_lookup[c].similarityScore,
        )
        + [c for c in selected if c not in _ranking_lookup]
    )

    # ── Step 8c: detail views (chart data per column) ────────────────────────
    # Skip columns with no metric results — there is nothing meaningful to show.
    # build_detail_series() handles both categorical (bar chart) and numerical (histogram).
    detail_views: dict[str, VariableDetailView] = {}
    for col in selected:
        if not raw_results[col]:
            continue
        col_type   = col_types[col]
        chart_type = "grouped_bar" if col_type == DataTypeLabel.categorical else "histogram_kde"
        series     = build_detail_series(real_df[col], syn_df[col], col_type)
        metrics_list: list[DetailViewMetric] = [
            DetailViewMetric(name=metric, value=round(raw, 6), normalizedScore=round(score, 4))
            for metric, (raw, score) in raw_results[col].items()
        ]
        detail_views[col] = VariableDetailView(
            chartType=chart_type,
            title=col,
            xAxisLabel=col,
            yAxisLabel="Proportion of patients",
            series=series,
            metrics=metrics_list,
        )

    # ── Step 8d: summary scores ───────────────────────────────────────────────
    # Filter out NaN values before computing the mean.  NaN can appear when a
    # metric fails and the score was never set, or from floating-point edge cases.
    # statistics.mean() would return NaN if any element is NaN — the filter prevents
    # a single bad column from making the entire overall score undefined.
    all_scores = [
        score
        for col in selected
        for (_, score) in raw_results[col].values()
        if not math.isnan(score)
    ]
    overall = round(statistics.mean(all_scores), 4) if all_scores else 0.0

    def avg_scores_for(metric_set: set[EvaluationMetric]) -> float | None:
        # Returns None (not 0) when no metrics from the set were used.
        # A score of 0 would imply "very poor", while None means "not applicable"
        # (e.g. no categorical columns selected → categoricalSimilarityScore = None).
        # NaN filter mirrors the all_scores filter above — prevents a single bad column
        # from making the sub-score undefined when statistics.mean() receives a NaN.
        scores = [
            score
            for col in selected
            for metric, (_, score) in raw_results[col].items()
            if metric in metric_set and not math.isnan(score)
        ]
        return round(statistics.mean(scores), 4) if scores else None

    # active_metrics: deduplicated list of metrics that produced at least one result.
    # Used for metricsUsed count and to populate the metric matrix column headers.
    # Sorted by type group: Numerical → Categorical → Correlation/Multivariate
    # so the matrix columns always appear in the same logical order.
    _METRIC_ORDER = [
        EvaluationMetric.mean_difference,
        EvaluationMetric.ks_test,
        EvaluationMetric.wasserstein_distance,
        EvaluationMetric.chi_square,
        EvaluationMetric.category_proportion_difference,
        EvaluationMetric.correlation_difference,
        EvaluationMetric.numerical_categorical_association,
        EvaluationMetric.cramers_v_comparison,
    ]
    _used = {
        metric
        for col in selected
        for metric in raw_results[col]
    }
    active_metrics = [m for m in _METRIC_ORDER if m in _used]

    summary = EvaluationSummary(
        overallSimilarityScore=overall,
        numericalSimilarityScore=avg_scores_for(_NUM_METRICS),
        categoricalSimilarityScore=avg_scores_for(_CAT_METRICS),
        relationshipSimilarityScore=avg_scores_for(_CORR_METRICS),
        variablesAnalyzed=len(ranking),    # columns that produced at least one score
        variablesSelected=len(selected),   # all columns the user chose on Setup
        metricsUsed=len(active_metrics),
    )

    analysis_context = AnalysisContext(
        realDatasetName=state.uploaded_file_names.get(req.realDatasetId, real_path.name),
        syntheticDatasetName=state.uploaded_file_names.get(req.syntheticDatasetId, syn_path.name),
        selectedVariables=selected,
        selectedMetrics=config.selectedMetrics,
    )

    # ── Step 9: multivariate analysis (must run before insights) ────────────
    # Moved before insights so correlation / Cramér's V pair data is available
    # when building the insight sentences that name specific variable pairs.
    multivariate_results = compute_multivariate_results(
        real_df, syn_df, numerical_cols, categorical_cols, config.selectedMetrics
    )

    # ── Step 10: automated insights ───────────────────────────────────────────
    # Reminders are short factual lines shown at the top of the dashboard.
    # Insights are interpretive sentences that guide the user toward action.
    reminders = [
        f"{len(selected)} variables analysed using {len(active_metrics)} metric(s).",
        f"Overall similarity: {overall:.0%}. Variables below 0.65 are marked as poor.",
        "Scores are normalized: 1 = identical distributions, 0 = completely different.",
    ]
    poor_vars = [r.variable for r in ranking if r.status == "poor"]
    if poor_vars:
        reminders.append(f"Poor similarity detected in: {', '.join(poor_vars[:5])}.")

    # Build a lookup: variable → the metric item with the lowest normalised score.
    # Used below to name the specific failing metric for poor variables.
    worst_metric_lookup: dict[str, tuple[str, float]] = {}
    for col in selected:
        univariate = {
            metric: result
            for metric, result in raw_results[col].items()
            if metric not in _CROSS_VARIABLE_METRICS
        }
        if univariate:
            worst_m = min(univariate, key=lambda m: univariate[m][1])
            worst_metric_lookup[col] = (worst_m.value, round(univariate[worst_m][1], 2))

    insights: list[str] = []

    # Overall score insight — one sentence always present to anchor interpretation.
    if overall >= 0.85:
        insights.append("Overall similarity is high — synthetic data closely matches the real distribution.")
    elif overall >= 0.70:
        insights.append("Moderate overall similarity. Review variables marked as poor for targeted improvement.")
    else:
        insights.append("Low overall similarity. Significant differences between real and synthetic distributions were detected.")

    # Poor variables — name the top 3 with their score and weakest metric so the
    # user knows exactly which variable to fix and why it scored poorly.
    if poor_vars:
        detail_parts = []
        for var in poor_vars[:3]:
            score = next((r.similarityScore for r in ranking if r.variable == var), None)
            if score is not None and var in worst_metric_lookup:
                metric_name, _ = worst_metric_lookup[var]
                # Convert snake_case metric key to a readable label.
                readable = metric_name.replace("_", " ").title()
                detail_parts.append(f"{var} (score {score:.2f}, weakest: {readable})")
            elif score is not None:
                detail_parts.append(f"{var} (score {score:.2f})")
            else:
                detail_parts.append(var)
        suffix = f" (and {len(poor_vars) - 3} more)" if len(poor_vars) > 3 else ""
        insights.append(
            f"Poor similarity detected in: {'; '.join(detail_parts)}{suffix}. "
            "Prioritise these variables for regeneration."
        )

    # All-good message — only shown when every variable is "good" (no moderate either).
    if ranking and not poor_vars and not any(r.status == "moderate" for r in ranking):
        insights.append("All selected variables show good similarity — no targeted fixes needed.")

    # Numerical vs categorical gap — a 0.15 difference is meaningful enough to flag.
    num_score = summary.numericalSimilarityScore
    cat_score = summary.categoricalSimilarityScore
    if num_score is not None and cat_score is not None and abs(num_score - cat_score) >= 0.15:
        if num_score < cat_score:
            lower, higher = "numerical", "categorical"
            lo_val, hi_val = num_score, cat_score
        else:
            lower, higher = "categorical", "numerical"
            lo_val, hi_val = cat_score, num_score
        insights.append(
            f"{lower.capitalize()} variables score notably lower than {higher} ({lo_val:.2f} vs {hi_val:.2f}) — "
            + ("distribution shapes differ more than category proportions."
               if lower == "numerical"
               else "category proportions differ more than distribution shapes.")
        )

    # Relationship / correlation degradation — name the worst pair so the user
    # knows which specific relationship to investigate.
    rel_score = summary.relationshipSimilarityScore
    if rel_score is not None and rel_score < 0.70:
        insights.append(
            f"Correlation structure is degraded (relationship score: {rel_score:.2f}) — "
            "multivariate dependencies in the synthetic data differ from the real dataset."
        )

    # Top correlation pair — always shown when correlation pairs exist, regardless of
    # the overall relationship score, because a single bad pair can be important
    # even when the average score looks acceptable.
    top_corr = (multivariate_results.topCorrelationPairs or [])
    if top_corr:
        p = top_corr[0]
        insights.append(
            f"Largest Pearson r shift: {p.variable1} × {p.variable2} "
            f"(real r = {p.realCorrelation:.2f}, synthetic r = {p.syntheticCorrelation:.2f}, |Δr| = {p.difference:.2f})."
        )

    # Top Cramér's V pair — same rationale as the correlation pair above.
    top_cramers = (multivariate_results.topCramersVPairs or [])
    if top_cramers:
        p = top_cramers[0]
        insights.append(
            f"Largest Cramér's V shift: {p.variable1} × {p.variable2} "
            f"(real V = {p.realCramersV:.2f}, synthetic V = {p.syntheticCramersV:.2f}, |ΔV| = {p.difference:.2f})."
        )

    # High-missing variables (≥ 50%) — scores may not be meaningful at all.
    high_missing = [r.variable for r in ranking if r.realMissingRate >= 50]
    if high_missing:
        names  = ", ".join(high_missing[:3])
        suffix = f" (and {len(high_missing) - 3} more)" if len(high_missing) > 3 else ""
        insights.append(
            f"{names}{suffix} {'has' if len(high_missing) == 1 else 'have'} very high missing rates (≥ 50%) "
            "in the real dataset — their similarity scores may not be meaningful."
        )

    # Moderate-missing variables (20–49%) — flag as a softer caution.
    moderate_missing = [
        r.variable for r in ranking
        if 20 <= r.realMissingRate < 50
    ]
    if moderate_missing:
        names  = ", ".join(moderate_missing[:3])
        suffix = f" (and {len(moderate_missing) - 3} more)" if len(moderate_missing) > 3 else ""
        insights.append(
            f"{names}{suffix} {'has' if len(moderate_missing) == 1 else 'have'} moderate missing rates "
            f"(20–49%) in the real dataset — interpret their scores with caution."
        )

    return EvaluationResult(
        runId=f"run-{uuid.uuid4().hex[:8]}",
        generatedAt=datetime.now(timezone.utc).isoformat(),
        summary=summary,
        analysisContext=analysis_context,
        reminders=reminders,
        variableRanking=ranking,
        metricMatrix=MetricMatrix(
            variables=matrix_variables,
            metrics=active_metrics,
            cells=cells,
        ),
        detailViews=detail_views,
        insights=insights,
        multivariateResults=multivariate_results,
    )
