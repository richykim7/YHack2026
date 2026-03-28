<!-- GSD:project-start source:PROJECT.md -->
## Project

**CrisisGrid**

CrisisGrid is an AI-powered crisis response coordination platform for food bank networks. It uses a multi-agent LangGraph pipeline to analyze supply chain crises, discover sourcing options, and generate optimized response plans — all visualized on a real-time operational dashboard. Built for YHack 2026 (24-hour hackathon), two-person team, Greater Philadelphia demo scenario.

**Core Value:** When a community crisis hits, a food bank operator can describe the situation in plain language and receive an actionable, costed, multi-option response plan within minutes — with full AI cost transparency.

### Constraints

- **Timeline**: 24 hours total, this milestone covers hours 0-6 equivalent
- **Team**: 2 engineers — scaffold both sides now, split work after
- **Stack**: Locked by architecture spec (Next.js + FastAPI + LangGraph + Supabase + Hex + Lava)
- **Demo region**: Greater Philadelphia
- **Hex rate limits**: 20 RunProject/minute, 60 status checks/hour
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Verdict
## Recommended Stack (Corrected from Architecture Spec)
### Frontend -- Core
| Technology | Spec Version | Correct Version | Purpose | Why / Notes |
|------------|-------------|----------------|---------|-------------|
| Next.js | 14 | **15.x** (pin `15.3.x`) | Dashboard UI, App Router | Next.js 16 is latest but has breaking changes (middleware renamed to proxy, fully async request APIs). Next.js 15 is stable, well-documented, and the App Router is mature. Choosing 15 over 14 because `create-next-app@latest` will install 16 -- so either pin 15 explicitly or accept 16's changes. Next.js 14 is now 2+ years old and missing performance improvements. **HIGH confidence** |
| TypeScript | -- | `~5.7` | Type safety | Whatever ships with Next.js. No action needed. **HIGH confidence** |
| Tailwind CSS | -- | `4.x` | Utility-first styling | Current version with Next.js. The dark mode config in the setup guide uses v3 syntax (`darkMode: "class"`) -- Tailwind v4 changed to CSS-based config. If `create-next-app` installs v4, the tailwind.config.ts approach needs updating. **MEDIUM confidence -- verify at install time** |
| React | -- | `19.x` | UI framework | Ships with Next.js 15+. React 19 has `use()` hook and async features. No conflict. **HIGH confidence** |
### Frontend -- Libraries
| Library | Spec Version | Correct Version | Purpose | Why / Notes |
|---------|-------------|----------------|---------|-------------|
| mapbox-gl | -- | `3.20.x` | Map rendering | v3 is current, stable. The `useRef` approach (raw mapboxgl.Map) is correct for hackathon -- avoids react-map-gl abstraction overhead and debugging complexity. Must install `@types/mapbox-gl` separately. **HIGH confidence** |
| Recharts | -- | `3.8.x` | Charts (backup for Hex) | v3 is a major rewrite from v2. API changed significantly. The setup guide just says `npm install recharts` which will get v3 -- this is fine but be aware chart component APIs differ from v2 tutorials. **MEDIUM confidence** |
| motion | `framer-motion` | `motion` (latest `12.x`) | Animations | **CRITICAL:** `framer-motion` npm package is deprecated/unmaintained. The library was rebranded to `motion` in 2025. Install `motion` and import from `motion/react` instead of `framer-motion`. The API is identical, only the import path changes. The setup guide installs the wrong package. Note: this is out of scope for milestone 1 per PROJECT.md, so low urgency. **HIGH confidence** |
| @supabase/supabase-js | -- | `2.100.x` | Database client | Current, stable, well-maintained. No issues. **HIGH confidence** |
| lucide-react | -- | latest | Icons | Stable, tree-shakeable. Good choice. **HIGH confidence** |
| clsx + tailwind-merge | -- | latest | Class utilities | Standard pairing. Good choice. **HIGH confidence** |
### Backend -- Core
| Technology | Spec Version | Correct Version | Purpose | Why / Notes |
|------------|-------------|----------------|---------|-------------|
| FastAPI | `0.115.0` | **`0.135.x`** | API server | Setup guide pins 0.115.0 which is 6+ months old. Current is 0.135.2. Notable change: strict Content-Type checking by default in recent versions (can be disabled with `strict_content_type=False`). Pin `>=0.135.0,<1.0`. **HIGH confidence** |
| uvicorn | `0.30.0` | **`0.42.x`** | ASGI server | Setup guide pins 0.30.0 which is very old. Current is 0.42.0. Pin `>=0.42.0`. **HIGH confidence** |
| Python | 3.11+ | **3.11+** (spec is correct) | Runtime | 3.11 is minimum. 3.12 or 3.13 preferred if available. FastAPI now requires 3.10+. **HIGH confidence** |
| Pydantic | `2.9.0` | **`2.11.x`** | Data validation | Latest 2.x. Pin `>=2.9.0` -- no breaking changes within 2.x. **HIGH confidence** |
### Backend -- AI/Agent Stack
| Technology | Spec Version | Correct Version | Purpose | Why / Notes |
|------------|-------------|----------------|---------|-------------|
| langgraph | `0.2.0` | **`1.1.0`** | Agent orchestration | **CRITICAL VERSION MISMATCH.** The setup guide pins 0.2.0 but current is 1.1.0. LangGraph hit 1.0 in late 2025 with breaking API changes. Key changes: (1) `interrupt_before` parameter is superseded by `interrupt()` function + `Command` for HITL flows, (2) Interrupt class simplified from 4 fields to 2, (3) Send() API for fan-out may have context propagation issues on LangGraph server (works locally). The architecture spec's HITL pattern using `interrupt_before` + `update_state` is the OLD API. Must use new `interrupt()` + `Command` pattern. Pin `>=1.0.0,<2.0`. **HIGH confidence -- this is a must-fix** |
| langchain-anthropic | `0.2.0` | **`1.3.x`** | Claude integration | **CRITICAL VERSION MISMATCH.** Setup guide pins 0.2.0, current is 1.3.4. The 0.2 -> 1.x jump includes breaking changes in ChatAnthropic initialization. Pin `>=1.3.0`. **HIGH confidence** |
| langchain-community | `0.3.0` | **`0.4.x`** | Community integrations | Current is 0.4.1. Needed for Tavily integration. Pin `>=0.4.0`. **MEDIUM confidence** |
| langchain-core | `0.3.0` | **`0.4.x`** | Core abstractions | Must be compatible with langchain-anthropic 1.3.x and langgraph 1.1.x. Let pip resolve this as a transitive dependency -- do not pin independently unless needed. **MEDIUM confidence** |
| supabase (Python) | `2.9.0` | **`2.28.x`** | Database client (backend) | Setup guide pins 2.9.0, current is 2.28.3. Pin `>=2.9.0` minimum. **HIGH confidence** |
| tavily-python | `0.5.0` | latest | Web search | Used for DISCOVER agent (later milestone). Pin is fine. **MEDIUM confidence** |
### Backend -- Infrastructure
| Technology | Spec Version | Correct Version | Purpose | Why / Notes |
|------------|-------------|----------------|---------|-------------|
| sse-starlette | `2.1.0` | latest (March 2026 release) | SSE streaming | Current. No issues. **HIGH confidence** |
| httpx | `0.27.0` | latest `0.28.x` | HTTP client (Hex API, Lava) | Pin `>=0.27.0`. **HIGH confidence** |
| python-dotenv | `1.0.1` | `1.0.1` | Env loading | Current. No issues. **HIGH confidence** |
### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase (hosted Postgres) | Current (managed) | Primary database | Correct choice. Free tier is sufficient for hackathon. US East region minimizes latency to Philadelphia demo. Built-in connection pooling via Supavisor (port 6543). Schema is well-designed with appropriate indexes. **HIGH confidence** |
### External Services
| Service | Purpose | Risk Level | Notes |
|---------|---------|------------|-------|
| Lava Gateway | AI proxy + cost tracking | **MEDIUM risk** | Lava is a real, funded startup (raised $5.8M) with a working product. Gateway adds sub-5ms overhead. However, it is a relatively new service -- if it goes down during the hackathon, the escape hatch is to switch `base_url` back to `api.anthropic.com` and use the direct Anthropic key. Test the proxy works BEFORE the hackathon. **MEDIUM confidence** |
| Hex | Analytics engine + embedded dashboards | **HIGH risk** | Hex is the riskiest integration. Rate limits (20 runs/min, 60 status checks/hr) are tight. Cold kernel starts are slow. iframe embedding requires "Anyone with link" sharing. Cell outputs are not extractable via API (dual-path computation is correct mitigation). The Team plan free trial is required for API access -- verify trial is active before hackathon. **MEDIUM confidence** |
| Mapbox | Map tiles | **LOW risk** | Mature, reliable service. 50K free map loads is more than enough. **HIGH confidence** |
| Anthropic (Claude Sonnet 4) | LLM | **LOW risk** | Reliable API with good uptime. Ensure $10-20 in credits loaded. **HIGH confidence** |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|-------------------|
| Frontend framework | Next.js 15 | Next.js 16 | 16 has breaking changes (async request APIs fully enforced, middleware->proxy rename). Extra migration work not worth it for a hackathon. But if `create-next-app@latest` installs 16, just use it -- the changes are manageable. |
| Frontend framework | Next.js 15 | Next.js 14 | 14 is stale. 15 has better performance and the caching model is more predictable (uncached by default). |
| State management | React Context + useReducer | Zustand, Jotai | Context + useReducer is the right call for SSE-driven unidirectional state. Adding a state library for a hackathon is overhead with no benefit. The state shape is simple (crisis events, agent statuses, Hex run URLs). |
| Map library | Raw mapbox-gl + useRef | react-map-gl | Raw Mapbox is easier to debug in a hackathon. react-map-gl adds an abstraction layer that can hide errors. For 8 markers and some color coding, raw GL is sufficient. |
| Charts | Recharts (backup) | Victory, Nivo, Chart.js | Recharts is the simplest React chart library for bar/line charts. It is only a backup for when Hex iframes are not available. Minimal investment needed. |
| Animation | motion | No animation | Framer Motion (now motion) is out of scope for milestone 1. Skip install entirely until polish phase. |
| Backend framework | FastAPI | Django, Flask | FastAPI is correct for async SSE streaming + LangGraph async pipeline. Native async, Pydantic integration, auto-generated docs. |
| Agent framework | LangGraph | CrewAI, AutoGen | LangGraph gives fine-grained control over agent state, interrupts, and streaming. Critical for HITL and SSE. CrewAI/AutoGen are higher-level abstractions that would fight the custom pipeline design. |
| Database | Supabase Postgres | Raw Postgres, PlanetScale | Supabase provides free hosted Postgres + JS client + connection pooling out of the box. Zero ops for a hackathon. |
| SSE | sse-starlette | WebSocket | SSE is correct. Data flows one direction (server -> client). WebSocket is bidirectional overhead for no benefit. The POST endpoint starts the pipeline; SSE streams results back. |
## Critical Issues (Must Fix Before Implementation)
### Issue 1: LangGraph Version and API Migration (CRITICAL)
# OLD (architecture spec pattern -- WILL NOT WORK with langgraph 1.x)
# NEW (langgraph 1.x pattern)
### Issue 2: langchain-anthropic Version (CRITICAL)
### Issue 3: Tailwind CSS v4 Config Format (MODERATE)
## Corrected requirements.txt
# apps/api/requirements.txt -- CORRECTED VERSIONS
## Corrected Frontend Install
# Use Next.js 15 explicitly (latest will install 16)
# Core dependencies
# Only install motion when ready for polish phase (out of scope for milestone 1)
# npm install motion
## Missing Libraries (Not in Spec)
| Library | Purpose | When Needed | Install |
|---------|---------|-------------|---------|
| `@supabase/ssr` | Server-side Supabase client for Next.js App Router | If using server components to fetch data | `npm install @supabase/ssr` |
| `date-fns` or `dayjs` | Date formatting for demand history, expiration dates | When building inventory/demand UI | `npm install date-fns` |
| `zod` | Runtime schema validation for SSE events, API responses | When parsing SSE event stream | `npm install zod` (or rely on TypeScript types only for hackathon) |
| `eventsource-parser` | Robust SSE parsing in the browser | When building `useCrisisStream` hook | `npm install eventsource-parser` -- OR use native `EventSource` API which is simpler |
| `langgraph-checkpoint` | Checkpointer for LangGraph HITL | Required for interrupt/resume flow | Comes as transitive dep of langgraph, but verify `MemorySaver` import path |
## What NOT to Use
| Technology | Why Not |
|------------|---------|
| `framer-motion` npm package | Deprecated. Use `motion` package with `motion/react` imports instead. |
| `react-map-gl` | Extra abstraction over Mapbox GL JS that hides errors. Use raw mapbox-gl for hackathon. |
| Zustand / Redux / Jotai | Overkill for unidirectional SSE state. Context + useReducer is correct. |
| Prisma / Drizzle ORM | Backend is Python (FastAPI), not Node.js. Supabase Python client handles DB access. |
| `langchain` (the main package) | Only need `langchain-core`, `langchain-anthropic`, `langchain-community`. The umbrella `langchain` package pulls in unnecessary dependencies. |
| WebSocket libraries | SSE is sufficient for server-to-client streaming. WebSocket adds bidirectional complexity. |
| Next.js API routes for backend | Backend is a separate FastAPI server. Do not try to put Python agent logic into Next.js API routes. |
## Sources
- [Next.js releases](https://github.com/vercel/next.js/releases) -- Next.js 16.2.1 is latest; 15.x recommended for stability
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Breaking changes in v16
- [LangGraph PyPI](https://pypi.org/project/langgraph/) -- v1.1.0 current
- [LangChain + LangGraph 1.0 announcement](https://blog.langchain.com/langchain-langgraph-1dot0/) -- Breaking changes from 0.x
- [LangGraph interrupts documentation](https://docs.langchain.com/oss/python/langgraph/interrupts) -- New interrupt() API
- [langchain-anthropic PyPI](https://pypi.org/project/langchain-anthropic/) -- v1.3.4 current
- [FastAPI PyPI](https://pypi.org/project/fastapi/) -- v0.135.2 current
- [uvicorn PyPI](https://pypi.org/project/uvicorn/) -- v0.42.0 current
- [mapbox-gl npm](https://www.npmjs.com/package/mapbox-gl) -- v3.20.0 current
- [recharts npm](https://www.npmjs.com/package/recharts) -- v3.8.1 current
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) -- framer-motion -> motion migration
- [Lava Gateway](https://www.lava.so/products/gateway) -- AI gateway documentation
- [supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.100.1 current
- [supabase Python PyPI](https://pypi.org/project/supabase/) -- v2.28.3 current
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
