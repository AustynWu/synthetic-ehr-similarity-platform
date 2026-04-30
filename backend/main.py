# main.py — FastAPI backend for the EHR Similarity Platform
#
# What this file does:
#   This is the backend server. When the frontend sends a request (e.g. "upload files",
#   "run evaluation"), this file receives the request, does the heavy work, and sends
#   a response back to the browser.
#
# Why FastAPI?
#   FastAPI is a Python web framework. It reads type hints (like "req: ValidateRequest")
#   and automatically validates incoming data — if the frontend sends the wrong shape,
#   FastAPI rejects it with a clear error message before our code even runs.
#
# Flow overview:
#   1. User uploads two CSV files       → POST /datasets/upload   → saves files, returns IDs
#   2. Frontend validates the pair      → POST /datasets/validate  → returns schema comparison
#   3. User picks columns and metrics   → (no API call, frontend-only)
#   4. Frontend runs the evaluation     → POST /evaluations/run   → returns similarity scores
#   5. User saves the result            → POST /comparisons/save  → stores a summary record
#   6. Saved page loads past runs       → GET  /comparisons       → returns the list

import uuid          # generates random unique IDs (e.g. "real-a1b2c3d4")
import math          # used for Cramér's V square root calculation
import statistics    # provides statistics.mean() — cleaner than sum()/len()
from itertools import combinations  # generates all unique pairs from a list
from datetime import datetime, timezone  # for ISO 8601 timestamps
from pathlib import Path  # cross-platform file path handling (works on Windows and Mac)

import pandas as pd  # reads CSV files into DataFrames; counts rows, columns, missing values
from scipy.stats import ks_2samp, chi2_contingency, wasserstein_distance as scipy_wasserstein
# ks_2samp             — Kolmogorov-Smirnov test: compares two numerical distributions
# chi2_contingency     — Chi-square test: compares two categorical distributions
# scipy_wasserstein    — Wasserstein distance: measures how much one distribution must "move" to match another


# ── Dataset-specific constants ────────────────────────────────

# Columns that look like integers but are actually lookup codes (not magnitudes).
# Example: discharge_disposition_id=1 means "discharged home", not a value of 1.
# We force these to be treated as categorical so chi-square is used instead of KS test.
KNOWN_CATEGORICAL_INT_COLS: set[str] = {
    "discharge_disposition_id",
    "admission_source_id",
    "admission_type_id",
}

# Columns that are unique identifiers — comparing them between datasets is meaningless.
# encounter_id: every row has a different value (100% unique).
# patient_nbr: synthetic dataset uses fake IDs starting at 9,000,000,000 — not comparable.
KNOWN_ID_COLS: set[str] = {
    "encounter_id",
    "patient_nbr",
}

# Top K pairs returned in each multivariate section (keeps response size predictable)
MULTIVARIATE_TOP_K = 5

# Maximum number of unique categories allowed for chi-square.
# diag_1/2/3 have 700+ ICD codes — a 700×2 contingency table produces a huge chi2 statistic
# that normalises to near 0, making the score misleading even when distributions look similar.
# Columns above this limit are skipped for chi-square (category_proportion_difference still runs).
CHI_SQUARE_MAX_CATEGORIES = 50

from fastapi import FastAPI, File, UploadFile, HTTPException
# FastAPI    — the main app class
# File       — marks a parameter as a file upload field
# UploadFile — the type for a file the frontend sends
# HTTPException — used to return errors (e.g. 404 Not Found) with a readable message

from fastapi.middleware.cors import CORSMiddleware
# CORS (Cross-Origin Resource Sharing):
#   The browser blocks frontend (localhost:5173) from talking to a different server (localhost:8000)
#   unless the backend explicitly allows it. CORSMiddleware adds the right headers to allow this.

from schemas import (
    DatasetFile, DatasetFileType, DatasetRole, DatasetStatus, DataTypeLabel,
    SchemaStatus, SchemaComparisonRow, DatasetBasicSummary,
    UploadedDatasets, ValidateRequest, ValidationSummary, ValidationIssue, AvailableColumn,
    MetricDefinition, EvaluationMetric,
    RunEvaluationRequest, EvaluationResult, EvaluationSummary, AnalysisContext,
    VariableRankingItem, MetricMatrix, MetricMatrixCell,
    VariableDetailView, DetailViewSeries, DetailViewMetric,
    MultivariateResults, CorrelationPair, CramersVPair, GroupwiseSummaryRow,
    SaveComparisonRequest, SavedComparison,
)
# All the type definitions live in schemas.py (mirroring the TypeScript types in contracts.ts).
# Importing them here lets FastAPI validate request bodies and auto-generate API docs.

# ── App setup ─────────────────────────────────────────────────

app = FastAPI(title="Synthetic vs Real EHR Similarity API")

# Allow the frontend development server to call this backend.
# allow_origins: only localhost:5173 (the Vite dev server) is permitted.
# allow_methods/headers: "*" means any HTTP method (GET, POST, etc.) and any header are allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── In-memory stores ──────────────────────────────────────────
#
# Why in-memory instead of a real database?
#   This is a prototype — a simple dictionary and list are enough.
#   The downside: data is lost when the server restarts. That is acceptable for now.
#
# uploaded_files:    maps dataset ID (e.g. "real-a1b2c3d4") → the file path on disk
# saved_comparisons: a list of past evaluation run summaries, newest first

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)  # create the folder if it does not already exist

uploaded_files: dict[str, Path] = {}
saved_comparisons: list[SavedComparison] = []


# ── Metric catalogue ──────────────────────────────────────────
#
# This list mirrors the availableMetrics array in evaluationService.ts.
# It is returned by GET /metrics so the frontend can stay in sync with the backend.
# Keeping it here means the backend is the single source of truth for what metrics exist.

