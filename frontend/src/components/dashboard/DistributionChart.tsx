// DistributionChart.tsx — distribution comparison chart (Recharts)
//
// Two modes depending on the data received:
//
//   Histogram mode (numerical variables):
//     Points carry binLeft + binRight — draw a true histogram with a numerical
//     x-axis. Bar position = bin midpoint; bar width calculated from container
//     width so bars fill the full axis without overlapping.
//
//   Categorical mode (categorical variables):
//     Points have no binLeft/binRight — draw a grouped bar chart with a
//     categorical x-axis. Existing behaviour unchanged.

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { ChartPoint } from "../../types/contracts";

const REAL_COLOR      = "#2563eb"; // blue
const SYNTHETIC_COLOR = "#f97316"; // orange

// Left and right margins inside the ComposedChart — must match the margin prop below.
const CHART_MARGIN_LEFT  = 0;
const CHART_MARGIN_RIGHT = 24;
// Width reserved for the YAxis tick labels.
const Y_AXIS_WIDTH = 42;

// Custom tooltip — works for both histogram and categorical mode.
// For histogram bins, reads the readable range string from payload.label
// (e.g. "13–26") rather than showing the raw midpoint number.
function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload as { label?: string; realCount?: number; syntheticCount?: number };
  const displayLabel = raw?.label ?? "";
  // Bar and Line share the same dataKey, so Recharts sends each name twice.
  // Keep only the first entry per name.
  const seen = new Set<string>();
  const unique = payload.filter((entry) => {
    if (seen.has(entry.name ?? "")) return false;
    seen.add(entry.name ?? "");
    return true;
  });
  const realVal = unique.find((e) => e.name === "Real")?.value ?? null;
  const synVal  = unique.find((e) => e.name === "Synthetic")?.value ?? null;
  const delta   = realVal !== null && synVal !== null ? synVal - realVal : null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{displayLabel}</p>
      {unique.map((entry) => {
        const count = entry.name === "Real" ? raw?.realCount : raw?.syntheticCount;
        return (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {((entry.value ?? 0) * 100).toFixed(1)}%
            {count != null ? ` (n=${count.toLocaleString()})` : ""}
          </p>
        );
      })}
      {delta !== null && (
        <p style={{ color: "#64748b", fontSize: "0.85em" }}>
          Δ: {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function formatTick(v: number): string {
  return String(Math.round(v));
}

export default function DistributionChart({ points }: { points: ChartPoint[] }) {
  // Track container width so we can compute the exact bar pixel size.
  const [containerWidth, setContainerWidth] = useState(600);

  // Histogram mode: binLeft present on the first point means all points are numerical bins.
  const isHistogram = points.length > 0 && points[0].binLeft != null;

  if (isHistogram) {
    const leftEdge  = points[0].binLeft!;
    const rightEdge = points[points.length - 1].binRight!;
    const binCount  = points.length;

    // Calculate how many pixels are available for the bars, then size each bar
    // to fill its slot with a 1px gap between adjacent bars.
    const usable = containerWidth - Y_AXIS_WIDTH - CHART_MARGIN_LEFT - CHART_MARGIN_RIGHT;
    const barSize = Math.max(2, Math.floor(usable / binCount) - 1);

    // Place one tick at each bin edge (left edges + the final right edge).
    const ticks = points.map((p) => p.binLeft!).concat([rightEdge]);

    // Recharts needs the x-position as a numeric field — use the bin midpoint.
    const data = points.map((p) => ({
      binMidpoint:    (p.binLeft! + p.binRight!) / 2,
      label:          p.label,
      Real:           p.realValue,
      Synthetic:      p.syntheticValue,
      realCount:      p.realCount,
      syntheticCount: p.syntheticCount,
    }));

    return (
      <ResponsiveContainer
        width="100%"
        height={280}
        onResize={(w) => setContainerWidth(w)}
      >
        <ComposedChart
          data={data}
          margin={{ top: 8, right: CHART_MARGIN_RIGHT, bottom: 4, left: CHART_MARGIN_LEFT }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          {/* Numerical x-axis: bars positioned by binMidpoint, ticks at bin edges */}
          <XAxis
            type="number"
            dataKey="binMidpoint"
            domain={[leftEdge, rightEdge]}
            ticks={ticks}
            tickFormatter={formatTick}
            tick={{ fontSize: 11 }}
            height={24}
          />

          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11 }}
            width={Y_AXIS_WIDTH}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="square" verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />

          {/* Histogram bars — semi-transparent so overlap is visible */}
          <Bar dataKey="Real"      fill={REAL_COLOR}      fillOpacity={0.55} stroke={REAL_COLOR}      strokeWidth={0.5} barSize={barSize} legendType="square" isAnimationActive={false} />
          <Bar dataKey="Synthetic" fill={SYNTHETIC_COLOR} fillOpacity={0.55} stroke={SYNTHETIC_COLOR} strokeWidth={0.5} barSize={barSize} legendType="square" isAnimationActive={false} />

          {/* KDE approximation lines on top of the bars */}
          <Line dataKey="Real"      stroke={REAL_COLOR}      strokeWidth={2} dot={false} type="monotone" legendType="none" isAnimationActive={false} />
          <Line dataKey="Synthetic" stroke={SYNTHETIC_COLOR} strokeWidth={2} dot={false} type="monotone" legendType="none" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Categorical mode — original implementation unchanged.
  const data = points.map((p) => ({
    label:          p.label,
    Real:           p.realValue,
    Synthetic:      p.syntheticValue,
    realCount:      p.realCount,
    syntheticCount: p.syntheticCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        barCategoryGap="0%"
        barGap={1}
        margin={{ top: 8, right: 24, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={points.length > 7 ? -35 : 0}
          textAnchor={points.length > 7 ? "end" : "middle"}
          height={points.length > 7 ? 48 : 24}
        />

        <YAxis
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          tick={{ fontSize: 11 }}
          width={Y_AXIS_WIDTH}
        />

        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="square" verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />

        <Bar dataKey="Real"      fill={REAL_COLOR}      fillOpacity={0.55} stroke={REAL_COLOR}      strokeWidth={0.5} legendType="square" isAnimationActive={false} />
        <Bar dataKey="Synthetic" fill={SYNTHETIC_COLOR} fillOpacity={0.55} stroke={SYNTHETIC_COLOR} strokeWidth={0.5} legendType="square" isAnimationActive={false} />

        <Line dataKey="Real"      stroke={REAL_COLOR}      strokeWidth={2} dot={false} type="monotone" legendType="none" isAnimationActive={false} />
        <Line dataKey="Synthetic" stroke={SYNTHETIC_COLOR} strokeWidth={2} dot={false} type="monotone" legendType="none" isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
