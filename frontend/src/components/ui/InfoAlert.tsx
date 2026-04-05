// ========================================================
// InfoAlert.tsx — 資訊警示框
// ========================================================
// 顯示一組驗證問題或提示訊息，每個訊息都有顏色標籤（error/warning/info）。
// 用在 ValidationPage 右側，顯示「驗證發現的問題清單」。
//
// 結構：
//   ┌─────────────────────────────┐
//   │ 標題               [Review] │
//   │──────────────────────────────│
//   │ [warning] weight, A1Cresult  │
//   │ [info]    All 50 matched     │
//   └─────────────────────────────┘
//
// 顏色對應：
//   error   → danger（紅色）
//   warning → warning（黃色）
//   info    → info（藍色）
//
// 這裡用了「三元運算子的巢狀」來決定顏色：
//   level === "error" ? "danger" : level === "warning" ? "warning" : "info"
//   讀法：如果是 error 就紅色，否則如果是 warning 就黃色，否則藍色
// ========================================================

import StatusBadge from "./StatusBadge";
import type { InfoAlertProps } from "../../types/contracts";

export default function InfoAlert({ title, items }: InfoAlertProps) {
  return (
    <div className="info-alert">
      {/* 標題列 */}
      <div className="card-header">
        <h3>{title}</h3>
        <StatusBadge tone="warning">Review</StatusBadge>
      </div>

      {/* 訊息清單 */}
      <ul className="insight-list">
        {items.map((item) => (
          // key 用 code + message 組合，確保唯一性
          <li key={`${item.code}-${item.message}`}>
            {/* 根據訊息等級決定 badge 顏色 */}
            <StatusBadge
              tone={
                item.level === "error"   ? "danger"  :
                item.level === "warning" ? "warning" :
                "info"
              }
            >
              {item.level}
            </StatusBadge>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
