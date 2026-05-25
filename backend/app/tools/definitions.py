TOOLS = [
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
]
