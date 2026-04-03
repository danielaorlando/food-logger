export interface CustomFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  submittedBy: string;
  createdAt: Date;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  countryOfOrigin?: string;
}

export interface SubmitFoodPayload {
  name: string;
  caloriesPer100g: number;
  userId: string;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
  countryOfOrigin?: string;
}
