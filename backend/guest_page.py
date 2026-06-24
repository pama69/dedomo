"""
guest_page.py — Pagina ospite personalizzata Dedomo
Meteo, eventi, mercati, attrazioni per il comune della proprietà.
db viene passato come parametro per evitare import circolari.
"""
import os
import uuid
import json
import re
import logging
import asyncio
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

OPENWEATHERMAP_KEY = os.environ.get("OPENWEATHERMAP_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
GUEST_EMAIL_FROM = os.environ.get("GUEST_EMAIL_FROM", "ospiti@dedomo.it")
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
_OAI_KEY = os.environ.get("OPENAI_API_KEY", "")
# Force real OpenAI endpoint — ignore leftover OPENAI_BASE_URL (Emergent proxy, now dead)
_oai = AsyncOpenAI(api_key=_OAI_KEY, base_url="https://api.openai.com/v1") if _OAI_KEY else None

# Mappa paese (campo Alloggiati Web) → codice lingua
_COUNTRY_LANG = {
    "AUSTRIA": "de", "GERMANIA": "de", "SVIZZERA": "de", "LIECHTENSTEIN": "de",
    "FRANCIA": "fr", "BELGIO": "fr", "LUSSEMBURGO": "fr", "SVIZZERA FR": "fr",
    "ITALIA": "it",
}

def detect_lang(paese_nome: str) -> str:
    return _COUNTRY_LANG.get((paese_nome or "").upper().strip(), "en")


# ──────────────────────────────────────────────────────────────
# GEOCODING
# ──────────────────────────────────────────────────────────────

async def geocode_comune(comune: str, provincia: str, db) -> tuple[float, float]:
    """Ritorna (lat, lon) per un comune italiano. Cache in collection geocache."""
    key = f"{comune},{provincia},IT".lower()
    if db is not None:
        cached = await db.geocache.find_one({"key": key}, {"_id": 0})
        if cached:
            return cached["lat"], cached["lon"]

    if not OPENWEATHERMAP_KEY:
        raise ValueError("OPENWEATHERMAP_KEY mancante")

    q = f"{comune},{provincia},IT" if provincia else f"{comune},IT"
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            "http://api.openweathermap.org/geo/1.0/direct",
            params={"q": q, "limit": 1, "appid": OPENWEATHERMAP_KEY},
        )
        data = r.json()

    if not data:
        raise ValueError(f"Comune non trovato: {q}")

    lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
    if db is not None:
        await db.geocache.replace_one(
            {"key": key},
            {"key": key, "lat": lat, "lon": lon, "comune": comune},
            upsert=True,
        )
    return lat, lon


# ──────────────────────────────────────────────────────────────
# WEATHER
# ──────────────────────────────────────────────────────────────

async def fetch_weather(lat: float, lon: float, lang: str = "it") -> dict:
    if not OPENWEATHERMAP_KEY:
        return {}
    # lang param: it, en, de, fr
    owm_lang = lang if lang in ("it", "en", "de", "fr") else "it"
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat": lat, "lon": lon,
                "appid": OPENWEATHERMAP_KEY,
                "units": "metric",
                "lang": owm_lang,
            },
        )
        d = r.json()
    if d.get("cod") != 200:
        return {}
    return {
        "temp": round(d["main"]["temp"]),
        "temp_min": round(d["main"]["temp_min"]),
        "temp_max": round(d["main"]["temp_max"]),
        "humidity": d["main"].get("humidity"),
        "description": (d["weather"][0]["description"] if d.get("weather") else "").capitalize(),
        "icon": d["weather"][0]["icon"] if d.get("weather") else "01d",
        "wind_kmh": round(d["wind"]["speed"] * 3.6) if d.get("wind") else None,
    }


# ──────────────────────────────────────────────────────────────
# GPT WEB SEARCH HELPERS
# ──────────────────────────────────────────────────────────────

def _extract_json_list(text: str) -> list:
    """Estrae il primo array JSON dal testo GPT."""
    match = re.search(r'\[.*?\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


async def _gpt_search(prompt: str) -> str:
    if not _oai:
        return ""
    try:
        resp = await _oai.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search_preview"}],
            input=prompt,
        )
        return resp.output_text or ""
    except Exception as e:
        logger.error(f"GPT web search error: {e}")
        return ""