METRIC_CATALOGUE: list[MetricDefinition] = [
    MetricDefinition(key=EvaluationMetric.mean_difference,                   label="Mean Difference",                    description="Compares numerical averages for variables such as time_in_hospital and num_medications.",                                                                   appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.ks_test,                           label="KS Test",                            description="Measures numerical distribution similarity for utilisation and count fields.",                                                                           appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.wasserstein_distance,              label="Wasserstein Distance",                description="Estimates distribution gaps for numerical diabetes variables.",                                                                                         appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.chi_square,                        label="Chi-square Test",                    description="Compares categorical distributions such as readmitted, gender, and diabetesMed.",                                                                       appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.category_proportion_difference,    label="Category Proportion Difference",     description="Summarises how close category proportions are between real and synthetic datasets.",                                                                     appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.correlation_difference,            label="Correlation Difference",             description="Represents a simplified relationship-preservation view for later multivariate analysis.",                                                                appliesTo="multivariate"),
    MetricDefinition(key=EvaluationMetric.numerical_categorical_association, label="Numerical–Categorical Association",  description="Compares how a numerical variable's distribution shifts across categories between real and synthetic data.",                                              appliesTo="cross_type"),
]


# ── Base importance map (from playbook section 7) ─────────────
#
# These weights represent how clinically important each variable is in diabetes research.
# "readmitted" is 0.95 because whether a patient was readmitted is a key outcome measure.
# "gender" is 0.60 because it matters but is less directly tied to clinical outcomes.
# Any column not in this map gets the DEFAULT_BASE_IMPORTANCE of 0.50.

BASE_IMPORTANCE: dict[str, float] = {
    "readmitted":         0.95,
    "A1Cresult":          0.90,
    "time_in_hospital":   0.90,
    "num_medications":    0.85,
    "diabetesMed":        0.85,
    "number_diagnoses":   0.80,
    "num_lab_procedures": 0.80,
    "insulin":            0.80,
    "num_procedures":     0.75,
    "gender":             0.60,
}
DEFAULT_BASE_IMPORTANCE = 0.50


# ═══════════════════════════════════════════════════════════════
# Helper functions
# ═══════════════════════════════════════════════════════════════

def infer_type(series: pd.Series, col_name: str = "") -> DataTypeLabel:
    """
    Look at a column's data and decide whether it is numerical, categorical, text, or datetime.
    Why do we need this? The CSV file does not tell us column types — we have to guess from the data.

    Rules used (in order):
    1. Known ID columns (encounter_id, patient_nbr) → always excluded (returned as unknown)
    2. Known integer code columns (e.g. discharge_disposition_id) → always categorical
    3. datetime64 dtype → datetime
    4. Numeric with ≤10 unique values AND <2% of total rows → categorical (e.g. num_procedures=0-6)
    5. Numeric otherwise → numerical
    6. String dtype (pandas 3.x uses StringDtype, older pandas uses object) with <10% unique → categorical
    7. String with many unique values → text (e.g. free-form notes)
    8. Anything else → unknown

    FIX vs original: pandas 3.x changed string column dtype from `object` to `StringDtype`.
    The old check `series.dtype == object` always returned False for string columns in pandas 3.x,
    causing all string columns to fall through to `unknown`. Now we also check `dtype.name == 'str'`.
    """
    # Step 1: ID columns should never be analysed — comparing IDs between datasets is meaningless
    if col_name in KNOWN_ID_COLS:
        return DataTypeLabel.unknown

    # Step 2: Known integer code columns — treat as categorical regardless of cardinality
    if col_name in KNOWN_CATEGORICAL_INT_COLS:
        return DataTypeLabel.categorical

    if pd.api.types.is_datetime64_any_dtype(series):
        return DataTypeLabel.datetime

    if pd.api.types.is_numeric_dtype(series):
        # nunique() counts how many distinct values exist in the column
        if series.nunique() <= 10 and series.nunique() / max(len(series), 1) < 0.02:
            return DataTypeLabel.categorical
        return DataTypeLabel.numerical

    # FIX: pandas 3.x uses StringDtype (dtype.name == 'str'), not the old object dtype.
    # We check both so the code works on pandas 2.x and 3.x.
    is_string_col = (series.dtype == object) or (series.dtype.name == "str")
    if is_string_col:
        if series.nunique() / max(len(series), 1) < 0.1:
            return DataTypeLabel.categorical
        return DataTypeLabel.text

    return DataTypeLabel.unknown


