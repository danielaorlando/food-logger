// MealEntry — a single logged food item row.
// Shows food name, meal badge, grams, calorie count, and a delete button.

import type { MealLogEntry } from "../types/diary";
import { deleteMealLog } from "../utils/diaryDb";

interface Props {
  entry: MealLogEntry;
}

const MEAL_COLORS: Record<MealLogEntry["meal"], { bg: string; color: string }> = {
  breakfast: { bg: "rgba(255, 193, 7, 0.15)", color: "#b07d00" },
  lunch: { bg: "rgba(76, 175, 80, 0.15)", color: "#2e7d32" },
  dinner: { bg: "rgba(33, 150, 243, 0.15)", color: "#1565c0" },
  snack: { bg: "rgba(156, 39, 176, 0.15)", color: "#6a1b9a" },
};

export function MealEntry({ entry }: Props) {
  const mealColor = MEAL_COLORS[entry.meal];

  async function handleDelete() {
    await deleteMealLog(entry.id);
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.6rem 0.75rem",
      borderRadius: "0.6rem",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
    }}>
      {/* Food name */}
      <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: "500" }}>
        {entry.foodName}
      </span>

      {/* Portion */}
      <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", flexShrink: 0 }}>
        {entry.portionGrams}g
      </span>

      {/* Calories */}
      <span style={{
        fontSize: "0.85rem",
        fontWeight: "700",
        color: "var(--color-accent)",
        flexShrink: 0,
        minWidth: "52px",
        textAlign: "right",
      }}>
        {entry.totalCalories} kcal
      </span>

      {/* Meal badge */}
      <span style={{
        fontSize: "0.7rem",
        fontWeight: "600",
        background: mealColor.bg,
        color: mealColor.color,
        borderRadius: "0.25rem",
        padding: "0.15rem 0.45rem",
        flexShrink: 0,
        textTransform: "capitalize",
      }}>
        {entry.meal}
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
          padding: "0.15rem 0.25rem",
          lineHeight: 1,
          flexShrink: 0,
        }}
        title="Remove entry"
        aria-label="Remove entry"
      >
        ×
      </button>
    </div>
  );
}
