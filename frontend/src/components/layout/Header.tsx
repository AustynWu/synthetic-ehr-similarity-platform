// Header.tsx — top header bar
//
// Displays three things:
//   1. Eyebrow text (platform name, small)
//   2. Page title (h1, large)
//   3. Page description (matches current page)
//   4. Top-right "Prototype Build" badge
//
// Pure presentational component — no state, just renders from props.

import StatusBadge from "../ui/StatusBadge";
import type { PageKey } from "../../types/contracts";

// Per-page descriptions shown below the h1 title
const pageDescriptions: Record<PageKey, string> = {
  upload:     "Upload diabetic_data.csv, V1_syn.csv, and prepare the comparison workflow.",
  validation: "Review schema alignment, sparse fields, and diabetes dataset quality checks.",
  setup:      "Select evaluation methods for the diabetes dataset comparison prototype.",
  results:    "Review a fixed result summary tailored to the real and synthetic diabetes files.",
  saved:      "Browse saved diabetes comparison runs and export-ready placeholders.",
};

export default function Header({
  pageTitle,
  currentPage,
}: {
  pageTitle: string;
  currentPage: PageKey;
}) {
  return (
    <header className="top-header">
      <div>
        {/* Eyebrow — platform name above the page title */}
        <p className="eyebrow">Synthetic vs Real Diabetes EHR Similarity Platform</p>

        {/* h1 — one per page */}
        <h1>{pageTitle}</h1>

        {/* Per-page description */}
        <p className="page-description">{pageDescriptions[currentPage]}</p>
      </div>

      {/* Prototype reminder badge */}
      <div className="header-actions">
        <StatusBadge tone="info">Prototype Build</StatusBadge>
      </div>
    </header>
  );
}
