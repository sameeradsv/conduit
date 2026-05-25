import json
from typing import Optional

import httpx

from app.config import settings

_TIMEOUT = httpx.Timeout(15.0)


def _headers(token: Optional[str]) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _trim_tasks(tasks: list) -> list:
    keep = ("text", "completed", "tag", "effort", "urgency", "importance", "due_date", "tiny_step")
    return [{k: t.get(k) for k in keep} for t in tasks]


def _trim_people(people: list) -> list:
    keep = ("id", "name", "relationship", "notes")
    return [{k: p.get(k) for k in keep} for p in people]


def _trim_interactions(items: list) -> list:
    result = []
    for i in items:
        result.append({
            "occurred_at": i.get("occurred_at"),
            "context": i.get("context"),
            "observation": i.get("observation"),
            "outcome": i.get("outcome"),
            "participants": [p.get("name") for p in i.get("participants", [])],
            "tags": [t.get("name") for t in i.get("tags", [])],
        })
    return result


async def execute_tool(name: str, args: dict, token: Optional[str] = None) -> str:
    h = _headers(token)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            if name == "get_my_tasks":
                r = await client.get(f"{settings.circuit_url}/api/tasks", headers=h)
                r.raise_for_status()
                return json.dumps(_trim_tasks(r.json()))

            elif name == "get_task_summary":
                r = await client.get(f"{settings.circuit_url}/api/summary", headers=h)
                r.raise_for_status()
                return json.dumps(r.json())

            elif name == "get_people":
                params = {}
                if args.get("search"):
                    params["q"] = args["search"]
                r = await client.get(f"{settings.canopy_url}/api/people", params=params, headers=h)
                r.raise_for_status()
                return json.dumps(_trim_people(r.json()))

            elif name == "get_recent_interactions":
                params: dict = {"limit": args.get("limit", 20)}
                if args.get("person_id"):
                    params["person_id"] = args["person_id"]
                if args.get("tag"):
                    params["tag"] = args["tag"]
                r = await client.get(f"{settings.canopy_url}/api/interactions", params=params, headers=h)
                r.raise_for_status()
                return json.dumps(_trim_interactions(r.json()))

            elif name == "get_meal_recommendation":
                limit = min(max(args.get("limit", 3), 1), 5)
                r = await client.get(f"{settings.chef_url}/recipes/recommend", params={"limit": limit}, headers=h)
                r.raise_for_status()
                return json.dumps(r.json())

            elif name == "get_cook_vs_order":
                r = await client.post(f"{settings.chef_url}/decision/cook-vs-order", json={}, headers=h)
                r.raise_for_status()
                return json.dumps(r.json())

            else:
                return json.dumps({"error": f"unknown tool: {name}"})

    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"{name} returned HTTP {e.response.status_code}"})
    except httpx.ConnectError:
        app_name = name.split("_")[1] if "_" in name else name
        return json.dumps({"error": f"could not connect to {app_name} — is it running?"})
    except Exception as e:
        return json.dumps({"error": str(e)})
