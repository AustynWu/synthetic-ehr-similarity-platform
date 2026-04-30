# ============================================================
# schemas.py — Pydantic models matching the frontend contracts
# ============================================================
# These models mirror frontend/src/types/contracts.ts exactly.
# FastAPI uses them for request validation and response serialisation.
#
# Usage:
#   from schemas import EvaluationConfig, EvaluationResult
#
# If a field is optional in TypeScript (value | null), it is
# Optional[type] = None here.
# ============================================================

from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel


# ── Shared enums ─────────────────────────────────────────────

class DatasetRole(str, Enum):
    real = "real"
    synthetic = "synthetic"

class DatasetFileType(str, Enum):
    csv = "csv"
    xlsx = "xlsx"

class DatasetStatus(str, Enum):
    uploaded = "uploaded"
    processing = "processing"
    failed = "failed"
    validated = "validated"

class DataTypeLabel(str, Enum):
    numerical = "numerical"
    categorical = "categorical"
    datetime = "datetime"
    text = "text"
    unknown = "unknown"

class SchemaStatus(str, Enum):
    matched = "matched"
    type_mismatch = "type_mismatch"
    missing_in_synthetic = "missing_in_synthetic"
    missing_in_real = "missing_in_real"

class EvaluationMetric(str, Enum):
    mean_difference = "mean_difference"
    ks_test = "ks_test"
    wasserstein_distance = "wasserstein_distance"
    chi_square = "chi_square"
    correlation_difference = "correlation_difference"
    category_proportion_difference = "category_proportion_difference"
    numerical_categorical_association = "numerical_categorical_association"
    # Planned metrics — accepted by the API but not yet calculated.
    # compute_metric() returns None for these, so they are silently skipped.
    cramers_v_comparison = "cramers_v_comparison"

class MissingValueHandling(str, Enum):
    ignore = "ignore"
    drop = "drop"
    simple_impute = "simple_impute"


# ── Upload / Dataset models ───────────────────────────────────

class DatasetFile(BaseModel):
    id: str
    role: DatasetRole
    fileName: str
    fileType: DatasetFileType
    sizeBytes: int
    uploadedAt: str          # ISO 8601
    status: DatasetStatus

class UploadedDatasets(BaseModel):
    realDataset: Optional[DatasetFile] = None
    syntheticDataset: Optional[DatasetFile] = None


# ── Validation models ─────────────────────────────────────────

class DatasetBasicSummary(BaseModel):
    fileId: str
    fileName: str
    rowCount: int
    columnCount: int
    missingValueCount: int
    duplicateRowCount: int
    missingColumnCount: int

class SchemaComparisonRow(BaseModel):
    id: str
    columnName: str
    realType: DataTypeLabel
    syntheticType: DataTypeLabel
    realMissingRate: float       # 0-100
    syntheticMissingRate: float
    status: SchemaStatus

class ValidationIssue(BaseModel):
    level: str                   # "error" | "warning" | "info"
    code: str                    # e.g. "HIGH_MISSINGNESS"
    message: str

class AvailableColumn(BaseModel):
    columnName: str
    dataType: DataTypeLabel

class ValidationSummary(BaseModel):
    realDataset: DatasetBasicSummary
    syntheticDataset: DatasetBasicSummary
    matchedColumnCount: int
    unmatchedColumnCount: int
    schemaComparison: list[SchemaComparisonRow]
    availableColumns: list[AvailableColumn]  # full column list for Setup page
    issues: list[ValidationIssue]
    canProceed: bool


# ── Evaluation config (frontend → backend) ────────────────────
# This is what the frontend POSTs to trigger a run.

class EvaluationConfig(BaseModel):
    selectedMetrics: list[EvaluationMetric]
    selectedColumns: list[str]
    includeNumerical: bool = True
    includeCategorical: bool = True
    missingValueHandling: MissingValueHandling = MissingValueHandling.ignore
    significanceLevel: float = 0.05
    # User-corrected variable types from the frontend type review step.
    # Key = raw column name, value = "numerical" | "categorical"
    # None or empty dict means use backend infer_type() for all columns.
    columnTypeOverrides: Optional[dict[str, str]] = None


# ── Evaluation result (backend → frontend) ────────────────────

class EvaluationSummary(BaseModel):
    overallSimilarityScore: float
    numericalSimilarityScore: Optional[float] = None    # null if no numerical metric selected
    categoricalSimilarityScore: Optional[float] = None  # null if no categorical metric selected
    relationshipSimilarityScore: Optional[float] = None # null if correlation_difference not selected
    variablesAnalyzed: int
    metricsUsed: int

