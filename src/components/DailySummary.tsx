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

  // Total protein for one entry: (grams / 100) * proteinPer100g
  // proteinPer100g is optional (e.g. Quick Add entries don't have it) — treat missing as 0.
  const entryProtein = (e: MealLogEntry) =>
    ((e.proteinPer100g ?? 0) * e.portionGrams) / 100;

  const totalCalories = entries.reduce((sum, e) => sum + e.totalCalories, 0);
  const totalProtein = entries.reduce((sum, e) => sum + entryProtein(e), 0);

  const byMeal = MEAL_ORDER.map((meal) => {
    const mealEntries = entries.filter((e) => e.meal === meal);
    const mealKcal = mealEntries.reduce((sum, e) => sum + e.totalCalories, 0);
    const mealProtein = mealEntries.reduce((sum, e) => sum + entryProtein(e), 0);
    return { meal, kcal: mealKcal, protein: mealProtein, count: mealEntries.length };
  }).filter((m) => m.count > 0);

  // Show protein as rounded grams, or "—" when we have no data to show.
  const formatProtein = (g: number) => (g > 0 ? `${Math.round(g)} g` : "—");

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

      {/* Column headers — same grid template as the rows below so "Kcal"
          sits directly above the kcal values and "Protein" above the g values. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        columnGap: "1rem",
        padding: "0.25rem 0",
        fontSize: "0.7rem",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--color-text-muted)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <span />
        <span style={{ minWidth: "60px", textAlign: "right" }}>Kcal</span>
        <span style={{ minWidth: "50px", textAlign: "right" }}>Protein</span>
      </div>

      {byMeal.map(({ meal, kcal, protein }) => (
        <div key={meal} style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          columnGap: "1rem",
          fontSize: "0.9rem",
          padding: "0.25rem 0",
          color: "var(--color-text-muted)",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <span style={{ textTransform: "capitalize" }}>{meal}</span>
          <span style={{ fontWeight: "600", minWidth: "60px", textAlign: "right" }}>
            {kcal} kcal
          </span>
          <span style={{ fontWeight: "600", minWidth: "50px", textAlign: "right" }}>
            {formatProtein(protein)}
          </span>
        </div>
      ))}

      {/* ── Total ────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        columnGap: "1rem",
        fontSize: "1rem",
        fontWeight: "700",
        marginTop: "0.6rem",
        color: "var(--color-accent)",
      }}>
        <span>Total</span>
        <span style={{ minWidth: "60px", textAlign: "right" }}>
          {totalCalories} kcal
        </span>
        <span style={{ minWidth: "50px", textAlign: "right" }}>
          {formatProtein(totalProtein)}
        </span>
      </div>
    </div>
  );
}
