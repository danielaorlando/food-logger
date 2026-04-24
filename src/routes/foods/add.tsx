// ADD FOOD BY PHOTO — 4-Step Wizard
//
// Step 1 (upload)    → User selects up to 3 photos
// Step 2 (analyzing) → AI + barcode decoder runs automatically
// Step 3 (review)    → User sees extracted data, can edit, then saves
// Step 4 (saved)     → Confirmation with options to add another or go back

import { useState, useRef } from "react";
import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { extractFoodFromPhotos } from "../../utils/geminiVision";
import {
  submitCustomFood,
  checkDuplicateFood,
  findFoodByBarcode,
} from "../../utils/foodsDb";
import {
  isBarcodeScannerAvailable,
  scanBarcode,
} from "../../utils/barcodeScanner";
import type { CustomFood } from "../../types/food";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/foods/add",
  component: AddFoodPage,
  validateSearch: (s: Record<string, unknown>) => ({
    barcode: typeof s.barcode === "string" ? s.barcode : undefined,
  }),
});

// ── TYPES ────────────────────────────────────────────────────────────────────

type WizardStep = "upload" | "analyzing" | "review" | "saved";

// We store numeric values as strings so inputs can be empty ("").
// If we stored them as numbers, clearing the field would give 0 instead of "".
interface WizardState {
  step: WizardStep;
  namePhoto: File | null;
  nutritionPhoto: File | null;
  productName: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  fatPer100g: string;
  carbsPer100g: string;
  countryOfOrigin: string;
  barcode: string;
  analysisError: string | null;
  saveError: string | null;
  aiExtractedFields: Set<string>;
}

const INITIAL_STATE: WizardState = {
  step: "upload",
  namePhoto: null,
  nutritionPhoto: null,
  productName: "",
  caloriesPer100g: "",
  proteinPer100g: "",
  fatPer100g: "",
  carbsPer100g: "",
  countryOfOrigin: "",
  barcode: "",
  analysisError: null,
  saveError: null,
  aiExtractedFields: new Set(),
};

type FieldErrors = Partial<
  Record<
    | "productName"
    | "caloriesPer100g"
    | "proteinPer100g"
    | "fatPer100g"
    | "carbsPer100g"
    | "countryOfOrigin"
    | "barcode",
    string
  >
>;

// Mirrors the server-side isValidFood() checks in firestore.rules so the
// user gets per-field feedback before submitting.
function validateFood(state: WizardState): FieldErrors {
  const errors: FieldErrors = {};

  const name = state.productName.trim();
  if (!name) {
    errors.productName = "Product name is required.";
  } else if (name.length > 200) {
    errors.productName = "Must be 200 characters or fewer.";
  }

  const kcalStr = state.caloriesPer100g;
  if (!kcalStr) {
    errors.caloriesPer100g = "Calories per 100g is required.";
  } else {
    const kcal = parseFloat(kcalStr);
    if (isNaN(kcal)) {
      errors.caloriesPer100g = "Must be a number.";
    } else if (kcal < 0 || kcal > 2000) {
      errors.caloriesPer100g = "Must be between 0 and 2000 kcal per 100g.";
    }
  }

  const macroFields = [
    ["proteinPer100g", "Protein"],
    ["fatPer100g", "Fat"],
    ["carbsPer100g", "Carbs"],
  ] as const;
  for (const [key, label] of macroFields) {
    const val = state[key];
    if (!val) continue;
    const n = parseFloat(val);
    if (isNaN(n)) {
      errors[key] = `${label} must be a number.`;
    } else if (n < 0 || n > 100) {
      errors[key] = `${label} must be between 0 and 100 g per 100g.`;
    }
  }

  if (state.countryOfOrigin.trim().length > 100) {
    errors.countryOfOrigin = "Must be 100 characters or fewer.";
  }

  const barcode = state.barcode.trim();
  if (barcode && (barcode.length < 8 || barcode.length > 14)) {
    errors.barcode = "Must be 8–14 digits (UPC-E, EAN, or ITF-14).";
  }

  return errors;
}

async function runAnalysisWithTimeout(
  namePhoto: File | null,
  nutritionPhoto: File | null,
) {
  const analysisPromise = extractFoodFromPhotos(namePhoto, nutritionPhoto);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Analysis timed out after 30 seconds")),
      30_000,
    ),
  );

  return Promise.race([analysisPromise, timeoutPromise]);
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