def compute_metric(
    metric: EvaluationMetric,
    real_col: pd.Series,
    syn_col: pd.Series,
    col_type: DataTypeLabel,
) -> tuple[float, float] | None:
    """
    Calculate one metric for one column.
    Returns (raw_value, normalized_score) or None if the metric does not apply to this column type.

    Why two values?
    - raw_value: the actual statistical number (e.g. KS statistic = 0.22)
    - normalized_score: converted to 0-1 scale where 1 = identical, 0 = completely different
      The dashboard always shows normalized scores so all metrics are on the same scale.

    Normalization formulas follow the playbook section 6.
    """
    # dropna() removes missing values before calculating.
    # Why? Most statistical tests cannot handle NaN values — they would throw an error or give wrong results.
    r = real_col.dropna()
    s = syn_col.dropna()

    # If a column is entirely empty after dropping NaN, we cannot compute anything.
    if len(r) == 0 or len(s) == 0:
        return None

    # ── Mean Difference (numerical only) ──────────────────────
    if metric == EvaluationMetric.mean_difference and col_type == DataTypeLabel.numerical:
        std = r.std()
        # Why divide by std?
        #   Raw mean difference is scale-dependent: a difference of 1 day means something very different
        #   for time_in_hospital vs num_medications. Dividing by std (standard deviation) makes it
        #   dimensionless — this is called Cohen's d style normalization.
        raw = abs(float(r.mean()) - float(s.mean())) / (std if std > 0 else 1.0)
        # Normalization: score = max(0, 1 - raw). If raw >= 1 the score is 0 (very different).
        return raw, max(0.0, 1.0 - raw)

    # ── KS Test (numerical only) ───────────────────────────────
    if metric == EvaluationMetric.ks_test and col_type == DataTypeLabel.numerical:
        # ks_2samp returns (statistic, p_value).
        # The statistic D is the maximum distance between the two cumulative distributions (0 to 1).
        # D = 0 means identical distributions; D = 1 means completely different.
        # We ignore p_value here — we use D directly as the raw metric.
        stat, _ = ks_2samp(r.values, s.values)
        # Normalization: score = 1 - D
        return float(stat), 1.0 - float(stat)

    # ── Wasserstein Distance (numerical only) ──────────────────
    if metric == EvaluationMetric.wasserstein_distance and col_type == DataTypeLabel.numerical:
        raw = float(scipy_wasserstein(r.values, s.values))
        # Why normalize by column range?
        #   Wasserstein distance is in the same units as the column (e.g. days, count of medications).
        #   A distance of 0.5 days is tiny for time_in_hospital but huge for a 0-1 binary variable.
        #   Dividing by the real column's range converts it to a proportion (0 to 1).
        col_range = float(r.max() - r.min())
        normalized_raw = raw / col_range if col_range > 0 else 0.0
        return raw, max(0.0, 1.0 - normalized_raw)

    # ── Chi-square Test (categorical only) ────────────────────
    if metric == EvaluationMetric.chi_square and col_type == DataTypeLabel.categorical:
        all_cats = set(r.unique()) | set(s.unique())

        # Guard: columns with too many unique categories (e.g. diag_1 with 700+ ICD codes)
        # produce a chi2 statistic so large that the normalized score is always near 0,
        # even when the distributions are actually very similar. Skip them here;
        # category_proportion_difference (which uses proportions directly) still runs on them.
        if len(all_cats) > CHI_SQUARE_MAX_CATEGORIES:
            return None

        # Build a contingency table: rows = category values, columns = real vs synthetic.
        # | (value) | real count | synthetic count |
        # | "NO"    | 54321      | 53000           |
        # | ">30"   | 12345      | 11000           |
        # reindex fills in 0 for any category that appears in one dataset but not the other.
        real_counts = r.value_counts().reindex(all_cats, fill_value=0)
        syn_counts  = s.value_counts().reindex(all_cats, fill_value=0)
        contingency = pd.DataFrame({"real": real_counts, "synthetic": syn_counts})
        stat, _, _, _ = chi2_contingency(contingency.values)

        # FIX: use Cramér's V instead of the old 1/(1+stat/5) formula.
        #
        # Why the old formula was wrong for this dataset:
        #   With 101,766 rows, even a tiny real difference produces a large chi2 statistic
        #   because statistical power scales with sample size. The formula 1/(1+stat/5)
        #   was calibrated for small datasets — metformin got a score of 0.21 (poor) even
        #   though the category proportions look nearly identical visually.
        #
        # Cramér's V = sqrt(chi2 / (n * (k-1)))
        #   n = total observations, k = number of categories (degrees of freedom proxy)
        #   V is always 0–1: 0 = perfectly different, 1 = perfectly matching.
        #   We then convert to a similarity score: score = 1 - V
        #   (V=0 → score=1 identical; V=1 → score=0 completely different)
        n = len(r) + len(s)
        k = len(all_cats)
        cramers_v = math.sqrt(float(stat) / (n * max(k - 1, 1)))
        cramers_v = min(cramers_v, 1.0)  # clamp to 1.0 in case of floating point overshoot
        return float(stat), round(1.0 - cramers_v, 4)

    # ── Category Proportion Difference (categorical only) ──────
    if metric == EvaluationMetric.category_proportion_difference and col_type == DataTypeLabel.categorical:
        # For each category value, compute its proportion (fraction of rows) in real and synthetic.
        # Then take the absolute difference for each category and average them.
        # Example: "NO" is 70% in real, 65% in synthetic → difference = 0.05
        all_cats = set(r.unique()) | set(s.unique())
        real_prop = r.value_counts(normalize=True).reindex(all_cats, fill_value=0.0)
        syn_prop  = s.value_counts(normalize=True).reindex(all_cats, fill_value=0.0)
        raw = float((real_prop - syn_prop).abs().mean())
        # Normalization: score = 1 - raw. If proportions are identical, raw=0 → score=1.
        return raw, 1.0 - raw

    # This metric does not apply to this column type → return nothing
    return None


def compute_correlation_difference(
    real_df: pd.DataFrame,
    syn_df: pd.DataFrame,
    numerical_cols: list[str],
) -> dict[str, tuple[float, float]]:
    """
    Measures how well the relationships between numerical columns are preserved.

    Why is this separate from compute_metric?
      Correlation difference is a multivariate metric — it compares the correlation matrix
      of ALL selected numerical columns at once, not one column at a time.
      compute_metric only handles one column per call, so this calculation needs its own function.

    For each column, we compute: average |corr_real(col, other) - corr_syn(col, other)|
    This tells us how much that column's relationships with other columns changed.

    Returns a dict: column_name → (raw_value, normalized_score)
    Normalized score: max(0, 1 - raw / 2). Dividing by 2 because correlation differences
    range from 0 to 2 in the worst case (e.g. +1 vs -1).
    """
    # We need at least 2 numerical columns to compute a correlation (a column cannot correlate with itself).
    if len(numerical_cols) < 2:
        return {}

    # .corr() computes the Pearson correlation matrix (a number -1 to +1 for every pair of columns).
    # fillna(0) replaces NaN (which appears when a column has zero variance) with 0.
    real_corr = real_df[numerical_cols].corr().fillna(0)
    syn_corr  = syn_df[numerical_cols].corr().fillna(0)

    # Element-wise absolute difference between the two correlation matrices
    diff = (real_corr - syn_corr).abs()

    result: dict[str, tuple[float, float]] = {}
    for col in numerical_cols:
        # Exclude the column's correlation with itself (always 1.0, difference = 0 — not useful).
        others = [c for c in numerical_cols if c != col]
        if not others:
            continue
        # diff.loc[col, others] selects one row and multiple columns from the difference matrix.
        raw = float(diff.loc[col, others].mean())
        result[col] = (raw, max(0.0, 1.0 - raw / 2.0))

    return result


