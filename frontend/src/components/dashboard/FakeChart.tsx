// ========================================================
// FakeChart.tsx — 簡易橫條圖（原型用）
// ========================================================
// 這個元件用純 CSS 畫出一個「假圖表」，不需要任何圖表函式庫。
// 目的是在 prototype 階段讓儀表板看起來有圖，但不花太多時間做真正的圖。
//
// 每個 bar 的結構：
//   ┌──────────────────────────────┐
//   │ label         value          │
//   │ ████████████████░░░░░░ 80%  │  ← 用 CSS width 控制長度
//   └──────────────────────────────┘
//
// 原理：
//   <div style={{ width: `${bar.percent}%` }} />
//   用 inline style 設定每個 bar 的寬度（0~100%）
//   這比用真正的 SVG 圖表函式庫簡單很多
//
// 未來升級：可以把這個元件換成 Recharts 或 Chart.js，頁面其他地方不用改
// ========================================================

import type { FakeChartProps } from "../../types/contracts";

export default function FakeChart({
  title,
  bars = [],      // 預設是空陣列（避免 undefined 錯誤）
  height = 220,   // 預設最小高度 220px
}: FakeChartProps) {
  return (
    // style={{ minHeight: height }} 用 JS 物件設定 inline style
    // 注意：React 的 inline style 用 camelCase（minHeight 不是 min-height）
    <div className="fake-chart" style={{ minHeight: height }}>
      {/* 圖表標題 */}
      <div className="card-header compact">
        <h3>{title}</h3>
        <p>Prototype visual placeholder</p>
      </div>

      {/* 橫條清單 */}
      <div className="bar-visual-list">
        {bars.map((bar) => (
          <div key={bar.label} className="bar-row">
            {/* 文字資訊行：左邊 label，右邊數值 */}
            <div className="bar-meta">
              <span>{bar.label}</span>
              <strong>{bar.value}</strong>
            </div>

            {/* 橫條圖軌道 */}
            <div className="bar-track">
              {/* 實際的填色 bar：用 percent 控制寬度 */}
              <div className="bar-fill" style={{ width: `${bar.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
