# conduit

Terminal-style AI hub for the personal app ecosystem. Query and update your tasks (circuit), relationships (canopy), and kitchen decisions (chef) from a single keyboard-driven interface, or let it brief you on everything at once.

**Live:** [sameeradsv.github.io/conduit](https://sameeradsv.github.io/conduit) - API on Vercel
**Demo account:** `demo` / `demo1234`

---

## Modes

| Mode | Trigger | What it does |
|------|---------|--------------|
| **Chat** | default | Direct Groq streaming, no tools |
| **Agent** | `/agent` or toggle | Reads live data from circuit, canopy, chef via tools |
| **Diary** | `/diary` or toggle | Full-screen compose; past-date entries in IST; routes to apps |
| **Digest** | `/digest` | One-shot daily briefing from all three apps |

Completed chat, agent, diary, digest, and scoped `@circuit` / `@canopy` / `@chef` turns are saved to session history when signed in.

### Agent mode example questions

- "What are my tasks today?" / "What's most urgent right now?"
- "When did I last talk to Alice?" / "Who should I follow up with this week?"
- "Should I cook or order tonight?" / "What have I been eating this week?"

### Diary mode example entries

Write a freeform daily note. The model parses it silently and routes each item:

- Tasks and todos -> **circuit**
- Interactions with people -> **canopy**
- Meals and food decisions -> **chef**

A structured confirmation shows what was saved and to which app. No AI response prose.

Past-date diary entries use IST noon (`+05:30`) as the default timestamp when routing to sibling apps.

---

## Sibling app chat

Circuit, canopy, and chef each have a `/chat` route with a native Groq agent on their own backend, with no Conduit dependency for in-app chat:

| App | Chat endpoint | Env var |
|-----|---------------|---------|
| circuit | `POST /api/agent/chat` | `GROQ_API_KEY` (+ optional `CIRCUIT_AGENT_MODEL`) |
| canopy | `POST /api/ai/agent/chat` | `GROQ_API_KEY` |
| chef | `POST /agent/chat` | `GROQ_API_KEY` (+ optional `CHEF_AGENT_MODEL`) |

Use **Conduit** when you want cross-app queries (`@circuit`, `@canopy`, `@chef`), diary routing, or a single hub for all three apps.

---

## Stack

```text
frontend/   Next.js 15, React 19, TypeScript, Tailwind 3, JetBrains Mono
                SSE streaming / Bearer JWT
backend/    FastAPI, Groq SDK
                Tool executor -> circuit / canopy / chef APIs
```

Auth: `@shared/cortex` - local users + optional Cortex server fallback; passkey/biometric via WebAuthn (`/passkey` command)
PWA: installable on iOS/Android via GitHub Pages; safe-area insets for notch/Dynamic Island
Themes: `phosphor` (dark, neon green) and `ghost` (dark, white text), toggled from the top bar

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
GROQ_API_KEY=...              # required; free at console.groq.com

# Sibling app backends
CIRCUIT_URL=http://localhost:8001
CANOPY_URL=http://localhost:8002
CHEF_URL=http://localhost:8003

# Local frontend origins only; set production origins in Vercel
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# WebAuthn (passkey login) - set these in production
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

```text
/agent             toggle agent mode (reads from circuit / canopy / chef)
/diary             toggle diary mode (full-screen compose, silent routing to apps)
/digest            fetch daily briefing from all apps
/wakeup            ping circuit, canopy, and chef to wake serverless/cold services
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

Model list is fetched from Groq's API on `/api/models` and cached briefly by the backend.
Non-chat models (Whisper, TTS, guard) are filtered out automatically.
Falls back to `llama-3.3-70b-versatile` + `llama-3.1-8b-instant` if Groq is unreachable.

---

## Architecture

```text
conduit backend (hub)
  POST /api/agent/chat  - scope param selects tool subset

  read tools x 8         write tools x 6
  get_my_tasks            create_task
  get_task_summary        update_task
  get_people              log_interaction
  get_recent_interactions create_person
  get_interactions_for_person
  get_meal_recommendation log_meal
  get_cook_vs_order       update_meal_entry
  get_food_log

  circuit  :8001   tasks, summary
  canopy   :8002   people, interactions
  chef     :8003   recipes, decisions, history
```

The `scope` parameter (`circuit` / `canopy` / `chef`) restricts tool access when chatting **in Conduit**, for example `@chef what should I cook?` or scoped agent mode. Sibling apps' own `/chat` pages use native backend agents instead.

---

## Deploy (GitHub Pages + Vercel)

1. **Vercel backend:** create a Vercel project with **Framework Preset: Other** and **Root Directory: `backend`**. Leave build/output blank; install command is `pip install -r requirements.txt`.
2. **Vercel env vars:** set `DATABASE_URL`, `GROQ_API_KEY`, `CIRCUIT_URL`, `CANOPY_URL`, `CHEF_URL`, `CORS_ORIGINS=https://sameeradsv.github.io`, `CORTEX_AUTH_URL`, `AUTH_REQUIRED`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN`. After the database is initialized, set `INIT_DB_ON_STARTUP=false`.
3. **Initialize or migrate DB once:** for a new DB, or before deploys that need schema changes, run `cd backend` then `DATABASE_URL="postgresql://..." python -m app.database`.
4. **GitHub variable:** `CONDUIT_API_URL` = Vercel backend URL, for example `https://conduit-api.vercel.app` with no trailing slash.
5. Push to `main` - Vercel deploys the backend from Git, and GitHub Actions builds the static frontend for Pages.

---

## Docs

- [Deferred & future work](docs/DEFERRED.md) - ecosystem backlog (master in Circuit repo)
- [PLAN.md](PLAN.md) / [CLAUDE.md](CLAUDE.md) - developer reference

---

## Project structure

```text
conduit/
  backend/
    api/
      index.py
    app/
      routers/    chat, agent, auth, history
      services/   agent_service, groq_service
      tools/      definitions.py (tool schemas + SCOPE_TOOLS), executor.py
      config.py   sibling URLs, CORS, auth settings
    vercel.json
  frontend/
    src/
      app/        Next.js pages + globals.css
      components/ TerminalShell, DiaryCompose, CommandInput, MessageFeed, ...
      lib/        api.ts (SSE streaming), auth.ts
      contexts/   AuthContext, ThemeContext
      hooks/      usePasskey (WebAuthn passkey registration + login)
```
