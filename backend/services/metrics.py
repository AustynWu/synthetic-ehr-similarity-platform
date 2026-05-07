# services/metrics.py — per-column statistical metric calculations
#
# Each function receives two pandas Series (real vs synthetic) and returns a
# (raw_value, normalized_score) tuple, where:
#   raw_value        — the actual statistical number (e.g. KS statistic = 0.22)
#   normalized_score — 0–1 scale where 1 = identical, 0 = completely different
#
# Returning both values lets the frontend show the raw number in the metric
# table while using the normalized score for colour-coding and ranking.

import math
import pandas as pd
from scipy.stats import ks_2samp, chi2_contingency, wasserstein_distance as scipy_wasserstein

from schemas import DataTypeLabel, EvaluationMetric
from constants import CHI_SQUARE_MAX_CATEGORIES


def compute_metric(
    metric: EvaluationMetric,
    real_col: pd.Series,
    syn_col: pd.Series,
    col_type: DataTypeLabel,
) -> tuple[float, float] | None:
    """
    Calculate one metric for one column.
    Returns (raw_value, normalized_score) or None if the metric does not apply
    to this column type (e.g. KS test on a categorical column).

    Returning None (not 0) is intentional: a score of 0 would drag down the
    column's average even though the metric was never applicable.
    """
    # Drop NaN before any calculation so metrics are not distorted by missing values.
    # Each metric drops independently — the caller does not pre-clean the series —
    # because different metrics may tolerate different amounts of missingness.
    r = real_col.dropna()
    s = syn_col.dropna()

    if len(r) == 0 or len(s) == 0:
        return None

    # ── Mean Difference (numerical only) ─────────────────────────────────────
    # Uses Cohen's d: gap divided by real std so scores are comparable across
    # columns with different scales (e.g. age 0–100 vs HbA1c 4–14).
    # Score = exp(-d): approaches 1 when d≈0, approaches 0 as d grows.
    if metric == EvaluationMetric.mean_difference and col_type == DataTypeLabel.numerical:
        std = r.std()
        raw = abs(float(r.mean()) - float(s.mean())) / (std if std > 0 else 1.0)
        return raw, round(math.exp(-raw), 4)

    # ── KS Test (numerical only) ──────────────────────────────────────────────
    # D = largest vertical gap between the two CDFs.
    # Score = 1 - D so that a perfect match (D=0) gives score 1.
    if metric == EvaluationMetric.ks_test and col_type == DataTypeLabel.numerical:
        stat, _ = ks_2samp(r.values, s.values)
        return float(stat), 1.0 - float(stat)

    # ── Wasserstein Distance (numerical only) ─────────────────────────────────
    # Raw distance is divided by the real column's range to make it scale-independent
    # (otherwise a column ranging 0–1000 would always look worse than one ranging 0–1).
    # Score is clamped at 0 in case synthetic values extend beyond the real range.
    if metric == EvaluationMetric.wasserstein_distance and col_type == DataTypeLabel.numerical:
        col_range = float(r.max() - r.min())
        if col_range == 0:
            return None  # constant column — distance is meaningless
        raw = float(scipy_wasserstein(r.values, s.values))
        return raw, max(0.0, 1.0 - raw / col_range)

    # ── Chi-square Test (categorical only) ────────────────────────────────────
    # Converted to Cramér's V so the score is not inflated by large row counts
    # (raw chi2 statistic grows with N even when distributions are identical).
    # Score = 1 - V so that V=0 (identical proportions) gives score 1.
    if metric == EvaluationMetric.chi_square and col_type == DataTypeLabel.categorical:
        all_cats = set(r.unique()) | set(s.unique())
        if len(all_cats) > CHI_SQUARE_MAX_CATEGORIES:
            return None  # too many categories — chi2 expected cell counts become too small
        real_counts = r.value_counts().reindex(all_cats, fill_value=0)
        syn_counts  = s.value_counts().reindex(all_cats, fill_value=0)
        contingency = pd.DataFrame({"real": real_counts, "synthetic": syn_counts})
        stat, _, _, _ = chi2_contingency(contingency.values)
        n = len(r) + len(s)
        k = len(all_cats)
        cramers_v = math.sqrt(float(stat) / (n * max(k - 1, 1)))
        cramers_v = min(cramers_v, 1.0)  # clamp: floating-point errors can push it slightly above 1
        return float(stat), round(1.0 - cramers_v, 4)

    # ── Category Proportion Difference (categorical only) ─────────────────────
    # Average absolute difference in proportion across all categories.
    # Intuitive interpretation: "on average, each category's share differs by X%".
    # reindex with fill_value=0 handles categories present in one dataset but not the other.
    if metric == EvaluationMetric.category_proportion_difference and col_type == DataTypeLabel.categorical:
        all_cats = set(r.unique()) | set(s.unique())
        real_prop = r.value_counts(normalize=True).reindex(all_cats, fill_value=0.0)
        syn_prop  = s.value_counts(normalize=True).reindex(all_cats, fill_value=0.0)
        raw = float((real_prop - syn_prop).abs().mean())
        return raw, 1.0 - raw

    return None


def compute_correlation_difference(
    real_df: pd.DataFrame,
    syn_df: pd.DataFrame,
    numerical_cols: list[str],
) -> dict[str, tuple[float, float]]:
    """
    For each numerical column, compute the average absolute difference between
    its Pearson correlations with all other numerical columns in real vs synthetic.

    Why a separate function instead of inside compute_metric()?
    Pearson correlation is a pairwise operation — it needs the full DataFrame to
    compute the correlation matrix.  compute_metric() only receives one column at a
    time, so correlation_difference must be computed outside the per-column loop and
    its results merged back in afterward.

    Raw score range: 0 (identical correlations) to 2 (every correlation flipped sign).
    Score: max(0, 1 - raw/2), so a raw of 0 → score 1, raw of 2 → score 0.
    fillna(0) replaces NaN cells in the correlation matrix (constant columns produce NaN).
    """
    if len(numerical_cols) < 2:
        return {}  # correlation requires at least two columns

    real_corr = real_df[numerical_cols].corr().fillna(0)
    syn_corr  = syn_df[numerical_cols].corr().fillna(0)
    diff = (real_corr - syn_corr).abs()

    result: dict[str, tuple[float, float]] = {}
    for col in numerical_cols:
        others = [c for c in numerical_cols if c != col]
        if not others:
            continue
        raw = float(diff.loc[col, others].mean())
        result[col] = (raw, max(0.0, 1.0 - raw / 2.0))

    return result
