# Conduit — Developer Reference

## What this is

Conduit is a terminal-style AI chat PWA that acts as the orchestration hub for a personal app ecosystem. It has two UX modes:

- **Agent mode** — interactive Q&A; AI calls read tools and streams a response
- **Diary mode** — input-first capture; AI silently routes structured data to sibling apps, shows a confirmation summary only (no prose response)

Conduit also provides scoped chat **within the Conduit hub** (`@circuit`, `@canopy`, `@chef`).

**Sibling apps** expose **`/chat` only** — each runs its own native Groq agent on its backend (personal app chat). They do **not** ship terminal timeline views or Conduit-style diary routing. Cross-app diary capture → Conduit.

---

## Architecture

```
conduit (hub)
│   POST /api/agent/chat   — tool-calling agent + diary router
│   POST /api/chat         — direct Groq streaming (no tools)
│   GET  /api/models
│   GET  /api/wakeup       — SSE: pings all sibling health endpoints
│
├── circuit   tasks, summary           /health
├── canopy    people, interactions     /api/health
└── chef      recipes, decisions, log  /health
```

Auth flow: `conduit_auth_token` (JWT) → conduit validates → passed as Bearer to sibling apps → sibling apps validate via shared Cortex instance.

---

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind 3, TypeScript 5, `@ducanh2912/next-pwa`
- **Backend**: FastAPI, Groq SDK, uvicorn, SQLite via SQLAlchemy
- **Auth**: `@shared/cortex` (`github:sameeradsv/cortex`), `tokenKey="conduit_auth_token"`
- **Hosting**: GitHub Pages (frontend), Render free tier (backend)

---

## Local development

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Backend env vars (`.env` in `backend/`):
```
GROQ_API_KEY=...
CIRCUIT_URL=http://localhost:8001
CANOPY_URL=http://localhost:8002
CHEF_URL=http://localhost:8003
```

On Render, set `CIRCUIT_URL`, `CANOPY_URL`, `CHEF_URL` as environment variables — there are no localhost fallbacks in the config.

---

## Key files

| File | Role |
|------|------|
| `backend/app/config.py` | Pydantic settings — sibling URLs, GROQ key, auth, CORS |
| `backend/app/services/agent_service.py` | Core: diary system prompt, agent system prompt, tool routing, Groq call, failed_generation fallback |
| `backend/app/tools/definitions.py` | Tool schemas (READ_TOOLS, WRITE_TOOLS, SCOPE_TOOLS) |
| `backend/app/tools/executor.py` | Tool execution — calls sibling app endpoints |
| `backend/app/tz_utils.py` | IST datetime parsing — diary routing, Canopy/Chef/Circuit write conversions |
| `backend/app/routers/wakeup.py` | SSE health pinger with retry (10s interval, 90s timeout) |
| `frontend/src/lib/tz.ts` | IST display helpers for diary date navigation |
| `frontend/src/components/TerminalShell.tsx` | Main shell — mode routing, slash command handling, diary/agent/chat dispatch |
| `frontend/src/components/DiaryCompose.tsx` | Diary input: multi-line, date header, Ctrl+Enter to save |
| `frontend/src/components/CommandInput.tsx` | Agent/chat input: slash command menu, history navigation |
| `frontend/src/lib/api.ts` | All fetch calls to the backend, including `streamWakeup` SSE, `saveSession` / `listSessions` (Bearer auth) |

---

## Design decisions

- **Terminal-first UI**: JetBrains Mono everywhere, phosphor (green-on-black) theme, no rounded cards, no icons
- **Message role prefixes**: `~` AI, `>` user, `#` system, `!` error
- **Diary suppresses AI prose**: only a structured confirmation is shown — `✓ circuit create_task × 2`
- **Groq-only backend** for MVP; multi-provider (Claude, GPT-4o, Gemini, Ollama) is a future phase
- **Diary model fixed**: always `llama-3.3-70b-versatile` regardless of user's selected chat model — most reliable for tool calls
- **Conduit as orchestrator only**: sibling apps have no inter-app calls
- **Mode UI (2026-06)**: `AgentToggle` / `DiaryToggle` removed — mode switching via inline tabs in `TerminalShell` modebar
- **Session history**: chat/agent turns saved to `POST /api/history`; `@user` menu + `/sessions` / `/resume <id>` for list/resume/delete (diary not saved yet)

