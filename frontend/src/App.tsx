// ========================================================
// App.tsx — 整個應用程式的「大腦」／控制中心
// ========================================================
// 這個元件負責：
//   1. 記住現在在哪個頁面（上傳、驗證、設定、結果、儲存）
//   2. 記住所有跨頁面共享的資料（已上傳的檔案、驗證結果、評估結果等）
//   3. 根據目前頁面決定要顯示哪個頁面元件
//   4. 把「換頁」和「操作」的函式傳給子元件
//
// React 概念說明：
//   useState → 「記憶格子」，存放會改變的資料；資料一改變，畫面就自動更新
//   useMemo  → 「快取計算結果」，只有依賴的資料改變時才重新計算，避免浪費效能
//   props    → 父元件傳給子元件的參數，就像函式的參數一樣
// ========================================================

// useMemo 用來快取計算、useState 用來記住狀態
import { useMemo, useState } from "react";

// 匯入版面配置元件（外框：左側選單 + 頂部標題列）
import AppLayout from "./components/layout/AppLayout";

// 匯入五個頁面元件
import UploadPage from "./pages/UploadPage";
import ValidationPage from "./pages/ValidationPage";
import SetupPage from "./pages/SetupPage";
import ResultsPage from "./pages/ResultsPage";
import SavedComparisonsPage from "./pages/SavedComparisonsPage";

// 匯入導覽相關的常數（選單清單、每頁標題）
import { navigationItems, pageTitles } from "./utils/navigation";

// 匯入「服務層」函式（負責資料操作，目前都是假資料）
import { uploadDatasets, getValidationSummary } from "./services/datasetService";
import { getDefaultEvaluationConfig, runEvaluation } from "./services/evaluationService";
import { getSavedComparisons, saveCurrentComparison } from "./services/comparisonService";

// 匯入 TypeScript 型別定義（讓編輯器知道每個變數的資料結構長什麼樣）
import type {
  EvaluationConfig,
  EvaluationResult,
  PageKey,
  SavedComparison,
  SharedPageProps,
  UploadFilesInput,
  UploadedDatasets,
  ValidationSummary,
} from "./types/contracts";

// App 是整個應用程式的根元件，export default 讓 main.tsx 可以匯入它
export default function App() {
  // ── 應用程式狀態（State）─────────────────────────────────
  // 每個 useState 就是一個「記憶格子」
  // 格子裡的值改變時，React 會自動重新渲染畫面

  // 目前顯示哪個頁面（預設從 "upload" 開始）
  const [currentPage, setCurrentPage] = useState<PageKey>("upload");

  // 使用者上傳的兩個檔案（真實資料 + 合成資料）
  const [uploadedDatasets, setUploadedDatasets] = useState<UploadedDatasets>({
    realDataset: null,
    syntheticDataset: null,
  });

  // 驗證結果（上傳後自動產生，檢查欄位是否對齊）
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);

  // 評估設定（使用者在 Setup 頁選的指標和欄位）
  const [evaluationConfig, setEvaluationConfig] = useState<EvaluationConfig>(
    getDefaultEvaluationConfig() // 預設值：KS test、Chi-square、Mean Difference
  );

  // 評估結果（按下 Run Evaluation 後產生的相似度分數）
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // 儲存過的比較記錄清單（初始值從假資料載入）
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>(
    getSavedComparisons()
  );

  // ── 計算哪些步驟已完成（用來在側邊欄顯示打勾）────────────
  // useMemo 讓這個計算只在依賴的資料改變時才重跑，不會每次渲染都重算
  const completedSteps = useMemo(() => {
    const steps = new Set<PageKey>();
    if (uploadedDatasets.realDataset || uploadedDatasets.syntheticDataset) steps.add("upload");
    if (validationSummary) steps.add("validation");
    if (evaluationResult) steps.add("setup");
    if (evaluationResult) steps.add("results");
    if (savedComparisons.length > 0) steps.add("saved");
    return steps;
  }, [uploadedDatasets, validationSummary, evaluationConfig, evaluationResult, savedComparisons]);

  // ── 操作函式（Event Handlers）──────────────────────────────
  // 這些函式會被傳給子頁面元件，讓子頁面可以「告訴 App 發生了什麼事」

  // 使用者在 Upload 頁按下「Validate & Continue」時執行
  const handleUploadContinue = async (files: UploadFilesInput) => {
    // 模擬上傳（目前是假的，直接回傳 mock 資料）
    const datasets = await uploadDatasets(files);
    // 模擬取得驗證結果
    const summary = await getValidationSummary();
    // 把結果存進狀態
    setUploadedDatasets(datasets);
    setValidationSummary(summary);
    // 自動跳到驗證頁
    setCurrentPage("validation");
  };

  // 使用者在 Setup 頁按下「Run Evaluation」時執行
  const handleRunEvaluation = async (config: EvaluationConfig) => {
    setEvaluationConfig(config); // 記住使用者選的設定
    const result = await runEvaluation(config); // 模擬跑統計（目前回傳假資料）
    setEvaluationResult(result);
    setCurrentPage("results"); // 自動跳到結果頁
  };

  // 使用者在 Results 頁按下「Save Comparison」時執行
  const handleSaveComparison = () => {
    if (!evaluationResult) return; // 沒有結果就不做任何事
    const updated = saveCurrentComparison({ evaluationConfig, evaluationResult, uploadedDatasets });
    setSavedComparisons(updated); // 更新儲存清單
    setCurrentPage("saved"); // 跳到儲存記錄頁
  };

  // ── 共享 props（每個頁面都需要的資料和函式打包在一起）────
  // 這樣就不用每個頁面一個個傳，用 {...sharedPageProps} 展開就好
  const sharedPageProps: SharedPageProps = {
    uploadedDatasets,
    validationSummary,
    evaluationConfig,
    evaluationResult,
    savedComparisons,
    goToPage: setCurrentPage, // 讓子頁面可以切換頁面
  };

  // ── 決定要顯示哪個頁面────────────────────────────────────
  // 根據 currentPage 的值，回傳對應的頁面元件
  // {...sharedPageProps} 是「展開運算子」，等同於把所有 key 一個個傳進去
  const renderPage = () => {
    switch (currentPage) {
      case "upload":
        return <UploadPage {...sharedPageProps} onContinue={handleUploadContinue} />;
      case "validation":
        return <ValidationPage {...sharedPageProps} />;
      case "setup":
        return <SetupPage {...sharedPageProps} onRunEvaluation={handleRunEvaluation} />;
      case "results":
        return <ResultsPage {...sharedPageProps} onSaveComparison={handleSaveComparison} />;
      case "saved":
        return <SavedComparisonsPage {...sharedPageProps} />;
      default:
        // 萬一頁面名稱不對，預設回到上傳頁
        return <UploadPage {...sharedPageProps} onContinue={handleUploadContinue} />;
    }
  };

  // ── 渲染畫面────────────────────────────────────────────────
  // AppLayout 是外框（左側選單 + 頂部標題），{renderPage()} 是中間的內容區塊
  return (
    <AppLayout
      navigationItems={navigationItems}   // 側邊欄的選單清單
      currentPage={currentPage}           // 目前頁面（用來高亮顯示選中的選單項目）
      pageTitle={pageTitles[currentPage]} // 頁面標題（顯示在頂部）
      onNavigate={setCurrentPage}         // 點選單時切換頁面
      completedSteps={completedSteps}     // 哪些步驟完成了（用來顯示打勾）
    >
      {renderPage()}
    </AppLayout>
  );
}
