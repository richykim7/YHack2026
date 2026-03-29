# CrisisGrid Supabase Database Guide

> Reference for Hex analytics projects. Use this to understand which tables and columns to query for food bank network analytics.

## Connection

Supabase Postgres. Connect via the Supabase connection string (Supavisor pooler on port 6543).

---

## Tables

### `sites`

The 8 physical locations in the Greater Philadelphia food bank network.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Site identifier |
| `name` | text | Human-readable name |
| `type` | text | `warehouse` or `distribution_site` |
| `health_score` | float | 0.0–1.0. Lower = more stressed. Computed from supply-vs-demand ratio. |

**Fixed data (8 rows):**

| Name | Type | Notes |
|------|------|-------|
| Philabundance Warehouse | warehouse | Main hub |
| Share Food Program Warehouse | warehouse | Secondary hub |
| Camden County Food Bank | distribution_site | |
| Chester Aid Center | distribution_site | |
| Kensington Food Hub | distribution_site | Stressed site (low health) |
| North Philly Distribution | distribution_site | Stressed site (low health) |
| South Philly Pantry | distribution_site | |
| West Philly Community Center | distribution_site | |

**Common queries:**
```sql
-- Which sites are most stressed?
SELECT name, type, health_score
FROM sites
ORDER BY health_score ASC;

-- Just distribution sites
SELECT * FROM sites WHERE type = 'distribution_site';
```

---

### `inventory`

Current food supply at each site. Multiple rows per site per category (different batches with different expiration dates).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `site_id` | uuid FK → sites.id | Which site holds this stock |
| `food_category` | text | One of: `protein`, `grains`, `dairy`, `produce`, `canned`, `beverages` |
| `subcategory` | text | Specific item description (e.g., "mixed protein", "frozen chicken breast") |
| `quantity_lbs` | float | Weight in pounds |
| `unit_cost_dollars` | float | Cost per pound. 0.00 = donated |
| `expiration_date` | date | When this batch expires |
| `received_date` | date | When this batch was received |
| `source_type` | text | `donated`, `purchased`, `usda_commodity`, `planned`, `transfer` |
| `status` | text | `available`, `reserved`, `expired` |

**6 food categories:** `protein`, `grains`, `dairy`, `produce`, `canned`, `beverages`

**Approximate network-wide supply targets:**
- Protein: ~11,400 lbs
- Grains: ~13,500 lbs
- Dairy: ~6,800 lbs
- Produce: ~7,800 lbs
- Canned: ~12,600 lbs
- Beverages: ~6,500 lbs

**Perishable categories** (short expiration windows): `protein`, `dairy`, `produce`

**Common queries:**
```sql
-- Total available inventory by category
SELECT food_category, SUM(quantity_lbs) AS total_lbs
FROM inventory
WHERE status = 'available'
GROUP BY food_category
ORDER BY total_lbs DESC;

-- Inventory per site per category
SELECT s.name, i.food_category, SUM(i.quantity_lbs) AS total_lbs
FROM inventory i
JOIN sites s ON s.id = i.site_id
WHERE i.status = 'available'
GROUP BY s.name, i.food_category
ORDER BY s.name, i.food_category;

-- Expiration risk: food expiring within 7 days
SELECT s.name, i.food_category, SUM(i.quantity_lbs) AS at_risk_lbs
FROM inventory i
JOIN sites s ON s.id = i.site_id
WHERE i.status = 'available'
  AND i.expiration_date < CURRENT_DATE + INTERVAL '7 days'
GROUP BY s.name, i.food_category
ORDER BY at_risk_lbs DESC;

-- Donated vs purchased breakdown
SELECT source_type, SUM(quantity_lbs) AS total_lbs,
       ROUND(SUM(quantity_lbs * unit_cost_dollars)::numeric, 2) AS total_cost
FROM inventory
WHERE status = 'available'
GROUP BY source_type;

-- Which site has the least protein?
SELECT s.name, COALESCE(SUM(i.quantity_lbs), 0) AS protein_lbs
FROM sites s
LEFT JOIN inventory i ON i.site_id = s.id
  AND i.food_category = 'protein'
  AND i.status = 'available'
GROUP BY s.name
ORDER BY protein_lbs ASC;
```

