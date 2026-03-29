import type { ResponsePlan, PlanLineItem, SourceOption, GapAnalysis } from './types';

// ============================================================================
// HARDCODED ALGORITHM OUTPUT — generated from real pipeline execution
// Gap analysis: marginal deficit model with baseline reservation
// Plans: site-priority-aware allocation with supplier consolidation
// ============================================================================

export const HARDCODED_GAP_ANALYSIS: GapAnalysis = {
  total_supply_lbs: 58604,
  total_demand_lbs: 70740,
  total_gap_lbs: -12136,
  gaps_by_category: [
    { category: 'protein',    supply_lbs: 11400, demand_lbs: 17100, gap_lbs: -5700, coverage_ratio: 0.67 },
    { category: 'grains',     supply_lbs: 13501, demand_lbs: 13500, gap_lbs: 1,     coverage_ratio: 1.0 },
    { category: 'dairy',      supply_lbs: 6801,  demand_lbs: 9000,  gap_lbs: -2199, coverage_ratio: 0.76 },
    { category: 'produce',    supply_lbs: 7800,  demand_lbs: 11700, gap_lbs: -3900, coverage_ratio: 0.67 },
    { category: 'canned',     supply_lbs: 12601, demand_lbs: 12600, gap_lbs: 1,     coverage_ratio: 1.0 },
    { category: 'beverages',  supply_lbs: 6501,  demand_lbs: 6840,  gap_lbs: -339,  coverage_ratio: 0.95 },
  ],
  expiration_risk_lbs: 19610,
  site_health_scores: {
    '11111111-1111-1111-1111-111111111111': 0.8061,
    '22222222-2222-2222-2222-222222222222': 0.8215,
    '33333333-3333-3333-3333-333333333333': 0.508,
    '44444444-4444-4444-4444-444444444444': 0.4942,
    '55555555-5555-5555-5555-555555555555': 0.4467,
    '66666666-6666-6666-6666-666666666666': 0.4184,
    '77777777-7777-7777-7777-777777777777': 0.4573,
    '88888888-8888-8888-8888-888888888888': 0.5167,
  },
  ai_summary: 'Critical shortfalls in protein (-5,700 lbs) and produce (-3,900 lbs) with dairy also under pressure (-2,199 lbs). North Philadelphia distribution sites (Kensington, North Philly) face the most acute need due to higher baseline demand and lower health scores. Grains and canned goods are adequately stocked.',
};

