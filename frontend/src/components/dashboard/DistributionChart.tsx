// DistributionChart.tsx — overlapping histogram + KDE curve (Recharts)
//
// Used for continuous and discrete numerical variables.
// Shows real vs synthetic distributions as overlapping semi-transparent bars
// with smooth KDE-approximation lines on top.
//
// Backend integration: replace props.points with API response series data.
// The data shape (label / realValue / syntheticValue) matches DetailViewSeries.

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

// Custom tooltip — shows both values as percentages
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {((entry.value ?? 0) * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export default function DistributionChart({ points }: { points: ChartPoint[] }) {
  // Recharts expects an array of plain objects
  const data = points.map((p) => ({
    label:     p.label,
    Real:      p.realValue,
    Synthetic: p.syntheticValue,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        barCategoryGap="0%"   // bins touch each other — histogram style
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
          width={42}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
        />

        {/* Histogram bars — semi-transparent so overlapping region is visible */}
        <Bar
          dataKey="Real"
          fill={REAL_COLOR}
          fillOpacity={0.55}
          stroke={REAL_COLOR}
          strokeWidth={0.5}
          legendType="square"
          isAnimationActive={false}
        />
        <Bar
          dataKey="Synthetic"
          fill={SYNTHETIC_COLOR}
          fillOpacity={0.55}
          stroke={SYNTHETIC_COLOR}
          strokeWidth={0.5}
          legendType="square"
          isAnimationActive={false}
        />

        {/* Smooth lines approximating KDE curves — hide from legend */}
        <Line
          dataKey="Real"
          stroke={REAL_COLOR}
          strokeWidth={2}
          dot={false}
          type="monotone"
          legendType="none"
          isAnimationActive={false}
        />
        <Line
          dataKey="Synthetic"
          stroke={SYNTHETIC_COLOR}
          strokeWidth={2}
          dot={false}
          type="monotone"
          legendType="none"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
