// DIARY PAGE — The main feature of the food logger.
//
// Displays a daily food log: what you ate today (or any past day),
// grouped by meal, with calorie totals.
//
// You can:
//   - Search for a food and log it with a portion size
//   - Navigate between days
//   - Delete individual entries

import { useState, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { FoodSearchInput } from "../../components/FoodSearchInput";
import { MealEntry } from "../../components/MealEntry";
import { DailySummary } from "../../components/DailySummary";
import { DateNav } from "../../components/DateNav";
import { subscribeDiaryForDay, addMealLog } from "../../utils/diaryDb";
import { toDateKey } from "../../utils/dateHelpers";
import { calcPortionCalories } from "../../utils/calorieCalculator";
import type { MealLogEntry, MealType } from "../../types/diary";
import type { NutritionResult } from "../../utils/nutritionApi";
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  syncHealthDataForDay,
} from "../../utils/healthKit";
import {
  subscribeDailyEnergy,
  subscribeUserProfile,
} from "../../utils/healthDb";
import { CalorieGoalEditor } from "../../components/CalorieGoalEditor";
import { CalorieSummaryCard } from "../../components/CalorieSummaryCard";
import type { DailyEnergyData, UserProfile } from "../../types/health";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diary",
  component: DiaryPage,
});

// MEAL ORDER for display
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function DiaryPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<MealLogEntry[]>([]);

  // Selected food from search — shown in the "add portion" form
  const [selectedFood, setSelectedFood] = useState<NutritionResult | null>(
    null,
  );
  const [portionGrams, setPortionGrams] = useState("100");
  const [selectedMeal, setSelectedMeal] = useState<MealType>("breakfast");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // HealthKit energy data for the current day (iOS only, null on web)
  const [energyData, setEnergyData] = useState<DailyEnergyData | null>(null);

  // Calorie goal from user_profiles Firestore collection
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const dateKey = toDateKey(currentDate);

  // Real-time listener — re-runs whenever the user or date changes
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeDiaryForDay(user.uid, dateKey, setEntries);
    return unsubscribe; // cleanup: stop listening when date or user changes
  }, [user, dateKey]);

  // Energy data: subscribe to Firestore (all platforms) + sync from HealthKit (iOS only)
  useEffect(() => {
    if (!user) {
      setEnergyData(null);
      return;
    }

    // 1. Listen to Firestore for energy data (works on web AND iOS)
    const unsubEnergy = subscribeDailyEnergy(user.uid, dateKey, setEnergyData);

    // 2. On iOS, sync fresh HealthKit data → Firestore (no-op on web)
    if (isHealthKitAvailable()) {
      requestHealthKitPermissions().then(() => {
        syncHealthDataForDay(user.uid, dateKey);
      });
    }

    return unsubEnergy; // cleanup: stop listening when date or user changes
  }, [user, dateKey]);

  // Calorie goal: subscribe to user_profiles (same goal every day, so no dateKey dependency)
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const unsubGoal = subscribeUserProfile(user.uid, setUserProfile);
    return unsubGoal;
  }, [user]);

  async function handleAddEntry() {
    if (!user || !selectedFood || !portionGrams) return;
    const grams = parseFloat(portionGrams);
    if (isNaN(grams) || grams <= 0) return;

    setSaving(true);
    const totalCalories = calcPortionCalories(
      grams,
      selectedFood.caloriesPer100g,
    );

    // Optimistic update — show the entry immediately
    const optimisticEntry: MealLogEntry = {
      id: "temp-" + Date.now(),
      userId: user.uid,
      dateKey,
      loggedAt: new Date(),
      meal: selectedMeal,
      foodName: selectedFood.name,
      caloriesPer100g: selectedFood.caloriesPer100g,
      proteinPer100g: selectedFood.proteinPer100g,
      fatPer100g: selectedFood.fatPer100g,
      carbsPer100g: selectedFood.carbsPer100g,
      portionGrams: grams,
      totalCalories,
    };
    setEntries((prev) => [...prev, optimisticEntry]);
    setSaveError(null);

    try {
      await addMealLog({
        userId: user.uid,
        dateKey,
        meal: selectedMeal,
        foodName: selectedFood.name,
        caloriesPer100g: selectedFood.caloriesPer100g,
        proteinPer100g: selectedFood.proteinPer100g,
        fatPer100g: selectedFood.fatPer100g,
        carbsPer100g: selectedFood.carbsPer100g,
        portionGrams: grams,
        totalCalories,
      });
    } catch {
      // Remove the optimistic entry and show error
      setEntries((prev) => prev.filter((e) => e.id !== optimisticEntry.id));
      setSaveError("Couldn't save to diary. Please try again.");
      setTimeout(() => setSaveError(null), 4000);
    }

    // Reset the form — onSnapshot will replace optimistic entry with real data
    setSelectedFood(null);
    setPortionGrams("100");
    setSaving(false);
  }

  // Total calories eaten today — used by the summary ring and DailySummary
  const totalCaloriesEaten = entries.reduce((sum, e) => sum + e.totalCalories, 0);

  // Group entries by meal for display
  const entriesByMeal = MEAL_ORDER.map((meal) => ({
    meal,
    items: entries.filter((e) => e.meal === meal),
  })).filter((g) => g.items.length > 0);

  return (
    <RequireAuth>
      <h1 style={{ marginBottom: "1.5rem" }}>My Diary</h1>

      {/* Date navigation */}
      <DateNav date={currentDate} onChange={setCurrentDate} />

      {/* Calorie ring summary — always visible, even with 0 entries */}
      <CalorieSummaryCard
        caloriesEaten={totalCaloriesEaten}
        energyData={energyData}
        calorieGoal={userProfile?.calorieGoal ?? 2000}
        onEditGoal={() => setShowGoalEditor(true)}
      />

      {/* ── CALORIE GOAL EDITOR ─────────────────────────────────────────── */}
      {showGoalEditor && user && (
        <CalorieGoalEditor
          userId={user.uid}
          currentGoal={userProfile?.calorieGoal ?? null}
          onClose={() => setShowGoalEditor(false)}
        />
      )}

      {saveError && (
        <div
          style={{
            background: "#fdecea",
            color: "#b71c1c",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            fontSize: "0.9rem",
            fontWeight: "500",
          }}
        >
          {saveError}
        </div>
      )}

      {/* ── ADD FOOD FORM ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "600" }}>
          Log Food
        </h2>

        {!selectedFood ? (
          // Step 1: Search for a food
          <FoodSearchInput onSelect={setSelectedFood} />
        ) : (
          // Step 2: Enter portion and meal, then add
          <div>
            {/* Show the selected food name with a clear button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                background: "var(--color-accent-light)",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <span style={{ flex: 1, fontWeight: "600", fontSize: "0.9rem" }}>
                {selectedFood.name}
              </span>
              <span
                style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}
              >
                {selectedFood.caloriesPer100g} kcal/100g
              </span>
              <button
                onClick={() => setSelectedFood(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                  fontSize: "1.1rem",
                  padding: "0",
                  lineHeight: 1,
                }}
                title="Change food"
              >
                ×
              </button>
            </div>

            {/* Portion + meal row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <label style={{ display: "block" }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    marginBottom: "0.3rem",
                  }}
                >
                  Portion (grams)
                </div>
                <input
                  type="number"
                  value={portionGrams}
                  onChange={(e) => setPortionGrams(e.target.value)}
                  min="1"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <label style={{ display: "block" }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    marginBottom: "0.3rem",
                  }}
                >
                  Meal
                </div>
                <select
                  value={selectedMeal}
                  onChange={(e) => setSelectedMeal(e.target.value as MealType)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    border: "1.5px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    background: "var(--color-surface)",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
            </div>

            {/* Calorie preview */}
            {portionGrams &&
              !isNaN(parseFloat(portionGrams)) &&
              parseFloat(portionGrams) > 0 && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-muted)",
                    margin: "0 0 0.75rem",
                  }}
                >
                  ={" "}
                  <strong style={{ color: "var(--color-accent)" }}>
                    {calcPortionCalories(
                      parseFloat(portionGrams),
                      selectedFood.caloriesPer100g,
                    )}{" "}
                    kcal
                  </strong>
                </p>
              )}

            <button
              onClick={handleAddEntry}
              disabled={
                saving ||
                !portionGrams ||
                isNaN(parseFloat(portionGrams)) ||
                parseFloat(portionGrams) <= 0
              }
              className="btn-primary"
            >
              {saving ? "Adding..." : "Add to Diary"}
            </button>
          </div>
        )}
      </div>

      {/* ── DIARY ENTRIES ─────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--color-text-muted)",
          }}
        >
          <div style={{ marginBottom: "0.75rem" }}>
            <img src="/Plate-Icon.png" alt="Plate" style={{ height: "2.5rem" }} />
          </div>
          <p style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
            Nothing logged yet
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            Search for a food above to start tracking your meals.
          </p>
        </div>
      ) : (
        <>
          {entriesByMeal.map(({ meal, items }) => (
            <div key={meal} style={{ marginBottom: "1.25rem" }}>
              <h3
                style={{
                  margin: "0 0 0.5rem",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-muted)",
                }}
              >
                {meal}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                {items.map((entry) => (
                  <MealEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}

          <DailySummary entries={entries} />
        </>
      )}
    </RequireAuth>
  );
}
