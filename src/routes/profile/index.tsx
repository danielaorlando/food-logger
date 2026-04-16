import { useState, useEffect } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { updateProfile, sendPasswordResetEmail, signOut } from "firebase/auth";
import { Route as rootRoute } from "../__root";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase";
import { subscribeUserProfile, updateUserProfile } from "../../utils/healthDb";
import type { UserProfile } from "../../types/health";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Subscribe to the user's Firestore profile (body stats, goals, calorie goal)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return unsub;
  }, [user]);

  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate({ to: "/" });
  }

  return (
    <RequireAuth>
      <h1 style={{ marginBottom: "1.5rem" }}>My Profile</h1>
      {user && <AccountInfoSection />}
      {user && <BodyStatsSection profile={profile} userId={user.uid} />}
      {user && <GoalsSection profile={profile} userId={user.uid} />}

      {user && (
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "none",
              color: "#c62828",
              fontSize: "0.95rem",
              fontWeight: "600",
              padding: "0.75rem 1.25rem",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      )}
    </RequireAuth>
  );
}

// ── ACCOUNT INFO SECTION ──────────────────────────────────────────────────────
// Displays and edits data stored in Firebase Auth (name, email, password).

function AccountInfoSection() {
  const { user } = useAuth();

  // Split displayName into first and last — Firebase stores them as one string
  const fullName = user?.displayName ?? "";
  const nameParts = fullName.split(" ");
  const currentFirst = nameParts[0] ?? "";
  const currentLast = nameParts.slice(1).join(" ");

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(currentFirst);
  const [lastName, setLastName] = useState(currentLast);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSaveName() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const newDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateProfile(user, { displayName: newDisplayName });
      setEditing(false);
      setSuccessMsg("Name updated!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Couldn't update name. Please try again.");
    }
    setSaving(false);
  }

  function handleCancel() {
    // Reset inputs back to current values and exit edit mode
    setFirstName(currentFirst);
    setLastName(currentLast);
    setEditing(false);
    setError(null);
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setError(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccessMsg("Password reset email sent! Check your inbox.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      setError("Couldn't send reset email. Please try again.");
    }
  }

  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <h2 className="profile-section-title">Account Info</h2>
        {!editing && (
          <button className="profile-edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {error && <p className="profile-error">{error}</p>}
      {successMsg && <p className="profile-success">{successMsg}</p>}

      <div className="profile-fields">
        {/* First Name */}
        <div className="profile-field">
          <span className="profile-field-label">First name</span>
          {editing ? (
            <input
              type="text"
              className="profile-field-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {currentFirst || "Not set"}
            </span>
          )}
        </div>

        {/* Last Name */}
        <div className="profile-field">
          <span className="profile-field-label">Last name</span>
          {editing ? (
            <input
              type="text"
              className="profile-field-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {currentLast || "Not set"}
            </span>
          )}
        </div>

        {/* Email — always read-only */}
        <div className="profile-field">
          <span className="profile-field-label">Email</span>
          <span className="profile-field-value">{user?.email ?? "—"}</span>
        </div>

        {/* Password — masked, with reset button */}
        <div className="profile-field">
          <span className="profile-field-label">Password</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="profile-field-value">********</span>
            <button className="profile-link-btn" onClick={handlePasswordReset}>
              Send reset email
            </button>
          </div>
        </div>
      </div>

      {/* Save / Cancel buttons — only visible in edit mode */}
      {editing && (
        <div className="profile-actions">
          <button
            className="btn-primary"
            onClick={handleSaveName}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── BODY STATS SECTION ────────────────────────────────────────────────────────
// Displays and edits data stored in Firestore (DOB, sex, height, weight).

// Convert between our Firestore format (DD-MM-YYYY) and the HTML date input
// format (YYYY-MM-DD). The HTML <input type="date"> always uses ISO format
// internally, but we store DD-MM-YYYY to avoid timezone issues with Firestore
// Timestamps.
function toIsoDate(ddmmyyyy: string): string {
  // "13-04-1990" → "1990-04-13"
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}
function fromIsoDate(isoDate: string): string {
  // "1990-04-13" → "13-04-1990"
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

function computeAge(dob: string): number | null {
  // dob is "DD-MM-YYYY"
  const parts = dob.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const birthDate = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  // If birthday hasn't happened yet this year, subtract one
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function BodyStatsSection({
  profile,
  userId,
}: {
  profile: UserProfile | null;
  userId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // When entering edit mode, populate inputs from current profile data
  function handleEdit() {
    setDateOfBirth(profile?.dateOfBirth ? toIsoDate(profile.dateOfBirth) : "");
    setSex(profile?.sex ?? "");
    setHeightCm(profile?.heightCm?.toString() ?? "");
    setCurrentWeightKg(profile?.currentWeightKg?.toString() ?? "");
    setEditing(true);
    setError(null);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(userId, {
        dateOfBirth: dateOfBirth ? fromIsoDate(dateOfBirth) : undefined,
        sex: (sex as UserProfile["sex"]) || undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        currentWeightKg: currentWeightKg ? parseFloat(currentWeightKg) : undefined,
      });
      setEditing(false);
      setSuccessMsg("Body stats updated!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Couldn't save. Please try again.");
    }
    setSaving(false);
  }

  const age = profile?.dateOfBirth ? computeAge(profile.dateOfBirth) : null;

  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <h2 className="profile-section-title">Body Stats</h2>
        {!editing && (
          <button className="profile-edit-btn" onClick={handleEdit}>
            Edit
          </button>
        )}
      </div>

      {error && <p className="profile-error">{error}</p>}
      {successMsg && <p className="profile-success">{successMsg}</p>}

      <div className="profile-fields">
        {/* Date of Birth */}
        <div className="profile-field">
          <span className="profile-field-label">Date of birth</span>
          {editing ? (
            <input
              type="date"
              className="profile-field-input"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {profile?.dateOfBirth ?? "Not set"}
              {age !== null && ` (${age} years old)`}
            </span>
          )}
        </div>

        {/* Sex */}
        <div className="profile-field">
          <span className="profile-field-label">Sex</span>
          {editing ? (
            <select
              className="profile-field-input"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          ) : (
            <span className="profile-field-value">
              {profile?.sex
                ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)
                : "Not set"}
            </span>
          )}
        </div>

        {/* Height */}
        <div className="profile-field">
          <span className="profile-field-label">Height (cm)</span>
          {editing ? (
            <input
              type="number"
              className="profile-field-input"
              placeholder="e.g. 175"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {profile?.heightCm ? `${profile.heightCm} cm` : "Not set"}
            </span>
          )}
        </div>

        {/* Current Weight */}
        <div className="profile-field">
          <span className="profile-field-label">Current weight (kg)</span>
          {editing ? (
            <input
              type="number"
              className="profile-field-input"
              placeholder="e.g. 75"
              value={currentWeightKg}
              onChange={(e) => setCurrentWeightKg(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {profile?.currentWeightKg
                ? `${profile.currentWeightKg} kg`
                : "Not set"}
            </span>
          )}
        </div>
      </div>

      {editing && (
        <div className="profile-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── GOALS SECTION ─────────────────────────────────────────────────────────────
// Displays and edits weight goals stored in Firestore.
// "Estimated date" is computed client-side from currentWeight, goalWeight,
// and weeklyRate — it's never stored in the database.

const WEEKLY_RATE_OPTIONS = [
  { value: "0.22", label: "0.22 kg/week" },
  { value: "0.45", label: "0.45 kg/week" },
  { value: "0.68", label: "0.68 kg/week" },
  { value: "0.90", label: "0.90 kg/week" },
];

function computeEstimatedDate(
  currentWeightKg: number | undefined,
  goalWeightKg: number | undefined,
  weeklyRateKg: number | undefined,
  overallGoal: string | undefined,
): string | null {
  // Can't estimate if any input is missing or goal is "maintain"
  if (!currentWeightKg || !goalWeightKg || !weeklyRateKg) return null;
  if (overallGoal === "maintain") return null;
  if (weeklyRateKg <= 0) return null;

  const weightDiff = Math.abs(currentWeightKg - goalWeightKg);
  if (weightDiff === 0) return null;

  const weeksNeeded = weightDiff / weeklyRateKg;
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + weeksNeeded * 7);

  return estimatedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function GoalsSection({
  profile,
  userId,
}: {
  profile: UserProfile | null;
  userId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [overallGoal, setOverallGoal] = useState("");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [weeklyRateKg, setWeeklyRateKg] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleEdit() {
    setOverallGoal(profile?.overallGoal ?? "");
    setGoalWeightKg(profile?.goalWeightKg?.toString() ?? "");
    setWeeklyRateKg(profile?.weeklyRateKg?.toString() ?? "");
    setCalorieGoal(profile?.calorieGoal?.toString() ?? "");
    setEditing(true);
    setError(null);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(userId, {
        overallGoal: (overallGoal as UserProfile["overallGoal"]) || undefined,
        goalWeightKg: goalWeightKg ? parseFloat(goalWeightKg) : undefined,
        weeklyRateKg: weeklyRateKg ? parseFloat(weeklyRateKg) : undefined,
        calorieGoal: calorieGoal ? parseInt(calorieGoal, 10) : undefined,
      });
      setEditing(false);
      setSuccessMsg("Goals updated!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Couldn't save. Please try again.");
    }
    setSaving(false);
  }

  const estimatedDate = computeEstimatedDate(
    profile?.currentWeightKg,
    profile?.goalWeightKg,
    profile?.weeklyRateKg,
    profile?.overallGoal,
  );

  const goalLabel =
    profile?.overallGoal === "lose"
      ? "Lose weight"
      : profile?.overallGoal === "gain"
        ? "Gain weight"
        : profile?.overallGoal === "maintain"
          ? "Maintain weight"
          : "Not set";

  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <h2 className="profile-section-title">Goals</h2>
        {!editing && (
          <button className="profile-edit-btn" onClick={handleEdit}>
            Edit
          </button>
        )}
      </div>

      {error && <p className="profile-error">{error}</p>}
      {successMsg && <p className="profile-success">{successMsg}</p>}

      <div className="profile-fields">
        {/* Overall Goal */}
        <div className="profile-field">
          <span className="profile-field-label">Overall goal</span>
          {editing ? (
            <select
              className="profile-field-input"
              value={overallGoal}
              onChange={(e) => setOverallGoal(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain weight</option>
              <option value="gain">Gain weight</option>
            </select>
          ) : (
            <span className="profile-field-value">{goalLabel}</span>
          )}
        </div>

        {/* Goal Weight */}
        <div className="profile-field">
          <span className="profile-field-label">Goal weight (kg)</span>
          {editing ? (
            <input
              type="number"
              className="profile-field-input"
              placeholder="e.g. 70"
              value={goalWeightKg}
              onChange={(e) => setGoalWeightKg(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {profile?.goalWeightKg ? `${profile.goalWeightKg} kg` : "Not set"}
            </span>
          )}
        </div>

        {/* Weekly Rate */}
        <div className="profile-field">
          <span className="profile-field-label">Preferred rate</span>
          {editing ? (
            <select
              className="profile-field-input"
              value={weeklyRateKg}
              onChange={(e) => setWeeklyRateKg(e.target.value)}
            >
              <option value="">Select...</option>
              {WEEKLY_RATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="profile-field-value">
              {profile?.weeklyRateKg
                ? `${profile.weeklyRateKg} kg/week`
                : "Not set"}
            </span>
          )}
        </div>

        {/* Calorie Goal */}
        <div className="profile-field">
          <span className="profile-field-label">Daily calorie goal</span>
          {editing ? (
            <input
              type="number"
              className="profile-field-input"
              placeholder="e.g. 2000"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
            />
          ) : (
            <span className="profile-field-value">
              {profile?.calorieGoal ? `${profile.calorieGoal} kcal` : "Not set"}
            </span>
          )}
        </div>

        {/* Estimated Date — always read-only, computed */}
        <div className="profile-field">
          <span className="profile-field-label">Estimated date to reach goal</span>
          <span className="profile-field-value">
            {estimatedDate ?? "N/A"}
          </span>
        </div>
      </div>

      {editing && (
        <div className="profile-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
