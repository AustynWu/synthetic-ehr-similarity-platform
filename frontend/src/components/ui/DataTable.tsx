// ========================================================
// DataTable.tsx — 通用資料表格元件
// ========================================================
// 一個可以顯示任何型態資料的表格元件。
// 用在 ValidationPage（欄位比較）和 SavedComparisonsPage（記錄清單）。
//
// TypeScript 概念 — 泛型（Generics）：
//   DataTable<T extends object>
//   T 是「型別參數」，呼叫時才決定是什麼型別。
//   例如：DataTable<SchemaComparisonRow> → T 就是 SchemaComparisonRow
//         DataTable<SavedComparison>     → T 就是 SavedComparison
//   這讓同一個 DataTable 可以處理不同型態的資料，不用寫很多個。
//   object 限制 T 必須是「物件」即可，不要求有字串 index signature
//
// 欄位渲染優先順序：
//   1. column.type === "badge" → 用 StatusBadge 顯示
//   2. column.render 有自訂渲染函式 → 用自訂的
//   3. 都沒有 → 直接顯示值的字串
// ========================================================

import StatusBadge from "./StatusBadge";
import type { DataTableProps } from "../../types/contracts";

// <T extends object> 是泛型宣告
// 呼叫端用 <DataTable<MyType> ...> 告訴元件 T 是什麼
export default function DataTable<T extends object>({
  columns,
  rows,
  emptyMessage = "No data available.", // 沒資料時顯示的訊息（有預設值）
}: DataTableProps<T>) {
  return (
    // table-wrapper 讓表格在小螢幕可以水平捲動
    <div className="table-wrapper">
      <table className="data-table">
        {/* 表頭：顯示欄位標題 */}
        <thead>
          <tr>
            {columns.map((column) => (
              // String(column.key) 把 key 轉成字串，確保可以用作 key prop
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            // 沒有資料時，顯示一個跨所有欄的空白提示
            <tr>
              <td colSpan={columns.length} className="table-empty-cell">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            // 有資料時，對每一行資料渲染一個 <tr>
            rows.map((row, index) => (
              <tr
                // key 優先用 id，其次用 columnName，最後用 index
                key={String(
                  (row as { id?: string }).id ??
                  (row as { columnName?: string }).columnName ??
                  index
                )}
              >
                {/* 對每一個欄位定義，取出對應的值並渲染 */}
                {columns.map((column) => {
                  // 取出這個欄位的值（String(column.key) 是欄位名稱）
                  const value = row[String(column.key)];

                  // 情況 1：這個欄位要用 badge 顯示
                  if (column.type === "badge") {
                    return (
                      <td key={String(column.key)}>
                        <StatusBadge
                          // getTone 是一個函式，動態決定顏色
                          // 如果沒有 getTone，就用預設的 "info"（藍色）
                          tone={column.getTone ? column.getTone(value, row) : "info"}
                        >
                          {String(value)}
                        </StatusBadge>
                      </td>
                    );
                  }

                  // 情況 2：這個欄位有自訂渲染函式
                  if (column.render) {
                    return <td key={String(column.key)}>{column.render(value, row)}</td>;
                  }

                  // 情況 3：直接顯示值的字串形式
                  // String(value ?? "") 把 null/undefined 轉成空字串
                  return <td key={String(column.key)}>{String(value ?? "")}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
