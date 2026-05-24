"""Optional auth dependency — validates Bearer token against the Cortex auth server."""

import os
from typing import Optional

import httpx
from fastapi import Header, HTTPException

CORTEX_AUTH_URL = os.getenv("CORTEX_AUTH_URL", "").rstrip("/")
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"


async def optional_user_id(
    authorization: Optional[str] = Header(default=None),
) -> Optional[int]:
    """
    Returns the Cortex user ID if a valid Bearer token is present.
    - AUTH_REQUIRED=true  → raises 401 when no/invalid token
    - AUTH_REQUIRED=false → returns None when no/invalid token (guest mode)
    """
    token: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not token:
        if AUTH_REQUIRED:
            raise HTTPException(status_code=401, detail="Authentication required")
        return None

    if not CORTEX_AUTH_URL:
        # No cortex server configured — treat every token as a guest
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{CORTEX_AUTH_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code == 200:
            return resp.json().get("id")
    except httpx.RequestError:
        pass

    if AUTH_REQUIRED:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return None
