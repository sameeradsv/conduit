# Deferred & future work

**Last updated:** 2026-06-17  
**Canonical copy:** kept in sync with [Circuit `docs/DEFERRED.md`](https://github.com/sameeradsv/circuit/blob/main/docs/DEFERRED.md) (ecosystem master).

Conduit-specific summary below.

---

## Conduit — deferred

| Item | Notes |
|------|--------|
| **Production Cortex sibling-auth** | `conduit_auth_token` must work on all sibling Render backends |
| **`get_interactions_for_person` tool** | Optional read-tool with name → person_id resolution |

## Rejected (not deferred)

| Item | Decision |
|------|----------|
| **Multi-provider LLM** | Groq-only (`GROQ_API_KEY`) |
| **Terminal UI in sibling apps** | Conduit-only; siblings use `/chat` |

## Shipped (2026-06)

Phase D write tools, diary session save, session history UI, IST routing (Phase E).
