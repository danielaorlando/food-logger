// Date utilities for the diary feature.
//
// WHY STRING KEYS instead of Timestamps for diary queries?
// "Today" in the user's browser might be a different UTC date on Firestore's servers
// depending on timezones. A string key like "2026-03-23" is produced entirely in
// the browser from the user's local date — no timezone confusion.

// Returns "2026-03-23" for a given Date
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Returns "Monday, March 23" for display in the date nav strip
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Returns a new Date shifted by n days (negative = past, positive = future)
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

// Returns true if the date is today (ignores time)
export function isToday(date: Date): boolean {
  return toDateKey(date) === toDateKey(new Date());
}
