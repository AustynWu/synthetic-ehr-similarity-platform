// SetupPage.tsx — Step 3: evaluation setup
//
// Lets the user choose:
//   1. Which statistical metrics to apply (KS test, Chi-square, etc.)
//   2. Which columns to include in the comparison
// Clicking "Run Evaluation" runs the stats and navigates to the Results page.
//
// Functional update pattern:
//   setConfig((current) => { ...current, selectedMetrics: [...] })
//   Using a function ensures the latest state value is read, avoiding stale-closure bugs.
//
// useMemo:
//   representativeColumns is computed from validationSummary.
//   Memoised so it only recalculates when validationSummary changes.
//
// onRunEvaluation type:
//   (config: EvaluationConfig) => void | Promise<void>
//   Accepts both synchronous and async handlers.

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

// Column groups for diabetic_data.csv — encounter_id and patient_nbr are omitted (ID columns should not be evaluated)
// Static for prototype; backend API will provide groupings in production.
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

// Suggested default columns (representative subset — no need to select all)
const suggestedVariables = [
  "race", "gender", "age", "time_in_hospital",
  "num_lab_procedures", "num_medications", "number_diagnoses",
  "A1Cresult", "insulin", "readmitted",
];

export default function SetupPage({
  validationSummary,
  evaluationConfig,
  goToPage,
  onRunEvaluation,
}: SharedPageProps & { onRunEvaluation: (config: EvaluationConfig) => void | Promise<void> }) {

  // Guard: validation must be completed first
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

  // Initialise selected columns:
  // If a previous selection exists, restore it; otherwise use the suggested defaults.
  const initialSelectedColumns =
    evaluationConfig.selectedColumns.length > 0
      ? evaluationConfig.selectedColumns
      : suggestedVariables;

  // Local config state (copy of evaluationConfig with initialised columns)
  const [config, setConfig] = useState<EvaluationConfig>({
    ...evaluationConfig,
    selectedColumns: initialSelectedColumns,
  });

  // Toggle one metric on/off
  const toggleMetric = (metric: EvaluationMetric) => {
    setConfig((current) => {
      const exists = current.selectedMetrics.includes(metric);
      return {
        ...current,
        selectedMetrics: exists
          ? current.selectedMetrics.filter((item) => item !== metric)
          : [...current.selectedMetrics, metric],
      };
    });
  };

  // Toggle one column on/off
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

  // Select all columns in a group (skips already-selected ones)
  const selectAllInGroup = (columns: string[]) => {
    setConfig((current) => ({
      ...current,
      selectedColumns: Array.from(new Set([...current.selectedColumns, ...columns])),
    }));
  };

  // Remove all columns in a group from the selection
  const clearGroup = (columns: string[]) => {
    setConfig((current) => ({
      ...current,
      selectedColumns: current.selectedColumns.filter((c) => !columns.includes(c)),
    }));
  };

  // Search box value for filtering column chips
  const [searchQuery, setSearchQuery] = useState("");

  // Full column list from the validation result — used to filter out columns the backend doesn't know about
  const allColumns = useMemo(
    () => validationSummary.availableColumns.map((col) => col.columnName),
    [validationSummary]
  );

  return (
    <div className="page-stack">
      {/* Row 1: variable selection (full width, shown first so users pick columns before metrics) */}
      <PageSection
        title="Evaluation setup"
        description="Choose the variables and metrics to preview in the similarity prototype."
      >
        <SectionCard
          title="Variable selection"
          subtitle="Select the columns to include in the evaluation. Columns are grouped by clinical category."
        >
          {/* Search box + selection count */}
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
            // Filter to columns the backend knows about, then apply the search query
            const cols = group.variables.filter(
              (v) => allColumns.includes(v) &&
                     v.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (cols.length === 0) return null;
            return (
              <div key={group.label} className="variable-group-section">
                {/* Group header: name on left, Select all / Clear on right */}
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

      {/* Row 2: metric selection + run summary side by side */}
      <div className="two-column-grid">
        {/* Left: metric checkboxes */}
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

        {/* Right: live run summary so users can confirm their selection */}
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

      {/* Page footer actions */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("validation")}>
          Back to Validation
        </PrimaryButton>
        {/* Button is disabled if no metrics or columns are selected, or the column limit is exceeded */}
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