async def fetch_events(comune: str, provincia: str, lang: str) -> list:
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lang_note = {"it": "in italiano", "en": "in English", "de": "auf Deutsch", "fr": "en français"}.get(lang, "in English")
    prompt = (
        f"Oggi è {today}. Cerca online e trova eventi, sagre, feste locali o manifestazioni "
        f"in programma DA OGGI IN POI (solo eventi futuri, non passati) nei prossimi 7 giorni "
        f"nel raggio di 50 km da {comune} ({provincia}), Abruzzo/Marche/Molise, Italia. "
        f"Elenca massimo 5 eventi. Per ogni evento includi il link ufficiale o la pagina di riferimento. "
        f"Risposta {lang_note} in JSON array (solo array, niente altro): "
        f'[{{"title":"...","location":"...","date":"YYYY-MM-DD","time":"...","url":"https://..."}}]'
    )
    results = _extract_json_list(await _gpt_search(prompt))
    # Filter out past events server-side
    return [ev for ev in results if not ev.get("date") or ev.get("date", "") >= today_iso]


async def fetch_markets(comune: str, provincia: str, lang: str) -> list:
    lang_note = {"it": "in italiano", "en": "in English", "de": "auf Deutsch", "fr": "en français"}.get(lang, "in English")
    prompt = (
        f"Cerca online i mercati rionali e settimanali nei comuni entro 15 km da {comune} ({provincia}), Italia. "
        f"Consulta i siti ufficiali dei comuni, pro-loco e portali locali per trovare i calendari aggiornati. "
        f"Massimo 6 mercati. IMPORTANTE: per 'location' indica la posizione PRECISA del mercato: "
        f"il nome della piazza o via specifica e il nome del comune (es. 'Piazza Garibaldi, Lanciano'). "
        f"NON indicare solo il nome della città. "
        f"Risposta {lang_note} in JSON array (solo array, niente altro): "
        f'[{{"title":"Mercato di ...","location":"Piazza XX Settembre, Lanciano","days":"Martedì e sabato","time":"7:30-13:30"}}]'
    )
    return _extract_json_list(await _gpt_search(prompt))


async def fetch_wikimedia_image(title: str, lang: str = "en") -> str:
    """Recupera l'immagine principale di un luogo da Wikipedia.

    Strategia: REST API summary (tollerante su titoli e redirect) → search API
    (trova l'articolo più vicino) → pageimages sul titolo trovato.
    """
    if not title:
        return ""
    seen: set = set()
    langs = [l for l in (([lang] if lang in ("it", "en", "de", "fr") else []) + ["it", "en"]) if not (l in seen or seen.add(l))]  # type: ignore[func-returns-value]
    # Wikipedia richiede User-Agent descrittivo — IP cloud vengono bloccati con 403 senza
    wiki_headers = {"User-Agent": "Dedomo/1.0 (https://dedomo.it; pama69@gmail.com) python-httpx"}
    for wiki_lang in langs:
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=wiki_headers) as c:
                # 1. REST API: gestisce redirect e varianti di titolo in modo affidabile
                r = await c.get(
                    f"https://{wiki_lang}.wikipedia.org/api/rest_v1/page/summary/{quote(title, safe='')}",
                )
                if r.status_code == 200:
                    src = r.json().get("thumbnail", {}).get("source", "")
                    if src:
                        return src

                # 2. Search API: trova l'articolo più simile al titolo GPT
                r2 = await c.get(
                    f"https://{wiki_lang}.wikipedia.org/w/api.php",
                    params={"action": "query", "list": "search", "srsearch": title,
                            "srlimit": 1, "format": "json"},
                )
                results = r2.json().get("query", {}).get("search", [])
                if not results:
                    continue
                found_title = results[0]["title"]

                # 3. Recupera immagine per il titolo trovato
                r3 = await c.get(
                    f"https://{wiki_lang}.wikipedia.org/w/api.php",
                    params={"action": "query", "titles": found_title,
                            "prop": "pageimages", "format": "json",
                            "pithumbsize": 640, "redirects": 1},
                )
                pages = r3.json().get("query", {}).get("pages", {})
                for page in pages.values():
                    src = page.get("thumbnail", {}).get("source", "")
                    if src:
                        return src
        except Exception:
            pass
    return ""


