// RunDetailPage.tsx — Full report view for one saved comparison run
//
// Structure (matches supervisor requirement of Univariate / Multivariate separation):
//
//   Section 1 : Summary — scores, dataset info, selected variables & metrics
//   Section 2 : Univariate Numerical — one card per numerical variable (chart + metric table)
//   Section 3 : Univariate Categorical — one card per categorical variable (chart + metric table)
//   Section 4 : Multivariate Numerical–Numerical — correlation top-5 table + difference heatmap
//   Section 5 : Multivariate Categorical–Categorical — Cramér's V top-5 table + difference heatmap
//   Section 6 : Mixed Analysis — group-wise summary table
//   Section 7 : Key Insights
//
// Print behaviour: window.print() hides navigation, renders all cards.
// Each variable card has page-break-inside: avoid so it never splits across pages.

import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import ComparisonChart from "../components/dashboard/ComparisonChart";
import DistributionChart from "../components/dashboard/DistributionChart";
import MetricHeatmap from "../components/dashboard/MetricHeatmap";
import CorrelationHeatmap from "../components/dashboard/CorrelationHeatmap";
import CramersVHeatmap from "../components/dashboard/CramersVHeatmap";
import { availableMetrics } from "../services/evaluationService";
import { getVariableDisplayName } from "../utils/variableNames";
import type {
  EvaluationResult,
  SavedComparison,
  SharedPageProps,
  StatusTone,
  VariableRankingItem,
} from "../types/contracts";

function metricLabel(key: string): string {
  return availableMetrics.find((m) => m.key === key)?.label ?? key;
}

function metricExplanation(key: string): string {
  const map: Record<string, string> = {
    mean_difference:                  "Compares the average value of each variable. Score closer to 1 means synthetic and real means are similar.",
    ks_test:                          "Compares the full distribution shape, not just the average. Score closer to 1 means the distributions are more similar.",
    wasserstein_distance:             "Measures how much the synthetic distribution needs to shift to match the real one. Score closer to 1 means less shifting needed.",
    chi_square:                       "Checks if category frequencies match between real and synthetic data. Score closer to 1 means more similar.",
    category_proportion_difference:   "Compares how common each category is. Score closer to 1 means proportions are more similar.",
    correlation_difference:           "Checks if pairs of numerical variables have similar correlations in both datasets. Score closer to 1 means relationships are better preserved.",
    cramers_v_comparison:             "Checks if pairs of categorical variables have similar associations in both datasets. Score closer to 1 means associations are better preserved.",
    numerical_categorical_association:"Checks if numerical variables behave the same across category groups. Score closer to 1 means group patterns are better preserved.",
  };
  return map[key] ?? "";
}

function scoreTone(score: number | null): StatusTone {
  if (score === null) return "info";
  if (score >= 0.85)  return "success";
  if (score >= 0.70)  return "warning";
  return "danger";
}

