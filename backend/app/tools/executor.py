import asyncio
import json
from datetime import datetime, timezone
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
            # ── Read tools ────────────────────────────────────────────
            if name == "get_energy":
                async def _safe_get(url: str) -> dict | None:
                    try:
                        r = await client.get(url, headers=h)
                        return r.json() if r.status_code == 200 else None
                    except Exception:
                        return None

                circuit_data, canopy_data, chef_data = await asyncio.gather(
                    _safe_get(f"{settings.circuit_url}/api/energy/sync"),
                    _safe_get(f"{settings.canopy_url}/sync/energy"),
                    _safe_get(f"{settings.chef_url}/energy/timeline"),
                )

                result: dict = {}
                if circuit_data:
                    result["tasks"] = {
                        "energy_so_far": circuit_data.get("energy_so_far"),
                        "energy_ahead": circuit_data.get("energy_ahead"),
                        "manual_energy": circuit_data.get("manual_energy"),
                        "stress_level": circuit_data.get("stress_level"),
                        "tasks_done_today": circuit_data.get("events_so_far"),
                    }
                if canopy_data:
                    result["social"] = {
                        "energy_so_far": canopy_data.get("energy_so_far"),
                        "interactions_today": canopy_data.get("interactions_so_far"),
                    }
                if chef_data:
                    result["meals"] = {
                        "avg_energy": chef_data.get("avg_energy"),
                        "meals_today": len(chef_data.get("events", [])),
                    }

                energies = [v for v in [
                    circuit_data.get("manual_energy") if circuit_data else None,
                    circuit_data.get("energy_so_far") if circuit_data else None,
                    canopy_data.get("energy_so_far") if canopy_data else None,
                    chef_data.get("avg_energy") if chef_data else None,
                ] if v is not None]
                if energies:
                    result["estimated_energy"] = round(sum(energies) / len(energies), 3)

                return json.dumps(result)

            elif name == "get_my_tasks":
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

            elif name == "get_food_log":
                date_param = args.get("date", "today")
                r = await client.get(
                    f"{settings.chef_url}/history",
                    params={"date": date_param, "limit": 10},
                    headers=h,
                )
                r.raise_for_status()
                entries = r.json()
                trimmed = [
                    {
                        "decision": e.get("decision"),
                        "recipe_name": e.get("recipe_name"),
                        "cuisine": e.get("cuisine"),
                        "satisfaction": e.get("satisfaction"),
                        "timestamp": e.get("timestamp"),
                    }
                    for e in entries
                ]
                return json.dumps(trimmed)

            # ── Write tools ───────────────────────────────────────────
            elif name == "create_task":
                payload: dict = {"text": args["text"]}
                for field in ("tag", "effort", "urgency", "importance", "completed"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("occurred_at"):
                    try:
                        dt = datetime.fromisoformat(args["occurred_at"].replace("Z", "+00:00"))
                        epoch_ms = int(dt.astimezone(timezone.utc).timestamp() * 1000)
                        payload["scheduled_at"] = epoch_ms
                        payload["client_created_at"] = epoch_ms
                    except ValueError:
                        pass
                r = await client.post(f"{settings.circuit_url}/api/tasks", json=payload, headers=h)
                r.raise_for_status()
                task = r.json()
                return json.dumps({"id": task.get("id"), "text": task.get("text")})

            elif name == "log_interaction":
                # Resolve person names → canopy person IDs
                participant_ids = []
                for person_name in args.get("person_names", []):
                    r = await client.get(
                        f"{settings.canopy_url}/api/people",
                        params={"q": person_name},
                        headers=h,
                    )
                    if r.status_code == 200:
                        people = r.json()
                        if people:
                            participant_ids.append(people[0]["id"])
                        else:
                            cr = await client.post(
                                f"{settings.canopy_url}/api/people",
                                json={"name": person_name},
                                headers=h,
                            )
                            if cr.status_code in (200, 201):
                                participant_ids.append(cr.json()["id"])

                payload = {
                    "observation": args["observation"],
                    "participant_ids": participant_ids,
                    "tag_names": args.get("tag_names", []),
                }
                for field in ("context", "outcome", "occurred_at"):
                    if args.get(field):
                        payload[field] = args[field]

                r = await client.post(f"{settings.canopy_url}/api/interactions", json=payload, headers=h)
                r.raise_for_status()
                return json.dumps({"saved": True, "participants_resolved": len(participant_ids)})

            elif name == "log_meal":
                payload = {"decision": args["decision"]}
                for field in ("recipe_name", "cuisine", "timestamp"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("satisfaction") is not None:
                    payload["satisfaction"] = int(args["satisfaction"])
                r = await client.post(f"{settings.chef_url}/history", json=payload, headers=h)
                r.raise_for_status()
                return json.dumps({"saved": True})

            else:
                return json.dumps({"error": f"unknown tool: {name}"})

    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"{name} returned HTTP {e.response.status_code}"})
    except httpx.ConnectError:
        app_name = name.split("_")[1] if "_" in name else name
        return json.dumps({"error": f"could not connect to {app_name} — is it running?"})
    except Exception as e:
        return json.dumps({"error": str(e)})
