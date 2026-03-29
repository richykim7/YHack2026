# CrisisGrid — Architecture Proposal: Phase 4+ Forward Plan

## Current State (end of Phase 3)

### What's Built and Working

**Backend (partner):**
- SCOPE agent: ChatAnthropic with tool calling, extracts CrisisProfile from natural language
- SSE streaming: agent events → Assessment tab activity feed
- Local gap analysis: deterministic Python computation (instant)
- Hex client: triggers ASSESS notebook via API, returns runUrl
- Lava gateway: all LLM calls routed through Lava for cost tracking
- Lava cost endpoint: per-agent cost breakdown
- Supabase conversation CRUD
- Routers: scope, crisis, assess, lava, health

**Frontend:**
- Dark ops-center theme, 6 tabs: Dashboard | Map | Assessment | Plans | Follow-up | Usage
- Mapbox map with 8 Philly sites, color-coded by health score
- Site detail cards with inventory breakdown + health gauge
- Chat sidebar for SCOPE conversation
- Assessment tab with sub-tabs (Analysis | Activity), Hex iframe embed
- Usage tab with Lava cost breakdown (Recharts)
- SSE consumer, React Context + useReducer

**Hex:**
- ASSESS notebook: 6 input params → SQL queries → Python gap analysis → charts + map + narrative
- Published, sharing enabled, API verified (5s warm, ~25s cold)
- ASSESS project UUID: 019d3500-16a7-7117-a4e1-b2c8346283ac
- Plans notebook: partially built, needs rebuild
- Plans project UUID: 019d3578-7fa3-700b-8283-a55385d1b45c
- Supabase seeded: 8 sites, 38 inventory, 49 demand history, 7 suppliers, 20 catalog items

**Supabase:**
- Schema: sites, inventory, suppliers, supplier_catalog, demand_history, crisis_events
- Indexes and health score function deployed
- Hex connected via session pooler (port 5432)

### What's NOT Built

- DISCOVER agent (supplier search)
- OPTIMIZE agent (plan generation)
- Plans tab content (functional UI + data)
- Follow-up tab content (Hex Threads integration)
- Plans Hex notebook (needs rebuild with real optimization)
- Hex Threads testing

---

## Architecture Decision: How Plans Gets Built

### The Problem

The pipeline needs to produce response plans (fastest, cheapest, best_nutrition). Two options:

**Option A: Backend computes plans, Hex visualizes them.**
Backend runs a local OPTIMIZE function (same dual-path pattern as ASSESS). Hex Plans notebook receives plan data as JSON input param and produces comparison charts. This is consistent with Phase 3's pattern and straightforward for the partner to build.

**Option B: Hex computes plans from Supabase data.**
Hex Plans notebook takes crisis params, queries suppliers/catalog from Supabase, runs greedy optimization in Python, produces plans AND visualizations. More impressive for Hex judges, but puts optimization logic in Hex where it's harder to debug/test.

### Decision: Option A (dual-path) with Hex enrichment

