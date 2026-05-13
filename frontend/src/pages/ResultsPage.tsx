// ========================================================
// ResultsPage.tsx — Indicative Similarity Summary
// ========================================================
// Five sections, from coarse to fine:
//   1. Summary cards     — top-level scores at a glance
//   2. Analysis context  — dataset pair, selected variables & metrics, reminders
//   3. Variable ranking  — sortable / filterable full-width table (Univariate section)
//   4. Metric matrix     — heatmap showing every variable × metric score (Multivariate section)
//   5. Detail panel      — comparison chart + metric breakdown for one variable
//   6. Insights          — auto-generated observations
//
// All data comes from evaluationResult (EvaluationResult type).
// No logic lives here — the page only renders what the backend provides.
// ========================================================

import { useState } from "react";
import PageSection from "../components/ui/PageSection";
import SummaryCard from "../components/ui/SummaryCard";
import SectionCard from "../components/ui/SectionCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import ChartCard from "../components/dashboard/ChartCard";
import ComparisonChart from "../components/dashboard/ComparisonChart";
import DistributionChart from "../components/dashboard/DistributionChart";
import MetricHeatmap from "../components/dashboard/MetricHeatmap";
import CorrelationHeatmap from "../components/dashboard/CorrelationHeatmap";
import CramersVHeatmap from "../components/dashboard/CramersVHeatmap";
import { availableMetrics } from "../services/evaluationService";
import { getVariableDisplayName } from "../utils/variableNames";
import { getChartType } from "../utils/chartType";
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

// Map backend status value to display label
function statusLabel(status: "good" | "moderate" | "poor"): string {
  if (status === "good")     return "Good";
  if (status === "moderate") return "Review";
  return "Poor";
}

// Map a 0-1 score to a badge tone for the summary cards
// Thresholds: ≥0.85 Good, 0.70–0.84 Review, <0.70 Poor
function scoreTone(score: number | null): StatusTone {
  if (score === null) return "info";
  if (score >= 0.85)  return "success";
  if (score >= 0.70)  return "warning";
  return "danger";
}

// ── Types for filter state ───────────────────────────────────────────────────
type FilterType = "all" | "numerical" | "categorical";
type FilterStatus = "all" | "good" | "moderate" | "poor";

