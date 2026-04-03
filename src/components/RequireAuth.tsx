import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth/login" });
    }
  }, [user, loading, navigate]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem" }}>Loading…</div>;
  if (!user) return null;

  return <>{children}</>;
}
