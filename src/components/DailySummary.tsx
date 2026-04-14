// DailySummary — shows meal-by-meal calorie subtotals and a total line.
// Renders below all the entries as a simple summary card.
// (Goal, burned, and remaining info now lives in CalorieSummaryCard at the top.)

import type { MealLogEntry, MealType } from "../types/diary";

interface Props {
  entries: MealLogEntry[];
}

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DailySummary({ entries }: Props) {
  if (entries.length === 0) return null;

  const totalCalories = entries.reduce((sum, e) => sum + e.totalCalories, 0);

  const byMeal = MEAL_ORDER.map((meal) => {
    const mealEntries = entries.filter((e) => e.meal === meal);
    const mealTotal = mealEntries.reduce((sum, e) => sum + e.totalCalories, 0);
    return { meal, total: mealTotal, count: mealEntries.length };
  }).filter((m) => m.count > 0);

  return (
    <div style={{
      marginTop: "1.5rem",
      padding: "1rem",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "0.75rem",
    }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "var(--color-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Daily Summary
      </h3>

      {byMeal.map(({ meal, total }) => (
        <div key={meal} style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.9rem",
          padding: "0.25rem 0",
          color: "var(--color-text-muted)",
          borderBottom: "1px solid var(--color-border)",
          textTransform: "capitalize",
        }}>
          <span>{meal}</span>
          <span style={{ fontWeight: "600" }}>{total} kcal</span>
        </div>
      ))}

      {/* ── Total ────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "1rem",
        fontWeight: "700",
        marginTop: "0.6rem",
        color: "var(--color-accent)",
      }}>
        <span>Total</span>
        <span>{totalCalories} kcal</span>
      </div>
    </div>
  );
}
