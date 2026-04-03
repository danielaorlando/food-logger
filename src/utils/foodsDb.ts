// Manages the "foods" community database in Firestore.
// Same schema as the recipe-manager app — designed so the two collections
// can be merged later if the apps are combined.

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { CustomFood, SubmitFoodPayload } from "../types/food";

export type { CustomFood, SubmitFoodPayload };

// ── SEARCH ───────────────────────────────────────────────────────────────────
// Firestore doesn't support full-text search. We use a prefix search on
// `nameLower` (a stored lowercase copy of the name) to find foods that
// START WITH the query string.

export async function searchCustomFoods(searchQuery: string): Promise<CustomFood[]> {
  if (!searchQuery || searchQuery.trim().length < 2) return [];

  const queryLower = searchQuery.toLowerCase().trim();
  const q = query(
    collection(db, "foods"),
    where("nameLower", ">=", queryLower),
    where("nameLower", "<=", queryLower + "\uf8ff"),
    orderBy("nameLower"),
    limit(5),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name as string,
      caloriesPer100g: data.caloriesPer100g as number,
      submittedBy: data.submittedBy as string,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      proteinPer100g: data.proteinPer100g as number | undefined,
      fatPer100g: data.fatPer100g as number | undefined,
      carbsPer100g: data.carbsPer100g as number | undefined,
      countryOfOrigin: data.countryOfOrigin as string | undefined,
    };
  });
}

// ── SUBMIT ───────────────────────────────────────────────────────────────────

export async function submitCustomFood(payload: SubmitFoodPayload): Promise<string> {
  const doc = await addDoc(collection(db, "foods"), {
    name: payload.name.trim(),
    nameLower: payload.name.toLowerCase().trim(),
    caloriesPer100g: Math.round(payload.caloriesPer100g),
    submittedBy: payload.userId,
    createdAt: serverTimestamp(),
    ...(payload.proteinPer100g !== undefined ? { proteinPer100g: payload.proteinPer100g } : {}),
    ...(payload.fatPer100g !== undefined ? { fatPer100g: payload.fatPer100g } : {}),
    ...(payload.carbsPer100g !== undefined ? { carbsPer100g: payload.carbsPer100g } : {}),
    ...(payload.countryOfOrigin ? { countryOfOrigin: payload.countryOfOrigin } : {}),
  });
  return doc.id;
}

// ── DUPLICATE CHECK ──────────────────────────────────────────────────────────
// Checks if a food with the same name (case-insensitive) already exists.

export async function checkDuplicateFood(
  name: string,
): Promise<CustomFood | null> {
  const nameLower = name.toLowerCase().trim();
  if (!nameLower) return null;

  const nameQ = query(
    collection(db, "foods"),
    where("nameLower", "==", nameLower),
    limit(1),
  );
  const nameSnap = await getDocs(nameQ);
  if (nameSnap.empty) return null;

  const doc = nameSnap.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name as string,
    caloriesPer100g: data.caloriesPer100g as number,
    submittedBy: data.submittedBy as string,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    proteinPer100g: data.proteinPer100g as number | undefined,
    fatPer100g: data.fatPer100g as number | undefined,
    carbsPer100g: data.carbsPer100g as number | undefined,
    countryOfOrigin: data.countryOfOrigin as string | undefined,
  };
}

// ── GET ALL FOODS ────────────────────────────────────────────────────────────

export async function getAllFoods(): Promise<CustomFood[]> {
  const q = query(collection(db, "foods"), orderBy("nameLower"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name as string,
      caloriesPer100g: data.caloriesPer100g as number,
      submittedBy: data.submittedBy as string,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      proteinPer100g: data.proteinPer100g as number | undefined,
      fatPer100g: data.fatPer100g as number | undefined,
      carbsPer100g: data.carbsPer100g as number | undefined,
      countryOfOrigin: data.countryOfOrigin as string | undefined,
    };
  });
}
