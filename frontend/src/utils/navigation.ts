// navigation.ts — static navigation config
// Keeps sidebar items and page titles separate from App.tsx logic.

import type { NavigationItem, PageKey } from "../types/contracts";

// Sidebar items — order matches the intended user workflow
export const navigationItems: NavigationItem[] = [
  { key: "upload",     label: "Upload Datasets",        shortLabel: "Start comparison"  },
  { key: "validation", label: "Validation & Summary",   shortLabel: "Review structure"  },
  { key: "setup",      label: "Evaluation Setup",       shortLabel: "Choose metrics"    },
  { key: "results",    label: "Results Dashboard",      shortLabel: "View summary"      },
  { key: "saved",      label: "Saved Comparisons",      shortLabel: "Manage runs"       },
];

// Page titles shown in the Header component.
// Record<PageKey, string> ensures all five pages are covered — TypeScript will warn if one is missing.
export const pageTitles: Record<PageKey, string> = {
  upload:     "Upload Datasets",
  validation: "Data Validation & Summary",
  setup:      "Evaluation Setup",
  results:    "Results Dashboard",
  saved:      "Saved Comparisons & Export",
};
