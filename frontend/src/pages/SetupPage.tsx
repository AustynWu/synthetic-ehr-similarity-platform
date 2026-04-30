// SetupPage.tsx — Step 3: evaluation setup
//
// Lets the user choose:
//   1. Which statistical metrics to apply (KS test, Chi-square, etc.)
//   2. Which columns to include in the comparison
// Clicking "Run Evaluation" runs the stats and navigates to the Results page.
//
// Metrics are now grouped by analysis type (Univariate / Multivariate).
// Unimplemented metrics (implemented: false) are shown but disabled — visible
// as MVP roadmap items but cannot be sent to the backend.

import { useMemo, useState } from "react";
import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import MetricBadgeList from "../components/ui/MetricBadgeList";
import type {
  EvaluationConfig, EvaluationMetric, MetricDefinition,
  MetricGroup, MetricSubgroup, SharedPageProps,
} from "../types/contracts";
import { availableMetrics } from "../services/evaluationService";
import { getVariableDisplayName } from "../utils/variableNames";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";

// ── Metric grouping helpers ───────────────────────────────────────────────────

// Returns all metrics that belong to a specific group + subgroup.
// Only implemented metrics are shown. Optional and unimplemented (coming soon) are hidden.
function metricsBySubgroup(group: MetricGroup, subgroup: MetricSubgroup): MetricDefinition[] {
  return availableMetrics.filter(
    (m) =>
      m.group === group &&
      m.subgroup === subgroup &&
      m.priority !== "Optional" &&
      m.implemented !== false
  );
}

// Priority badge colour: Core=green, Recommended=blue, Optional=grey
function priorityTone(priority?: string) {
  if (priority === "Core")        return "success" as const;
  if (priority === "Recommended") return "info"    as const;
  return "warning" as const;
}

