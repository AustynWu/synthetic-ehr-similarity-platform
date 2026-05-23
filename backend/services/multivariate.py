# services/multivariate.py — multivariate analysis (correlation pairs, Cramér's V, group-wise)
#
# These analyses look at relationships between two columns at a time, which is why
# they live separately from services/metrics.py (which is strictly per-column).
#
# All three sections are gated by the user's metric selection: if the user did not
# select a multivariate metric, that section returns an empty list.  The frontend
# hides the section entirely when the list is empty.

import math
from itertools import combinations

import pandas as pd
from scipy.stats import chi2_contingency

from schemas import (
    EvaluationMetric, MultivariateResults,
    CorrelationPair, CramersVPair, GroupwiseSummaryRow,
)
from constants import MULTIVARIATE_TOP_K, GROUPWISE_TOP_K, MAX_CRAMERS_HEATMAP_VARS, MAX_CORR_HEATMAP_VARS


def _select_active_corr_vars(
    all_pairs: list[CorrelationPair],
    all_vars: list[str],
    max_vars: int,
    activity_threshold: float = 0.10,
) -> tuple[list[str], str]:
    """
    Choose the numerical variables most worth showing in the correlation heatmap.

    Uses the same activity-score logic as _select_active_cramers_vars:
    variables that appear repeatedly in high-difference pairs (|real_r - synthetic_r|
    > activity_threshold) are ranked first because they represent relationships the
    synthetic generator failed to preserve.  Alphabetical tiebreaking ensures a
    stable, reproducible order across runs.

    Args:
        all_pairs:          every CorrelationPair, already sorted by difference desc.
        all_vars:           all numerical columns the user selected.
        max_vars:           hard cap on variables shown in the heatmap.
        activity_threshold: minimum |Δr| for a pair to count toward a variable's score.

    Returns:
        selected  — up to max_vars variable names ranked by activity then name.
        note      — human-readable explanation shown directly in the UI.
    """
    activity: dict[str, int] = {v: 0 for v in all_vars}
    for pair in all_pairs:
        if pair.difference > activity_threshold:
            activity[pair.variable1] += 1
            activity[pair.variable2] += 1

    ranked   = sorted(all_vars, key=lambda v: (-activity[v], v))
    selected = ranked[:max_vars]
    total    = len(all_vars)

    if total <= max_vars:
        note = (
            f"All {total} numerical variable{'s' if total != 1 else ''} are shown. "
            "Each cell shows the similarity score (1 − |Δr|): "
            "1 = identical, lower = more different (min −1, since Pearson r ranges −1 to +1)."
        )
    else:
        note = (
            f"Showing {len(selected)} of {total} numerical variables. "
            f"Variables were ranked by how often they appear in pairs with "
            f"|Δr| > {activity_threshold:.2f}, surfacing the relationships that "
            f"changed most between real and synthetic data. "
            f"The remaining {total - len(selected)} variable(s) had fewer "
            f"high-difference pairs and are omitted to keep the heatmap readable."
        )

    return selected, note


def _select_active_cramers_vars(
    all_pairs: list[CramersVPair],
    all_vars: list[str],
    max_vars: int,
    activity_threshold: float = 0.10,
) -> tuple[list[str], str]:
    """
    Choose the variables most worth showing in the Cramér's V heatmap.

    Why "activity score" instead of alphabetical or random selection?
    When many categorical variables are selected, we cannot show all of them
    without the heatmap becoming unreadable.  Alphabetical slicing is arbitrary
    and might hide the most interesting pairs.  Instead we count how many
    high-difference pairs each variable appears in: a variable that shows up
    repeatedly in pairs where |real_V - synthetic_V| > threshold is one whose
    categorical associations were hardest for the synthetic generator to preserve.
    Showing those variables first means the heatmap always answers the question
    the user actually cares about: "which relationships changed most?"

    Args:
        all_pairs:          every Cramér's V pair, already computed and sorted.
        all_vars:           all categorical columns the user selected.
        max_vars:           hard cap on how many variables the heatmap may show.
        activity_threshold: minimum |ΔV| for a pair to count toward a variable's score.

    Returns:
        selected  — up to max_vars variable names, ranked by activity then name.
        note      — human-readable explanation shown directly in the UI.
    """
    # Tally how many high-difference pairs each variable participates in.
    activity: dict[str, int] = {v: 0 for v in all_vars}
    for pair in all_pairs:
        if pair.difference > activity_threshold:
            activity[pair.variable1] += 1
            activity[pair.variable2] += 1

    # Primary sort: activity descending (most divergent variables first).
    # Secondary sort: alphabetical for a stable, reproducible order.
    ranked = sorted(all_vars, key=lambda v: (-activity[v], v))
    selected = ranked[:max_vars]
    total = len(all_vars)

    if total <= max_vars:
        note = (
            f"All {total} categorical variable{'s' if total != 1 else ''} are shown. "
            "Each cell shows the similarity score (1 − |ΔV|): "
            "1 = identical, 0 = completely different (Cramér's V ranges 0–1, so this score is always 0–1)."
        )
    else:
        note = (
            f"Showing {len(selected)} of {total} categorical variables. "
            f"Variables were ranked by how often they appear in pairs with "
            f"|ΔV| > {activity_threshold:.2f}, surfacing the associations that "
            f"changed most between real and synthetic data. "
            f"The remaining {total - len(selected)} variable(s) had fewer "
            f"high-difference pairs and are omitted to keep the heatmap readable."
        )

    return selected, note


