// UploadPage.tsx — Step 1: dataset upload
//
// Lets the user select two CSV files:
//   - Real dataset (diabetic_data.csv)
//   - Synthetic dataset (V1_syn.csv)
// Clicking "Validate & Continue" triggers validation and moves to the next step.
//
// useState<File | null>(null):
//   File is a built-in browser object representing a selected file.
//   null is the initial value (no file chosen yet).
//
// Uncontrolled input:
//   The file input is uncontrolled — we don't bind a value prop.
//   Instead we read event.target.files in the onChange handler.
//
// ChangeEvent<HTMLInputElement>:
//   TypeScript type for an input element's onChange event.
//   event.target.files is a FileList; [0] gets the first file.
//   ?. is optional chaining — safe if files is null.

import { useState, type ChangeEvent } from "react";
import PageSection from "../components/ui/PageSection";
import SectionCard from "../components/ui/SectionCard";
import SummaryCard from "../components/ui/SummaryCard";
import PrimaryButton from "../components/ui/PrimaryButton";
import StatusBadge from "../components/ui/StatusBadge";
import type { SharedPageProps, UploadFilesInput } from "../types/contracts";

// & is TypeScript intersection — merges SharedPageProps with an extra onContinue prop
export default function UploadPage({
  uploadedDatasets,
  onContinue,
}: SharedPageProps & { onContinue: (files: UploadFilesInput) => void | Promise<void> }) {
  // Track the two selected files (null = not yet chosen)
  const [realFile, setRealFile] = useState<File | null>(null);
  const [syntheticFile, setSyntheticFile] = useState<File | null>(null);

  // Both files must be selected before the continue button is enabled
  const canContinue = Boolean(realFile && syntheticFile);

  const handleContinue = async () => {
    if (!canContinue) return;
    await onContinue({ realFile, syntheticFile });
  };

  return (
    <div className="page-stack">
      {/* Upload cards */}
      <PageSection
        title="Upload diabetes datasets"
        description="real diabetic dataset and supervisor-provided synthetic file."
      >
        <div className="two-column-grid">
          <UploadCard
            title="Real dataset"
            description="diabetic_data.csv as the real EHR baseline."
            file={realFile}
            onSelectFile={(event) => setRealFile(event.target.files?.[0] ?? null)}
          />
          <UploadCard
            title="Synthetic dataset"
            description="V1_syn.csv as the synthetic dataset."
            file={syntheticFile}
            onSelectFile={(event) => setSyntheticFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </PageSection>

      {/* Detected dataset summary — mirrors the dataset pair used throughout the prototype */}
      <PageSection
        title="Detected dataset summary"
        description="These cards mirror the dataset pair used throughout the prototype flow."
      >
        <div className="summary-grid three-up">
          {/* ?? — use left value if available, fall back to right */}
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
          {/* IDS_mapping.csv is an optional column description reference
          <SummaryCard
            label="Mapping reference"
            value="IDS_mapping.csv"
            helper="Admission, discharge, and source ID descriptions"
            badge="Optional"
            tone="warning"
          /> */}
        </div>
      </PageSection>

      {/* Page footer actions */}
      <div className="page-actions">
        <PrimaryButton variant="ghost">Reset</PrimaryButton>
        {/* disabled turns the button grey and unclickable until both files are selected */}
        <PrimaryButton onClick={handleContinue} disabled={!canContinue}>
          Validate & Continue
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── Upload card sub-component ──────────────────────────────
// Extracted to avoid duplicating the same upload dropzone HTML twice (DRY principle)
function UploadCard({
  title,
  description,
  file,         // currently selected file (null if none)
  onSelectFile, // called when user picks a file
}: {
  title: string;
  description: string;
  file: File | null;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <SectionCard title={title} subtitle={description} className="upload-card">
      {/* Wrapping <input type="file"> in a <label> makes the entire dropzone area clickable */}
      <label className="upload-dropzone">
        {/* accept restricts the file picker to CSV and Excel files */}
        <input type="file" accept=".csv,.xlsx" onChange={onSelectFile} />

        <span className="upload-icon">↑</span>

        {/* Show file name if selected, otherwise show placeholder text */}
        <strong>{file ? file.name : "Choose a dataset file"}</strong>
        <p>
          {file
            ? `${Math.max(1, Math.round(file.size / 1024))} KB selected`
            // Math.max(1, ...) ensures at least 1 KB is shown (avoids displaying 0)
            : "Click to browse local CSV files"}
        </p>
      </label>
    </SectionCard>
  );
}
