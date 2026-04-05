// ========================================================
// PageSection.tsx — 頁面大區塊
// ========================================================
// 比 SectionCard 更大的容器，代表頁面上的一個「主題區塊」。
// 通常用 <section> 語義化標籤包住，對 SEO 和可讀性都有好處。
//
// 結構：
//   ┌────────────────────────────────────────┐
//   │ h2 title          [action 按鈕（可選）]  │
//   │ description 說明                         │
//   │──────────────────────────────────────────│
//   │ children（卡片、表格等內容）               │
//   └────────────────────────────────────────┘
//
// 和 SectionCard 的差別：
//   - PageSection 是「大區塊」，標題用 h2（較大）
//   - SectionCard 是「小卡片」，標題用 h3（較小）
//   - PageSection 不一定有白色背景，SectionCard 一定有
// ========================================================

import type { PageSectionProps } from "../../types/contracts";

export default function PageSection({
  title,
  description,
  action,    // 右側的操作元件（例如按鈕），可不傳
  children,
}: PageSectionProps) {
  return (
    // <section> 是 HTML 語義化標籤，代表頁面中的一個獨立主題區塊
    <section className="page-section">
      {/* 標題列：左邊標題 + 右邊操作按鈕 */}
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          {/* description 有傳才顯示 */}
          {description ? <p>{description}</p> : null}
        </div>
        {/* action 有傳才顯示右側操作按鈕 */}
        {action ? <div className="section-action">{action}</div> : null}
      </div>
      {/* 區塊內容 */}
      {children}
    </section>
  );
}
