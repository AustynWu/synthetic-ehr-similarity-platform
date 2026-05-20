// DistributionChart.tsx — distribution comparison chart (Plotly)
//
// Numerical (histogram):
//   barmode "overlay" — Real and Synthetic bars at the same x position.
//   x = bin midpoint, width = bin width → each bar spans the full bin range.
//   Smooth spline lines connect bar tops to show distribution shape.
//   Custom tooltip: white bg, Real in blue, Synthetic in orange, both shown at once.
//
// Categorical:
//   barmode "group" — side-by-side bars per category.

import { useState } from "react";
import Plot from "react-plotly.js";
import type { ChartPoint } from "../../types/contracts";

const REAL_COLOR      = "#2563eb";
const SYNTHETIC_COLOR = "#f97316";

const PLOTLY_CONFIG = {
  displayModeBar: false,
  responsive: true,
};

const BASE_LAYOUT = {
  paper_bgcolor: "transparent",
  plot_bgcolor:  "transparent",
  margin: { t: 30, r: 20, b: 40, l: 55 },
  legend: {
    orientation: "h" as const,
    x: 0,
    y: 1.18,
    bgcolor: "transparent",
    font: { size: 12 },
  },
  font:   { size: 11, family: "inherit" },
  height: 280,
};

interface TooltipState {
  realPct: number;
  realN: number;
  synPct: number;
  synN: number;
  x: number;
  y: number;
}

export default function DistributionChart({ points }: { points: ChartPoint[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const isHistogram = points.length > 0 && points[0].binLeft != null;

  // ── Numerical / histogram mode ────────────────────────────────────────────
  if (isHistogram) {
    const leftEdge  = points[0].binLeft!;
    const rightEdge = points[points.length - 1].binRight!;

    // x = midpoint so each bar is centered within its bin.
    const midpoints = points.map((p) => (p.binLeft! + p.binRight!) / 2);
    const binWidths = points.map((p) => p.binRight! - p.binLeft!);

    // Ticks at bin left edges so labels align with bar boundaries.
    const tickvals = [...points.map((p) => p.binLeft!), rightEdge];
    const ticktext  = tickvals.map((v) => String(Math.round(v)));

    return (
      <>
        <Plot
          data={[
            // Overlapping bars — hoverinfo "none" so Plotly shows no tooltip;
            // the custom tooltip div below handles display.
            {
              type: "bar",
              name: "Real",
              x: midpoints,
              y: points.map((p) => p.realValue),
              width: binWidths,
              opacity: 0.5,
              marker: { color: REAL_COLOR },
              hoverinfo: "none",
            },
            {
              type: "bar",
              name: "Synthetic",
              x: midpoints,
              y: points.map((p) => p.syntheticValue),
              width: binWidths,
              opacity: 0.5,
              marker: { color: SYNTHETIC_COLOR },
              hoverinfo: "none",
            },
            // Smooth lines connecting bar tops to show distribution shape.
            {
              type: "scatter",
              mode: "lines",
              name: "Real",
              x: midpoints,
              y: points.map((p) => p.realValue),
              line: { color: REAL_COLOR, width: 2, shape: "spline", smoothing: 0.8 },
              showlegend: false,
              hoverinfo: "skip",
            },
            {
              type: "scatter",
              mode: "lines",
              name: "Synthetic",
              x: midpoints,
              y: points.map((p) => p.syntheticValue),
              line: { color: SYNTHETIC_COLOR, width: 2, shape: "spline", smoothing: 0.8 },
              showlegend: false,
              hoverinfo: "skip",
            },
          ]}
          layout={{
            ...BASE_LAYOUT,
            barmode: "overlay",
            bargap: 0,
            xaxis: {
              tickvals,
              ticktext,
              range: [leftEdge, rightEdge],
              showspikes: false,
            },
            yaxis: {
              tickformat: ".0%",
              showspikes: false,
            },
          }}
          config={PLOTLY_CONFIG}
          style={{ width: "100%" }}
          useResizeHandler
          onHover={(data) => {
            const pt = data.points.find((p: any) => p.curveNumber === 0 || p.curveNumber === 1);
            if (!pt) return;
            const idx = (pt as any).pointIndex as number;
            if (idx == null || !points[idx]) return;
            setTooltip({
              realPct: points[idx].realValue,
              realN:   points[idx].realCount ?? 0,
              synPct:  points[idx].syntheticValue,
              synN:    points[idx].syntheticCount ?? 0,
              x: (data.event as MouseEvent).clientX,
              y: (data.event as MouseEvent).clientY,
            });
          }}
          onUnhover={() => setTooltip(null)}
        />

        {tooltip && (
          <div style={{
            position: "fixed",
            left: tooltip.x + 14,
            top:  tooltip.y - 8,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            lineHeight: 1.7,
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            <div style={{ color: REAL_COLOR }}>
              Real: {(tooltip.realPct * 100).toFixed(1)}% (n={tooltip.realN})
            </div>
            <div style={{ color: SYNTHETIC_COLOR }}>
              Synthetic: {(tooltip.synPct * 100).toFixed(1)}% (n={tooltip.synN})
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Categorical mode ──────────────────────────────────────────────────────
  return (
    <Plot
      data={[
        {
          type: "bar",
          name: "Real",
          x: points.map((p) => p.label),
          y: points.map((p) => p.realValue),
          opacity: 0.7,
          marker: { color: REAL_COLOR },
          customdata: points.map((p) => [p.realCount ?? 0]),
          hovertemplate: "%{x}<br>Real: %{y:.1%} (n=%{customdata[0]})<extra></extra>",
        },
        {
          type: "bar",
          name: "Synthetic",
          x: points.map((p) => p.label),
          y: points.map((p) => p.syntheticValue),
          opacity: 0.7,
          marker: { color: SYNTHETIC_COLOR },
          customdata: points.map((p) => [p.syntheticCount ?? 0]),
          hovertemplate: "%{x}<br>Synthetic: %{y:.1%} (n=%{customdata[0]})<extra></extra>",
        },
      ]}
      layout={{
        ...BASE_LAYOUT,
        barmode: "group",
        xaxis: {
          type: "category",
          tickangle: points.length > 7 ? -35 : 0,
        },
        yaxis: {
          tickformat: ".0%",
        },
      }}
      config={PLOTLY_CONFIG}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