function AddFoodPage() {
  const { user } = useAuth();
  const { barcode: prefilledBarcode } = Route.useSearch();
  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_STATE,
    barcode: prefilledBarcode ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [duplicateFood, setDuplicateFood] = useState<CustomFood | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  function resetWizard() {
    setState(INITIAL_STATE);
    setDuplicateFood(null);
    setShowDuplicateWarning(false);
  }

  async function runAnalysis() {
    setState((s) => ({ ...s, step: "analyzing", analysisError: null }));

    let gemini: Awaited<ReturnType<typeof extractFoodFromPhotos>> | null = null;
    try {
      gemini = await runAnalysisWithTimeout(
        state.namePhoto,
        state.nutritionPhoto,
      );
    } catch (err) {
      setState((s) => ({
        ...s,
        analysisError:
          err instanceof Error
            ? err.message
            : "Analysis failed. You can fill in the details manually.",
      }));
      return;
    }

    const aiExtractedFields = new Set<string>();
    if (gemini?.name) aiExtractedFields.add("productName");
    if (gemini?.caloriesPer100g) aiExtractedFields.add("caloriesPer100g");
    if (gemini?.proteinPer100g) aiExtractedFields.add("proteinPer100g");
    if (gemini?.fatPer100g) aiExtractedFields.add("fatPer100g");
    if (gemini?.carbsPer100g) aiExtractedFields.add("carbsPer100g");

    const countryOfOrigin = gemini?.countryOfOrigin || "";
    if (countryOfOrigin) aiExtractedFields.add("countryOfOrigin");

    setState((s) => ({
      ...s,
      step: "review",
      productName: gemini?.name ?? "",
      caloriesPer100g: gemini?.caloriesPer100g?.toString() ?? "",
      proteinPer100g: gemini?.proteinPer100g?.toString() ?? "",
      fatPer100g: gemini?.fatPer100g?.toString() ?? "",
      carbsPer100g: gemini?.carbsPer100g?.toString() ?? "",
      countryOfOrigin,
      aiExtractedFields,
    }));
  }

  async function handleSave() {
    if (!user || !state.productName.trim() || !state.caloriesPer100g) return;
    const kcal = parseFloat(state.caloriesPer100g);
    if (isNaN(kcal) || kcal <= 0) return;

    setSaving(true);
    setState((s) => ({ ...s, saveError: null }));

    // Check barcode collision first — strongest duplicate signal
    const trimmedBarcode = state.barcode.trim();
    if (trimmedBarcode) {
      const existingByBarcode = await findFoodByBarcode(trimmedBarcode);
      if (existingByBarcode) {
        setSaving(false);
        setDuplicateFood(existingByBarcode);
        setShowDuplicateWarning(true);
        return;
      }
    }

    // Then check name duplicate
    const existing = await checkDuplicateFood(state.productName);

    if (existing) {
      setSaving(false);
      setDuplicateFood(existing);
      setShowDuplicateWarning(true);
      return;
    }

    try {
      await submitCustomFood({
        name: state.productName,
        caloriesPer100g: kcal,
        userId: user.uid,
        proteinPer100g: state.proteinPer100g
          ? parseFloat(state.proteinPer100g)
          : undefined,
        fatPer100g: state.fatPer100g ? parseFloat(state.fatPer100g) : undefined,
        carbsPer100g: state.carbsPer100g
          ? parseFloat(state.carbsPer100g)
          : undefined,
        countryOfOrigin: state.countryOfOrigin.trim() || undefined,
        barcode: state.barcode.trim() || undefined,
      });
      setSaving(false);
      setState((s) => ({ ...s, step: "saved", saveError: null }));
    } catch (err) {
      setSaving(false);
      const message =
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "permission-denied"
          ? "The server rejected this food. Please double-check the values and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong saving this food. Please try again.";
      setState((s) => ({ ...s, saveError: message }));
    }
  }

  return (
    <RequireAuth>
      <h1 style={{ marginBottom: "0.25rem" }}>Add Food</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Take photos of a product or enter the details manually.
      </p>

      <StepIndicator current={state.step} />

      {state.step === "upload" && (
        <UploadStep state={state} setState={setState} onAnalyze={runAnalysis} />
      )}
      {state.step === "analyzing" && (
        <AnalyzingStep
          error={state.analysisError}
          onSkip={() =>
            setState((s) => ({ ...s, step: "review", analysisError: null }))
          }
          onRetry={runAnalysis}
        />
      )}
      {state.step === "review" && (
        <ReviewStep
          state={state}
          setState={setState}
          onSave={handleSave}
          saving={saving}
        />
      )}
      {state.step === "saved" && (
        <SavedStep productName={state.productName} onAddAnother={resetWizard} />
      )}

      {showDuplicateWarning && duplicateFood && (
        <DuplicateWarningDialog
          existing={duplicateFood}
          onCancel={() => {
            setShowDuplicateWarning(false);
            setDuplicateFood(null);
          }}
        />
      )}
    </RequireAuth>
  );
}

