// ========================================================
// ResultsPage.tsx — Results Dashboard
// ========================================================
// Six sections, from coarse to fine:
//   1. Summary cards     — 6 top-level scores at a glance
//   2. Analysis context  — dataset pair, selected variables & metrics, reminders
//   3. Variable ranking  — sortable / filterable table + radar chart side-by-side
//   4. Metric matrix     — heatmap showing every variable × metric score
//   5. Detail panel      — comparison chart + metric breakdown for one variable
//   6. Insights          — 3 auto-generated observations
//
// All data comes from evaluationResult (EvaluationResult type).
// No logic lives here — the page only renders what the backend provides.
// Replacing mock data with a real FastAPI response requires no page changes.
// ========================================================

import { useState } from "react";
import PageSection from "../components/ui/PageSection";
import SummaryCard from "../components/ui/SummaryCard";
import SectionCard from "../components/ui/SectionCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import ComparisonChart from "../components/dashboard/ComparisonChart";
import RadarChart from "../components/dashboard/RadarChart";
import MetricHeatmap from "../components/dashboard/MetricHeatmap";
import { availableMetrics } from "../services/evaluationService";
import type { SharedPageProps, StatusTone, VariableRankingItem } from "../types/contracts";

// Map metric key → readable label for display in the detail panel
function metricLabel(key: string): string {
  return availableMetrics.find((m) => m.key === key)?.label ?? key;
}

// Map status → badge tone colour
function statusTone(status: "good" | "moderate" | "poor"): StatusTone {
  if (status === "good")     return "success";
  if (status === "moderate") return "warning";
  return "danger";
}

// Map a 0-1 score to a badge tone for the summary cards
function scoreTone(score: number | null): StatusTone {
  if (score === null) return "info";
  if (score >= 0.8)   return "success";
  if (score >= 0.6)   return "warning";
  return "danger";
}

// ── Types for sort / filter state ───────────────────────────────────────────
type SortKey    = "importanceScore" | "similarityScore";
type FilterType = "all" | "numerical" | "categorical";
type FilterStatus = "all" | "good" | "moderate" | "poor";