Rationale:
- Consistent with the ASSESS pattern the partner already built
- Backend can include web-searched sources from DISCOVER (Hex can't)
- Optimization logic stays in the codebase (testable, debuggable)
- Hex adds analytical value by cross-referencing plans against live supplier data
- The partner can build OPTIMIZE independently without Hex dependency

The Plans notebook receives plan JSON + crisis params, then:
1. Parses the plans
2. Queries suppliers table to validate/enrich (reliability scores, actual availability)
3. Flags mismatches ("plan claims 5000 lbs from X but catalog shows 3000")
4. Produces comparison charts + enriched analysis + narrative
5. This is NOT redundant with frontend plan cards — frontend shows quick selection UI, Hex shows deep analytical view

### For the demo specifically

Pre-compute both Hex runs. Cache the runUrls. The live demo shows:
1. SCOPE conversation (live, through Lava)
2. ASSESS dashboard (pre-computed Hex embed, appears after "pipeline running" animation)
3. Plans dashboard (pre-computed Hex embed, appears in Plans tab)
4. Threads follow-up (live or pre-tested)
5. Lava cost widget (from real SCOPE calls + cached/mocked pipeline costs)

---

## Revised Pipeline Architecture

```
User describes crisis in chat
         │
         ▼
┌─────────────────────────────────┐
│  SCOPE (LangGraph + Lava)       │  ← LIVE in demo
│  ChatAnthropic via Lava gateway │
│  Extracts CrisisProfile         │
│  SSE: scope events → frontend   │
└──────────┬──────────────────────┘
           │ CrisisProfile
           ▼
┌─────────────────────────────────┐
│  ASSESS (dual-path)             │
│                                 │
│  Path 1: Local Python           │  ← instant, produces GapAnalysis struct
│    gap_analysis_service.py      │
│    Returns structured data      │
│    SSE: assess_complete event   │
│                                 │
│  Path 2: Hex ASSESS notebook    │  ← async, produces dashboard
│    hex_client.trigger_assess()  │
│    Returns runUrl               │
│    SSE: hex_assess_ready event  │
│    Frontend embeds iframe       │
└──────────┬──────────────────────┘
           │ GapAnalysis
           ▼
┌─────────────────────────────────┐
│  DISCOVER (LangGraph + Lava)    │
│                                 │
│  Channel 1: DB suppliers        │  ← SQL query against supplier_catalog
│    Match gaps to available stock│
│                                 │
│  Channel 2: Tavily web search   │  ← find emergency/new sources
│    Via Lava (cheap model tier)  │
│                                 │
│  Merge: SourceOption[]          │
│  SSE: sources_found events      │
└──────────┬──────────────────────┘
           │ SourceOption[]
           ▼
┌─────────────────────────────────┐
│  OPTIMIZE (local Python)        │
│                                 │
│  Input: GapAnalysis +           │
│         SourceOption[]          │
│                                 │
│  Output: 3 ResponsePlans        │
│    - fastest (min lead time)    │
│    - cheapest (min cost)        │
│    - best_nutrition (max cover) │
│                                 │
│  Greedy algorithm, no LLM call  │
│  SSE: plans_ready event         │
│                                 │
│  Parallel: trigger Hex PLANS    │
│    hex_client.trigger_plans()   │
│    Passes plan JSON + params    │
│    SSE: hex_plans_ready event   │
└──────────┬──────────────────────┘
           │ ResponsePlans + Hex runUrl
           ▼
┌─────────────────────────────────┐
│  FRONTEND DISPLAY               │
│                                 │
│  Assessment tab: Hex ASSESS     │
│    iframe embed                 │
│                                 │
│  Plans tab:                     │
│    Plan cards (from pipeline)   │
│    Hex PLANS iframe (enriched)  │
│    Select button per plan       │
│                                 │
│  Dashboard: map updates with    │
│    new supply route edges       │
│    health scores trend up       │
│                                 │
│  Usage tab: Lava cost breakdown │
└──────────┬──────────────────────┘
           │ User asks follow-up
           ▼
┌─────────────────────────────────┐
│  FOLLOW-UP (Hex Threads)        │
│                                 │
│  Backend proxies question to    │
│  Hex MCP: https://app.hex.tech/mcp
│  Prepends crisis context        │
│  Returns answer + chart         │
│  Displayed in Follow-up tab     │
└─────────────────────────────────┘
```

## Technology Responsibility Matrix

| Capability | Technology | Why this tool |
|------------|-----------|---------------|
| Crisis intake conversation | LangGraph + Claude via Lava | Unstructured NL → structured data |
| News/web research | Tavily + Claude via Lava | External intelligence gathering |
| Cost tracking & model routing | Lava gateway | Multi-model tiering, spend visibility |
| Gap analysis computation | Local Python + Hex | Instant structured data + rich viz |
| Supplier matching | Local Python (DB query) | Needs to include web-searched sources |
| Plan optimization | Local Python | Testable, debuggable, no LLM needed |
| Plan visualization & validation | Hex Plans notebook | Cross-references plans vs live DB data |
| Interactive dashboards | Hex embedded iframes | Charts, maps, narrative — no frontend build |
| Ad-hoc follow-up queries | Hex Threads via MCP | AI queries the database conversationally |
| State & orchestration | LangGraph | Multi-step pipeline with streaming |
| Data persistence | Supabase | Shared between backend, Hex, and frontend |
| Map & graph visualization | Mapbox GL JS | Network graph with health indicators |

## SSE Event Schema (contract between backend and frontend)

Existing events (Phase 2-3):
```typescript
| { type: 'scope_message'; content: string }
| { type: 'scope_complete'; crisis_profile: CrisisProfile }
| { type: 'assess_start' }
| { type: 'assess_complete'; gap_analysis: GapAnalysis }
| { type: 'hex_assess_ready'; run_url: string }
```

New events needed (Phase 4+):
```typescript
| { type: 'discover_start' }
| { type: 'source_found'; source: SourceOption }        // streams in one at a time
| { type: 'discover_complete'; sources: SourceOption[] }
| { type: 'optimize_start' }
| { type: 'plans_ready'; plans: ResponsePlan[] }         // frontend renders plan cards
| { type: 'hex_plans_ready'; run_url: string }           // frontend embeds Hex iframe
| { type: 'pipeline_complete' }
| { type: 'lava_usage'; costs: LavaCostBreakdown }       // for Usage tab
```

## Hex Plans Notebook Specification

### Input Parameters (passed via API)

```
plan_data_json     string    JSON array of ResponsePlan objects from OPTIMIZE
crisis_type        string
geography          string
severity           number
timeline_days      number
demand_delta_pct   number
affected_population number
```

### Notebook Structure

```
1. Input params (7 cells)
2. Python: parse plan_data_json → comparison_df, nutrition_df, sources_df
3. SQL: query suppliers table (reliability, lead time, lat/lng, catalog availability)
4. SQL: query sites (population served, for cost-per-person ratios)
5. Python: enrich plans — merge sources against real supplier data
   - Validate: does claimed quantity match catalog availability?
   - Compute: cost per person served (cost / site serves_population)
   - Compute: supplier utilization % (ordered qty / available qty)
   - Flag risks: low reliability suppliers, over-committed quantities
6. Chart: plan comparison (cost / coverage / lead time) — 3 native Hex bar charts
7. Chart: nutritional coverage by plan (grouped bar, color by plan)
8. Chart: supplier reliability for selected sources
9. Chart: sourcing breakdown (stacked bar, qty by supplier per plan)
10. Narrative: executive summary with recommendation + risk flags
```

### What Makes This Non-Redundant With Frontend

The frontend plan cards show: name, cost, coverage %, lead time, select button. Quick decision UI.

The Hex dashboard shows: validated quantities against real supplier data, cost-per-person analysis, supplier reliability cross-reference, risk flags, executive narrative. Stakeholder-grade analysis.

These serve different audiences (operator selecting a plan vs. director reviewing the analysis) and different moments (quick selection vs. deep review).

---

## Remaining Work — Parallelized

### Ian (Hex track)

| Priority | Task | Blocked by | Time est |
|----------|------|-----------|----------|
| 1 | Rebuild Plans notebook with enrichment approach | Need plan JSON shape from partner | 2-3 hrs |
| 2 | Test Hex Threads, document working questions | Seed data (done) | 30 min |
| 3 | Pre-compute ASSESS + PLANS runs for demo | Plans notebook complete | 30 min |
| 4 | Take screenshot fallbacks of all charts | Pre-compute done | 15 min |
| 5 | Test iframe embedding in partner's frontend | Frontend Plans tab exists | 30 min |

### Partner (Backend + Frontend track)

| Priority | Task | Blocked by | Time est |
|----------|------|-----------|----------|
| 1 | DISCOVER agent: DB supplier query + Tavily search | GapAnalysis struct (done) | 2-3 hrs |
| 2 | OPTIMIZE function: greedy algorithm, 3 plans | DISCOVER complete | 1-2 hrs |
| 3 | Plans tab UI: plan cards + Hex iframe embed | OPTIMIZE + Hex Plans notebook | 1-2 hrs |
| 4 | Follow-up tab: proxy to Hex Threads MCP | Threads testing (Ian) | 1 hr |
| 5 | Hex Plans trigger: extend hex_client | Plans notebook published | 30 min |
| 6 | Lava cost aggregation for full pipeline | Pipeline complete | 1 hr |
| 7 | Demo script polish: pre-computed runUrls, activity feed timing | Everything | 1 hr |

### Integration Points (do together)

| When | What |
|------|------|
| After OPTIMIZE is built | Partner shares ResponsePlan JSON shape → Ian adjusts Plans notebook parsing |
| After Plans notebook published | Ian shares project UUID → partner adds to hex_client |
| After Threads tested | Ian shares working questions → partner adds to Follow-up tab suggestions |
| Demo prep | Pre-warm Hex kernels, cache runUrls, test full flow end-to-end |

---

## Demo Flow (2 minutes)

### Screen 1: Steady State (15 sec)
Dashboard tab open. Map shows 8 food bank nodes — 6 green, 2 yellow. Health gauges visible. "This is the Greater Philadelphia food bank network in steady state."

### Screen 2: Crisis Detected (30 sec)
Notification appears: layoffs crisis. Operator clicks into chat, types description. SCOPE agent responds, extracts profile. "Our AI agent — routed through Lava for cost tracking — understands the crisis and structures it for analysis." Click "Launch Pipeline."

### Screen 3: Pipeline Runs (30 sec)
Assessment tab activates. Activity feed shows stages running. ASSESS completes — Hex dashboard appears in iframe. "Hex computed this gap analysis by querying our Supabase database directly. 147,000 lb shortfall, worst in dairy and produce." Quick scroll through charts. Switch to Usage tab: "Lava tracked every API call — this analysis cost $0.47 across 3 model tiers."

### Screen 4: Plans (25 sec)
Plans tab. Three plan cards appear. Below them, Hex Plans dashboard with enriched analysis — supplier reliability, cost-per-person, risk flags. "Hex validated these plans against real supplier data. The cheapest plan relies on a supplier with only 55% reliability — that's flagged here." Operator selects best_nutrition plan.

### Screen 5: Resolution + Follow-up (20 sec)
Map updates: new edges between supplier nodes and food bank nodes. Yellow nodes trend toward green. "The network health improves with the new supply routes."

Follow-up tab: type "Which suppliers have delivered most reliably this month?" Hex Threads returns an answer with a chart. "This is Hex Threads — their AI agent querying the same database through MCP."

### Closing (10 sec)
"Three technologies, three roles: Lava handles multi-model AI orchestration with cost controls. Hex handles database-driven computation and interactive analytics. LangGraph ties the pipeline together. Each one is in the critical path, not bolted on."

---

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Hex cold start during demo | 25s delay | Pre-warm kernels, pre-compute runs | Ian |
| Hex rate limit during testing | Locked out | Track calls, space tests, max 20/hr | Both |
| Plans notebook JSON shape mismatch | Charts break | Share ResponsePlan type early, test with real data | Both |
| Lava forward endpoint shape differs from Anthropic | Backend LLM calls fail | Test one call through Lava first, keep direct fallback | Partner |
| Hex Threads gives bad answers | Follow-up demo falls flat | Pre-test questions, use only verified ones | Ian |
| iframe CORS/auth issues | Dashboard doesn't render | Already verified: sharing works in incognito | Ian |
| DISCOVER Tavily returns no results | Empty pipeline stage | Hardcode fallback sources for demo scenario | Partner |
| Network graph update animation too complex | Ship without it | Static map update (re-color nodes) as fallback | Partner |
