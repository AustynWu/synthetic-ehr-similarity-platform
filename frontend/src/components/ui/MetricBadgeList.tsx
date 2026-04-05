// ========================================================
// MetricBadgeList.tsx — 指標標籤列表
// ========================================================
// 把一個字串陣列顯示成一排藍色小標籤。
// 用在 SetupPage 和 ResultsPage 顯示「選用的指標」。
//
// 例如傳入 ["KS Test", "Chi-square Test"] 就會顯示：
//   [KS Test] [Chi-square Test]
//
// 這是最簡單的「列表渲染」例子：
//   items.map(item => <StatusBadge key={item}>{item}</StatusBadge>)
//   對每個字串產生一個 <StatusBadge>
// ========================================================

import StatusBadge from "./StatusBadge";
import type { MetricBadgeListProps } from "../../types/contracts";

export default function MetricBadgeList({ items }: MetricBadgeListProps) {
  return (
    <div className="metric-badge-list">
      {/* 每個字串都顯示成一個藍色 badge */}
      {items.map((item) => (
        // key 用字串本身（因為字串在這個清單裡是唯一的）
        <StatusBadge key={item} tone="info">
          {item}
        </StatusBadge>
      ))}
    </div>
  );
}
