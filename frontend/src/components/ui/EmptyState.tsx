// EmptyState.tsx — empty / guard screen
//
// Shown when a page has no data to display yet.
// Guides the user to the appropriate next action.
//
// Usage contexts:
//   - ValidationPage: navigated directly without uploading first
//   - ResultsPage:    navigated directly without running evaluation first
//   - SavedComparisonsPage: no runs saved yet
//
// actionLabel and onAction are optional —
// omit them when no navigation button is needed.

import PrimaryButton from "./PrimaryButton";
import type { EmptyStateProps } from "../../types/contracts";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {/* Only render the button if actionLabel was provided */}
      {actionLabel ? (
        <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>
      ) : null}
    </div>
  );
}
