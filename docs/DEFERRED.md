# Deferred & future work

**Last updated:** 2026-06-17  
**Canonical copy:** [Circuit `docs/DEFERRED.md`](https://github.com/sameeradsv/circuit/blob/main/docs/DEFERRED.md)

## BLOCKED

| Item | Notes |
|------|--------|
| Production sibling-auth when Cortex instances diverge | Token exchange not designed |

## Shipped (2026-06-17)

- `get_interactions_for_person` read tool
- `/wakeup` auth probe — passes Bearer to each sibling `/auth/me`; reports `auth_ok` in SSE

## Rejected

- Multi-provider LLM (Groq-only policy)


## Default-branch push policy (2026-07-13)

**Decision:** Completed work must be committed and pushed to the remote default branch. For this repo, the remote default branch is `main`.

**Reason:** Agent-created branches are easy to strand when work is complete but not merged, which makes the deployed/default line drift from the actual finished state.

**Implication:** If work is pushed to any branch other than `main` before it is merged, move/cherry-pick or merge it onto `main`, push `main`, and verify the default branch contains the change before closing the task.
