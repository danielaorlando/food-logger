// FoodSearchInput — debounced search box with a dropdown of suggestions.
// Calls searchIngredient() from nutritionApi after the user stops typing for 300ms.
// On selection it calls onSelect with the chosen result.

import { useState, useEffect, useRef } from "react";
import { searchIngredient, type NutritionResult } from "../utils/nutritionApi";

interface Props {
  onSelect: (result: NutritionResult) => void;
}

export function FoodSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NutritionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce the search — wait 300ms after the user stops typing before calling the API
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const found = await searchIngredient(query);
      setResults(found);
      setOpen(found.length > 0);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: NutritionResult) {
    onSelect(result);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  // Source badge colors
  const sourceBadge = (source: NutritionResult["source"]) => {
    const styles: Record<string, { bg: string; color: string }> = {
      custom: { bg: "rgba(224,123,74,0.15)", color: "var(--color-accent)" },
      usda: { bg: "rgba(76,175,80,0.15)", color: "#2e7d32" },
    };
    const labels: Record<string, string> = {
      custom: "My DB",
      usda: "USDA",
    };
    const s = styles[source] ?? styles.custom;
    return (
      <span style={{
        fontSize: "0.7rem",
        background: s.bg,
        color: s.color,
        borderRadius: "0.25rem",
        padding: "0.1rem 0.35rem",
        fontWeight: "600",
        flexShrink: 0,
      }}>
        {labels[source] ?? source}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods (e.g. banana, oat milk, chicken)"
          style={{
            width: "100%",
            padding: "0.7rem 2.5rem 0.7rem 0.85rem",
            border: "1.5px solid var(--color-border)",
            borderRadius: "0.6rem",
            fontSize: "1rem",
            boxSizing: "border-box",
            background: "var(--color-surface)",
          }}
        />
        {loading && (
          <div style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            width: "16px",
            height: "16px",
            border: "2px solid var(--color-border)",
            borderTopColor: "var(--color-accent)",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }} />
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--color-surface)",
          border: "1.5px solid var(--color-border)",
          borderRadius: "0.6rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          zIndex: 50,
          overflow: "hidden",
          maxHeight: "280px",
          overflowY: "auto",
        }}>
          {results.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(result)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 0.85rem",
                border: "none",
                borderBottom: i < results.length - 1 ? "1px solid var(--color-border)" : "none",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-alt)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span style={{ flex: 1 }}>{result.name}</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", flexShrink: 0 }}>
                {result.caloriesPer100g} kcal/100g
              </span>
              {sourceBadge(result.source)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
