// ========================================================
// StatusBadge.tsx — 狀態標籤（小色塊）
// ========================================================
// 顯示一個帶顏色的小標籤，用來表達狀態或分類。
//
// 顏色由 tone 決定：
//   info    → 藍色（一般資訊）
//   success → 綠色（成功、正常）
//   warning → 黃色（注意、警告）
//   danger  → 紅色（錯誤、危險）
//
// 這是整個應用程式裡最小的元件，但被非常多地方使用：
//   DataTable 裡的 status 欄、InfoAlert 裡的 level、SummaryCard 右上角...
//
// 設計原則：小元件保持簡單，只做一件事。
// ========================================================

import type { StatusBadgeProps } from "../../types/contracts";

export default function StatusBadge({
  children,       // 標籤裡的文字
  tone = "info",  // 預設是藍色（info）
}: StatusBadgeProps) {
  // 用模板字串把 tone 加到 className 裡
  // 例如 tone="success" → class="status-badge success"（CSS 裡定義成綠色）
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
