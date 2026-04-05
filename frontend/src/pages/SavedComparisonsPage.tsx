// SavedComparisonsPage.tsx — Step 5: saved comparison runs
//
// Displays all runs the user has saved:
//   - A table of runs (timestamp, dataset names, score, status)
//   - Export placeholder buttons (feature deferred to a later stage)
//
// This is the simplest page:
//   - No local state
//   - Reads only from savedComparisons prop
//   - Guard: if no runs exist, shows EmptyState pointing to the Results page

import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import DataTable from "../components/ui/DataTable";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import type { SavedComparison, SharedPageProps } from "../types/contracts";

export default function SavedComparisonsPage({ savedComparisons, goToPage }: SharedPageProps) {
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

  // Column definitions for the runs table
  const columns = [
    { key: "runName",                label: "Run Name"          },
    { key: "createdAtLabel",         label: "Created"           },
    { key: "realDatasetName",        label: "Real Dataset"      },
    { key: "syntheticDatasetName",   label: "Synthetic Dataset" },
    { key: "overallSimilarityScore", label: "Overall Score"     },
    {
      key: "status",
      label: "Status",
      type: "badge" as const,
      getTone: () => "success" as const, // all records are "completed" — green
    },
  ];

  return (
    <div className="page-stack">
      {/* Saved runs table */}
      <PageSection
        title="Saved comparisons"
        description="A simplified history page for the prototype. Export can stay as a basic placeholder at this stage."
      >
        <SectionCard
          title="Saved runs"
          subtitle="This table is enough to show that previous comparisons can be reopened and exported later."
        >
          <DataTable<SavedComparison> columns={columns} rows={savedComparisons} />
        </SectionCard>
      </PageSection>

      {/* Export placeholder — buttons are visible but not functional */}
      <SectionCard
        title="Prototype export placeholder"
        subtitle="The export concept is visible here, but the actual document generation can wait until a later stage."
      >
        <div className="action-column action-row-on-desktop">
          <PrimaryButton variant="secondary">Export PDF Summary</PrimaryButton>
          <PrimaryButton variant="ghost">View Run Details</PrimaryButton>
        </div>
      </SectionCard>

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
