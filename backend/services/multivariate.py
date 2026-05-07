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
from constants import MULTIVARIATE_TOP_K


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
        topGroupwiseRows=groupwise[:MULTIVARIATE_TOP_K],
    )
