// ComparisonChart.tsx — grouped bar chart for categorical variables (Recharts)
//
// Shows real vs synthetic proportions side-by-side for each category.
// Used for: gender, readmitted, insulin, A1Cresult, time_in_hospital, etc.
//
// Backend integration: replace props.points with API response series data.
// Data shape (label / realValue / syntheticValue) matches DetailViewSeries.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { ChartPoint } from "../../types/contracts";

const REAL_COLOR      = "#2563eb"; // blue — matches DistributionChart
const SYNTHETIC_COLOR = "#f97316"; // orange — matches DistributionChart

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

export default function ComparisonChart({ points }: { points: ChartPoint[] }) {
  const data = points.map((p) => ({
    label:     p.label,
    Real:      p.realValue,
    Synthetic: p.syntheticValue,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        barCategoryGap="30%"
        barGap={4}
        margin={{ top: 8, right: 24, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={points.length > 6 ? -30 : 0}
          textAnchor={points.length > 6 ? "end" : "middle"}
          height={points.length > 6 ? 48 : 24}
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

        <Bar dataKey="Real"      fill={REAL_COLOR}      fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Synthetic" fill={SYNTHETIC_COLOR} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
