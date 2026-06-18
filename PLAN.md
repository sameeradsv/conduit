# Conduit — Implementation Plan

Last updated: 2026-06-18

## Vision

Conduit is the hub for the personal app ecosystem (circuit / canopy / chef). It serves two roles:

1. **Terminal UI** — interactive, question-driven chat: "What are my tasks today?", "Who should I assign this to?", "What should I cook?"
2. **Diary UI** — input-driven capture: "Here's what I did today..." → parsed and silently routed to individual apps.

The same terminal-like shell is also available inside each sibling app at `/chat` — each runs a native Groq agent on its own backend. Use Conduit when you need cross-app orchestration or diary routing.

---

## Status

### ✅ Implemented

#### Conduit backend
- `POST /api/chat` — direct Groq streaming
- `POST /api/agent/chat` — tool-calling agent mode (with optional `diary: true` flag)
- `GET /api/models`
- Full auth layer (local users + Cortex fallback)
- Chat history **save**, **list**, **resume**, **delete** on backend + frontend (`@user` menu, `/sessions`, `/resume <id>`)

#### Agent mode — read tools (all wired, all tested)
| Tool | Source | What it fetches |
|------|--------|-----------------|
| `get_my_tasks` | circuit `/api/tasks` | pending/completed tasks with priority, effort, tag |
| `get_task_summary` | circuit `/api/summary` | totals, completion rate, breakdown by tag |
| `get_people` | canopy `/api/people` | people list with optional name search |
| `get_recent_interactions` | canopy `/api/interactions` | recent interactions in IST; `timing` past/upcoming when `occurred_at` set |
| `get_energy` | circuit + canopy + chef sync endpoints | cross-app energy snapshot |
| `get_meal_recommendation` | chef `/recipes/recommend` | recipe recommendations |
| `get_cook_vs_order` | chef `/decision/cook-vs-order` | cook-vs-order decision with reasoning |
| `get_food_log` | chef `/history` | today's meal log |

#### Diary mode — write tools (all wired)
| Tool | Destination | What it writes |
|------|-------------|----------------|
| `create_task` | circuit `POST /api/tasks` | new task with tag, effort, urgency, importance |
| `log_interaction` | canopy `POST /api/interactions` | interaction with participant name resolution |
| `log_meal` | chef `POST /history` | meal decision with cuisine, satisfaction |

#### Frontend
- Three chat modes: `chat` / `agent` / `diary` (persisted to localStorage; **inline mode tabs** in `TerminalShell` topbar)
- Slash commands: `/help`, `/chat`, `/agent`, `/diary`, `/model`, `/system`, `/clear`, `/logout`, `/models`, `/sessions`, `/resume`
- `/digest` command: fetches daily briefing from all three apps
- `/digest`, scoped `@circuit` / `@canopy` / `@chef`, chat, agent, and diary turns are saved to session history after successful completion
- Diary mode: suppresses AI response, shows confirmation summary (`✓ circuit create_task × 2`)
- PWA installable, deployed on GitHub Pages + Render
- WebAuthn passkey / biometric sign-in (`usePasskey` hook, `PasskeyBanner` post-login prompt)

---

### ✅ Implemented (Phase A — bug fixes, 2026-05-26)

- **`/digest` routing bug fixed** — digest block now runs before the slash guard in `TerminalShell.tsx`
- **CORS configured by environment** — local dev uses `.env`; production defaults only allow the GitHub Pages origin
- **`scope` param added** to `/api/agent/chat` — restricts tools to circuit / canopy / chef subsets; drives scoped system prompts

### ✅ Implemented (Phase B — diary UI, 2026-05-26)

- **`DiaryCompose` component** — dedicated multi-line compose area replacing the single-line `CommandInput` when diary mode is active
- Large textarea (min 120px), date header, Ctrl+Enter to save, Esc to clear, `[save]` button
- `TerminalShell` now renders `DiaryCompose` vs `CommandInput` based on `chatMode`

### ✅ Implemented (Phase C — terminal UI in sibling apps, 2026-05-26)

- **`TerminalChat` component** added to circuit, canopy, chef
  - Full-screen chat UI accessible from each app's nav (`/chat`)
  - **Updated (2026):** each app now calls its **own native Groq agent** — not Conduit
    - circuit → `POST /api/agent/chat`
    - canopy → `POST /api/ai/agent/chat`
    - chef → `POST /agent/chat`
  - Requires `GROQ_API_KEY` on each sibling backend; frontend uses `NEXT_PUBLIC_API_URL`
