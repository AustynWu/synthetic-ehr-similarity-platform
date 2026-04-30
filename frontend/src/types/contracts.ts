// contracts.ts — shared type definitions for the entire project
//
// Only type aliases and interfaces — no logic here.
//
// type      — alias for a value, e.g. type Color = "red" | "blue"
// interface — describes the shape of an object (its fields and types)
// ReactNode — anything React can render (text, component, HTML element, etc.)
// |         — union type ("or"), e.g. "a" | "b" means only "a" or "b" is valid
//
// Keeping all types in one file makes them easy to maintain and keeps imports consistent.

import type { ReactNode, MouseEventHandler } from "react";

// ── Page keys ──────────────────────────────────────────────
// The five valid page identifiers. TypeScript will catch typos.
export type PageKey = "upload" | "validation" | "setup" | "results" | "saved";

// ── Dataset types ──────────────────────────────────────────

// Whether the dataset is real patient data or AI-generated synthetic data
export type DatasetRole = "real" | "synthetic";

// Supported file formats
export type DatasetFileType = "csv" | "xlsx";

// Upload and processing lifecycle states
// uploaded   — just received
// processing — being analysed
// failed     — error occurred
// validated  — schema check passed
export type DatasetStatus = "uploaded" | "processing" | "failed" | "validated";

// Column data type labels
export type DataTypeLabel = "numerical" | "categorical" | "datetime" | "text" | "unknown";

// UI colour semantics for badges
// info=blue  success=green  warning=yellow  danger=red
export type StatusTone = "info" | "success" | "warning" | "danger";

// Basic metadata for one uploaded file
export interface DatasetFile {
  id: string;           // unique identifier, e.g. "real-001"
  role: DatasetRole;    // "real" or "synthetic"
  fileName: string;
  fileType: DatasetFileType;
  sizeBytes: number;
  uploadedAt: string;   // ISO 8601 timestamp
  status: DatasetStatus;
}

// A matched pair of datasets (real + synthetic)
export interface UploadedDatasets {
  realDataset: DatasetFile | null;      // null means not yet uploaded
  syntheticDataset: DatasetFile | null;
}

// Basic statistics for one dataset
export interface DatasetBasicSummary {
  fileId: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  missingValueCount: number;
  duplicateRowCount: number;
  missingColumnCount: number; // number of columns that have at least one missing value
}

// ── Validation types ───────────────────────────────────────

// Per-column schema comparison result
// matched              — column exists in both files with the same type (good)
// type_mismatch        — same column name but different types (warning)
// missing_in_synthetic — column exists in real but not synthetic
// missing_in_real      — column exists in synthetic but not real
export type SchemaStatus =
  | "matched"
  | "type_mismatch"
  | "missing_in_synthetic"
  | "missing_in_real";

// One row in the schema comparison table on the Validation page
export interface SchemaComparisonRow {
  id: string;
  columnName: string;
  realType: DataTypeLabel;
  syntheticType: DataTypeLabel;
  realMissingRate: number;      // 0–100
  syntheticMissingRate: number;
  status: SchemaStatus;
}

// A single validation issue (error / warning / info)
export interface ValidationIssue {
  level: "error" | "warning" | "info";
  code: string;    // machine-readable code, e.g. "HIGH_MISSINGNESS"
  message: string; // human-readable explanation
}

// Full validation result shown on the Validation page
export interface ValidationSummary {
  realDataset: DatasetBasicSummary;
  syntheticDataset: DatasetBasicSummary;
  matchedColumnCount: number;
  unmatchedColumnCount: number;
  schemaComparison: SchemaComparisonRow[]; // representative subset — problem columns + a few clean ones
  availableColumns: { columnName: string; dataType: DataTypeLabel }[]; // full column list for Setup page
  issues: ValidationIssue[];
  canProceed: boolean;
}

// ── Evaluation config types ────────────────────────────────

