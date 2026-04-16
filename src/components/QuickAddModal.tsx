// QuickAddModal — a "manual calorie receipt" popup.
//
// Lets the user log a meal by typing just a name, total kcal, optional
// protein grams, and a meal, without picking a food from the database.
// Pure UI: manages its own form state and calls onSave / onCancel —
// the parent page does the Firestore write.

import { useState } from "react";
import type { MealType } from "../types/diary";

interface QuickAddPayload {
  foodName: string;
  kcal: number;
  proteinGrams?: number;
  meal: MealType;
}

interface Props {
  onSave: (payload: QuickAddPayload) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

export function QuickAddModal({ onSave, onCancel, saving, error }: Props) {
  const [foodName, setFoodName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [meal, setMeal] = useState<MealType>("breakfast");

  const trimmedName = foodName.trim();
  const kcalNum = parseFloat(kcal);
  const proteinNum = protein.trim() === "" ? undefined : parseFloat(protein);

  const isValid =
    trimmedName.length > 0 &&
    !isNaN(kcalNum) &&
    kcalNum > 0 &&
    (proteinNum === undefined || (!isNaN(proteinNum) && proteinNum >= 0));

  function handleSave() {
    if (!isValid) return;
    onSave({
      foodName: trimmedName,
      kcal: kcalNum,
      proteinGrams: proteinNum,
      meal,
    });
  }

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
      onClick={saving ? undefined : onCancel}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "1rem",
          padding: "1.25rem",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: "600" }}>
          Quick Add
        </h3>

        {/* Name */}
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.3rem" }}>
            Name
          </div>
          <input
            type="text"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="e.g. Cookie"
            autoFocus
            style={inputStyle}
          />
        </label>

        {/* Kcal + Protein side-by-side */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <label>
            <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.3rem" }}>
              Calories (kcal)
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="200"
              min="1"
              style={inputStyle}
            />
          </label>
          <label>
            <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.3rem" }}>
              Protein (g){" "}
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>
                optional
              </span>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="—"
              min="0"
              style={inputStyle}
            />
          </label>
        </div>

        {/* Meal */}
        <label style={{ display: "block", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.3rem" }}>
            Meal
          </div>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
            style={{ ...inputStyle, background: "var(--color-surface)" }}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>

        {error && (
          <p style={{ color: "#b71c1c", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
            {error}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              flex: 1,
              padding: "0.6rem",
              border: "1.5px solid var(--color-border)",
              borderRadius: "0.5rem",
              background: "var(--color-surface)",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  border: "1.5px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "1rem",
  boxSizing: "border-box",
};
