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
    selected = [c for c in config.selectedColumns if c in real_df.columns and c in syn_df.columns]
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

    numerical_cols   = [c for c in selected if col_types[c] == DataTypeLabel.numerical]
    categorical_cols = [c for c in selected if col_types[c] == DataTypeLabel.categorical]

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
        univariate = {m: r for m, r in raw_results[col].items() if m not in _CROSS_VARIABLE_METRICS}
        if not univariate:
            continue  # no applicable metrics for this column — exclude from ranking
        scores     = [score for _, score in univariate.values()]
        sim_score  = round(statistics.mean(scores), 4)
        top_metric = min(univariate, key=lambda m: univariate[m][1])
        # Thresholds: 0.80 = good, 0.65–0.80 = moderate, <0.65 = poor.
        # These are calibrated so that common EHR columns (age, diagnosis) typically
        # land in "good" when the generator is working correctly.
        status = "good" if sim_score >= 0.80 else ("moderate" if sim_score >= 0.65 else "poor")
        ranking.append(VariableRankingItem(
            variable=col,
            type=col_types[col].value if col_types[col] in (DataTypeLabel.numerical, DataTypeLabel.categorical) else "numerical",
            similarityScore=sim_score,
            status=status,
            topContributingMetric=top_metric,
            realMissingRate=real_missing_rates.get(col, 0.0),
        ))
    ranking.sort(key=lambda x: x.similarityScore)

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
        score for col in selected for _, score in raw_results[col].values()
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
            score for col in selected
            for m, (_, score) in raw_results[col].items()
            if m in metric_set and not math.isnan(score)
        ]
        return round(statistics.mean(scores), 4) if scores else None

    # active_metrics: deduplicated list of metrics that produced at least one result.
    # Used for metricsUsed count and to populate the metric matrix column headers.
    active_metrics = list({m for col in selected for m in raw_results[col]})

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

    # ── Step 9: automated insights ────────────────────────────────────────────
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

    insights: list[str] = []

    # Overall score insight — one sentence always present to anchor interpretation.
    if overall >= 0.85:
        insights.append("Overall similarity is high — synthetic data closely matches the real distribution.")
    elif overall >= 0.70:
        insights.append("Moderate overall similarity. Review variables marked as poor for targeted improvement.")
    else:
        insights.append("Low overall similarity. Significant differences between real and synthetic distributions were detected.")

    # Poor variable list — cap at 5 names to keep the message readable.
    if poor_vars:
        names  = ", ".join(poor_vars[:5])
        suffix = f" (and {len(poor_vars) - 5} more)" if len(poor_vars) > 5 else ""
        insights.append(f"Poor similarity in: {names}{suffix} — prioritise these variables for regeneration.")

    # All-good message — only shown when every variable is "good" (no moderate either).
    if ranking and not poor_vars and not any(r.status == "moderate" for r in ranking):
        insights.append("All selected variables show good similarity — no targeted fixes needed.")

    # Numerical vs categorical gap — a 0.15 difference is meaningful enough to flag.
    # The message text depends on which type scores lower, to give a directional hint.
    num_score = summary.numericalSimilarityScore
    cat_score = summary.categoricalSimilarityScore
    if num_score is not None and cat_score is not None and abs(num_score - cat_score) >= 0.15:
        lower, higher = ("numerical", "categorical") if num_score < cat_score else ("categorical", "numerical")
        lo_val, hi_val = (num_score, cat_score) if num_score < cat_score else (cat_score, num_score)
        insights.append(
            f"{lower.capitalize()} variables score notably lower than {higher} ({lo_val:.2f} vs {hi_val:.2f}) — "
            + ("distribution shapes differ more than category proportions."
               if lower == "numerical"
               else "category proportions differ more than distribution shapes.")
        )

    # Relationship / correlation degradation — 0.70 threshold signals notable loss.
    rel_score = summary.relationshipSimilarityScore
    if rel_score is not None and rel_score < 0.70:
        insights.append(
            f"Correlation structure is degraded (relationship score: {rel_score:.2f}) — "
            "multivariate dependencies in the synthetic data differ from the real dataset."
        )

    # High-missing variables warning — scores for these columns may be unreliable
    # because a large fraction of rows were dropped or imputed before the metric ran.
    high_missing = [r.variable for r in ranking if r.realMissingRate >= 50]
    if high_missing:
        names  = ", ".join(high_missing[:3])
        suffix = f" (and {len(high_missing) - 3} more)" if len(high_missing) > 3 else ""
        insights.append(
            f"{names}{suffix} {'has' if len(high_missing) == 1 else 'have'} very high missing rates in the real dataset — "
            "their similarity scores may not be meaningful."
        )

    # ── Step 10: multivariate analysis ───────────────────────────────────────
    multivariate_results = compute_multivariate_results(
        real_df, syn_df, numerical_cols, categorical_cols, config.selectedMetrics
    )

    return EvaluationResult(
        runId=f"run-{uuid.uuid4().hex[:8]}",
        generatedAt=datetime.now(timezone.utc).isoformat(),
        summary=summary,
        analysisContext=analysis_context,
        reminders=reminders,
        variableRanking=ranking,
        metricMatrix=MetricMatrix(
            variables=selected,
            metrics=active_metrics,
            cells=cells,
        ),
        detailViews=detail_views,
        insights=insights,
        multivariateResults=multivariate_results,
    )
