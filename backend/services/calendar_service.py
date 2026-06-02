"""
Calendar service - fetch external iCal feeds (Booking/Airbnb/Vrbo)
and generate per-property exported iCal feeds for manual bookings.
"""
from __future__ import annotations
from datetime import datetime, date, timezone, timedelta
from typing import List, Dict, Any
import requests
from icalendar import Calendar, Event


def fetch_ical_events(url: str, timeout: int = 10) -> List[Dict[str, Any]]:
    """Fetch and parse an iCal feed. Returns a list of {uid, start, end, summary, description}.

    Dates are normalized to ISO YYYY-MM-DD. Time of day is discarded — we treat all
    bookings as full-day events (Booking/Airbnb/Vrbo always export full-day blocks).
    """
    if not url:
        return []
    try:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        cal = Calendar.from_ical(r.text)
    except Exception:
        return []

    events = []
    for comp in cal.walk("VEVENT"):
        try:
            dtstart = comp.get("DTSTART").dt
            dtend = comp.get("DTEND").dt if comp.get("DTEND") else dtstart
        except Exception:
            continue
        # Normalize datetime → date
        if isinstance(dtstart, datetime):
            dtstart = dtstart.date()
        if isinstance(dtend, datetime):
            dtend = dtend.date()
        uid = str(comp.get("UID", ""))
        summary = str(comp.get("SUMMARY", ""))
        description = str(comp.get("DESCRIPTION", ""))
        events.append({
            "uid": uid,
            "start": dtstart.isoformat(),
            "end": dtend.isoformat(),
            "summary": summary,
            "description": description,
        })
    return events


def build_personal_ical(
    property_name: str,
    bookings: List[Dict[str, Any]],
) -> str:
    """Build an iCal calendar from a list of manual bookings.

    Each booking dict expected: {booking_id, start, end, notes}.
    """
    cal = Calendar()
    cal.add("prodid", "-//Ospitalo//Personal Calendar//IT")
    cal.add("version", "2.0")
    cal.add("name", f"Ospitalo · {property_name}")
    cal.add("x-wr-calname", f"Ospitalo · {property_name}")
    cal.add("calscale", "GREGORIAN")
    for b in bookings:
        ev = Event()
        ev.add("uid", f"{b['booking_id']}@ospitalo")
        try:
            start = date.fromisoformat(b["start"])
            end = date.fromisoformat(b["end"])
        except (ValueError, KeyError):
            continue
        ev.add("dtstart", start)
        ev.add("dtend", end)
        ev.add("summary", f"Ospitalo · {property_name}")
        if b.get("notes"):
            ev.add("description", b["notes"])
        ev.add("dtstamp", datetime.now(timezone.utc))
        cal.add_component(ev)
    return cal.to_ical().decode("utf-8")
