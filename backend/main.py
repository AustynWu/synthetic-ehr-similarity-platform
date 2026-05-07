# main.py — FastAPI backend for the EHR Similarity Platform
#
# This file is the single backend server.
# It is organised into five modules that mirror the five frontend pages:
#
#   Module 1 — Upload Dataset     POST /datasets/upload
#   Module 2 — Validation         POST /datasets/validate
#   Module 3 — Setup              (constants used by Module 4)
#   Module 4 — Result Dashboard   POST /evaluations/run
#   Module 5 — Save Compare       POST /comparisons/save  |  GET /comparisons
#
# When the frontend sends a request, FastAPI routes it to the matching function,
# runs the logic, and returns a JSON response.


# ── Standard library imports ──────────────────────────────────
import uuid          # generates random unique IDs (e.g. "real-a1b2c3d4")
import math          # used for Cramér's V square root calculation
import statistics    # provides statistics.mean() — cleaner than sum()/len()
import io            # wraps bytes as a file-like object so pandas can read them directly
from itertools import combinations  # generates all unique pairs from a list
from datetime import datetime, timezone  # for ISO 8601 timestamps
from pathlib import Path  # cross-platform file path handling

# ── Third-party imports ───────────────────────────────────────
import pandas as pd  # reads CSV files into DataFrames

from scipy.stats import ks_2samp, chi2_contingency, wasserstein_distance as scipy_wasserstein
# ks_2samp         — Kolmogorov-Smirnov test: compares two numerical distributions
# chi2_contingency — Chi-square test: compares two categorical distributions
# scipy_wasserstein — Wasserstein distance: measures distribution shift

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# CORSMiddleware: lets the frontend (localhost:5173) call this backend (localhost:8000)

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


# ── App setup ─────────────────────────────────────────────────

app = FastAPI(title="Synthetic vs Real EHR Similarity API")

# Allow the Vite dev server (port 5173) to call this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────

@app.get("/health")
def health():
    # A simple endpoint. The frontend calls this to confirm the backend is running.
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════
# Module 1 — Upload Dataset
#
# Frontend page : UploadPage.tsx
# API endpoint  : POST /datasets/upload
#
# The user selects two CSV files (real + synthetic).
# This module saves them to disk and returns unique IDs.
# All later modules use these IDs to reload the files.
# ══════════════════════════════════════════════════════════════

# Folder where uploaded CSV files are saved on disk.
# __file__ is the absolute path of main.py itself.
# Using .parent / "uploads" means the folder is always next to main.py,
# regardless of which directory uvicorn is started from.
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)  # create the folder if it does not already exist

# Maps dataset ID (e.g. "real-a1b2c3d4") to its file path on disk.
# Used by Modules 2 and 4 to reload the CSV without asking the user to upload again.
# Note: data is lost if the server restarts (acceptable for a prototype).
uploaded_files: dict[str, Path] = {}

# Maps dataset ID to the original filename the user uploaded (e.g. "diabetic_data.csv").
# Stored separately because uploaded_files only holds the storage path (real-a1b2c3d4.csv).
uploaded_file_names: dict[str, str] = {}


def _require_csv(file: UploadFile, field: str) -> None:
    # Reject non-CSV files before saving anything to disk.
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' must be a CSV file. Received: {file.filename!r}",
        )


def _validate_csv_content(contents: bytes, field: str) -> None:
    # Read up to 10 rows to check format and minimum row count in one pass.
    # nrows=10: if the file has fewer than 10 data rows, len(df) will be < 10.
    try:
        df = pd.read_csv(io.BytesIO(contents), nrows=10, na_values=_NULL_VALUES)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' could not be parsed as CSV: {e}",
        )
    if len(df) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has no data rows. Please upload a file with at least one row of data.",
        )
    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has only {len(df.columns)} column(s). A valid dataset needs at least 2 columns.",
        )
    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has only {len(df)} data row(s). At least 10 rows are needed for statistical analysis.",
        )