async def fetch_unsplash_image(query: str) -> str:
    """Fallback immagine da Unsplash quando Wikipedia non ha foto.
    Usato per luoghi/esperienze senza pagina Wikipedia (es. cantine, tour).
    """
    if not UNSPLASH_ACCESS_KEY or not query:
        return ""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            )
            if r.status_code != 200:
                logger.warning(f"Unsplash HTTP {r.status_code} per '{query}'")
                return ""
            results = r.json().get("results", [])
            if results:
                return results[0].get("urls", {}).get("regular", "") or ""
    except Exception as e:
        logger.warning(f"Unsplash error per '{query}': {e}")
    return ""


async def fetch_attractions(comune: str, provincia: str, lang: str) -> list:
    lang_note = {"it": "in italiano", "en": "in English", "de": "auf Deutsch", "fr": "en français"}.get(lang, "in English")
    prompt = (
        f"Suggerisci 6 luoghi da visitare nel raggio di 100 km da {comune} ({provincia}), Italia. "
        f"Varietà: borghi medievali, parchi naturali, spiagge, città d'arte, esperienze gastronomiche. "
        f"Per ognuno: nome preciso del luogo (come appare su Wikipedia/Google Maps), "
        f"categoria (borgo/parco/spiaggia/città/gastronomia), "
        f"distanza approssimativa da {comune} in km, descrizione breve (max 2 frasi). "
        f"Risposta {lang_note} in JSON array (solo array, niente altro): "
        f'[{{"title":"...","type":"borgo","distance_km":25,"description":"..."}}]'
    )
    results = _extract_json_list(await _gpt_search(prompt))
    if not results:
        return []

    async def _enrich(a: dict) -> dict:
        title = a.get("title", "")
        img = await fetch_wikimedia_image(title, lang)
        if not img:
            # Fallback Unsplash con nome luogo + contesto geografico
            img = await fetch_unsplash_image(f"{title} {provincia} Italy".strip())
        a["image_url"] = img
        a["maps_url"] = (
            f"https://www.google.com/maps/search/?api=1&query="
            f"{quote(title + ', ' + provincia + ', Italia')}"
        )
        return a

    return list(await asyncio.gather(*[_enrich(a) for a in results]))


# ──────────────────────────────────────────────────────────────
# HOUSE MANUAL
# ──────────────────────────────────────────────────────────────

# Campi testuali traducibili: (path, label_in_prompt)
_MANUAL_TEXT_FIELDS = [
    ("checkin.note", "checkin note"),
    ("checkout.note", "checkout note"),
    ("trash.text", "trash collection info"),
    ("parking.text", "parking info"),
    ("emergency.text", "emergency contacts"),
]


def _manual_content_hash(manual: dict) -> str:
    """Hash dei soli campi testuali traducibili. Cambia → cache traduzioni stale."""
    import hashlib, json
    texts = {}
    for path, _ in _MANUAL_TEXT_FIELDS:
        section, key = path.split(".")
        texts[path] = (manual.get(section) or {}).get(key) or ""
    # custom sections: titolo + testo
    for c in (manual.get("custom") or []):
        texts[f"custom.{c.get('id','')}.title"] = c.get("title") or ""
        texts[f"custom.{c.get('id','')}.text"] = c.get("text") or ""
    return hashlib.sha1(json.dumps(texts, sort_keys=True).encode()).hexdigest()[:16]


