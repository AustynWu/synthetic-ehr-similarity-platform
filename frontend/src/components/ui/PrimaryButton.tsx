// PrimaryButton.tsx — shared button component
//
// All buttons in the app use this component for consistent styling.
//
// Variants:
//   primary   — solid blue  (main action, e.g. "Continue")
//   secondary — light grey  (secondary action, e.g. "View Details")
//   ghost     — transparent with border (back navigation, e.g. "Back")
//
// Spreading ...props:
//   ButtonHTMLAttributes<HTMLButtonElement> covers all native button attributes.
//   Merging with & lets disabled, onClick, etc. pass through without listing them individually.
//
// Default variant is "primary".

import type { ButtonHTMLAttributes } from "react";
import type { PrimaryButtonProps } from "../../types/contracts";

export default function PrimaryButton({
  children,
  variant = "primary",
  ...props // remaining native HTML button attributes (disabled, onClick, etc.)
}: PrimaryButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    // variant sets the CSS class that controls the visual style
    <button type="button" className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}
