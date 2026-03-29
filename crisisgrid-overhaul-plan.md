# CrisisGrid — Overhaul & Demo Rebuild Plan

> **Reality check:** The architecture doc overstated what works. This document is an honest audit of what's broken, a redesign of the demo flow, and a phased implementation plan to get there.

---

## Part 1: Honest Audit — What's Actually Broken

### Critical Failures (Demo-Blocking)

**1. SCOPE chat agent throws connection error.**
The chat interface in DashboardTab's ChatSidebar POSTs to `/api/scope/chat`, which calls Gemini via Lava. If this errors immediately, likely causes: Lava token expired/invalid, Gemini endpoint rejecting the request format, or the `ChatOpenAI` wrapper misconfigured for the Gemini base URL. But more importantly — the new demo flow eliminates this as the trigger mechanism, so the fix is to *bypass* SCOPE, not repair it.

**2. Seed data is incoherent.** 39 inventory rows with supply >> demand makes the gap analysis show *surpluses* instead of deficits. The entire premise ("crisis response platform") falls apart if there's no crisis in the data. ASSESS will compute positive gaps, DISCOVER will find no deficit categories to search, and OPTIMIZE will produce empty plans.

**3. Plan selection does nothing.** Clicking a plan in PlansTab has no side effects — no state change, no map update, no order generation. This is the climax of the demo ("the system found a solution") and it's a dead end.

**4. Usage tab is empty.** The CostDonut and CostSparkline render but with no data. Either `/api/lava/costs` returns empty, or `lavaCosts` is never populated from SSE events. Either way, the Lava cost transparency story — your main differentiator — is invisible.

**5. Map is static and undifferentiated.** All markers are the same size and color. No distinction between warehouses and distribution sites. Nothing changes post-pipeline. No supplier visualization. No transfer edges. This is supposed to be a *geospatial coordination platform* and the map shows nothing useful.

### Things That Technically Work but Don't Demo Well

**6. No way to trigger a crisis from the frontend.** Even if SCOPE worked, the manual chat flow is slow, fragile, and unimpressive. Judges watch you type and wait. The new demo flow (automated monitoring) is dramatically better.

**7. Hex iframe may or may not load.** Never been verified end-to-end in the actual frontend. Could fail silently.

**8. The pipeline runs but produces thin results.** With 7 suppliers and 20 catalog items, DISCOVER + OPTIMIZE will generate sparse, unconvincing plans.

---

## Part 2: The New Demo Flow

The old flow (human types crisis description → SCOPE chat → pipeline) is slow, fragile, and unimpressive. The new flow is autonomous, visual, and tells a much better story.

### Demo Narrative

```
"CrisisGrid monitors public information channels for signals that could 
impact food security. When it detects a risk, it autonomously kicks off 
a multi-agent research swarm — no human trigger required."

1. MONITOR: A simulated X/news feed shows posts scrolling. Most are 
   irrelevant — the AI filters them out (visible in a log). Then a 
   post about a real crisis goes up.

2. DETECT: The system classifies this as a food-security risk. A state 
   change fires. The dashboard transitions from "steady" to "crisis 
   detected." Show what model was called, what it concluded, the actual 
   crisis parameters extracted.

3. ASSESS: The projected gap report computes automatically. Hex runs 
   and publishes an auditable gap analysis dashboard. Real numbers, 
   real charts.

4. DISCOVER + OPTIMIZE: The research swarm searches for suppliers. 
   Plans are generated. A full Hex report is published.

5. SELECT: The operator reviews 3 plans (speed / cost / nutrition), 
   selects one. 

6. VISUALIZE: The map lights up — supplier nodes appear, sized by 
   order volume, colored by type. Edges show transfers between food 
   banks. The network health gauge animates upward showing projected 
   improvement.

7. (OPTIONAL) ORDER: A dry order document is auto-generated — a real 
   procurement request that could be sent to suppliers.
```

### Why This Is Better

