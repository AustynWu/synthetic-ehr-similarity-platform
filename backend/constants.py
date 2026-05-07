# constants.py — shared configuration values used across routers and services
#
# Centralising these values here (instead of scattering them across files) means
# a future developer only needs to change one place when tuning thresholds or
# adjusting the dataset-specific column lists.

from pathlib import Path
from schemas import EvaluationMetric, MetricDefinition

# Path(__file__).parent resolves to the backend/ directory at runtime regardless
# of which working directory uvicorn is started from.
# exist_ok=True prevents an error if the folder already exists on restart.
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Strings that pandas should treat as NaN when reading CSV files.
# "?" is common in UCI healthcare datasets (e.g. diabetic_data.csv).
# Empty string "" is included because some exports write cells with no value.
NULL_VALUES: list[str] = ["?", "None", "none", "null", "NULL", "N/A", "n/a", "NA", "nan", "NaN", ""]

# These column names contain integer codes that are lookup table IDs, not numeric magnitudes.
# Without this override, infer_type() would treat them as numerical, which would produce
# meaningless mean/KS scores (e.g. "mean discharge_disposition_id" has no clinical value).
KNOWN_CATEGORICAL_INT_COLS: set[str] = {
    "discharge_disposition_id",
    "admission_source_id",
    "admission_type_id",
}

# Unique identifier columns — one value per patient or encounter.
# Including them in analysis would always give 0% similarity because IDs never match
# between real and synthetic datasets, skewing the overall score downward.
KNOWN_ID_COLS: set[str] = {
    "encounter_id",
    "patient_nbr",
}

# Chi-square becomes unreliable when categories are too sparse (expected cell counts < 5).
# 50 is a conservative ceiling; columns with more unique values are silently skipped.
CHI_SQUARE_MAX_CATEGORIES = 50

# Limits how many pairs are returned in each multivariate section (correlation, Cramér's V,
# group-wise). Returning all pairs for datasets with many columns would flood the UI and
# slow down the JSON response. The top-K are sorted by largest difference first so the most
# problematic pairs always surface.
MULTIVARIATE_TOP_K = 5

# Metric catalogue sent to GET /metrics — mirrors availableMetrics in evaluationService.ts.
# Keeping this list here (not in the router) means the router stays thin and the catalogue
# can be reused if a future endpoint needs to describe metrics to the user.
METRIC_CATALOGUE: list[MetricDefinition] = [
    MetricDefinition(key=EvaluationMetric.mean_difference,                   label="Mean Difference",                   description="Compares numerical averages.",                                             appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.ks_test,                           label="KS Test",                           description="Measures numerical distribution similarity.",                              appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.wasserstein_distance,              label="Wasserstein Distance",               description="Estimates distribution gaps for numerical variables.",                     appliesTo="numerical"),
    MetricDefinition(key=EvaluationMetric.chi_square,                        label="Chi-square Test",                   description="Compares categorical distributions.",                                      appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.category_proportion_difference,    label="Category Proportion Difference",    description="Summarises how close category proportions are.",                           appliesTo="categorical"),
    MetricDefinition(key=EvaluationMetric.correlation_difference,            label="Correlation Difference",            description="Simplified relationship-preservation view for multivariate analysis.",     appliesTo="multivariate"),
    MetricDefinition(key=EvaluationMetric.numerical_categorical_association, label="Numerical–Categorical Association", description="Compares how a numerical variable's distribution shifts across categories.", appliesTo="cross_type"),
]
