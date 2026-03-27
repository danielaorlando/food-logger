// GEMINI VISION CONCEPT: This utility sends food product photos to Google's
// Gemini AI model and asks it to extract structured nutrition data.
//
// Gemini is a "multimodal" model — it can understand both text AND images
// in the same request. We send it up to 2 photos plus a text prompt, and it
// responds with a JSON object containing the food name and nutrition values.
//
// FREE TIER: Get your key at https://aistudio.google.com/app/apikey
// Then add to .env: VITE_GEMINI_API_KEY=your_key_here

import { GoogleGenerativeAI } from "@google/generative-ai";
import { compressImage } from "./compressImage";

export interface GeminiExtractedFood {
  name: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
}

const EMPTY_RESULT: GeminiExtractedFood = {
  name: null,
  caloriesPer100g: null,
  proteinPer100g: null,
  fatPer100g: null,
  carbsPer100g: null,
};

async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ data: base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EXTRACTION_PROMPT = `You are a nutrition label parser. I am sending you photos of a food product.
If Photo 1 is provided: it shows the product name/front label.
If Photo 2 is provided: it shows the nutrition facts label.

Return ONLY a valid JSON object with these exact fields:
{
  "name": "product name as it appears on the label, or null if not visible",
  "caloriesPer100g": number or null,
  "proteinPer100g": number or null,
  "fatPer100g": number or null,
  "carbsPer100g": number or null
}

IMPORTANT rules:
- All nutrition values MUST be per 100g. If the label shows per-serving values,
  convert them using the serving size shown (e.g. if serving = 30g and calories = 120kcal,
  then caloriesPer100g = 400).
- Return null for any field you cannot determine with confidence.
- Return ONLY the JSON object — no markdown code fences, no explanation, nothing else.`;

export async function extractFoodFromPhotos(
  namePhoto: File | null,
  nutritionPhoto: File | null,
): Promise<GeminiExtractedFood> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is not set in your .env file.");
    return EMPTY_RESULT;
  }

  if (!namePhoto && !nutritionPhoto) return EMPTY_RESULT;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Using gemini-2.5-flash — the latest fast model with vision support
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const parts: Parameters<typeof model.generateContent>[0] extends { contents: infer C }
      ? C extends Array<infer P> ? P[] : never[]
      : never[] = [];

    parts.push({ text: EXTRACTION_PROMPT } as never);

    if (namePhoto) {
      const compressed = await compressImage(namePhoto);
      const { data, mimeType } = await fileToBase64(compressed);
      parts.push({ inlineData: { data, mimeType } } as never);
    }
    if (nutritionPhoto) {
      const compressed = await compressImage(nutritionPhoto);
      const { data, mimeType } = await fileToBase64(compressed);
      parts.push({ inlineData: { data, mimeType } } as never);
    }

    const response = await model.generateContent({ contents: [{ role: "user", parts }] });
    const raw = response.response.text();

    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      name: typeof parsed.name === "string" ? parsed.name : null,
      caloriesPer100g: typeof parsed.caloriesPer100g === "number" ? parsed.caloriesPer100g : null,
      proteinPer100g: typeof parsed.proteinPer100g === "number" ? parsed.proteinPer100g : null,
      fatPer100g: typeof parsed.fatPer100g === "number" ? parsed.fatPer100g : null,
      carbsPer100g: typeof parsed.carbsPer100g === "number" ? parsed.carbsPer100g : null,
    };
  } catch (err) {
    console.error("Gemini extraction failed:", err);

    // Surface a user-friendly message instead of silently returning empty data
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("503") || msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("high demand")) {
      throw new Error("Gemini AI is temporarily overloaded. Please wait a moment and try again.");
    }
    if (msg.includes("429") || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("quota")) {
      throw new Error("You've hit the Gemini API rate limit. Please wait a minute before trying again.");
    }
    if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("api_key")) {
      throw new Error("Your Gemini API key is invalid or expired. Check VITE_GEMINI_API_KEY in your .env file.");
    }

    throw new Error("Gemini couldn't analyze the photos. You can fill in the details manually.");
  }
}
