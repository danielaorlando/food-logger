// HEALTH DATA CONCEPT:
// "Daily energy" is a summary of calories burned for one user on one day.
// The iOS app reads this from HealthKit and syncs it to Firestore so the
// web app can display it too.
//
// "User profile" stores per-user settings like the daily calorie goal.
// Unlike meal logs (many per day), there's exactly ONE energy summary per
// day and ONE profile per user.

export interface DailyEnergyData {
  userId: string;
  // "2026-04-09" — same format as MealLogEntry.dateKey
  dateKey: string;
  // Calories from movement and exercise (walking, workouts, fidgeting)
  activeCalories: number;
  // Calories your body burns at rest (breathing, digesting, keeping warm)
  basalCalories: number;
  // activeCalories + basalCalories
  totalCaloriesOut: number;
  // When the iOS app last synced this data from HealthKit to Firestore
  lastSyncedAt: Date;
}

export interface UserProfile {
  userId: string;
  // Daily calorie target (e.g., 2000). Used to calculate "Calories Remaining".
  calorieGoal: number;
  updatedAt: Date;
}
