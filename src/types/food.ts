export interface CustomFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  submittedBy: string;
  createdAt: Date;
  barcode?: string;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
}

export interface SubmitFoodPayload {
  name: string;
  caloriesPer100g: number;
  userId: string;
  barcode?: string;
  proteinPer100g?: number;
  fatPer100g?: number;
  carbsPer100g?: number;
}
