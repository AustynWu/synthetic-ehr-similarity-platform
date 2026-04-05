// ========================================================
// ValidationPage.tsx — 第二步：資料驗證摘要頁面
// ========================================================
// 這個頁面顯示兩個資料集的「結構比較結果」，讓使用者確認：
//   - 兩份資料的行數和欄位數是否一致
//   - 每個欄位的資料型態是否對齊
//   - 有哪些欄位缺失率很高需要注意
//
// 這個頁面是「純展示」頁面：
//   它只從 props 取資料來顯示，不做任何資料修改。
//   只有兩個按鈕：「回上一步」和「繼續下一步」。
//
// 防呆設計：
//   如果 validationSummary 是 null（使用者直接跳到這頁）
//   → 顯示 EmptyState（空白提示），引導使用者先去上傳
// ========================================================

import PageSection from "../components/ui/PageSection";
// SummaryCard 已不再使用，改用 SectionCard + 自訂 stat row 來顯示統計數字
// 原因：SummaryCard 只能顯示一個大數字，無法同時顯示多個統計項目在同一張卡片裡
import SectionCard from "../components/ui/SectionCard";
import DataTable from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import InfoAlert from "../components/ui/InfoAlert";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import type { DataTableColumn, SchemaComparisonRow, SharedPageProps, StatusTone } from "../types/contracts";