- **Autonomous** — the AI acts without human prompting. Judges see a system, not a chatbot.
- **Visual** — every stage has a visible state change. The log, the transition, the map.
- **Auditable** — Hex reports show the math. Lava costs show the spend.
- **End-to-end** — from signal detection to order generation, one flow.

---

## Part 3: Architecture Changes Required

### New Component: Crisis Monitor

A lightweight service that watches a simulated feed, classifies each item, and triggers the pipeline when a crisis is detected.

**For demo purposes, this can be a scripted simulation, not a real X API integration.** The important thing is that the *UI shows the monitoring happening* and the *classification is a real LLM call*.

```
Backend:
  POST /api/monitor/start     → begins the simulated feed
  GET  /api/monitor/stream    → SSE stream of feed items + classifications
  
  monitor_agent.py:
    - feed_items: list of 5-8 pre-written "posts" (mix of irrelevant + one crisis)
    - For each item, call Gemini Flash with a classifier prompt:
      "Is this post relevant to food security in the Greater Philadelphia area?
       Respond with {relevant: bool, reasoning: string, crisis_profile: {...} | null}"
    - Stream each classification to the frontend
    - When relevant=true, auto-trigger the pipeline with the extracted profile
    
Frontend:
  MonitorFeed component:
    - Shows a scrolling feed of items
    - Each item shows: text, timestamp, classification badge (✓ irrelevant / ⚠ crisis detected)
    - When crisis detected: flash/pulse animation, auto-transition to pipeline view
```

**Historical event approach:** Use a real Philly event. Good options:

- **2023 Philadelphia refinery explosion** — caused food distribution disruptions
- **Summer 2022 heat wave** — increased demand at cooling/feeding centers  
- **COVID-era layoff waves** — well-documented food bank surges in Philly

Write the crisis post as if it's a breaking news tweet about that event. The LLM classifier runs for real. For the DISCOVER web search stage, you can either let it scrape real current suppliers (data will be valid, just not period-accurate) or frame it as "the system searches for available suppliers in real time."

### Modified Pipeline Entry Point

Currently: `POST /api/crisis/launch` takes `{session_id, crisis_profile}` from the SCOPE chat.

New: The monitor agent calls the same endpoint internally when it detects a crisis. The frontend doesn't need to know the trigger source — it connects to the same SSE stream.

```python
# In monitor_agent.py, when classification returns relevant=True:
async def on_crisis_detected(crisis_profile: CrisisProfile, session_id: str, queue: asyncio.Queue):
    # Emit monitor events
    await queue.put(MonitorEvent(type="crisis_detected", crisis_profile=crisis_profile.dict()))
    
    # Launch the existing pipeline
    await run_pipeline(session_id, crisis_profile, queue)
```

### Map Overhaul

The map needs three states:

**Steady state (before pipeline):**
- Warehouse markers: larger, square/diamond shape, darker color
- Distribution site markers: smaller circles
- Color = health score (green/amber/red)
- Size = capacity or current inventory level

**After plan selection:**
- Supplier markers appear (different color, e.g. blue), sized by order quantity
- Edges from suppliers to the sites they'll deliver to (dashed lines)
- Edges between food banks when transfers are recommended (solid lines)
- Animated pulse on the network health gauge showing projected improvement

Implementation approach: The map already uses raw `mapbox-gl` with `useRef`. Add GeoJSON sources for suppliers and routes, toggled visible after plan selection. Use `addLayer` with `circle` type for suppliers, `line` type for routes.

### Plan Selection → State Change

When a plan is selected in PlansTab, it needs to:

1. Store `selectedPlan` in DashboardShell state
2. Pass `selectedPlan` to MapTab
3. MapTab adds supplier markers + route lines based on `selectedPlan.line_items`
4. Animate the network health gauge (show projected improvement)
5. Optionally: generate a dry order document (a formatted summary of what to order from whom)

This means `PlanCard` needs an `onSelect` callback, and DashboardShell needs a `selectedPlan` state variable that flows down to MapTab.

