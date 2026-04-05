// ========================================================
// contracts.ts — 整個專案的「資料結構說明書」
// ========================================================
// 這個檔案只定義「型別（Type）」和「介面（Interface）」，不寫任何邏輯。
//
// TypeScript 概念說明：
//   type    → 幫一個值取別名，例如 type Color = "red" | "blue"
//   interface → 定義一個物件的形狀（有哪些欄位、每個欄位是什麼型態）
//   ReactNode → React 可以渲染的任何東西（文字、元件、HTML 等）
//   | （垂直線）→ 「或」的意思，例如 "a" | "b" 代表只能是 "a" 或 "b"
//
// 為什麼要把型別集中在這一個檔案？
//   → 方便管理，改一個地方全部同步，不用到處找
// ========================================================

import type { ReactNode, MouseEventHandler } from "react";

// ── 頁面識別鍵 ─────────────────────────────────────────────
// 這五個字串代表應用程式的五個頁面
// 只能是這五個值之一，TypeScript 會幫你防止打錯字
export type PageKey = "upload" | "validation" | "setup" | "results" | "saved";

// ── 資料集相關型別 ──────────────────────────────────────────

// 資料集的角色：真實資料 或 合成（假）資料
export type DatasetRole = "real" | "synthetic";

// 支援的檔案格式
export type DatasetFileType = "csv" | "xlsx";

// 資料集處理狀態
// uploaded  → 剛上傳完
// processing → 處理中
// failed    → 失敗
// validated → 驗證通過
export type DatasetStatus = "uploaded" | "processing" | "failed" | "validated";

// 欄位的資料型態標籤
export type DataTypeLabel = "numerical" | "categorical" | "datetime" | "text" | "unknown";

// UI 顏色語義（用來決定 badge 的顏色）
// info=藍  success=綠  warning=黃  danger=紅
export type StatusTone = "info" | "success" | "warning" | "danger";

// 一個資料集檔案的基本資訊
export interface DatasetFile {
  id: string;           // 唯一識別碼，例如 "real-001"
  role: DatasetRole;    // "real" 或 "synthetic"
  fileName: string;     // 檔案名稱
  fileType: DatasetFileType;
  sizeBytes: number;    // 檔案大小（位元組）
  uploadedAt: string;   // 上傳時間（ISO 8601 字串格式）
  status: DatasetStatus;
}

// 兩個資料集配對（真實 + 合成）
export interface UploadedDatasets {
  realDataset: DatasetFile | null;      // null 代表還沒上傳
  syntheticDataset: DatasetFile | null;
}

// 單一資料集的基本統計摘要
export interface DatasetBasicSummary {
  fileId: string;
  fileName: string;
  rowCount: number;           // 幾行資料
  columnCount: number;        // 幾個欄位
  missingValueCount: number;   // 缺失值總數
  duplicateRowCount: number;   // 重複行數
  missingColumnCount: number;  // 有缺失值的欄位數
}

// ── 驗證相關型別 ────────────────────────────────────────────

// 欄位比較狀態
// matched           → 兩份資料都有，且型態相同（好）
// type_mismatch     → 欄位名稱相同但資料型態不同（警告）
// missing_in_synthetic → 真實資料有，合成資料沒有
// missing_in_real      → 合成資料有，真實資料沒有
export type SchemaStatus =
  | "matched"
  | "type_mismatch"
  | "missing_in_synthetic"
  | "missing_in_real";

// 單一欄位的比較結果（用於驗證頁的表格）
export interface SchemaComparisonRow {
  id: string;
  columnName: string;           // 欄位名稱，例如 "age"
  realType: DataTypeLabel;      // 真實資料的型態
  syntheticType: DataTypeLabel; // 合成資料的型態
  realMissingRate: number;      // 真實資料的缺失率（0~100）
  syntheticMissingRate: number; // 合成資料的缺失率
  status: SchemaStatus;
}

// 單一驗證問題（error=錯誤 / warning=警告 / info=一般資訊）
export interface ValidationIssue {
  level: "error" | "warning" | "info";
  code: string;    // 問題代碼，例如 "HIGH_MISSINGNESS"
  message: string; // 給使用者看的說明文字
}

// 整份驗證摘要（驗證頁顯示的所有資料）
export interface ValidationSummary {
  realDataset: DatasetBasicSummary;
  syntheticDataset: DatasetBasicSummary;
  matchedColumnCount: number;    // 對齊的欄位數
  unmatchedColumnCount: number;  // 不對齊的欄位數
  schemaComparison: SchemaComparisonRow[]; // 驗證用的代表性欄位子集（有問題的 + 少量乾淨欄位）
  availableColumns: { columnName: string; dataType: DataTypeLabel }[]; // 全部欄位清單，給 Setup 頁讓使用者選擇用
  issues: ValidationIssue[];    // 發現的問題清單
  canProceed: boolean;           // 是否可以繼續進行評估
}

// ── 評估設定相關型別 ────────────────────────────────────────

// 支援的統計評估指標
// mean_difference          → 平均值差異（數值型欄位）
// ks_test                  → KS 檢定（比較分布形狀）
// wasserstein_distance     → Wasserstein 距離（另一種分布比較方式）
// chi_square               → 卡方檢定（類別型欄位）
// correlation_difference   → 相關性差異（多變量關係）
// category_proportion_diff → 類別比例差異
// numerical_categorical_association → 數值變數在各類別群組的分布比較（cross-type）
export type EvaluationMetric =
  | "mean_difference"
  | "ks_test"
  | "wasserstein_distance"
  | "chi_square"
  | "correlation_difference"
  | "category_proportion_difference"
  | "numerical_categorical_association";