def compute_importance(col: str, missing_rate: float, series: pd.Series, col_type: DataTypeLabel) -> float:
    """
    Calculate how important this variable is in the analysis (0 to 1 scale).

    This is NOT a similarity metric — it is a weight that tells the ranking table
    which variables matter most. A high importance means the variable should appear
    near the top of the ranking even if its similarity score is low.

    Formula (from playbook section 7):
      importance = base_importance * completeness_score * variability_score

    - base_importance: how clinically significant this variable is (from BASE_IMPORTANCE map)
    - completeness_score: 1 - missing_rate — columns with many missing values are less reliable
    - variability_score: penalises columns that carry almost no information
        - numerical: if std = 0, every row has the same value → score = 0 (not useful)
        - categorical: if only 1 unique value → score = 0; more categories → score closer to 1
    """
    base = BASE_IMPORTANCE.get(col, DEFAULT_BASE_IMPORTANCE)
    completeness = 1.0 - missing_rate

    if col_type == DataTypeLabel.numerical:
        # A column where every patient has the exact same value (std = 0) is not informative.
        variability = 0.0 if series.std() == 0 else 1.0
    else:
        n_unique = series.nunique()
        # 1 - (1 / n_unique): with 2 unique values → 0.5; with 10 → 0.9; with 1 → 0.0
        variability = 1.0 - (1.0 / n_unique) if n_unique > 1 else 0.0

    return round(base * completeness * variability, 4)


def compute_multivariate_results(
    real_df: pd.DataFrame,
    syn_df: pd.DataFrame,
    numerical_cols: list[str],
    categorical_cols: list[str],
) -> MultivariateResults:
    """
    Compute top K pairs for each multivariate analysis type, sorted by largest difference first.

    Why top K instead of all pairs?
      With n variables, Numerical-Numerical alone has C(n,2) pairs — this grows fast.
      Showing only the pairs with the biggest difference focuses attention on what matters most.
    """

    # ── Numerical–Numerical: Pearson r ────────────────────────
    corr_pairs: list[CorrelationPair] = []
    for col1, col2 in combinations(numerical_cols, 2):
        # Build aligned pairs (drop rows where either column is NaN)
        real_pair = real_df[[col1, col2]].dropna()
        syn_pair  = syn_df[[col1, col2]].dropna()
        if len(real_pair) < 3 or len(syn_pair) < 3:
            continue
        real_r = float(real_pair[col1].corr(real_pair[col2]))
        syn_r  = float(syn_pair[col1].corr(syn_pair[col2]))
        if math.isnan(real_r) or math.isnan(syn_r):
            continue
        corr_pairs.append(CorrelationPair(
            variable1=col1, variable2=col2,
            realCorrelation=round(real_r, 4),
            syntheticCorrelation=round(syn_r, 4),
            difference=round(abs(real_r - syn_r), 4),
        ))
    corr_pairs.sort(key=lambda x: x.difference, reverse=True)

    # ── Categorical–Categorical: Cramér's V ───────────────────
    def cramers_v(df: pd.DataFrame, c1: str, c2: str) -> float | None:
        ct = pd.crosstab(df[c1].dropna(), df[c2].dropna())
        if ct.shape[0] < 2 or ct.shape[1] < 2:
            return None
        stat, _, _, _ = chi2_contingency(ct)
        n = int(ct.sum().sum())
        k = min(ct.shape) - 1
        if k == 0 or n == 0:
            return None
        return min(math.sqrt(float(stat) / (n * k)), 1.0)

    cramers_pairs: list[CramersVPair] = []
    for col1, col2 in combinations(categorical_cols, 2):
        real_v = cramers_v(real_df, col1, col2)
        syn_v  = cramers_v(syn_df,  col1, col2)
        if real_v is None or syn_v is None:
            continue
        cramers_pairs.append(CramersVPair(
            variable1=col1, variable2=col2,
            realCramersV=round(real_v, 4),
            syntheticCramersV=round(syn_v, 4),
            difference=round(abs(real_v - syn_v), 4),
        ))
    cramers_pairs.sort(key=lambda x: x.difference, reverse=True)

    # ── Mixed: group-wise mean ────────────────────────────────
    groupwise: list[GroupwiseSummaryRow] = []
    for num_col in numerical_cols:
        for cat_col in categorical_cols:
            # Only groups that exist in both datasets are comparable
            shared_groups = (
                set(real_df[cat_col].dropna().unique()) &
                set(syn_df[cat_col].dropna().unique())
            )
            for group_val in shared_groups:
                real_grp = real_df[real_df[cat_col] == group_val][num_col].dropna()
                syn_grp  = syn_df[syn_df[cat_col]  == group_val][num_col].dropna()
                # Require at least 5 rows per group for a meaningful mean
                if len(real_grp) < 5 or len(syn_grp) < 5:
                    continue
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
    groupwise.sort(key=lambda x: x.difference, reverse=True)

    return MultivariateResults(
        topCorrelationPairs=corr_pairs[:MULTIVARIATE_TOP_K],
        topCramersVPairs=cramers_pairs[:MULTIVARIATE_TOP_K],
        topGroupwiseRows=groupwise[:MULTIVARIATE_TOP_K],
    )


