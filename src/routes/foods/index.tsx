import { useState, useEffect } from "react";
import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root";
import { RequireAuth } from "../../components/RequireAuth";
import { getAllFoods } from "../../utils/foodsDb";
import type { CustomFood } from "../../types/food";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/foods/",
  component: FoodsListPage,
});

function FoodsListPage() {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllFoods()
      .then(setFoods)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load foods"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? foods.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : foods;

  return (
    <RequireAuth>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.25rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Foods Database</h1>
        <Link to="/foods/add" search={{ barcode: undefined }} className="btn-primary" style={{ display: "inline-block" }}>
          + Add Food
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {foods.length} product{foods.length !== 1 ? "s" : ""} in the database
      </p>

      <input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "0.6rem 0.75rem",
          border: "1.5px solid var(--color-border)",
          borderRadius: "0.5rem",
          fontSize: "1rem",
          boxSizing: "border-box",
          marginBottom: "1.5rem",
        }}
      />

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div className="spinner" style={{ marginBottom: "1rem" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Loading foods...</p>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(220, 80, 60, 0.08)",
            border: "1px solid rgba(220, 80, 60, 0.3)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            color: "#a03020",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p style={{ color: "var(--color-text-muted)" }}>
            {search.trim() ? "No products match your search." : "No products yet."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((food) => (
            <FoodCard key={food.id} food={food} />
          ))}
        </div>
      )}
    </RequireAuth>
  );
}

function FoodCard({ food }: { food: CustomFood }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "1.5px solid var(--color-border)",
        borderRadius: "0.75rem",
        padding: "1rem",
        background: "var(--color-surface)",
        cursor: "pointer",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: "600", fontSize: "1rem" }}>{food.name}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            {food.caloriesPer100g} kcal / 100g
          </div>
        </div>
        <span
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "0.75rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--color-border)",
            fontSize: "0.85rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.4rem 1rem",
          }}
        >
          <div>
            <strong>Calories:</strong> {food.caloriesPer100g} kcal
          </div>
          {food.proteinPer100g != null && (
            <div>
              <strong>Protein:</strong> {food.proteinPer100g}g
            </div>
          )}
          {food.fatPer100g != null && (
            <div>
              <strong>Fat:</strong> {food.fatPer100g}g
            </div>
          )}
          {food.carbsPer100g != null && (
            <div>
              <strong>Carbs:</strong> {food.carbsPer100g}g
            </div>
          )}
          {food.countryOfOrigin && (
            <div>
              <strong>Origin:</strong> {food.countryOfOrigin}
            </div>
          )}
          <div style={{ color: "var(--color-text-muted)" }}>
            <strong>Added:</strong>{" "}
            {food.createdAt.toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
