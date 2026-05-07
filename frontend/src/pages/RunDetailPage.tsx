// RunDetailPage.tsx — Full report view for one saved comparison run
//
// Shows all variable charts expanded at once (unlike ResultsPage which shows one at a time).
// Designed to be print-friendly: clicking "Export PDF" triggers window.print(),
// which hides navigation and renders all charts on the page.

import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import ComparisonChart from "../components/dashboard/ComparisonChart";
import DistributionChart from "../components/dashboard/DistributionChart";
import MetricHeatmap from "../components/dashboard/MetricHeatmap";
import { availableMetrics } from "../services/evaluationService";
import { getVariableDisplayName } from "../utils/variableNames";
import type { EvaluationResult, SavedComparison, SharedPageProps, StatusTone } from "../types/contracts";

function metricLabel(key: string): string {
  return availableMetrics.find((m) => m.key === key)?.label ?? key;
}

function scoreTone(score: number | null): StatusTone {
  if (score === null) return "info";
  if (score >= 0.85)  return "success";
  if (score >= 0.70)  return "warning";
  return "danger";
}

export default function RunDetailPage({
  evaluationResult,
  savedComparison,
  goToPage,
}: Pick<SharedPageProps, "goToPage"> & {
  evaluationResult: EvaluationResult;
  savedComparison: SavedComparison;
}) {
  const { summary, analysisContext, variableRanking, metricMatrix, detailViews, multivariateResults: mv } = evaluationResult;

  return (
    <div className="page-stack run-detail-page">

      {/* ── Top actions ─────────────────────────────────────────────────────── */}
      <div className="page-actions no-print">
        <PrimaryButton variant="ghost" onClick={() => goToPage("saved")}>
          Back to Saved Runs
        </PrimaryButton>
        <PrimaryButton onClick={() => window.print()}>
          Export PDF
        </PrimaryButton>
      </div>

      {/* ── Report header ────────────────────────────────────────────────────── */}
      <div className="run-detail-header">
        <h2 className="run-detail-title">{savedComparison.runName}</h2>
        <p className="run-detail-meta">
          {savedComparison.realDatasetName} vs {savedComparison.syntheticDatasetName} · {savedComparison.createdAtLabel}
        </p>
      </div>

      {/* ── Section 1: Summary cards ─────────────────────────────────────────── */}
      <PageSection title="Similarity Summary">
        <div className="summary-grid">
          <SummaryCard
            label="Overall similarity"
            value={summary.overallSimilarityScore.toFixed(2)}
            tone={scoreTone(summary.overallSimilarityScore)}
            badge={summary.overallSimilarityScore >= 0.85 ? "Good" : summary.overallSimilarityScore >= 0.70 ? "Review" : "Poor"}
          />
          <SummaryCard
            label="Numerical similarity"
            value={summary.numericalSimilarityScore !== null ? summary.numericalSimilarityScore.toFixed(2) : "N/A"}
            tone={scoreTone(summary.numericalSimilarityScore)}
          />
          <SummaryCard
            label="Categorical similarity"
            value={summary.categoricalSimilarityScore !== null ? summary.categoricalSimilarityScore.toFixed(2) : "N/A"}
            tone={scoreTone(summary.categoricalSimilarityScore)}
          />
          <SummaryCard
            label="Relationship similarity"
            value={summary.relationshipSimilarityScore !== null ? summary.relationshipSimilarityScore.toFixed(2) : "N/A"}
            tone={scoreTone(summary.relationshipSimilarityScore)}
          />
          <SummaryCard
            label="Variables analysed"
            value={`${summary.variablesAnalyzed} / ${summary.variablesSelected ?? summary.variablesAnalyzed}`}
            helper={
              summary.variablesAnalyzed < (summary.variablesSelected ?? summary.variablesAnalyzed)
                ? `${(summary.variablesSelected ?? summary.variablesAnalyzed) - summary.variablesAnalyzed} variable(s) had no applicable metric`
                : "All selected variables were scored"
            }
          />
          <SummaryCard label="Metrics used" value={summary.metricsUsed} />
        </div>
      </PageSection>

      {/* ── Section 2: Analysis context ──────────────────────────────────────── */}
      <SectionCard title="Analysis context" subtitle="Dataset pair and evaluation configuration for this run.">
        <div className="context-dataset-row">
          <span className="context-dataset-label">Real dataset</span>
          <strong>{analysisContext.realDatasetName}</strong>
          <span className="context-dataset-sep">vs</span>
          <span className="context-dataset-label">Synthetic dataset</span>
          <strong>{analysisContext.syntheticDatasetName}</strong>
        </div>
        <div className="context-section">
          <p className="context-section-label">Selected variables</p>
          <div className="context-chip-list">
            {analysisContext.selectedVariables.map((v) => (
              <span key={v} className="context-chip" title={v}>{getVariableDisplayName(v)}</span>
            ))}
          </div>
        </div>
        <div className="context-section">
          <p className="context-section-label">Selected metrics</p>
          <div className="context-chip-list">
            {analysisContext.selectedMetrics.map((m) => (
              <span key={m} className="context-chip metric">{metricLabel(m)}</span>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: All variable charts ───────────────────────────────────── */}
      <PageSection
        title="Variable Distribution Charts"
        description="All variables expanded — each card shows the distribution comparison and metric scores."
      >
        <div className="detail-chart-grid">
          {variableRanking.map((v) => {
            const detail = detailViews[v.variable];
            if (!detail) return null;

            const chartPoints = detail.series.map((s) => ({
              label: s.label,
              realValue: s.real,
              syntheticValue: s.synthetic,
            }));

            return (
              <div key={v.variable} className="detail-chart-card">
                {/* Card header */}
                <div className="detail-chart-card-header">
                  <div>
                    <strong title={v.variable}>{getVariableDisplayName(v.variable)}</strong>
                    {v.realMissingRate >= 50 && (
                      <span className="status-badge warning missing-rate-badge">
                        ⚠ {v.realMissingRate}% missing
                      </span>
                    )}
                  </div>
                  <div className="detail-chart-card-badges">
                    <StatusBadge tone={v.type === "numerical" ? "info" : "success"}>{v.type}</StatusBadge>
                    <StatusBadge tone={scoreTone(v.similarityScore)}>{v.similarityScore.toFixed(2)}</StatusBadge>
                  </div>
                </div>

                {/* Chart */}
                <div className="detail-chart-card-chart">
                  {detail.chartType === "histogram_kde"
                    ? <DistributionChart points={chartPoints} />
                    : <ComparisonChart points={chartPoints} />
                  }
                </div>

                {/* Metric scores */}
                <table className="data-table detail-chart-metrics-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.metrics.map((m) => (
                      <tr key={m.name}>
                        <td>{metricLabel(m.name)}</td>
                        <td>
                          <StatusBadge tone={scoreTone(m.normalizedScore)}>
                            {m.normalizedScore.toFixed(2)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </PageSection>

      {/* ── Section 4: Metric matrix ─────────────────────────────────────────── */}
      <SectionCard title="Metric matrix" subtitle="Normalised similarity score for each variable × metric pair.">
        <MetricHeatmap matrix={metricMatrix} />
      </SectionCard>

      {/* ── Section 5: Multivariate tables ───────────────────────────────────── */}
      {mv?.topCorrelationPairs?.length ? (
        <SectionCard title="Numerical–Numerical: Correlation Comparison">
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

      {mv?.topCramersVPairs?.length ? (
        <SectionCard title="Categorical–Categorical: Cramér's V Comparison">
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

      {mv?.topGroupwiseRows?.length ? (
        <SectionCard title="Mixed Analysis: Group-wise Summary">
          <table className="data-table">
            <thead>
              <tr><th>Numerical variable</th><th>Grouped by</th><th>Real mean</th><th>Synthetic mean</th><th>Difference</th><th>% Change</th></tr>
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
      ) : null}

      {/* ── Bottom actions ───────────────────────────────────────────────────── */}
      <div className="page-actions no-print">
        <PrimaryButton variant="ghost" onClick={() => goToPage("saved")}>
          Back to Saved Runs
        </PrimaryButton>
        <PrimaryButton onClick={() => window.print()}>
          Export PDF
        </PrimaryButton>
      </div>

    </div>
  );
}
