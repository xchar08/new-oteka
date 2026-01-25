export interface PantryItem {
  id: number;
  name: string;
  probability_score: number;
  status: 'active' | 'review_needed' | 'consumed';
  days_in_storage: number;
  original_quantity: number;
  decay_rate_override?: number;
}

export interface DecayConfig {
  category: string;
  k_value: number;
}
