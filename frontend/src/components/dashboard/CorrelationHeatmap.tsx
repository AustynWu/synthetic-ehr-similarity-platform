// CorrelationHeatmap.tsx — difference heatmap for Numerical–Numerical correlation
//
// Shows abs(real Pearson r − synthetic Pearson r) for every variable pair.
// White = identical, deep red = large difference.
// Hover over any cell for exact real / synthetic / delta values.

import { useState } from "react";

const MAX_VARS = 12; // cap so the table stays readable in the UI

// Linear interpolation: white (diff=0) → red-600 (diff=1)
function diffColor(diff: number): string {
  const d = Math.min(Math.max(diff, 0), 1);
  const r = Math.round(255 - 35  * d);
  const g = Math.round(255 - 217 * d);
  const b = Math.round(255 - 217 * d);
  return `rgb(${r},${g},${b})`;
}

function shortName(v: string): string {
  return v.length > 14 ? v.slice(0, 12) + "…" : v;
}

interface Props {
  variables: string[];
  realMatrix: Record<string, Record<string, number>>;
  synMatrix:  Record<string, Record<string, number>>;
  // Plain-English explanation from the backend about which variables were
  // selected for this heatmap and why (activity-score logic).
  note?: string;
}

export default function CorrelationHeatmap({ variables, realMatrix, synMatrix, note }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const vars = variables.slice(0, MAX_VARS);

  if (vars.length < 2) {
    return (
      <p style={{ color: "#64748b", fontSize: 13 }}>
        At least 2 numerical variables are needed to display the correlation heatmap.
      </p>
    );
  }

  return (
    <div>
      {variables.length > MAX_VARS && (
        <p style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
          Showing first {MAX_VARS} of {variables.length} numerical variables.
        </p>
      )}

      {/* Variable-selection explanation from the backend */}
      {note && (
        <p style={{
          color: "#475569",
          fontSize: 12,
          marginBottom: 12,
          padding: "8px 12px",
          background: "#f8fafc",
          borderLeft: "3px solid #94a3b8",
          borderRadius: "0 4px 4px 0",
          lineHeight: 1.6,
        }}>
          {note}
        </p>
      )}

      <div className="diff-heatmap-wrapper" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {/* top-left corner spacer */}
              <th style={{ minWidth: 120 }} />
              {vars.map((v) => (
                <th
                  key={v}
                  title={v}
                  style={{
                    padding: "2px 4px",
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                    height: 95,
                    width: 40,
                    fontWeight: 500,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    verticalAlign: "bottom",
                  }}
                >
                  {shortName(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vars.map((rowVar) => (
              <tr key={rowVar}>
                <td
                  title={rowVar}
                  style={{
                    padding: "2px 10px",
                    textAlign: "right",
                    fontWeight: 500,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {shortName(rowVar)}
                </td>

                {vars.map((colVar) => {
                  const realR = realMatrix[rowVar]?.[colVar] ?? realMatrix[colVar]?.[rowVar] ?? null;
                  const synR  = synMatrix[rowVar]?.[colVar]  ?? synMatrix[colVar]?.[rowVar]  ?? null;

                  if (realR === null || synR === null) {
                    return (
                      <td
                        key={colVar}
                        style={{
                          background: "#f8fafc",
                          width: 40, height: 32,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    );
                  }

                  const diff = Math.abs(realR - synR);

                  return (
                    <td
                      key={colVar}
                      onMouseEnter={(e) =>
                        setTooltip({
                          text: `${rowVar} × ${colVar}\nReal r:  ${realR.toFixed(3)}\nSyn r:   ${synR.toFixed(3)}\n|Δr|:    ${diff.toFixed(3)}`,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        background: diffColor(diff),
                        width: 40, height: 32,
                        border: "1px solid #e2e8f0",
                        textAlign: "center",
                        fontSize: 11,
                        cursor: "default",
                        color: diff > 0.4 ? "#fff" : "#374151",
                        fontWeight: diff > 0.2 ? 600 : 400,
                      }}
                    >
                      {diff.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Color scale legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 10, fontSize: 11, color: "#64748b" }}>
        <span>|Δr|:</span>
        <span>Low</span>
        <div style={{
          width: 80,
          height: 10,
          background: "linear-gradient(to right, white, rgb(220,38,38))",
          border: "1px solid #e2e8f0",
          borderRadius: 2,
        }} />
        <span>High</span>
        <span style={{ marginLeft: 12, fontStyle: "italic" }}>
          Each cell = |real Pearson r − synthetic Pearson r|
        </span>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 14,
          top: tooltip.y - 8,
          background: "#1e293b",
          color: "#f8fafc",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 11,
          whiteSpace: "pre",
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          lineHeight: 1.7,
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