// Structure that drives the grouped metric UI — order matters for display
const METRIC_GROUPS: { group: MetricGroup; subgroups: MetricSubgroup[] }[] = [
  {
    group: "Univariate",
    subgroups: ["Numerical", "Categorical"],
  },
  {
    group: "Multivariate",
    subgroups: ["Numerical–Numerical", "Categorical–Categorical", "Mixed"],
  },
];

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

  // Select only metrics that are Core priority AND already implemented in the backend
  const selectAllCoreMetrics = () => {
    const coreKeys = availableMetrics
      .filter((m) => m.priority === "Core" && m.implemented !== false)
      .map((m) => m.key);
    setConfig((current) => ({ ...current, selectedMetrics: coreKeys }));
  };

  // Clear all selected metrics
  const clearAllMetrics = () => {
    setConfig((current) => ({ ...current, selectedMetrics: [] }));
  };

  // Set or clear a user type override for one column.
  // If the user picks the same type as the backend inferred, remove the override (no change needed).
  const setTypeOverride = (col: string, newType: "numerical" | "categorical") => {
    const inferredType = validationSummary.availableColumns.find(
      (c) => c.columnName === col
    )?.dataType;

    setConfig((current) => {
      const overrides = { ...current.columnTypeOverrides };
      if (newType === inferredType) {
        delete overrides[col]; // same as inferred — no need to store
      } else {
        overrides[col] = newType;
      }
      return { ...current, columnTypeOverrides: overrides };
    });
  };

  // Reset one column's type back to backend inference
  const resetTypeOverride = (col: string) => {
    setConfig((current) => {
      const overrides = { ...current.columnTypeOverrides };
      delete overrides[col];
      return { ...current, columnTypeOverrides: overrides };
    });
  };

  // Count selected implemented metrics in a given top-level group
  const countSelectedInGroup = (group: MetricGroup) =>
    availableMetrics.filter(
      (m) => m.group === group &&
             m.implemented !== false &&
             config.selectedMetrics.includes(m.key)
    ).length;

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
                    const isDisabled = !isSelected && config.selectedColumns.length >= MAX_VARIABLES;
                    return (
                      <button
                        key={columnName}
                        type="button"
                        className={`variable-chip ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                        onClick={() => !isDisabled && toggleVariable(columnName)}
                        disabled={isDisabled}
                        title={columnName}
                      >
                        {getVariableDisplayName(columnName)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SectionCard>
      </PageSection>

      {/* Row 2: variable type review — only shown when at least one variable is selected */}
      {config.selectedColumns.length > 0 && (
        <SectionCard
          title="Variable type review"
          subtitle="The backend has inferred a type for each selected variable. Correct any that look wrong — this affects which metrics are applied."
        >
          <div className="type-review-table">
            {/* Header row — stays fixed, does not scroll */}
            <div className="type-review-header">
              <span>Variable</span>
              <span>Raw column name</span>
              <span>Inferred type</span>
              <span>Use type</span>
              <span></span>
            </div>

            {/* Data rows — scrollable, shows 6 rows at a time */}
            <div className="type-review-rows">
            {config.selectedColumns.map((col) => {
              const inferredType =
                validationSummary.availableColumns.find((c) => c.columnName === col)?.dataType ?? "unknown";

              // Only allow overriding columns the backend actually typed as numerical or categorical
              const canOverride = inferredType === "numerical" || inferredType === "categorical";

              const isOverridden = col in config.columnTypeOverrides;
              const currentType = isOverridden
                ? config.columnTypeOverrides[col]
                : inferredType;

              return (
                <div key={col} className={`type-review-row${isOverridden ? " overridden" : ""}`}>
                  {/* Display name */}
                  <span className="type-review-display">{getVariableDisplayName(col)}</span>

                  {/* Raw column name */}
                  <span className="type-review-raw">{col}</span>

                  {/* Inferred type badge */}
                  <StatusBadge tone={
                    inferredType === "numerical"   ? "info"    :
                    inferredType === "categorical" ? "success" : "warning"
                  }>
                    {inferredType}
                  </StatusBadge>

                  {/* Type selector dropdown — disabled for datetime / text / unknown */}
                  {canOverride ? (
                    <select
                      className={`type-review-select${isOverridden ? " changed" : ""}`}
                      value={currentType as string}
                      onChange={(e) =>
                        setTypeOverride(col, e.target.value as "numerical" | "categorical")
                      }
                    >
                      <option value="numerical">numerical</option>
                      <option value="categorical">categorical</option>
                    </select>
                  ) : (
                    <span className="type-review-na">—</span>
                  )}

                  {/* Reset button — only shown when overridden */}
                  {isOverridden ? (
                    <button
                      type="button"
                      className="variable-group-action"
                      onClick={() => resetTypeOverride(col)}
                    >
                      Reset
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
            </div> {/* end type-review-rows */}
          </div>

          {/* Summary of active overrides */}
          {Object.keys(config.columnTypeOverrides).length > 0 && (
            <p className="type-review-summary">
              {Object.keys(config.columnTypeOverrides).length} override(s) active.{" "}
              <button
                type="button"
                className="variable-group-action"
                onClick={() => setConfig((c) => ({ ...c, columnTypeOverrides: {} }))}
              >
                Reset all
              </button>
            </p>
          )}
        </SectionCard>
      )}

      {/* Row 3: metric selection + run summary side by side */}
      <div className="two-column-grid">

        {/* Left: grouped metric checkboxes */}
        <SectionCard
          title="Metric selection"
          subtitle="Metrics are grouped by analysis type to make the evaluation easier to understand."
        >
          {/* Top action bar */}
          <div className="metric-header-actions">
            <button
              type="button"
              className="variable-group-action"
              onClick={selectAllCoreMetrics}
            >
              Select all core metrics
            </button>
            <button
              type="button"
              className="variable-group-action"
              onClick={clearAllMetrics}
            >
              Clear all
            </button>
          </div>

          {/* Render each top-level group (Univariate / Multivariate) */}
          {METRIC_GROUPS.map(({ group, subgroups }) => (
            <div key={group} className="metric-group-section">

              {/* Group heading e.g. "Univariate Analysis" */}
              <div className="metric-group-heading">{group} Analysis</div>

              {/* Render each subgroup inside the group */}
              {subgroups.map((subgroup) => {
                const metrics = metricsBySubgroup(group, subgroup);
                return (
                  <div key={subgroup} className="metric-subgroup-section">

                    {/* Subgroup label e.g. "Numerical Metrics" */}
                    <div className="metric-subgroup-label">{subgroup} Metrics</div>

                    {/* If no implemented metrics yet, show a placeholder */}
                    {metrics.length === 0 && (
                      <p className="metric-subgroup-placeholder">
                        Metrics for this group are planned for a future release.
                      </p>
                    )}

                    <div className="metric-option-list">
                      {metrics.map((metric: MetricDefinition) => {
                        const isDisabled = metric.implemented === false;
                        const isSelected = !isDisabled && config.selectedMetrics.includes(metric.key);
                        return (
                          <label
                            key={metric.key}
                            className={[
                              "metric-option",
                              isSelected  ? "selected"  : "",
                              isDisabled  ? "disabled"  : "",
                            ].join(" ").trim()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => !isDisabled && toggleMetric(metric.key)}
                            />
                            <div className="metric-option-body">
                              <div className="metric-label-row">
                                <strong>{metric.label}</strong>
                                <div className="metric-badge-group">
                                </div>
                              </div>
                              <p className="metric-description">{metric.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </SectionCard>

        {/* Right: live run summary — now shows count per group */}
        <SectionCard
          title="Run summary"
          subtitle="Live preview of your current selection."
        >
          <div className="stacked-summary">
            {/* Per-group metric counts */}
            <SummaryCard
              label="Univariate metrics selected"
              value={countSelectedInGroup("Univariate")}
              helper="Numerical + Categorical"
            />
            <SummaryCard
              label="Multivariate metrics selected"
              value={countSelectedInGroup("Multivariate")}
              helper="Numerical–Numerical, Categorical–Categorical, Mixed"
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
          {/* Badge list of currently selected metric labels */}
          <div className="spacer-top">
            <MetricBadgeList
              items={config.selectedMetrics
                .filter((key) =>
                  availableMetrics.find((m) => m.key === key)?.implemented !== false
                )
                .map(
                  (key) => availableMetrics.find((m) => m.key === key)?.label ?? key
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
