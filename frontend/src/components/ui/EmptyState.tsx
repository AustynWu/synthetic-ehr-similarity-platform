// ========================================================
// EmptyState.tsx — 空白狀態提示元件
// ========================================================
// 當頁面還沒有資料時，顯示一個友善的提示畫面。
// 引導使用者去做「下一步」（例如先去上傳資料）。
//
// 結構：
//   ┌───────────────────────┐
//   │ title（大標題）        │
//   │ description（說明）    │
//   │ [actionLabel 按鈕]     │  ← 可選
//   └───────────────────────┘
//
// 使用情境（防呆設計）：
//   - 直接跳到 ValidationPage 但還沒上傳資料
//   - 直接跳到 ResultsPage 但還沒跑評估
//   - SavedComparisonsPage 還沒儲存任何記錄
//
// actionLabel 和 onAction 都是選用的（?）：
//   不需要按鈕時，只傳 title 和 description 就好
// ========================================================

import PrimaryButton from "./PrimaryButton";
import type { EmptyStateProps } from "../../types/contracts";

export default function EmptyState({
  title,
  description,
  actionLabel, // 按鈕文字（可不傳）
  onAction,    // 按鈕點擊事件（可不傳）
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {/* 只有 actionLabel 有傳才渲染按鈕 */}
      {actionLabel ? (
        <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>
      ) : null}
    </div>
  );
}
