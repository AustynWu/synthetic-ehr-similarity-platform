// ========================================================
// RadarChart.tsx — SVG radar chart for 4-axis similarity scores
// ========================================================
// Renders a diamond-shaped radar chart with:
//   - 4 concentric grid squares at 25 / 50 / 75 / 100 %
//   - 4 axis lines from center to each corner
//   - A filled polygon showing the actual scores
//   - Labels and score values at each axis tip
//
// Layout (clockwise from top):
//   Top    = Overall
//   Right  = Numerical
//   Bottom = Categorical
//   Left   = Relationship
//
// Null values (metric not selected) render as 0 on that axis.
// ========================================================

const CX = 130; // SVG center x  (viewBox 260 wide)
const CY = 130; // SVG center y  (viewBox 260 tall)
const R  = 72;  // max radius (= 100%)

// Convert (angle in degrees, radius) to SVG x/y.
// Angle 0 points up (north), then clockwise.
function polarPt(angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

// 4 axes are evenly spaced at 90° each, starting from top
const AXIS_ANGLES = [0, 90, 180, 270];

// Where to anchor labels relative to each axis tip
const LABEL_ANCHORS = [
  { textAnchor: "middle" as const, dx: 0,   dy: -8  }, // top
  { textAnchor: "start"  as const, dx: 8,   dy: 4   }, // right
  { textAnchor: "middle" as const, dx: 0,   dy: 16  }, // bottom
  { textAnchor: "end"    as const, dx: -8,  dy: 4   }, // left
];

export interface RadarAxis {
  label: string;
  value: number | null; // null = metric not selected
}

export default function RadarChart({ axes }: { axes: RadarAxis[] }) {
  // Grid polygons at 25 / 50 / 75 / 100% radius
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((level) =>
    AXIS_ANGLES.map((a) => polarPt(a, level * R))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ")
  );

  // Data polygon — null values fall back to 0
  const dataPts = axes.map((axis, i) => polarPt(AXIS_ANGLES[i], (axis.value ?? 0) * R));
  const dataPolygon = dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Axis line endpoints (at 100%)
  const axisEnds = AXIS_ANGLES.map((a) => polarPt(a, R));

  // Label positions (placed outside the max radius with enough margin)
  const labelPts = AXIS_ANGLES.map((a) => polarPt(a, R + 26));

  return (
    <div className="radar-wrapper">
      <svg viewBox="0 0 260 260" width="100%" overflow="visible" style={{ display: "block" }}>
        {/* Grid squares */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        {/* Percentage labels on the vertical axis (right side) */}
        {gridLevels.map((level, i) => {
          const pt = polarPt(0, level * R);
          return (
            <text
              key={i}
              x={pt.x + 4}
              y={pt.y}
              fontSize="9"
              fill="#94a3b8"
              textAnchor="start"
              dominantBaseline="middle"
            >
              {Math.round(level * 100)}%
            </text>
          );
        })}

        {/* Axis lines */}
        {axisEnds.map((end, i) => (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={end.x.toFixed(1)}
            y2={end.y.toFixed(1)}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon — filled area */}
        <polygon
          points={dataPolygon}
          fill="rgba(37, 99, 235, 0.18)"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Score dots at each axis point */}
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill="#2563eb" />
        ))}

        {/* Axis labels and score values */}
        {axes.map((axis, i) => {
          const lp = labelPts[i];
          const anchor = LABEL_ANCHORS[i];
          const displayValue = axis.value !== null ? axis.value.toFixed(2) : "N/A";
          return (
            <g key={i}>
              <text
                x={(lp.x + anchor.dx).toFixed(1)}
                y={(lp.y + anchor.dy - 8).toFixed(1)}
                fontSize="10"
                fontWeight="600"
                fill="#0f172a"
                textAnchor={anchor.textAnchor}
              >
                {axis.label}
              </text>
              <text
                x={(lp.x + anchor.dx).toFixed(1)}
                y={(lp.y + anchor.dy + 4).toFixed(1)}
                fontSize="10"
                fill="#526072"
                textAnchor={anchor.textAnchor}
              >
                {displayValue}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
