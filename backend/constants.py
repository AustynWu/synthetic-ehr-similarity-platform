# constants.py — shared configuration values used across routers and services
#
# Centralising these values here (instead of scattering them across files) means
# a future developer only needs to change one place when tuning thresholds or
# adjusting the dataset-specific column lists.

from pathlib import Path

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

# Maximum number of categorical variables included in the Cramér's V heatmap.
# Variables are chosen by "activity score" (how often they appear in high-difference
# pairs) rather than alphabetically — so the heatmap always shows the associations
# that diverged most between real and synthetic data.
MAX_CRAMERS_HEATMAP_VARS = 15

# Maximum number of numerical variables included in the Pearson correlation heatmap.
# Variables are chosen by activity score (same logic as Cramér's V) so the heatmap
# always highlights the numerical relationships that diverged most.
MAX_CORR_HEATMAP_VARS = 12
