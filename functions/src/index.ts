import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const ping = onCall((request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return { ok: true, uid: request.auth.uid };
});

interface PhotoPayload {
  data: string;
  mimeType: string;
}

interface ExtractRequest {
  namePhoto: PhotoPayload | null;
  nutritionPhoto: PhotoPayload | null;
}

interface GeminiExtractedFood {
  name: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  countryOfOrigin: string | null;
}

const EMPTY: GeminiExtractedFood = {
  name: null,
  caloriesPer100g: null,
  proteinPer100g: null,
  fatPer100g: null,
  carbsPer100g: null,
  countryOfOrigin: null,
};

const EXTRACTION_PROMPT = `You are a nutrition label parser. I am sending you photos of a food product.
If Photo 1 is provided: it shows the product name/front label.
If Photo 2 is provided: it shows the nutrition facts label.

Return ONLY a valid JSON object with these exact fields:
{
  "name": "product name as it appears on the label, or null if not visible",
  "caloriesPer100g": number or null,
  "proteinPer100g": number or null,
  "fatPer100g": number or null,
  "carbsPer100g": number or null,
  "countryOfOrigin": "country of origin — look for explicit text like 'Made in Italy' or 'Product of Argentina'. If not found, infer the most likely country from clues such as the product name language, brand, nutrition label format (e.g. kJ vs kcal, mandatory nutrients), and packaging style. Return a country name or null only if you truly cannot determine it."
}

IMPORTANT rules:
- All nutrition values MUST be per 100g. If the label shows per-serving values, convert them.
- Return null for any field you cannot determine with confidence.
- Return ONLY the JSON object — no markdown code fences, no explanation, nothing else.`;

export const extractFoodFromPhotos = onCall<ExtractRequest>(
  {
    secrets: [GEMINI_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    // TODO(rate-limit): when iOS App Check lands, add a per-uid daily counter
    // check here via a Firestore transaction before calling Gemini.

    const { namePhoto, nutritionPhoto } = request.data ?? {};
    if (!namePhoto && !nutritionPhoto) return EMPTY;

    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
        { text: EXTRACTION_PROMPT },
      ];
      if (namePhoto) parts.push({ inlineData: namePhoto });
      if (nutritionPhoto) parts.push({ inlineData: nutritionPhoto });

      const response = await model.generateContent({ contents: [{ role: "user", parts }] });
      const raw = response.response.text();
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        name: typeof parsed.name === "string" ? parsed.name : null,
        caloriesPer100g: typeof parsed.caloriesPer100g === "number" ? parsed.caloriesPer100g : null,
        proteinPer100g: typeof parsed.proteinPer100g === "number" ? parsed.proteinPer100g : null,
        fatPer100g: typeof parsed.fatPer100g === "number" ? parsed.fatPer100g : null,
        carbsPer100g: typeof parsed.carbsPer100g === "number" ? parsed.carbsPer100g : null,
        countryOfOrigin: typeof parsed.countryOfOrigin === "string" ? parsed.countryOfOrigin : null,
      } satisfies GeminiExtractedFood;
    } catch (err) {
      logger.error("Gemini extraction failed", err);
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("503") || /unavailable|high demand/i.test(msg)) {
        throw new HttpsError("unavailable", "Gemini is temporarily overloaded. Try again in a moment.");
      }
      if (msg.includes("429") || /rate|quota/i.test(msg)) {
        throw new HttpsError("resource-exhausted", "Rate limit hit. Please wait a minute.");
      }
      if (msg.includes("401") || msg.includes("403") || /api_key/i.test(msg)) {
        throw new HttpsError("internal", "Vision service is misconfigured. Please try again later.");
      }
      throw new HttpsError("internal", "Couldn't analyze the photos. You can fill in the details manually.");
    }
  },
);
