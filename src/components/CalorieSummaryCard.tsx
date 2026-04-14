// CalorieSummaryCard — visual calorie ring + stats at the top of the diary page.
//
// Shows three numbers (eaten / burned / goal) in a row, plus a circular
// progress ring that fills as you eat toward your daily goal. The ring
// turns orange when you go over budget.

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import type { DailyEnergyData } from "../types/health";

const isNative = Capacitor.isNativePlatform();

interface Props {
  caloriesEaten: number;
  energyData: DailyEnergyData | null;
  calorieGoal: number;
  onEditGoal: () => void;
}

// Colors matched to the app icon (teal/green/orange palette)
const TEAL = "#2ABFAB";
const TEAL_LIGHT = "#E0F5F1";
const ORANGE = "#E07B4A";

export function CalorieSummaryCard({
  caloriesEaten,
  energyData,
  calorieGoal,
  onEditGoal,
}: Props) {
  const activeCalories = energyData?.activeCalories ?? 0;
  const basalCalories = energyData?.basalCalories ?? 0;
  const totalBurned = energyData?.totalCaloriesOut ?? 0;

  // On iOS, burned breakdown is hidden until the user taps the burned row
  const [showBurnedBreakdown, setShowBurnedBreakdown] = useState(false);

  // "Remaining" = goal − eaten + active exercise calories
  // (resting calories don't count — they're already baked into your goal)
  const remaining = calorieGoal - caloriesEaten + activeCalories;
  const isOver = remaining < 0;

  // Progress percentage: how much of the goal you've eaten (capped at 100 for the ring)
  const percentage = calorieGoal > 0
    ? Math.min((caloriesEaten / calorieGoal) * 100, 100)
    : 0;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.75rem",
        padding: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {/* ── Left column: Eaten / Burned / Goal rows ────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {/* Eaten */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <img src="/EatenCalories-Icon.png" alt="" style={{ width: "1.5rem", height: "1.5rem", objectFit: "contain" }} />
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", width: "3.5rem" }}>Eaten</span>
            <span style={{ fontSize: "1rem", fontWeight: "700" }}>{caloriesEaten} kcal</span>
          </div>

          {/* Burned */}
          <div
            onClick={isNative ? () => setShowBurnedBreakdown((v) => !v) : undefined}
            style={{ cursor: isNative ? "pointer" : "default" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <img src="/BurnedCalories-Icon.png" alt="" style={{ width: "1.5rem", height: "1.5rem", objectFit: "contain" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", width: "3.5rem" }}>Burned</span>
              <span style={{ fontSize: "1rem", fontWeight: "700" }}>{totalBurned} kcal</span>
            </div>
            {/* On web: always visible inline. On iOS: toggled, stacked vertically */}
            {isNative ? (
              showBurnedBreakdown && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--color-text-muted)",
                    marginLeft: "calc(1.5rem + 0.6rem + 3.5rem + 0.6rem)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                    marginTop: "0.2rem",
                  }}
                >
                  <span>Active: {activeCalories}</span>
                  <span>Rest: {basalCalories}</span>
                </div>
              )
            ) : (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--color-text-muted)",
                  marginLeft: "calc(1.5rem + 0.6rem + 3.5rem + 0.6rem)",
                }}
              >
                Active: {activeCalories} · Rest: {basalCalories}
              </div>
            )}
          </div>

          {/* Goal — whole row is tappable to edit (no separate Edit button) */}
          <div
            onClick={onEditGoal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              cursor: "pointer",
            }}
          >
            <img src="/Target-Icon.png" alt="" style={{ width: "1.5rem", height: "1.5rem", objectFit: "contain" }} />
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", width: "3.5rem" }}>Goal</span>
            <span style={{ fontSize: "1rem", fontWeight: "700" }}>{calorieGoal} kcal</span>
          </div>
        </div>

        {/* ── Right column: Circular progress ring ───────────────────── */}
        <div style={{ width: 110, height: 110, position: "relative" }}>
          <CircularProgressbar
            value={percentage}
            styles={buildStyles({
              pathColor: isOver ? ORANGE : TEAL,
              trailColor: TEAL_LIGHT,
              strokeLinecap: "round",
            })}
            strokeWidth={10}
          />
          {/* Center text overlay — positioned absolutely over the SVG */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "1.3rem",
                fontWeight: "700",
                color: isOver ? ORANGE : "var(--color-text)",
                lineHeight: 1.1,
              }}
            >
              {Math.abs(remaining)}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: isOver ? ORANGE : "var(--color-text-muted)",
                marginTop: "0.1rem",
              }}
            >
              {isOver ? "kcal over" : "kcal left"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
