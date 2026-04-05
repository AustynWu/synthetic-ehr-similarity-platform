// ========================================================
// Sidebar.tsx — 左側的步驟導覽選單
// ========================================================
// 顯示五個步驟的選單按鈕，讓使用者可以在頁面間切換。
// 每個按鈕包含：
//   - 步驟編號（01, 02, ...05）
//   - 步驟名稱和副標題
//   - 完成後顯示的「●」打勾標記
//
// React 概念 — 條件 className：
//   `sidebar-link ${isActive ? "active" : ""}` 這種寫法
//   用 JS 的三元運算子動態決定 CSS class
//   isActive 為 true → class 是 "sidebar-link active"（有特殊樣式）
//   isActive 為 false → class 是 "sidebar-link "（一般樣式）
//
// React 概念 — .map()：
//   陣列的 .map() 方法把每個元素「轉換」成一個 JSX 元件
//   React 用 key 屬性追蹤每個元素，避免不必要的重新渲染
// ========================================================

import type { NavigationItem, PageKey } from "../../types/contracts";

export default function Sidebar({
  items,          // 選單項目清單（來自 navigation.ts）
  currentPage,    // 目前的頁面（用來決定哪個按鈕要高亮）
  onNavigate,     // 點選按鈕時呼叫的函式（切換頁面）
  completedSteps, // Set<PageKey>，紀錄哪些步驟已完成
}: {
  items: NavigationItem[];
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  completedSteps: Set<PageKey>;
}) {
  return (
    // <aside> 是 HTML 語義化標籤，代表「側邊輔助內容」
    <aside className="sidebar">
      {/* 品牌標誌區（Logo + 專案名稱） */}
      <div className="sidebar-brand">
        <div className="brand-mark">EH</div>
        <div>
          <p className="brand-title">EHR Similarity</p>
          <p className="brand-subtitle">Capstone Prototype</p>
        </div>
      </div>

      {/* 導覽選單 */}
      <nav className="sidebar-nav">
        {/* 用 .map() 把每個選單項目轉成一個按鈕 */}
        {items.map((item, index) => {
          // 判斷這個按鈕是不是當前頁面（決定是否加 "active" class）
          const isActive = currentPage === item.key;
          // 判斷這個步驟是否已完成（用 Set.has() 查詢）
          const isComplete = completedSteps.has(item.key);

          return (
            <button
              key={item.key}   // React 需要唯一的 key 來追蹤列表元素
              type="button"    // 明確指定 type="button" 避免在表單中意外觸發送出
              className={`sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.key)} // 點擊時切換到對應頁面
            >
              {/* 步驟編號：01, 02, 03... */}
              <span className="sidebar-step">0{index + 1}</span>

              {/* 步驟名稱和副標題 */}
              <span className="sidebar-copy">
                <span>{item.label}</span>
                <small>{item.shortLabel}</small>
              </span>

              {/* 如果這個步驟已完成，顯示一個圓點當作打勾 */}
              {isComplete && <span className="sidebar-check">●</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