def build_detail_series(
    real_col: pd.Series,
    syn_col: pd.Series,
    col_type: DataTypeLabel,
) -> list[DetailViewSeries]:
    """
    Build the bar chart data for the variable detail panel.

    For categorical columns: one bar per category value showing proportion in real vs synthetic.
    For numerical columns:   10 equal-width histogram bins showing the distribution shape.

    Why proportions (0-1) instead of raw counts?
      Real and synthetic datasets may have different numbers of rows.
      Proportions make comparison fair regardless of dataset size.
    """
    if col_type == DataTypeLabel.categorical:
        # Sort categories so the chart order is consistent between runs.
        all_cats = sorted(set(real_col.dropna().unique()) | set(syn_col.dropna().unique()))
        # normalize=True converts counts to proportions automatically.
        real_prop = real_col.value_counts(normalize=True)
        syn_prop  = syn_col.value_counts(normalize=True)
        return [
            DetailViewSeries(
                label=str(cat),
                # .get(cat, 0.0) safely returns 0 if this category does not appear in the dataset.
                real=round(float(real_prop.get(cat, 0.0)), 4),
                synthetic=round(float(syn_prop.get(cat, 0.0)), 4),
            )
            for cat in all_cats[:20]  # cap at 20 bars — more than that becomes unreadable in the UI
        ]
    else:
        # pd.cut divides the real column's range into 10 equal-width buckets.
        # We use the real column's range as the reference so the synthetic column
        # is measured against the same scale.
        col_min = float(real_col.min())
        col_max = float(real_col.max())
        bins = pd.cut(real_col, bins=10, include_lowest=True)
        bin_labels = [str(b) for b in bins.cat.categories]

        # Count what proportion of real values falls in each bin.
        real_counts = pd.cut(real_col, bins=bins.cat.categories, include_lowest=True).value_counts(normalize=True, sort=False)

        # .clip(col_min, col_max) clamps synthetic values to the real column's range
        # so they can be placed into the same bins without errors.
        syn_counts = pd.cut(syn_col.clip(col_min, col_max), bins=bins.cat.categories, include_lowest=True).value_counts(normalize=True, sort=False)

        # zip pairs each label with its corresponding bin interval object.
        return [
            DetailViewSeries(
                label=label,
                real=round(float(real_counts.get(cat, 0.0)), 4),
                synthetic=round(float(syn_counts.get(cat, 0.0)), 4),
            )
            for label, cat in zip(bin_labels, bins.cat.categories)
        ]


# ═══════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════
#
# @app.get / @app.post are decorators — they register the function below as the handler
# for a specific URL and HTTP method. When a request arrives at that URL, FastAPI calls
# the function automatically.
#
# response_model tells FastAPI what shape the response should be.
# FastAPI uses it to validate and filter the return value before sending it to the frontend.


@app.get("/health")
def health():
    # A simple check endpoint. The frontend can call this to confirm the backend is running.
    return {"status": "ok"}


# ── GET /metrics ─────────────────────────────────────────────

@app.get("/metrics", response_model=list[MetricDefinition])
def get_metrics():
    # Just returns the static catalogue — no dataset needed, no calculation.
    return METRIC_CATALOGUE


# ── POST /datasets/upload ────────────────────────────────────

@app.post("/datasets/upload", response_model=UploadedDatasets)
async def upload_datasets(
    real_file: UploadFile = File(...),
    synthetic_file: UploadFile = File(...),
):
    """
    Receive two CSV files from the frontend and save them to disk.
    Returns unique IDs and metadata for both files so the frontend can reference them in later calls.

    Why async?
      Reading a file from the network takes time (it is I/O-bound).
      async/await lets the server handle other requests while waiting for the file to arrive,
      instead of blocking the entire process.

    Why File(...)?
      The ... (Ellipsis) means this parameter is required — the request will be rejected
      if the frontend does not include this file field.
    """
    # timezone.utc ensures the timestamp is always in UTC, not the server's local time.
    now = datetime.now(timezone.utc).isoformat()

    # uuid4() generates a random 128-bit UUID. hex[:8] takes only the first 8 hex characters.
    # This gives IDs like "real-a1b2c3d4" — short enough to read, unique enough for a prototype.
    real_id = f"real-{uuid.uuid4().hex[:8]}"
    syn_id  = f"syn-{uuid.uuid4().hex[:8]}"

    # await reads all bytes from the uploaded file into memory.
    real_contents = await real_file.read()
    syn_contents  = await synthetic_file.read()

    # Save to disk so later endpoints (validate, run) can reload the files by ID.
    real_path = UPLOAD_DIR / f"{real_id}.csv"
    syn_path  = UPLOAD_DIR / f"{syn_id}.csv"
    real_path.write_bytes(real_contents)
    syn_path.write_bytes(syn_contents)

    # Store the mapping ID → path in memory so other endpoints can find the file quickly.
    uploaded_files[real_id] = real_path
    uploaded_files[syn_id]  = syn_path

    return UploadedDatasets(
        realDataset=DatasetFile(
            id=real_id,
            role=DatasetRole.real,
            fileName=real_file.filename or "real.csv",  # filename can be None in rare cases
            fileType=DatasetFileType.csv,
            sizeBytes=len(real_contents),
            uploadedAt=now,
            status=DatasetStatus.uploaded,
        ),
        syntheticDataset=DatasetFile(
            id=syn_id,
            role=DatasetRole.synthetic,
            fileName=synthetic_file.filename or "synthetic.csv",
            fileType=DatasetFileType.csv,
            sizeBytes=len(syn_contents),
            uploadedAt=now,
            status=DatasetStatus.uploaded,
        ),
    )


# ── POST /datasets/validate ──────────────────────────────────

