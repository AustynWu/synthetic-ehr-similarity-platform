// SectionCard.tsx — white card container
//
// A card with a white background, rounded corners, and a shadow.
// Used to wrap most content blocks across all pages.
//
// Structure:
//   title (bold)
//   subtitle (grey)
//   ─────────────
//   children (any content)
//
// Flexibility:
//   - title and subtitle are optional (header is hidden if both are absent)
//   - className accepts extra CSS classes (e.g. "upload-card")
//   - children is whatever the caller places inside
//
// (title || subtitle) && ... — conditional render:
//   if both are falsy (undefined/empty string), the header div is not rendered at all.

import type { SectionCardProps } from "../../types/contracts";

export default function SectionCard({
  title,
  subtitle,
  children,
  className = "", // default to empty string so the trim below works correctly
}: SectionCardProps) {
  return (
    // .trim() removes any trailing space when className is empty
    <div className={`section-card ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="card-header">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      )}
      {children}
    </div>
  );
}