// One variable card: chart on top, metric score table below.
// Used for both numerical and categorical variables.
function VariableCard({ v, detailViews }: {
  v: VariableRankingItem;
  detailViews: EvaluationResult["detailViews"];
}) {
  const detail = detailViews[v.variable];
  if (!detail) return null;

  const chartPoints = detail.series.map((s) => ({
    label:          s.label,
    realValue:      s.real,
    syntheticValue: s.synthetic,
    binLeft:        s.binLeft,
    binRight:       s.binRight,
    realCount:      s.realCount,
    syntheticCount: s.syntheticCount,
  }));

  return (
    // page-break-inside: avoid keeps the card from splitting across PDF pages.
    <div className="detail-chart-card" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>

      {/* Header: variable name, type badge, similarity score */}
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
          <StatusBadge tone={v.type === "numerical" ? "info" : "success"}>
            {v.type}
          </StatusBadge>
          {/* HIDDEN — supervisor meeting 2026-05-23: normalized similarity score
              badge removed from variable card header. "No scores, no status." */}
          {false && (
            <StatusBadge tone={scoreTone(v.similarityScore)}>
              {v.similarityScore.toFixed(3)}
            </StatusBadge>
          )}
        </div>
      </div>

      {/* Distribution chart */}
      <div className="detail-chart-card-chart">
        {detail.chartType === "histogram_kde"
          ? <DistributionChart points={chartPoints} xAxisLabel={detail.xAxisLabel} yAxisLabel={detail.yAxisLabel} />
          : <ComparisonChart   points={chartPoints} yAxisLabel={detail.yAxisLabel} />
        }
      </div>

      {/* Per-metric scores table */}
      <table className="data-table detail-chart-metrics-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            {/* HIDDEN — supervisor meeting 2026-05-23: normalized score badge
                removed. Raw metric values are sufficient and more transparent.
                "No scores, no status." */}
            {false && <th>Score</th>}
          </tr>
        </thead>
        <tbody>
          {/* correlation_difference hidden here — it is a cross-variable metric
              and belongs in the multivariate section, not per-variable detail */}
          {detail.metrics.filter(m => m.name !== "correlation_difference").map((m) => (
            <tr key={m.name}>
              <td>{metricLabel(m.name)}</td>
              <td>{m.value.toFixed(3)}</td>
              {false && (
                <td>
                  <StatusBadge tone={scoreTone(m.normalizedScore)}>
                    {m.normalizedScore.toFixed(3)}
                  </StatusBadge>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportPDF(runName: string, dateLabel: string) {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, "_").replace(/_+/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `EHR-Similarity_${safe(runName)}_${date}`;
  const original = document.title;
  document.title = filename;
  window.addEventListener("afterprint", () => { document.title = original; }, { once: true });
  window.print();
}

export default function RunDetailPage({
  evaluationResult,
  savedComparison,
  goToPage,
}: Pick<SharedPageProps, "goToPage"> & {
  evaluationResult: EvaluationResult;
  savedComparison: SavedComparison;
}) {
  const {
    summary,
    analysisContext,
    variableRanking,
    metricMatrix,
    detailViews,
    insights,
    multivariateResults: mv,
  } = evaluationResult;

  // Split variables into numerical and categorical for separate sections.
  const numericalVars    = variableRanking.filter((v) => v.type === "numerical");
  const categoricalVars  = variableRanking.filter((v) => v.type === "categorical");

  return (
    <div className="page-stack run-detail-page">

      {/* ── Top actions (hidden when printing) ──────────────────────────────── */}
      <div className="page-actions no-print">
        <PrimaryButton variant="ghost" onClick={() => goToPage("saved")}>
          Back to Saved Runs
        </PrimaryButton>
        <PrimaryButton onClick={() => exportPDF(savedComparison.runName, savedComparison.createdAtLabel)}>
          Export PDF
        </PrimaryButton>
      </div>

      {/* ── Report header ────────────────────────────────────────────────────── */}
      <div className="run-detail-header">
        <h2 className="run-detail-title">{savedComparison.runName}</h2>
        <p className="run-detail-meta">
          {savedComparison.realDatasetName} vs {savedComparison.syntheticDatasetName}
          {" · "}{savedComparison.createdAtLabel}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — SUMMARY                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HIDDEN — supervisor meeting 2026-05-23:
          Averaging per-metric scores across all variables is misleading: a few
          well-performing variables can cancel out poorly-performing ones, giving
          a false sense of overall quality. The supervisor explicitly requested
          removing this section — "No scores, no status." Readers should interpret
          the raw per-variable results themselves rather than relying on a
          potentially deceptive aggregate. The underlying metricSummaries data is
          still computed by the backend and kept for SavedComparisons history. */}
      {false && (
        <PageSection
          title="Indicative Similarity Summary"
          description="These scores are statistical estimates only. They do not guarantee clinical equivalence or suitability for any specific use case."
        >
          {(["numerical", "categorical", "relationship"] as const).map((cat) => {
            const rows = summary.metricSummaries.filter((m) => m.category === cat);
            if (rows.length === 0) return null;
            const catLabel = cat === "numerical" ? "Numerical Similarity" : cat === "categorical" ? "Categorical Similarity" : "Relationship Similarity";
            const catNote = "Average score per metric across applicable variables";
            return (
              <div key={cat} style={{ marginTop: 20 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{catLabel}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>{catNote}</span>
                </div>
                <div className="summary-grid">
                  {rows.map((row) => {
                    const tone = scoreTone(row.averageScore);
                    const badgeLabel = row.averageScore >= 0.85 ? "Good" : row.averageScore >= 0.70 ? "Review" : "Poor";
                    return (
                      <SummaryCard
                        key={row.metric}
                        label={metricLabel(row.metric)}
                        value={row.averageScore.toFixed(3)}
                        badge={badgeLabel}
                        tone={tone}
                        helper={`${row.variableCount} variable${row.variableCount !== 1 ? "s" : ""}`}
                        tooltip={metricExplanation(row.metric)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </PageSection>
      )}

      {/* Dataset and config context */}
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — UNIVARIATE RESULTS                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="results-section-divider">
        <span className="results-section-label">Univariate Results</span>
        <span className="results-section-hint">Per-variable distribution comparison — chart and metric scores for each variable</span>
      </div>

      {/* Numerical variables */}
      {numericalVars.length > 0 && (
        <PageSection
          title="Numerical Variables"
          description="Distribution shape comparison using histogram plots."
        >
          <div className="detail-chart-grid">
            {numericalVars.map((v) => (
              <VariableCard key={v.variable} v={v} detailViews={detailViews} />
            ))}
          </div>
        </PageSection>
      )}

      {/* Categorical variables */}
      {categoricalVars.length > 0 && (
        <PageSection
          title="Categorical Variables"
          description="Category proportion comparison using grouped bar charts."
        >
          <div className="detail-chart-grid">
            {categoricalVars.map((v) => (
              <VariableCard key={v.variable} v={v} detailViews={detailViews} />
            ))}
          </div>
        </PageSection>
      )}

      {/* Metric matrix — summarises all variable × metric scores at a glance */}
      <SectionCard
        title="Metric Matrix"
        subtitle="Metric value for every variable × metric pair. Grey = metric does not apply."
      >
        <MetricHeatmap matrix={metricMatrix} />
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — MULTIVARIATE RESULTS                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="results-section-divider">
        <span className="results-section-label">Multivariate Results</span>
        <span className="results-section-hint">Cross-variable analysis — how well relationships between variables are preserved</span>
      </div>

      {/* Numerical–Numerical — condition changed to matrix check so the heatmap
          still shows even though the top-pairs table is now hidden. */}
      {mv?.realCorrelationMatrix && mv?.synCorrelationMatrix ? (
        <PageSection title="Numerical–Numerical Correlation">

          {/* HIDDEN — supervisor meeting 2026-05-23: Top pairs table removed.
              The three-panel heatmap already shows all pairwise Pearson r values.
              "The heat map is enough actually." Backend still computes the data. */}
          {false && mv.topCorrelationPairs?.length && (
            <SectionCard
              title="Top Changed Pairs"
              subtitle="Pearson r — top pairs by largest difference shown first."
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
                      <td>{p.realCorrelation.toFixed(3)}</td>
                      <td>{p.syntheticCorrelation.toFixed(3)}</td>
                      <td>
                        <StatusBadge tone={p.difference <= 0.05 ? "success" : p.difference <= 0.10 ? "warning" : "danger"}>
                          {p.difference.toFixed(3)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}

          <SectionCard
            title="Correlation Heatmap"
            subtitle="Three panels: Real Pearson r, Synthetic Pearson r, and absolute difference |Δr|. Hover any cell for exact values."
          >
            <CorrelationHeatmap
              variables={Object.keys(mv.realCorrelationMatrix)}
              realMatrix={mv.realCorrelationMatrix}
              synMatrix={mv.synCorrelationMatrix}
              note={mv.corrHeatmapNote}
            />
          </SectionCard>
        </PageSection>
      ) : null}

      {/* Categorical–Categorical — condition changed to matrix check so the heatmap
          still shows even though the top-pairs table is now hidden. */}
      {mv?.realCramersVMatrix && mv?.synCramersVMatrix ? (
        <PageSection title="Categorical–Categorical Association">

          {/* HIDDEN — supervisor meeting 2026-05-23: Top pairs table removed.
              The three-panel heatmap already shows all pairwise Cramér's V values.
              "The heat map is enough actually." Backend still computes the data. */}
          {false && mv.topCramersVPairs?.length && (
            <SectionCard
              title="Top Changed Pairs"
              subtitle="Cramér's V — top pairs by largest difference shown first."
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
                      <td>{p.realCramersV.toFixed(3)}</td>
                      <td>{p.syntheticCramersV.toFixed(3)}</td>
                      <td>
                        <StatusBadge tone={p.difference <= 0.05 ? "success" : p.difference <= 0.10 ? "warning" : "danger"}>
                          {p.difference.toFixed(3)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}

          <SectionCard
            title="Cramér's V Heatmap"
            subtitle="Three panels: Real Cramér's V, Synthetic Cramér's V, and absolute difference |ΔV|. Hover any cell for exact values."
          >
            <CramersVHeatmap
              variables={Object.keys(mv.realCramersVMatrix)}
              realMatrix={mv.realCramersVMatrix}
              synMatrix={mv.synCramersVMatrix}
              note={mv.cramersVHeatmapNote}
            />
          </SectionCard>
        </PageSection>
      ) : null}

      {/* Mixed Analysis */}
      {mv?.topGroupwiseRows?.length ? (
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
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — KEY INSIGHTS                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Key insights section — hidden per supervisor instruction: no auto-generated suggestions shown in the report */}
      {false && insights?.length ? (
        <SectionCard
          title="Key Insights"
          subtitle="Auto-generated observations from this evaluation run."
        >
          <ul className="insight-list plain">
            {insights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Bottom actions (hidden when printing) ───────────────────────────── */}
      <div className="page-actions no-print">
        <PrimaryButton variant="ghost" onClick={() => goToPage("saved")}>
          Back to Saved Runs
        </PrimaryButton>
        <PrimaryButton onClick={() => exportPDF(savedComparison.runName, savedComparison.createdAtLabel)}>
          Export PDF
        </PrimaryButton>
      </div>

    </div>
  );
}