@app.post("/datasets/validate", response_model=ValidationSummary)
def validate_datasets(req: ValidateRequest):
    """
    Load both uploaded CSV files and check whether they are compatible for analysis.
    Returns column-by-column comparison, missing value rates, warnings, and a canProceed flag.

    This endpoint does NOT calculate similarity scores yet.
    Its only job is to report what the data looks like and flag any problems.
    """
    # Look up the file paths using the IDs the frontend sent.
    real_path = uploaded_files.get(req.realDatasetId)
    syn_path  = uploaded_files.get(req.syntheticDatasetId)

    # If the ID is not in our dictionary, the file was never uploaded (or the server restarted).
    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    # na_values=['?'] converts the dataset's '?' placeholder to NaN automatically.
    # This dataset uses '?' to represent missing values instead of leaving cells blank.
    # Without this, '?' would be treated as a real category value and distort all metrics.
    real_df = pd.read_csv(real_path, na_values=["?"])
    syn_df  = pd.read_csv(syn_path,  na_values=["?"])

    # ── Basic summary for each file ───────────────────────────
    # This inner function avoids writing the same DataFrame inspection code twice.
    def basic_summary(file_id: str, name: str, df: pd.DataFrame) -> DatasetBasicSummary:
        return DatasetBasicSummary(
            fileId=file_id,
            fileName=name,
            rowCount=len(df),
            columnCount=len(df.columns),
            # isnull() returns a DataFrame of True/False; sum().sum() counts all True values.
            missingValueCount=int(df.isnull().sum().sum()),
            # duplicated() marks every row that is an exact copy of a previous row.
            duplicateRowCount=int(df.duplicated().sum()),
            # isnull().any() is True for each column that has at least one missing value.
            missingColumnCount=int((df.isnull().any()).sum()),
        )

    real_summary = basic_summary(req.realDatasetId, uploaded_files[req.realDatasetId].name, real_df)
    syn_summary  = basic_summary(req.syntheticDatasetId, uploaded_files[req.syntheticDatasetId].name, syn_df)

    # ── Schema comparison (column by column) ─────────────────
    real_cols = set(real_df.columns)
    syn_cols  = set(syn_df.columns)
    all_cols  = real_cols | syn_cols  # union: every column that appears in either file

    schema_rows: list[SchemaComparisonRow] = []
    issues: list[ValidationIssue] = []

    for col in sorted(all_cols):  # sorted so the table always appears in alphabetical order
        in_real = col in real_cols
        in_syn  = col in syn_cols

        real_type = infer_type(real_df[col], col) if in_real else DataTypeLabel.unknown
        syn_type  = infer_type(syn_df[col],  col) if in_syn  else DataTypeLabel.unknown

        # isnull().mean() gives the fraction of missing values (0.0 to 1.0); multiply by 100 for %.
        real_missing = round(real_df[col].isnull().mean() * 100, 2) if in_real else 0.0
        syn_missing  = round(syn_df[col].isnull().mean() * 100, 2)  if in_syn  else 0.0

        # Determine the schema status for this column.
        if not in_syn:
            status = SchemaStatus.missing_in_synthetic
            issues.append(ValidationIssue(level="warning", code="MISSING_IN_SYNTHETIC",
                          message=f"Column '{col}' exists in real data but not in synthetic."))
        elif not in_real:
            status = SchemaStatus.missing_in_real
            issues.append(ValidationIssue(level="warning", code="MISSING_IN_REAL",
                          message=f"Column '{col}' exists in synthetic data but not in real."))
        elif real_type != syn_type:
            status = SchemaStatus.type_mismatch
            issues.append(ValidationIssue(level="warning", code="TYPE_MISMATCH",
                          message=f"Column '{col}' type differs: real={real_type.value}, synthetic={syn_type.value}."))
        else:
            status = SchemaStatus.matched

        # Flag columns with high missingness as a separate issue.
        if real_missing > 20:
            issues.append(ValidationIssue(level="warning", code="HIGH_MISSINGNESS",
                          message=f"Column '{col}' has {real_missing:.1f}% missing values in real data."))

        schema_rows.append(SchemaComparisonRow(
            id=f"col-{col}",
            columnName=col,
            realType=real_type,
            syntheticType=syn_type,
            realMissingRate=real_missing,
            syntheticMissingRate=syn_missing,
            status=status,
        ))

    matched_cols = [c for c in all_cols if c in real_cols and c in syn_cols]
    unmatched    = len(all_cols) - len(matched_cols)

    # Warn if the two files have very different numbers of rows.
    if abs(len(real_df) - len(syn_df)) / max(len(real_df), 1) > 0.1:
        issues.append(ValidationIssue(level="info", code="ROW_COUNT_DIFF",
                      message=f"Row counts differ: real={len(real_df)}, synthetic={len(syn_df)}."))

    # availableColumns is used by the Setup page to build the column selector.
    # Only matched columns (present in both files) are offered for analysis.
    # KNOWN_ID_COLS are excluded — they are identifiers, not analytical variables.
    available = [
        AvailableColumn(columnName=col, dataType=infer_type(real_df[col], col))
        for col in sorted(matched_cols)
        if col not in KNOWN_ID_COLS
    ]

    # canProceed = True if there are no "error"-level issues.
    # Warnings are shown but do not block the user from continuing.
    can_proceed = not any(i.level == "error" for i in issues)

    return ValidationSummary(
        realDataset=real_summary,
        syntheticDataset=syn_summary,
        matchedColumnCount=len(matched_cols),
        unmatchedColumnCount=unmatched,
        schemaComparison=schema_rows,
        availableColumns=available,
        issues=issues,
        canProceed=can_proceed,
    )


# ── POST /evaluations/run ────────────────────────────────────

