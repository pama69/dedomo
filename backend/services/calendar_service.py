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


def _ascii_safe(text: str) -> str:
    """Strip non-ASCII characters that some iCal parsers (Airbnb) reject.

    Replaces common typographic chars and falls back to ascii-only.
    """
    if not text:
        return ""
    replacements = {"·": "-", "–": "-", "—": "-", "’": "'", "“": '"', "”": '"'}
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("ascii", "ignore").decode("ascii").strip() or "Reserved"


def build_personal_ical(
    property_name: str,
    bookings: List[Dict[str, Any]],
) -> str:
    """Build an Airbnb-compatible iCal calendar from a list of manual bookings.

    Each booking dict expected: {booking_id, start, end, notes}.
    Output conforms to RFC 5545 with the extra hints Airbnb requires:
      - METHOD:PUBLISH on the VCALENDAR
      - STATUS:CONFIRMED + TRANSP:OPAQUE on each VEVENT (blocks the dates)
      - ASCII-safe SUMMARY field
    """
    safe_name = _ascii_safe(property_name) or "Property"

    cal = Calendar()
    cal.add("prodid", "-//Dedomo//Personal Calendar//IT")
    cal.add("version", "2.0")
    cal.add("method", "PUBLISH")
    cal.add("calscale", "GREGORIAN")
    cal.add("name", f"Dedomo - {safe_name}")
    cal.add("x-wr-calname", f"Dedomo - {safe_name}")
    cal.add("x-wr-timezone", "Europe/Rome")

    now_utc = datetime.now(timezone.utc)

    for b in bookings:
        ev = Event()
        try:
            start = date.fromisoformat(b["start"])
            end = date.fromisoformat(b["end"])
        except (ValueError, KeyError):
            continue
        ev.add("uid", f"{b['booking_id']}@dedomo")
        ev.add("dtstamp", now_utc)
        ev.add("created", now_utc)
        ev.add("last-modified", now_utc)
        ev.add("dtstart", start)
        ev.add("dtend", end)
        # Airbnb-friendly: must mark as confirmed + opaque to actually block dates
        ev.add("status", "CONFIRMED")
        ev.add("transp", "OPAQUE")
        # Summary: keep ASCII-only. Include "Reserved" so external platforms
        # (Airbnb in particular) recognize this as a blocking booking.
        notes = _ascii_safe(b.get("notes") or "")
        if notes:
            ev.add("summary", f"Reserved - {safe_name} ({notes})")
            ev.add("description", notes)
        else:
            ev.add("summary", f"Reserved - {safe_name}")
            ev.add("description", f"Manual booking on {safe_name}")
        cal.add_component(ev)

    return cal.to_ical().decode("utf-8")