// ── Component ────────────────────────────────────────────────────────────────
export default function ResultsPage({
  evaluationResult,
  goToPage,
  onSaveComparison,
}: SharedPageProps & { onSaveComparison: () => void }) {

  // Hooks must be declared unconditionally — before any early return
  const [selectedVariable, setSelectedVariable] = useState<string>("");
  const [sortBy,           setSortBy]           = useState<SortKey>("importanceScore");
  const [filterType,       setFilterType]       = useState<FilterType>("all");
  const [filterStatus,     setFilterStatus]     = useState<FilterStatus>("all");

  // Guard: results not yet available
  if (!evaluationResult) {
    return (
      <EmptyState
        title="No results available"
        description="Run an evaluation on the Setup page to view the results dashboard."
        actionLabel="Go to setup"
        onAction={() => goToPage("setup")}
      />
    );
  }

  const { summary, analysisContext, reminders, variableRanking, metricMatrix, detailViews, insights } = evaluationResult;

  // Resolve which variable is currently shown in section 5.
  // Falls back to the first variable that has a detail view when nothing is selected yet.
  const firstWithDetail = variableRanking.find((v) => detailViews[v.variable])?.variable ?? "";
  const activeVariable  = selectedVariable || firstWithDetail;

  // ── Derived data ────────────────────────────────────────────────────────────

  // Apply filters and sorting to the ranking table
  const filteredRanking: VariableRankingItem[] = variableRanking
    .filter((v) => filterType   === "all" || v.type   === filterType)
    .filter((v) => filterStatus === "all" || v.status === filterStatus)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  // Currently shown detail view (may be undefined if variable has no chart)
  const selectedDetail = detailViews[activeVariable];

  // Convert DetailViewSeries → ChartPoint for ComparisonChart
  const chartPoints = selectedDetail?.series.map((s) => ({
    label:          s.label,
    realValue:      s.real,
    syntheticValue: s.synthetic,
  })) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-stack">

      {/* ── Section 1: Summary cards ───────────────────────────────────────── */}
      <PageSection
        title="Results dashboard"
        description="Similarity scores, variable rankings, and distribution comparisons for this evaluation run."
      >
        <div className="summary-grid">
          <SummaryCard
            label="Overall similarity"
            value={summary.overallSimilarityScore.toFixed(2)}
            helper="Combined score across all metrics and variables"
            badge={summary.overallSimilarityScore >= 0.8 ? "Good" : summary.overallSimilarityScore >= 0.6 ? "Moderate" : "Poor"}
            tone={scoreTone(summary.overallSimilarityScore)}
          />
          <SummaryCard
            label="Numerical similarity"
            value={summary.numericalSimilarityScore !== null ? summary.numericalSimilarityScore.toFixed(2) : "N/A"}
            helper={summary.numericalSimilarityScore !== null ? "Mean diff, KS test, Wasserstein" : "No numerical metric selected"}
            tone={scoreTone(summary.numericalSimilarityScore)}
          />
          <SummaryCard
            label="Categorical similarity"
            value={summary.categoricalSimilarityScore !== null ? summary.categoricalSimilarityScore.toFixed(2) : "N/A"}
            helper={summary.categoricalSimilarityScore !== null ? "Chi-square, category proportions" : "No categorical metric selected"}
            tone={scoreTone(summary.categoricalSimilarityScore)}
          />
          <SummaryCard
            label="Relationship similarity"
            value={summary.relationshipSimilarityScore !== null ? summary.relationshipSimilarityScore.toFixed(2) : "N/A"}
            helper={summary.relationshipSimilarityScore !== null ? "Correlation difference across variables" : "Correlation metric not selected"}
            tone={scoreTone(summary.relationshipSimilarityScore)}
          />
          <SummaryCard
            label="Variables analysed"
            value={summary.variablesAnalyzed}
            helper="Selected on the Setup page"
          />
          <SummaryCard
            label="Metrics used"
            value={summary.metricsUsed}
            helper={`Run ID: ${evaluationResult.runId}`}
          />
        </div>
      </PageSection>

      {/* ── Section 2: Analysis context ────────────────────────────────────── */}
      <SectionCard
        title="Analysis context"
        subtitle="Dataset pair and evaluation configuration for this run."
      >
        {/* Dataset pair */}
        <div className="context-dataset-row">
          <span className="context-dataset-label">Real dataset</span>
          <strong>{analysisContext.realDatasetName}</strong>
          <span className="context-dataset-sep">vs</span>
          <span className="context-dataset-label">Synthetic dataset</span>
          <strong>{analysisContext.syntheticDatasetName}</strong>
        </div>

        {/* Selected variables */}
        <div className="context-section">
          <p className="context-section-label">Selected variables</p>
          <div className="context-chip-list">
            {analysisContext.selectedVariables.map((v) => (
              <span key={v} className="context-chip">{v}</span>
            ))}
          </div>
        </div>

        {/* Selected metrics */}
        <div className="context-section">
          <p className="context-section-label">Selected metrics</p>
          <div className="context-chip-list">
            {analysisContext.selectedMetrics.map((m) => (
              <span key={m} className="context-chip metric">{metricLabel(m)}</span>
            ))}
          </div>
        </div>

        {/* Auto-generated reminders */}
        <div className="context-section">
          <p className="context-section-label">Evaluation notes</p>
          <ul className="reminder-list">
            {reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* ── Section 4: Metric matrix heatmap ───────────────────────────────── */}
      <SectionCard
        title="Metric matrix"
        subtitle="Each cell shows the normalised similarity score for one variable × metric pair. Grey cells mean the metric does not apply to that variable type."
      >
        <MetricHeatmap matrix={metricMatrix} />
      </SectionCard>


      {/* ── Section 3: Variable ranking + Radar chart ──────────────────────── */}
      <div className="two-column-grid narrow-right">

        {/* Left: sortable / filterable ranking table */}
        <SectionCard
          title="Variable ranking"
          subtitle="Sorted by importance score. Click a row to view its distribution detail."
        >
          {/* Filter and sort controls */}
          <div className="ranking-controls">
            <div className="ranking-filters">
              <select
                className="ranking-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
              >
                <option value="all">All types</option>
                <option value="numerical">Numerical only</option>
                <option value="categorical">Categorical only</option>
              </select>
              <select
                className="ranking-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              >
                <option value="all">All statuses</option>
                <option value="good">Good</option>
                <option value="moderate">Moderate</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div className="ranking-sort-group">
              <span className="ranking-sort-label">Sort by</span>
              <button
                className={`ranking-sort-btn${sortBy === "importanceScore" ? " active" : ""}`}
                onClick={() => setSortBy("importanceScore")}
              >
                Importance
              </button>
              <button
                className={`ranking-sort-btn${sortBy === "similarityScore" ? " active" : ""}`}
                onClick={() => setSortBy("similarityScore")}
              >
                Similarity
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="data-table ranking-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Type</th>
                  <th>Importance</th>
                  <th>Similarity</th>
                  <th>Status</th>
                  <th>Top metric</th>
                </tr>
              </thead>
              <tbody>
                {filteredRanking.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-empty-cell">No variables match the current filter.</td>
                  </tr>
                ) : filteredRanking.map((row) => (
                  <tr
                    key={row.variable}
                    className={`ranking-row clickable${activeVariable === row.variable ? " selected" : ""}`}
                    onClick={() => setSelectedVariable(row.variable)}
                    title={detailViews[row.variable] ? "Click to view distribution detail" : "No distribution chart available for this variable"}
                  >
                    <td><strong>{row.variable}</strong></td>
                    <td>
                      <StatusBadge tone={row.type === "numerical" ? "info" : "success"}>
                        {row.type}
                      </StatusBadge>
                    </td>
                    <td>{row.importanceScore.toFixed(2)}</td>
                    <td>{row.similarityScore.toFixed(2)}</td>
                    <td>
                      <StatusBadge tone={statusTone(row.status)}>
                        {row.status}
                      </StatusBadge>
                    </td>
                    <td className="top-metric-cell">{metricLabel(row.topContributingMetric)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Right: radar chart */}
        <SectionCard
          title="Similarity overview"
          subtitle="Shape shows which dimension of similarity is strongest or weakest."
        >
          <div className="radar-center">
            <RadarChart
              axes={[
                { label: "Overall",      value: summary.overallSimilarityScore },
                { label: "Numerical",    value: summary.numericalSimilarityScore },
                { label: "Categorical",  value: summary.categoricalSimilarityScore },
                { label: "Relationship", value: summary.relationshipSimilarityScore },
              ]}
            />
          </div>
        </SectionCard>
      </div>



      {/* ── Section 5: Variable detail panel ───────────────────────────────── */}
      <div className="two-column-grid">

        {/* Left: distribution comparison chart */}
        <SectionCard
          title={`Distribution — ${activeVariable || "—"}`}
          subtitle={selectedDetail?.title ?? (activeVariable ? "No distribution chart available for this variable." : "Select a variable from the ranking table above.")}
        >
          {selectedDetail ? (
            <ComparisonChart
              points={chartPoints}
            />
          ) : (
            <p className="muted-copy">
              {activeVariable
                ? `${activeVariable} does not have a distribution chart in this run. Select another variable.`
                : "Click any row in the ranking table to view its distribution."}
            </p>
          )}
        </SectionCard>

        {/* Right: per-metric scores for selected variable */}
        <SectionCard
          title={`Metric scores — ${activeVariable || "—"}`}
          subtitle="Raw statistic and normalised score for each metric applied to this variable."
        >
          {selectedDetail ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Raw value</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedDetail.metrics.map((m) => (
                  <tr key={m.name}>
                    <td>{metricLabel(m.name)}</td>
                    <td>{m.value.toFixed(3)}</td>
                    <td>{m.normalizedScore.toFixed(2)}</td>
                    <td>
                      <StatusBadge tone={scoreTone(m.normalizedScore)}>
                        {m.normalizedScore >= 0.8 ? "good" : m.normalizedScore >= 0.6 ? "moderate" : "poor"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted-copy">
              {activeVariable
                ? `No metric breakdown available for ${activeVariable}.`
                : "Click any row in the ranking table to view metric scores."}
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── Section 6: Insights ────────────────────────────────────────────── */}
      <SectionCard
        title="Key insights"
        subtitle="Auto-generated observations from this evaluation run."
      >
        <ul className="insight-list plain">
          {insights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Page actions ──────────────────────────────────────────────────── */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("setup")}>
          Back to Setup
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={() => goToPage("saved")}>
          View Saved Runs
        </PrimaryButton>
        <PrimaryButton onClick={onSaveComparison}>
          Save Comparison
        </PrimaryButton>
      </div>
    </div>
  );
}