- **`SCOPE_TOOLS` mapping** in conduit definitions.py — scoped tool subsets per app (used by Conduit hub only)
- **Per-scope system prompts** in conduit agent_service.py (Conduit hub `@circuit` / `@canopy` / `@chef`)

### ✅ Implemented (Phase E — IST + Canopy timing, 2026-06-17)

- **`backend/app/tz_utils.py`** — IST parsing; diary datetimes normalized to `+05:30`; per-sibling write conversions
- **Diary compose** — date navigation and labels use IST noon anchor (`istNoonDate`, `offsetDateIST`)
- **`get_recent_interactions`** — returns IST display times and `timing: past | upcoming` when `occurred_at` is available
- **Agent prompts** — use `timing` field from tools; do not infer past/upcoming from observation text alone
- **`get_energy` URL fix** — canopy `/api/sync/energy`, chef `/sync/energy`; Chef response field mapping corrected

### ✅ Implemented (Phase F — digest/session hardening, 2026-06-18)

- **Sibling read response normalization** — read tools tolerate `null`, bare lists, and common `{items|data|results}` envelopes from sibling APIs
- **Malformed row guards** — task, people, interaction, and food-log trimmers skip non-object rows instead of surfacing `NoneType`/attribute errors
- **`/digest` error hardening** — digest now degrades to empty tool data when a sibling returns nullable list payloads
- **Frontend model label bug fixed** — `TerminalShell` now uses the live `models` state instead of an undefined `MODELS` symbol
- **Session history completed** — `/digest` and scoped `@app` chats now save successful responses, matching chat/agent/diary behavior
- **Production CORS tightened** — Pydantic defaults and `render.yaml` no longer include localhost origins; local values belong in `.env`

---

### 🐛 Remaining known issues

#### 1. Sibling app auth in production
Conduit passes `conduit_auth_token` as the `sibling_token` to circuit/canopy/chef. In development this may work if the apps share the same Cortex instance. In production (Render), each app needs to accept the same token, which requires:
- A shared Cortex-based token validation in circuit/canopy/chef, OR
- Conduit to pass credentials and receive per-app tokens (not yet designed)

#### 2. Sibling URLs are hardcoded to localhost
**Resolved for production:** set `CIRCUIT_URL`, `CANOPY_URL`, `CHEF_URL` on Render. Local dev uses `.env` (see `backend/.env.example`).

#### 3. Session history coverage
**Resolved (2026-06-18):** Diary, digest, scoped app chats, chat, and agent responses save to `/sessions` history after successful completion.

### ⬜ Future work

Production Cortex sibling-auth when apps don't share one Cortex instance. See **[docs/DEFERRED.md](docs/DEFERRED.md)**.

**AI policy:** Groq-only. Multi-provider not planned.

#### Phase D — Additional write tools (shipped 2026-06)
- [x] `update_task` — circuit `PATCH /api/tasks/{id}`
- [x] `create_person` — canopy `POST /api/people`
- [x] `update_meal_entry` — chef `PATCH /history/{id}`

---

## Architecture Reference

```
conduit (hub)
│   POST /api/agent/chat
│   tools: [read × 7, write × 3]
│
├── circuit  :8001  tasks, summary, search
├── canopy   :8002  people, interactions
└── chef     :8003  recipes, decisions, history
```

Auth flow:  
`conduit_auth_token` (JWT) → Conduit validates → passes as Bearer to sibling apps → sibling apps validate via same Cortex instance.

---

## Decision Log

- **Groq-only backend**: `GROQ_API_KEY` is required for all AI (agent, diary, chat). No Anthropic/OpenAI fallbacks.
- **Diary mode suppresses AI response**: confirmed design — only a structured confirmation is shown, not a full model reply
- **Terminal UI is Conduit-only** — sibling apps keep `/chat` (native per-app Groq agent); no terminal views or diary routing in Circuit/Canopy/Chef
- **Conduit as orchestrator only**: circuit/canopy/chef have no inter-app calls; all coordination goes through conduit
- **Terminal-first UI**: no rounded cards, no icons, JetBrains Mono everywhere, phosphor theme only
- **AgentToggle / DiaryToggle components**: removed — mode switching is inline tabs in `TerminalShell` modebar (do not restore duplicate toggles)

---