// ── Component ────────────────────────────────────────────────────────────────
export default function ResultsPage({
  evaluationResult,
  goToPage,
  onSaveComparison,
  isLoading,
}: SharedPageProps & {
  onSaveComparison: () => void;
  isLoading?: boolean;
}) {

  // Hooks must be declared unconditionally — before any early return
  const [selectedVariable, setSelectedVariable] = useState<string>("");
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

  const { summary, analysisContext, reminders, variableRanking, metricMatrix, detailViews, insights, multivariateResults: mv } = evaluationResult;

  // Resolve which variable is currently shown in section 5.
  // Falls back to the first variable that has a detail view when nothing is selected yet.
  const firstWithDetail = variableRanking.find((v) => detailViews[v.variable])?.variable ?? "";
  const activeVariable  = selectedVariable || firstWithDetail;

  // ── Derived data ────────────────────────────────────────────────────────────

  // Apply filters then sort by similarity ascending (lowest = most divergent first)
  const filteredRanking: VariableRankingItem[] = variableRanking
    .filter((v) => filterType   === "all" || v.type   === filterType)
    .filter((v) => filterStatus === "all" || v.status === filterStatus)
    .sort((a, b) => a.similarityScore - b.similarityScore);

  // Currently shown detail view (may be undefined if variable has no chart)
  const selectedDetail = detailViews[activeVariable];

  // Determine chart type: use backend's chartType from the detail view when available.
  // Fall back to getChartType() if there is no detail view (e.g. variable not in detailViews).
  const activeVariableType = variableRanking.find((v) => v.variable === activeVariable)?.type ?? "unknown";
  const activeChartType = selectedDetail?.chartType ?? getChartType(activeVariable, activeVariableType);

  // Convert DetailViewSeries → ChartPoint; pass binLeft/binRight so DistributionChart can draw a proper histogram
  const chartPoints = selectedDetail?.series.map((s) => ({
    label:          s.label,
    realValue:      s.real,
    syntheticValue: s.synthetic,
    binLeft:        s.binLeft,
    binRight:       s.binRight,
    realCount:      s.realCount,
    syntheticCount: s.syntheticCount,
  })) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-stack">

      {/* ── Section 1: Summary cards ───────────────────────────────────────── */}
      <PageSection
        title="Indicative Similarity Summary"
        description="These scores are statistical estimates only. They do not guarantee clinical equivalence or suitability for any specific use case."
      >
        <div className="summary-grid">
          <SummaryCard
            label="Overall similarity"
            value={summary.overallSimilarityScore.toFixed(2)}
            helper="Combined score across all selected metrics and variables"
            badge={summary.overallSimilarityScore >= 0.85 ? "Good" : summary.overallSimilarityScore >= 0.70 ? "Review" : "Poor"}
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
            helper={
              summary.relationshipSimilarityScore === null
                ? "Correlation metric not selected"
                : summary.relationshipSimilarityScore >= 0.85
                ? "Correlation structure is well preserved across numerical variables"
                : summary.relationshipSimilarityScore >= 0.70
                ? "Some correlation patterns have shifted in the synthetic data"
                : "Significant correlation degradation — variable relationships differ from real"
            }
            tone={scoreTone(summary.relationshipSimilarityScore)}
          />
          <SummaryCard
            label="Variables analysed"
            value={`${summary.variablesAnalyzed} / ${summary.variablesSelected ?? summary.variablesAnalyzed}`}
            helper={
              summary.variablesAnalyzed < (summary.variablesSelected ?? summary.variablesAnalyzed)
                ? `${(summary.variablesSelected ?? summary.variablesAnalyzed) - summary.variablesAnalyzed} variable(s) had no applicable metric — check metric selection`
                : "All selected variables were scored"
            }
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
              <span key={v} className="context-chip" title={v}>
                {getVariableDisplayName(v)}
              </span>
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

      {/* ── Univariate Results ─────────────────────────────────────────────── */}
      <div className="results-section-divider">
        <span className="results-section-label">Univariate Results</span>
        <span className="results-section-hint">Per-variable similarity — how closely each individual variable matches between datasets</span>
      </div>

      {/* ── Section 3: Variable ranking (full-width) ───────────────────────── */}
      <SectionCard
        title="Variable ranking"
        subtitle="Variables sorted by similarity score. Click a row to view its distribution detail below."
      >
        {/* Filter controls */}
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
              <option value="moderate">Review</option>
              <option value="poor">Poor</option>
            </select>
          </div>
          <span className="ranking-sort-label">Sorted by similarity ↑ (lowest first)</span>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table className="data-table ranking-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Type</th>
                <th>Similarity</th>
                <th>Status</th>
                <th>Top metric</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty-cell">No variables match the current filter.</td>
                </tr>
              ) : filteredRanking.map((row) => (
                <tr
                  key={row.variable}
                  className={`ranking-row clickable${activeVariable === row.variable ? " selected" : ""}`}
                  onClick={() => setSelectedVariable(row.variable)}
                  title={detailViews[row.variable] ? "Click to view distribution detail" : "No distribution chart available for this variable"}
                >
                  <td>
                    <strong title={row.variable}>{getVariableDisplayName(row.variable)}</strong>
                    {row.realMissingRate >= 50 && (
                      <span className="status-badge warning missing-rate-badge">
                        ⚠ {row.realMissingRate}% missing
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge tone={row.type === "numerical" ? "info" : "success"}>
                      {row.type}
                    </StatusBadge>
                  </td>
                  <td>{row.similarityScore.toFixed(2)}</td>
                  <td>
                    <StatusBadge tone={statusTone(row.status)}>
                      {statusLabel(row.status)}
                    </StatusBadge>
                  </td>
                  <td className="top-metric-cell">{metricLabel(row.topContributingMetric)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Section 5: Variable detail panel ───────────────────────────────── */}
      <div className="two-column-grid">

        {/* Left: distribution comparison chart */}
        <ChartCard
          title={`Distribution — ${activeVariable ? getVariableDisplayName(activeVariable) : "—"}`}
          subtitle={selectedDetail?.title}
          xAxisLabel={selectedDetail?.xAxisLabel ?? "Value"}
          yAxisLabel={selectedDetail?.yAxisLabel ?? "Proportion"}
          hasData={!!selectedDetail}
          emptyMessage={
            activeVariable
              ? `${getVariableDisplayName(activeVariable)} does not have a distribution chart in this run. Select another variable.`
              : "Click any row in the ranking table to view its distribution."
          }
        >
          {activeChartType === "histogram_kde"
            ? <DistributionChart points={chartPoints} />
            : <ComparisonChart   points={chartPoints} />
          }
        </ChartCard>

        {/* Right: per-metric scores for selected variable */}
        <SectionCard
          title={`Metric scores — ${activeVariable ? getVariableDisplayName(activeVariable) : "—"}`}
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
                        {m.normalizedScore >= 0.85 ? "Good" : m.normalizedScore >= 0.70 ? "Review" : "Poor"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted-copy">
              {activeVariable
                ? `No metric breakdown available for ${getVariableDisplayName(activeVariable)}.`
                : "Click any row in the ranking table to view metric scores."}
            </p>
          )}
        </SectionCard>
      </div>

      {/* ── Multivariate Results ───────────────────────────────────────────── */}
      <div className="results-section-divider">
        <span className="results-section-label">Multivariate Results</span>
        <span className="results-section-hint">Cross-variable analysis — how well relationships and patterns between variables are preserved</span>
      </div>

      {/* ── Section 4: Metric matrix heatmap ───────────────────────────────── */}
      <SectionCard
        title="Metric matrix"
        subtitle="Each cell shows the normalised similarity score for one variable × metric pair. Grey cells mean the metric does not apply to that variable type."
      >
        <MetricHeatmap matrix={metricMatrix} />
      </SectionCard>

      {/* ── Multivariate placeholders ──────────────────────────────────────── */}

      {/* Numerical–Numerical — only shown when backend returns data */}
      {mv?.topCorrelationPairs?.length ? (
        <SectionCard
          title="Numerical–Numerical: Correlation Comparison"
          subtitle="Pearson r for variable pairs — top pairs by largest difference shown first."
        >
          <table className="data-table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Variable pair</th>
                <th>Real r</th>
                <th>Synthetic r</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {mv.topCorrelationPairs.map((p) => (
                <tr key={`${p.variable1}-${p.variable2}`}>
                  <td>{getVariableDisplayName(p.variable1)} × {getVariableDisplayName(p.variable2)}</td>
                  <td>{p.realCorrelation.toFixed(2)}</td>
                  <td>{p.syntheticCorrelation.toFixed(2)}</td>
                  <td>
                    <StatusBadge tone={p.difference <= 0.05 ? "success" : p.difference <= 0.10 ? "warning" : "danger"}>
                      {p.difference.toFixed(2)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      ) : null}

      {/* Correlation difference heatmap — shown when full matrices are available */}
      {mv?.realCorrelationMatrix && mv?.synCorrelationMatrix && (
        <SectionCard
          title="Numerical–Numerical: Correlation Difference Heatmap"
          subtitle="Each cell shows |real Pearson r − synthetic Pearson r|. Darker red = larger difference. Hover for exact values."
        >
          <CorrelationHeatmap
            variables={Object.keys(mv.realCorrelationMatrix)}
            realMatrix={mv.realCorrelationMatrix}
            synMatrix={mv.synCorrelationMatrix}
            note={mv.corrHeatmapNote}
          />
        </SectionCard>
      )}

      {/* Categorical–Categorical — only shown when backend returns data */}
      {mv?.topCramersVPairs?.length ? (
        <SectionCard
          title="Categorical–Categorical: Cramér's V Comparison"
          subtitle="Association strength for categorical variable pairs — top pairs by largest difference shown first."
        >
          <table className="data-table" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Variable pair</th>
                <th>Real V</th>
                <th>Synthetic V</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {mv.topCramersVPairs.map((p) => (
                <tr key={`${p.variable1}-${p.variable2}`}>
                  <td>{getVariableDisplayName(p.variable1)} × {getVariableDisplayName(p.variable2)}</td>
                  <td>{p.realCramersV.toFixed(2)}</td>
                  <td>{p.syntheticCramersV.toFixed(2)}</td>
                  <td>
                    <StatusBadge tone={p.difference <= 0.05 ? "success" : p.difference <= 0.10 ? "warning" : "danger"}>
                      {p.difference.toFixed(2)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      ) : null}

      {/* Cramér's V difference heatmap — shown when matrices are available */}
      {mv?.realCramersVMatrix && mv?.synCramersVMatrix && (
        <SectionCard
          title="Categorical–Categorical: Cramér's V Difference Heatmap"
          subtitle="Each cell shows |real Cramér's V − synthetic Cramér's V|. Darker red = larger difference. Hover for exact values."
        >
          <CramersVHeatmap
            variables={Object.keys(mv.realCramersVMatrix)}
            realMatrix={mv.realCramersVMatrix}
            synMatrix={mv.synCramersVMatrix}
            note={mv.cramersVHeatmapNote}
          />
        </SectionCard>
      )}

      {/* Mixed — always render the card so users know this section exists */}
      {(() => {
        const metricSelected = analysisContext.selectedMetrics.includes(
          "numerical_categorical_association"
        );

        if (mv?.topGroupwiseRows?.length) {
          // Data is available — show the table.
          return (
            <SectionCard
              title="Mixed Analysis: Group-wise Summary"
              subtitle="Mean of numerical variable per category group — top rows by largest difference shown first."
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Numerical variable</th>
                    <th>Grouped by</th>
                    <th>Real mean</th>
                    <th>Synthetic mean</th>
                    <th>Difference</th>
                    <th>% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {mv.topGroupwiseRows.map((r, i) => {
                    const pct = r.realMean !== 0
                      ? ((r.syntheticMean - r.realMean) / r.realMean * 100).toFixed(1)
                      : null;
                    return (
                      <tr key={i}>
                        <td>{getVariableDisplayName(r.numericalVariable)}</td>
                        <td>{getVariableDisplayName(r.categoricalVariable)}: {r.groupValue}</td>
                        <td>{r.realMean.toFixed(1)}</td>
                        <td>{r.syntheticMean.toFixed(1)}</td>
                        <td>{r.difference.toFixed(1)}</td>
                        <td>{pct !== null ? `${Number(pct) > 0 ? "+" : ""}${pct}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SectionCard>
          );
        }

        if (metricSelected) {
          // Metric was selected but no group had enough samples.
          return (
            <SectionCard
              title="Mixed Analysis: Group-wise Summary"
              subtitle="Mean of numerical variable per category group."
            >
              <p className="muted-copy">
                No group had enough samples (minimum 5 rows per group) to produce
                a reliable mean comparison. This can happen when category values
                are rare in one or both datasets.
              </p>
            </SectionCard>
          );
        }

        // Metric was not selected — guide the user to enable it.
        return (
          <SectionCard
            title="Mixed Analysis: Group-wise Summary"
            subtitle="Mean of numerical variable per category group."
          >
            <p className="muted-copy">
              Select <strong>Numerical–Categorical Association</strong> on the
              Setup page and re-run the evaluation to enable this analysis.
            </p>
          </SectionCard>
        );
      })()}

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
        <div className="page-actions-right">
          <PrimaryButton onClick={onSaveComparison} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Comparison"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