// 一個評估指標的基本描述（用於 Setup 頁的選項清單）
export interface MetricDefinition {
  key: EvaluationMetric;   // 程式用的識別碼
  label: string;           // 顯示給使用者看的名稱
  description: string;     // 說明這個指標在測什麼
  appliesTo: "numerical" | "categorical" | "multivariate" | "cross_type"; // 適用的欄位型態
}

// 使用者在 Setup 頁設定的評估參數
export interface EvaluationConfig {
  selectedMetrics: EvaluationMetric[];  // 勾選的指標
  selectedColumns: string[];            // 勾選的欄位名稱
  includeNumerical: boolean;            // 是否包含數值型欄位
  includeCategorical: boolean;          // 是否包含類別型欄位
  missingValueHandling: "ignore" | "drop" | "simple_impute"; // 缺失值處理方式
  significanceLevel: number;            // 統計顯著水準（通常是 0.05）
}

// ── 評估結果相關型別 ────────────────────────────────────────

// ChartPoint is used by ComparisonChart to render paired bars
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
  chartType: "groupedBar" | "distributionComparison";
  title: string;
  series: DetailViewSeries[];
  metrics: DetailViewMetric[];
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
}

// 一筆儲存的比較記錄（Saved 頁的表格用）
export interface SavedComparison {
  id: string;
  runName: string;
  createdAt: string;
  createdAtLabel: string;           // 給人看的日期格式，例如 "1 Apr 2026"
  realDatasetName: string;
  syntheticDatasetName: string;
  overallSimilarityScore: number;
  metricsUsed: EvaluationMetric[];
  status: "completed" | "failed" | "processing";
}

// ── 導覽相關型別 ────────────────────────────────────────────

// 側邊欄一個選單項目的資料結構
export interface NavigationItem {
  key: PageKey;        // 對應的頁面識別鍵
  label: string;       // 完整標籤，例如 "Upload Datasets"
  shortLabel: string;  // 縮短標籤，例如 "Start comparison"
}

// ── 頁面 Props（元件參數）型別 ─────────────────────────────
// Props 是父元件傳給子元件的資料，就像函式的參數

// 上傳動作的輸入參數
export interface UploadFilesInput {
  realFile?: File | null;      // 真實資料檔案（File 是瀏覽器內建物件）
  syntheticFile?: File | null;
}

// 所有頁面共用的 props（App.tsx 打包好傳給每個頁面）
export interface SharedPageProps {
  uploadedDatasets: UploadedDatasets;
  validationSummary: ValidationSummary | null;
  evaluationConfig: EvaluationConfig;
  evaluationResult: EvaluationResult | null;
  savedComparisons: SavedComparison[];
  goToPage: (page: PageKey) => void; // 切換頁面的函式
}

// ── UI 元件的 Props 型別（每個小元件的參數）──────────────────

// SummaryCard（統計卡片）的參數
export interface SummaryCardProps {
  label: string;       // 卡片標題，例如 "Overall similarity"
  value: ReactNode;    // 顯示的數值（可以是文字、數字或元件）
  helper?: ReactNode;  // 補充說明（? 代表可不傳）
  tone?: StatusTone;   // 顏色語義
  badge?: ReactNode;   // 右上角的標籤
}

// SectionCard（區塊卡片容器）的參數
export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode; // 卡片裡面放什麼內容（由呼叫者決定）
  className?: string;  // 額外的 CSS class
}

// PageSection（頁面大區塊）的參數
export interface PageSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;  // 右側的操作按鈕（可選）
  children: ReactNode;
}

// PrimaryButton（主要按鈕）的參數
export interface PrimaryButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost"; // 按鈕外觀樣式
  onClick?: MouseEventHandler<HTMLButtonElement>; // 點擊事件
  disabled?: boolean;  // 是否禁用
}

// StatusBadge（狀態標籤）的參數
export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

// EmptyState（空白狀態提示）的參數
export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;  // 按鈕文字（可選）
  onAction?: () => void; // 按鈕點擊事件（可選）
}

// InfoAlert（資訊警示框）的參數
export interface InfoAlertProps {
  title: string;
  items: ValidationIssue[]; // 要顯示的問題清單
}

// MetricBadgeList（指標標籤列表）的參數
export interface MetricBadgeListProps {
  items: string[]; // 要顯示的字串清單，每個字串都會變成一個 badge
}

// FakeChart 裡一根 bar 的資料
export interface FakeChartBar {
  label: string;
  value: ReactNode; // 顯示的數值（文字）
  percent: number;  // bar 的長度百分比（0~100）
}

// FakeChart（簡易橫條圖）的參數
export interface FakeChartProps {
  title: string;
  bars?: FakeChartBar[];
  height?: number; // 最小高度（px）
}

// DataTable 的欄位定義型別
// T extends Record<string, unknown> 代表 T 必須是一個物件
// 這樣就可以讓 DataTable 適用於任何型態的資料，不用寫很多個 DataTable
export interface DataTableColumn<T> {
  key: keyof T | string;  // 對應資料的哪個欄位
  label: string;           // 表格標題列顯示的文字
  type?: "badge";          // 是否用 badge 顯示這格
  getTone?: (value: unknown, row: T) => StatusTone; // 動態決定 badge 顏色
  render?: (value: unknown, row: T) => ReactNode;   // 自訂渲染方式（可選）
}

// DataTable（通用資料表格）的參數
export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string; // 沒有資料時顯示的訊息
}
