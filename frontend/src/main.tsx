// ========================================================
// main.tsx — 整個網頁應用程式的「啟動點」
// ========================================================
// 這是 React 應用程式的入口檔案。
// 瀏覽器打開頁面時，第一個執行的就是這裡。
// 它的工作只有一件事：把 <App /> 這個元件塞進 HTML 的 <div id="root"> 裡。
//
// 概念說明：
//   HTML 裡有一個 <div id="root"></div>（在 index.html 裡）
//   React 會把整個畫面「渲染」進那個 div
//   之後畫面的所有改變都在 JavaScript 裡完成，不需要重新載入頁面
// ========================================================

// 從 React 函式庫匯入 StrictMode（開發用的嚴格模式，幫你抓潛在問題）
import { StrictMode } from "react";

// createRoot 是 React 18 的新語法，用來建立一個「渲染根節點」
import { createRoot } from "react-dom/client";

// 匯入全域 CSS 樣式（套用到整個網頁）
import "./index.css";

// 匯入主要的 App 元件（整個應用程式的起點）
import App from "./App";

// 從 HTML 裡找到 id 為 "root" 的 div 元素
const rootElement = document.getElementById("root");

// 安全檢查：如果找不到 root 元素就直接報錯（正常情況不會發生）
if (!rootElement) {
  throw new Error("Root element not found");
}

// 建立根節點，然後把 <App /> 渲染進去
// StrictMode 包住 App，會在開發環境下多做一些檢查，幫你找 bug
// （StrictMode 在正式上線時不會有任何影響）
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
