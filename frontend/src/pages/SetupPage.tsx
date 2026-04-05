// ========================================================
// SetupPage.tsx — 第三步：評估設定頁面
// ========================================================
// 讓使用者選擇：
//   1. 要用哪些統計指標（KS test、Chi-square 等）
//   2. 要比較哪些欄位（race、gender、readmitted 等）
// 選好後按「Run Evaluation」就跑評估並跳到結果頁。
//
// React 概念 — useState + 更新函式：
//   setConfig((current) => { ...current, selectedMetrics: [...] })
//   這種「函式型更新」寫法可以確保拿到最新的 state 值，
//   避免「閉包陷阱」（在非同步情境下 state 讀到舊值的問題）
//
// React 概念 — useMemo：
//   representativeColumns 從 validationSummary 計算出來
//   用 useMemo 快取，只有 validationSummary 改變時才重新計算
//
// TypeScript 概念 — 函式型別：
//   onRunEvaluation: (config: EvaluationConfig) => void | Promise<void>
//   代表這個函式接收 EvaluationConfig，不回傳值（void）
//   | Promise<void> 讓它可以是非同步函式
// ========================================================

import { useMemo, useState } from "react";
import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import MetricBadgeList from "../components/ui/MetricBadgeList";
import type { EvaluationConfig, EvaluationMetric, MetricDefinition, SharedPageProps } from "../types/contracts";
import { availableMetrics } from "../services/evaluationService";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";

// 欄位分組：4 個大組讓使用者快速定位，encounter_id / patient_nbr 不列出（ID 欄不應進入評估）
// 這是針對 diabetic_data.csv 的靜態分組，之後接後端時由 API 提供
const variableGroups = [
  {
    label: "Patient",
    variables: ["race", "gender", "age", "weight", "max_glu_serum", "A1Cresult"],
  },
  {
    label: "Clinical",
    variables: ["admission_type_id", "discharge_disposition_id", "admission_source_id", "payer_code", "medical_specialty", "time_in_hospital", "num_lab_procedures", "num_procedures", "num_medications", "number_outpatient", "number_emergency", "number_inpatient", "number_diagnoses", "diag_1", "diag_2", "diag_3"],
  },
  {
    label: "Medication",
    variables: ["metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride", "acetohexamide", "glipizide", "glyburide", "tolbutamide", "pioglitazone", "rosiglitazone", "acarbose", "miglitol", "troglitazone", "tolazamide", "examide", "citoglipton", "insulin", "glyburide-metformin", "glipizide-metformin", "glimepiride-pioglitazone", "metformin-rosiglitazone", "metformin-pioglitazone"],
  },
  {
    label: "Outcome",
    variables: ["change", "diabetesMed", "readmitted"],
  },
];

// Max variables the backend can handle in one evaluation run
const MAX_VARIABLES = 30;

// 預設建議使用者選的欄位（代表性欄位，不需要全選）
const suggestedVariables = [
  "race", "gender", "age", "time_in_hospital",
  "num_lab_procedures", "num_medications", "number_diagnoses",
  "A1Cresult", "insulin", "readmitted",
];

