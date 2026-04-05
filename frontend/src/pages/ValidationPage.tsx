// ValidationPage.tsx — Step 2: validation summary
//
// Shows the structural comparison of both datasets so the user can confirm:
//   - Row and column counts match
//   - Column types are aligned
//   - High-missingness columns are flagged
//
// This is a pure display page:
//   - Reads from props only, no state mutations
//   - Two buttons: go back or proceed
//
// Guard: if validationSummary is null (user navigated here directly),
//   show EmptyState and direct them to upload first.

import PageSection from "../components/ui/PageSection";
// SummaryCard was removed — SectionCard + custom stat rows can show multiple stats in one card.
import SectionCard from "../components/ui/SectionCard";
import DataTable from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import InfoAlert from "../components/ui/InfoAlert";
import PrimaryButton from "../components/ui/PrimaryButton";
import EmptyState from "../components/ui/EmptyState";
import type { DataTableColumn, SchemaComparisonRow, SharedPageProps, StatusTone } from "../types/contracts";

export default function ValidationPage({ validationSummary, goToPage }: SharedPageProps) {
  // Guard: no validation data available
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

  // Row count difference (used for the diff banner below the dataset cards)
  const rowDiff = validationSummary.syntheticDataset.rowCount - validationSummary.realDataset.rowCount;
  const rowDiffPct = (Math.abs(rowDiff) / validationSummary.realDataset.rowCount * 100).toFixed(1);
  // Colour: green <5%, yellow 5–20%, red >20%
  const rowDiffTone: StatusTone =
    Number(rowDiffPct) < 5 ? "success" : Number(rowDiffPct) < 20 ? "warning" : "danger";

  // Badge colour based on missing rate: >50% red, >20% yellow, >0% blue, 0% green
  const missTone = (v: number): StatusTone =>
    v > 50 ? "danger" : v > 20 ? "warning" : v > 0 ? "info" : "success";

  // Schema comparison table column definitions
  const columns: DataTableColumn<SchemaComparisonRow>[] = [
    { key: "columnName", label: "Column" },
    {
      // Show one type if both match; show "real → synthetic" in red if they differ
      key: "realType",
      label: "Type",
      render: (_v, row) =>
        row.realType === row.syntheticType
          ? <span>{row.realType}</span>
          : <StatusBadge tone="danger">{row.realType} → {row.syntheticType}</StatusBadge>,
    },
    {
      key: "realMissingRate",
      label: "Real Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      key: "syntheticMissingRate",
      label: "Synthetic Missing %",
      render: (v) => {
        const n = v as number;
        return <StatusBadge tone={missTone(n)}>{n}%</StatusBadge>;
      },
    },
    {
      // Diff = absolute difference between the two missing rates.
      // Smaller is better. >5% red, >1% yellow, otherwise green.
      // key "diff" does not exist on SchemaComparisonRow — render calculates it directly from row.
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
      {/* Dataset stat cards */}
      <PageSection
        title="Validation summary"
        description="Review schema alignment and high-missing diabetes fields before running the first comparison."
      >
        {/*
          Two-column layout: real dataset on the left, synthetic on the right.
          Allows natural side-by-side comparison.
          SectionCard (white card container) + dataset-stat-row (label left, value right).
        */}
        <div className="two-column-grid">

          {/* Left: real dataset stats */}
          <SectionCard
            title="Real Dataset"
            subtitle={validationSummary.realDataset.fileName}
          >
            <div className="dataset-stat-list">

              <div className="dataset-stat-row">
                <span>Rows</span>
                {/* toLocaleString adds thousands separators: 101766 → "101,766" */}
                <strong>{validationSummary.realDataset.rowCount.toLocaleString()}</strong>
              </div>

              <div className="dataset-stat-row">
                <span>Columns</span>
                <strong>{validationSummary.realDataset.columnCount}</strong>
              </div>

              {/* Columns with any missing values */}
              <div className="dataset-stat-row">
                <span>Columns with missing</span>
                <strong>
                  {validationSummary.realDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.realDataset.columnCount} columns
                  </span>
                </strong>
              </div>

              {/*
                Missing value count + percentage of all cells.
                Formula: missing ÷ (rows × columns) × 100
                The percentage gives immediate intuition (e.g. "7.3% of cells are empty").
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

              {/* Duplicate rows + percentage of total rows */}
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

          {/* Right: synthetic dataset stats — same structure, different data source */}
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

              <div className="dataset-stat-row">
                <span>Columns with missing</span>
                <strong>
                  {validationSummary.syntheticDataset.missingColumnCount}
                  <span className="stat-sub">
                    / {validationSummary.syntheticDataset.columnCount} columns
                  </span>
                </strong>
              </div>

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

        {/* Row count diff banner — colour reflects severity (green <5% / yellow 5-20% / red >20%) */}
        <div className={`row-count-diff row-count-diff--${rowDiffTone}`}>
          {rowDiff === 0
            ? "Row counts match exactly between both datasets."
            : `Synthetic has ${Math.abs(rowDiff).toLocaleString()} ${rowDiff > 0 ? "more" : "fewer"} rows than Real (${rowDiffPct}% difference).`}
        </div>
      </PageSection>

      {/* Schema comparison table — full width */}
      <SectionCard
        title="Schema comparison"
        subtitle="Columns with highest missingness shown first. Type mismatches and large Diff values need attention before proceeding."
      >
        <DataTable<SchemaComparisonRow>
          columns={columns}
          rows={validationSummary.schemaComparison}
        />
      </SectionCard>

      {/* Validation findings — moved below the table so warnings are easy to spot */}
      <InfoAlert title="Validation findings" items={validationSummary.issues} />

      {/* Page footer actions */}
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
