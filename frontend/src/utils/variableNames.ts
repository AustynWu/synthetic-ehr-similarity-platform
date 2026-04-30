// variableNames.ts — convert raw column names to readable display names
//
// Strategy: snake_case → Title Case only.
// No hardcoded mapping — works for any dataset.
// Example: "time_in_hospital" → "Time In Hospital"
//          "num_lab_procedures" → "Num Lab Procedures"
//          "A1Cresult" → "A1Cresult" (no underscores, returned as-is with capital first letter)

export function getVariableDisplayName(rawName: string): string {
  const parts = rawName.split("_");

  // If no underscores, just capitalise the first letter and return
  if (parts.length === 1) {
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }

  // Capitalise first letter of each word, leave the rest lowercase
  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
