// ========================================================
// UploadPage.tsx — 第一步：上傳資料集頁面
// ========================================================
// 這個頁面讓使用者選擇兩個 CSV 檔案：
//   - 真實資料（diabetic_data.csv）
//   - 合成資料（V1_syn.csv）
// 選好後按下「Validate & Continue」就進入下一步。
//
// React 概念 — useState：
//   useState<File | null>(null) 建立一個「記憶格子」
//   File 是瀏覽器的內建物件，代表使用者選的檔案
//   null 是初始值（還沒選檔案）
//
// React 概念 — 受控 vs 非受控輸入：
//   這裡的 file input 是「非受控」的，我們不用 value 控制它，
//   而是監聽 onChange 事件，從 event.target.files 取得檔案。
//
// TypeScript 概念 — ChangeEvent：
//   ChangeEvent<HTMLInputElement> 代表 input 元素的 onChange 事件物件
//   event.target.files 是使用者選的檔案列表（FileList）
//   [0] 取第一個檔案，?. 是安全存取（files 可能是 null）
// ========================================================

import { useState, type ChangeEvent } from "react";
import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import type { SharedPageProps, UploadFilesInput } from "../types/contracts";

// UploadPage 除了 SharedPageProps 之外，還需要一個 onContinue 函式
// & 是 TypeScript 的「交集型別」，把兩個型別合併在一起
export default function UploadPage({
  uploadedDatasets,
  onContinue,
}: SharedPageProps & { onContinue: (files: UploadFilesInput) => void | Promise<void> }) {
  // 追蹤使用者選的兩個檔案（null 代表還沒選）
  const [realFile, setRealFile] = useState<File | null>(null);
  const [syntheticFile, setSyntheticFile] = useState<File | null>(null);

  // 只有兩個檔案都選好了，才能按「繼續」
  // Boolean(...) 把值轉成 true/false（null 會變成 false）
  const canContinue = Boolean(realFile && syntheticFile);

  // 按下「Validate & Continue」時執行
  const handleContinue = async () => {
    if (!canContinue) return; // 防呆：沒選好就不做任何事
    await onContinue({ realFile, syntheticFile }); // 呼叫父元件給的函式
  };

  return (
    <div className="page-stack">
      {/* 頁面大標題區 + 兩個上傳卡片 */}
      <PageSection
        title="Upload diabetes datasets"
        description="real diabetic dataset and supervisor-provided synthetic file."
      >
        <div className="two-column-grid">
          {/* 真實資料上傳卡片 */}
          <UploadCard
            title="Real dataset"
            description="diabetic_data.csv as the real EHR baseline."
            file={realFile}
            onSelectFile={(event) => setRealFile(event.target.files?.[0] ?? null)}
          />
          {/* 合成資料上傳卡片 */}
          <UploadCard
            title="Synthetic dataset"
            description="V1_syn.csv as the synthetic dataset."
            file={syntheticFile}
            onSelectFile={(event) => setSyntheticFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </PageSection>

      {/* 偵測到的資料集摘要（用靜態資訊顯示，讓頁面看起來更完整） */}
      <PageSection
        title="Detected dataset summary"
        description="These cards mirror the dataset pair used throughout the prototype flow."
      >
        <div className="summary-grid three-up">
          {/* ?? 運算子：左邊有值就用左邊，沒有才用右邊的預設文字 */}
          <SummaryCard
            label="Real dataset"
            value={realFile?.name ?? uploadedDatasets.realDataset?.fileName ?? "diabetic_data.csv"}
            helper="101,766 rows • 50 columns"
            badge="Baseline"
            tone="success"
          />
          <SummaryCard
            label="Synthetic dataset"
            value={syntheticFile?.name ?? uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv"}
            helper="101,766 rows • 50 columns"
            badge="Supervisor file"
            tone="info"
          />
          {/* IDS_mapping.csv 是選用的欄位說明對照表
          <SummaryCard
            label="Mapping reference"
            value="IDS_mapping.csv"
            helper="Admission, discharge, and source ID descriptions"
            badge="Optional"
            tone="warning"
          /> */}
        </div>
      </PageSection>

      {/* 頁面底部的操作按鈕 */}
      <div className="page-actions">
        <PrimaryButton variant="ghost">Reset</PrimaryButton>
        {/* disabled 屬性讓按鈕在沒選好檔案時變灰色、無法點擊 */}
        <PrimaryButton onClick={handleContinue} disabled={!canContinue}>
          Validate & Continue
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── 上傳卡片子元件 ──────────────────────────────────────────
// 把重複的「上傳區塊」抽成一個獨立的元件
// 這樣就不用把一樣的 HTML 寫兩次（DRY 原則：Don't Repeat Yourself）
function UploadCard({
  title,
  description,
  file,          // 目前選的檔案（null 代表還沒選）
  onSelectFile,  // 使用者選了檔案時呼叫的函式
}: {
  title: string;
  description: string;
  file: File | null;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <SectionCard title={title} subtitle={description} className="upload-card">
      {/* <label> 包住 <input type="file"> 的好處：
          點擊整個 label 區域都可以觸發檔案選擇視窗 */}
      <label className="upload-dropzone">
        {/* accept 限制只能選 CSV 或 Excel 檔案 */}
        <input type="file" accept=".csv,.xlsx" onChange={onSelectFile} />

        {/* 上傳圖示（箭頭） */}
        <span className="upload-icon">↑</span>

        {/* 根據是否已選檔案，顯示不同的文字 */}
        <strong>{file ? file.name : "Choose a dataset file"}</strong>
        <p>
          {file
            ? `${Math.max(1, Math.round(file.size / 1024))} KB selected`
            // Math.round(file.size / 1024) 把位元組換算成 KB
            // Math.max(1, ...) 確保顯示至少 1 KB（避免顯示 0）
            : "Click to browse local CSV files"}
        </p>
      </label>
    </SectionCard>
  );
}
