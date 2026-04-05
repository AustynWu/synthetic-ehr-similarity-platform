// ========================================================
// SummaryCard.tsx — 統計摘要卡片
// ========================================================
// 顯示一個數字或文字加上說明的小卡片。
// 常用於頁面頂部的「快速摘要」區域。
//
// 外觀結構：
//   ┌─────────────────────────┐
//   │ label 標題        [badge]│
//   │ value（大字）            │
//   │ helper 補充說明          │
//   └─────────────────────────┘
//
// 所有 props 都有預設值或是選用的（?），所以呼叫時很彈性：
//   <SummaryCard label="Rows" value={101766} />  ← 最簡單用法
//   <SummaryCard label="Status" value="Good" badge="OK" tone="success" helper="..." />
// ========================================================

import StatusBadge from "./StatusBadge";
import type { SummaryCardProps } from "../../types/contracts";

export default function SummaryCard({
  label,          // 卡片標題（小字）
  value,          // 主要數值（大字）
  helper,         // 補充說明（最小字，灰色）
  tone = "info",  // badge 的顏色（預設藍色）
  badge,          // 右上角的小標籤文字（可不傳）
}: SummaryCardProps) {
  return (
    <div className="summary-card">
      {/* 頂部一行：左邊 label，右邊 badge */}
      <div className="summary-top-row">
        <p>{label}</p>
        {/* badge 有傳才顯示（React 的條件渲染：null/undefined 不會渲染任何東西） */}
        {badge ? <StatusBadge tone={tone}>{badge}</StatusBadge> : null}
      </div>

      {/* 主要數值（h3 大字） */}
      <h3>{value}</h3>

      {/* 補充說明（可不傳） */}
      {helper ? <span>{helper}</span> : null}
    </div>
  );
}
