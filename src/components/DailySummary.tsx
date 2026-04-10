// DailySummary — groups diary entries by meal and shows calorie subtotals,
// plus Calories Out from HealthKit (when available).
// Renders below all the entries as a simple summary card.

import type { MealLogEntry, MealType } from "../types/diary";
import type { DailyEnergyData } from "../types/health";

interface Props {
  entries: MealLogEntry[];
  energyData?: DailyEnergyData | null;
  calorieGoal?: number | null;
  onEditGoal?: () => void;
}

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DailySummary({ entries, energyData, calorieGoal, onEditGoal }: Props) {
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

      {/* ── Calories In ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "1rem",
        fontWeight: "700",
        marginTop: "0.6rem",
        color: "var(--color-accent)",
      }}>
        <span>Calories In</span>
        <span>{totalCalories} kcal</span>
      </div>

      {/* ── Calories Out ─────────────────────────────────────────────── */}
      <div style={{
        marginTop: "0.75rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid var(--color-border)",
      }}>
        {energyData ? (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "1rem",
              fontWeight: "700",
              color: "#e65100",
            }}>
              <span>Calories Out</span>
              <span>{energyData.totalCaloriesOut} kcal</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "var(--color-text-muted)",
              marginTop: "0.25rem",
            }}>
              <span>Active: {energyData.activeCalories} kcal</span>
              <span>Resting: {energyData.basalCalories} kcal</span>
            </div>
          </>
        ) : (
          <div style={{
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
            fontStyle: "italic",
          }}>
            No activity data available
          </div>
        )}
      </div>
      {/* ── Calorie Goal + Remaining ─────────────────────────────────── */}
      <div style={{
        marginTop: "0.75rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid var(--color-border)",
      }}>
        {calorieGoal ? (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                Goal: {calorieGoal} kcal
              </span>
              {onEditGoal && (
                <button
                  onClick={onEditGoal}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-accent)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            {(() => {
              const activeOut = energyData?.activeCalories ?? 0;
              const remaining = calorieGoal - totalCalories + activeOut;
              const isOver = remaining < 0;
              return (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  color: isOver ? "#b71c1c" : "#2e7d32",
                }}>
                  <span>{isOver ? "Over by" : "Remaining"}</span>
                  <span>{Math.abs(remaining)} kcal</span>
                </div>
              );
            })()}
          </>
        ) : (
          onEditGoal && (
            <button
              onClick={onEditGoal}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent)",
                fontSize: "0.9rem",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Set a calorie goal
            </button>
          )
        )}
      </div>
    </div>
  );
}