class AnalysisContext(BaseModel):
    realDatasetName: str
    syntheticDatasetName: str
    selectedVariables: list[str]
    selectedMetrics: list[EvaluationMetric]

class VariableRankingItem(BaseModel):
    variable: str
    type: str                          # "numerical" | "categorical"
    importanceScore: float             # 0-1, clinical relevance weight
    similarityScore: float             # 0-1, how closely real and synthetic match
    status: str                        # "good" | "moderate" | "poor"
    topContributingMetric: EvaluationMetric  # metric with largest gap for this variable

class MetricMatrixCell(BaseModel):
    variable: str
    metric: EvaluationMetric
    normalizedScore: float             # 0-1

class MetricMatrix(BaseModel):
    variables: list[str]
    metrics: list[EvaluationMetric]
    cells: list[MetricMatrixCell]      # sparse — missing cell = metric does not apply

class DetailViewSeries(BaseModel):
    label: str                         # e.g. "NO", ">30", "1-3 days"
    real: float                        # proportion 0-1
    synthetic: float

class DetailViewMetric(BaseModel):
    name: EvaluationMetric
    value: float                       # raw statistic (e.g. KS statistic = 0.21)
    normalizedScore: float             # 0-1 normalised for display

class VariableDetailView(BaseModel):
    chartType: str          # "histogram_kde" | "grouped_bar"
    title: str
    xAxisLabel: str
    yAxisLabel: str
    series: list[DetailViewSeries]
    metrics: list[DetailViewMetric]


# ── Multivariate result models ────────────────────────────────

class CorrelationPair(BaseModel):
    variable1: str
    variable2: str
    realCorrelation: float
    syntheticCorrelation: float
    difference: float           # |real - synthetic|, sorted desc

class CramersVPair(BaseModel):
    variable1: str
    variable2: str
    realCramersV: float
    syntheticCramersV: float
    difference: float           # sorted desc

class GroupwiseSummaryRow(BaseModel):
    numericalVariable: str
    categoricalVariable: str
    groupValue: str             # e.g. "NO", "Female", ">8"
    realMean: float
    syntheticMean: float
    difference: float           # |real - synthetic|, sorted desc

class MultivariateResults(BaseModel):
    topCorrelationPairs: list[CorrelationPair]   # Numerical–Numerical
    topCramersVPairs: list[CramersVPair]         # Categorical–Categorical
    topGroupwiseRows: list[GroupwiseSummaryRow]  # Mixed


class EvaluationResult(BaseModel):
    runId: str
    generatedAt: str                                        # ISO 8601
    summary: EvaluationSummary
    analysisContext: AnalysisContext
    reminders: list[str]                                    # auto-generated sentences
    variableRanking: list[VariableRankingItem]              # sorted by importanceScore desc
    metricMatrix: MetricMatrix
    detailViews: dict[str, VariableDetailView]              # keyed by variable name
    insights: list[str]
    multivariateResults: Optional[MultivariateResults] = None


# ── Saved comparison record ───────────────────────────────────

class SavedComparison(BaseModel):
    id: str
    runName: str
    createdAt: str                     # ISO 8601
    createdAtLabel: str                # human-readable, e.g. "1 Apr 2026"
    realDatasetName: str
    syntheticDatasetName: str
    overallSimilarityScore: float
    metricsUsed: list[EvaluationMetric]
    status: str                        # "completed" | "failed" | "processing"


# ── Metric definition (backend → frontend, optional endpoint) ─
# Currently hardcoded on the frontend. Expose GET /metrics later
# if the list needs to be dynamic.

class MetricDefinition(BaseModel):
    key: EvaluationMetric
    label: str
    description: str
    appliesTo: str   # "numerical" | "categorical" | "multivariate" | "cross_type"


# ── Request models ────────────────────────────────────────────

class ValidateRequest(BaseModel):
    realDatasetId: str
    syntheticDatasetId: str

class RunEvaluationRequest(BaseModel):
    realDatasetId: str
    syntheticDatasetId: str
    config: EvaluationConfig

class SaveComparisonRequest(BaseModel):
    evaluationResult: EvaluationResult
    realDatasetName: str
    syntheticDatasetName: str
    metricsUsed: list[EvaluationMetric]