@app.post("/evaluations/run", response_model=EvaluationResult)
def run_evaluation(req: RunEvaluationRequest):
    """
    The main calculation endpoint.
    Loads both CSV files, runs the selected metrics on the selected columns,
    and builds the complete dashboard-ready result.

    Processing order (from playbook section 8):
      1. Load files and keep only selected columns
      2. Handle missing values
      3. Infer column types
      4. Run metrics column by column (raw value + normalized score)
      5. Compute correlation difference across all numerical columns
      6. Build metric matrix cells (the heatmap data)
      7. Build variable ranking (sorted by importance score)
      8. Build detail views (chart data for each variable)
      9. Build summary cards (overall, numerical, categorical, relationship scores)
    """
    real_path = uploaded_files.get(req.realDatasetId)
    syn_path  = uploaded_files.get(req.syntheticDatasetId)

    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    config  = req.config
    # na_values=['?'] converts the dataset's '?' placeholder to NaN automatically.
    # This dataset uses '?' to represent missing values instead of leaving cells blank.
    # Without this, '?' would be treated as a real category value and distort all metrics.
    real_df = pd.read_csv(real_path, na_values=["?"])
    syn_df  = pd.read_csv(syn_path,  na_values=["?"])

    # Keep only the columns the user selected, and only if they exist in both files.
    # A column might be selected but missing from one file due to a schema mismatch.
    selected = [c for c in config.selectedColumns if c in real_df.columns and c in syn_df.columns]
    if not selected:
        raise HTTPException(status_code=400, detail="No valid shared columns selected.")

    # Slice both DataFrames down to just the selected columns.
    real_df = real_df[selected]
    syn_df  = syn_df[selected]

    # ── Missing value handling ────────────────────────────────
    # "ignore": keep NaN values as-is; each metric handles them individually with dropna().
    # "drop":   remove any row that has at least one NaN in any selected column.
    # "simple_impute": fill numbers with median, text/categories with the most common value (mode).
    if config.missingValueHandling == "drop":
        real_df = real_df.dropna()
        syn_df  = syn_df.dropna()
    elif config.missingValueHandling == "simple_impute":
        for col in selected:
            if pd.api.types.is_numeric_dtype(real_df[col]):
                real_df[col] = real_df[col].fillna(real_df[col].median())
                syn_df[col]  = syn_df[col].fillna(syn_df[col].median())
            else:
                # mode() returns a Series of the most frequent values; [0] gets the top one.
                # We check .empty first because mode() returns empty if the column has no values.
                real_df[col] = real_df[col].fillna(real_df[col].mode().iloc[0] if not real_df[col].mode().empty else "unknown")
                syn_df[col]  = syn_df[col].fillna(syn_df[col].mode().iloc[0] if not syn_df[col].mode().empty else "unknown")

    # Infer the data type for every selected column.
    # If the user provided a type override for a column (from the frontend type review step),
    # use that instead of the automatic inference.
    overrides = config.columnTypeOverrides or {}
    col_types: dict[str, DataTypeLabel] = {}
    for col in selected:
        if col in overrides:
            try:
                col_types[col] = DataTypeLabel(overrides[col])
            except ValueError:
                # Invalid override value — fall back to automatic inference
                col_types[col] = infer_type(real_df[col], col)
        else:
            col_types[col] = infer_type(real_df[col], col)

    # Split columns by type — needed for correlation_difference which only works on numerical columns.
    numerical_cols   = [c for c in selected if col_types[c] == DataTypeLabel.numerical]
    categorical_cols = [c for c in selected if col_types[c] == DataTypeLabel.categorical]

    # ── Per-column, per-metric results ────────────────────────
    # raw_results[col][metric] = (raw_value, normalized_score)
    # We use a nested dict so we can look up any column's result for any metric easily.
    raw_results: dict[str, dict[EvaluationMetric, tuple[float, float]]] = {col: {} for col in selected}

    for col in selected:
        for metric in config.selectedMetrics:
            result = compute_metric(metric, real_df[col], syn_df[col], col_types[col])
            # result is None when the metric does not apply to this column type.
            # e.g. chi_square does not apply to a numerical column → skip it.
            if result is not None:
                raw_results[col][metric] = result

    # ── Correlation difference (multivariate, handled separately) ──
    # correlation_difference needs all numerical columns at once, not one at a time.
    if EvaluationMetric.correlation_difference in config.selectedMetrics and len(numerical_cols) >= 2:
        corr_results = compute_correlation_difference(real_df, syn_df, numerical_cols)
        for col, result in corr_results.items():
            raw_results[col][EvaluationMetric.correlation_difference] = result

    # ── Metric matrix (the heatmap) ───────────────────────────
    # Each cell = one (variable, metric) pair with its normalized score.
    # The matrix is "sparse" — we only create cells for pairs where the metric actually applies.
    cells: list[MetricMatrixCell] = []
    for col in selected:
        for metric, (_, score) in raw_results[col].items():
            cells.append(MetricMatrixCell(variable=col, metric=metric, normalizedScore=round(score, 4)))

    # ── Variable ranking ──────────────────────────────────────
    ranking: list[VariableRankingItem] = []
    for col in selected:
        scores = [score for _, score in raw_results[col].values()]
        if not scores:
            continue  # skip columns where no metric applied (e.g. a text column)

        # similarityScore = average of all metric scores for this column.
        sim_score = round(statistics.mean(scores), 4)

        # topContributingMetric = the metric with the LOWEST score for this variable.
        # The lowest score means the biggest gap between real and synthetic — most problematic.
        top_metric = min(raw_results[col], key=lambda m: raw_results[col][m][1])

        # Status thresholds from the playbook: ≥0.80 = good, 0.65-0.79 = moderate, <0.65 = poor.
        status = "good" if sim_score >= 0.80 else ("moderate" if sim_score >= 0.65 else "poor")

        # Compute importance score using the helper function.
        real_col     = real_df[col]
        missing_rate = float(real_col.isnull().mean())
        importance   = compute_importance(col, missing_rate, real_col.dropna(), col_types[col])

        ranking.append(VariableRankingItem(
            variable=col,
            # Use "numerical" as fallback for non-categorical types (datetime, text, unknown).
            type=col_types[col].value if col_types[col] in (DataTypeLabel.numerical, DataTypeLabel.categorical) else "numerical",
            importanceScore=importance,
            similarityScore=sim_score,
            status=status,
            topContributingMetric=top_metric,
        ))

    # Sort by importanceScore descending so the most clinically important variables appear first.
    ranking.sort(key=lambda x: x.importanceScore, reverse=True)

    # ── Detail views (per-variable chart data) ────────────────
    detail_views: dict[str, VariableDetailView] = {}
    for col in selected:
        col_type   = col_types[col]
        chart_type = "grouped_bar" if col_type == DataTypeLabel.categorical else "histogram_kde"
        series     = build_detail_series(real_df[col], syn_df[col], col_type)

        metrics_list: list[DetailViewMetric] = [
            DetailViewMetric(
                name=metric,
                value=round(raw, 6),
                normalizedScore=round(score, 4),
            )
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

    # ── Summary cards ─────────────────────────────────────────
    # Flatten all normalized scores into one list to compute the overall average.
    all_scores = [score for col in selected for _, score in raw_results[col].values()]
    overall    = round(statistics.mean(all_scores), 4) if all_scores else 0.0

    # Group metrics by category so we can show separate scores for numerical, categorical, relationship.
    num_metrics  = {EvaluationMetric.mean_difference, EvaluationMetric.ks_test, EvaluationMetric.wasserstein_distance}
    cat_metrics  = {EvaluationMetric.chi_square, EvaluationMetric.category_proportion_difference}
    corr_metrics = {EvaluationMetric.correlation_difference}

    # Inner function that filters scores to only those from a specific set of metrics.
    # Returns None (not 0) if none of those metrics were used — the UI shows "N/A" for None.
    def avg_scores_for(metric_set: set[EvaluationMetric]) -> float | None:
        scores = [
            score
            for col in selected
            for m, (_, score) in raw_results[col].items()
            if m in metric_set
        ]
        return round(statistics.mean(scores), 4) if scores else None

    summary = EvaluationSummary(
        overallSimilarityScore=overall,
        numericalSimilarityScore=avg_scores_for(num_metrics),
        categoricalSimilarityScore=avg_scores_for(cat_metrics),
        relationshipSimilarityScore=avg_scores_for(corr_metrics),
        variablesAnalyzed=len(ranking),
        metricsUsed=len(config.selectedMetrics),
    )

    # ── Analysis context ──────────────────────────────────────
    # Records exactly what the user chose, so the dashboard can display it as a reminder.
    analysis_context = AnalysisContext(
        realDatasetName=real_path.name,
        syntheticDatasetName=syn_path.name,
        selectedVariables=selected,
        selectedMetrics=config.selectedMetrics,
    )

    # Build auto-generated reminder sentences shown at the top of the Results page.
    active_metrics = list({m for col in selected for m in raw_results[col]})
    reminders = [
        f"{len(selected)} variables analysed using {len(active_metrics)} metric(s).",
        f"Overall similarity: {overall:.0%}. Variables below 0.65 are marked as poor.",
        "Scores are normalized: 1 = identical distributions, 0 = completely different.",
    ]
    poor_vars = [r.variable for r in ranking if r.status == "poor"]
    if poor_vars:
        reminders.append(f"Poor similarity detected in: {', '.join(poor_vars[:5])}.")

    # High-level insight sentence based on the overall score.
    insights: list[str] = []
    if overall >= 0.85:
        insights.append("Overall similarity is high — synthetic data closely matches the real distribution.")
    elif overall >= 0.70:
        insights.append("Moderate overall similarity. Review variables marked as poor for targeted improvement.")
    else:
        insights.append("Low overall similarity. Significant differences between real and synthetic distributions were detected.")

    multivariate_results = compute_multivariate_results(
        real_df, syn_df, numerical_cols, categorical_cols
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


# ── POST /comparisons/save ───────────────────────────────────

@app.post("/comparisons/save", response_model=SavedComparison)
def save_comparison(req: SaveComparisonRequest):
    """
    Save a lightweight summary of a completed evaluation run.
    The frontend sends the full EvaluationResult; we extract only what is needed for the list view.
    Storing only a summary keeps the list response small and fast.
    """
    now    = datetime.now(timezone.utc)
    result = req.evaluationResult

    new_record = SavedComparison(
        # Use Unix timestamp (seconds since 1970) as a simple unique ID.
        id=f"run-{now.timestamp():.0f}",
        runName=f"Evaluation - {req.syntheticDatasetName}",
        createdAt=now.isoformat(),
        # strftime formats the date as "8 Apr 2026" for the display label.
        # %-d (no leading zero on Linux/Mac) — on Windows this may fall back to isoformat.
        createdAtLabel=now.strftime("%-d %b %Y") if hasattr(now, "strftime") else now.isoformat()[:10],
        realDatasetName=req.realDatasetName,
        syntheticDatasetName=req.syntheticDatasetName,
        overallSimilarityScore=result.summary.overallSimilarityScore,
        metricsUsed=req.metricsUsed,
        status="completed",
    )

    # insert(0, ...) adds the new record at the front of the list so newest appears first.
    saved_comparisons.insert(0, new_record)
    return new_record


# ── GET /comparisons ─────────────────────────────────────────

@app.get("/comparisons", response_model=list[SavedComparison])
def get_comparisons():
    # Return the full in-memory list. Newest runs appear first because we use insert(0, ...) above.
    return saved_comparisons
