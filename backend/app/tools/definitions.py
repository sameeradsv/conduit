READ_TOOLS = [
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
                "Fetch recent interaction logs from Canopy. "
                "Can filter by person_id or tag. Returns context, observation, outcome, participants, and date."
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
                        "description": "ISO 8601 datetime when it happened (omit for now)",
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
                },
                "required": ["decision"],
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
        if t["function"]["name"] == "create_task"
    ],
    "canopy": [
        t for t in READ_TOOLS
        if t["function"]["name"] in ("get_people", "get_recent_interactions")
    ] + [
        t for t in WRITE_TOOLS
        if t["function"]["name"] == "log_interaction"
    ],
    "chef": [
        t for t in READ_TOOLS
        if t["function"]["name"] in ("get_meal_recommendation", "get_cook_vs_order", "get_food_log")
    ] + [
        t for t in WRITE_TOOLS
        if t["function"]["name"] == "log_meal"
    ],
}