### Seed Data Fix

The seed data must create a *pre-crisis tension state* where supply is adequate but fragile — then the crisis pushes it into deficit.

Current problem: supply >> demand, so ASSESS computes surpluses.

Required: supply ≈ 1.0-1.5x of baseline weekly demand (tight but okay), so when `demand_delta_pct: 40` is applied, projected demand exceeds supply and creates visible deficits, especially in produce and protein.

---

## Part 4: Implementation Phases

### Phase 0: Seed Data Fix (Do This First — 45 min)

Nothing else works if the data is wrong. The gap analysis drives everything downstream.

**Step 1: Understand current data.**

```sql
-- What does inventory look like?
SELECT food_category, SUM(quantity_lbs) as total_supply 
FROM inventory WHERE status = 'available' 
GROUP BY food_category ORDER BY food_category;

-- What does demand look like?
SELECT food_category, AVG(quantity_demanded_lbs) as avg_weekly_demand 
FROM demand_history 
GROUP BY food_category ORDER BY food_category;

-- What's the ratio?
-- If supply/demand > 3 for most categories, the data is broken
```

**Step 2: Fix inventory levels.** Scale down inventory so that supply ≈ 1.2x of average weekly demand. This means the network is "managing but thin" in steady state.

```sql
-- Example: if produce supply is 50,000 but weekly demand is 3,000,
-- scale produce inventory to ~4,000 (about 1.3 weeks of runway)
-- This makes a 40% demand surge immediately create a deficit.

-- First, check what factor to multiply by per category:
-- Target: supply = avg_weekly_demand * 1.2 (for most categories)
-- For produce: supply = avg_weekly_demand * 0.6 (already stressed)
-- For protein: supply = avg_weekly_demand * 0.9 (tight)

-- Then run updates like:
UPDATE inventory 
SET quantity_lbs = quantity_lbs * 0.08  -- adjust this multiplier per-category
WHERE food_category = 'produce' AND status = 'available';

-- Repeat for each category to get realistic ratios
```

**Step 3: Create tension at specific sites.**

```sql
-- Kensington and North Philly are the "stressed" sites
UPDATE sites SET health_score = 0.45 
WHERE name ILIKE '%kensington%' OR name ILIKE '%north philly%';

-- Some items about to expire
UPDATE inventory SET expiration_date = CURRENT_DATE + 3
WHERE food_category IN ('dairy', 'produce')
  AND site_id IN (SELECT id FROM sites WHERE region = 'North Philadelphia')
  AND quantity_lbs > 100
  LIMIT 5;
```

**Step 4: Add more suppliers + catalog items.** You have 7 suppliers with 20 catalog items. DISCOVER needs to find sources for deficit categories.

```sql
-- Add 5-8 more suppliers
INSERT INTO suppliers (name, reliability_score, typical_lead_time_hours) VALUES
  ('ShopRite - Cheltenham', 0.88, 18),
  ('Giant Food - Roosevelt Blvd', 0.85, 24),
  ('USDA TEFAP Southeast PA', 0.92, 72),
  ('Philabundance Warehouse', 0.95, 8),
  ('Reading Terminal Market Vendors', 0.70, 12),
  ('Temple University Dining Services', 0.65, 48),
  ('Aldi - Castor Ave', 0.80, 24),
  ('Local Bucks County Farm Co-op', 0.60, 96);

-- Then add 4-5 catalog items per new supplier, covering all 6 categories
-- Price ranges: donated=$0, USDA=$0.15-0.40, purchased=$0.80-3.50
INSERT INTO supplier_catalog (supplier_id, food_category, subcategory, 
  estimated_qty_available_lbs, price_per_lb, min_order_lbs) VALUES
  -- (use the UUIDs from the INSERT above)
  -- Target: 50-60 total catalog rows across all suppliers
;
```

**Step 5: Verify the fix.** Run the gap analysis manually:

```bash
curl -X POST http://localhost:8000/api/assess \
  -H "Content-Type: application/json" \
  -d '{
    "crisis_type": "layoffs",
    "geography": "North Philadelphia",
    "severity": 4,
    "timeline_days": 42,
    "demand_delta_pct": 40,
    "affected_population": 8000
  }'
```

The response should show **negative gaps** (deficits) in at least 3-4 categories, with produce and protein being the worst. If it still shows surpluses, scale inventory down further.

---

### Phase 1: Fix What's Broken (1-2 hours)

These are bugs in existing code, not new features. Fix them before building anything new.

#### 1.1 Usage Tab Data Flow

**Symptom:** Usage tab shows nothing.

**Likely causes (check in order):**
1. `AI_GATEWAY` env var is not set to `"lava"` → `/api/lava/costs` returns empty array
2. `LAVA_SPEND_KEY` / `LAVA_API_TOKEN` is missing or expired
3. `useLavaCosts` hook isn't polling, or polls the wrong URL
4. `lavaCosts` from SSE `lava_usage` event isn't being extracted in `useCrisisStream`
5. `CostDonut` / `CostSparkline` can't render with the shape of data they receive

**Debug path:**
```bash
# 1. Check if the endpoint returns data
curl http://localhost:8000/api/lava/costs

# 2. If empty, check env
grep AI_GATEWAY apps/api/.env
grep LAVA apps/api/.env

# 3. If env is correct, check if Lava actually has request logs
# (the costs endpoint queries /v1/requests on Lava's API)
curl -H "Authorization: Bearer $LAVA_API_TOKEN" https://api.lava.so/v1/requests?limit=5
```

If Lava has data but the frontend doesn't show it, the issue is in `useLavaCosts` or in how `UsageTab` consumes the data.

If Lava has NO data, then either no LLM calls have actually gone through Lava (check that the pipeline is actually using `AI_GATEWAY=lava`) or the token is wrong.

#### 1.2 Plan Selection → State Propagation

**Current:** `PlanCard` renders but clicking does nothing.

**Fix:** Add `onSelectPlan` callback to PlansTab / PlanCard, wire it up to DashboardShell state.

```typescript
// In DashboardShell.tsx:
const [selectedPlan, setSelectedPlan] = useState<ResponsePlan | null>(null);

// Pass to PlansTab:
<PlansTab 
  plans={plans} 
  selectedPlan={selectedPlan}
  onSelectPlan={(plan) => {
    setSelectedPlan(plan);
    setActiveTab('map');  // auto-switch to map to show the visualization
  }}
/>

// Pass to MapTab:
<MapTab sites={sites} selectedPlan={selectedPlan} />
```

```typescript
// In PlanCard.tsx:
<button 
  onClick={() => onSelectPlan(plan)}
  className={cn(
    "w-full py-2 rounded-lg font-medium transition-all",
    isSelected 
      ? "bg-blue-500 text-white" 
      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
  )}
>
  {isSelected ? "Selected ✓" : "Select Plan"}
</button>
```

#### 1.3 Map Differentiation

**Current:** All markers same size, same color.

**Fix:** Use `site.type` to differentiate, use `site.health_score` for color.

```typescript
// In MapView.tsx, when adding the sites source + layer:
map.current.addLayer({
  id: 'site-markers',
  type: 'circle',
  source: 'sites',
  paint: {
    'circle-color': [
      'interpolate', ['linear'], ['get', 'health_score'],
      0.0, '#ef4444',   // red - critical
      0.5, '#fbbf24',   // amber - warning
      0.7, '#4ade80',   // green - healthy
    ],
    'circle-radius': [
      'match', ['get', 'type'],
      'warehouse', 14,
      'distribution_site', 8,
      8  // default
    ],
    'circle-stroke-width': [
      'match', ['get', 'type'],
      'warehouse', 3,
      'distribution_site', 2,
      2
    ],
    'circle-stroke-color': '#ffffff',
  }
});
```

