import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const path = location.pathname;
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  async function handleLogout() {
    await signOut(auth);
    navigate({ to: "/" });
  }

  const isDiary = path === "/" || path.startsWith("/diary");
  const isFoodsList = path === "/foods" || path === "/foods/";
  const isAddFood = path === "/foods/add";

  return (
    <div className="app-wrapper">
      <header className="site-header">
        {/* LEFT — App name */}
        <Link to="/" className="header-left">
          <span className="header-logo">🥗</span>
          <span>Food Logger</span>
        </Link>

        {/* CENTER — Navigation */}
        <nav className="site-nav">
          <Link
            to="/diary"
            className={isDiary ? "nav-link nav-link--active" : "nav-link"}
          >
            My Diary
          </Link>
          <Link
            to="/foods"
            className={isFoodsList ? "nav-link nav-link--active" : "nav-link"}
          >
            Foods
          </Link>
          <Link
            to="/foods/add"
            className={isAddFood ? "nav-link nav-link--active" : "nav-link"}
          >
            Add Food
          </Link>
        </nav>

        {/* RIGHT — Auth */}
        <div className="header-right">
          {loading ? null : user ? (
            <>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                Hi, {user.displayName?.split(" ")[0] ?? user.email}
              </span>
              <button className="logout-btn" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/auth/login" className="login-link">
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="page-main">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
