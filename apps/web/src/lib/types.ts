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
  threadUrl?: string;
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
  food_categories: string[];   // default [] in backend
  description: string;          // default "" in backend
}

// Phase 12: Monitor types
export interface MonitorPost {
  id: string;
  source: 'twitter' | 'news' | 'community_alert';
  author: string;
  content: string;
  timestamp: number;
}

export interface MonitorClassification {
  relevant: boolean;
  confidence: number;
  reason: string;
}

// Phase 2+4: SSE & Activity types
export type SSEEventType =
  // Existing (Phase 2-3)
  | 'agent_start'
  | 'agent_end'
  | 'hex_run_started'
  | 'hex_run_completed'
  | 'error'
  | 'complete'
  | 'scope_message'
  | 'scope_complete'
  | 'assess_start'
  | 'assess_complete'
  | 'hex_assess_ready'
  // New (Phase 4 contract)
  | 'discover_start'
  | 'source_found'
  | 'discover_complete'
  | 'optimize_start'
  | 'plans_ready'
  | 'hex_plans_ready'
  | 'pipeline_complete'
  | 'lava_usage'
  // Monitor events (Phase 12)
  | 'monitor_post'
  | 'monitor_classification'
  | 'crisis_detected'
  // Orchestrator events (Phase 12)
  | 'orchestrator_start'
  | 'orchestrator_step'
  | 'crisis_profile_ready';

export interface SSEEvent {
  type: SSEEventType;
  agent?: string;
  message?: string;
  timestamp: number;
  // Generic data payload
  data?: Record<string, unknown>;
  // Typed payloads for specific events
  content?: string;                    // scope_message
  crisis_profile?: CrisisProfile;      // scope_complete
  gap_analysis?: GapAnalysis;          // assess_complete
  run_url?: string;                    // hex_assess_ready, hex_plans_ready, hex_run_started, hex_run_completed
  status?: string;                     // hex_run_completed
  source?: SourceOption;               // source_found
  sources?: SourceOption[];            // discover_complete
  total_count?: number;                // discover_complete
  plans?: ResponsePlan[];              // plans_ready
  costs?: LavaCostBreakdown;           // lava_usage
  // Monitor fields (Phase 12)
  post?: MonitorPost;
  post_id?: string;
  classification?: MonitorClassification;
  // Orchestrator fields (Phase 12)
  step?: string;
  model?: string;
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

// Phase 4: Pipeline contract types
export interface SourceOption {
  id: string;
  supplier_name: string;
  food_category: string;
  item_name: string;
  quantity_available_lbs: number;
  unit_cost_per_lb: number;
  lead_time_days: number;
  reliability_score: number;
  source_type: 'database' | 'web_search';
  notes: string;
}

export interface PlanLineItem {
  source_id: string;
  supplier_name: string;
  food_category: string;
  item_name: string;
  quantity_lbs: number;
  cost: number;
  lead_time_days: number;
}

export interface ResponsePlan {
  name: 'fastest' | 'cheapest' | 'best_nutrition';
  strategy: string;
  line_items: PlanLineItem[];
  total_cost: number;
  coverage_pct: number;
  max_lead_time_days: number;
  estimated_people_served: number;
}

export interface LavaCostBreakdown {
  total_cost: number;
  by_agent: { agent: string; cost: number; tokens: number; requests: number }[];
  model_tier: string;
}

// Phase 4: API endpoint contracts
export interface DiscoverResponse {
  sources: SourceOption[];
  db_count: number;
  web_count: number;
}

export interface OptimizeResponse {
  plans: ResponsePlan[];
}

// Phase 4: Follow-up / Hex Threads types
export interface FollowupResponse {
  answer: string;
  thread_url: string;
  thread_id: string | null;
  chart_url?: string | null;
}

export type SelectedPlanState = ResponsePlan | null;
