# conduit

Terminal-style AI hub for the personal app ecosystem. Query and update your tasks (circuit), relationships (canopy), and kitchen decisions (chef) from a single keyboard-driven interface — or let it brief you on everything at once.

**Live:** [sameeradsv.github.io/conduit](https://sameeradsv.github.io/conduit) · API on Render (free tier — first request may take ~30s)  
**Demo account:** `demo` / `demo1234`

---

## Modes

| Mode | Trigger | What it does |
|------|---------|--------------|
| **Chat** | default | Direct Groq streaming — no tools |
| **Agent** | `/agent` or toggle | Reads live data from circuit, canopy, chef via tools |
| **Diary** | `/diary` or toggle | Full-screen compose (Kalam hand font); past-date entries in IST; routes to apps |
| **Digest** | `/digest` | One-shot daily briefing from all three apps |

### Agent mode — example questions

- "What are my tasks today?" · "What's most urgent right now?"
- "When did I last talk to Alice?" · "Who should I follow up with this week?"
- "Should I cook or order tonight?" · "What have I been eating this week?"

### Diary mode — example entries

Write a freeform daily note. The model parses it silently and routes each item:

- Tasks and todos → **circuit**
- Interactions with people → **canopy**
- Meals and food decisions → **chef**

A structured confirmation shows what was saved and to which app. No AI response prose.

Past-date diary entries use IST noon (`+05:30`) as the default timestamp when routing to sibling apps.

---

## Sibling app chat

Circuit, canopy, and chef each have a `/chat` route with a native Groq agent on their own backend — no Conduit dependency for in-app chat:

| App | Chat endpoint | Env var |
|-----|---------------|---------|
| circuit | `POST /api/agent/chat` | `GROQ_API_KEY` (+ optional `CIRCUIT_AGENT_MODEL`) |
| canopy | `POST /api/ai/agent/chat` | `GROQ_API_KEY` |
| chef | `POST /agent/chat` | `GROQ_API_KEY` (+ optional `CHEF_AGENT_MODEL`) |

Use **Conduit** when you want cross-app queries (`@circuit`, `@canopy`, `@chef`), diary routing, or a single hub for all three apps.

---

## Stack

```
frontend/   Next.js 15 · React 19 · TypeScript · Tailwind 3 · JetBrains Mono
                ↓ SSE streaming / Bearer JWT
backend/    FastAPI · Groq SDK
                ↓
            Tool executor → circuit / canopy / chef APIs
```

Auth: `@shared/cortex` — local users + optional Cortex server fallback · passkey/biometric via WebAuthn (`/passkey` command)  
PWA: installable on iOS/Android via GitHub Pages · safe-area insets for notch/Dynamic Island  
Themes: `phosphor` (dark, neon green) · `ghost` (dark, white text) — toggled from the top bar

---

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`.env` in `backend/`:

```bash
GROQ_API_KEY=...              # required — free at console.groq.com

# Sibling app backends (defaults shown)
CIRCUIT_URL=http://localhost:8001
CANOPY_URL=http://localhost:8002
CHEF_URL=http://localhost:8003

# WebAuthn (passkey login) — set these in production
WEBAUTHN_RP_ID=your-domain.com
WEBAUTHN_ORIGIN=https://your-domain.com
WEBAUTHN_RP_NAME=conduit
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

App: http://localhost:3000

---

## Slash commands

```
/agent             toggle agent mode (reads from circuit / canopy / chef)
/diary             toggle diary mode (full-screen compose, silent routing to apps)
/digest            fetch daily briefing from all apps
/wakeup            ping circuit, canopy, and chef to wake them from cold start
/passkey           enable biometric sign-in on this device
/model <id>        switch model
/system <text>     set system prompt
/chat              return to direct chat mode
/clear             clear message history
/models            list available models
/help              show all commands
/logout            sign out
```

---

## Available models (Groq)

| ID | Notes |
|----|-------|
| `llama-3.3-70b-versatile` | default — best quality, supports tool calls |
| `llama-3.1-8b-instant` | fast, supports tool calls |
| `mixtral-8x7b-32768` | long context |
| `gemma2-9b-it` | lightweight |

---

## Architecture

```
conduit backend (hub)
│   POST /api/agent/chat  — scope param selects tool subset
│
│   read tools × 7    write tools × 3
│   ─────────────────────────────────────
│   get_my_tasks           create_task
│   get_task_summary
│   get_people             log_interaction
│   get_recent_interactions
│   get_meal_recommendation  log_meal
│   get_cook_vs_order
│   get_food_log
│
├── circuit  :8001   tasks, summary
├── canopy   :8002   people, interactions
└── chef     :8003   recipes, decisions, history
```

The `scope` parameter (`circuit` / `canopy` / `chef`) restricts tool access when chatting **in Conduit** — e.g. `@chef what should I cook?` or scoped agent mode. Sibling apps' own `/chat` pages use native backend agents instead.

---

## Deploy (GitHub Pages + Render)

1. **Render backend:** New → Blueprint → connect repo → `render.yaml`. Set `GROQ_API_KEY`, `CIRCUIT_URL`, `CANOPY_URL`, `CHEF_URL` in the Render dashboard.
2. **GitHub variable:** `CONDUIT_API_URL` = Render backend URL (no trailing slash).
3. Push to `main` — GitHub Actions builds the static export and deploys to Pages.

---

## Project structure

```
conduit/
  backend/
    app/
      routers/    chat, agent, auth, history
      services/   agent_service, groq_service
      tools/      definitions.py (tool schemas + SCOPE_TOOLS), executor.py
      config.py   sibling URLs, CORS, auth settings
  frontend/
    src/
      app/        Next.js pages + globals.css
      components/ TerminalShell, DiaryCompose, CommandInput, MessageFeed, ...
      lib/        api.ts (SSE streaming), auth.ts
      contexts/   AuthContext, ThemeContext
      hooks/      usePasskey (WebAuthn passkey registration + login)
  render.yaml
```
