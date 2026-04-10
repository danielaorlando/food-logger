// HealthKit service — reads calorie-burn data from Apple HealthKit on iOS.
//
// This only works on iOS (native Capacitor app). On web, every function
// returns null/false so HealthKit code never runs.
//
// We use @capgo/capacitor-health as the bridge between JavaScript and
// Apple's native HealthKit framework.

import { Capacitor } from "@capacitor/core";
import { Health } from "@capgo/capacitor-health";
import { upsertDailyEnergy } from "./healthDb";

// ── PLATFORM CHECK ───────────────────────────────────────────────────────────
// Same pattern as src/firebase.ts line 12 — check if we're on iOS.

export function isHealthKitAvailable(): boolean {
  return Capacitor.getPlatform() === "ios";
}

// ── REQUEST PERMISSIONS ──────────────────────────────────────────────────────
// Triggers the iOS HealthKit permission dialog. The user sees the
// NSHealthShareUsageDescription text from Info.plist and chooses Allow or Deny.

export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;

  await Health.requestAuthorization({
    read: ["calories", "basalCalories"],
    write: [],
  });
  return true;
}

// ── READ ENERGY DATA FOR A SINGLE DAY ────────────────────────────────────────
// Queries HealthKit for all energy samples on the given day, sums them,
// and returns { activeCalories, basalCalories, totalCaloriesOut }.
//
// Returns null on web (no HealthKit) or if no data is available.

export async function readEnergyForDay(dateKey: string): Promise<{
  activeCalories: number;
  basalCalories: number;
  totalCaloriesOut: number;
} | null> {
  if (!isHealthKitAvailable()) return null;

  // Build start-of-day and end-of-day timestamps for the query.
  // dateKey is "YYYY-MM-DD", e.g. "2026-04-09"
  const startDate = new Date(dateKey + "T00:00:00").toISOString();
  const endDate = new Date(dateKey + "T23:59:59").toISOString();

  // Query both energy types at the same time (Promise.all runs them in parallel).
  // "calories" = Active Energy Burned (movement, exercise)
  // "basalCalories" = Basal Energy Burned (resting metabolism)
  const [activeResult, basalResult] = await Promise.all([
    Health.readSamples({
      dataType: "calories",
      startDate,
      endDate,
      limit: 0, // 0 = no limit, return all samples for the day
    }),
    Health.readSamples({
      dataType: "basalCalories",
      startDate,
      endDate,
      limit: 0,
    }),
  ]);

  // Each result contains an array of samples. A single day can have dozens
  // of samples (one per hour from Apple Watch, one per workout, etc.).
  // We sum all sample values to get the daily total.
  const activeCalories = Math.round(
    activeResult.samples.reduce((sum, s) => sum + s.value, 0),
  );
  const basalCalories = Math.round(
    basalResult.samples.reduce((sum, s) => sum + s.value, 0),
  );

  return {
    activeCalories,
    basalCalories,
    totalCaloriesOut: activeCalories + basalCalories,
  };
}

// ── SYNC HEALTHKIT → FIRESTORE ───────────────────────────────────────────────
// Reads HealthKit data for the given day and writes it to Firestore.
// This is the "bridge" that makes iOS-only data available to the web app.
// No-op on web (isHealthKitAvailable returns false inside readEnergyForDay).

export async function syncHealthDataForDay(
  userId: string,
  dateKey: string,
): Promise<void> {
  const energy = await readEnergyForDay(dateKey);

  // Only write to Firestore if there's real data. This way, a missing doc
  // in Firestore clearly means "never synced" rather than "synced but zero."
  if (!energy || (energy.activeCalories === 0 && energy.basalCalories === 0)) {
    return;
  }

  await upsertDailyEnergy({
    userId,
    dateKey,
    ...energy,
  });
}