export const HARDCODED_PLANS: ResponsePlan[] = [
  {
    name: 'fastest',
    strategy: 'Fastest delivery: sources within 1-day lead time prioritized, allocated to highest-need sites first. Equity-weighted allocation serves stressed communities (Kensington, North Philly) before well-stocked warehouses.',
    line_items: [
      { source_id: 'philabundance-frozen-chicken-breast', supplier_name: 'Philabundance', food_category: 'protein', item_name: 'frozen chicken breast', quantity_lbs: 3000, cost: 0, lead_time_days: 1, delivery_cost: 97.2, distance_miles: 2.8 },
      { source_id: 'chester-county-food-bank-canned-tuna', supplier_name: 'Chester County Food Bank', food_category: 'protein', item_name: 'canned tuna', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 159.92, distance_miles: 23.1 },
      { source_id: 'philabundance-donated-fresh-fruit', supplier_name: 'Philabundance', food_category: 'produce', item_name: 'donated fresh fruit', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 64.8, distance_miles: 2.8 },
      { source_id: 'chester-county-food-bank-canned-tomatoes', supplier_name: 'Chester County Food Bank', food_category: 'produce', item_name: 'canned tomatoes', quantity_lbs: 1900.1, cost: 380.02, lead_time_days: 1, delivery_cost: 113.94, distance_miles: 23.1 },
      { source_id: 'philabundance-donated-yogurt', supplier_name: 'Philabundance', food_category: 'dairy', item_name: 'donated yogurt', quantity_lbs: 1500, cost: 0, lead_time_days: 1, delivery_cost: 48.59, distance_miles: 2.8 },
      { source_id: 'montgomery-county-food-bank-donated-milk', supplier_name: 'Montgomery County Food Bank', food_category: 'dairy', item_name: 'donated milk', quantity_lbs: 699, cost: 0, lead_time_days: 1, delivery_cost: 88.18, distance_miles: 21.0 },
      { source_id: 'montgomery-county-food-bank-canned-chicken', supplier_name: 'Montgomery County Food Bank', food_category: 'protein', item_name: 'canned chicken', quantity_lbs: 700, cost: 0, lead_time_days: 1, delivery_cost: 88.3, distance_miles: 21.0 },
      { source_id: 'philabundance-donated-bottled-water', supplier_name: 'Philabundance', food_category: 'beverages', item_name: 'donated bottled water', quantity_lbs: 339, cost: 0, lead_time_days: 1, delivery_cost: 10.99, distance_miles: 2.8 },
    ],
    total_cost: 1011.94,
    coverage_pct: 100.0,
    max_lead_time_days: 1,
    estimated_people_served: 50000,
    transfers: [],
  },
  {
    name: 'cheapest',
    strategy: 'Lowest total cost: consolidated per-supplier delivery ($75 base + $3.50/mi), equity-weighted site allocation. Donated and free sources prioritized — only $80 in procurement for the entire 12,138 lbs.',
    line_items: [
      { source_id: 'philabundance-frozen-chicken-breast', supplier_name: 'Philabundance', food_category: 'protein', item_name: 'frozen chicken breast', quantity_lbs: 3000, cost: 0, lead_time_days: 1, delivery_cost: 97.2, distance_miles: 2.8 },
      { source_id: 'chester-county-food-bank-canned-tuna', supplier_name: 'Chester County Food Bank', food_category: 'protein', item_name: 'canned tuna', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 169.87, distance_miles: 23.1 },
      { source_id: 'philabundance-donated-fresh-fruit', supplier_name: 'Philabundance', food_category: 'produce', item_name: 'donated fresh fruit', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 64.8, distance_miles: 2.8 },
      { source_id: 'delaware-valley-food-council-community-garden-surplus', supplier_name: 'Delaware Valley Food Council', food_category: 'produce', item_name: 'community garden surplus', quantity_lbs: 1500, cost: 0, lead_time_days: 2, delivery_cost: 105.69, distance_miles: 0.2 },
      { source_id: 'chester-county-food-bank-canned-tomatoes', supplier_name: 'Chester County Food Bank', food_category: 'produce', item_name: 'canned tomatoes', quantity_lbs: 400.1, cost: 80.02, lead_time_days: 1, delivery_cost: 33.98, distance_miles: 23.1 },
      { source_id: 'philabundance-donated-yogurt', supplier_name: 'Philabundance', food_category: 'dairy', item_name: 'donated yogurt', quantity_lbs: 1500, cost: 0, lead_time_days: 1, delivery_cost: 48.59, distance_miles: 2.8 },
      { source_id: 'montgomery-county-food-bank-donated-milk', supplier_name: 'Montgomery County Food Bank', food_category: 'dairy', item_name: 'donated milk', quantity_lbs: 699, cost: 0, lead_time_days: 1, delivery_cost: 88.18, distance_miles: 21.0 },
      { source_id: 'montgomery-county-food-bank-canned-chicken', supplier_name: 'Montgomery County Food Bank', food_category: 'protein', item_name: 'canned chicken', quantity_lbs: 700, cost: 0, lead_time_days: 1, delivery_cost: 88.3, distance_miles: 21.0 },
      { source_id: 'philabundance-donated-bottled-water', supplier_name: 'Philabundance', food_category: 'beverages', item_name: 'donated bottled water', quantity_lbs: 339, cost: 0, lead_time_days: 1, delivery_cost: 10.99, distance_miles: 2.8 },
    ],
    total_cost: 787.62,
    coverage_pct: 100.0,
    max_lead_time_days: 2,
    estimated_people_served: 50000,
    transfers: [],
  },
  {
    name: 'best_nutrition',
    strategy: 'Balanced nutrition: round-robin across all deficit food categories ensures protein, dairy, produce, and beverages are each sourced. Sicker sites served first with cost-efficient donated sources.',
    line_items: [
      { source_id: 'philabundance-frozen-chicken-breast', supplier_name: 'Philabundance', food_category: 'protein', item_name: 'frozen chicken breast', quantity_lbs: 3000, cost: 0, lead_time_days: 1, delivery_cost: 104.33, distance_miles: 2.8 },
      { source_id: 'chester-county-food-bank-canned-tuna', supplier_name: 'Chester County Food Bank', food_category: 'protein', item_name: 'canned tuna', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 169.87, distance_miles: 23.1 },
      { source_id: 'philabundance-donated-fresh-fruit', supplier_name: 'Philabundance', food_category: 'produce', item_name: 'donated fresh fruit', quantity_lbs: 2000, cost: 0, lead_time_days: 1, delivery_cost: 69.56, distance_miles: 2.8 },
      { source_id: 'delaware-valley-food-council-community-garden-surplus', supplier_name: 'Delaware Valley Food Council', food_category: 'produce', item_name: 'community garden surplus', quantity_lbs: 1500, cost: 0, lead_time_days: 2, delivery_cost: 105.69, distance_miles: 0.2 },
      { source_id: 'chester-county-food-bank-canned-tomatoes', supplier_name: 'Chester County Food Bank', food_category: 'produce', item_name: 'canned tomatoes', quantity_lbs: 400.1, cost: 80.02, lead_time_days: 1, delivery_cost: 33.98, distance_miles: 23.1 },
      { source_id: 'montgomery-county-food-bank-donated-milk', supplier_name: 'Montgomery County Food Bank', food_category: 'dairy', item_name: 'donated milk', quantity_lbs: 1800, cost: 0, lead_time_days: 1, delivery_cost: 142.92, distance_miles: 21.0 },
      { source_id: 'philabundance-donated-yogurt', supplier_name: 'Philabundance', food_category: 'dairy', item_name: 'donated yogurt', quantity_lbs: 399, cost: 0, lead_time_days: 1, delivery_cost: 13.87, distance_miles: 2.8 },
      { source_id: 'montgomery-county-food-bank-canned-chicken', supplier_name: 'Montgomery County Food Bank', food_category: 'protein', item_name: 'canned chicken', quantity_lbs: 700, cost: 0, lead_time_days: 1, delivery_cost: 55.58, distance_miles: 21.0 },
      { source_id: 'philabundance-donated-bottled-water', supplier_name: 'Philabundance', food_category: 'beverages', item_name: 'donated bottled water', quantity_lbs: 339, cost: 0, lead_time_days: 1, delivery_cost: 11.78, distance_miles: 2.8 },
    ],
    total_cost: 787.60,
    coverage_pct: 100.0,
    max_lead_time_days: 2,
    estimated_people_served: 50000,
    transfers: [],
  },
];

