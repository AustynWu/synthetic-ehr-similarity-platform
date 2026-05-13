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

import { useEffect, useMemo, useState } from "react";
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

// Display order for groups returned by the backend
const GROUP_ORDER = ["Patient", "Lab / Test", "Clinical / Encounter", "Medication", "Outcome", "Other / Review"];

// Max variables the backend can handle in one evaluation run
const MAX_VARIABLES = 30;


export default function SetupPage({
  validationSummary,
  evaluationConfig,
  goToPage,
  onRunEvaluation,
  isLoading,
}: SharedPageProps & {
  onRunEvaluation: (config: EvaluationConfig) => void | Promise<void>;
  isLoading?: boolean;
}) {

  // Guard: validation must be completed first
  if (!validationSummary) {
    return (
      <EmptyState
        title="Validation is required first"
        description="Upload and validate the datasets before choosing evaluation methods."
        actionLabel="Go to validation"
        onAction={() => goToPage("validation")}
      />
    );
  }

  // Guard: datasets must be compatible (shared columns exist)
  if (!validationSummary.canProceed) {
    return (
      <EmptyState
        title="Datasets cannot be analysed"
        description="The uploaded datasets have no shared columns. Please re-upload compatible datasets."
        actionLabel="Go to Upload"
        onAction={() => goToPage("upload")}
      />
    );
  }

  // Local config state — restore previous column selection if it exists, otherwise start empty
  const [config, setConfig] = useState<EvaluationConfig>(evaluationConfig);

  // Auto-select a sensible default set of columns when the user first arrives with no selection.
  // Picks up to 2 columns per group (following GROUP_ORDER), capped at 10 total,
  // and skips any column with >= 50% real missing rate.
  useEffect(() => {
    if (!validationSummary) return;

    // Build a missing-rate lookup from schemaComparison (may be a subset of all columns).
    // Columns absent from the map default to 0% — safe since availableColumns already filters problem columns.
    const missingRateMap = new Map<string, number>(
      validationSummary.schemaComparison.map((r) => [r.columnName, r.realMissingRate])
    );

    // Keep only columns with < 50% real missing rate, grouped by displayGroup.
    const byGroup = new Map<string, string[]>();
    for (const col of validationSummary.availableColumns) {
      const missing = missingRateMap.get(col.columnName) ?? 0;
      if (missing >= 50) continue;
      const grp = col.displayGroup ?? "Other / Review";
      if (!byGroup.has(grp)) byGroup.set(grp, []);
      byGroup.get(grp)!.push(col.columnName);
    }

    // Follow GROUP_ORDER, then any extra groups not in the order list.
    const orderedGroups = [
      ...GROUP_ORDER.filter((g) => byGroup.has(g)),
      ...Array.from(byGroup.keys()).filter((k) => !GROUP_ORDER.includes(k)),
    ];

    const PER_GROUP = 2;
    const MAX_DEFAULT = 10;
    const selected: string[] = [];
    for (const label of orderedGroups) {
      if (selected.length >= MAX_DEFAULT) break;
      const cols = byGroup.get(label) ?? [];
      selected.push(...cols.slice(0, Math.min(PER_GROUP, MAX_DEFAULT - selected.length)));
    }

    if (selected.length === 0) return;

    // Only apply if the user hasn't already made a selection.
    setConfig((current) => {
      if (current.selectedColumns.length > 0) return current;
      return { ...current, selectedColumns: selected };
    });
  }, [validationSummary]);

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

  // Build variable groups dynamically from the backend-supplied displayGroup field
  const variableGroups = useMemo(() => {
    const groupMap = new Map<string, string[]>();
    for (const col of validationSummary.availableColumns) {
      const group = col.displayGroup ?? "Other / Review";
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(col.columnName);
    }
    const result: { label: string; variables: string[] }[] = [];
    for (const label of GROUP_ORDER) {
      if (groupMap.has(label)) result.push({ label, variables: groupMap.get(label)! });
    }
    for (const [label, variables] of groupMap) {
      if (!GROUP_ORDER.includes(label)) result.push({ label, variables });
    }
    return result;
  }, [validationSummary]);

  // Warn when selected columns have no applicable metric.
  // e.g. user picks only numerical metrics but also selects categorical columns — those columns produce no results.
  const mismatchWarning = useMemo(() => {
    const hasNumericalMetric = config.selectedMetrics.some((m) =>
      availableMetrics.find((def) => def.key === m)?.appliesTo === "numerical"
    );
    const hasCategoricalMetric = config.selectedMetrics.some((m) =>
      availableMetrics.find((def) => def.key === m)?.appliesTo === "categorical"
    );

    const colTypeMap = Object.fromEntries(
      validationSummary.availableColumns.map((c) => [c.columnName, c.dataType])
    );

    const unmatchedNumerical = config.selectedColumns.filter(
      (col) => colTypeMap[col] === "numerical" && !hasNumericalMetric
    );
    const unmatchedCategorical = config.selectedColumns.filter(
      (col) => colTypeMap[col] === "categorical" && !hasCategoricalMetric
    );

    const parts: string[] = [];
    if (unmatchedNumerical.length > 0)
      parts.push(`${unmatchedNumerical.length} numerical column(s) have no applicable metric selected`);
    if (unmatchedCategorical.length > 0)
      parts.push(`${unmatchedCategorical.length} categorical column(s) have no applicable metric selected`);

    return parts.length > 0
      ? parts.join(" · ") + " — these columns will produce no results."
      : null;
  }, [config.selectedMetrics, config.selectedColumns, validationSummary]);

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
            // Apply the search query — backend already filtered to valid columns
            const cols = group.variables.filter(
              (v) => v.toLowerCase().includes(searchQuery.toLowerCase())
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

          {/* Excluded columns — shown for transparency, cannot be selected */}
          {validationSummary.excludedColumns.length > 0 && (
            <div className="variable-group-section excluded-columns-section">
              <div className="variable-group-header">
                <div className="variable-group-label excluded-group-label">
                  Excluded from analysis ({validationSummary.excludedColumns.length})
                </div>
              </div>
              <p className="excluded-columns-note">
                These columns exist in both datasets but cannot be used in metric calculation.
              </p>
              <div className="variable-chip-grid">
                {validationSummary.excludedColumns
                  .filter((c) => c.columnName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((c) => (
                    // span instead of button — disabled buttons block pointer events so title tooltip never fires
                    <span
                      key={c.columnName}
                      className="variable-chip excluded"
                      title={`${c.columnName} — ${c.reason}`}
                    >
                      {getVariableDisplayName(c.columnName)}
                    </span>
                  ))}
              </div>
            </div>
          )}
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
        <div className="page-actions-right">
          {mismatchWarning && (
            <p className="upload-error upload-error--warning">{mismatchWarning}</p>
          )}
          <PrimaryButton
            onClick={() => onRunEvaluation(config)}
            disabled={
              isLoading ||
              config.selectedMetrics.length === 0 ||
              config.selectedColumns.length === 0 ||
              config.selectedColumns.length > MAX_VARIABLES
            }
          >
            {isLoading ? "Running..." : "Run Evaluation"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
