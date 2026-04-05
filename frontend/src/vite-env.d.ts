// ========================================================
// vite-env.d.ts — 告訴 TypeScript「這個專案用 Vite 建置」
// ========================================================
// 這個檔案做兩件事：
//
// 1. /// <reference types="vite/client" />
//    引入 Vite 提供的型別宣告，包含：
//    - import.meta.env（讀取環境變數，例如 VITE_API_URL）
//    - import.meta.hot（Hot Module Replacement API）
//    - 告訴 TypeScript「CSS / 圖片 / SVG 可以被 import」
//
// 2. 下面的 declare module 讓 TypeScript 知道
//    import "./index.css" 這樣的寫法是合法的（不是錯誤）
//    因為 Vite 在執行期會處理 CSS，TypeScript 本身不懂
//
// 為什麼沒有這個檔案就報錯？
//    TypeScript 預設只認識 .ts / .tsx 檔案
//    import "./index.css" 對它來說是「不明的模組」
//    這個檔案就是告訴它：沒問題，Vite 會處理
// ========================================================

/// <reference types="vite/client" />
