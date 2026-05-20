// CramersVHeatmap.tsx — correlation similarity heatmap for Categorical–Categorical Cramér's V
//
// Each cell shows 1 − |real Cramér's V − synthetic Cramér's V|, i.e. how similar
// the two datasets' categorical association is for that variable pair.
// 1.00 = identical association (diagonal is always 1), 0.00 = completely different.
// White = low similarity, dark blue = high similarity.
// Hover over any cell for exact real V, synthetic V, and |ΔV| values.
//
// Variables shown are pre-selected by the backend using an activity score:
// only the variables that appear most often in high-difference pairs are included.
// The `note` prop contains a plain-English explanation from the backend.

import { useState } from "react";

// Linear interpolation: white (sim = 0) → blue-600 (sim = 1).
// Matches the same colour scale used in CorrelationHeatmap for visual consistency.
function simColor(sim: number): string {
  const s = Math.min(Math.max(sim, 0), 1);
  const r = Math.round(255 - 218 * s); // 255 → 37
  const g = Math.round(255 - 156 * s); // 255 → 99
  const b = Math.round(255 - 20  * s); // 255 → 235
  return `rgb(${r},${g},${b})`;
}

// Truncate long variable names so they fit in the column headers.
function shortName(v: string): string {
  return v.length > 14 ? v.slice(0, 12) + "…" : v;
}

interface Props {
  variables: string[];
  realMatrix: Record<string, Record<string, number>>;
  synMatrix:  Record<string, Record<string, number>>;
  // Plain-English explanation from the backend about which variables were
  // selected for this heatmap and why (e.g. activity-score logic).
  note?: string;
}

export default function CramersVHeatmap({ variables, realMatrix, synMatrix, note }: Props) {
  // Tooltip state — position follows the mouse so it never obscures the hovered cell.
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (variables.length < 2) {
    return (
      <p style={{ color: "#64748b", fontSize: 13 }}>
        At least 2 categorical variables are needed to display the Cramér's V heatmap.
      </p>
    );
  }

  return (
    <div>
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
              {/* Top-left corner — empty spacer cell */}
              <th style={{ minWidth: 120 }} />
              {variables.map((v) => (
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
            {variables.map((rowVar) => (
              <tr key={rowVar}>
                {/* Row label */}
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

                {variables.map((colVar) => {
                  // Look up value in both directions — the matrix is symmetric so
                  // either lookup should succeed for off-diagonal cells.
                  const realV = realMatrix[rowVar]?.[colVar] ?? realMatrix[colVar]?.[rowVar] ?? null;
                  const synV  = synMatrix[rowVar]?.[colVar]  ?? synMatrix[colVar]?.[rowVar]  ?? null;

                  // Cells with no data (variables that didn't form a valid pair)
                  // are shown as a neutral grey to distinguish them from 0-difference cells.
                  if (realV === null || synV === null) {
                    return (
                      <td
                        key={colVar}
                        style={{
                          background: "#f8fafc",
                          width: 40,
                          height: 32,
                          border: "1px solid #e2e8f0",
                          textAlign: "center",
                          fontSize: 10,
                          color: "#94a3b8",
                        }}
                      >
                        N/A
                      </td>
                    );
                  }

                  const diff = Math.abs(realV - synV);
                  const sim  = 1 - diff;

                  return (
                    <td
                      key={colVar}
                      onMouseEnter={(e) =>
                        setTooltip({
                          text: `${rowVar} × ${colVar}\nReal V:     ${realV.toFixed(3)}\nSyn V:      ${synV.toFixed(3)}\n|ΔV|:       ${diff.toFixed(3)}\nSimilarity: ${sim.toFixed(3)}`,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        background: simColor(sim),
                        width: 40,
                        height: 32,
                        border: "1px solid #e2e8f0",
                        textAlign: "center",
                        fontSize: 11,
                        cursor: "default",
                        color: sim > 0.5 ? "#fff" : "#374151",
                        fontWeight: sim < 0.8 ? 600 : 400,
                      }}
                    >
                      {sim.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Color scale legend */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 10,
        fontSize: 11,
        color: "#64748b",
      }}>
        <span>Similarity:</span>
        <span>Low</span>
        <div style={{
          width: 80,
          height: 10,
          background: "linear-gradient(to right, white, rgb(37,99,235))",
          border: "1px solid #e2e8f0",
          borderRadius: 2,
        }} />
        <span>High</span>
        <span style={{ marginLeft: 12, fontStyle: "italic" }}>
          Each cell = 1 − |real Cramér's V − synthetic Cramér's V| &nbsp;(1 = identical, diagonal = 1)
        </span>
      </div>

      {/* Floating tooltip — follows the cursor, never blocks the hovered cell */}
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
