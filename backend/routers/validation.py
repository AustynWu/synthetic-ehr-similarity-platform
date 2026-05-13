# routers/validation.py — POST /datasets/validate
#
# After upload, the user sees a schema comparison between the two files.
# This endpoint loads both CSVs, compares column names and types, flags issues,
# and returns the list of columns that are safe to use in evaluation.

import pandas as pd
from fastapi import APIRouter, HTTPException

from schemas import (
    DatasetBasicSummary, SchemaComparisonRow, SchemaStatus,
    ValidationIssue, AvailableColumn, ExcludedColumn, ValidationSummary, ValidateRequest, DataTypeLabel,
)
from constants import NULL_VALUES, KNOWN_ID_COLS, GROUP_KEYWORDS, GROUP_EXACT_COLS
from services.type_inference import infer_type
import state

router = APIRouter()


def _exclusion_reason(data_type: DataTypeLabel, col_name: str) -> str:
    """Return a plain English reason why this column was excluded from metric calculation."""
    if data_type == DataTypeLabel.unknown:
        return "Column is a unique identifier or its type could not be determined."
    if data_type == DataTypeLabel.datetime:
        return "Datetime columns are not yet supported in metric calculation."
    if data_type == DataTypeLabel.text:
        return "Free-text columns cannot be compared with statistical metrics."
    return "Column type is not supported for metric calculation."


def _infer_display_group(col_name: str) -> str:
    name = col_name.lower()
    # Exact match first — prevents short keywords from matching unrelated column names.
    if name in GROUP_EXACT_COLS:
        return GROUP_EXACT_COLS[name]
    # Substring match in priority order (Patient → Lab/Test → Medication → Outcome → Clinical).
    for group, keywords in GROUP_KEYWORDS.items():
        if any(k in name for k in keywords):
            return group
    return "Other / Review"


