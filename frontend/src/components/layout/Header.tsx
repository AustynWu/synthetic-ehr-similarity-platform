// ========================================================
// Header.tsx — 頂部標題列
// ========================================================
// 顯示三件事：
//   1. 上方小字（eyebrow）：平台名稱
//   2. 頁面標題（大字 h1）：當前頁面的名稱
//   3. 頁面說明：根據目前頁面顯示對應的描述
//   4. 右上角：「Prototype Build」標籤
//
// 這個元件是「純展示」元件（Presentational Component）：
//   它只根據傳入的 props 顯示內容，不自己管理任何狀態。
//   這是 React 的好習慣：盡量讓元件「傻」一點，讓父元件管資料。
// ========================================================

import StatusBadge from "../ui/StatusBadge";
import type { PageKey } from "../../types/contracts";

// 每個頁面的說明文字（靜態資料，用物件存放）
// Record<PageKey, string> 表示：key 必須是 PageKey 的其中一個，value 是字串
const pageDescriptions: Record<PageKey, string> = {
  upload:     "Upload diabetic_data.csv, V1_syn.csv, and prepare the comparison workflow.",
  validation: "Review schema alignment, sparse fields, and diabetes dataset quality checks.",
  setup:      "Select evaluation methods for the diabetes dataset comparison prototype.",
  results:    "Review a fixed result summary tailored to the real and synthetic diabetes files.",
  saved:      "Browse saved diabetes comparison runs and export-ready placeholders.",
};

// Header 元件：接收 pageTitle 和 currentPage 兩個 props
export default function Header({
  pageTitle,    // 當前頁面的標題文字
  currentPage,  // 當前頁面的識別鍵（用來查詢對應的描述）
}: {
  pageTitle: string;
  currentPage: PageKey;
}) {
  return (
    // <header> 是 HTML 語義化標籤，代表「頁面標題區域」
    <header className="top-header">
      <div>
        {/* eyebrow：頂部小字，讓使用者知道整個平台的名稱 */}
        <p className="eyebrow">Synthetic vs Real Diabetes EHR Similarity Platform</p>

        {/* h1 是最重要的標題，每個頁面只應該有一個 h1 */}
        <h1>{pageTitle}</h1>

        {/* 根據目前頁面顯示對應的說明文字 */}
        <p className="page-description">{pageDescriptions[currentPage]}</p>
      </div>

      {/* 右上角的狀態標籤，提醒這只是原型版本 */}
      <div className="header-actions">
        <StatusBadge tone="info">Prototype Build</StatusBadge>
      </div>
    </header>
  );
}
