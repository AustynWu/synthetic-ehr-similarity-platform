// InfoAlert.tsx — validation issue list
//
// Shows a list of validation issues, each with a colour-coded level badge.
// Used in ValidationPage to display the "Validation findings" section.
//
// Colour mapping:
//   error   → danger  (red)
//   warning → warning (yellow)
//   info    → info    (blue)
//
// Nested ternary to pick the tone:
//   level === "error" ? "danger" : level === "warning" ? "warning" : "info"

import StatusBadge from "./StatusBadge";
import type { InfoAlertProps } from "../../types/contracts";

export default function InfoAlert({ title, items }: InfoAlertProps) {
  return (
    <div className="info-alert">
      <div className="card-header">
        <h3>{title}</h3>
        <StatusBadge tone="warning">Review</StatusBadge>
      </div>

      <ul className="insight-list">
        {items.map((item) => (
          // key uses code + message to guarantee uniqueness
          <li key={`${item.code}-${item.message}`}>
            <StatusBadge
              tone={
                item.level === "error"   ? "danger"  :
                item.level === "warning" ? "warning" :
                "info"
              }
            >
              {item.level}
            </StatusBadge>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
