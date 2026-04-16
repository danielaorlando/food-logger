// Manages the "meal_logs" Firestore collection.
// Each document represents one food eaten at one meal on one day.
//
// FIRESTORE INDEX NEEDED: When the diary page first loads, Firestore may log an error
// in the browser console with a direct link to create a composite index on:
//   meal_logs (userId ASC, dateKey ASC, loggedAt ASC)
// Just click that link and wait about 1 minute. No other setup needed.

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { MealLogEntry, AddMealLogPayload } from "../types/diary";

// ── ADD ───────────────────────────────────────────────────────────────────────

export async function addMealLog(payload: AddMealLogPayload): Promise<string> {
  const docRef = await addDoc(collection(db, "meal_logs"), {
    userId: payload.userId,
    dateKey: payload.dateKey,
    loggedAt: serverTimestamp(),
    meal: payload.meal,
    foodName: payload.foodName,
    caloriesPer100g: payload.caloriesPer100g,
    portionGrams: payload.portionGrams,
    totalCalories: payload.totalCalories,
    // Only include optional fields if they have values
    ...(payload.foodId ? { foodId: payload.foodId } : {}),
    ...(payload.proteinPer100g !== undefined
      ? { proteinPer100g: payload.proteinPer100g }
      : {}),
    ...(payload.fatPer100g !== undefined
      ? { fatPer100g: payload.fatPer100g }
      : {}),
    ...(payload.carbsPer100g !== undefined
      ? { carbsPer100g: payload.carbsPer100g }
      : {}),
    ...(payload.isQuickAdd ? { isQuickAdd: true } : {}),
  });
  return docRef.id;
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteMealLog(logId: string): Promise<void> {
  await deleteDoc(doc(db, "meal_logs", logId));
}

// ── REAL-TIME LISTENER ────────────────────────────────────────────────────────
//
// Returns a Firestore "unsubscribe" function — call it to stop listening.
// We use onSnapshot instead of getDocs so the diary updates in real-time
// if you log food from another device.

export function subscribeDiaryForDay(
  userId: string,
  dateKey: string,
  onData: (entries: MealLogEntry[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, "meal_logs"),
    where("userId", "==", userId),
    where("dateKey", "==", dateKey),
    orderBy("loggedAt", "asc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: MealLogEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId as string,
          dateKey: data.dateKey as string,
          loggedAt: data.loggedAt?.toDate() ?? new Date(),
          meal: data.meal as MealLogEntry["meal"],
          foodId: data.foodId as string | undefined,
          foodName: data.foodName as string,
          caloriesPer100g: data.caloriesPer100g as number,
          proteinPer100g: data.proteinPer100g as number | undefined,
          fatPer100g: data.fatPer100g as number | undefined,
          carbsPer100g: data.carbsPer100g as number | undefined,
          portionGrams: data.portionGrams as number,
          totalCalories: data.totalCalories as number,
          isQuickAdd: data.isQuickAdd as boolean | undefined,
        };
      });
      onData(entries);
    },
    (error) => {
      console.error("Diary listener failed:", error);
    },
  );
}
