// CorrelationHeatmap.tsx — three-panel Pearson correlation heatmap
//
// Changed in supervisor meeting 2026-05-23 from a single similarity-score
// heatmap (1 − |Δr|) to three separate panels so readers can directly compare
// the real and synthetic correlation structures without needing a derived score.
//
// Panel 1 (Real):       actual Pearson r values from the real dataset.
// Panel 2 (Synthetic):  actual Pearson r values from the synthetic dataset.
// Panel 3 (Difference): |real_r − synthetic_r|, 0 = identical, higher = more divergent.
//
// Color scales:
//   Real / Synthetic: diverging — red(−1) → white(0) → blue(+1)
//   Difference:       sequential — white(0) → orange-red(large gap)

import { useState } from "react";

const MAX_VARS = 12;

// Diverging color scale for Pearson r (range −1 to +1).
// Positive values interpolate white → blue-600; negative values white → red.
function pearsonColor(r: number): string {
  const v = Math.min(Math.max(r, -1), 1);
  if (v >= 0) {
    const t = v;
    return `rgb(${Math.round(255 - 218 * t)},${Math.round(255 - 156 * t)},${Math.round(255 - 20 * t)})`;
  }
  const t = -v;
  return `rgb(255,${Math.round(255 - 200 * t)},${Math.round(255 - 200 * t)})`;
}

// Sequential color scale for absolute difference (range 0 to 1).
// White = no difference; orange-red = large difference.
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

  // Shared column header row — reused by all three panels.
  const headerRow = (
    <thead>
      <tr>
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
      {variables.length > MAX_VARS && (
        <p style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
          Showing first {MAX_VARS} of {variables.length} numerical variables.
        </p>
      )}

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

      {/* ── Panel 1: Real Pearson r ─────────────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Real — Pearson Correlation")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {vars.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {vars.map((colVar) => {
                    const r    = lookup(realMatrix, rowVar, colVar);
                    const synR = lookup(synMatrix,  rowVar, colVar);
                    if (r === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = synR !== null ? Math.abs(r - synR) : null;
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: pearsonColor(r), color: Math.abs(r) > 0.5 ? "#fff" : "#374151" }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real r:      ${r.toFixed(3)}`,
                            `Synthetic r: ${synR !== null ? synR.toFixed(3) : "N/A"}`,
                            diff !== null ? `|Δr|:        ${diff.toFixed(3)}` : "",
                          ].filter(Boolean).join("\n"),
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend type="pearson" />
      </div>

      {/* ── Panel 2: Synthetic Pearson r ────────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Synthetic — Pearson Correlation")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {vars.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {vars.map((colVar) => {
                    const r     = lookup(synMatrix,  rowVar, colVar);
                    const realR = lookup(realMatrix, rowVar, colVar);
                    if (r === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = realR !== null ? Math.abs(realR - r) : null;
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: pearsonColor(r), color: Math.abs(r) > 0.5 ? "#fff" : "#374151" }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real r:      ${realR !== null ? realR.toFixed(3) : "N/A"}`,
                            `Synthetic r: ${r.toFixed(3)}`,
                            diff !== null ? `|Δr|:        ${diff.toFixed(3)}` : "",
                          ].filter(Boolean).join("\n"),
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend type="pearson" />
      </div>

      {/* ── Panel 3: Absolute difference ────────────────────────────────────── */}
      <div className="heatmap-panel-block">
        {panelTitle("Difference — |Real r − Synthetic r|")}
        <div className="heatmap-table-scroll" style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            {headerRow}
            <tbody>
              {vars.map((rowVar) => (
                <tr key={rowVar}>
                  <td title={rowVar} style={rowLabelStyle}>{shortName(rowVar)}</td>
                  {vars.map((colVar) => {
                    const realR = lookup(realMatrix, rowVar, colVar);
                    const synR  = lookup(synMatrix,  rowVar, colVar);
                    if (realR === null || synR === null) return <td key={colVar} style={naCell}>N/A</td>;
                    const diff = Math.abs(realR - synR);
                    return (
                      <td
                        key={colVar}
                        style={{ ...cellBase, background: diffColor(diff), color: diff > 0.5 ? "#fff" : "#374151", fontWeight: diff > 0.2 ? 600 : 400 }}
                        onMouseEnter={(e) => setTooltip({
                          text: [
                            `${rowVar} × ${colVar}`,
                            `Real r:      ${realR.toFixed(3)}`,
                            `Synthetic r: ${synR.toFixed(3)}`,
                            `|Δr|:        ${diff.toFixed(3)}`,
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
function Legend({ type }: { type: "pearson" | "diff" }) {
  if (type === "pearson") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6, marginBottom: 8, fontSize: 11, color: "#64748b" }}>
        <span>Pearson r:</span>
        <span>−1</span>
        <div style={{ width: 80, height: 10, background: "linear-gradient(to right, rgb(255,55,55), white, rgb(37,99,235))", border: "1px solid #e2e8f0", borderRadius: 2 }} />
        <span>+1</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6, marginBottom: 8, fontSize: 11, color: "#64748b" }}>
      <span>|Δr|:</span>
      <span>0 (identical)</span>
      <div style={{ width: 80, height: 10, background: "linear-gradient(to right, white, rgb(255,55,15))", border: "1px solid #e2e8f0", borderRadius: 2 }} />
      <span>Large gap</span>
    </div>
  );
}
