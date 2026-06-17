"""IST wall-clock helpers — Conduit treats all user-facing datetimes as IST."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

_IST = timezone(timedelta(hours=5, minutes=30))
_UTC = timezone.utc


def today_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def ensure_ist_datetime(value: str) -> str:
    """
    Normalize a user/LLM datetime string to ISO with +05:30.
    Naive strings (no offset) are interpreted as IST wall-clock.
    """
    raw = value.strip()
    if not raw:
        return raw
    if raw.endswith("Z"):
        return raw
    if "T" not in raw:
        return f"{raw}T12:00:00+05:30"
    # Already has an explicit offset (e.g. +05:30, -04:00)
    if len(raw) > 10 and ("+" in raw[10:] or "-" in raw[11:]):
        return raw
    return f"{raw}+05:30"


def _parse_to_aware(value: str) -> datetime:
    raw = ensure_ist_datetime(value.strip())
    if raw.endswith("Z"):
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return datetime.fromisoformat(raw)


def to_canopy_occurred_at(value: str) -> str:
    """IST/offset datetime → UTC ISO with Z for Canopy API storage."""
    utc = _parse_to_aware(value).astimezone(_UTC).replace(tzinfo=None)
    return utc.strftime("%Y-%m-%dT%H:%M:%S") + "Z"


def to_chef_timestamp(value: str) -> str:
    """IST/offset datetime → naive IST string for Chef API."""
    ist = _parse_to_aware(value).astimezone(_IST).replace(tzinfo=None)
    return ist.strftime("%Y-%m-%dT%H:%M:%S")


def to_circuit_epoch_ms(value: str) -> int:
    """IST/offset datetime → UTC epoch ms for Circuit scheduled_at."""
    return int(_parse_to_aware(value).astimezone(_UTC).timestamp() * 1000)


def parse_canopy_stored(value: str) -> datetime | None:
    """Canopy stored/API ISO (UTC, often with Z) → naive UTC datetime."""
    if not value:
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(_UTC).replace(tzinfo=None)
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is not None:
        return dt.astimezone(_UTC).replace(tzinfo=None)
    return dt


def format_ist_display(value: str | datetime) -> str:
    """Format a stored UTC or parsed datetime for agent display (IST)."""
    if isinstance(value, str):
        dt_utc = parse_canopy_stored(value)
        if dt_utc is None:
            return value
    else:
        dt_utc = value.replace(tzinfo=_UTC) if value.tzinfo is None else value.astimezone(_UTC)
    ist = dt_utc.replace(tzinfo=_UTC).astimezone(_IST)
    return ist.strftime("%Y-%m-%d %H:%M IST")


def now_utc_naive() -> datetime:
    return datetime.now(_UTC).replace(tzinfo=None)


def ist_noon_iso(date_str: str) -> str:
    """YYYY-MM-DD calendar date → noon IST with offset."""
    y, m, d = map(int, date_str.split("-"))
    return datetime(y, m, d, 12, 0, 0, tzinfo=_IST).isoformat(timespec="seconds")
