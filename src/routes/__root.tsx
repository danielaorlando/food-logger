import { useState, useEffect, useRef } from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

const isNative = Capacitor.isNativePlatform();

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const path = location.pathname;
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleLogout() {
    setDropdownOpen(false);
    await signOut(auth);
    navigate({ to: "/" });
  }

  const isDiary = path === "/" || path.startsWith("/diary");
  const isFoodsList = path === "/foods" || path === "/foods/";
  const isAddFood = path === "/foods/add";

  const navLinks = (
    <>
      <Link
        to="/diary"
        className={isDiary ? "nav-link nav-link--active" : "nav-link"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
      >
        <img src="/Diary-Icon.png" alt="" style={{ width: isNative ? "2.5rem" : "1.4rem", height: isNative ? "2.5rem" : "1.4rem", objectFit: "contain" }} />
        <span style={isNative ? { fontSize: "0.65rem" } : undefined}>My Diary</span>
      </Link>
      <Link
        to="/foods"
        className={isFoodsList ? "nav-link nav-link--active" : "nav-link"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
      >
        <img src="/Plate-Icon.png" alt="" style={{ width: isNative ? "2.5rem" : "1.4rem", height: isNative ? "2.5rem" : "1.4rem", objectFit: "contain" }} />
        <span style={isNative ? { fontSize: "0.65rem" } : undefined}>Foods</span>
      </Link>
      <Link
        to="/foods/add"
        search={{ barcode: undefined }}
        className={isAddFood ? "nav-link nav-link--active" : "nav-link"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
      >
        <img src="/AddFood-Icon.png" alt="" style={{ width: isNative ? "2.5rem" : "1.4rem", height: isNative ? "2.5rem" : "1.4rem", objectFit: "contain" }} />
        <span style={isNative ? { fontSize: "0.65rem" } : undefined}>Add Food</span>
      </Link>
    </>
  );

  return (
    <div className={isNative ? "app-wrapper app-wrapper--native" : "app-wrapper"}>
      {/* iOS: opaque cover over the status-bar safe area so scrolling content
          goes behind the status bar instead of clashing with the time/battery. */}
      {isNative && <div className="ios-status-bar-cover" aria-hidden="true" />}

      {/* Header — hidden on iOS; bottom nav + splash handle branding/nav there */}
      {!isNative && (
        <header className="site-header">
          {/* LEFT — App name */}
          <Link to="/" className="header-left">
            <img
              src="/icon.png"
              alt="Bite Balance"
              className="header-logo"
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "0.25rem",
              }}
            />
            <span>Bite Balance</span>
          </Link>

          {/* CENTER — Navigation */}
          <nav className="site-nav">{navLinks}</nav>

          {/* RIGHT — Auth dropdown / login link */}
          <div className="header-right" ref={dropdownRef}>
            {loading ? null : user ? (
              <>
                <button
                  className="header-dropdown-trigger"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  <img src="/Avatar-Icon.png" alt="" style={{ width: "1.4rem", height: "1.4rem", objectFit: "contain" }} />
                  <span>Hi, {user.displayName?.split(" ")[0] ?? user.email}</span>
                </button>

                {dropdownOpen && (
                  <div className="header-dropdown">
                    <Link
                      to="/profile"
                      className="header-dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      My Profile
                    </Link>
                    <button
                      className="header-dropdown-item"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link to="/auth/login" className="login-link">
                Log in
              </Link>
            )}
          </div>
        </header>
      )}

      <main className="page-main">
        <div className="page-container">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar — iOS only */}
      {isNative && (
        <nav className="bottom-nav">
          {navLinks}
          {user && (
            <Link
              to="/profile"
              className={path.startsWith("/profile") ? "nav-link nav-link--active" : "nav-link"}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
            >
              <img src="/Avatar-Icon.png" alt="" style={{ width: "2.5rem", height: "2.5rem", objectFit: "contain" }} />
              <span style={{ fontSize: "0.65rem" }}>My Profile</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