@app.post("/datasets/upload", response_model=UploadedDatasets)
async def upload_datasets(
    real_file: UploadFile = File(...),
    synthetic_file: UploadFile = File(...),
):
    """
    Receive two CSV files from the frontend and save them to disk.
    Returns unique IDs and metadata so the frontend can reference them in later calls.

    Why async?
      Reading a file from the network is I/O-bound. async/await lets the server handle
      other requests while waiting, instead of blocking the entire process.

    Why File(...)?
      The ... (Ellipsis) means this parameter is required — the request is rejected
      if the frontend does not include the file field.
    """
    _require_csv(real_file, "real_file")
    _require_csv(synthetic_file, "synthetic_file")

    now = datetime.now(timezone.utc).isoformat()

    # uuid4().hex[:8] gives short IDs like "real-a1b2c3d4" — readable but unique enough.
    real_id = f"real-{uuid.uuid4().hex[:8]}"
    syn_id  = f"syn-{uuid.uuid4().hex[:8]}"

    real_contents = await real_file.read()
    syn_contents  = await synthetic_file.read()

    # Validate that both files are actually parseable CSV with at least one data row.
    _validate_csv_content(real_contents, "real_file")
    _validate_csv_content(syn_contents,  "synthetic_file")

    real_path = UPLOAD_DIR / f"{real_id}.csv"
    syn_path  = UPLOAD_DIR / f"{syn_id}.csv"
    real_path.write_bytes(real_contents)
    syn_path.write_bytes(syn_contents)

    uploaded_files[real_id] = real_path
    uploaded_files[syn_id]  = syn_path

    uploaded_file_names[real_id] = real_file.filename or "real.csv"
    uploaded_file_names[syn_id]  = synthetic_file.filename or "synthetic.csv"

    return UploadedDatasets(
        realDataset=DatasetFile(
            id=real_id,
            role=DatasetRole.real,
            fileName=real_file.filename or "real.csv",
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


# ══════════════════════════════════════════════════════════════
# Module 2 — Validation
#
# Frontend page : ValidationPage.tsx
# API endpoint  : POST /datasets/validate
#
# Loads both uploaded CSV files and checks whether they are
# compatible for analysis:
#   - Column presence (which columns are in both files)
#   - Column type alignment (numerical vs categorical)
#   - Missing value rates
#   - Row count difference
#
# Does NOT calculate similarity scores yet.
# Returns a canProceed flag so the frontend can decide whether to proceed.
# ══════════════════════════════════════════════════════════════

# Columns that look like integers but are actually lookup codes, not magnitudes.
# Example: discharge_disposition_id=1 means "discharged home", not a value of 1.
# We force these to categorical so chi-square is used instead of the KS test.
KNOWN_CATEGORICAL_INT_COLS: set[str] = {
    "discharge_disposition_id",
    "admission_source_id",
    "admission_type_id",
}

# Columns that are unique identifiers — comparing them between datasets is meaningless.
# encounter_id  : every row has a different value (100% unique).
# patient_nbr   : synthetic dataset uses fake IDs starting at 9,000,000,000.
KNOWN_ID_COLS: set[str] = {
    "encounter_id",
    "patient_nbr",
}

# All string values that represent missing data in this dataset.
# Checked against both real (diabetic_data.csv) and synthetic (V1_syn.csv):
#   "?"    — main missing marker used across race, weight, payer_code, medical_specialty
#   "None" — used in real data for max_glu_serum and A1Cresult (test not taken)
#   ""     — used in synthetic data for the same columns instead of "None"
# Standard variants (null, NA, NaN, etc.) are included defensively.
_NULL_VALUES: list[str] = ["?", "None", "none", "null", "NULL", "N/A", "n/a", "NA", "nan", "NaN", ""]


def infer_type(series: pd.Series, col_name: str = "") -> DataTypeLabel:
    """
    Look at a column's data and decide whether it is numerical, categorical, text, or datetime.
    The CSV file does not declare types — we have to infer them from the data.

    Rules (applied in order):
    1. Known ID columns                              → unknown (excluded from analysis)
    2. Known integer code columns                    → categorical
    3. datetime64 dtype                              → datetime
    4. Numeric, ≤10 unique values, <2% of rows      → categorical (e.g. num_procedures 0-6)
    5. Numeric otherwise                             → numerical
    6. String with <10% unique values                → categorical
    7. String with many unique values                → text
    8. Anything else                                 → unknown

    Note: pandas 3.x changed string column dtype from `object` to `StringDtype`.
    We check both so the code works on pandas 2.x and 3.x.
    """
    if col_name in KNOWN_ID_COLS:
        return DataTypeLabel.unknown

    if col_name in KNOWN_CATEGORICAL_INT_COLS:
        return DataTypeLabel.categorical

    if pd.api.types.is_datetime64_any_dtype(series):
        return DataTypeLabel.datetime

    if pd.api.types.is_numeric_dtype(series):
        n_unique = series.nunique()
        if n_unique <= 10 and n_unique / max(len(series), 1) < 0.02:
            return DataTypeLabel.categorical
        return DataTypeLabel.numerical

    # pandas 3.x uses StringDtype (dtype.name == 'str'), older pandas uses object dtype.
    is_string_col = (series.dtype == object) or (series.dtype.name == "str")
    if is_string_col:
        if series.nunique() / max(len(series), 1) < 0.1:
            return DataTypeLabel.categorical
        return DataTypeLabel.text

    return DataTypeLabel.unknown


@app.post("/datasets/validate", response_model=ValidationSummary)
def validate_datasets(req: ValidateRequest):
    """
    Load both uploaded CSV files and compare their schemas.
    Returns column-by-column comparison, missing value rates, warnings, and a canProceed flag.
    """
    real_path = uploaded_files.get(req.realDatasetId)
    syn_path  = uploaded_files.get(req.syntheticDatasetId)

    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    # _NULL_VALUES covers all missing-value markers found in both datasets
    # (see the constant definition above for the full list and reasoning).
    real_df = pd.read_csv(real_path, na_values=_NULL_VALUES)
    syn_df  = pd.read_csv(syn_path,  na_values=_NULL_VALUES)

    # Normalise whitespace-only strings (e.g. "  ") to NaN so they are counted as missing.
    # pandas already converts "" to NaN by default; this catches strings that are only spaces.
    real_df = real_df.replace(r'^\s*$', pd.NA, regex=True)
    syn_df  = syn_df.replace(r'^\s*$', pd.NA, regex=True)

    def basic_summary(file_id: str, name: str, df: pd.DataFrame) -> DatasetBasicSummary:
        return DatasetBasicSummary(
            fileId=file_id,
            fileName=name,
            rowCount=len(df),
            columnCount=len(df.columns),
            missingValueCount=int(df.isnull().sum().sum()),
            duplicateRowCount=int(df.duplicated().sum()),
            missingColumnCount=int((df.isnull().any()).sum()),
        )

    real_summary = basic_summary(req.realDatasetId, uploaded_file_names.get(req.realDatasetId, "real.csv"), real_df)
    syn_summary  = basic_summary(req.syntheticDatasetId, uploaded_file_names.get(req.syntheticDatasetId, "synthetic.csv"), syn_df)

    real_cols = set(real_df.columns)
    syn_cols  = set(syn_df.columns)
    all_cols  = real_cols | syn_cols

    schema_rows: list[SchemaComparisonRow] = []
    issues: list[ValidationIssue] = []
    real_type_cache: dict[str, DataTypeLabel] = {}

    for col in sorted(all_cols):
        in_real = col in real_cols
        in_syn  = col in syn_cols

        real_type = infer_type(real_df[col], col) if in_real else DataTypeLabel.unknown
        syn_type  = infer_type(syn_df[col],  col) if in_syn  else DataTypeLabel.unknown
        real_type_cache[col] = real_type

        real_missing = round(real_df[col].isnull().mean() * 100, 2) if in_real else 0.0
        syn_missing  = round(syn_df[col].isnull().mean() * 100, 2)  if in_syn  else 0.0

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

        if real_missing > 20:
            issues.append(ValidationIssue(level="warning", code="HIGH_MISSINGNESS",
                          message=f"Column '{col}' has {real_missing:.1f}% missing values in real data."))
        if syn_missing > 20:
            issues.append(ValidationIssue(level="warning", code="HIGH_MISSINGNESS_SYNTHETIC",
                          message=f"Column '{col}' has {syn_missing:.1f}% missing values in synthetic data."))

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

    if len(matched_cols) == 0:
        issues.append(ValidationIssue(
            level="error",
            code="NO_SHARED_COLUMNS",
            message="No columns are shared between the two datasets. Analysis cannot proceed.",
        ))

    if abs(len(real_df) - len(syn_df)) / max(len(real_df), 1) > 0.1:
        issues.append(ValidationIssue(level="info", code="ROW_COUNT_DIFF",
                      message=f"Row counts differ: real={len(real_df)}, synthetic={len(syn_df)}."))

    # Only matched columns (present in both files) are offered for analysis on the Setup page.
    # ID columns are excluded — they are identifiers, not analytical variables.
    available = [
        AvailableColumn(columnName=col, dataType=real_type_cache[col])
        for col in sorted(matched_cols)
        if col not in KNOWN_ID_COLS
        and real_type_cache[col] in ("numerical", "categorical")
    ]

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


# ══════════════════════════════════════════════════════════════
# Module 3 — Setup
#
# Frontend page : SetupPage.tsx
# API endpoint  : (none — frontend reads metric list from evaluationService.ts)
#
# This module holds the constants that control how Module 4 calculates scores:
#   - Which chi-square columns to skip (too many categories)
#   - How many top multivariate pairs to return
#   - The metric catalogue (definition of each available metric)
# ══════════════════════════════════════════════════════════════

# Columns with more unique categories than this limit are skipped for chi-square.
# diag_1/2/3 have 700+ ICD codes — a 700×2 contingency table produces a huge chi2
# statistic that normalises to near 0, making the score misleading even when
# distributions look similar. category_proportion_difference still runs on them.
CHI_SQUARE_MAX_CATEGORIES = 50

# Number of top pairs returned in each multivariate section.
# Keeps the response size predictable as the number of variables grows.
MULTIVARIATE_TOP_K = 5


# Metric catalogue — mirrors the availableMetrics list in evaluationService.ts.
# The frontend currently hardcodes its own metric list, so this catalogue is defined
# here as a reference. Expose GET /metrics if the list needs to become dynamic later.
METRIC_CATALOGUE: list[MetricDefinition] = [
    MetricDefinition(key=EvaluationMetric.mean_difference,                   label="Mean Difference",                    description="Compares numerical averages for variables such as time_in_hospital and num_medications.",                                                                   appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.ks_test,                           label="KS Test",                            description="Measures numerical distribution similarity for utilisation and count fields.",                                                                           appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.wasserstein_distance,              label="Wasserstein Distance",                description="Estimates distribution gaps for numerical diabetes variables.",                                                                                         appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.chi_square,                        label="Chi-square Test",                    description="Compares categorical distributions such as readmitted, gender, and diabetesMed.",                                                                       appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.category_proportion_difference,    label="Category Proportion Difference",     description="Summarises how close category proportions are between real and synthetic datasets.",                                                                     appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.correlation_difference,            label="Correlation Difference",             description="Represents a simplified relationship-preservation view for later multivariate analysis.",                                                                appliesTo="multivariate"),
    MetricDefinition(key=EvaluationMetric.numerical_categorical_association, label="Numerical–Categorical Association",  description="Compares how a numerical variable's distribution shifts across categories between real and synthetic data.",                                              appliesTo="cross_type"),
]


# ══════════════════════════════════════════════════════════════
# Module 4 — Result Dashboard
#
# Frontend page : ResultsPage.tsx
# API endpoint  : POST /evaluations/run
#
# The main calculation module.
# Loads both CSV files, runs the selected metrics on the selected columns,
# and builds the complete dashboard-ready result.
#
# Processing order (from playbook section 8):
#   1. Load files and keep only selected columns
#   2. Handle missing values (ignore / drop / simple_impute)
#   3. Infer column types (or use user overrides from the Setup page)
#   4. Run per-column metrics (raw value + normalised score)
#   5. Compute correlation difference across all numerical columns
#   6. Build metric matrix cells (the heatmap data)
#   7. Build variable ranking (sorted by importance score)
#   8. Build detail views (chart data for each variable)
#   9. Compute multivariate results (top pairs)
#  10. Build summary cards (overall, numerical, categorical, relationship scores)
# ══════════════════════════════════════════════════════════════

def compute_metric(
    metric: EvaluationMetric,
    real_col: pd.Series,
    syn_col: pd.Series,
    col_type: DataTypeLabel,
) -> tuple[float, float] | None:
    """
    Calculate one metric for one column.
    Returns (raw_value, normalized_score) or None if the metric does not apply to this column type.

    raw_value       : the actual statistical number (e.g. KS statistic = 0.22)
    normalized_score: converted to 0-1 scale where 1 = identical, 0 = completely different
    """
    # dropna() removes missing values before calculating.
    # Most statistical tests cannot handle NaN values.
    r = real_col.dropna()
    s = syn_col.dropna()

    if len(r) == 0 or len(s) == 0:
        return None

    # ── Mean Difference (numerical only) ──────────────────────
    # How it works: compute |mean_real - mean_synthetic| divided by the real std (Cohen's d).
    # Dividing by std makes the gap unit-free so different columns are comparable.
    # Score: exp(-raw) so score=1 when identical, and large gaps produce small but non-zero scores.
    if metric == EvaluationMetric.mean_difference and col_type == DataTypeLabel.numerical:
        std = r.std()
        raw = abs(float(r.mean()) - float(s.mean())) / (std if std > 0 else 1.0)
        return raw, round(math.exp(-raw), 4)

    # ── KS Test (numerical only) ───────────────────────────────
    # How it works: compare the cumulative distribution of real vs synthetic.
    # D = the largest vertical gap between the two CDF curves (0 = identical, 1 = completely different).
    # Score: 1 - D so a smaller gap gives a higher score.
    if metric == EvaluationMetric.ks_test and col_type == DataTypeLabel.numerical:
        stat, _ = ks_2samp(r.values, s.values)
        return float(stat), 1.0 - float(stat)

    # ── Wasserstein Distance (numerical only) ──────────────────
    # How it works: measure how much mass needs to move to turn the real distribution into the synthetic one.
    # Divide by the real column range so the score is proportional (0 to 1) regardless of the column's scale.
    # Returns None for constant columns (range = 0) because distribution comparison is meaningless there.
    if metric == EvaluationMetric.wasserstein_distance and col_type == DataTypeLabel.numerical:
        col_range = float(r.max() - r.min())
        if col_range == 0:
            return None  # constant column — distribution comparison is meaningless
        raw = float(scipy_wasserstein(r.values, s.values))
        return raw, max(0.0, 1.0 - raw / col_range)

    # ── Chi-square Test (categorical only) ────────────────────
    # How it works: compare the frequency counts of each category in real vs synthetic.
    # Raw chi2 is converted to Cramér's V (0–1) so the score is not inflated by large row counts.
    # Score: 1 - V so V=0 (identical proportions) → score=1, V=1 (completely different) → score=0.
    if metric == EvaluationMetric.chi_square and col_type == DataTypeLabel.categorical:
        all_cats = set(r.unique()) | set(s.unique())
        if len(all_cats) > CHI_SQUARE_MAX_CATEGORIES:
            return None  # too many categories — chi2 becomes unreliable
        real_counts = r.value_counts().reindex(all_cats, fill_value=0)
        syn_counts  = s.value_counts().reindex(all_cats, fill_value=0)
        contingency = pd.DataFrame({"real": real_counts, "synthetic": syn_counts})
        stat, _, _, _ = chi2_contingency(contingency.values)
        n = len(r) + len(s)
        k = len(all_cats)
        cramers_v = math.sqrt(float(stat) / (n * max(k - 1, 1)))
        cramers_v = min(cramers_v, 1.0)
        return float(stat), round(1.0 - cramers_v, 4)

    # ── Category Proportion Difference (categorical only) ──────
    # How it works: for each category, compute what % of rows fall into it in real vs synthetic.
    # Raw = average absolute difference across all categories (0 = identical, 1 = completely different).
    # Score: 1 - raw so smaller difference gives a higher score.
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
    # How it works: build the full Pearson correlation matrix for all numerical columns in real and synthetic.
    # For each column, compute the average absolute difference between its correlations with all other columns.
    # This gives a per-column score showing how well that column's relationships with others are preserved.
    # Raw score range: 0 (all correlations identical) to 2 (every correlation flipped from +1 to -1).
    # Score: max(0, 1 - raw/2) so 0 difference → score=1, worst case → score=0.
    if len(numerical_cols) < 2:
        return {}

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



def compute_multivariate_results(
    real_df: pd.DataFrame,
    syn_df: pd.DataFrame,
    numerical_cols: list[str],
    categorical_cols: list[str],
    selected_metrics: list[EvaluationMetric],
) -> MultivariateResults:
    """
    Compute top K pairs for each multivariate analysis type, sorted by largest difference first.
    Returns only MULTIVARIATE_TOP_K pairs per type to keep the response size predictable.
    """

    # ── Numerical–Numerical: Pearson r ────────────────────────
    # How it works: for every pair of numerical columns, compute Pearson r in real and synthetic separately.
    # Record the absolute difference. Sort by largest difference first and return the top K pairs.
    # This shows which pairs of variables lost their linear relationship in the synthetic data.
    corr_pairs: list[CorrelationPair] = []
    if EvaluationMetric.correlation_difference in selected_metrics:
        for col1, col2 in combinations(numerical_cols, 2):
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
    # How it works: for every pair of categorical columns, compute Cramér's V in real and synthetic separately.
    # Cramér's V measures association strength between two categorical variables (0 = no association, 1 = perfect).
    # Record the absolute difference. Sort by largest difference first and return the top K pairs.
    # This shows which categorical variable pairs lost their association in the synthetic data.
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
    if EvaluationMetric.cramers_v_comparison in selected_metrics:
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
    # How it works: for every numerical × categorical column pair, split both datasets by each category value.
    # Within each group (e.g. readmitted=NO), compute the mean of the numerical column in real and synthetic.
    # Record the absolute difference between those means. Sort by largest difference and return the top K rows.
    # This shows which subgroup of patients has the largest numerical gap between real and synthetic.
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
    Build the bar chart data for the variable detail panel on the Results page.

    Categorical columns : one bar per category showing proportion in real vs synthetic.
    Numerical columns   : 10 equal-width histogram bins showing the distribution shape.

    Proportions (0-1) are used instead of raw counts because real and synthetic
    datasets may have different numbers of rows.
    """
    if col_type == DataTypeLabel.categorical:
        all_cats = sorted(set(real_col.dropna().unique()) | set(syn_col.dropna().unique()))
        real_prop = real_col.value_counts(normalize=True)
        syn_prop  = syn_col.value_counts(normalize=True)
        return [
            DetailViewSeries(
                label=str(cat),
                real=round(float(real_prop.get(cat, 0.0)), 4),
                synthetic=round(float(syn_prop.get(cat, 0.0)), 4),
            )
            for cat in all_cats[:20]  # cap at 20 bars — more becomes unreadable in the UI
        ]
    else:
        # Use the real column's range as reference bins so the synthetic column
        # is measured on the same scale.
        col_min = float(real_col.min())
        col_max = float(real_col.max())
        bins = pd.cut(real_col, bins=10, include_lowest=True)
        bin_labels = [str(b) for b in bins.cat.categories]

        real_counts = pd.cut(real_col, bins=bins.cat.categories, include_lowest=True).value_counts(normalize=True, sort=False)

        # .clip() clamps synthetic values to the real column's range so they fit the same bins.
        syn_counts = pd.cut(syn_col.clip(col_min, col_max), bins=bins.cat.categories, include_lowest=True).value_counts(normalize=True, sort=False)

        return [
            DetailViewSeries(
                label=label,
                real=round(float(real_counts.get(cat, 0.0)), 4),
                synthetic=round(float(syn_counts.get(cat, 0.0)), 4),
            )
            for label, cat in zip(bin_labels, bins.cat.categories)
        ]


@app.post("/evaluations/run", response_model=EvaluationResult)
def run_evaluation(req: RunEvaluationRequest):
    """
    The main calculation endpoint.
    Loads both CSV files, runs all selected metrics, and returns the full dashboard result.
    """
    real_path = uploaded_files.get(req.realDatasetId)
    syn_path  = uploaded_files.get(req.syntheticDatasetId)

    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    config  = req.config
    real_df = pd.read_csv(real_path, na_values=_NULL_VALUES)
    syn_df  = pd.read_csv(syn_path,  na_values=_NULL_VALUES)

    # Normalise whitespace-only strings to NaN for consistent missing value handling.
    real_df = real_df.replace(r'^\s*$', pd.NA, regex=True)
    syn_df  = syn_df.replace(r'^\s*$', pd.NA, regex=True)

    # Keep only columns the user selected that exist in both files.
    selected = [c for c in config.selectedColumns if c in real_df.columns and c in syn_df.columns]
    if not selected:
        raise HTTPException(status_code=400, detail="No valid shared columns selected.")

    real_df = real_df[selected]
    syn_df  = syn_df[selected]

    # Snapshot missing rates before any imputation or row-drop so the
    # rates reflect the original data even when missingValueHandling != "ignore".
    real_missing_rates: dict[str, float] = {
        col: round(real_df[col].isna().mean() * 100, 1) for col in selected
    }

    # ── Missing value handling ────────────────────────────────
    # ignore      : keep NaN values as-is; each metric handles them with dropna()
    # drop        : remove any row that has at least one NaN
    # simple_impute: fill numbers with median, categories with mode
    if config.missingValueHandling == "drop":
        real_df = real_df.dropna()
        syn_df  = syn_df.dropna()
    elif config.missingValueHandling == "simple_impute":
        for col in selected:
            if pd.api.types.is_numeric_dtype(real_df[col]):
                real_df[col] = real_df[col].fillna(real_df[col].median())
                syn_df[col]  = syn_df[col].fillna(syn_df[col].median())
            else:
                real_df[col] = real_df[col].fillna(real_df[col].mode().iloc[0] if not real_df[col].mode().empty else "unknown")
                syn_df[col]  = syn_df[col].fillna(syn_df[col].mode().iloc[0] if not syn_df[col].mode().empty else "unknown")

    # ── Column type inference (with user overrides from Setup page) ──
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

    # ── Per-column, per-metric scores ─────────────────────────
    # raw_results[col][metric] = (raw_value, normalized_score)
    raw_results: dict[str, dict[EvaluationMetric, tuple[float, float]]] = {col: {} for col in selected}

    for col in selected:
        for metric in config.selectedMetrics:
            try:
                result = compute_metric(metric, real_df[col], syn_df[col], col_types[col])
                if result is not None:
                    raw_results[col][metric] = result
            except Exception:
                # Skip this metric for this column — empty series after dropna, all-NaN, etc.
                pass

    # ── Correlation difference (needs all numerical columns at once) ──
    if EvaluationMetric.correlation_difference in config.selectedMetrics and len(numerical_cols) >= 2:
        corr_results = compute_correlation_difference(real_df, syn_df, numerical_cols)
        for col, result in corr_results.items():
            raw_results[col][EvaluationMetric.correlation_difference] = result

    # ── Metric matrix (heatmap cells) ─────────────────────────
    cells: list[MetricMatrixCell] = []
    for col in selected:
        for metric, (_, score) in raw_results[col].items():
            cells.append(MetricMatrixCell(variable=col, metric=metric, normalizedScore=round(score, 4)))

    # ── Variable ranking ──────────────────────────────────────
    # correlation_difference is excluded from sim_score: it measures cross-variable
    # relationships, not the column's own distribution — mixing them misleads the ranking.
    # It still appears in raw_results so the metric matrix and detail panel show it.
    CROSS_VARIABLE_METRICS = {EvaluationMetric.correlation_difference}

    ranking: list[VariableRankingItem] = []
    for col in selected:
        univariate_scores = {
            m: result for m, result in raw_results[col].items()
            if m not in CROSS_VARIABLE_METRICS
        }
        if not univariate_scores:
            continue

        scores     = [score for _, score in univariate_scores.values()]
        sim_score  = round(statistics.mean(scores), 4)
        top_metric = min(univariate_scores, key=lambda m: univariate_scores[m][1])
        status     = "good" if sim_score >= 0.80 else ("moderate" if sim_score >= 0.65 else "poor")

        ranking.append(VariableRankingItem(
            variable=col,
            type=col_types[col].value if col_types[col] in (DataTypeLabel.numerical, DataTypeLabel.categorical) else "numerical",
            similarityScore=sim_score,
            status=status,
            topContributingMetric=top_metric,
            realMissingRate=real_missing_rates.get(col, 0.0),
        ))

    ranking.sort(key=lambda x: x.similarityScore)  # lowest similarity first — worst variables surface at the top

    # ── Detail views (chart data for each variable) ────────────
    # Skip columns with no metric results — no point showing a chart with an empty metric table.
    detail_views: dict[str, VariableDetailView] = {}
    for col in selected:
        if not raw_results[col]:
            continue
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
    all_scores = [score for col in selected for _, score in raw_results[col].values()
                  if not math.isnan(score)]
    overall    = round(statistics.mean(all_scores), 4) if all_scores else 0.0

    num_metrics  = {EvaluationMetric.mean_difference, EvaluationMetric.ks_test, EvaluationMetric.wasserstein_distance}
    cat_metrics  = {EvaluationMetric.chi_square, EvaluationMetric.category_proportion_difference}
    corr_metrics = {EvaluationMetric.correlation_difference}

    def avg_scores_for(metric_set: set[EvaluationMetric]) -> float | None:
        scores = [
            score
            for col in selected
            for m, (_, score) in raw_results[col].items()
            if m in metric_set
        ]
        return round(statistics.mean(scores), 4) if scores else None

    active_metrics = list({m for col in selected for m in raw_results[col]})

    summary = EvaluationSummary(
        overallSimilarityScore=overall,
        numericalSimilarityScore=avg_scores_for(num_metrics),
        categoricalSimilarityScore=avg_scores_for(cat_metrics),
        relationshipSimilarityScore=avg_scores_for(corr_metrics),
        variablesAnalyzed=len(ranking),
        variablesSelected=len(selected),
        metricsUsed=len(active_metrics),
    )

    # ── Analysis context ──────────────────────────────────────
    analysis_context = AnalysisContext(
        realDatasetName=uploaded_file_names.get(req.realDatasetId, real_path.name),
        syntheticDatasetName=uploaded_file_names.get(req.syntheticDatasetId, syn_path.name),
        selectedVariables=selected,
        selectedMetrics=config.selectedMetrics,
    )
    reminders = [
        f"{len(selected)} variables analysed using {len(active_metrics)} metric(s).",
        f"Overall similarity: {overall:.0%}. Variables below 0.65 are marked as poor.",
        "Scores are normalized: 1 = identical distributions, 0 = completely different.",
    ]
    poor_vars = [r.variable for r in ranking if r.status == "poor"]
    if poor_vars:
        reminders.append(f"Poor similarity detected in: {', '.join(poor_vars[:5])}.")

    insights: list[str] = []

    # Overall score
    if overall >= 0.85:
        insights.append("Overall similarity is high — synthetic data closely matches the real distribution.")
    elif overall >= 0.70:
        insights.append("Moderate overall similarity. Review variables marked as poor for targeted improvement.")
    else:
        insights.append("Low overall similarity. Significant differences between real and synthetic distributions were detected.")

    # Poor variables
    if poor_vars:
        names = ", ".join(poor_vars[:5])
        suffix = f" (and {len(poor_vars) - 5} more)" if len(poor_vars) > 5 else ""
        insights.append(f"Poor similarity in: {names}{suffix} — prioritise these variables for regeneration.")

    # All variables good
    if ranking and not poor_vars and not any(r.status == "moderate" for r in ranking):
        insights.append("All selected variables show good similarity — no targeted fixes needed.")

    # Numerical vs categorical gap
    num_score = summary.numericalSimilarityScore
    cat_score = summary.categoricalSimilarityScore
    if num_score is not None and cat_score is not None:
        gap = abs(num_score - cat_score)
        if gap >= 0.15:
            lower, higher = ("numerical", "categorical") if num_score < cat_score else ("categorical", "numerical")
            insights.append(
                f"{lower.capitalize()} variables score notably lower than {higher} ({num_score:.2f} vs {cat_score:.2f}) — "
                f"distribution shapes differ more than category proportions."
                if lower == "numerical"
                else
                f"{lower.capitalize()} variables score notably lower than {higher} ({cat_score:.2f} vs {num_score:.2f}) — "
                f"category proportions differ more than distribution shapes."
            )

    # Relationship / correlation
    rel_score = summary.relationshipSimilarityScore
    if rel_score is not None and rel_score < 0.70:
        insights.append(
            f"Correlation structure is degraded (relationship score: {rel_score:.2f}) — "
            "multivariate dependencies in the synthetic data differ from the real dataset."
        )

    # High-missing variables
    high_missing = [r.variable for r in ranking if r.realMissingRate >= 50]
    if high_missing:
        names = ", ".join(high_missing[:3])
        suffix = f" (and {len(high_missing) - 3} more)" if len(high_missing) > 3 else ""
        insights.append(
            f"{names}{suffix} {'has' if len(high_missing) == 1 else 'have'} very high missing rates in the real dataset — "
            "their similarity scores may not be meaningful."
        )

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


# ══════════════════════════════════════════════════════════════
# Module 5 — Save Compare
#
# Frontend page : SavedComparisonsPage.tsx
# API endpoints : POST /comparisons/save
#                 GET  /comparisons
#
# After the user reviews the Results page, they can save a lightweight
# summary of the run. This module stores those summaries in memory
# and returns them so the Saved page can list all past runs.
# ══════════════════════════════════════════════════════════════

# In-memory list of saved run summaries, newest first.
# Lost on server restart — acceptable for a prototype.
saved_comparisons: list[SavedComparison] = []

# Full EvaluationResult keyed by run ID — used by GET /comparisons/{id} for View Run Details.
saved_evaluation_results: dict[str, EvaluationResult] = {}


@app.post("/comparisons/save", response_model=SavedComparison)
def save_comparison(req: SaveComparisonRequest):
    # Save a lightweight summary for the list view, plus the full result for View Run Details.
    now    = datetime.now(timezone.utc)
    result = req.evaluationResult
    run_id = f"run-{uuid.uuid4().hex[:8]}"

    new_record = SavedComparison(
        id=run_id,
        runName=f"Evaluation - {req.syntheticDatasetName}",
        createdAt=now.isoformat(),
        createdAtLabel=f"{now.day} {now.strftime('%b %Y')}",
        realDatasetName=req.realDatasetName,
        syntheticDatasetName=req.syntheticDatasetName,
        overallSimilarityScore=result.summary.overallSimilarityScore,
        metricsUsed=req.metricsUsed,
        status="completed",
    )

    # insert(0, ...) adds the new record at the front so newest appears first.
    saved_comparisons.insert(0, new_record)
    # Store the full result so View Run Details can retrieve it later.
    saved_evaluation_results[run_id] = result
    return new_record


@app.get("/comparisons", response_model=list[SavedComparison])
def get_comparisons():
    # Return all saved runs. Newest first because save_comparison() uses insert(0, ...).
    return saved_comparisons


@app.get("/comparisons/{run_id}", response_model=EvaluationResult)
def get_comparison_detail(run_id: str):
    # Return the full EvaluationResult for one saved run — used by View Run Details.
    result = saved_evaluation_results.get(run_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return result