// Top-level analysis group shown in the Setup page
export type MetricGroup = "Univariate" | "Multivariate";

// Sub-section within each group
export type MetricSubgroup =
  | "Numerical"
  | "Categorical"
  | "Numerical–Numerical"
  | "Categorical–Categorical"
  | "Mixed";

// More granular variable type used for chart and metric logic
// continuous_numerical — e.g. age, num_lab_procedures (many unique values)
// discrete_numerical   — e.g. time_in_hospital (small integer range)
// categorical          — e.g. gender, readmitted
// unknown              — type could not be determined
export type VariableType =
  | "continuous_numerical"
  | "discrete_numerical"
  | "categorical"
  | "unknown";

// Chart rendering style chosen based on variable type
export type ChartType =
  | "histogram_kde"       // distribution curve — for continuous numerical
  | "grouped_bar"         // side-by-side bars  — for discrete numerical and categorical
  | "correlation_heatmap" // matrix heat colours — for numerical-numerical multivariate
  | "grouped_boxplot"     // box per group       — for mixed analysis
  | "summary_table";      // plain table         — fallback

// Supported statistical metrics
// ── Implemented (backend ready) ──────────────────────────────────
// mean_difference                  — compare numerical averages
// ks_test                          — compare distribution shape (Kolmogorov-Smirnov)
// wasserstein_distance             — another distribution comparison method
// chi_square                       — compare categorical column distributions
// correlation_difference           — compare multi-variable relationships
// category_proportion_difference   — compare category proportions
// numerical_categorical_association — compare how a numerical variable shifts across category groups
// ── Planned (frontend display only, not yet in backend) ──────────
// median_difference                — compare medians
// std_difference                   — compare standard deviations
// iqr_difference                   — compare interquartile ranges
// unseen_category_check            — flag categories in synthetic not seen in real
// total_variation_distance         — sum of absolute proportion differences
// correlation_matrix_distance      — compare full correlation matrices
// spearman_correlation             — rank-based correlation comparison
// cramers_v_comparison             — association strength for categorical pairs
// joint_distribution_comparison    — compare joint category distributions
// group_summary_comparison         — compare numerical stats across category groups
// correlation_ratio_eta            — numerical-categorical association strength
// mutual_information               — shared information between two variables
export type EvaluationMetric =
  // Implemented
  | "mean_difference"
  | "ks_test"
  | "wasserstein_distance"
  | "chi_square"
  | "correlation_difference"
  | "category_proportion_difference"
  | "numerical_categorical_association"
  // Planned — frontend display only
  | "median_difference"
  | "std_difference"
  | "iqr_difference"
  | "unseen_category_check"
  | "total_variation_distance"
  | "correlation_matrix_distance"
  | "spearman_correlation"
  | "cramers_v_comparison"
  | "joint_distribution_comparison"
  | "group_summary_comparison"
  | "correlation_ratio_eta"
  | "mutual_information";

// Describes one metric in the Setup page option list
export interface MetricDefinition {
  key: EvaluationMetric;
  label: string;
  description: string;
  // Legacy field — kept for backward compatibility with backend response
  appliesTo: "numerical" | "categorical" | "multivariate" | "cross_type";
  // New fields — optional so old backend responses still work
  group?: MetricGroup;
  subgroup?: MetricSubgroup;
  applicableVariableTypes?: VariableType[];
  priority?: "Core" | "Recommended" | "Optional";
  // false means this metric is planned but not yet calculated by the backend
  implemented?: boolean;
}

// User's evaluation settings chosen on the Setup page
export interface EvaluationConfig {
  selectedMetrics: EvaluationMetric[];
  selectedColumns: string[];
  includeNumerical: boolean;
  includeCategorical: boolean;
  missingValueHandling: "ignore" | "drop" | "simple_impute";
  significanceLevel: number;
  // User-corrected variable types — overrides backend infer_type() result.
  // Key = raw column name, value = "numerical" | "categorical"
  // Empty object means no overrides — use backend inference for everything.
  columnTypeOverrides: Record<string, "numerical" | "categorical">;
}