async def translate_manual(manual: dict, target_lang: str, db, property_id: str) -> dict:
    """Restituisce il manuale tradotto in target_lang.
    - target_lang == "it" → ritorna l'originale invariato.
    - Altrimenti usa GPT-4o-mini con cache in properties.house_manual.translations[hash][lang].
    """
    if not manual or target_lang == "it":
        return manual or {}

    content_hash = _manual_content_hash(manual)
    cache = (manual.get("translations") or {}).get(content_hash, {}).get(target_lang)
    if cache:
        merged = {**manual, **cache}
        merged.pop("translations", None)
        return merged

    if not _oai:
        return manual  # niente OpenAI → mostriamo l'italiano

    # Costruisce input JSON con i soli testi da tradurre
    to_translate: dict = {}
    for path, _ in _MANUAL_TEXT_FIELDS:
        section, key = path.split(".")
        v = (manual.get(section) or {}).get(key)
        if v:
            to_translate[path] = v
    for c in (manual.get("custom") or []):
        cid = c.get("id") or ""
        if c.get("title"):
            to_translate[f"custom.{cid}.title"] = c["title"]
        if c.get("text"):
            to_translate[f"custom.{cid}.text"] = c["text"]

    if not to_translate:
        return manual

    lang_full = {"en": "English", "de": "German", "fr": "French"}.get(target_lang, "English")
    prompt = (
        f"Translate the following Italian holiday-rental house manual texts into {lang_full}. "
        f"Keep a warm, hospitable tone. Preserve any phone numbers, days/times, addresses verbatim. "
        f"Return ONLY a JSON object with the same keys, no markdown.\n\n"
        f"Input:\n{json.dumps(to_translate, ensure_ascii=False)}"
    )
    try:
        resp = await _oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        translated = json.loads(resp.choices[0].message.content or "{}")
    except Exception as e:
        logger.error(f"translate_manual error: {e}")
        return manual

    # Ricostruisce manual tradotto + persiste nella cache
    out = json.loads(json.dumps(manual))  # deep copy
    for path, _ in _MANUAL_TEXT_FIELDS:
        if path in translated:
            section, key = path.split(".")
            out.setdefault(section, {})[key] = translated[path]
    for c in (out.get("custom") or []):
        cid = c.get("id") or ""
        tk = f"custom.{cid}.title"
        if tk in translated:
            c["title"] = translated[tk]
        xk = f"custom.{cid}.text"
        if xk in translated:
            c["text"] = translated[xk]

    # Persist cache (campi tradotti) sotto translations[hash][lang]
    try:
        translations_update = {}
        for path, _ in _MANUAL_TEXT_FIELDS:
            if path in translated:
                section, key = path.split(".")
                translations_update.setdefault(section, {})[key] = translated[path]
        custom_translated = []
        for c in (out.get("custom") or []):
            cid = c.get("id") or ""
            entry = {"id": cid}
            if f"custom.{cid}.title" in translated:
                entry["title"] = c["title"]
            if f"custom.{cid}.text" in translated:
                entry["text"] = c["text"]
            if len(entry) > 1:
                custom_translated.append(entry)
        if custom_translated:
            translations_update["custom"] = custom_translated
        await db.properties.update_one(
            {"property_id": property_id},
            {"$set": {f"house_manual.translations.{content_hash}.{target_lang}": translations_update}},
        )
    except Exception as e:
        logger.warning(f"translate_manual cache write failed: {e}")

    out.pop("translations", None)
    return out


# ──────────────────────────────────────────────────────────────
# TOKEN
# ──────────────────────────────────────────────────────────────