@router.post("/datasets/validate", response_model=ValidationSummary)
def validate_datasets(req: ValidateRequest):
    real_path = state.uploaded_files.get(req.realDatasetId)
    syn_path  = state.uploaded_files.get(req.syntheticDatasetId)

    if not real_path or not syn_path:
        raise HTTPException(status_code=404, detail="Dataset ID not found. Please upload first.")

    real_df = pd.read_csv(real_path, na_values=NULL_VALUES)
    syn_df  = pd.read_csv(syn_path,  na_values=NULL_VALUES)
    # Normalise whitespace-only strings to NaN so missing counts are accurate.
    real_df = real_df.replace(r'^\s*$', pd.NA, regex=True)
    syn_df  = syn_df.replace(r'^\s*$', pd.NA, regex=True)

    def basic_summary(file_id: str, name: str, df: pd.DataFrame) -> DatasetBasicSummary:
        return DatasetBasicSummary(
            fileId=file_id, fileName=name,
            rowCount=len(df), columnCount=len(df.columns),
            missingValueCount=int(df.isnull().sum().sum()),
            duplicateRowCount=int(df.duplicated().sum()),
            # missingColumnCount = number of columns that have at least one NaN.
            missingColumnCount=int((df.isnull().any()).sum()),
        )

    real_summary = basic_summary(req.realDatasetId, state.uploaded_file_names.get(req.realDatasetId, "real.csv"), real_df)
    syn_summary  = basic_summary(req.syntheticDatasetId, state.uploaded_file_names.get(req.syntheticDatasetId, "synthetic.csv"), syn_df)

    real_cols = set(real_df.columns)
    syn_cols  = set(syn_df.columns)
    all_cols  = real_cols | syn_cols  # union — every column that appears in either file

    schema_rows: list[SchemaComparisonRow] = []
    issues: list[ValidationIssue] = []
    real_type_cache: dict[str, DataTypeLabel] = {}  # reused later to build availableColumns

    for col in sorted(all_cols):
        in_real = col in real_cols
        in_syn  = col in syn_cols

        # infer_type() uses the real column as reference; synthetic type is compared against it.
        real_type = infer_type(real_df[col], col) if in_real else DataTypeLabel.unknown
        syn_type  = infer_type(syn_df[col],  col) if in_syn  else DataTypeLabel.unknown
        real_type_cache[col] = real_type

        real_missing = round(real_df[col].isnull().mean() * 100, 2) if in_real else 0.0
        syn_missing  = round(syn_df[col].isnull().mean() * 100, 2)  if in_syn  else 0.0

        # Determine schema status and attach an actionable message for each problem found.
        if not in_syn:
            status = SchemaStatus.missing_in_synthetic
            issues.append(ValidationIssue(level="warning", code="MISSING_IN_SYNTHETIC",
                          message=f"Column '{col}' exists in real data but not in synthetic — it will be excluded from evaluation."))
        elif not in_real:
            status = SchemaStatus.missing_in_real
            issues.append(ValidationIssue(level="warning", code="MISSING_IN_REAL",
                          message=f"Column '{col}' exists in synthetic data but not in real — it will be excluded from evaluation."))
        elif real_type != syn_type:
            status = SchemaStatus.type_mismatch
            issues.append(ValidationIssue(level="warning", code="TYPE_MISMATCH",
                          message=f"Column '{col}' has a type mismatch (real: {real_type.value}, synthetic: {syn_type.value}) — metric results for this column may be unreliable."))
        else:
            status = SchemaStatus.matched

        # High missingness reduces statistical reliability — warn the user so they can interpret results carefully.
        if real_missing > 20:
            issues.append(ValidationIssue(level="warning", code="HIGH_MISSINGNESS",
                          message=f"Column '{col}' has {real_missing:.1f}% missing values in real data — similarity results for this column should be interpreted carefully."))
        if syn_missing > 20:
            issues.append(ValidationIssue(level="warning", code="HIGH_MISSINGNESS_SYNTHETIC",
                          message=f"Column '{col}' has {syn_missing:.1f}% missing values in synthetic data — similarity results for this column should be interpreted carefully."))

        schema_rows.append(SchemaComparisonRow(
            id=f"col-{col}", columnName=col,
            realType=real_type, syntheticType=syn_type,
            realMissingRate=real_missing, syntheticMissingRate=syn_missing,
            status=status,
        ))

    matched_cols = list(real_cols & syn_cols)  # columns present in both files
    unmatched    = len(all_cols) - len(matched_cols)

    if len(matched_cols) == 0:
        # Error-level issue blocks the user from proceeding — canProceed will be False.
        issues.append(ValidationIssue(level="error", code="NO_SHARED_COLUMNS",
                      message="No columns are shared between the two datasets. Analysis cannot proceed."))

    # Info-level (not warning) because different row counts are expected for synthetic data.
    # 10% tolerance avoids noise for minor differences.
    if abs(len(real_df) - len(syn_df)) / max(len(real_df), 1) > 0.1:
        issues.append(ValidationIssue(level="info", code="ROW_COUNT_DIFF",
                      message=f"Row counts differ: real={len(real_df)}, synthetic={len(syn_df)}."))

    # availableColumns: only shared columns whose type is numerical or categorical.
    # ID columns are excluded because they have no analytical value.
    # text/datetime/unknown columns are excluded because no current metric handles them.
    available = [
        AvailableColumn(columnName=col, dataType=real_type_cache[col],
                        displayGroup=_infer_display_group(col))
        for col in sorted(matched_cols)
        if col not in KNOWN_ID_COLS
        and real_type_cache[col] in (DataTypeLabel.numerical, DataTypeLabel.categorical)
    ]

    # excludedColumns: shared columns that were filtered out of availableColumns.
    # Sent to the frontend so users can see why a column is missing from the selection list.
    excluded = [
        ExcludedColumn(
            columnName=col,
            dataType=real_type_cache[col],
            reason=_exclusion_reason(real_type_cache[col], col),
        )
        for col in sorted(matched_cols)
        if col not in KNOWN_ID_COLS
        and real_type_cache[col] not in (DataTypeLabel.numerical, DataTypeLabel.categorical)
    ]
    # Also include known ID columns so the frontend can display them as excluded.
    for col in sorted(matched_cols):
        if col in KNOWN_ID_COLS:
            excluded.append(ExcludedColumn(
                columnName=col,
                dataType=DataTypeLabel.unknown,
                reason="Column is a unique identifier and is excluded from analysis.",
            ))

    return ValidationSummary(
        realDataset=real_summary, syntheticDataset=syn_summary,
        matchedColumnCount=len(matched_cols), unmatchedColumnCount=unmatched,
        schemaComparison=schema_rows, availableColumns=available,
        excludedColumns=excluded,
        issues=issues,
        # False only when at least one error-level issue exists; warnings/info still allow proceeding.
        canProceed=not any(issue.level == "error" for issue in issues),
    )
