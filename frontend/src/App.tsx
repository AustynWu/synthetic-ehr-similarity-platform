// App.tsx — root component and state hub
//
// Responsibilities:
//   1. Track the current page (upload, validation, setup, results, saved)
//   2. Hold all cross-page shared state (uploaded files, validation results, etc.)
//   3. Render the correct page based on currentPage
//   4. Pass action handlers and data down to child pages via props
//
// useState  — stores mutable data; triggers re-render when updated
// useMemo   — caches computed values; recalculates only when dependencies change
// props     — data passed from parent to child component

import { useMemo, useState } from "react";

import AppLayout from "./components/layout/AppLayout";

import UploadPage from "./pages/UploadPage";
import ValidationPage from "./pages/ValidationPage";
import SetupPage from "./pages/SetupPage";
import ResultsPage from "./pages/ResultsPage";
import SavedComparisonsPage from "./pages/SavedComparisonsPage";

import { navigationItems, pageTitles } from "./utils/navigation";

import { uploadDatasets, getValidationSummary } from "./services/datasetService";
import { getDefaultEvaluationConfig, runEvaluation } from "./services/evaluationService";
import { getSavedComparisons, saveCurrentComparison } from "./services/comparisonService";

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

export default function App() {
  // ── State ─────────────────────────────────────────────────

  // Which page is currently visible (defaults to upload)
  const [currentPage, setCurrentPage] = useState<PageKey>("upload");

  // The two uploaded files (real + synthetic)
  const [uploadedDatasets, setUploadedDatasets] = useState<UploadedDatasets>({
    realDataset: null,
    syntheticDataset: null,
  });

  // Validation result generated after upload
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);

  // Evaluation settings chosen on the Setup page
  const [evaluationConfig, setEvaluationConfig] = useState<EvaluationConfig>(
    getDefaultEvaluationConfig() // defaults: KS test, Chi-square, Mean Difference
  );

  // Similarity scores produced after running evaluation
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // List of saved comparison runs (pre-loaded from mock data)
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>(
    getSavedComparisons()
  );

  // ── Completed steps (shown as check marks in the sidebar) ──
  // Recalculates only when any dependency changes
  const completedSteps = useMemo(() => {
    const steps = new Set<PageKey>();
    if (uploadedDatasets.realDataset || uploadedDatasets.syntheticDataset) steps.add("upload");
    if (validationSummary) steps.add("validation");
    if (evaluationResult) steps.add("setup");
    if (evaluationResult) steps.add("results");
    if (savedComparisons.length > 0) steps.add("saved");
    return steps;
  }, [uploadedDatasets, validationSummary, evaluationConfig, evaluationResult, savedComparisons]);

  // ── Event handlers ───────────────────────────────────────
  // These functions are passed to child pages so pages can notify App of changes.

  // Called when user clicks "Validate & Continue" on Upload page
  const handleUploadContinue = async (files: UploadFilesInput) => {
    const datasets = await uploadDatasets(files);
    const summary = await getValidationSummary();
    setUploadedDatasets(datasets);
    setValidationSummary(summary);
    setCurrentPage("validation");
  };

  // Called when user clicks "Run Evaluation" on Setup page
  const handleRunEvaluation = async (config: EvaluationConfig) => {
    setEvaluationConfig(config);
    const result = await runEvaluation(config);
    setEvaluationResult(result);
    setCurrentPage("results");
  };

  // Called when user clicks "Save Comparison" on Results page
  const handleSaveComparison = () => {
    if (!evaluationResult) return;
    const updated = saveCurrentComparison({ evaluationConfig, evaluationResult, uploadedDatasets });
    setSavedComparisons(updated);
    setCurrentPage("saved");
  };

  // ── Shared props passed to every page ────────────────────
  // Spread with {...sharedPageProps} instead of listing each prop individually
  const sharedPageProps: SharedPageProps = {
    uploadedDatasets,
    validationSummary,
    evaluationConfig,
    evaluationResult,
    savedComparisons,
    goToPage: setCurrentPage,
  };

  // ── Render the active page ───────────────────────────────
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
        return <UploadPage {...sharedPageProps} onContinue={handleUploadContinue} />;
    }
  };

  // AppLayout provides the outer shell (sidebar + header); renderPage() fills the content area
  return (
    <AppLayout
      navigationItems={navigationItems}
      currentPage={currentPage}
      pageTitle={pageTitles[currentPage]}
      onNavigate={setCurrentPage}
      completedSteps={completedSteps}
    >
      {renderPage()}
    </AppLayout>
  );
}