// ── STEP INDICATOR ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }) {
  const steps: { id: WizardStep; label: string }[] = [
    { id: "upload", label: "Photos" },
    { id: "analyzing", label: "Analyzing" },
    { id: "review", label: "Review" },
    { id: "saved", label: "Saved" },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginBottom: "2rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {steps.map((step, i) => (
        <div
          key={step.id}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              fontWeight: "600",
              background:
                i <= currentIndex
                  ? "var(--color-accent)"
                  : "var(--color-border)",
              color: i <= currentIndex ? "white" : "var(--color-text-muted)",
            }}
          >
            {i < currentIndex ? "✓" : i + 1}
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              color:
                i === currentIndex
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)",
              fontWeight: i === currentIndex ? "600" : "400",
            }}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div
              style={{
                width: "20px",
                height: "2px",
                background: "var(--color-border)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── STEP 1: UPLOAD ───────────────────────────────────────────────────────────

function UploadStep({
  state,
  setState,
  onAnalyze,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onAnalyze: () => void;
}) {
  const hasAnyPhoto = state.namePhoto || state.nutritionPhoto;

  return (
    <div>
      <p style={{ marginBottom: "1.5rem", lineHeight: "1.6" }}>
        Take up to 3 photos — you can skip any you don't need.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <PhotoZone
          label="Photo 1: Product Label"
          hint="Front of the package — we'll read the product name"
          file={state.namePhoto}
          onSelect={(f) => setState((s) => ({ ...s, namePhoto: f }))}
          onRemove={() => setState((s) => ({ ...s, namePhoto: null }))}
        />
        <PhotoZone
          label="Photo 2: Nutrition Facts"
          hint="The nutrition table on the back — calories and macros"
          file={state.nutritionPhoto}
          onSelect={(f) => setState((s) => ({ ...s, nutritionPhoto: f }))}
          onRemove={() => setState((s) => ({ ...s, nutritionPhoto: null }))}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={onAnalyze}
          disabled={!hasAnyPhoto}
          className="btn-primary"
          style={{
            opacity: hasAnyPhoto ? 1 : 0.45,
            cursor: hasAnyPhoto ? "pointer" : "not-allowed",
          }}
        >
          Analyze Photos
        </button>
        <button
          onClick={() => setState((s) => ({ ...s, step: "review" }))}
          className="btn-secondary"
        >
          Enter Manually
        </button>
      </div>
    </div>
  );
}

// Single photo upload zone with preview
function PhotoZone({
  label,
  hint,
  file,
  onSelect,
  onRemove,
}: {
  label: string;
  hint: string;
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        border: "2px dashed var(--color-border)",
        borderRadius: "0.75rem",
        padding: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        cursor: file ? "default" : "pointer",
        background: file ? "var(--color-surface-alt)" : "transparent",
      }}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = "";
        }}
      />

      {file ? (
        <>
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            style={{
              width: "64px",
              height: "64px",
              objectFit: "cover",
              borderRadius: "0.5rem",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{label}</div>
            <div
              style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}
            >
              {file.name}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              fontSize: "1.3rem",
              padding: "0.25rem",
              lineHeight: 1,
            }}
            title="Remove photo"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "0.5rem",
              background: "var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
            }}
          >
            📷
          </div>
          <div>
            <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{label}</div>
            <div
              style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}
            >
              {hint}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--color-accent)",
                marginTop: "0.2rem",
              }}
            >
              Tap to add photo
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── STEP 2: ANALYZING ────────────────────────────────────────────────────────