// ── Evaluation result types ────────────────────────────────

// Used by ComparisonChart to render paired bars
export interface ChartPoint {
  label: string;
  realValue: number;
  syntheticValue: number;
}

// Top-level summary scores shown in the 6 summary cards
export interface EvaluationSummary {
  overallSimilarityScore: number;
  numericalSimilarityScore: number | null;    // null if no numerical metric was selected
  categoricalSimilarityScore: number | null;  // null if no categorical metric was selected
  relationshipSimilarityScore: number | null; // null if correlation_difference was not selected
  variablesAnalyzed: number;
  metricsUsed: number;
}

// Records what the user selected on the Setup page
export interface AnalysisContext {
  realDatasetName: string;
  syntheticDatasetName: string;
  selectedVariables: string[];
  selectedMetrics: EvaluationMetric[];
}

// One row in the variable ranking table
export interface VariableRankingItem {
  variable: string;
  type: "numerical" | "categorical";
  importanceScore: number;          // 0-1, backend-computed clinical relevance
  similarityScore: number;          // 0-1, how closely real and synthetic match
  status: "good" | "moderate" | "poor";
  topContributingMetric: EvaluationMetric; // metric with largest gap for this variable
}

// One cell in the metric matrix heatmap (sparse: only applicable metric-variable pairs)
export interface MetricMatrixCell {
  variable: string;
  metric: EvaluationMetric;
  normalizedScore: number; // 0-1
}

// Full variable × metric matrix, used to render the heatmap
export interface MetricMatrix {
  variables: string[];
  metrics: EvaluationMetric[];
  cells: MetricMatrixCell[]; // sparse — missing cell means metric does not apply
}

// One bar in a detail view chart (category label or histogram bin)
export interface DetailViewSeries {
  label: string;    // e.g. "NO", ">30", "1-3 days"
  real: number;     // proportion 0-1
  synthetic: number;
}

// One metric score shown in the detail panel
export interface DetailViewMetric {
  name: EvaluationMetric;
  value: number;           // raw statistic (e.g. KS statistic = 0.21)
  normalizedScore: number; // 0-1 normalized for display
}

// Full detail view for one variable (chart + metric breakdown)
export interface VariableDetailView {
  chartType: ChartType;   // uses the same ChartType as getChartType() — backend is the authority
  title: string;
  xAxisLabel: string;     // shown below the chart
  yAxisLabel: string;     // shown rotated on the left side
  series: DetailViewSeries[];
  metrics: DetailViewMetric[];
}

// ── Multivariate result types ──────────────────────────────────

// One Pearson correlation pair (Numerical × Numerical)
export interface CorrelationPair {
  variable1: string;
  variable2: string;
  realCorrelation: number;
  syntheticCorrelation: number;
  difference: number;  // |real - synthetic|, sorted desc by backend
}

// One Cramér's V pair (Categorical × Categorical)
export interface CramersVPair {
  variable1: string;
  variable2: string;
  realCramersV: number;
  syntheticCramersV: number;
  difference: number;  // sorted desc by backend
}

// One group row (Numerical × Categorical group value)
export interface GroupwiseSummaryRow {
  numericalVariable: string;
  categoricalVariable: string;
  groupValue: string;   // e.g. "NO", "Female", ">8"
  realMean: number;
  syntheticMean: number;
  difference: number;   // |real - synthetic|, sorted desc by backend
}

// All multivariate results — backend selects top K pairs per section
export interface MultivariateResults {
  topCorrelationPairs: CorrelationPair[];   // Numerical–Numerical
  topCramersVPairs: CramersVPair[];         // Categorical–Categorical
  topGroupwiseRows: GroupwiseSummaryRow[];  // Mixed
}

