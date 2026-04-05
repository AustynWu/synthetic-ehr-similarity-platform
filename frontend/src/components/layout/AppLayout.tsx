// ========================================================
// AppLayout.tsx — 整個應用程式的外框（版面配置）
// ========================================================
// 這個元件決定畫面的「骨架」長什麼樣：
//   左邊：Sidebar（側邊導覽選單）
//   右邊上方：Header（頂部標題列）
//   右邊內容區：{children}（目前頁面的內容）
//
// React 概念 — children：
//   children 是一個特殊的 prop，代表「放在這個元件標籤之間的內容」。
//   例如：<AppLayout>這裡的東西就是 children</AppLayout>
//   這讓 AppLayout 可以包住任何頁面，不需要知道裡面放什麼。
//
// CSS 概念：
//   "app-shell" → 讓整個頁面用 CSS Grid 或 Flexbox 分成左右兩欄
//   "app-main"  → 右側的主要區域（標題 + 內容）
//   "app-content" → 中間的內容區，會有 padding 和捲軸
// ========================================================

import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { NavigationItem, PageKey } from "../../types/contracts";

// AppLayout 接收的 props 定義（TypeScript 的 inline 型別定義）
export default function AppLayout({
  navigationItems, // 側邊欄的選單清單
  currentPage,     // 目前在哪個頁面（用來高亮顯示對應的選單）
  pageTitle,       // 頁面標題（顯示在頂部）
  onNavigate,      // 點選選單時呼叫的函式
  completedSteps,  // 哪些步驟已完成（用來在選單上顯示打勾）
  children,        // 這個元件包住的內容（當前頁面的元件）
}: {
  navigationItems: NavigationItem[];
  currentPage: PageKey;
  pageTitle: string;
  onNavigate: (page: PageKey) => void;
  completedSteps: Set<PageKey>;
  children: ReactNode; // ReactNode 是 React 可以渲染的任何東西
}) {
  return (
    // app-shell：最外層容器，CSS 會讓它分成左（sidebar）右（main）兩欄
    <div className="app-shell">
      {/* 左側選單 */}
      <Sidebar
        items={navigationItems}
        currentPage={currentPage}
        onNavigate={onNavigate}
        completedSteps={completedSteps}
      />

      {/* 右側主要區域 */}
      <div className="app-main">
        {/* 頂部標題列 */}
        <Header pageTitle={pageTitle} currentPage={currentPage} />

        {/* 內容區：顯示當前頁面的元件 */}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
