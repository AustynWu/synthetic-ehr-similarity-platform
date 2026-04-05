// AppLayout.tsx — outer app shell (layout wrapper)
//
// Defines the page skeleton:
//   Left  : Sidebar (step navigation)
//   Right top : Header (page title)
//   Right body: {children} (active page content)
//
// children prop:
//   Represents whatever is placed between <AppLayout> tags.
//   Lets AppLayout wrap any page without knowing its content.
//
// CSS classes:
//   app-shell   — CSS Grid / Flexbox splits the page into left and right columns
//   app-main    — right-side container (header + content)
//   app-content — scrollable content area with padding

import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { NavigationItem, PageKey } from "../../types/contracts";

export default function AppLayout({
  navigationItems,
  currentPage,
  pageTitle,
  onNavigate,
  completedSteps,
  children,
}: {
  navigationItems: NavigationItem[];
  currentPage: PageKey;
  pageTitle: string;
  onNavigate: (page: PageKey) => void;
  completedSteps: Set<PageKey>;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      {/* Left sidebar */}
      <Sidebar
        items={navigationItems}
        currentPage={currentPage}
        onNavigate={onNavigate}
        completedSteps={completedSteps}
      />

      {/* Right main area */}
      <div className="app-main">
        <Header pageTitle={pageTitle} currentPage={currentPage} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
