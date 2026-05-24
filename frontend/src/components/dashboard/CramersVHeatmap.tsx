// CramersVHeatmap.tsx — three-panel Cramér's V association heatmap
//
// Changed in supervisor meeting 2026-05-23 from a single similarity-score
// heatmap (1 − |ΔV|) to three separate panels so readers can directly compare
// the real and synthetic categorical association structures side by side.
//
// Panel 1 (Real):       actual Cramér's V values from the real dataset (0–1).
// Panel 2 (Synthetic):  actual Cramér's V values from the synthetic dataset (0–1).
// Panel 3 (Difference): |real_V − synthetic_V|, 0 = identical, higher = more divergent.
//
// Color scales:
//   Real / Synthetic: sequential — white(0) → blue(1), 0 = no association, 1 = strong
//   Difference:       sequential — white(0) → orange-red(1), higher = bigger gap

import { useState } from "react";

// Sequential color for Cramér's V (0–1): white → blue-600.
function cramersColor(v: number): string {
  const t = Math.min(Math.max(v, 0), 1);
  return `rgb(${Math.round(255 - 218 * t)},${Math.round(255 - 156 * t)},${Math.round(255 - 20 * t)})`;
}

// Sequential color for absolute difference (0–1): white → orange-red.
function diffColor(d: number): string {
  const t = Math.min(Math.max(d, 0), 1);
  return `rgb(255,${Math.round(255 - 200 * t)},${Math.round(255 - 240 * t)})`;
}

function shortName(v: string): string {
  return v.length > 14 ? v.slice(0, 12) + "…" : v;
}

// Look up a value from either direction because the matrix is symmetric.
function lookup(
  matrix: Record<string, Record<string, number>>,
  row: string,
  col: string,
): number | null {
  return matrix[row]?.[col] ?? matrix[col]?.[row] ?? null;
}

interface Props {
  variables: string[];
  realMatrix: Record<string, Record<string, number>>;
  synMatrix:  Record<string, Record<string, number>>;
  note?: string;
}

export default function CramersVHeatmap({ variables, realMatrix, synMatrix, note }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (variables.length < 2) {
    return (
      <p style={{ color: "#64748b", fontSize: 13 }}>
        At least 2 categorical variables are needed to display the Cramér's V heatmap.
      </p>
    );
  }

  // Shared column header row — reused by all three panels.
  const headerRow = (
    <thead>
      <tr>
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
  );

  const rowLabelStyle = {
    padding: "2px 10px",
    textAlign: "right" as const,
    fontWeight: 500,
    fontSize: 12,
    whiteSpace: "nowrap" as const,
    maxWidth: 120,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
  };

  const cellBase = {
    width: 40,
    height: 32,
    border: "1px solid #e2e8f0",
    textAlign: "center" as const,
    fontSize: 11,
    cursor: "default" as const,
  };

  const naCell = {
    ...cellBase,
    background: "#f8fafc",
    color: "#94a3b8",
    fontSize: 10,
  };

  const panelTitle = (label: string) => (
    <p style={{ fontWeight: 600, fontSize: 13, color: "#1e293b", margin: "16px 0 4px" }}>
      {label}
    </p>
  );

  return (
    <div>
      {note && (
        <p style={{
          color: "#475569", fontSize: 12, marginBottom: 12,
          padding: "8px 12px", background: "#f8fafc",
          borderLeft: "3px solid #94a3b8",
          borderRadius: "0 4px 4px 0", lineHeight: 1.6,
        }}>
          {note}
        </p>
      )}

      {/* ── Panel 1: Real Cramér's V ─────────────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Real — Cramér's V")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {variables.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {variables.map((colVar) => {
                    const v    = lookup(realMatrix, rowVar, colVar);
                    const synV = lookup(synMatrix,  rowVar, colVar);
                    if (v === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = synV !== null ? Math.abs(v - synV) : null;
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: cramersColor(v), color: v > 0.5 ? "#fff" : "#374151" }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real V:      ${v.toFixed(3)}`,
                            `Synthetic V: ${synV !== null ? synV.toFixed(3) : "N/A"}`,
                            diff !== null ? `|ΔV|:        ${diff.toFixed(3)}` : "",
                          ].filter(Boolean).join("\n"),
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend type="cramers" />
      </div>

      {/* ── Panel 2: Synthetic Cramér's V ───────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Synthetic — Cramér's V")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {variables.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {variables.map((colVar) => {
                    const v     = lookup(synMatrix,  rowVar, colVar);
                    const realV = lookup(realMatrix, rowVar, colVar);
                    if (v === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = realV !== null ? Math.abs(realV - v) : null;
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: cramersColor(v), color: v > 0.5 ? "#fff" : "#374151" }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real V:      ${realV !== null ? realV.toFixed(3) : "N/A"}`,
                            `Synthetic V: ${v.toFixed(3)}`,
                            diff !== null ? `|ΔV|:        ${diff.toFixed(3)}` : "",
                          ].filter(Boolean).join("\n"),
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend type="cramers" />
      </div>

      {/* ── Panel 3: Absolute difference ────────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Difference — |Real V − Synthetic V|")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {variables.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {variables.map((colVar) => {
                    const realV = lookup(realMatrix, rowVar, colVar);
                    const synV  = lookup(synMatrix,  rowVar, colVar);
                    if (realV === null || synV === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = Math.abs(realV - synV);
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: diffColor(diff), color: diff > 0.5 ? "#fff" : "#374151", fontWeight: diff > 0.2 ? 600 : 400 }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real V:      ${realV.toFixed(3)}`,
                            `Synthetic V: ${synV.toFixed(3)}`,
                            `|ΔV|:        ${diff.toFixed(3)}`,
                          ].join("\n"),
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {diff.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend type="diff" />
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 14,
          top:  tooltip.y - 8,
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

// Color legend displayed below each panel.
function Legend({ type }: { type: "cramers" | "diff" }) {
  if (type === "cramers") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6, marginBottom: 8, fontSize: 11, color: "#64748b" }}>
        <span>Cramér's V:</span>
        <span>0 (independent)</span>
        <div style={{ width: 80, height: 10, background: "linear-gradient(to right, white, rgb(37,99,235))", border: "1px solid #e2e8f0", borderRadius: 2 }} />
        <span>1 (strong)</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6, marginBottom: 8, fontSize: 11, color: "#64748b" }}>
      <span>|ΔV|:</span>
      <span>0 (identical)</span>
      <div style={{ width: 80, height: 10, background: "linear-gradient(to right, white, rgb(255,55,15))", border: "1px solid #e2e8f0", borderRadius: 2 }} />
      <span>Large gap</span>
    </div>
  );
}
