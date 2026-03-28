export type FoodCategory = 'protein' | 'grains' | 'dairy' | 'produce' | 'canned' | 'beverages';

export interface Site {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'warehouse' | 'distribution_site';
  capacity_total_lbs: number;
  capacity_refrigerated_lbs: number;
  capacity_frozen_lbs: number;
  health_score: number;
  health_score_updated_at: string | null;
  operating_hours: string | null;
  serves_population: number | null;
  region: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface Inventory {
  id: string;
  site_id: string;
  food_category: FoodCategory;
  subcategory: string;
  quantity_lbs: number;
  unit_cost_dollars: number;
  expiration_date: string | null;
  received_date: string | null;
  source_type: 'donated' | 'purchased' | 'usda_commodity';
  status: 'available' | 'reserved' | 'expired' | 'distributed';
  created_at: string;
}

export type TabId = 'dashboard' | 'map' | 'assessment' | 'plans' | 'followup';

export const FOOD_CATEGORIES: FoodCategory[] = ['protein', 'grains', 'dairy', 'produce', 'canned', 'beverages'];
