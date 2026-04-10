// CalorieGoalEditor — a simple form for setting the daily calorie goal.
//
// Shows a number input pre-filled with the current goal (or empty if none set).
// On save, calls setCalorieGoal() which writes to Firestore user_profiles/{userId}.
// The parent component controls visibility — this just renders the form.

import { useState } from "react";
import { setCalorieGoal } from "../utils/healthDb";

interface Props {
  userId: string;
  currentGoal: number | null;
  onClose: () => void;
}

export function CalorieGoalEditor({ userId, currentGoal, onClose }: Props) {
  const [value, setValue] = useState(currentGoal?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const goal = parseInt(value, 10);
    if (isNaN(goal) || goal <= 0) {
      setError("Please enter a number greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await setCalorieGoal(userId, goal);
      onClose();
    } catch {
      setError("Couldn't save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "0.75rem",
      padding: "1rem",
      marginBottom: "1rem",
    }}>
      <h3 style={{
        margin: "0 0 0.75rem",
        fontSize: "0.95rem",
        fontWeight: "600",
      }}>
        Daily Calorie Goal
      </h3>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 2000"
          min="1"
          style={{
            flex: 1,
            padding: "0.6rem 0.75rem",
            border: "1.5px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            boxSizing: "border-box",
          }}
          autoFocus
        />
        <span style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
          kcal
        </span>
      </div>

      {error && (
        <p style={{
          color: "#b71c1c",
          fontSize: "0.85rem",
          margin: "0.5rem 0 0",
        }}>
          {error}
        </p>
      )}

      <div style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.75rem",
      }}>
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="btn-primary"
          style={{ flex: 1 }}
        >
          {saving ? "Saving..." : "Save Goal"}
        </button>
        <button
          onClick={onClose}
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
  );
}