function AnalyzingStep({
  error,
  onSkip,
  onRetry,
}: {
  error: string | null;
  onSkip: () => void;
  onRetry: () => void;
}) {
  if (error) {
    const isRetryable =
      error.toLowerCase().includes("overloaded") ||
      error.toLowerCase().includes("rate limit") ||
      error.toLowerCase().includes("wait") ||
      error.toLowerCase().includes("timed out");
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
        <p style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
          Analysis didn't complete
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
            marginBottom: "0.75rem",
            maxWidth: "380px",
            margin: "0 auto 0.75rem",
          }}
        >
          {error}
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
            marginBottom: "1.5rem",
          }}
        >
          {isRetryable
            ? "This is usually temporary — try again in a moment, or continue manually."
            : "You can still fill in the food details manually."}
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {isRetryable && (
            <button onClick={onRetry} className="btn-primary">
              Try Again
            </button>
          )}
          <button
            onClick={onSkip}
            className={isRetryable ? "btn-secondary" : "btn-primary"}
          >
            Continue Manually →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "3rem 0" }}>
      <div className="spinner" style={{ marginBottom: "1.5rem" }} />
      <p style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
        Analyzing your photos...
      </p>
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
        Gemini is reading the label and nutrition facts. This usually takes a
        few seconds.
      </p>
    </div>
  );
}

// ── STEP 3: REVIEW ───────────────────────────────────────────────────────────

