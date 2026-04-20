// MealEntry — a single logged food item row.
// Shows food name, grams, calorie count, protein, and a delete button.

import type { MealLogEntry } from "../types/diary";
import { deleteMealLog } from "../utils/diaryDb";

// Shared grid layout for a diary row. Exported so the meal-group header in
// diary/index.tsx can reuse the exact same column widths — that's how the
// header labels stay aligned with the entry values underneath.
export const MEAL_ROW_COLUMNS = "minmax(0, 1fr) 45px 60px 55px 20px";
export const MEAL_ROW_GAP = "0.75rem";
export const MEAL_ROW_X_PADDING = "0.75rem";

interface Props {
  entry: MealLogEntry;
}

export function MealEntry({ entry }: Props) {
  // Total protein for this entry: (grams / 100) × proteinPer100g.
  // proteinPer100g is optional (Quick Add entries don't have it).
  const totalProtein = ((entry.proteinPer100g ?? 0) * entry.portionGrams) / 100;

  async function handleDelete() {
    await deleteMealLog(entry.id);
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: MEAL_ROW_COLUMNS,
      columnGap: MEAL_ROW_GAP,
      alignItems: "center",
      padding: `0.6rem ${MEAL_ROW_X_PADDING}`,
      borderRadius: "0.6rem",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
    }}>
      {/* Food name */}
      <span style={{
        fontSize: "0.9rem",
        fontWeight: "500",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {entry.foodName}
      </span>

      {/* Portion — empty cell for quick-add entries where grams are synthetic */}
      <span style={{
        fontSize: "0.8rem",
        color: "var(--color-text-muted)",
        textAlign: "right",
      }}>
        {entry.isQuickAdd ? "" : `${entry.portionGrams}g`}
      </span>

      {/* Calories */}
      <span style={{
        fontSize: "0.85rem",
        fontWeight: "700",
        color: "var(--color-accent)",
        textAlign: "right",
      }}>
        {entry.totalCalories} kcal
      </span>

      {/* Protein — "—" when we have no data (missing proteinPer100g) */}
      <span style={{
        fontSize: "0.85rem",
        fontWeight: "500",
        color: "var(--color-text-muted)",
        textAlign: "right",
      }}>
        {totalProtein > 0 ? `${Math.round(totalProtein)} g` : "—"}
      </span>

      {/* Delete */}
      <button
        onClick={handleDelete}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          fontSize: "1.1rem",
          padding: "0",
          lineHeight: 1,
        }}
        title="Remove entry"
        aria-label="Remove entry"
      >
        ×
      </button>
    </div>
  );
}
