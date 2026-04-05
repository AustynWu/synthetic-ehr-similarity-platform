// PageSection.tsx — major page section container
//
// A larger wrapper than SectionCard, representing one thematic block on a page.
// Uses the semantic <section> tag for accessibility and SEO.
//
// Structure:
//   h2 title          [optional action button]
//   description text
//   ─────────────────────────────────────────
//   children (cards, tables, etc.)
//
// Difference from SectionCard:
//   - PageSection is the large block; title uses h2
//   - SectionCard is the inner card; title uses h3
//   - PageSection has no background; SectionCard always has a white card background

import type { PageSectionProps } from "../../types/contracts";

export default function PageSection({
  title,
  description,
  action,   // optional right-side element (e.g. a button)
  children,
}: PageSectionProps) {
  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="section-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
