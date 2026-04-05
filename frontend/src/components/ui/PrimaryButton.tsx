// ========================================================
// PrimaryButton.tsx — 通用按鈕元件
// ========================================================
// 整個應用程式所有按鈕都用這個元件，統一樣式。
//
// 支援三種外觀（variant）：
//   primary   → 藍色實心按鈕（主要動作，例如「繼續」）
//   secondary → 外框按鈕（次要動作，例如「查看記錄」）
//   ghost     → 透明按鈕（返回動作，例如「返回上一步」）
//
// TypeScript 概念 — 展開 props（...props）：
//   ButtonHTMLAttributes<HTMLButtonElement> 是 HTML button 支援的所有屬性
//   用 & 和 PrimaryButtonProps 合併後，再用 {...props} 全部傳給 <button>
//   這樣 disabled、onClick 等原生屬性就不用一個個手動列出來
//
// 預設值：variant = "primary"
//   如果呼叫時沒傳 variant，就用 "primary"
// ========================================================

import type { ButtonHTMLAttributes } from "react";
import type { PrimaryButtonProps } from "../../types/contracts";

// & 合併兩個型別：PrimaryButtonProps（我們自訂的）+ ButtonHTMLAttributes（HTML 原生的）
export default function PrimaryButton({
  children,           // 按鈕裡的文字或元件
  variant = "primary", // 預設是主要按鈕（藍色）
  ...props            // 其餘的 HTML 原生屬性（disabled、onClick 等）
}: PrimaryButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    // className 用 variant 決定套用的 CSS class
    // 例如 variant="ghost" → class="button ghost"
    // {...props} 把剩餘的 props（disabled、onClick 等）全部傳給 button
    <button type="button" className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}
