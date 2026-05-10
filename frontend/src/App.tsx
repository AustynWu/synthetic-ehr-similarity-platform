// App.tsx — root component and state hub
//
// Responsibilities:
//   1. Track the current page (upload, validation, setup, results, saved)
//   2. Hold all cross-page shared state (uploaded files, validation results, etc.)
//   3. Render the correct page based on currentPage
//   4. Pass action handlers and data down to child pages via props
//
// useState  — stores mutable data; triggers re-render when updated
// useEffect — runs side effects after render (used here to load saved comparisons on mount)
// useMemo   — caches computed values; recalculates only when dependencies change
// props     — data passed from parent to child component

import { useEffect, useMemo, useState } from "react";

import AppLayout from "./components/layout/AppLayout";
import ErrorModal from "./components/ui/ErrorModal";

import UploadPage from "./pages/UploadPage";
import ValidationPage from "./pages/ValidationPage";
import SetupPage from "./pages/SetupPage";
import ResultsPage from "./pages/ResultsPage";
import SavedComparisonsPage from "./pages/SavedComparisonsPage";
import RunDetailPage from "./pages/RunDetailPage";

import { navigationItems, pageTitles } from "./utils/navigation";

import { uploadDatasets, getValidationSummary } from "./services/datasetService";
import { getDefaultEvaluationConfig, runEvaluation } from "./services/evaluationService";
import { getSavedComparisons, saveCurrentComparison, getComparisonDetail } from "./services/comparisonService";

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

  // Similarity scores produced after running evaluation.
  // Starts null until the user runs evaluation on the Setup page.
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // List of saved comparison runs
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);

  // Single modal error state — shown as an overlay for all network/evaluation failures
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

  // True while upload + validation is in progress — disables the button to prevent double-submit
  const [isUploading, setIsUploading] = useState(false);

  // True while evaluation is running — disables the button to prevent double-submit
  const [isEvaluating, setIsEvaluating] = useState(false);

  // True while save is in progress — disables the button to prevent double-submit
  const [isSaving, setIsSaving] = useState(false);

  // State for View Run Details — holds the selected run's full result and metadata
  const [runDetailResult, setRunDetailResult] = useState<EvaluationResult | null>(null);
  const [runDetailComparison, setRunDetailComparison] = useState<SavedComparison | null>(null);
  const [isLoadingRunDetail, setIsLoadingRunDetail] = useState(false);

  // Load saved comparisons once on mount — fetches GET /comparisons from the backend.
  useEffect(() => {
    getSavedComparisons()
      .then(setSavedComparisons)
      .catch(() => {
        setErrorModal({
          title: "Backend Unavailable",
          message: "Could not connect to the backend. Saved comparisons cannot be loaded. Please check your connection or try again shortly.",
        });
      });
  }, []);

  // ── Completed steps (shown as check marks in the sidebar) ──
  // Recalculates only when any dependency changes
  const completedSteps = useMemo(() => {
    const steps = new Set<PageKey>();
    if (uploadedDatasets.realDataset && uploadedDatasets.syntheticDataset) steps.add("upload");
    if (validationSummary) steps.add("validation");
    if (evaluationResult) steps.add("setup");
    if (evaluationResult) steps.add("results");
    if (savedComparisons.length > 0) steps.add("saved");
    return steps;
  }, [uploadedDatasets, validationSummary, evaluationResult, savedComparisons]);

  // ── Event handlers ───────────────────────────────────────
  // These functions are passed to child pages so pages can notify App of changes.

  // Called when user clicks "Validate & Continue" on Upload page.
  // Real API: passes dataset IDs from the upload response to the validate call.
  // Mock:     IDs are undefined — getValidationSummary falls back to mock data.
  const handleUploadContinue = async (files: UploadFilesInput) => {
    setIsUploading(true);
    setEvaluationResult(null);
    try {
      // Step 1: send files to backend, get back dataset IDs
      let datasets: UploadedDatasets;
      try {
        datasets = await uploadDatasets(files);
      } catch (err) {
        throw new Error(
          `File upload failed: ${err instanceof Error ? err.message : "Please check the backend is running."}`
        );
      }
      setUploadedDatasets(datasets);

      const realId = datasets.realDataset?.id;
      const synId  = datasets.syntheticDataset?.id;
      if (!realId || !synId) {
        throw new Error("Upload succeeded but dataset IDs were not returned. Please try again.");
      }
      const datasetIds = { realDatasetId: realId, syntheticDatasetId: synId };

      // Step 2: validate schema using the IDs from step 1
      let summary: ValidationSummary;
      try {
        summary = await getValidationSummary(datasetIds);
      } catch (err) {
        throw new Error(
          `Schema validation failed: ${err instanceof Error ? err.message : "Files were uploaded but could not be validated."}`
        );
      }
      setValidationSummary(summary);
      setCurrentPage("validation");
    } catch (err) {
      setErrorModal({ title: "Upload Failed", message: err instanceof Error ? err.message : "An unexpected error occurred." });
    } finally {
      setIsUploading(false);
    }
  };

  // Called when user clicks "Run Evaluation" on Setup page.
  const handleRunEvaluation = async (config: EvaluationConfig) => {
    setIsEvaluating(true);
    try {
      setEvaluationConfig(config);

      const datasetIds =
        uploadedDatasets.realDataset?.id && uploadedDatasets.syntheticDataset?.id
          ? { realDatasetId: uploadedDatasets.realDataset.id, syntheticDatasetId: uploadedDatasets.syntheticDataset.id }
          : undefined;

      const result = await runEvaluation(config, datasetIds);
      setEvaluationResult(result);
      setCurrentPage("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Dataset ID not found")) {
        setErrorModal({
          title: "Session Expired",
          message: "The server restarted and your uploaded files were lost. Please upload the files again.",
        });
        setCurrentPage("upload");
      } else {
        setErrorModal({ title: "Evaluation Failed", message: msg || "Evaluation failed. Please check the backend is running." });
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  // Called when user clicks "View" on a saved run row in SavedComparisonsPage
  const handleViewRunDetail = async (comparison: SavedComparison) => {
    setIsLoadingRunDetail(true);
    try {
      const result = await getComparisonDetail(comparison.id);
      setRunDetailResult(result);
      setRunDetailComparison(comparison);
      setCurrentPage("runDetail");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("not found") || msg.includes("404")) {
        setErrorModal({
          title: "Run Not Found",
          message: "This saved run no longer exists — the server may have restarted. Please re-run the evaluation and save again.",
        });
        setCurrentPage("saved");
      } else {
        setErrorModal({ title: "Load Failed", message: msg || "Failed to load run details." });
      }
    } finally {
      setIsLoadingRunDetail(false);
    }
  };

  // Called when user clicks "Save Comparison" on Results page
  const handleSaveComparison = async () => {
    if (!evaluationResult) return;
    setIsSaving(true);
    try {
      const updated = await saveCurrentComparison({ evaluationConfig, evaluationResult, uploadedDatasets });
      setSavedComparisons(updated);
      setCurrentPage("saved");
    } catch (err) {
      setErrorModal({ title: "Save Failed", message: err instanceof Error ? err.message : "Save failed. Please check the backend is running." });
    } finally {
      setIsSaving(false);
    }
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
        return <UploadPage {...sharedPageProps} onContinue={handleUploadContinue} isLoading={isUploading} />;
      case "validation":
        return <ValidationPage {...sharedPageProps} />;
      case "setup":
        return <SetupPage {...sharedPageProps} onRunEvaluation={handleRunEvaluation} isLoading={isEvaluating} />;
      case "results":
        return <ResultsPage {...sharedPageProps} onSaveComparison={handleSaveComparison} isLoading={isSaving} />;
      case "saved":
        return <SavedComparisonsPage {...sharedPageProps} onViewRunDetail={handleViewRunDetail} isLoadingRunDetail={isLoadingRunDetail} />;
      case "runDetail":
        return runDetailResult && runDetailComparison
          ? <RunDetailPage evaluationResult={runDetailResult} savedComparison={runDetailComparison} goToPage={setCurrentPage} />
          : <SavedComparisonsPage {...sharedPageProps} onViewRunDetail={handleViewRunDetail} isLoadingRunDetail={isLoadingRunDetail} />;
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
      {errorModal && (
        <ErrorModal
          title={errorModal.title}
          message={errorModal.message}
          onClose={() => setErrorModal(null)}
        />
      )}
    </AppLayout>
  );
}