// Complete evaluation result returned by the backend (or mock)
export interface EvaluationResult {
  runId: string;
  generatedAt: string;                             // ISO 8601
  summary: EvaluationSummary;
  analysisContext: AnalysisContext;
  reminders: string[];                             // auto-generated sentences explaining the run
  variableRanking: VariableRankingItem[];          // sorted by importanceScore descending
  metricMatrix: MetricMatrix;
  detailViews: Record<string, VariableDetailView>; // keyed by variable name
  insights: string[];
  multivariateResults?: MultivariateResults;       // absent if backend hasn't computed it yet
}

// One saved comparison run (used in the Saved page table)
export interface SavedComparison {
  id: string;
  runName: string;
  createdAt: string;
  createdAtLabel: string;           // human-readable date, e.g. "1 Apr 2026"
  realDatasetName: string;
  syntheticDatasetName: string;
  overallSimilarityScore: number;
  metricsUsed: EvaluationMetric[];
  status: "completed" | "failed" | "processing";
}

// ── Navigation types ───────────────────────────────────────

// One item in the sidebar navigation
export interface NavigationItem {
  key: PageKey;
  label: string;       // full label, e.g. "Upload Datasets"
  shortLabel: string;  // subtitle, e.g. "Start comparison"
}

// ── Page prop types ────────────────────────────────────────

// Input to the upload handler
export interface UploadFilesInput {
  realFile?: File | null;
  syntheticFile?: File | null;
}

// Props shared across all pages (packed in App.tsx and spread into each page)
export interface SharedPageProps {
  uploadedDatasets: UploadedDatasets;
  validationSummary: ValidationSummary | null;
  evaluationConfig: EvaluationConfig;
  evaluationResult: EvaluationResult | null;
  savedComparisons: SavedComparison[];
  goToPage: (page: PageKey) => void;
}

// ── UI component prop types ────────────────────────────────

// SummaryCard props
export interface SummaryCardProps {
  label: string;       // card title
  value: ReactNode;    // main value (text, number, or element)
  helper?: ReactNode;  // optional supplementary note
  tone?: StatusTone;
  badge?: ReactNode;   // optional top-right label
}

// SectionCard props
export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

// ChartCard props — chart panel with built-in empty state and axis labels
export interface ChartCardProps {
  title: string;
  subtitle?: string;
  xAxisLabel: string;        // label below the chart (e.g. "Readmission Status")
  yAxisLabel: string;        // label rotated on the left (e.g. "Percentage of patients")
  legendItems?: string[];    // optional legend override; child chart may have its own
  hasData: boolean;          // true = show children, false = show emptyMessage
  emptyMessage?: string;     // shown when hasData is false
  children: ReactNode;
}

// PageSection props
export interface PageSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;  // optional right-side action button
  children: ReactNode;
}

// PrimaryButton props
export interface PrimaryButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}

// StatusBadge props
export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

// EmptyState props
export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

// InfoAlert props
export interface InfoAlertProps {
  title: string;
  items: ValidationIssue[];
}

// MetricBadgeList props
export interface MetricBadgeListProps {
  items: string[]; // each string becomes one badge
}

// One bar inside FakeChart
export interface FakeChartBar {
  label: string;
  value: ReactNode;
  percent: number; // bar width 0–100
}

// FakeChart props
export interface FakeChartProps {
  title: string;
  bars?: FakeChartBar[];
  height?: number; // min-height in px
}

// Column definition for DataTable
// T extends Record<string, unknown> ensures T is an object type
export interface DataTableColumn<T> {
  key: keyof T | string;
  label: string;                                             // column header text
  type?: "badge";                                            // render cell as a badge
  getTone?: (value: unknown, row: T) => StatusTone;         // dynamic badge colour
  render?: (value: unknown, row: T) => ReactNode;           // custom cell renderer
}

// DataTable props
export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string; // shown when rows is empty
}
