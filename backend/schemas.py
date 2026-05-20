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
    displayGroup: str = "Other / Review"

# Columns that exist in both datasets but cannot be used in metric calculation.
# Sent to the frontend so the UI can show users why a column was excluded.
class ExcludedColumn(BaseModel):
    columnName: str
    dataType: DataTypeLabel   # datetime / text / unknown
    reason: str               # plain English explanation shown in the UI

class ValidationSummary(BaseModel):
    realDataset: DatasetBasicSummary
    syntheticDataset: DatasetBasicSummary
    matchedColumnCount: int
    unmatchedColumnCount: int
    schemaComparison: list[SchemaComparisonRow]
    availableColumns: list[AvailableColumn]    # columns available for metric calculation
    excludedColumns: list[ExcludedColumn] = [] # columns present but excluded from analysis
    issues: list[ValidationIssue]
    canProceed: bool


# ── Evaluation config (frontend → backend) ────────────────────
# This is what the frontend POSTs to trigger a run.

class EvaluationConfig(BaseModel):
    selectedMetrics: list[EvaluationMetric]
    selectedColumns: list[str]
    missingValueHandling: MissingValueHandling = MissingValueHandling.ignore
    # User-corrected variable types from the frontend type review step.
    # Key = raw column name, value = "numerical" | "categorical"
    # None or empty dict means use backend infer_type() for all columns.
    columnTypeOverrides: Optional[dict[str, str]] = None


# ── Evaluation result (backend → frontend) ────────────────────

class MetricSummaryItem(BaseModel):
    metric: "EvaluationMetric"
    averageScore: float   # average normalized score across all variables where this metric was computed
    variableCount: int    # number of variables this metric was applied to
    category: str         # "numerical" | "categorical" | "relationship"

class EvaluationSummary(BaseModel):
    overallSimilarityScore: float                         # kept for saved-comparisons history
    numericalSimilarityScore: Optional[float] = None
    categoricalSimilarityScore: Optional[float] = None
    relationshipSimilarityScore: Optional[float] = None
    variablesAnalyzed: int   # variables that produced at least one score
    variablesSelected: int   # variables the user selected on Setup
    metricsUsed: int
    metricSummaries: list[MetricSummaryItem] = []        # per-metric averages — use these instead of the combined scores above

class AnalysisContext(BaseModel):
    realDatasetName: str
    syntheticDatasetName: str
    selectedVariables: list[str]
    selectedMetrics: list[EvaluationMetric]

class VariableRankingItem(BaseModel):
    variable: str
    type: str                          # "numerical" | "categorical"
    similarityScore: float             # 0-1, how closely real and synthetic match
    status: str                        # "good" | "moderate" | "poor"
    topContributingMetric: EvaluationMetric  # metric with largest gap for this variable
    realMissingRate: float = 0.0       # 0-100, missing % in real dataset

class MetricMatrixCell(BaseModel):
    variable: str
    metric: EvaluationMetric
    normalizedScore: float             # 0-1

class MetricMatrix(BaseModel):
    variables: list[str]
    metrics: list[EvaluationMetric]
    cells: list[MetricMatrixCell]      # sparse — missing cell = metric does not apply

class DetailViewSeries(BaseModel):
    label: str                         # category name (categorical) or bin range string (numerical)
    real: float                        # proportion 0-1
    synthetic: float
    binLeft: Optional[float] = None    # numerical bins only — left edge of the bin
    binRight: Optional[float] = None   # numerical bins only — right edge of the bin
    realCount: Optional[int] = None    # actual row count in real data for this bin/category
    syntheticCount: Optional[int] = None  # actual row count in synthetic data

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
    # Full correlation matrices — outer key = variable, inner key = other variable → Pearson r.
    # Optional so old cached results without these fields still deserialise correctly.
    realCorrelationMatrix: Optional[dict[str, dict[str, float]]] = None
    synCorrelationMatrix:  Optional[dict[str, dict[str, float]]] = None
    # Cramér's V matrices — only the top MAX_CRAMERS_HEATMAP_VARS variables are included.
    # Variables are chosen by activity score (how often they appear in high-difference pairs)
    # so the heatmap always highlights the associations that diverged most.
    realCramersVMatrix:   Optional[dict[str, dict[str, float]]] = None
    synCramersVMatrix:    Optional[dict[str, dict[str, float]]] = None
    # Plain-English note explaining which variables were selected and why.
    # Displayed in the UI so the user understands the variable selection logic.
    cramersVHeatmapNote: Optional[str] = None
    # Same note for the Pearson correlation heatmap.
    corrHeatmapNote: Optional[str] = None


class EvaluationResult(BaseModel):
    runId: str
    generatedAt: str                                        # ISO 8601
    summary: EvaluationSummary
    analysisContext: AnalysisContext
    reminders: list[str]                                    # auto-generated sentences
    variableRanking: list[VariableRankingItem]              # sorted by similarityScore asc (worst first)
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
