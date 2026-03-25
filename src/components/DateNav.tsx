// DateNav — the "< Monday, March 23 >" navigation strip at the top of the diary.
// Clicking < or > shifts the current date by one day.
// The "Today" button snaps back to the current date.

import { formatDisplayDate, isToday, addDays } from "../utils/dateHelpers";

interface Props {
  date: Date;
  onChange: (date: Date) => void;
}

export function DateNav({ date, onChange }: Props) {
  const showToday = !isToday(date);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.5rem",
      marginBottom: "1.5rem",
      padding: "0.5rem 0.75rem",
      background: "var(--color-surface)",
      borderRadius: "0.75rem",
      border: "1px solid var(--color-border)",
    }}>
      {/* Previous day */}
      <button
        onClick={() => onChange(addDays(date, -1))}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1.2rem",
          color: "var(--color-text-muted)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.35rem",
          lineHeight: 1,
        }}
        aria-label="Previous day"
      >
        ‹
      </button>

      {/* Date display + Today button */}
      <div style={{ flex: 1, textAlign: "center" }}>
        <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>
          {isToday(date) ? "Today — " : ""}{formatDisplayDate(date)}
        </span>
        {showToday && (
          <button
            onClick={() => onChange(new Date())}
            style={{
              marginLeft: "0.6rem",
              background: "var(--color-accent-light)",
              border: "none",
              color: "var(--color-accent)",
              borderRadius: "2rem",
              padding: "0.15rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Today
          </button>
        )}
      </div>

      {/* Next day — disabled if it's today or in the future */}
      <button
        onClick={() => onChange(addDays(date, 1))}
        disabled={isToday(date)}
        style={{
          background: "none",
          border: "none",
          cursor: isToday(date) ? "not-allowed" : "pointer",
          fontSize: "1.2rem",
          color: isToday(date) ? "var(--color-border)" : "var(--color-text-muted)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.35rem",
          lineHeight: 1,
        }}
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  );
}
