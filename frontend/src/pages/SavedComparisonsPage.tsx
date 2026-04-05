// ========================================================
// SavedComparisonsPage.tsx — 第五步：已儲存記錄頁面
// ========================================================
// 顯示使用者歷史上儲存過的所有比較記錄：
//   - 用 DataTable 顯示記錄清單（時間、資料集名稱、分數等）
//   - 匯出按鈕（目前是佔位符，功能未來再做）
//
// 這是最簡單的頁面：
//   - 沒有自己的 state
//   - 只從 savedComparisons（props）取資料顯示
//   - 防呆：如果沒有記錄，顯示 EmptyState 引導使用者去 Results 頁存一筆
// ========================================================

import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import DataTable from "../components/ui/DataTable";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import type { SavedComparison, SharedPageProps } from "../types/contracts";

export default function SavedComparisonsPage({ savedComparisons, goToPage }: SharedPageProps) {
  // 防呆：沒有任何儲存記錄時顯示提示
  if (!savedComparisons || savedComparisons.length === 0) {
    return (
      <EmptyState
        title="No saved comparisons yet"
        description="Save a run from the result page to populate this management screen."
        actionLabel="Go to results"
        onAction={() => goToPage("results")}
      />
    );
  }

  // 表格的欄位定義（決定要顯示哪些資訊欄）
  const columns = [
    { key: "runName",                label: "Run Name"          },
    { key: "createdAtLabel",         label: "Created"           }, // 人可讀的日期
    { key: "realDatasetName",        label: "Real Dataset"      },
    { key: "syntheticDatasetName",   label: "Synthetic Dataset" },
    { key: "overallSimilarityScore", label: "Overall Score"     },
    {
      key: "status",
      label: "Status",
      type: "badge" as const,
      getTone: () => "success" as const, // all records are "completed" → green
    },
  ];

  return (
    <div className="page-stack">
      {/* 儲存記錄表格 */}
      <PageSection
        title="Saved comparisons"
        description="A simplified history page for the prototype. Export can stay as a basic placeholder at this stage."
      >
        <SectionCard
          title="Saved runs"
          subtitle="This table is enough to show that previous comparisons can be reopened and exported later."
        >
          {/* DataTable 泛型：告訴它資料型態是 SavedComparison */}
          <DataTable<SavedComparison> columns={columns} rows={savedComparisons} />
        </SectionCard>
      </PageSection>

      {/* 匯出按鈕區（目前只是佔位符） */}
      <SectionCard
        title="Prototype export placeholder"
        subtitle="The export concept is visible here, but the actual document generation can wait until a later stage."
      >
        <div className="action-column action-row-on-desktop">
          {/* 這兩個按鈕目前點了沒有任何功能，只是讓使用者看到「將來可以匯出」 */}
          <PrimaryButton variant="secondary">Export PDF Summary</PrimaryButton>
          <PrimaryButton variant="ghost">View Run Details</PrimaryButton>
        </div>
      </SectionCard>

      {/* 頁面底部按鈕 */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("results")}>
          Back to Results
        </PrimaryButton>
        {/* 讓使用者可以重新從第一步開始做新的比較 */}
        <PrimaryButton onClick={() => goToPage("upload")}>
          Start New Comparison
        </PrimaryButton>
      </div>
    </div>
  );
}