Also add labels:
```typescript
map.current.addLayer({
  id: 'site-labels',
  type: 'symbol',
  source: 'sites',
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 11,
    'text-offset': [0, 1.5],
    'text-anchor': 'top',
  },
  paint: {
    'text-color': '#e2e8f0',
    'text-halo-color': '#0f172a',
    'text-halo-width': 1,
  }
});
```

---

### Phase 2: Build the Monitor Flow (2-3 hours)

This is the new demo trigger. It replaces the SCOPE chat.

#### 2.1 Backend: Monitor Agent + Endpoint

Create `apps/api/agents/monitor_agent.py`:

```python
import asyncio
import json
import time
from models.crisis import CrisisProfile
from agents.gateway import get_llm

# Pre-written feed items — mix of irrelevant + one crisis post
FEED_ITEMS = [
    {
        "id": "post_1",
        "source": "@PhillyTraffic",
        "text": "Major delays on I-76 westbound near City Ave. Expect 45 min delays. #PhillyTraffic",
        "timestamp": "2026-03-29T10:15:00Z",
    },
    {
        "id": "post_2",
        "source": "@PhillyWeather",
        "text": "Beautiful weekend ahead! Highs in the low 70s Saturday and Sunday. Perfect for the cherry blossoms.",
        "timestamp": "2026-03-29T10:22:00Z",
    },
    {
        "id": "post_3",
        "source": "@6abc",
        "text": "Eagles announce new community partnership with local schools for after-school programs.",
        "timestamp": "2026-03-29T10:31:00Z",
    },
    {
        "id": "post_4",
        "source": "@PhillyInquirer",
        "text": "BREAKING: Aramark announces closure of Kensington distribution facility, 1,800 workers to be laid off over next 6 weeks. Company cites restructuring. North Philadelphia community leaders express concern about economic impact on already-struggling neighborhoods. #PhillyJobs #Kensington",
        "timestamp": "2026-03-29T10:45:00Z",
    },
    {
        "id": "post_5",
        "source": "@PhillySports",
        "text": "Phillies home opener next week! Who's ready? 🔔 #RingTheBell",
        "timestamp": "2026-03-29T10:52:00Z",
    },
]

CLASSIFIER_PROMPT = """You are a food security risk monitor for the Greater Philadelphia Food Bank Network.

Analyze this social media post and determine if it signals a potential food security crisis — 
something that could increase demand at food banks or disrupt food supply chains in the 
Greater Philadelphia area.

Examples of relevant signals: mass layoffs, factory/facility closures, natural disasters, 
extreme weather events, major employer shutdowns, supply chain disruptions, public health 
emergencies affecting food access.

Examples of irrelevant: traffic, weather (unless extreme), sports, general news, politics 
(unless directly affecting food programs).

Post:
Source: {source}
Text: {text}

Respond with ONLY valid JSON (no markdown):
{{
  "relevant": true/false,
  "reasoning": "1-2 sentence explanation",
  "confidence": 0.0-1.0,
  "crisis_profile": {{
    "crisis_type": "layoffs|natural_disaster|partner_shutdown|other",
    "geography": "affected area",
    "severity": 1-5,
    "timeline_days": estimated_duration,
    "demand_delta_pct": estimated_percent_increase,
    "affected_population": estimated_people,
    "notes": "key details",
    "description": "1-sentence summary"
  }} or null if not relevant
}}"""


async def classify_post(post: dict) -> dict:
    """Classify a single post using Gemini Flash via Lava."""
    llm = get_llm("monitor")
    prompt = CLASSIFIER_PROMPT.format(source=post["source"], text=post["text"])
    
    response = await llm.ainvoke(prompt)
    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code blocks
        content = response.content.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            result = json.loads(content.strip())
        else:
            result = {"relevant": False, "reasoning": "Failed to parse", "confidence": 0}
    
    return {**post, "classification": result}


async def run_monitor(queue: asyncio.Queue, delay_between_posts: float = 3.0):
    """Run the feed monitor, classifying each post and emitting events."""
    for post in FEED_ITEMS:
        await asyncio.sleep(delay_between_posts)
        
        # Emit the raw post
        await queue.put({
            "type": "monitor_post",
            "post": post,
            "timestamp": time.time(),
        })
        
        # Classify it
        result = await classify_post(post)
        classification = result["classification"]
        
        await queue.put({
            "type": "monitor_classification",
            "post_id": post["id"],
            "relevant": classification.get("relevant", False),
            "reasoning": classification.get("reasoning", ""),
            "confidence": classification.get("confidence", 0),
            "timestamp": time.time(),
        })
        
        # If crisis detected, extract profile and signal
        if classification.get("relevant") and classification.get("crisis_profile"):
            cp = classification["crisis_profile"]
            crisis_profile = CrisisProfile(
                crisis_type=cp.get("crisis_type", "other"),
                geography=cp.get("geography", "North Philadelphia"),
                severity=cp.get("severity", 3),
                timeline_days=cp.get("timeline_days", 42),
                demand_delta_pct=cp.get("demand_delta_pct", 30),
                affected_population=cp.get("affected_population", 5000),
                notes=cp.get("notes", ""),
                description=cp.get("description", ""),
            )
            
            await queue.put({
                "type": "crisis_detected",
                "crisis_profile": crisis_profile.dict(),
                "source_post": post,
                "timestamp": time.time(),
            })
            
            return crisis_profile  # Signal to launch pipeline
    
    return None  # No crisis detected in feed
```

