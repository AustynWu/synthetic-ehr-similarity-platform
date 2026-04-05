// ========================================================
// ComparisonChart.tsx — 真實 vs 合成資料比較圖
// ========================================================
// 用純 CSS 畫出「並排直條圖」，讓使用者直觀看出：
//   藍色  = 真實資料的比例
//   淺藍色 = 合成資料的比例
//
// 每個類別（例如 "NO", ">30", "<30"）旁邊都有兩根條：
//   ┌──── ────┐
//   │▓▓   ░░  │  ← 藍色是真實，淺藍是合成
//   │          │
//   │  "NO"    │
//   │54% vs 53%│
//   └──────────┘
//
// 高度計算：
//   realHeight = (realValue / max) * 100%
//   把每個值換算成「佔最大值的百分比」
//   Math.max(10, ...) 確保最矮的 bar 至少 10%（避免完全看不到）
//
// max 是所有資料點裡的最大值（用來做為 100% 的基準）
//   Math.max(...points.flatMap(p => [p.realValue, p.syntheticValue]), 1)
//   flatMap 把 [realValue, syntheticValue] 打平成一維陣列
//   最後的 1 確保 max 不會是 0（避免除以零）
// ========================================================

import type { ChartPoint } from "../../types/contracts";

export default function ComparisonChart({
  title,
  subtitle,
  points,
}: {
  title?: string;   // optional — omit when the parent SectionCard already shows the name
  subtitle?: string;
  points: ChartPoint[];
}) {
  // 找出所有值裡的最大值（用來當作 100% 的基準，讓最高的 bar 剛好到頂）
  const max = Math.max(
    ...points.flatMap((point) => [point.realValue, point.syntheticValue]),
    1 // 至少是 1，避免空資料時除以零
  );

  return (
    <div className="comparison-chart">
      {/* Title block — only rendered when title or subtitle is provided */}
      {(title || subtitle) && (
        <div className="card-header compact">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}

      {/* 圖例說明（藍色=真實，淺藍=合成） */}
      <div className="comparison-legend">
        <span className="legend-item">
          <i className="legend-dot real" /> Real data
        </span>
        <span className="legend-item">
          <i className="legend-dot synthetic" /> Synthetic data
        </span>
      </div>

      {/* 圖表繪圖區 */}
      <div className="comparison-plot">
        {points.map((point) => {
          // 把值換算成高度百分比（相對於最大值）
          // 最矮 10%，避免 bar 太矮看不到
          const realHeight      = `${Math.max(10, (point.realValue      / max) * 100)}%`;
          const syntheticHeight = `${Math.max(10, (point.syntheticValue / max) * 100)}%`;

          return (
            <div key={point.label} className="comparison-group">
              {/* 兩根並排的直條 */}
              <div className="comparison-bars">
                {/* 真實資料的藍色 bar（高度由 realHeight 控制） */}
                <div
                  className="comparison-bar real"
                  style={{ height: realHeight }}
                  title={`Real: ${point.realValue}`} // 滑鼠移上去顯示確切數值
                />
                {/* 合成資料的淺藍 bar */}
                <div
                  className="comparison-bar synthetic"
                  style={{ height: syntheticHeight }}
                  title={`Synthetic: ${point.syntheticValue}`}
                />
              </div>

              {/* 類別標籤（例如 "NO"、">30"） */}
              <strong>{point.label}</strong>

              {/* 數值標籤（例如 "54% vs 53%"） */}
              <span>
                {Math.round(point.realValue * 100)}% vs {Math.round(point.syntheticValue * 100)}%
                {/* *100 因為原始值是 0~1 的小數（0.54 → 54%） */}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