function ReviewStep({
  state,
  setState,
  onSave,
  saving,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onSave: () => void;
  saving: boolean;
}) {
  const fieldErrors = validateFood(state);
  const canSave = Object.keys(fieldErrors).length === 0;

  const AiBadge = ({ field }: { field: string }) =>
    state.aiExtractedFields.has(field) ? (
      <span
        style={{
          display: "block",
          fontSize: "0.7rem",
          background: "rgba(255, 200, 50, 0.2)",
          color: "#a07800",
          border: "1px solid rgba(255,200,50,0.4)",
          borderRadius: "0.25rem",
          padding: "0.1rem 0.4rem",
          marginTop: "0.15rem",
          width: "fit-content",
        }}
      >
        AI — Please verify the information
      </span>
    ) : null;

  function field(
    key: keyof WizardState,
    label: string,
    required = false,
    type = "text",
  ) {
    const error = fieldErrors[key as keyof FieldErrors];
    return (
      <label style={{ display: "block", marginBottom: "1rem" }}>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: "600",
            marginBottom: "0.35rem",
          }}
        >
          {label} {required && <span style={{ color: "red" }}>*</span>}
          <AiBadge field={key} />
        </div>
        <input
          type={type}
          value={state[key] as string}
          onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
          required={required}
          style={{
            width: "100%",
            padding: "0.6rem 0.75rem",
            border: error
              ? "1.5px solid #d04030"
              : "1.5px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#a03020",
              marginTop: "0.25rem",
            }}
          >
            {error}
          </div>
        )}
      </label>
    );
  }

  return (
    <div>
      {state.analysisError ? (
        <div
          style={{
            background: "rgba(220, 80, 60, 0.08)",
            border: "1px solid rgba(220, 80, 60, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
            color: "#a03020",
          }}
        >
          <strong>AI analysis failed:</strong> {state.analysisError}
          <br />
          Please fill in the details manually from the product label.
        </div>
      ) : (
        <div
          style={{
            background: "rgba(255, 200, 50, 0.1)",
            border: "1px solid rgba(255, 200, 50, 0.4)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
            color: "#806000",
          }}
        >
          <strong>AI isn't perfect!</strong> Fields marked "AI — verify" were
          extracted from your photos by Gemini. Please check them before saving,
          especially the calorie values.
        </div>
      )}

      {field("productName", "Product Name", true)}
      {field("caloriesPer100g", "Calories per 100g", true, "number")}

      <p
        style={{
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          marginBottom: "1rem",
        }}
      >
        Optional — add macros if the label shows them:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        {(["proteinPer100g", "fatPer100g", "carbsPer100g"] as const).map(
          (key) => {
            const macroError = fieldErrors[key];
            return (
              <label key={key} style={{ display: "block" }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    marginBottom: "0.25rem",
                  }}
                >
                  {
                    {
                      proteinPer100g: "Protein (g)",
                      fatPer100g: "Fat (g)",
                      carbsPer100g: "Carbs (g)",
                    }[key]
                  }
                  <AiBadge field={key} />
                </div>
                <input
                  type="number"
                  value={state[key]}
                  onChange={(e) =>
                    setState((s) => ({ ...s, [key]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.6rem",
                    border: macroError
                      ? "1.5px solid #d04030"
                      : "1.5px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }}
                />
                {macroError && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#a03020",
                      marginTop: "0.2rem",
                    }}
                  >
                    {macroError}
                  </div>
                )}
              </label>
            );
          },
        )}
      </div>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: "600",
            marginBottom: "0.35rem",
          }}
        >
          Barcode (optional)
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: "0.5rem",
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={state.barcode}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                barcode: e.target.value.replace(/\D/g, ""),
              }))
            }
            placeholder="e.g. 7791234567890"
            maxLength={14}
            style={{
              flex: 1,
              padding: "0.6rem 0.75rem",
              border: fieldErrors.barcode
                ? "1.5px solid #d04030"
                : "1.5px solid var(--color-border)",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
          {isBarcodeScannerAvailable() && (
            <button
              type="button"
              onClick={async () => {
                const scanned = await scanBarcode();
                if (scanned) setState((s) => ({ ...s, barcode: scanned }));
              }}
              aria-label="Scan barcode"
              style={{
                flexShrink: 0,
                padding: "0 0.9rem",
                borderRadius: "0.5rem",
                background: "#2563eb",
                color: "white",
                border: "none",
                fontSize: "0.875rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Scan
            </button>
          )}
        </div>
        {fieldErrors.barcode && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#a03020",
              marginTop: "0.25rem",
            }}
          >
            {fieldErrors.barcode}
          </div>
        )}
        <p
          style={{
            marginTop: "0.35rem",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
          }}
        >
          Scanning the barcode lets anyone (including you) find this food
          instantly with the scanner next time.
        </p>
      </label>

      {field("countryOfOrigin", "Country of Origin")}

      {state.saveError && (
        <div
          style={{
            background: "rgba(220, 80, 60, 0.08)",
            border: "1px solid rgba(220, 80, 60, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginTop: "1.5rem",
            fontSize: "0.85rem",
            color: "#a03020",
          }}
        >
          <strong>Couldn't save:</strong> {state.saveError}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save to Database"}
        </button>
        <button
          onClick={() => setState((s) => ({ ...s, step: "upload" }))}
          className="btn-secondary"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// ── STEP 4: SAVED ────────────────────────────────────────────────────────────

function SavedStep({
  productName,
  onAddAnother,
}: {
  productName: string;
  onAddAnother: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
      <h2 style={{ marginBottom: "0.5rem" }}>"{productName}" saved!</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        It's now in the foods database and will appear in ingredient search.
      </p>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button onClick={onAddAnother} className="btn-primary">
          Add Another Food
        </button>
        <Link
          to="/diary"
          className="btn-secondary"
          style={{ display: "inline-block" }}
        >
          Go to My Diary
        </Link>
      </div>
    </div>
  );
}

// ── DUPLICATE WARNING DIALOG ────────────────────────────────────────────────

function DuplicateWarningDialog({
  existing,
  onCancel,
}: {
  existing: CustomFood;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "1rem",
          padding: "1.5rem",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.75rem" }}>
          ⚠️
        </div>
        <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Product Already Exists
        </h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--color-text-muted)",
            textAlign: "center",
            marginBottom: "1rem",
          }}
        >
          A product named <strong>"{existing.name}"</strong> is already in the
          database. You cannot add a duplicate entry.
        </p>

        <div
          style={{
            background: "var(--color-surface-alt, #f5f0eb)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
          }}
        >
          <div><strong>Calories:</strong> {existing.caloriesPer100g} kcal / 100g</div>
          {existing.proteinPer100g != null && (
            <div><strong>Protein:</strong> {existing.proteinPer100g}g</div>
          )}
          {existing.fatPer100g != null && (
            <div><strong>Fat:</strong> {existing.fatPer100g}g</div>
          )}
          {existing.carbsPer100g != null && (
            <div><strong>Carbs:</strong> {existing.carbsPer100g}g</div>
          )}
          {existing.countryOfOrigin && (
            <div><strong>Origin:</strong> {existing.countryOfOrigin}</div>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={onCancel} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
