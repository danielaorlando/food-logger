// Manages the "daily_energy" Firestore collection.
// Each document represents one day's calorie-burn summary for one user.
//
// Unlike meal_logs (many docs per day, auto-generated IDs), daily_energy
// uses a deterministic ID: {userId}_{dateKey}. This means syncing the same
// day twice just overwrites the existing doc — no duplicates.

import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { DailyEnergyData, UserProfile } from "../types/health";

// ── UPSERT (create or overwrite) ─────────────────────────────────────────────
//
// Uses setDoc instead of addDoc because there's exactly ONE energy summary
// per user per day. The doc ID is deterministic: "abc123_2026-04-09".
// If the doc already exists, setDoc overwrites it with fresh data.

export async function upsertDailyEnergy(
  data: Omit<DailyEnergyData, "lastSyncedAt">,
): Promise<void> {
  const docId = `${data.userId}_${data.dateKey}`;
  await setDoc(doc(db, "daily_energy", docId), {
    ...data,
    lastSyncedAt: serverTimestamp(),
  });
}

// ── REAL-TIME LISTENER ───────────────────────────────────────────────────────
//
// Listens to a single document (not a query) since there's only one energy
// doc per user per day. Returns null if no doc exists yet (iOS hasn't synced).

export function subscribeDailyEnergy(
  userId: string,
  dateKey: string,
  onData: (data: DailyEnergyData | null) => void,
): Unsubscribe {
  const docId = `${userId}_${dateKey}`;

  return onSnapshot(
    doc(db, "daily_energy", docId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const d = snapshot.data();
      onData({
        userId: d.userId as string,
        dateKey: d.dateKey as string,
        activeCalories: d.activeCalories as number,
        basalCalories: d.basalCalories as number,
        totalCaloriesOut: d.totalCaloriesOut as number,
        lastSyncedAt: d.lastSyncedAt?.toDate() ?? new Date(),
      });
    },
    (error) => {
      console.error("Energy listener failed:", error);
    },
  );
}

// ── CALORIE GOAL ─────────────────────────────────────────────────────────────
//
// Stored in "user_profiles/{userId}". One document per user (not per day) —
// the goal is the same every day. Uses setDoc for the same upsert pattern
// as daily_energy: create if new, overwrite if it exists.

export async function setCalorieGoal(
  userId: string,
  goal: number,
): Promise<void> {
  await setDoc(doc(db, "user_profiles", userId), {
    userId,
    calorieGoal: goal,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeCalorieGoal(
  userId: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "user_profiles", userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const d = snapshot.data();
      onData({
        userId: d.userId as string,
        calorieGoal: d.calorieGoal as number,
        updatedAt: d.updatedAt?.toDate() ?? new Date(),
      });
    },
    (error) => {
      console.error("Calorie goal listener failed:", error);
    },
  );
}
