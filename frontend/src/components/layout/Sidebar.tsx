// Sidebar.tsx — left navigation menu
//
// Shows five step buttons. Each button includes:
//   - Step number (01, 02, … 05)
//   - Step name and subtitle
//   - A dot indicator (●) when the step is completed
//
// Conditional className:
//   `sidebar-link ${isActive ? "active" : ""}`
//   Adds the "active" CSS class only for the current page.
//
// .map() renders the list: each NavigationItem becomes one button.
// React uses the key prop to track list elements efficiently.

import type { NavigationItem, PageKey } from "../../types/contracts";

export default function Sidebar({
  items,
  currentPage,
  onNavigate,
  completedSteps, // Set<PageKey> — which steps have been completed
}: {
  items: NavigationItem[];
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  completedSteps: Set<PageKey>;
}) {
  return (
    // <aside> semantic tag for sidebar supplementary content
    <aside className="sidebar">
      {/* Brand / logo area */}
      <div className="sidebar-brand">
        <div className="brand-mark">EH</div>
        <div>
          <p className="brand-title">EHR Similarity</p>
          <p className="brand-subtitle">Capstone Prototype</p>
        </div>
      </div>

      {/* Step navigation */}
      <nav className="sidebar-nav">
        {items.map((item, index) => {
          const isActive = currentPage === item.key;
          const isComplete = completedSteps.has(item.key);

          return (
            <button
              key={item.key}
              type="button"
              className={`sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {/* Step number: 01, 02, 03… */}
              <span className="sidebar-step">0{index + 1}</span>

              {/* Step name and subtitle */}
              <span className="sidebar-copy">
                <span>{item.label}</span>
                <small>{item.shortLabel}</small>
              </span>

              {/* Completion indicator */}
              {isComplete && <span className="sidebar-check">●</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