---

### `demand_history`

Historical weekly demand per site per category. Multiple rows per site/category pair (one per week of recorded history). Used to compute average weekly demand.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `site_id` | uuid FK → sites.id | |
| `food_category` | text | Same 6 categories as inventory |
| `quantity_demanded_lbs` | float | Demand for that week in pounds |

**Approximate average weekly demand targets (network-wide):**
- Protein: ~9,500 lbs/week
- Grains: ~7,500 lbs/week
- Dairy: ~5,000 lbs/week
- Produce: ~6,500 lbs/week
- Canned: ~7,000 lbs/week
- Beverages: ~3,800 lbs/week

**Note:** Stressed sites (Kensington Food Hub, North Philly Distribution) have 10–20% higher demand than the network average, especially for protein and produce.

**Common queries:**
```sql
-- Average weekly demand by category
SELECT food_category, ROUND(AVG(quantity_demanded_lbs)::numeric, 0) AS avg_weekly_lbs
FROM demand_history
GROUP BY food_category
ORDER BY avg_weekly_lbs DESC;

-- Which site has the most demand (all categories)?
SELECT s.name, ROUND(AVG(d.quantity_demanded_lbs)::numeric, 0) AS avg_weekly_lbs
FROM demand_history d
JOIN sites s ON s.id = d.site_id
GROUP BY s.name
ORDER BY avg_weekly_lbs DESC;

-- Which site has the highest demand for a specific category?
SELECT s.name, ROUND(AVG(d.quantity_demanded_lbs)::numeric, 0) AS avg_weekly_lbs
FROM demand_history d
JOIN sites s ON s.id = d.site_id
WHERE d.food_category = 'protein'
GROUP BY s.name
ORDER BY avg_weekly_lbs DESC;

-- Demand vs supply gap per category
SELECT
  d.food_category,
  ROUND(AVG(d.quantity_demanded_lbs)::numeric, 0) AS avg_weekly_demand,
  ROUND((SELECT SUM(i.quantity_lbs) FROM inventory i
         WHERE i.food_category = d.food_category AND i.status = 'available')::numeric, 0) AS total_supply,
  ROUND((SELECT SUM(i.quantity_lbs) FROM inventory i
         WHERE i.food_category = d.food_category AND i.status = 'available')::numeric, 0)
    - ROUND(AVG(d.quantity_demanded_lbs)::numeric, 0) * 2 AS two_week_gap
FROM demand_history d
GROUP BY d.food_category
ORDER BY two_week_gap ASC;
```

---

### `suppliers`

Organizations that can provide food to the network.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `name` | text | Organization name |
| `address` | text | Physical address |
| `lat` | float | Latitude |
| `lng` | float | Longitude |
| `type` | text | `partner_food_bank`, `usda_program`, `wholesale`, `grocery_chain` |
| `relationship_status` | text | e.g., `active_partner` |
| `typical_lead_time_hours` | int | How fast they can deliver |
| `reliability_score` | float | 0.0–1.0. Higher = more reliable. |
| `max_delivery_radius_miles` | float | |

**12 suppliers** across the Greater Philadelphia region, ranging from partner food banks (Philabundance, SHARE) to USDA programs, wholesale distributors (US Foods), and grocery chains (ShopRite).

**Common queries:**
```sql
-- All suppliers ranked by reliability
SELECT name, type, reliability_score, typical_lead_time_hours
FROM suppliers
ORDER BY reliability_score DESC;

-- Fastest suppliers
SELECT name, type, typical_lead_time_hours, reliability_score
FROM suppliers
ORDER BY typical_lead_time_hours ASC;
```