export default function ValidationPage({ validationSummary, goToPage }: SharedPageProps) {
  // 防呆：如果還沒有驗證資料，顯示引導提示
  if (!validationSummary) {
    return (
      <EmptyState
        title="No validation summary yet"
        description="Upload datasets first to review schema checks and diabetes-specific validation summaries."
        actionLabel="Go to upload"
        onAction={() => goToPage("upload")}
      />
    );
  }

  // 計算行數差異（用於下方的 row-count-diff 提示條）
  const rowDiff = validationSummary.syntheticDataset.rowCount - validationSummary.realDataset.rowCount;
  const rowDiffPct = (Math.abs(rowDiff) / validationSummary.realDataset.rowCount * 100).toFixed(1);
  // 差異 <5% 綠色，5-20% 黃色，>20% 紅色
  const rowDiffTone: StatusTone =
    Number(rowDiffPct) < 5 ? "success" : Number(rowDiffPct) < 20 ? "warning" : "danger";

  // 根據缺失率決定 badge 顏色：超過一半是紅，超過兩成是黃，有缺失是藍，完全沒缺失是綠
  const missTone = (v: number): StatusTone =>
    v > 50 ? "danger" : v > 20 ? "warning" : v > 0 ? "info" : "success";

  // 欄位比較表格的欄位設定
  const columns: DataTableColumn<SchemaComparisonRow>[] = [
    { key: "columnName", label: "Column" },
    {
      // 資料型態欄位：兩邊一樣就只顯示一個值，不一樣就標紅並顯示「真實 → 合成」
      key: "realType",
      label: "Type",
      render: (_v, row) =>
        row.realType === row.syntheticType
          ? <span>{row.realType}</span>
          : <StatusBadge tone="danger">{row.realType} → {row.syntheticType}</StatusBadge>,
    },
    {
      // 真實資料集的缺失率，顏色由 missTone 決定
      key: "realMissingRate",
      label: "Real Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      // 合成資料集的缺失率，同樣的顏色規則
      key: "syntheticMissingRate",
      label: "Synthetic Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      // Diff = 兩個缺失率的絕對差值，代表合成資料是否忠實複製了缺失模式
      // 差值越小越好：>5% 紅，>1% 黃，其他綠
      // key 用 "diff" 但 SchemaComparisonRow 沒有這個欄位，所以 render 直接從 row 計算
      key: "diff",
      label: "Diff",
      render: (_v, row) => {
        const diff = Math.abs(row.realMissingRate - row.syntheticMissingRate);
        const tone: StatusTone = diff > 5 ? "danger" : diff > 1 ? "warning" : "success";
        return <StatusBadge tone={tone}>{diff.toFixed(1)}%</StatusBadge>;
      },
    },
  ];

  return (
    <div className="page-stack">
      {/* 頁面標題 + 六個統計卡片 */}
      <PageSection
        title="Validation summary"
        description="Review schema alignment and high-missing diabetes fields before running the first comparison."
      >
        {/*
          第一層：Data Summary — 兩個資料集的個別統計數字
          ─────────────────────────────────────────────────
          為什麼用 two-column-grid？
            → 左欄放真實資料，右欄放合成資料，讓使用者自然做橫向比較
            → two-column-grid 是 index.css 裡定義的 class，讓兩個卡片並排顯示

          為什麼不再用 SummaryCard？
            → SummaryCard 每張只能顯示一個數字
            → 現在要在同一張卡片裡顯示 rows / columns / missing / duplicates 四個數字
            → 所以改用 SectionCard（容器）+ dataset-stat-row（每一行資料）
        */}
        <div className="two-column-grid">

          {/* ── 左欄：真實資料集統計 ─────────────────────────── */}
          {/*
            SectionCard 是一個「白色卡片容器」
            title    → 卡片的大標題
            subtitle → 卡片的小標題（這裡放檔案名稱）

            validationSummary.realDataset.fileName
            → 從 props 傳進來的資料裡取出真實資料集的檔案名稱
            → 好處：未來換不同 dataset，這裡會自動顯示正確的名稱，不用手動改
          */}
          <SectionCard
            title="Real Dataset"
            subtitle={validationSummary.realDataset.fileName}
          >
            {/*
              dataset-stat-list：一個垂直排列的容器
              → 每個 dataset-stat-row 是一行統計數字
              → CSS 定義在 index.css 裡
            */}
            <div className="dataset-stat-list">

              {/*
                dataset-stat-row：每一行的結構是「左邊 label，右邊數字」
                → display: flex + justify-content: space-between 讓它們分開
                → border-bottom 在每行之間加一條細線，增加可讀性
              */}

              {/* 行數 */}
              <div className="dataset-stat-row">
                <span>Rows</span>
                {/*
                  .toLocaleString() 把純數字加上千分位逗號
                  例如：101766 → "101,766"
                  這樣大數字比較容易閱讀
                */}
                <strong>{validationSummary.realDataset.rowCount.toLocaleString()}</strong>
              </div>

              {/* 欄位數 */}
              <div className="dataset-stat-row">
                <span>Columns</span>
                <strong>{validationSummary.realDataset.columnCount}</strong>
              </div>

              {/* 有缺失值的欄位數：幫 user 快速定位問題是集中還是分散 */}
              <div className="dataset-stat-row">
                <span>Columns with missing</span>
                <strong>
                  {validationSummary.realDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.realDataset.columnCount} columns
                  </span>
                </strong>
              </div>

              {/* 缺失值總數 + 占總格子的百分比 */}
              {/*
                為什麼要加百分比？
                  → 374,017 這個數字對 user 沒有感覺
                  → 但「占 7.3% 的格子」就立刻有了概念：大約每 14 格就有 1 格是空的
                公式：缺失值數 ÷ (總行數 × 總欄位數) × 100
              */}
              <div className="dataset-stat-row">
                <span>Missing values</span>
                <strong>
                  {validationSummary.realDataset.missingValueCount.toLocaleString()}
                  <span className="stat-sub">
                    ({((validationSummary.realDataset.missingValueCount /
                        (validationSummary.realDataset.rowCount *
                         validationSummary.realDataset.columnCount)) * 100
                      ).toFixed(1)}% of cells)
                  </span>
                </strong>
              </div>

              {/* 重複行數 + 占總行數的百分比 */}
              {/*
                為什麼要加百分比？
                  → 0 筆重複 vs 101,766 行：直接顯示 0.0% 讓 user 立刻知道「沒有重複」
                  → 如果未來換成有重複的 dataset，user 也能立刻看出嚴重程度
                公式：重複行數 ÷ 總行數 × 100
              */}
              <div className="dataset-stat-row">
                <span>Duplicate rows</span>
                <strong>
                  {validationSummary.realDataset.duplicateRowCount}
                  <span className="stat-sub">
                    ({((validationSummary.realDataset.duplicateRowCount /
                        validationSummary.realDataset.rowCount) * 100
                      ).toFixed(1)}% of rows)
                  </span>
                </strong>
              </div>

            </div>
          </SectionCard>

          {/* ── 右欄：合成資料集統計 ─────────────────────────── */}
          {/*
            結構和左欄完全一樣，只是資料來源換成 syntheticDataset
            → 這樣使用者可以直接左右對比，找出差異
          */}
          <SectionCard
            title="Synthetic Dataset"
            subtitle={validationSummary.syntheticDataset.fileName}
          >
            <div className="dataset-stat-list">

              <div className="dataset-stat-row">
                <span>Rows</span>
                <strong>{validationSummary.syntheticDataset.rowCount.toLocaleString()}</strong>
              </div>

              <div className="dataset-stat-row">
                <span>Columns</span>
                <strong>{validationSummary.syntheticDataset.columnCount}</strong>
              </div>

              {/* 合成資料集：有缺失值的欄位數 */}
              <div className="dataset-stat-row">
                <span>Columns with missing</span>
                <strong>
                  {validationSummary.syntheticDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.syntheticDataset.columnCount} columns
                  </span>
                </strong>
              </div>

              {/* 合成資料集：缺失值總數 + 百分比（和真實資料集同樣邏輯） */}
              <div className="dataset-stat-row">
                <span>Missing values</span>
                <strong>
                  {validationSummary.syntheticDataset.missingValueCount.toLocaleString()}
                  <span className="stat-sub">
                    ({((validationSummary.syntheticDataset.missingValueCount /
                        (validationSummary.syntheticDataset.rowCount *
                         validationSummary.syntheticDataset.columnCount)) * 100
                      ).toFixed(1)}% of cells)
                  </span>
                </strong>
              </div>

              {/* 合成資料集：重複行數 + 百分比 */}
              <div className="dataset-stat-row">
                <span>Duplicate rows</span>
                <strong>
                  {validationSummary.syntheticDataset.duplicateRowCount}
                  <span className="stat-sub">
                    ({((validationSummary.syntheticDataset.duplicateRowCount /
                        validationSummary.syntheticDataset.rowCount) * 100
                      ).toFixed(1)}% of rows)
                  </span>
                </strong>
              </div>

            </div>
          </SectionCard>

        </div>

        {/* 行數差異提示條：顏色反映嚴重程度（綠<5% / 黃5-20% / 紅>20%） */}
        <div className={`row-count-diff row-count-diff--${rowDiffTone}`}>
          {rowDiff === 0
            ? "Row counts match exactly between both datasets."
            : `Synthetic has ${Math.abs(rowDiff).toLocaleString()} ${rowDiff > 0 ? "more" : "fewer"} rows than Real (${rowDiffPct}% difference).`}
        </div>
      </PageSection>

      {/* 欄位比較表：全寬顯示 */}
      <SectionCard
        title="Schema comparison"
        subtitle="Columns with highest missingness shown first. Type mismatches and large Diff values need attention before proceeding."
      >
        {/* DataTable 是通用表格元件，這裡用泛型 <SchemaComparisonRow> 告訴它資料的型態 */}
        <DataTable<SchemaComparisonRow>
          columns={columns}
          rows={validationSummary.schemaComparison}
        />
      </SectionCard>

      {/* 驗證發現：移到表格下方全寬顯示，讓 warning 更容易被看到 */}
      <InfoAlert title="Validation findings" items={validationSummary.issues} />

      {/* 準備好了的說明文字 */}
      {/* <SectionCard
        title="Validation readiness"
        subtitle="This version uses fixed but realistic dataset-aware validation content."
      >
        <p className="muted-copy">
          The prototype already reflects the real column count, row count, and major sparse-field patterns from diabetic_data.csv
          and V1_syn.csv. In the next stage, these cards and tables can be driven directly from FastAPI after upload and profiling.
        </p>
      </SectionCard> */}

      {/* 頁面底部的操作按鈕 */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("upload")}>
          Back to Upload
        </PrimaryButton>
        <PrimaryButton onClick={() => goToPage("setup")}>
          Proceed to Evaluation Setup
        </PrimaryButton>
      </div>
    </div>
  );
}
