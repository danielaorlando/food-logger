import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { compressImage } from "./compressImage";

export interface GeminiExtractedFood {
  name: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  countryOfOrigin: string | null;
}

const EMPTY_RESULT: GeminiExtractedFood = {
  name: null,
  caloriesPer100g: null,
  proteinPer100g: null,
  fatPer100g: null,
  carbsPer100g: null,
  countryOfOrigin: null,
};

async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve({ data: base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ExtractRequest {
  namePhoto: { data: string; mimeType: string } | null;
  nutritionPhoto: { data: string; mimeType: string } | null;
}

const callExtract = httpsCallable<ExtractRequest, GeminiExtractedFood>(
  functions,
  "extractFoodFromPhotos",
);

export async function extractFoodFromPhotos(
  namePhoto: File | null,
  nutritionPhoto: File | null,
): Promise<GeminiExtractedFood> {
  if (!namePhoto && !nutritionPhoto) return EMPTY_RESULT;

  const namePayload = namePhoto
    ? await fileToBase64(await compressImage(namePhoto))
    : null;
  const nutritionPayload = nutritionPhoto
    ? await fileToBase64(await compressImage(nutritionPhoto))
    : null;

  try {
    const result = await callExtract({
      namePhoto: namePayload,
      nutritionPhoto: nutritionPayload,
    });
    return result.data;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code ?? "";
    if (code === "functions/unavailable") {
      throw new Error("Gemini AI is temporarily overloaded. Please wait a moment and try again.");
    }
    if (code === "functions/resource-exhausted") {
      throw new Error("You've hit the rate limit. Please wait a minute before trying again.");
    }
    if (code === "functions/unauthenticated") {
      throw new Error("Please sign in to analyze photos.");
    }
    throw new Error("Gemini couldn't analyze the photos. You can fill in the details manually.");
  }
}
