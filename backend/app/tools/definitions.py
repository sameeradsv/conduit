READ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_energy",
            "description": (
                "Fetch the user's current energy / battery level by aggregating data from "
                "all three apps: Circuit (task load and stress), Canopy (social drain), "
                "and Chef (meal energy). Use for questions like 'what is my energy right now', "
                "'how am I doing', 'am I drained', 'what's my battery level'."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_tasks",
            "description": (
                "Fetch the user's tasks from Circuit (task management app). "
                "Returns pending and completed tasks with priority, effort, tag, and due date."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_summary",
            "description": (
                "Fetch a statistical summary of the user's tasks from Circuit: "
                "total count, completed, pending, completion rate, and breakdown by tag."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_people",
            "description": (
                "Fetch people from Canopy (relationship tracking app). "
                "Optionally filter by name. Returns name, relationship type, and notes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": "Optional name search query",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_interactions",
            "description": (
                "Fetch recent interaction logs from Canopy. Times are in IST. Each entry may "
                "include timing ('past' or 'upcoming') when occurred_at is available — use that "
                "field rather than guessing from the observation text. "
                "Can filter by person_id or tag."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "person_id": {
                        "type": "integer",
                        "description": "Filter to a specific person by their ID",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Filter by interaction tag",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of results to return (default 20)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_interactions_for_person",
            "description": (
                "Fetch recent Canopy interactions for a person by name. Resolves person_name "
                "to person_id automatically. Use when the user asks about a specific person "
                "(e.g. 'when did I last talk to Alice'). Returns ambiguity if multiple people match."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "person_name": {
                        "type": "string",
                        "description": "Person name or partial name to search",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of interactions (default 20)",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Optional tag filter",
                    },
                },
                "required": ["person_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_meal_recommendation",
            "description": (
                "Fetch meal/recipe recommendations from Chef based on the user's pantry, "
                "energy level, time available, and dietary preferences."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of recommendations (1–5, default 3)",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cook_vs_order",
            "description": (
                "Ask Chef whether to cook at home or order food, given the user's "
                "current energy, time, budget, and pantry state. Returns a recommendation with reasoning."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_food_log",
            "description": (
                "Fetch the user's food/meal log from Chef for a given day. "
                "Returns what was cooked, ordered, or eaten with decision type, dish name, and cuisine."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date to fetch: 'today' (default) or 'YYYY-MM-DD'",
                    }
                },
                "required": [],
            },
        },
    },
]

WRITE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": (
                "Create a new task in Circuit. Use for any todo, plan, or thing the user needs to do."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Full task description",
                    },
                    "tag": {
                        "type": "string",
                        "description": "Category tag (e.g. work, personal, health, errands)",
                    },
                    "effort": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "Estimated effort level",
                    },
                    "urgency": {
                        "type": "number",
                        "description": "Urgency 0.0–1.0 (1.0 = must do today)",
                    },
                    "importance": {
                        "type": "number",
                        "description": "Importance 0.0–1.0 (1.0 = critical)",
                    },
                    "completed": {
                        "type": "boolean",
                        "description": "True if the task was already done — use for retroactive logging",
                    },
                    "occurred_at": {
                        "type": "string",
                        "description": (
                            "When the task was worked on, IST (Asia/Kolkata). "
                            "Use YYYY-MM-DDT12:00:00+05:30 from [Entry date] prefix for past entries; omit for today"
                        ),
                    },
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_interaction",
            "description": (
                "Log an interaction with one or more people in Canopy. "
                "Use for meetings, calls, conversations, or any contact with someone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "observation": {
                        "type": "string",
                        "description": "What happened — the key observation or summary of the interaction",
                    },
                    "context": {
                        "type": "string",
                        "description": "Where or why the interaction occurred",
                    },
                    "outcome": {
                        "type": "string",
                        "description": "Result, decision, or follow-up from the interaction",
                    },
                    "person_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Names of people involved",
                    },
                    "tag_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags for this interaction (e.g. work, personal, follow-up)",
                    },
                    "occurred_at": {
                        "type": "string",
                        "description": (
                            "When the interaction happened, IST (Asia/Kolkata). "
                            "Use YYYY-MM-DDT12:00:00+05:30 from [Entry date] prefix for past entries; omit for today"
                        ),
                    },
                },
                "required": ["observation"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_meal",
            "description": (
                "Log a meal decision in Chef. Use for anything the user ate, cooked, or ordered."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "decision": {
                        "type": "string",
                        "enum": ["cook", "order", "eat_out"],
                        "description": "How the meal was obtained",
                    },
                    "recipe_name": {
                        "type": "string",
                        "description": "Name of the dish or meal",
                    },
                    "cuisine": {
                        "type": "string",
                        "description": "Cuisine type (e.g. Italian, Pakistani, Japanese)",
                    },
                    "satisfaction": {
                        "type": "integer",
                        "description": "Satisfaction rating 1–5",
                    },
                    "timestamp": {
                        "type": "string",
                        "description": (
                            "When the meal occurred, IST (Asia/Kolkata). "
                            "Use YYYY-MM-DDT12:00:00+05:30 from [Entry date] prefix for past entries"
                        ),
                    },
                },
                "required": ["decision"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": (
                "Update an existing Circuit task by ID — mark complete, change text, urgency, "
                "importance, tag, effort, or scheduled time."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "Circuit task ID to update",
                    },
                    "text": {"type": "string", "description": "New task description"},
                    "completed": {"type": "boolean", "description": "Mark done or reopen"},
                    "tag": {"type": "string"},
                    "effort": {"type": "string", "enum": ["low", "medium", "high"]},
                    "urgency": {"type": "number", "description": "0.0–1.0"},
                    "importance": {"type": "number", "description": "0.0–1.0"},
                    "scheduled_at": {
                        "type": "string",
                        "description": "New scheduled time, IST (YYYY-MM-DDTHH:MM:SS+05:30)",
                    },
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_person",
            "description": (
                "Add a new person to Canopy (relationship tracking). Use when the user mentions "
                "someone not yet in their people list."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Person's name"},
                    "relationship": {
                        "type": "string",
                        "description": "Relationship type (e.g. friend, colleague, family)",
                    },
                    "notes": {"type": "string", "description": "Optional notes about this person"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_meal_entry",
            "description": (
                "Update an existing Chef food log entry by ID — change decision type, dish name, "
                "cuisine, satisfaction, or timestamp."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "entry_id": {
                        "type": "string",
                        "description": "Chef history entry ID",
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["cook", "order", "eat_out"],
                    },
                    "recipe_name": {"type": "string"},
                    "cuisine": {"type": "string"},
                    "satisfaction": {"type": "integer", "description": "1–5"},
                    "timestamp": {
                        "type": "string",
                        "description": "When the meal occurred, IST",
                    },
                },
                "required": ["entry_id"],
            },
        },
    },
]

# Scope-filtered tool sets for embedded per-app chat
SCOPE_TOOLS: dict[str, list] = {
    "circuit": [
        t for t in READ_TOOLS
        if t["function"]["name"] in ("get_my_tasks", "get_task_summary")
    ] + [
        t for t in WRITE_TOOLS
        if t["function"]["name"] in ("create_task", "update_task")
    ],
    "canopy": [
        t for t in READ_TOOLS
        if t["function"]["name"] in ("get_people", "get_recent_interactions", "get_interactions_for_person")
    ] + [
        t for t in WRITE_TOOLS
        if t["function"]["name"] in ("log_interaction", "create_person")
    ],
    "chef": [
        t for t in READ_TOOLS
        if t["function"]["name"] in ("get_meal_recommendation", "get_cook_vs_order", "get_food_log")
    ] + [
        t for t in WRITE_TOOLS
        if t["function"]["name"] in ("log_meal", "update_meal_entry")
    ],
}