---

## Timezone contract

All user-facing datetimes in Conduit are **IST (Asia/Kolkata, UTC+05:30)**.

- **Diary past entries** — date picker sends `[Entry date: YYYY-MM-DD]`; the router sets `occurred_at` / `timestamp` to `YYYY-MM-DDT12:00:00+05:30`. Frontend date math uses `istNoonDate()` / `offsetDateIST()` in `frontend/src/lib/tz.ts`.
- **Write tools** — `backend/app/tz_utils.py` normalizes naive LLM datetimes as IST, then converts per sibling: Canopy → UTC `Z`, Chef → naive IST string, Circuit → epoch ms.
- **Read tools** — `get_recent_interactions` returns `occurred_at` formatted as `YYYY-MM-DD HH:MM IST` and a `timing` field (`past` | `upcoming`) when `occurred_at` is present; omitted when unavailable. Agent uses `timing` — does not infer from meeting/call wording.

---

## Energy sync endpoints (`get_energy` tool)

| App | Endpoint |
|-----|----------|
| circuit | `GET /api/energy/sync` |
| canopy | `GET /api/sync/energy` |
| chef | `GET /sync/energy` |

Chef has no `/api` prefix on sync routes. Response fields differ per app — executor maps Chef `drain_so_far` → `energy_so_far` as `1 − drain`.

---

## Slash commands

`/help`, `/chat`, `/agent`, `/diary`, `/model <id>`, `/system <text>`, `/clear`, `/logout`, `/models`, `/digest`, `/wakeup`, `/sessions`, `/resume <id>`

---

## Supported Groq models

- `llama-3.3-70b-versatile` (default, used for diary)
- `llama-3.1-8b-instant`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

---

## Sibling health endpoints

The `/wakeup` command pings these (important: paths differ per app):

- circuit → `GET /health`
- canopy → `GET /api/health`
- chef → `GET /health`

The wakeup router retries every 10s for up to 90s to handle Render cold-start 502/503s.

---

## Current known issues

**Sibling app auth in production** — conduit passes `conduit_auth_token` as Bearer to sibling apps. This works when all apps share the same Cortex instance. If they don't, sibling apps will reject the token. No fix designed yet.

**Diary session save** — diary mode does not call `saveSession` after routing (chat/agent do). Optional follow-up.

---

## Implemented tools

### Read tools (agent mode)
| Tool | Endpoint |
|------|----------|
| `get_my_tasks` | circuit `GET /api/tasks` |
| `get_task_summary` | circuit `GET /api/summary` |
| `get_people` | canopy `GET /api/people` |
| `get_recent_interactions` | canopy `GET /api/interactions` — IST times; optional `timing` (`past`/`upcoming`) |
| `get_energy` | circuit `/api/energy/sync` + canopy `/api/sync/energy` + chef `/sync/energy` |
| `get_meal_recommendation` | chef `GET /recipes/recommend` |
| `get_cook_vs_order` | chef `GET /decision/cook-vs-order` |
| `get_food_log` | chef `GET /history` |

### Write tools (diary mode)
| Tool | Endpoint |
|------|----------|
| `create_task` | circuit `POST /api/tasks` |
| `update_task` | circuit `PATCH /api/tasks/{id}` |
| `log_interaction` | canopy `POST /api/interactions` |
| `create_person` | canopy `POST /api/people` |
| `log_meal` | chef `POST /history` |
| `update_meal_entry` | chef `PATCH /history/{id}` |

Diary entries are saved to session history after routing (same as agent/chat).

---

## Future work

- Multi-provider models (Claude, GPT-4o, Gemini, Ollama)
- Production Cortex sibling-auth unification when apps don't share one Cortex instance