Create `apps/api/routers/monitor.py`:

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json
import time
from agents.monitor_agent import run_monitor
from agents.pipeline import run_pipeline

router = APIRouter(prefix="/api/monitor", tags=["monitor"])

# Shared queues for monitor sessions
monitor_queues: dict[str, asyncio.Queue] = {}

@router.post("/start")
async def start_monitor(session_id: str = "monitor-demo"):
    queue = asyncio.Queue()
    monitor_queues[session_id] = queue
    
    async def monitor_then_pipeline():
        crisis_profile = await run_monitor(queue, delay_between_posts=3.0)
        if crisis_profile:
            # Automatically launch the pipeline
            await run_pipeline(session_id, crisis_profile, queue)
    
    asyncio.create_task(monitor_then_pipeline())
    return {"status": "monitoring", "session_id": session_id}

@router.get("/stream/{session_id}")
async def stream_monitor(session_id: str):
    queue = monitor_queues.get(session_id)
    if not queue:
        return {"error": "No monitor session found"}
    
    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"
                
                if event.get("type") in ("complete", "pipeline_complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield f": keepalive {time.time()}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Register in `main.py`:
```python
from routers.monitor import router as monitor_router
app.include_router(monitor_router)
```

#### 2.2 Frontend: Monitor Feed Component

Create `apps/web/src/components/monitor/MonitorFeed.tsx`:

This component shows:
- A scrolling feed of social media posts
- Each post gets a classification badge as it's processed
- When a crisis is detected: highlight + auto-trigger pipeline
- Transitions into the regular pipeline view (assessment, plans, etc.)

The hook `useMonitorStream` is similar to `useCrisisStream` but handles the additional `monitor_post`, `monitor_classification`, and `crisis_detected` event types before the regular pipeline events start flowing.

#### 2.3 Wire Into DashboardShell

Replace the ChatSidebar "Launch Pipeline" flow with a "Start Monitor" button that calls `POST /api/monitor/start` and connects to the monitor SSE stream. The monitor events render in a new MonitorFeed component. When `crisis_detected` fires, auto-switch to the Assessment tab and let the regular pipeline SSE events take over.

---

### Phase 3: Map Visualization After Plan Selection (1-2 hours)

#### 3.1 Supplier Markers

When `selectedPlan` is set, add supplier locations to the map. The suppliers table doesn't have lat/lng, so either:
- **Option A (quick):** Add `lat`, `lng` columns to the `suppliers` table and seed them with real Philly-area coordinates
- **Option B (quicker):** Hardcode supplier locations in a lookup map in the frontend `constants.ts`

Then add a GeoJSON source + layer:

```typescript
// When selectedPlan changes, add supplier markers
const supplierFeatures = selectedPlan.line_items.map(item => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [supplierLng, supplierLat] },
  properties: {
    name: item.supplier_name,
    quantity: item.quantity_lbs,
    category: item.food_category,
  }
}));

map.current.addSource('suppliers', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: supplierFeatures }
});

map.current.addLayer({
  id: 'supplier-markers',
  type: 'circle',
  source: 'suppliers',
  paint: {
    'circle-color': '#3b82f6',  // blue
    'circle-radius': [
      'interpolate', ['linear'], ['get', 'quantity'],
      100, 6,
      5000, 18,
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.85,
  }
});
```

#### 3.2 Route Lines (Supplier → Sites)

Draw dashed lines from each supplier to the sites they'll serve. For simplicity, draw lines from each supplier to the nearest distribution site(s).

```typescript
map.current.addLayer({
  id: 'supply-routes',
  type: 'line',
  source: 'routes',
  paint: {
    'line-color': '#3b82f6',
    'line-width': 2,
    'line-dasharray': [4, 4],
    'line-opacity': 0.6,
  }
});
```

#### 3.3 Health Gauge Animation

When a plan is selected, animate the network health score from current → projected. The projected score = current + (coverage_pct / 100) * (1 - current). Use `requestAnimationFrame` or a CSS transition.

```typescript
// In NetworkHero or a dedicated HealthGauge component:
const projectedHealth = currentHealth + (selectedPlan.coverage_pct / 100) * (1 - currentHealth);
// Animate from currentHealth to projectedHealth over 1.5 seconds
```

Show a "glow" effect — a pulsing ring around the health gauge that fades in when a plan is selected.

---

### Phase 4: Hex Verification & Polish (1-2 hours)

#### 4.1 Verify Hex ASSESS End-to-End

```bash
# 1. Check env vars
grep HEX apps/api/.env

# 2. Trigger a run manually
curl -X POST "https://app.hex.tech/api/v1/projects/$HEX_ASSESS_PROJECT_ID/runs" \
  -H "Authorization: Bearer $HEX_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputParams": {"crisis_type":"layoffs","geography":"North Philadelphia","severity":4,"timeline_days":42,"demand_delta_pct":40,"affected_population":8000}}'

# 3. Check the runUrl in a browser (incognito)
# 4. Check it loads in an iframe (some sharing settings block this)
```

If it doesn't work, pre-cache a runUrl from a successful run and hardcode it as a fallback in the frontend.

#### 4.2 Hex Plans Notebook (If Targeting Hex Prize)

Create the CrisisGrid-Plans project in Hex:
1. Input parameter: `plan_data_json` (text)
2. Python cell: parse JSON, build DataFrames
3. Chart cells: grouped bar comparing the 3 plans on cost/coverage/lead_time
4. Publish, set sharing
5. Set `HEX_PLANS_PROJECT_ID` in env

#### 4.3 Hex Threads (If Time Permits)

Run `python scripts/hex_oauth_setup.py` and test a follow-up question. If it works, swap the placeholder FollowUpTab for the real one.

---

### Phase 5: Demo Script & Recording (Final 1 hour)

#### 5.1 The New Demo Script (3 minutes)

```
[0:00] "CrisisGrid is an autonomous crisis response platform for food 
bank networks. It monitors public information, detects risks to food 
security, and orchestrates a multi-agent response — with full AI cost 
transparency."

[0:10] DASHBOARD TAB. "This is the Greater Philadelphia Food Bank 
Network. 8 sites, 218,000 people served." Show NetworkHero + 
InventoryGauges. "The network is operating normally but tight — 
produce and protein are at 60% and 85% of target levels."

[0:25] Click "Start Monitor." The MonitorFeed shows posts scrolling.
"The system is monitoring public channels for food security signals."

[0:35] Posts classify in real time: traffic → irrelevant ✓, 
weather → irrelevant ✓, Eagles news → irrelevant ✓...

[0:45] The layoff post appears. Beat. Classification runs. 
"⚠ CRISIS DETECTED — 1,800 layoffs at the Kensington distribution 
facility. Severity 4. Projected 40% demand surge over 6 weeks."

[0:55] Dashboard transitions. "The system automatically launches 
the full pipeline." ASSESSMENT TAB. Activity feed fills up.
"ASSESS computes the supply-demand gap. DISCOVER searches our 
supplier database AND the web for emergency sources."

[1:15] Gap analysis bars appear. "Produce is our biggest gap — 
only 35% coverage. Protein at 52%." [If Hex iframe loads:] 
"This Hex dashboard runs the same computation with full 
visualizations, triggered automatically via API."

[1:30] PLANS TAB. "Three strategies." Point to each: "Fastest: 
food in 3 days, $X. Cheapest: $Y, 10 days. Best nutrition: 
maximizes category coverage at Z%."

[1:45] Click "Select" on one plan. MAP TAB auto-opens.
"Supplier nodes appear on the map — sized by order volume. 
Routes show the delivery paths. The health gauge shows projected 
improvement from 0.62 to 0.84."

[2:05] USAGE TAB. "Every API call — the monitor classifier, 
ASSESS, DISCOVER, OPTIMIZE — routes through Lava. This entire 
crisis response cost $0.XX in AI compute, broken down by agent."

[2:20] "CrisisGrid demonstrates three things: autonomous AI 
agents that act without human prompting, real-time orchestration 
with streaming visibility, and full cost accountability through 
Lava. Hex powers our auditable analytics dashboards and 
conversational follow-up."

[2:40] Done.
```

#### 5.2 Record a Fallback Video

Screen-record a full successful run. If anything breaks live, narrate over the recording.

#### 5.3 Pre-Run Checklist (Before Demo)

- [ ] Seed data verified (ASSESS shows deficits)
- [ ] `AI_GATEWAY=lava` and tokens are valid
- [ ] Hex kernels pre-warmed (open projects in Hex UI)
- [ ] Mapbox token set
- [ ] Backend running on :8000
- [ ] Frontend running on :3000
- [ ] One successful full run completed
- [ ] Lava costs endpoint returns real data
- [ ] Fallback video recorded

---

## Part 5: Priority Order (If You're Short on Time)

| Priority | Task | Time | Impact |
|---|---|---|---|
| **P0** | Fix seed data (Phase 0) | 45 min | Everything else depends on this |
| **P0** | Fix usage tab data flow (1.1) | 30 min | Lava story is dead without this |
| **P1** | Build monitor agent + endpoint (2.1) | 1.5 hrs | New demo flow trigger |
| **P1** | Plan selection → state propagation (1.2) | 30 min | Demo climax needs a payoff |
| **P1** | Map differentiation (1.3) | 30 min | Map looks broken without this |
| **P2** | Frontend monitor feed component (2.2-2.3) | 1.5 hrs | Visual wow for new flow |
| **P2** | Map supplier visualization (3.1-3.3) | 1.5 hrs | Map becomes the punchline |
| **P3** | Hex ASSESS verification (4.1) | 30 min | Hex prize |
| **P3** | Demo script + fallback recording (5.1-5.3) | 45 min | Presentation |
| **P4** | Hex Plans notebook (4.2) | 1.5 hrs | Hex prize only |
| **P4** | Hex Threads OAuth (4.3) | 45 min | Hex prize only |

**Minimum viable demo (4-5 hours):** P0 + P1 items. Seed data works, monitor triggers pipeline, plan selection updates the map, costs are visible.

**Full demo (8-10 hours):** P0 through P3. Everything above plus the polished monitor feed UI and Hex verification.