async def generate_guest_token(checkin_id: str, db) -> str:
    checkin = await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0})
    if not checkin:
        raise ValueError("Checkin non trovato")

    guests = checkin.get("guests", [])
    guest_name = guests[0].get("nome", "Ospite") if guests else "Ospite"
    lang = detect_lang(guests[0].get("paese_nome", "")) if guests else "it"

    # Scadenza = data checkout
    expires_at = checkin["data_partenza"] + "T23:59:59+00:00"

    token = uuid.uuid4().hex
    await db.guest_tokens.replace_one(
        {"checkin_id": checkin_id},
        {
            "token": token,
            "checkin_id": checkin_id,
            "property_id": checkin["property_id"],
            "guest_name": guest_name,
            "lang": lang,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        upsert=True,
    )
    return token


# ──────────────────────────────────────────────────────────────
# PAGE DATA (con cache MongoDB)
# ──────────────────────────────────────────────────────────────

async def get_guest_page_data(token: str, db) -> dict:
    token_doc = await db.guest_tokens.find_one({"token": token}, {"_id": 0})
    if not token_doc:
        return {"error": "not_found"}

    expires = datetime.fromisoformat(token_doc["expires_at"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return {"error": "expired"}

    checkin_id = token_doc["checkin_id"]
    lang = token_doc.get("lang", "it")

    prop = await db.properties.find_one({"property_id": token_doc["property_id"]}, {"_id": 0})
    comune = prop.get("comune", "") if prop else ""
    provincia = prop.get("provincia", "") if prop else ""
    property_name = prop.get("nome", "Villa") if prop else "Villa"

    now = datetime.now(timezone.utc)
    cache = await db.guest_page_cache.find_one({"checkin_id": checkin_id}, {"_id": 0}) or {}

    def _stale(key, hours):
        ts = cache.get(f"{key}_at")
        if not ts:
            return True
        t = datetime.fromisoformat(ts)
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return (now - t).total_seconds() > hours * 3600

    updates = {}

    # Geocoding
    lat, lon = None, None
    if OPENWEATHERMAP_KEY and comune:
        try:
            lat, lon = await geocode_comune(comune, provincia, db)
        except Exception as e:
            logger.warning(f"Geocoding fallito per {comune}: {e}")

    if lat and lon and _stale("weather", 3):
        try:
            updates["weather"] = await fetch_weather(lat, lon, lang)
            updates["weather_at"] = now.isoformat()
        except Exception as e:
            logger.error(f"Weather error: {e}")

    # Force refresh if cached events are all in the past
    today_iso = now.strftime("%Y-%m-%d")
    cached_events = cache.get("events") or []
    all_past = cached_events and all(
        ev.get("date", "9999") < today_iso for ev in cached_events if ev.get("date")
    )
    if _stale("events", 24) or all_past:
        try:
            updates["events"] = await fetch_events(comune, provincia, lang)
            updates["events_at"] = now.isoformat()
        except Exception as e:
            logger.error(f"Events error: {e}")

    if _stale("markets", 168):
        try:
            updates["markets"] = await fetch_markets(comune, provincia, lang)
            updates["markets_at"] = now.isoformat()
        except Exception as e:
            logger.error(f"Markets error: {e}")

    # Le immagini valide arrivano da Wikimedia o (fallback) Unsplash. Le cache legacy
    # contengono URL allucinati da GPT (es. siti .it inesistenti → 404): vanno
    # rigenerate. Un image_url vuoto ("") è invece legittimo (nessuna foto trovata)
    # e NON deve forzare un refresh ad ogni caricamento.
    _VALID_IMG_HOSTS = ("wikimedia.org", "images.unsplash.com")
    cached_attractions = cache.get("attractions") or []
    has_legacy_image = any(
        (a.get("image_url") or "")
        and not any(h in a.get("image_url", "") for h in _VALID_IMG_HOSTS)
        for a in cached_attractions
    )
    # TTL 48h: i suggerimenti ruotano ~ogni 2 giorni durante il soggiorno
    if _stale("attractions", 48) or has_legacy_image:
        try:
            updates["attractions"] = await fetch_attractions(comune, provincia, lang)
            updates["attractions_at"] = now.isoformat()
        except Exception as e:
            logger.error(f"Attractions error: {e}")

    if updates:
        merged = {**cache, **updates, "checkin_id": checkin_id}
        await db.guest_page_cache.replace_one({"checkin_id": checkin_id}, merged, upsert=True)
        cache = merged

    checkin = await db.checkins.find_one({"checkin_id": checkin_id}, {"_id": 0, "data_arrivo": 1, "data_partenza": 1})

    # House manual — tradotto on-demand (cache per hash contenuto)
    raw_manual = (prop or {}).get("house_manual") or {}
    try:
        house_manual = await translate_manual(raw_manual, lang, db, token_doc["property_id"])
    except Exception as e:
        logger.error(f"translate_manual failed: {e}")
        house_manual = raw_manual
    house_manual.pop("translations", None)

    return {
        "guest_name": token_doc.get("guest_name", "Ospite"),
        "property_name": property_name,
        "comune": comune,
        "provincia": provincia,
        "lang": lang,
        "checkin_date": checkin.get("data_arrivo") if checkin else None,
        "checkout_date": checkin.get("data_partenza") if checkin else None,
        "house_manual": house_manual,
        "weather": cache.get("weather"),
        "events": cache.get("events") or [],
        "markets": cache.get("markets") or [],
        "attractions": cache.get("attractions") or [],
    }


# ──────────────────────────────────────────────────────────────
# EMAIL
# ──────────────────────────────────────────────────────────────

async def send_welcome_email(
    guest_name: str, guest_email: str, token: str, lang: str,
    property_name: str, checkin_date: str, checkout_date: str,
) -> bool:
    if not RESEND_API_KEY:
        logger.warning("[RESEND] RESEND_API_KEY non impostata — email non inviata")
        return False
    if not guest_email:
        logger.warning("[RESEND] guest_email vuoto — email non inviata")
        return False

    base_url = os.environ.get("PUBLIC_BACKEND_URL", "https://dedomo.app")
    url = f"{base_url}/guest/{token}"

    subjects = {
        "it": f"Benvenuto/a a {property_name}, {guest_name}!",
        "en": f"Welcome to {property_name}, {guest_name}!",
        "de": f"Willkommen in {property_name}, {guest_name}!",
        "fr": f"Bienvenue à {property_name}, {guest_name}!",
    }

    bodies = {
        "it": f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
<h2 style="color:#5A7A59">Benvenuto/a, {guest_name}!</h2>
<p>Siamo felici di ospitarti a <strong>{property_name}</strong>.</p>
<p>Abbiamo preparato una pagina personale con informazioni utili per il tuo soggiorno:</p>
<ul><li>Meteo del giorno</li><li>Sagre ed eventi locali</li><li>Mercati nei dintorni</li><li>Gite e luoghi da non perdere</li></ul>
<p style="text-align:center;margin:2rem 0">
  <a href="{url}" style="background:#7B9E7A;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Apri la tua pagina personale →</a>
</p>
<p style="color:#7A6E5E;font-size:13px">Soggiorno: {checkin_date} → {checkout_date}. Il link scade al checkout.</p>
<p>Buona vacanza!<br><strong>Paolo · {property_name}</strong></p></div>""",

        "en": f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
<h2 style="color:#5A7A59">Welcome, {guest_name}!</h2>
<p>We're thrilled to have you at <strong>{property_name}</strong>.</p>
<p>We've prepared a personal page with useful information for your stay:</p>
<ul><li>Today's weather</li><li>Local events and festivals</li><li>Nearby markets</li><li>Day trips and places to visit</li></ul>
<p style="text-align:center;margin:2rem 0">
  <a href="{url}" style="background:#7B9E7A;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Open your personal page →</a>
</p>
<p style="color:#7A6E5E;font-size:13px">Stay: {checkin_date} → {checkout_date}. Link expires at checkout.</p>
<p>Enjoy your holiday!<br><strong>Paolo · {property_name}</strong></p></div>""",

        "de": f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
<h2 style="color:#5A7A59">Willkommen, {guest_name}!</h2>
<p>Wir freuen uns, Sie in <strong>{property_name}</strong> begrüßen zu dürfen.</p>
<p style="text-align:center;margin:2rem 0">
  <a href="{url}" style="background:#7B9E7A;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Ihre persönliche Seite öffnen →</a>
</p>
<p style="color:#7A6E5E;font-size:13px">Aufenthalt: {checkin_date} → {checkout_date}.</p>
<p>Schönen Urlaub!<br><strong>Paolo · {property_name}</strong></p></div>""",

        "fr": f"""<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
<h2 style="color:#5A7A59">Bienvenue, {guest_name}!</h2>
<p>Nous sommes ravis de vous accueillir à <strong>{property_name}</strong>.</p>
<p style="text-align:center;margin:2rem 0">
  <a href="{url}" style="background:#7B9E7A;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Ouvrir votre page personnelle →</a>
</p>
<p style="color:#7A6E5E;font-size:13px">Séjour: {checkin_date} → {checkout_date}.</p>
<p>Bon séjour!<br><strong>Paolo · {property_name}</strong></p></div>""",
    }

    logger.info(f"[RESEND] Invio a {guest_email} da {GUEST_EMAIL_FROM} (lang={lang})")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={
                    "from": GUEST_EMAIL_FROM,
                    "to": [guest_email],
                    "subject": subjects.get(lang, subjects["en"]),
                    "html": bodies.get(lang, bodies["en"]),
                },
            )
            if r.status_code not in (200, 201):
                logger.error(f"[RESEND] ERRORE {r.status_code}: {r.text}")
                return False
            logger.info(f"[RESEND] OK id={r.json().get('id','?')}")
            return True
    except Exception as e:
        logger.error(f"[RESEND] Eccezione: {e}")
        return False
