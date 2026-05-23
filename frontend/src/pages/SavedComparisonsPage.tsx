// SavedComparisonsPage.tsx — Step 5: saved comparison runs
//
// Displays all runs the user has saved.
// Each row has a "View" button that loads the full result and navigates to RunDetailPage.

import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import EmptyState from "../components/ui/EmptyState";
import type { SavedComparison, SharedPageProps, StatusTone } from "../types/contracts";

export default function SavedComparisonsPage({
  savedComparisons,
  goToPage,
  onViewRunDetail,
  isLoadingRunDetail,
  onRequestDeleteRun,
}: SharedPageProps & {
  onViewRunDetail: (comparison: SavedComparison) => void;
  isLoadingRunDetail?: boolean;
  onRequestDeleteRun?: (run: SavedComparison) => void;
}) {
  // Guard: no saved runs yet
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

  function scoreTone(score: number): StatusTone {
    if (score >= 0.85) return "success";
    if (score >= 0.70) return "warning";
    return "danger";
  }

  return (
    <div className="page-stack">
      <PageSection
        title="Saved comparisons"
        description="Click View on any run to open the full report. Export PDF is available from the detail page."
      >
        <SectionCard title="Saved runs">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run Name</th>
                  <th>Created</th>
                  <th>Real Dataset</th>
                  <th>Synthetic Dataset</th>
                  {/* Overall Score hidden — supervisor instruction: no scores, no status */}
                  {false && <th>Overall Score</th>}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {savedComparisons.map((run) => (
                  <tr key={run.id}>
                    <td>{run.runName}</td>
                    <td>{run.createdAtLabel}</td>
                    <td>{run.realDatasetName}</td>
                    <td>{run.syntheticDatasetName}</td>
                    {/* Overall Score hidden — supervisor instruction: no scores, no status */}
                    {false && (
                      <td>
                        <StatusBadge tone={scoreTone(run.overallSimilarityScore)}>
                          {run.overallSimilarityScore.toFixed(3)}
                        </StatusBadge>
                      </td>
                    )}
                    <td>
                      <StatusBadge tone={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "info"}>
                        {run.status}
                      </StatusBadge>
                    </td>
                    <td className="action-cell">
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => onViewRunDetail(run)}
                        disabled={isLoadingRunDetail}
                      >
                        {isLoadingRunDetail ? "Loading..." : "View"}
                      </PrimaryButton>
                      {onRequestDeleteRun && (
                        <PrimaryButton
                          variant="danger"
                          onClick={() => onRequestDeleteRun(run)}
                        >
                          Delete
                        </PrimaryButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </SectionCard>
      </PageSection>

      {/* Page footer actions */}
      <div className="page-actions">
        <PrimaryButton variant="ghost" onClick={() => goToPage("results")}>
          Back to Results
        </PrimaryButton>
        <PrimaryButton onClick={() => goToPage("upload")}>
          Start New Comparison
        </PrimaryButton>
      </div>
    </div>
  );
}