def compute_multivariate_results(
    real_df: pd.DataFrame,
    syn_df: pd.DataFrame,
    numerical_cols: list[str],
    categorical_cols: list[str],
    selected_metrics: list[EvaluationMetric],
) -> MultivariateResults:
    """
    Compute up to MULTIVARIATE_TOP_K pairs for each section, sorted by
    largest difference first so the most problematic pairs appear at the top.

    Three sections:
      corr_pairs    — Pearson r for every numerical × numerical pair
      cramers_pairs — Cramér's V for every categorical × categorical pair
      groupwise     — group-wise mean for every numerical × categorical pair

    Why top-K instead of all pairs?
    With 20 numerical columns there are 190 unique pairs.  Returning all of them
    would make the JSON response very large and the UI table unreadable.
    Top-5 by difference is enough for a quick diagnosis.

    Why sort by difference (not by absolute score)?
    A correlation of 0.9 in real vs 0.5 in synthetic is a bigger problem than
    0.2 in real vs 0.0 in synthetic, even though both real values look fine.
    Difference surfaces where the synthetic data diverges most from real.
    """

    # ── Numerical–Numerical: Pearson r ────────────────────────────────────────
    corr_pairs: list[CorrelationPair] = []
    real_corr_matrix: dict[str, dict[str, float]] | None = None
    syn_corr_matrix:  dict[str, dict[str, float]] | None = None

    if EvaluationMetric.correlation_difference in selected_metrics:
        for col1, col2 in combinations(numerical_cols, 2):
            # dropna() on the pair together so both columns lose the same rows —
            # computing r on mismatched row counts would give a wrong correlation.
            real_pair = real_df[[col1, col2]].dropna()
            syn_pair  = syn_df[[col1, col2]].dropna()
            if len(real_pair) < 3 or len(syn_pair) < 3:
                continue  # Pearson r is undefined with fewer than 3 data points
            real_r = float(real_pair[col1].corr(real_pair[col2]))
            syn_r  = float(syn_pair[col1].corr(syn_pair[col2]))
            if math.isnan(real_r) or math.isnan(syn_r):
                continue  # constant column produces NaN correlation
            corr_pairs.append(CorrelationPair(
                variable1=col1, variable2=col2,
                realCorrelation=round(real_r, 4),
                syntheticCorrelation=round(syn_r, 4),
                difference=round(abs(real_r - syn_r), 4),
            ))
        corr_pairs.sort(key=lambda pair: pair.difference, reverse=True)

        # Build heatmap matrices — only include variables selected by activity score
        # so the heatmap stays readable and focuses on the most divergent pairs.
        if corr_pairs:
            heatmap_vars, corr_heatmap_note = _select_active_corr_vars(
                corr_pairs, numerical_cols, MAX_CORR_HEATMAP_VARS
            )
            heatmap_var_set = set(heatmap_vars)

            real_m: dict[str, dict[str, float]] = {}
            syn_m:  dict[str, dict[str, float]] = {}

            # Only populate cells where both variables are in the selected set.
            for pair in corr_pairs:
                if pair.variable1 in heatmap_var_set and pair.variable2 in heatmap_var_set:
                    real_m.setdefault(pair.variable1, {})[pair.variable2] = pair.realCorrelation
                    real_m.setdefault(pair.variable2, {})[pair.variable1] = pair.realCorrelation
                    syn_m.setdefault(pair.variable1,  {})[pair.variable2] = pair.syntheticCorrelation
                    syn_m.setdefault(pair.variable2,  {})[pair.variable1] = pair.syntheticCorrelation

            # Diagonal: Pearson r of a variable with itself is always 1.
            for col in heatmap_vars:
                if col in real_m:
                    real_m[col][col] = 1.0
                    syn_m[col][col]  = 1.0

            real_corr_matrix = real_m
            syn_corr_matrix  = syn_m

    # ── Categorical–Categorical: Cramér's V ───────────────────────────────────
    # Cramér's V measures association strength between two categorical columns.
    # Range 0–1 (0 = independent, 1 = perfectly associated).
    # We compare V in real vs V in synthetic: a large difference means the
    # synthetic data has lost (or fabricated) a dependency between two categories.
    def cramers_v(df: pd.DataFrame, col1: str, col2: str) -> float | None:
        ct = pd.crosstab(df[col1].dropna(), df[col2].dropna())
        if ct.shape[0] < 2 or ct.shape[1] < 2:
            return None  # chi2 requires at least a 2×2 table
        # chi2_contingency returns (chi2_stat, p_value, dof, expected_freq); only stat is used
        chi2_stat, _, _, _ = chi2_contingency(ct)
        total_n = int(ct.sum().sum())
        min_dim = min(ct.shape) - 1  # min(rows, cols) - 1 for Cramér's V formula
        if min_dim == 0 or total_n == 0:
            return None
        return min(math.sqrt(float(chi2_stat) / (total_n * min_dim)), 1.0)

    cramers_pairs: list[CramersVPair] = []
    if EvaluationMetric.cramers_v_comparison in selected_metrics:
        for col1, col2 in combinations(categorical_cols, 2):
            real_v = cramers_v(real_df, col1, col2)
            syn_v  = cramers_v(syn_df, col1, col2)
            if real_v is None or syn_v is None:
                continue
            cramers_pairs.append(CramersVPair(
                variable1=col1, variable2=col2,
                realCramersV=round(real_v, 4),
                syntheticCramersV=round(syn_v, 4),
                difference=round(abs(real_v - syn_v), 4),
            ))
        cramers_pairs.sort(key=lambda pair: pair.difference, reverse=True)

    # Build Cramér's V matrices for the heatmap.
    # We run this outside the metric guard above so the variables list is
    # always available — but only if there is at least one valid pair.
    real_cramers_matrix: dict[str, dict[str, float]] | None = None
    syn_cramers_matrix:  dict[str, dict[str, float]] | None = None
    cramers_heatmap_note: str | None = None

    if cramers_pairs:
        # Pick the variables that carry the most diagnostic information.
        heatmap_vars, cramers_heatmap_note = _select_active_cramers_vars(
            cramers_pairs, categorical_cols, MAX_CRAMERS_HEATMAP_VARS
        )
        heatmap_var_set = set(heatmap_vars)

        real_cm: dict[str, dict[str, float]] = {}
        syn_cm:  dict[str, dict[str, float]] = {}

        # Populate off-diagonal cells — only for pairs where both variables
        # are in the selected set (avoids storing unused data).
        for pair in cramers_pairs:
            if pair.variable1 in heatmap_var_set and pair.variable2 in heatmap_var_set:
                real_cm.setdefault(pair.variable1, {})[pair.variable2] = pair.realCramersV
                real_cm.setdefault(pair.variable2, {})[pair.variable1] = pair.realCramersV
                syn_cm.setdefault(pair.variable1,  {})[pair.variable2] = pair.syntheticCramersV
                syn_cm.setdefault(pair.variable2,  {})[pair.variable1] = pair.syntheticCramersV

        # Diagonal: Cramér's V of a variable with itself is 1.0 by definition.
        for col in heatmap_vars:
            if col in real_cm:
                real_cm[col][col] = 1.0
                syn_cm[col][col]  = 1.0

        real_cramers_matrix = real_cm
        syn_cramers_matrix  = syn_cm

    # ── Mixed: group-wise mean (numerical × categorical) ─────────────────────
    # For each (numerical, categorical) pair, break the numerical column into
    # groups defined by the categorical column and compare group means.
    # Example: "mean time_in_hospital" for patients in each "admission_type" group.
    # A large difference reveals that the synthetic generator did not preserve the
    # conditional distribution of the numerical variable.
    #
    # Why only shared groups?
    # If synthetic data invented a new category value, there is no real group to
    # compare against, so we skip those rows to avoid a misleading comparison.
    groupwise: list[GroupwiseSummaryRow] = []
    if EvaluationMetric.numerical_categorical_association in selected_metrics:
        for num_col in numerical_cols:
            for cat_col in categorical_cols:
                shared_groups = (
                    set(real_df[cat_col].dropna().unique()) &
                    set(syn_df[cat_col].dropna().unique())
                )
                for group_val in shared_groups:
                    real_grp = real_df[real_df[cat_col] == group_val][num_col].dropna()
                    syn_grp  = syn_df[syn_df[cat_col]  == group_val][num_col].dropna()
                    if len(real_grp) < 5 or len(syn_grp) < 5:
                        continue  # too few samples for a meaningful mean comparison
                    real_mean = float(real_grp.mean())
                    syn_mean  = float(syn_grp.mean())
                    groupwise.append(GroupwiseSummaryRow(
                        numericalVariable=num_col,
                        categoricalVariable=cat_col,
                        groupValue=str(group_val),
                        realMean=round(real_mean, 2),
                        syntheticMean=round(syn_mean, 2),
                        difference=round(abs(real_mean - syn_mean), 2),
                    ))
        groupwise.sort(key=lambda row: row.difference, reverse=True)

    return MultivariateResults(
        topCorrelationPairs=corr_pairs[:MULTIVARIATE_TOP_K],
        topCramersVPairs=cramers_pairs[:MULTIVARIATE_TOP_K],
        topGroupwiseRows=groupwise[:GROUPWISE_TOP_K],
        realCorrelationMatrix=real_corr_matrix,
        synCorrelationMatrix=syn_corr_matrix,
        corrHeatmapNote=corr_heatmap_note if corr_pairs else None,
        realCramersVMatrix=real_cramers_matrix,
        synCramersVMatrix=syn_cramers_matrix,
        cramersVHeatmapNote=cramers_heatmap_note,
    )
