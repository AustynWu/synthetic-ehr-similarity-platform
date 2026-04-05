// ========================================================
// SectionCard.tsx — 區塊卡片容器
// ========================================================
// 一個帶有白色背景、圓角和陰影的「卡片」容器。
// 頁面上大部分的區塊都用這個元件包住。
//
// 結構：
//   ┌────────────────────────────┐
//   │ title（粗體標題）            │
//   │ subtitle（灰色副標題）        │
//   │─────────────────────────────│
//   │ children（任何內容）          │
//   └────────────────────────────┘
//
// 彈性設計：
//   - title 和 subtitle 都是選用的（不傳就不顯示標題區）
//   - className 可以額外加 CSS class（例如 "upload-card"）
//   - children 是放在裡面的內容（由呼叫者決定）
//
// React 概念 — && 運算子的條件渲染：
//   (title || subtitle) && <div>...</div>
//   如果 title 和 subtitle 都是 falsy（空字串/undefined），就不渲染標題區
// ========================================================

import type { SectionCardProps } from "../../types/contracts";

export default function SectionCard({
  title,
  subtitle,
  children,
  className = "", // 預設是空字串
}: SectionCardProps) {
  return (
    // .trim() 去掉多餘的空格（避免 className 是 "section-card " 多一個空格）
    <div className={`section-card ${className}`.trim()}>
      {/* 只有 title 或 subtitle 至少有一個時，才渲染標題區 */}
      {(title || subtitle) && (
        <div className="card-header">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      )}
      {/* 卡片內容（由呼叫這個元件的地方決定放什麼） */}
      {children}
    </div>
  );
}
