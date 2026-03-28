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

export type TabId = 'dashboard' | 'map' | 'assessment' | 'plans' | 'followup' | 'usage';

export const FOOD_CATEGORIES: FoodCategory[] = ['protein', 'grains', 'dairy', 'produce', 'canned', 'beverages'];

// Phase 2: Chat & SCOPE types
export interface ChatMessage {
  id: string;
  role: 'human' | 'ai';
  content: string;
  crisisProfile?: CrisisProfile;
  timestamp: number;
}

export interface CrisisProfile {
  crisis_type: string;
  geography: string;
  severity: number;
  timeline_days: number;
  demand_delta_pct: number;
  affected_population: number;
  notes: string;
}

// Phase 2: SSE & Activity types
export type SSEEventType =
  | 'agent_start'
  | 'agent_end'
  | 'hex_run_started'
  | 'hex_run_completed'
  | 'error'
  | 'complete';

export interface SSEEvent {
  type: SSEEventType;
  agent?: string;
  message?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type AgentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface AgentActivity {
  id: string;
  agent: string;
  status: AgentStatus;
  message?: string;
  timestamp: number;
}

// Phase 3: ASSESS pipeline types
export interface CategoryGap {
  category: FoodCategory;
  supply_lbs: number;
  demand_lbs: number;
  gap_lbs: number;
  coverage_ratio: number;
}

export interface GapAnalysis {
  total_supply_lbs: number;
  total_demand_lbs: number;
  total_gap_lbs: number;
  gaps_by_category: CategoryGap[];
  expiration_risk_lbs: number;
  site_health_scores: Record<string, number>;
  ai_summary: string;
}

export interface HexRunStatus {
  run_id: string;
  run_url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERRORED' | 'KILLED' | 'TIMEOUT';
}

export interface AgentCost {
  agent: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface AssessResponse {
  gap_analysis: GapAnalysis;
  hex_run: HexRunStatus | null;
}
