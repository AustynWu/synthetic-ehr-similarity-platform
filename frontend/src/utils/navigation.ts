// ========================================================
// navigation.ts — 導覽選單的靜態資料
// ========================================================
// 這個檔案只存放「固定不變」的導覽設定。
// 不含任何邏輯，只是把資料定義好，讓別的地方可以匯入使用。
//
// 為什麼要獨立一個檔案？
//   → 避免把靜態設定混進 App.tsx，保持各自職責清楚
// ========================================================

import type { NavigationItem, PageKey } from "../types/contracts";

// 側邊欄的五個選單項目，順序就是使用者操作流程的順序
// key      → 對應 App.tsx 裡的 currentPage 狀態
// label    → 側邊欄顯示的完整文字
// shortLabel → 選單項目下方的副標題（小字）
export const navigationItems: NavigationItem[] = [
  { key: "upload",     label: "Upload Datasets",        shortLabel: "Start comparison"  },
  { key: "validation", label: "Validation & Summary",   shortLabel: "Review structure"  },
  { key: "setup",      label: "Evaluation Setup",       shortLabel: "Choose metrics"    },
  { key: "results",    label: "Results Dashboard",      shortLabel: "View summary"      },
  { key: "saved",      label: "Saved Comparisons",      shortLabel: "Manage runs"       },
];

// 每個頁面的頂部標題（Header 元件會用到）
// Record<PageKey, string> 的意思是：
//   → 這個物件的 key 必須是 PageKey 的其中一個，value 必須是字串
//   → TypeScript 會提醒你如果漏掉了哪個 PageKey
export const pageTitles: Record<PageKey, string> = {
  upload:     "Upload Datasets",
  validation: "Data Validation & Summary",
  setup:      "Evaluation Setup",
  results:    "Results Dashboard",
  saved:      "Saved Comparisons & Export",
};