---

### `supplier_catalog`

What each supplier has available. 42 items total across all 6 food categories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `supplier_id` | uuid FK → suppliers.id | |
| `food_category` | text | Same 6 categories |
| `subcategory` | text | Specific item (e.g., "frozen chicken breast", "bulk rice") |
| `estimated_qty_available_lbs` | float | How much they can provide |
| `price_per_lb` | float | Cost per pound. 0.00 = donated/free |
| `min_order_lbs` | float | Minimum order size |
| `notes` | text | Optional notes |
| `available_until` | date | Optional availability window |

**Common queries:**
```sql
-- Cheapest sources per category (including free/donated)
SELECT sc.food_category, sc.subcategory, s.name AS supplier,
       sc.price_per_lb, sc.estimated_qty_available_lbs
FROM supplier_catalog sc
JOIN suppliers s ON s.id = sc.supplier_id
ORDER BY sc.food_category, sc.price_per_lb ASC;

-- Total available supply from all suppliers by category
SELECT food_category, SUM(estimated_qty_available_lbs) AS available_lbs,
       COUNT(*) AS num_sources
FROM supplier_catalog
GROUP BY food_category
ORDER BY available_lbs DESC;

-- Free/donated sources only
SELECT sc.subcategory, s.name AS supplier, sc.food_category,
       sc.estimated_qty_available_lbs
FROM supplier_catalog sc
JOIN suppliers s ON s.id = sc.supplier_id
WHERE sc.price_per_lb = 0
ORDER BY sc.estimated_qty_available_lbs DESC;
```

---

### `crisis_events`

Records of pipeline runs — each row is one crisis response cycle.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `created_at` | timestamp | When the pipeline was triggered |
| `crisis_profile` | jsonb | The parsed crisis description (type, severity, geography, affected_population, etc.) |
| `gap_analysis` | jsonb | Supply/demand gap analysis results |
| `discovered_sources` | jsonb | Sources found by the DISCOVER agent |
| `all_plans` | jsonb | Array of 3 response plans (fastest, cheapest, best_nutrition) |
| `response_plan` | jsonb | The plan that was accepted (null if none accepted) |
| `accepted_plan_name` | text | `fastest`, `cheapest`, or `best_nutrition` |
| `audit_log` | jsonb | Array of agent execution audit entries |
| `pipeline_run_id` | text | Tracking ID |
| `pipeline_duration_ms` | int | How long the pipeline took |
| `hex_assess_url` | text | Link to Hex ASSESS dashboard run |
| `hex_plans_url` | text | Link to Hex PLANS dashboard run |

**JSONB field: `crisis_profile`**
```json
{
  "crisis_type": "layoffs",       // layoffs | natural_disaster | partner_shutdown | other
  "geography": "North Philadelphia",
  "severity": 4,                  // 1-5
  "timeline_days": 14,
  "demand_delta_pct": 35.0,       // % increase in demand above baseline
  "affected_population": 15000,
  "food_categories": ["protein", "produce", "dairy"],
  "description": "..."
}
```

**JSONB field: `all_plans` (array of plans)**
```json
[
  {
    "name": "fastest",
    "strategy": "...",
    "total_cost": 1234.56,
    "coverage_pct": 95.2,
    "max_lead_time_days": 2,
    "estimated_people_served": 14280,
    "line_items": [
      {
        "supplier_name": "Philabundance",
        "food_category": "protein",
        "item_name": "frozen chicken breast",
        "quantity_lbs": 1500.0,
        "cost": 0.0,
        "lead_time_days": 1,
        "delivery_cost": 85.50,
        "distance_miles": 12.3
      }
    ]
  }
]
```