// Legacy aliases
export const MOCK_PLANS = HARDCODED_PLANS;

export const MOCK_SOURCES: SourceOption[] = [
  { id: 'philabundance-frozen-chicken-breast', supplier_name: 'Philabundance', food_category: 'protein', item_name: 'frozen chicken breast', quantity_available_lbs: 3000, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.95, source_type: 'database', notes: '', latitude: 39.9097, longitude: -75.1603 },
  { id: 'chester-county-food-bank-canned-tuna', supplier_name: 'Chester County Food Bank', food_category: 'protein', item_name: 'canned tuna', quantity_available_lbs: 2000, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.88, source_type: 'database', notes: '', latitude: 39.9607, longitude: -75.6055 },
  { id: 'montgomery-county-food-bank-canned-chicken', supplier_name: 'Montgomery County Food Bank', food_category: 'protein', item_name: 'canned chicken', quantity_available_lbs: 1800, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.87, source_type: 'database', notes: '', latitude: 40.2415, longitude: -75.2838 },
  { id: 'philabundance-donated-fresh-fruit', supplier_name: 'Philabundance', food_category: 'produce', item_name: 'donated fresh fruit', quantity_available_lbs: 2000, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.95, source_type: 'database', notes: '', latitude: 39.9097, longitude: -75.1603 },
  { id: 'delaware-valley-food-council-community-garden-surplus', supplier_name: 'Delaware Valley Food Council', food_category: 'produce', item_name: 'community garden surplus', quantity_available_lbs: 1500, unit_cost_per_lb: 0.0, lead_time_days: 2, reliability_score: 0.80, source_type: 'database', notes: '', latitude: 39.9512, longitude: -75.166 },
  { id: 'philabundance-donated-yogurt', supplier_name: 'Philabundance', food_category: 'dairy', item_name: 'donated yogurt', quantity_available_lbs: 1500, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.95, source_type: 'database', notes: '', latitude: 39.9097, longitude: -75.1603 },
  { id: 'montgomery-county-food-bank-donated-milk', supplier_name: 'Montgomery County Food Bank', food_category: 'dairy', item_name: 'donated milk', quantity_available_lbs: 1800, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.87, source_type: 'database', notes: '', latitude: 40.2415, longitude: -75.2838 },
  { id: 'philabundance-donated-bottled-water', supplier_name: 'Philabundance', food_category: 'beverages', item_name: 'donated bottled water', quantity_available_lbs: 3000, unit_cost_per_lb: 0.0, lead_time_days: 1, reliability_score: 0.95, source_type: 'database', notes: '', latitude: 39.9097, longitude: -75.1603 },
];
