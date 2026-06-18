import asyncio
import json
from typing import Optional

import httpx

from app.config import settings
from app.tz_utils import (
    format_ist_display,
    now_utc_naive,
    parse_canopy_stored,
    to_canopy_occurred_at,
    to_chef_timestamp,
    to_circuit_epoch_ms,
)

_TIMEOUT = httpx.Timeout(15.0)


def _headers(token: Optional[str]) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _items(data) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("items", "data", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        return []
    return []


def _trim_tasks(tasks: list) -> list:
    keep = ("text", "completed", "tag", "effort", "urgency", "importance", "due_date", "tiny_step")
    return [{k: t.get(k) for k in keep} for t in tasks if isinstance(t, dict)]


def _trim_people(people: list) -> list:
    keep = ("id", "name", "relationship", "notes")
    return [{k: p.get(k) for k in keep} for p in people if isinstance(p, dict)]


def _trim_interactions(items: list) -> list:
    now = now_utc_naive()
    result = []
    for i in items:
        if not isinstance(i, dict):
            continue
        raw_at = i.get("occurred_at")
        at_utc = parse_canopy_stored(raw_at) if raw_at else None
        entry: dict = {
            "occurred_at": format_ist_display(raw_at) if raw_at else None,
            "context": i.get("context"),
            "observation": i.get("observation"),
            "outcome": i.get("outcome"),
            "participants": [p.get("name") for p in (i.get("participants") or [])],
            "tags": [t.get("name") for t in (i.get("tags") or [])],
        }
        if at_utc is not None:
            entry["timing"] = "past" if at_utc <= now else "upcoming"
        result.append(entry)
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
                    _safe_get(f"{settings.canopy_url}/api/sync/energy"),
                    _safe_get(f"{settings.chef_url}/sync/energy"),
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
                    drain = chef_data.get("drain_so_far")
                    meals = chef_data.get("meals_today") or []
                    result["meals"] = {
                        "energy_so_far": round(max(0.0, 1.0 - drain), 3) if isinstance(drain, (int, float)) else None,
                        "meals_today": len(meals),
                        "skipped_meals": len(chef_data.get("skipped_meals") or []),
                    }

                chef_energy = None
                if chef_data and isinstance(chef_data.get("drain_so_far"), (int, float)):
                    chef_energy = max(0.0, 1.0 - chef_data["drain_so_far"])

                energies = [v for v in [
                    circuit_data.get("manual_energy") if circuit_data else None,
                    circuit_data.get("energy_so_far") if circuit_data else None,
                    canopy_data.get("energy_so_far") if canopy_data else None,
                    chef_energy,
                ] if v is not None]
                if energies:
                    result["estimated_energy"] = round(sum(energies) / len(energies), 3)

                return json.dumps(result)

            elif name == "get_my_tasks":
                r = await client.get(f"{settings.circuit_url}/api/tasks", headers=h)
                r.raise_for_status()
                return json.dumps(_trim_tasks(_items(r.json())))

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
                return json.dumps(_trim_people(_items(r.json())))

            elif name == "get_recent_interactions":
                params: dict = {"limit": args.get("limit", 20)}
                if args.get("person_id"):
                    params["person_id"] = args["person_id"]
                if args.get("tag"):
                    params["tag"] = args["tag"]
                r = await client.get(f"{settings.canopy_url}/api/interactions", params=params, headers=h)
                r.raise_for_status()
                return json.dumps(_trim_interactions(_items(r.json())))

            elif name == "get_interactions_for_person":
                person_name = (args.get("person_name") or "").strip()
                if not person_name:
                    return json.dumps({"error": "person_name is required"})
                r = await client.get(
                    f"{settings.canopy_url}/api/people",
                    params={"q": person_name},
                    headers=h,
                )
                r.raise_for_status()
                people = _items(r.json())
                trimmed = _trim_people(people)
                if not trimmed:
                    return json.dumps({"error": "No person found", "query": person_name})
                exact = [p for p in trimmed if p.get("name", "").lower() == person_name.lower()]
                pool = exact if len(exact) == 1 else trimmed
                if len(pool) > 1 and len(exact) != 1:
                    return json.dumps({
                        "ambiguous": True,
                        "query": person_name,
                        "candidates": pool[:5],
                    })
                person = pool[0]
                params = {"limit": args.get("limit", 20), "person_id": person["id"]}
                if args.get("tag"):
                    params["tag"] = args["tag"]
                r2 = await client.get(f"{settings.canopy_url}/api/interactions", params=params, headers=h)
                r2.raise_for_status()
                return json.dumps({
                    "person": person,
                    "interactions": _trim_interactions(_items(r2.json())),
                })

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
                entries = _items(r.json())
                trimmed = [
                    {
                        "decision": e.get("decision"),
                        "recipe_name": e.get("recipe_name"),
                        "cuisine": e.get("cuisine"),
                        "satisfaction": e.get("satisfaction"),
                        "timestamp": e.get("timestamp"),
                    }
                    for e in entries
                    if isinstance(e, dict)
                ]
                # Chef timestamps are naive IST on the wire
                for row in trimmed:
                    if row.get("timestamp"):
                        row["timestamp"] = f"{row['timestamp']} IST"
                return json.dumps(trimmed)

            # ── Write tools ───────────────────────────────────────────
            elif name == "create_task":
                payload: dict = {"text": args["text"]}
                for field in ("tag", "effort", "urgency", "importance", "completed"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("occurred_at"):
                    try:
                        epoch_ms = to_circuit_epoch_ms(args["occurred_at"])
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
                for person_name in (args.get("person_names") or []):
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
                    "tag_names": args.get("tag_names") or [],
                }
                for field in ("context", "outcome"):
                    if args.get(field):
                        payload[field] = args[field]
                if args.get("occurred_at"):
                    try:
                        payload["occurred_at"] = to_canopy_occurred_at(args["occurred_at"])
                    except ValueError:
                        pass

                r = await client.post(f"{settings.canopy_url}/api/interactions", json=payload, headers=h)
                r.raise_for_status()
                return json.dumps({
                    "saved": True,
                    "observation": args.get("observation"),
                    "person_names": args.get("person_names", []),
                    "participants_resolved": len(participant_ids),
                })

            elif name == "log_meal":
                payload = {"decision": args["decision"]}
                for field in ("recipe_name", "cuisine"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("timestamp") is not None:
                    try:
                        payload["timestamp"] = to_chef_timestamp(args["timestamp"])
                    except ValueError:
                        pass
                if args.get("satisfaction") is not None:
                    payload["satisfaction"] = int(args["satisfaction"])
                r = await client.post(f"{settings.chef_url}/history", json=payload, headers=h)
                r.raise_for_status()
                return json.dumps({
                    "saved": True,
                    "decision": args.get("decision"),
                    "recipe_name": args.get("recipe_name"),
                    "cuisine": args.get("cuisine"),
                })

            elif name == "update_task":
                task_id = args["task_id"]
                payload: dict = {}
                for field in ("text", "completed", "tag", "effort", "urgency", "importance"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("scheduled_at"):
                    try:
                        payload["scheduled_at"] = to_circuit_epoch_ms(args["scheduled_at"])
                    except ValueError:
                        pass
                r = await client.patch(
                    f"{settings.circuit_url}/api/tasks/{task_id}",
                    json=payload,
                    headers=h,
                )
                r.raise_for_status()
                task = r.json()
                return json.dumps({"id": task.get("id"), "text": task.get("text"), "completed": task.get("completed")})

            elif name == "create_person":
                payload = {"name": args["name"]}
                for field in ("relationship", "notes"):
                    if args.get(field):
                        payload[field] = args[field]
                r = await client.post(f"{settings.canopy_url}/api/people", json=payload, headers=h)
                r.raise_for_status()
                person = r.json()
                return json.dumps({"id": person.get("id"), "name": person.get("name")})

            elif name == "update_meal_entry":
                entry_id = args["entry_id"]
                payload: dict = {}
                for field in ("decision", "recipe_name", "cuisine"):
                    if args.get(field) is not None:
                        payload[field] = args[field]
                if args.get("timestamp") is not None:
                    try:
                        payload["timestamp"] = to_chef_timestamp(args["timestamp"])
                    except ValueError:
                        pass
                if args.get("satisfaction") is not None:
                    payload["satisfaction"] = int(args["satisfaction"])
                r = await client.patch(
                    f"{settings.chef_url}/history/{entry_id}",
                    json=payload,
                    headers=h,
                )
                r.raise_for_status()
                entry = r.json()
                return json.dumps({
                    "id": entry.get("id"),
                    "decision": entry.get("decision"),
                    "recipe_name": entry.get("recipe_name"),
                })

            else:
                return json.dumps({"error": f"unknown tool: {name}"})

    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json()
        except Exception:
            detail = e.response.text[:200]
        return json.dumps({"error": f"{name} HTTP {e.response.status_code}: {detail}"})
    except httpx.ConnectError:
        app_name = name.split("_")[1] if "_" in name else name
        return json.dumps({"error": f"could not connect to {app_name} — is it running?"})
    except Exception as e:
        return json.dumps({"error": str(e)})