**Common queries:**
```sql
-- Recent crisis events with key metrics
SELECT id, created_at,
       crisis_profile->>'crisis_type' AS crisis_type,
       crisis_profile->>'geography' AS geography,
       (crisis_profile->>'severity')::int AS severity,
       (crisis_profile->>'affected_population')::int AS affected_pop,
       accepted_plan_name,
       pipeline_duration_ms
FROM crisis_events
ORDER BY created_at DESC;

-- Cost and coverage of accepted plans
SELECT id,
       crisis_profile->>'crisis_type' AS crisis_type,
       accepted_plan_name,
       (response_plan->>'total_cost')::numeric AS plan_cost,
       (response_plan->>'coverage_pct')::numeric AS coverage_pct,
       (response_plan->>'estimated_people_served')::int AS people_served
FROM crisis_events
WHERE accepted_plan_name IS NOT NULL AND accepted_plan_name != ''
ORDER BY created_at DESC;

-- Avg pipeline duration
SELECT ROUND(AVG(pipeline_duration_ms)::numeric / 1000, 1) AS avg_seconds
FROM crisis_events
WHERE pipeline_duration_ms > 0;
```

---

### `scope_sessions` / `scope_messages`

Conversation history for the crisis intake chatbot. Lower priority for analytics.

**scope_sessions:** `id` (text PK), `crisis_profile` (jsonb), `status` (text), `created_at`

**scope_messages:** `session_id` (text FK), `role` (text: human/ai), `content` (text), `created_at`

---

## Key Relationships

```
sites ──< inventory        (site_id)
sites ──< demand_history   (site_id)
suppliers ──< supplier_catalog (supplier_id)
crisis_events stores JSON snapshots of pipeline results
```

---

## Common Analytical Questions → Query Strategy

| Question | Tables | Key Columns |
|----------|--------|-------------|
| Which food bank has the most demand next week? | `demand_history` JOIN `sites` | AVG(quantity_demanded_lbs) grouped by site |
| Which site is most at risk? | `sites` | health_score (lowest = most at risk) |
| What food is about to expire? | `inventory` JOIN `sites` | expiration_date < NOW() + 7 days, status = 'available' |
| How much protein do we have network-wide? | `inventory` | food_category = 'protein', status = 'available', SUM(quantity_lbs) |
| Supply vs demand gap by category? | `inventory` + `demand_history` | SUM(inventory) vs AVG(demand) * weeks |
| Cheapest way to source 5,000 lbs of protein? | `supplier_catalog` JOIN `suppliers` | food_category = 'protein', ORDER BY price_per_lb |
| Which suppliers are fastest? | `suppliers` | typical_lead_time_hours ASC |
| What crises have we responded to? | `crisis_events` | crisis_profile JSONB fields |
| How much did the last response plan cost? | `crisis_events` | response_plan->>'total_cost' |
| What % of our food is donated vs purchased? | `inventory` | GROUP BY source_type |

---

## Gap Analysis Formula

The platform computes supply/demand gaps using a **marginal deficit model**:

```
surge_need = avg_weekly_demand × (demand_delta_pct / 100) × (timeline_days / 7)
crisis_weekly = avg_weekly_demand × (1 + demand_delta_pct / 100)
safety_stock_target = crisis_weekly × 1.0  (1-week buffer)
inventory_shortfall = MAX(0, safety_stock_target - current_supply)
total_need = surge_need + inventory_shortfall
```

Site priorities use **equity-weighted allocation**: `priority = total_need × (1 / health_score)`. Sites with lower health scores and higher need get more resources.

---

## Important Notes

- All weights are in **pounds (lbs)**
- All costs are in **USD**
- `price_per_lb = 0.00` means donated/free
- `health_score` is 0.0–1.0 where **lower is worse** (more stressed)
- `reliability_score` is 0.0–1.0 where **higher is better**
- Always filter inventory by `status = 'available'` unless you specifically want reserved/expired items
- Stressed sites (Kensington Food Hub, North Philly Distribution) consistently show higher demand and lower supply