// SetupPage 除了 SharedPageProps，還需要 onRunEvaluation 函式
export default function SetupPage({
  validationSummary,
  evaluationConfig,
  goToPage,
  onRunEvaluation,
}: SharedPageProps & { onRunEvaluation: (config: EvaluationConfig) => void | Promise<void> }) {

  // 防呆：如果還沒完成驗證就跳到這頁
  if (!validationSummary) {
    return (
      <EmptyState
        title="Validation is required first"
        description="Upload and validate the diabetes datasets before choosing evaluation methods."
        actionLabel="Go to validation"
        onAction={() => goToPage("validation")}
      />
    );
  }

  // 初始化「選好的欄位」：
  // 如果之前已經設定過（evaluationConfig.selectedColumns 有值），就沿用
  // 否則使用建議欄位清單
  const initialSelectedColumns =
    evaluationConfig.selectedColumns.length > 0
      ? evaluationConfig.selectedColumns
      : suggestedVariables;

  // 本頁的設定狀態（複製一份 evaluationConfig 當初始值）
  const [config, setConfig] = useState<EvaluationConfig>({
    ...evaluationConfig,
    selectedColumns: initialSelectedColumns,
  });

  // 切換一個指標的勾選狀態（已勾選就取消，未勾選就加入）
  const toggleMetric = (metric: EvaluationMetric) => {
    setConfig((current) => {
      const exists = current.selectedMetrics.includes(metric);
      return {
        ...current, // 保留其他設定不變
        selectedMetrics: exists
          ? current.selectedMetrics.filter((item) => item !== metric) // 移除
          : [...current.selectedMetrics, metric],                      // 加入
      };
    });
  };

  // 切換一個欄位的勾選狀態
  const toggleVariable = (columnName: string) => {
    setConfig((current) => {
      const exists = current.selectedColumns.includes(columnName);
      return {
        ...current,
        selectedColumns: exists
          ? current.selectedColumns.filter((item) => item !== columnName)
          : [...current.selectedColumns, columnName],
      };
    });
  };

  // 把一組欄位全部加入選擇（已選的不重複加入）
  const selectAllInGroup = (columns: string[]) => {
    setConfig((current) => ({
      ...current,
      selectedColumns: Array.from(new Set([...current.selectedColumns, ...columns])),
    }));
  };

  // 把一組欄位全部從選擇中移除
  const clearGroup = (columns: string[]) => {
    setConfig((current) => ({
      ...current,
      selectedColumns: current.selectedColumns.filter((c) => !columns.includes(c)),
    }));
  };

  // 搜尋框的輸入值（即時過濾欄位名稱）
  const [searchQuery, setSearchQuery] = useState("");

  // 從後端回傳的完整欄位清單取得欄位名稱，讓使用者可以從全部欄位中選擇
  // useMemo 避免每次渲染都重新計算（validationSummary 很少改變）
  const allColumns = useMemo(
    () => validationSummary.availableColumns.map((col) => col.columnName),
    [validationSummary]
  );

  return (
    <div className="page-stack">
      {/* Row 1：欄位選擇（全寬，在最上面讓使用者先決定要比較什麼） */}
      <PageSection
        title="Evaluation setup"
        description="Choose the variables and metrics to preview in the similarity prototype."
      >
        <SectionCard
          title="Variable selection"
          subtitle="Select the columns to include in the evaluation. Columns are grouped by clinical category."
        >
          {/* 搜尋框 + 已選計數 */}
          <div className="variable-selection-header">
            <input
              type="text"
              className="variable-search-input"
              placeholder="Search columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className={`variable-selection-count${config.selectedColumns.length > MAX_VARIABLES ? " over-limit" : ""}`}>
              {config.selectedColumns.length} / {MAX_VARIABLES} max
              {config.selectedColumns.length > MAX_VARIABLES && " — reduce selection to continue"}
            </span>
          </div>

          {variableGroups.map((group) => {
            // 先過濾掉後端沒有的欄位，再根據搜尋詞過濾
            const cols = group.variables.filter(
              (v) => allColumns.includes(v) &&
                     v.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (cols.length === 0) return null;
            return (
              <div key={group.label} className="variable-group-section">
                {/* 分組標題列：左邊組名，右邊 Select all / Clear 按鈕 */}
                <div className="variable-group-header">
                  <div className="variable-group-label">{group.label}</div>
                  <div className="variable-group-actions">
                    <button
                      type="button"
                      className="variable-group-action"
                      onClick={() => selectAllInGroup(cols)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="variable-group-action"
                      onClick={() => clearGroup(cols)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="variable-chip-grid">
                  {cols.map((columnName) => {
                    const isSelected = config.selectedColumns.includes(columnName);
                    // Disable unselected chips when the limit is reached
                    const isDisabled = !isSelected && config.selectedColumns.length >= MAX_VARIABLES;
                    return (
                      <button
                        key={columnName}
                        type="button"
                        className={`variable-chip ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                        onClick={() => !isDisabled && toggleVariable(columnName)}
                        disabled={isDisabled}
                      >
                        {columnName}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SectionCard>
      </PageSection>

      {/* Row 2：指標選擇 + 執行摘要並排 */}
      <div className="two-column-grid">
        {/* 左：指標選擇（checkbox 清單） */}
        <SectionCard
          title="Metric selection"
          subtitle="Select the statistical methods to apply. Each metric is labelled by the column type it applies to."
        >
          <div className="metric-selection-grid">
            {availableMetrics.map((metric: MetricDefinition) => {
              const isSelected = config.selectedMetrics.includes(metric.key);
              return (
                <label
                  key={metric.key}
                  className={`metric-option ${isSelected ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMetric(metric.key)}
                  />
                  <div>
                    <div className="metric-label-row">
                      <strong>{metric.label}</strong>
                      <StatusBadge tone={
                        metric.appliesTo === "numerical"   ? "info"    :
                        metric.appliesTo === "categorical" ? "success" :
                        metric.appliesTo === "cross_type"  ? "danger"  : "warning"
                      }>
                        {metric.appliesTo}
                      </StatusBadge>
                    </div>
                    <p>{metric.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </SectionCard>

        {/* 右：執行摘要（讓使用者確認目前選了什麼） */}
        <SectionCard
          title="Run summary"
          subtitle="Live preview of your current selection."
        >
          <div className="stacked-summary">
            <SummaryCard
              label="Selected metrics"
              value={config.selectedMetrics.length}
              helper="Statistical methods to run"
            />
            <SummaryCard
              label="Selected variables"
              value={config.selectedColumns.length}
              helper="Columns to include in evaluation"
            />
            <SummaryCard
              label="Dataset pair"
              value={`${validationSummary.realDataset.fileName} vs ${validationSummary.syntheticDataset.fileName}`}
              helper={`${validationSummary.realDataset.rowCount.toLocaleString()} rows • ${validationSummary.matchedColumnCount} columns matched`}
            />
          </div>
          <div className="spacer-top">
            <MetricBadgeList
              items={config.selectedMetrics.map(
                (metric) => availableMetrics.find((item) => item.key === metric)?.label ?? metric
              )}
            />
          </div>
        </SectionCard>
      </div>

      {/* 頁面底部按鈕 */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("validation")}>
          Back to Validation
        </PrimaryButton>
        {/* 如果沒選任何指標或欄位，按鈕會被禁用 */}
        <PrimaryButton
          onClick={() => onRunEvaluation(config)}
          disabled={config.selectedMetrics.length === 0 || config.selectedColumns.length === 0 || config.selectedColumns.length > MAX_VARIABLES}
        >
          Run Evaluation
        </PrimaryButton>
      </div>
    </div>
  );
}
