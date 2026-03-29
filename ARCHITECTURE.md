# CrisisGrid Architecture Reference

> Last updated: 2026-03-29

CrisisGrid is an AI-powered crisis response coordination platform for food bank networks. When a community crisis hits, a food bank operator describes the situation in plain language and receives an actionable, costed, multi-option response plan within minutes -- with full AI cost transparency.

Built for YHack 2026 (24-hour hackathon), two-person team, Greater Philadelphia demo scenario.

---

## Table of Contents

1. [System Topology](#system-topology)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Pipeline Orchestration](#pipeline-orchestration)
5. [Data Models](#data-models)
6. [SSE Event Protocol](#sse-event-protocol)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [LLM Routing](#llm-routing)
10. [External Service Integrations](#external-service-integrations)
11. [Environment Variables](#environment-variables)
12. [Key Architecture Decisions](#key-architecture-decisions)
13. [End-to-End Data Flow](#end-to-end-data-flow)
14. [Current Status](#current-status)

---

## System Topology

```
Browser (Next.js 15 on :3000)
  │
  ├── Supabase (direct client queries: sites, inventory)
  ├── Mapbox GL (map tiles)
  │
  └── FastAPI backend (:8000)
        │
        ├── 4-stage pipeline: SCOPE → ASSESS → DISCOVER → OPTIMIZE
        │
        ├── Supabase Postgres
        │     └── sites, inventory, demand_history, suppliers,
        │         supplier_catalog, scope_sessions, scope_messages, crisis_events
        │
        ├── Lava Gateway (AI proxy, cost metering)
        │     ├── Gemini 2.5 Flash (SCOPE agent)
        │     ├── Gemini 2.5 Pro (ASSESS summary)
        │     └── Serper/Google Search (DISCOVER web channel, via forward proxy)
        │
        └── Hex API
              ├── ASSESS notebook (gap analysis visualization)
              ├── HISTORY notebook (demand trends)
              ├── PLANS notebook (plan comparison, not yet configured)
              └── Hex Threads MCP (follow-up Q&A)
```

The frontend and backend are separate processes communicating over HTTP. The frontend runs on port 3000, the backend on port 8000. CORS is configured to allow `http://localhost:3000` only.

---

## Backend Architecture

### Directory Structure

```
apps/api/
├── main.py                     # FastAPI app entry point
├── agents/
│   ├── gateway.py              # LLM routing via Lava or direct Gemini
│   ├── pipeline.py             # Custom async pipeline orchestrator
│   ├── scope_agent.py          # Multi-turn crisis intake with tool calling
│   └── discover_agent.py       # Dual-channel source discovery (DB + web)
├── models/
│   ├── crisis.py               # CrisisProfile, SourceOption, ResponsePlan, PlanLineItem, LavaCostBreakdown
│   ├── assess.py               # GapAnalysis, CategoryGap, HexRunResult, AgentCost, AssessResponse
│   └── events.py               # 19 SSE event types + request/response contracts
├── services/
│   ├── gap_analysis.py         # Deterministic gap computation (Supabase queries + math)
│   ├── optimize.py             # Greedy 3-plan generator (fastest/cheapest/best_nutrition)
│   ├── hex_client.py           # Hex project run trigger + polling
│   └── hex_threads.py          # Hex Threads MCP client (OAuth + async)
├── routers/
│   ├── health.py               # GET /api/health
│   ├── scope.py                # POST /api/scope/chat
│   ├── crisis.py               # POST /api/crisis/launch + GET /api/crisis/stream/{id}
│   ├── assess.py               # POST /api/assess
│   ├── discover.py             # POST /api/discover
│   ├── optimize.py             # POST /api/optimize
│   ├── followup.py             # POST /api/crisis/followup
│   └── lava.py                 # GET /api/lava/costs
├── db/
│   └── conversations.py        # Supabase session/message CRUD
└── scripts/
    ├── test_pipeline.py        # E2E pipeline test
    ├── test_scope.py           # SCOPE chat test
    └── hex_oauth_setup.py      # Interactive Hex OAuth token setup
```

### Entry Point (`main.py`)

The FastAPI app is created with title "CrisisGrid API" and version "0.1.0". CORS middleware allows `http://localhost:3000` with all methods and headers. All 8 routers are mounted via `app.include_router()`. A root `GET /` returns `{"status": "ok", "service": "crisisgrid-api"}`.

### Agent Layer

**gateway.py** -- LLM factory function. `get_llm(agent_name)` returns a `ChatOpenAI` instance configured for either Lava managed proxy or direct Gemini endpoint. Uses `langchain_openai.ChatOpenAI` as a universal wrapper.

| Agent Name | Model | Purpose |
|------------|-------|---------|
| `scope` | `gemini-2.5-flash` | Fast tool calling for crisis intake |
| `assess` | `gemini-2.5-pro` | Careful reasoning for gap analysis summary |
| (default) | `gemini-2.5-flash` | Fallback for any other agent name |

Gateway mode is controlled by `AI_GATEWAY` env var:
- `"lava"`: Routes through `https://api.lava.so/v1`. Uses `LAVA_SPEND_KEY` (or `LAVA_API_TOKEN` fallback). Adds `x-lava-tags: agent:{name}` header for cost attribution.
- `"direct"`: Routes to `https://generativelanguage.googleapis.com/v1beta/openai/`. Uses `GOOGLE_API_KEY`.

**scope_agent.py** -- Multi-turn crisis intake. Uses LangChain's `bind_tools` with a single tool `extract_crisis_profile`. The system prompt instructs Gemini to extract crisis parameters (crisis_type, geography, severity 1-5, timeline_days, demand_delta_pct, affected_population) from operator descriptions. Limits clarifying questions to 1-2 maximum. Conversation history is loaded from and persisted to Supabase (`scope_sessions` and `scope_messages` tables).

**discover_agent.py** -- Dual-channel source discovery. Runs DB and web search concurrently via `asyncio.gather`:
1. **DB channel**: Queries `supplier_catalog` joined with `suppliers` table, filtered by deficit food categories, sorted by `price_per_lb` ascending.
2. **Web channel**: Serper/Google Search via Lava forward proxy (`/v1/forward?u=https://google.serper.dev/search`), max 5 results total. Web sources get conservative defaults: 1000 lbs, $2.50/lb, 3 days lead time, 0.5 reliability.

Deduplication: DB sources win on conflict. Dedup key is `(supplier_name.lower(), food_category, item_name.lower())`.

### Service Layer

**gap_analysis.py** -- Deterministic computation, no LLM:
1. Query inventory: `SUM(quantity_lbs)` by `food_category` WHERE `status='available'`
2. Query demand_history: `AVG(quantity_demanded_lbs)` by `food_category`
3. Projected demand: `avg_weekly * (1 + demand_delta_pct/100) * (timeline_days/7)`
4. Gap: `supply - projected_demand` per category (negative = deficit)
5. Expiration risk: `SUM(quantity_lbs)` WHERE `expiration_date < now() + 7 days`
6. Site health scores: `SELECT id, health_score FROM sites`

Food categories are fixed: `["protein", "grains", "dairy", "produce", "canned", "beverages"]`.

**optimize.py** -- Pure Python greedy algorithm. Generates exactly 3 `ResponsePlan` objects:

| Plan | Sort Order | Strategy |
|------|-----------|----------|
| `fastest` | Sources by `lead_time_days` ASC | Minimize delivery time |
| `cheapest` | Sources by `unit_cost_per_lb` ASC | Minimize total cost |
| `best_nutrition` | Round-robin across categories, each group sorted by `quantity_available_lbs` DESC | Maximize nutritional diversity |

The `_greedy_fill` function iterates sorted sources, greedily filling each category's deficit with `min(available_qty, remaining_gap)`. Coverage percentage is `total_sourced / total_deficit * 100`. Estimated people served is `affected_population * coverage_pct / 100`.

**hex_client.py** -- Hex API integration. `trigger_hex_run(project_id, input_params)` POSTs to `https://app.hex.tech/api/v1/projects/{id}/runs`. `poll_hex_status` checks every 5 seconds (exponential backoff after 10 polls) with terminal statuses: `COMPLETED`, `ERRORED`, `KILLED`, `UNABLE_TO_ALLOCATE_KERNEL`. Three notebook IDs are configured: ASSESS, HISTORY, PLANS.

**hex_threads.py** -- Hex Threads MCP integration. Uses `mcp` Python SDK with OAuth. `HexThreadsClient.ask()` creates a thread via `create_thread` MCP tool, polls via `get_thread` until `idle` status, and extracts the text response. OAuth tokens are persisted to `.hex_oauth_tokens.json` via `FileTokenStorage`. Setup requires interactive OAuth flow via `scripts/hex_oauth_setup.py`.

### Database Layer (`db/conversations.py`)

Lazy-initialized Supabase client. Four async functions:
- `ensure_session(session_id)` -- Upserts into `scope_sessions`
- `load_history(session_id)` -- Returns LangChain `HumanMessage`/`AIMessage` list from `scope_messages`
- `save_message(session_id, role, content)` -- Inserts into `scope_messages`
- `save_crisis_profile(session_id, profile)` -- Updates `scope_sessions` with extracted profile JSON

Note: The async functions use synchronous Supabase client calls internally (the Supabase Python SDK is synchronous).

---

## Frontend Architecture

### Directory Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout, Google Fonts, dark mode
│   └── page.tsx                # Entry point → DashboardShell
├── components/
│   ├── layout/
│   │   ├── DashboardShell.tsx  # 6-tab shell, wires useCrisisStream to all tabs
│   │   ├── DashboardHeader.tsx # Top bar with logo
│   │   └── TabNavigation.tsx   # Tab bar with streaming indicator
│   ├── dashboard/
│   │   ├── DashboardTab.tsx    # Split: NetworkHero + InventoryGauges | ChatSidebar
│   │   ├── ChatSidebar.tsx     # SCOPE intake chat + "Launch Pipeline" button
│   │   ├── CrisisProfileCard.tsx
│   │   ├── NetworkHero.tsx     # Summary strip (inventory total, sites online, pop served)
│   │   ├── InventoryGauges.tsx # 6 circular category gauges
│   │   ├── InventoryBar.tsx
│   │   └── HealthGauge.tsx
│   ├── map/
│   │   ├── MapTab.tsx
│   │   ├── MapView.tsx         # Raw mapbox-gl via useRef
│   │   └── SiteDetailCard.tsx  # Per-site inventory on marker click
│   ├── assessment/
│   │   ├── AssessmentTab.tsx   # Analysis + Activity sub-tabs
│   │   ├── AnalysisView.tsx    # Gap analysis bars + Hex ASSESS iframe
│   │   ├── ActivityFeed.tsx    # Real-time SSE event stream
│   │   ├── ActivityEvent.tsx
│   │   └── GapAnalysisChart.tsx
│   ├── plans/
│   │   ├── PlansTab.tsx        # 3-column grid of plan cards + Hex Plans iframe
│   │   └── PlanCard.tsx        # Stats: cost, coverage%, lead time, people served
│   ├── followup/
│   │   └── FollowUpTab.tsx     # Chat-based Q&A via /api/crisis/followup (NOT currently imported)
│   ├── placeholders/
│   │   └── FollowUpTab.tsx     # Hex Threads iframe embed (CURRENTLY imported)
│   ├── hex/
│   │   ├── HexDashboard.tsx    # Reusable iframe wrapper with skeleton loading
│   │   └── HexSkeleton.tsx
│   ├── usage/
│   │   ├── UsageTab.tsx        # Lava cost transparency dashboard
│   │   ├── CostDonut.tsx       # Per-agent cost breakdown (Recharts PieChart)
│   │   └── CostSparkline.tsx   # Cumulative cost sparkline (Recharts LineChart)
│   └── ui/
│       ├── SiteSelector.tsx    # Dropdown for site selection
│       └── cn.ts               # clsx + tailwind-merge utility
├── hooks/
│   ├── useCrisisStream.ts     # SSE consumer for /api/crisis/stream/{id}
│   ├── useScopeChat.ts        # POST /api/scope/chat hook
│   ├── useInventory.ts        # Supabase inventory aggregation
│   ├── useSites.ts            # Supabase sites query
│   ├── useSiteInventory.ts    # Per-site inventory from Supabase
│   ├── useLavaCosts.ts        # GET /api/lava/costs hook
│   └── useHexRun.ts           # Local hex run state management
├── lib/
│   ├── types.ts               # Complete TypeScript types (mirrors backend Pydantic models)
│   ├── api.ts                 # postJSON helper, API_BASE constant
│   ├── constants.ts           # Philadelphia bounds, health thresholds, network name
│   ├── supabase.ts            # Supabase client initialization
│   └── mockData.ts            # Mock plans + sources (fallback before pipeline runs)
└── styles/
    └── globals.css            # Tailwind + custom animations (tab-in, stagger-in)
```

### Tab System

The app uses a 6-tab layout managed by `DashboardShell`. All tabs are always mounted (CSS `hidden` class) to preserve state. Tab transitions use a `tab-in` CSS animation.

| Tab | Component | Data Source |
|-----|-----------|-------------|
| Dashboard | `DashboardTab` | Supabase (sites, inventory), `useScopeChat`, `launchAndStream()` |
| Map | `MapTab` | Supabase (sites), Mapbox GL |
| Assessment | `AssessmentTab` | SSE events, `/api/assess` (post-pipeline), Hex ASSESS iframe |
| Plans | `PlansTab` | SSE `plans_ready` event, Hex Plans iframe, mock data fallback |
| Follow-up | `FollowUpTab` (placeholder) | Hex Threads iframe (or `/api/crisis/followup` in chat version) |
| Usage | `UsageTab` | `/api/lava/costs` |

### State Management

React Context + `useReducer` pattern is not yet used explicitly; state lives in `DashboardShell` and is passed down via props. Key state:

- `activeTab` / `tabKey` -- Tab navigation
- `events`, `isStreaming`, `isComplete` -- From `useCrisisStream`
- `plans`, `hexPlansUrl`, `sources`, `lavaCosts` -- Rich data extracted from SSE events
- `gapAnalysis`, `hexRunUrl` -- From standalone `/api/assess` call after pipeline completes
- `crisisProfileRef` -- Ref holding the extracted crisis profile

### Custom Hooks

**useCrisisStream** -- The primary data hook. Orchestrates the full pipeline lifecycle:
1. POSTs to `/api/crisis/launch` with session ID and crisis profile
2. Opens SSE connection to `/api/crisis/stream/{session_id}` using `fetch` + `ReadableStream`
3. Parses `data: ` prefixed SSE lines into typed events
4. Maps each event to an `AgentActivity` (id, agent, status, message, timestamp)
5. Extracts rich data: `source_found` -> `sources[]`, `plans_ready` -> `plans[]`, `hex_plans_ready` -> `hexPlansUrl`, `lava_usage` -> `lavaCosts`
6. Terminates on `complete`, `pipeline_complete`, or `error` events

Returns: `{ events, isStreaming, isComplete, launchAndStream, stopStream, sources, plans, hexPlansUrl, lavaCosts }`

**useScopeChat** -- Posts messages to `/api/scope/chat`, manages chat message array and crisis profile extraction.

**useInventory, useSites, useSiteInventory** -- Direct Supabase queries from the frontend using `@supabase/supabase-js` with the anon key.

**useLavaCosts** -- Polls `/api/lava/costs` for cost transparency data.

### Constants

```typescript
PHILADELPHIA_BOUNDS: [[-75.40, 39.84], [-74.95, 40.13]]
HEALTH_THRESHOLDS: { good: 0.7, warning: 0.5 }
HEALTH_COLORS: { good: '#4ade80', warning: '#fbbf24', critical: '#f87171' }
NETWORK_NAME: 'Greater Philadelphia Food Bank Network'
```

---

## Pipeline Orchestration

The pipeline is a custom async orchestrator in `agents/pipeline.py`. It is **not** LangGraph despite the original architecture spec -- the custom approach is simpler and avoids version mismatch issues.

### Execution Model

```
POST /api/crisis/launch
  │
  ├── Pre-creates asyncio.Queue for the session
  ├── asyncio.create_task(run_pipeline(...))  ← fire-and-forget
  └── Returns {"status": "started"} immediately
                                              ↕
GET /api/crisis/stream/{session_id}           ↕ (Queue)
  │                                           ↕
  └── EventSourceResponse reads from Queue ←──┘
```

The queue is created in the POST handler before the task starts, eliminating the race condition where the SSE endpoint might connect before the queue exists. The stream endpoint uses `asyncio.wait_for(queue.get(), timeout=30.0)` with keepalive comments on timeout. Terminal events (`complete`, `pipeline_complete`, `error`) break the stream loop. Queue is cleaned up in the `finally` block.

### Stage Execution

Each stage follows the pattern: emit start event -> execute work -> emit completion event(s).

```
run_pipeline(session_id, crisis_profile)
  │
  ├── Stage 1: SCOPE (confirmation only)
  │   └── Emits agent_start + agent_end (profile already extracted via chat)
  │
  ├── Stage 2: ASSESS
  │   ├── compute_gap_locally(profile) → GapAnalysis
  │   ├── generate_ai_summary(gap, profile) → gap.ai_summary (Gemini 2.5 Pro)
  │   ├── Emits assess_start, assess_complete
  │   └── trigger_hex_run(ASSESS notebook) → Emits hex_assess_ready (non-blocking, skips on failure)
  │
  ├── Stage 3: DISCOVER
  │   ├── discover_sources(gap, profile) → list[SourceOption]
  │   │   ├── DB: supplier_catalog query (concurrent)
  │   │   └── Web: Serper via Lava (concurrent)
  │   ├── Emits discover_start, source_found (per source), discover_complete
  │   └── on_source_found callback streams each source as it's found
  │
  ├── Stage 4: OPTIMIZE
  │   ├── generate_plans(gap, sources, profile) → 3 ResponsePlan objects
  │   ├── Emits optimize_start, plans_ready
  │   └── trigger_plans_run(plans, profile) → Emits hex_plans_ready (non-blocking, skips on failure)
  │
  └── Emits pipeline_complete (terminal)
      └── On error: emits ErrorEvent (terminal)
```

### Error Handling

All exceptions in the pipeline are caught at the top level and emitted as `ErrorEvent`. Individual stage failures (Hex triggers, AI summary) are caught and logged as warnings without stopping the pipeline.

---

## Data Models

All models use Pydantic v2 (`BaseModel`). TypeScript mirrors are in `apps/web/src/lib/types.ts`.

### Core Domain Models (`models/crisis.py`)

**CrisisProfile** -- Single source of truth for the entire pipeline.

| Field | Type | Description |
|-------|------|-------------|
| `crisis_type` | `str` | `'layoffs'`, `'natural_disaster'`, `'partner_shutdown'`, `'other'` |
| `geography` | `str` | Affected region or zip codes |
| `severity` | `int` | 1-5 scale |
| `timeline_days` | `int` | Expected duration of crisis |
| `demand_delta_pct` | `float` | Estimated percent increase in food demand |
| `affected_population` | `int` | Number of people affected |
| `notes` | `str` | Additional context |
| `food_categories` | `list[str]` | Default `[]` -- SCOPE may not extract this |
| `description` | `str` | Default `""` -- filled from notes or chat |

**SourceOption** -- A potential sourcing option from DB or web search.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | UUID or slug (e.g., `"philly-foods-canned-beans"`) |
| `supplier_name` | `str` | |
| `food_category` | `str` | Matches the 6 food categories |
| `item_name` | `str` | |
| `quantity_available_lbs` | `float` | |
| `unit_cost_per_lb` | `float` | |
| `lead_time_days` | `int` | |
| `reliability_score` | `float` | 0.0-1.0 |
| `source_type` | `str` | `"database"` or `"web_search"` |
| `notes` | `str` | URL for web sources |

**PlanLineItem** -- A single sourcing action within a response plan.

| Field | Type | Description |
|-------|------|-------------|
| `source_id` | `str` | References `SourceOption.id` |
| `supplier_name` | `str` | |
| `food_category` | `str` | |
| `item_name` | `str` | |
| `quantity_lbs` | `float` | Amount to order |
| `cost` | `float` | `quantity_lbs * unit_cost_per_lb` |
| `lead_time_days` | `int` | |

**ResponsePlan** -- One of 3 optimized response plans.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `str` | `"fastest"`, `"cheapest"`, or `"best_nutrition"` |
| `strategy` | `str` | 1-sentence description |
| `line_items` | `list[PlanLineItem]` | |
| `total_cost` | `float` | |
| `coverage_pct` | `float` | 0-100 |
| `max_lead_time_days` | `int` | Longest lead time across all items |
| `estimated_people_served` | `int` | |

**LavaCostBreakdown** -- Aggregated costs.

| Field | Type | Description |
|-------|------|-------------|
| `total_cost` | `float` | |
| `by_agent` | `list[dict]` | `[{agent, cost, tokens, requests}]` |
| `model_tier` | `str` | |

### Assessment Models (`models/assess.py`)

**CategoryGap**

| Field | Type | Description |
|-------|------|-------------|
| `category` | `str` | One of the 6 food categories |
| `supply_lbs` | `float` | Current available inventory |
| `demand_lbs` | `float` | Projected demand for crisis period |
| `gap_lbs` | `float` | `supply - demand` (negative = deficit) |
| `coverage_ratio` | `float` | `supply / demand` (0.0 to 1.0+) |

**GapAnalysis**

| Field | Type | Description |
|-------|------|-------------|
| `total_supply_lbs` | `float` | |
| `total_demand_lbs` | `float` | |
| `total_gap_lbs` | `float` | |
| `gaps_by_category` | `list[CategoryGap]` | |
| `expiration_risk_lbs` | `float` | Stock expiring within 7 days |
| `site_health_scores` | `dict[str, float]` | `{site_id: score}` |
| `ai_summary` | `str` | Gemini-generated 1-2 sentence summary |

**HexRunResult**

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | `str` | |
| `run_url` | `str` | |
| `status` | `str` | `PENDING`, `RUNNING`, `COMPLETED`, `ERRORED`, `KILLED`, `TIMEOUT` |

---

## SSE Event Protocol

Events are serialized as `data: {JSON}\n\n` lines over the SSE stream. Each event has a `type` discriminator field and a `timestamp` (Unix seconds, float). The frontend converts timestamps to milliseconds (`* 1000`).

### Event Types (19 total)

| Type | Payload Fields | Terminal? | Agent |
|------|---------------|-----------|-------|
| `agent_start` | `agent`, `message` | No | Varies |
| `agent_end` | `agent`, `message` | No | Varies |
| `scope_message` | `content` | No | scope |
| `scope_complete` | `crisis_profile` (dict) | No | scope |
| `assess_start` | -- | No | assess |
| `assess_complete` | `gap_analysis` (dict) | No | assess |
| `hex_assess_ready` | `run_url` | No | assess |
| `discover_start` | -- | No | discover |
| `source_found` | `source` (dict) | No | discover |
| `discover_complete` | `sources` (list), `total_count` | No | discover |
| `optimize_start` | -- | No | optimize |
| `plans_ready` | `plans` (list) | No | optimize |
| `hex_plans_ready` | `run_url` | No | optimize |
| `hex_run_started` | `agent`, `run_url` | No | hex |
| `hex_run_completed` | `agent`, `run_url`, `status` | No | hex |
| `pipeline_complete` | -- | Yes | pipeline |
| `lava_usage` | `costs` (dict) | No | pipeline |
| `complete` | `message` (optional), `agent` (optional) | Yes | pipeline |
| `error` | `message`, `agent` (optional) | Yes | pipeline |

### Event Union Type

All events are members of the `SSEEvent` union type (Python: `Union[...]`, TypeScript: discriminated union on `type`).

### Stream Lifecycle

1. Client connects to `GET /api/crisis/stream/{session_id}`
2. Server sends events as they occur
3. Server sends keepalive comments (`:\n\n`) every 30 seconds during idle periods
4. Stream terminates on `complete`, `pipeline_complete`, or `error`
5. Queue is cleaned up after stream ends

---

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root health check. Returns `{"status": "ok", "service": "crisisgrid-api"}` |
| `/api/health` | GET | Liveness probe |

### SCOPE (Crisis Intake)

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/scope/chat` | POST | `{session_id: str, message: str}` | `{response: str, crisis_profile: CrisisProfile \| null, is_complete: bool}` |

Multi-turn conversation. When the LLM has enough information, it calls the `extract_crisis_profile` tool and returns `is_complete: true` with the extracted profile.

### Pipeline

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/crisis/launch` | POST | `{session_id: str, crisis_profile: dict}` | `{"status": "started", "session_id": str}` |
| `/api/crisis/stream/{session_id}` | GET | -- | SSE event stream |

The launch endpoint creates an asyncio task and returns immediately. The stream endpoint is an `EventSourceResponse` that reads from the session's asyncio queue.

### Standalone Stage Endpoints

These can be called independently of the pipeline for testing or modular use.

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/assess` | POST | `CrisisProfile` fields | `{gap_analysis: GapAnalysis, hex_run: HexRunResult \| null}` |
| `/api/discover` | POST | `{gap_analysis: dict, crisis_profile: dict}` | `{sources: SourceOption[], db_count: int, web_count: int}` |
| `/api/optimize` | POST | `{gap_analysis: dict, sources: SourceOption[], crisis_profile: dict}` | `{plans: ResponsePlan[]}` |

### Follow-up

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/crisis/followup` | POST | `{question: str, crisis_type?: str, geography?: str, affected_population?: int, timeline_days?: int, demand_delta_pct?: float}` | `{answer: str, thread_url: str, thread_id: str \| null}` |

Proxies to Hex Threads via MCP. Falls back to informational message if OAuth tokens are not configured.

### Cost Transparency

| Endpoint | Method | Parameters | Response |
|----------|--------|-----------|----------|
| `/api/lava/costs` | GET | `limit` (default 100, max 500) | `{costs: AgentCost[], total_cost: float, gateway: str}` |

Fetches from Lava `/v1/requests` endpoint and aggregates by agent tag. Returns empty array when `AI_GATEWAY != "lava"`.

---

## Database Schema

Hosted on Supabase (Postgres). All tables are in the `public` schema.

### `sites` (8 rows)

Greater Philadelphia food bank locations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `address` | `text` | |
| `lat` | `float8` | |
| `lng` | `float8` | |
| `type` | `text` | `'warehouse'` or `'distribution_site'` |
| `capacity_total_lbs` | `float8` | |
| `capacity_refrigerated_lbs` | `float8` | |
| `capacity_frozen_lbs` | `float8` | |
| `health_score` | `float8` | 0.0-1.0 |
| `health_score_updated_at` | `timestamptz` | |
| `operating_hours` | `text` | |
| `serves_population` | `int4` | |
| `region` | `text` | |
| `contact_name` | `text` | |
| `contact_phone` | `text` | |
| `created_at` | `timestamptz` | |

### `inventory` (39 rows)

Current stock by site and category.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `site_id` | `uuid` FK → `sites.id` | |
| `food_category` | `text` | One of: `protein`, `grains`, `dairy`, `produce`, `canned`, `beverages` |
| `subcategory` | `text` | |
| `quantity_lbs` | `float8` | |
| `unit_cost_dollars` | `float8` | |
| `expiration_date` | `date` | |
| `received_date` | `date` | |
| `source_type` | `text` | `'donated'`, `'purchased'`, `'usda_commodity'` |
| `status` | `text` | `'available'`, `'reserved'`, `'expired'`, `'distributed'` |
| `created_at` | `timestamptz` | |

### `demand_history` (288 rows)

Weekly demand records by site and category.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `site_id` | `uuid` FK → `sites.id` | |
| `food_category` | `text` | |
| `quantity_demanded_lbs` | `float8` | |
| `week_start` | `date` | |
| `created_at` | `timestamptz` | |

### `suppliers` (7 rows)

Supplier metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `reliability_score` | `float8` | 0.0-1.0 |
| `typical_lead_time_hours` | `int4` | |
| `created_at` | `timestamptz` | |

### `supplier_catalog` (20 rows)

Available items per supplier.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `supplier_id` | `uuid` FK → `suppliers.id` | |
| `food_category` | `text` | |
| `subcategory` | `text` | |
| `estimated_qty_available_lbs` | `float8` | |
| `price_per_lb` | `float8` | |
| `min_order_lbs` | `float8` | |
| `available_until` | `date` | |
| `notes` | `text` | |
| `created_at` | `timestamptz` | |

### `scope_sessions` (6+ rows)

Chat session tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` PK | Session UUID |
| `crisis_profile` | `jsonb` | Extracted `CrisisProfile` or null |
| `status` | `text` | `'active'`, `'extracting'`, etc. |
| `created_at` | `timestamptz` | |

### `scope_messages` (14+ rows)

Conversation messages.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | |
| `session_id` | `text` FK → `scope_sessions.id` | |
| `role` | `text` | `'human'` or `'ai'` |
| `content` | `text` | |
| `created_at` | `timestamptz` | |

### `crisis_events` (0 rows)

Audit trail table. Schema exists but is not currently written to.

---

## LLM Routing

All LLM calls go through a configurable gateway (Lava or direct Gemini). The abstraction layer is `ChatOpenAI` from `langchain_openai`, which provides a uniform interface regardless of backend.

### Lava Gateway Mode (`AI_GATEWAY=lava`)

```
ChatOpenAI(base_url="https://api.lava.so/v1")
  → Lava auto-routes by model name
  → Gemini 2.5 Flash / Pro
```

- Authentication: `LAVA_SPEND_KEY` (budget-controlled) or `LAVA_API_TOKEN` (secret key fallback)
- Cost attribution: `x-lava-tags: agent:{name}` header on every request
- Web search: Serper via Lava forward proxy at `/v1/forward?u=https://google.serper.dev/search`
- Cost query: `GET /v1/requests` on Lava API, aggregated by agent tag

### Direct Mode (`AI_GATEWAY=direct`)

```
ChatOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
  → Google Gemini API directly
```

- Authentication: `GOOGLE_API_KEY`
- No cost tracking available
- Web search uses same Lava forward proxy (still requires `LAVA_API_TOKEN`)

### Model Selection

| Agent | Model | Rationale |
|-------|-------|-----------|
| `scope` | `gemini-2.5-flash` | Fast response for interactive chat, tool calling support |
| `assess` | `gemini-2.5-pro` | Better reasoning for gap analysis narrative summary |
| (default) | `gemini-2.5-flash` | Fallback for unrecognized agent names |

Temperature is 0.3 for all agents (configurable per call via `get_llm(agent_name, temperature)`).

---

## External Service Integrations

### Lava Gateway

- **URL**: `https://api.lava.so/v1`
- **Purpose**: AI proxy with automatic billing, model routing, cost metering
- **Auth**: Bearer token (`LAVA_API_TOKEN` or `LAVA_SPEND_KEY`)
- **Rate limits**: Standard API rate limits (not documented as constrained)
- **Risk**: Medium. Fallback: switch `AI_GATEWAY` to `"direct"` and use `GOOGLE_API_KEY`
- **Cost API**: `GET /v1/requests` returns per-request usage with tags

### Hex API

- **URL**: `https://app.hex.tech/api/v1`
- **Purpose**: Trigger analytics notebook runs, embed dashboards via iframe
- **Auth**: Bearer token (`HEX_API_TOKEN`)
- **Rate limits**: 20 RunProject/minute, 60 status checks/hour
- **Polling**: 5s intervals, exponential backoff after 10 polls, 30 poll max (2.5 min timeout)
- **Terminal statuses**: `COMPLETED`, `ERRORED`, `KILLED`, `UNABLE_TO_ALLOCATE_KERNEL`
- **Risk**: High (rate limits, cold kernel starts, iframe sharing requirements)
- **Fallback**: Pre-cached run URLs, screenshot fallbacks

### Hex Threads MCP

- **URL**: `https://app.hex.tech/mcp`
- **Purpose**: Follow-up Q&A -- creates Hex Threads that can query the Supabase database
- **Auth**: OAuth 2.0 (authorization code + refresh token flow)
- **Token storage**: `.hex_oauth_tokens.json` in `apps/api/`
- **Setup**: `python scripts/hex_oauth_setup.py` (interactive browser OAuth flow, redirect to `localhost:8921/callback`)
- **Risk**: Medium (requires OAuth setup, session management)
- **Fallback**: Informational message directing user to run setup script

### Serper (Google Search)

- **URL**: Proxied via `https://api.lava.so/v1/forward?u=https://google.serper.dev/search`
- **Purpose**: DISCOVER web channel -- find emergency food suppliers
- **Auth**: Lava token (Lava manages Serper billing)
- **Max results**: 5 total across all deficit categories (2 per category query)
- **Risk**: Low. Pipeline continues with DB-only results if search fails

### Mapbox

- **Purpose**: Map tiles for the Map tab
- **Auth**: `NEXT_PUBLIC_MAPBOX_TOKEN` (frontend only)
- **Risk**: Low (mature, reliable service)

### Supabase

- **URL**: Configured via `SUPABASE_URL`
- **Purpose**: Primary database for all persistent data
- **Auth**: Service role key (backend), anon key (frontend)
- **Risk**: Low (managed service, free tier sufficient for hackathon)

---

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY` | Yes | `"lava"` or `"direct"` |
| `LAVA_API_TOKEN` | If lava | Lava secret key (also used for Serper forward proxy) |
| `LAVA_SPEND_KEY` | Optional | Lava spend key (budget-controlled, preferred over secret key for LLM calls) |
| `LAVA_BASE_URL` | No | Default: `https://api.lava.so` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (full access) |
| `HEX_API_TOKEN` | Optional | Hex API authentication |
| `HEX_ASSESS_PROJECT_ID` | Optional | Hex ASSESS notebook project ID |
| `HEX_HISTORY_PROJECT_ID` | Optional | Hex HISTORY notebook project ID |
| `HEX_PLANS_PROJECT_ID` | Optional | Hex PLANS notebook project ID (not yet configured) |
| `HEX_OAUTH_TOKEN_FILE` | No | Override path for Hex OAuth token storage |
| `GOOGLE_API_KEY` | If direct | Direct Gemini API key |

### Frontend (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public, row-level security) |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (e.g., `http://localhost:8000`) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional | Mapbox access token (Map tab requires this) |

---

## Key Architecture Decisions

### 1. Custom Orchestrator, Not LangGraph

The original spec called for LangGraph, but the pipeline uses a custom async orchestrator. LangGraph 1.x had breaking API changes from 0.x (new `interrupt()` + `Command` pattern), and the pipeline's sequential 4-stage flow doesn't benefit from LangGraph's graph abstraction. The custom orchestrator is simpler, has fewer dependencies, and is easier to debug during a hackathon.

### 2. SSE, Not WebSocket

Data flows one direction: server to client. The POST endpoint starts the pipeline; SSE streams results back. WebSocket would add bidirectional complexity for no benefit.

### 3. Raw mapbox-gl, Not react-map-gl

The `MapView` component uses `mapbox-gl` directly via `useRef` for imperative control. For 8 markers and basic color coding, this avoids the abstraction overhead and debugging complexity of `react-map-gl`.

### 4. Dual-Path ASSESS

Local Python computation feeds the pipeline with deterministic gap analysis. Hex runs in parallel for visualization only. This is necessary because Hex does not expose cell outputs via API -- you can trigger a run and get an iframe URL, but you cannot extract computed values.

### 5. Greedy Optimizer, No LLM

The OPTIMIZE stage is pure Python. The greedy algorithm is deterministic, fast (sub-millisecond), and free (no API calls). LLM-based optimization would be slower, non-deterministic, and costly for no meaningful improvement on this problem size.

### 6. Context + Props, Not Zustand

State management uses React props passed from `DashboardShell`. For unidirectional SSE data flowing to 6 tabs, this is sufficient. A state library would add dependency overhead without benefit.

### 7. Mock Data Fallback

`PlansTab` shows mock plans with a "MOCK DATA" badge before the pipeline runs. This enables UI development and demo walkthrough without requiring a full pipeline execution. Mock data is seamlessly replaced by real SSE data.

### 8. Fire-and-Forget Pipeline Launch

`asyncio.create_task()` is used instead of FastAPI's `BackgroundTasks` to start the pipeline. This ensures the task starts on the event loop immediately, eliminating the race condition where the SSE stream endpoint might connect before the pipeline has started emitting events.

### 9. Frontend Direct Supabase Access

The frontend queries Supabase directly (via anon key) for read-only data like sites and inventory. This avoids routing simple reads through the FastAPI backend, reducing latency and backend load. Write operations and sensitive queries go through the backend with the service role key.

---

## End-to-End Data Flow

```
1. User opens dashboard
   ├── useInventory → Supabase: aggregate inventory by category
   ├── useSites → Supabase: fetch all 8 sites
   └── Dashboard tab renders: NetworkHero, InventoryGauges, ChatSidebar

2. User types crisis description in ChatSidebar
   ├── useScopeChat → POST /api/scope/chat
   ├── scope_agent.py → ChatOpenAI (Gemini Flash) with tool binding
   ├── Multi-turn: 1-2 clarifying questions if needed
   └── Tool call: extract_crisis_profile → CrisisProfile
       ├── Persisted to Supabase scope_sessions
       └── Returned to frontend with is_complete: true

3. User clicks "Launch Pipeline"
   ├── DashboardShell.handleLaunch(sessionId, crisisProfile)
   ├── useCrisisStream.launchAndStream()
   │   ├── POST /api/crisis/launch → asyncio.create_task(run_pipeline)
   │   └── GET /api/crisis/stream/{id} → SSE connection
   │
   ├── SCOPE stage → agent_start, agent_end events
   │
   ├── ASSESS stage
   │   ├── compute_gap_locally → Supabase queries → GapAnalysis
   │   ├── generate_ai_summary → Gemini 2.5 Pro → ai_summary string
   │   ├── assess_start, assess_complete events
   │   └── trigger_hex_run(ASSESS) → hex_assess_ready event
   │
   ├── DISCOVER stage
   │   ├── DB: supplier_catalog query (concurrent)
   │   ├── Web: Serper via Lava (concurrent)
   │   ├── discover_start, source_found × N, discover_complete events
   │   └── Deduplication (DB wins)
   │
   ├── OPTIMIZE stage
   │   ├── generate_plans → 3 ResponsePlan objects
   │   ├── optimize_start, plans_ready events
   │   └── trigger_plans_run(PLANS) → hex_plans_ready event
   │
   └── pipeline_complete event → stream closes

4. Frontend updates from SSE
   ├── events[] → AssessmentTab: ActivityFeed
   ├── sources[] → (available for future use)
   ├── plans[] → PlansTab: 3 PlanCard components
   ├── hexPlansUrl → PlansTab: HexDashboard iframe
   └── lavaCosts → UsageTab: CostDonut + CostSparkline

5. Post-pipeline
   ├── DashboardShell useEffect → POST /api/assess → standalone gap analysis
   │   └── AssessmentTab: AnalysisView (gap bars + Hex iframe)
   └── UsageTab polls GET /api/lava/costs for updated cost data

6. Follow-up (optional)
   ├── FollowUpTab → POST /api/crisis/followup
   ├── followup.py → HexThreadsClient.ask()
   │   ├── MCP: create_thread → poll get_thread → extract answer
   │   └── Returns {answer, thread_url, thread_id}
   └── OR: placeholder FollowUpTab shows Hex Threads iframe directly
```

---

## Current Status

### Working

- Full pipeline execution: SCOPE -> ASSESS -> DISCOVER -> OPTIMIZE
- SSE streaming with all 19 event types
- All 6 dashboard tabs rendering
- Supabase queries (inventory, sites, demand history, suppliers, supplier catalog)
- SCOPE multi-turn chat with Gemini tool calling
- Deterministic gap analysis
- Dual-channel source discovery (DB + Serper web search)
- 3-plan greedy optimization
- Lava cost tracking and `/api/lava/costs` aggregation
- Hex ASSESS notebook trigger (non-blocking)
- Mock data fallback for plans

### Partially Working

- Follow-up tab: iframe/placeholder version is active; chat-based version (`followup/FollowUpTab.tsx`) exists but is not imported in `DashboardShell`
- Map tab: functional but requires `NEXT_PUBLIC_MAPBOX_TOKEN` to display tiles

### Not Yet Configured

- `HEX_PLANS_PROJECT_ID` -- No Plans notebook has been created in Hex
- `crisis_events` table -- Schema exists but pipeline does not write audit events
- Hex Threads OAuth -- Requires running `scripts/hex_oauth_setup.py` interactively

### Pending Work

- Hex Plans notebook build and integration
- Hex Threads end-to-end testing with live OAuth
- Demo pre-computation (cached pipeline results for instant demo)
- End-to-end polish and error state handling
