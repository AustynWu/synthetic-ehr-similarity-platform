// ========================================================
// vite.config.ts — Vite 開發工具設定檔
// ========================================================
// Vite 是這個專案的「開發伺服器 + 打包工具」。
// 你執行 npm run dev 時，Vite 就是在背後跑的程式。
//
// Vite 做了什麼？
//   開發時：啟動本地伺服器（http://localhost:5173），
//           每次你改程式碼，頁面會「瞬間」更新（Hot Module Replacement）
//   打包時：把所有 TypeScript / React / CSS 編譯成純 HTML + JS + CSS，
//           這些才是可以放到伺服器上的網頁檔案
//
// defineConfig 的作用：
//   幫你的設定物件加上 TypeScript 型別提示，
//   這樣打設定時編輯器會有自動補全
//
// plugins: [react()]：
//   告訴 Vite 這是一個 React 專案
//   讓 Vite 支援 JSX 語法（<div> 這種 HTML in JS 的寫法）
//   以及 Fast Refresh（改 React 元件時不用整個頁面重載）
// ========================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 匯出 Vite 設定
export default defineConfig({
  plugins: [react()], // 加入 React 外掛，支援 JSX 和 Fast Refresh
});
