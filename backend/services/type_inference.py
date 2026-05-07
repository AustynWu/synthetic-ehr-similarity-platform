# services/type_inference.py — column type detection
#
# Used by both validation.py (to build the schema comparison table)
# and evaluation.py (to decide which metrics apply to each column).
# Extracted into a service so both routers share identical detection logic —
# if validation says a column is "categorical", evaluation will agree.

import pandas as pd
from schemas import DataTypeLabel
from constants import KNOWN_ID_COLS, KNOWN_CATEGORICAL_INT_COLS


def infer_type(series: pd.Series, col_name: str = "") -> DataTypeLabel:
    """
    Inspect one column and return its data type label.

    Rules are applied in priority order (first match wins):

    1. Known ID columns (encounter_id, patient_nbr)
       → unknown: IDs have no analytical value and should be excluded entirely.

    2. Known integer-code columns (discharge_disposition_id etc.)
       → categorical: these are lookup codes, not numeric magnitudes.
         Without this rule, pandas sees them as int64 and infer_type would
         call them "numerical", producing meaningless mean/KS scores.

    3. datetime64 dtype
       → datetime: reserved for future date-range analysis.

    4. Numeric with ≤10 unique values AND those values are <2% of total rows
       → categorical: catches small ordinal scales like num_procedures (0–6).
         The 2% threshold prevents a truly numerical column with few distinct
         values in a small dataset from being misclassified.

    5. Numeric otherwise
       → numerical: standard continuous or large-range integer column.

    6. String/object with <10% unique values relative to row count
       → categorical: most string columns in EHR data are codes or labels
         (gender, race, diagnosis codes) with limited distinct values.

    7. String/object with many unique values
       → text: free-text fields; excluded from metric analysis.

    8. Anything else (bool, complex, etc.)
       → unknown: treated as unusable by the metrics layer.
    """
    if col_name in KNOWN_ID_COLS:
        return DataTypeLabel.unknown

    if col_name in KNOWN_CATEGORICAL_INT_COLS:
        return DataTypeLabel.categorical

    if pd.api.types.is_datetime64_any_dtype(series):
        return DataTypeLabel.datetime

    if pd.api.types.is_numeric_dtype(series):
        n_unique = series.nunique()
        # Both conditions must hold: small cardinality AND low ratio.
        # The ratio guard prevents misclassifying a column like "age" that
        # happens to have only 8 distinct values in a 50-row test file.
        if n_unique <= 10 and n_unique / max(len(series), 1) < 0.02:
            return DataTypeLabel.categorical
        return DataTypeLabel.numerical

    # pandas 3.x uses StringDtype; older versions use object dtype for strings.
    is_string_col = (series.dtype == object) or (series.dtype.name == "str")
    if is_string_col:
        # 10% threshold: a column where 1 in 10 rows has a unique value is
        # almost certainly a free-text field, not a code list.
        if series.nunique() / max(len(series), 1) < 0.1:
            return DataTypeLabel.categorical
        return DataTypeLabel.text

    return DataTypeLabel.unknown
