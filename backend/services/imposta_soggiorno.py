"""
Imposta di soggiorno (tourist tax) — local calculation + optional comune endpoint.

Configuration per property:
  - tariffa_per_notte: float
  - max_notti_tassabili: int (es. 7)
  - esenti_min_anni: int (es. 12 — under 12 esenti)
  - endpoint_comune: optional URL for direct submission to comune's portal
"""

from typing import List, Dict, Any
from datetime import datetime


def calcola_imposta(
    guests: List[Dict[str, Any]],
    tariffa: float,
    max_notti: int,
    esenti_under: int,
    data_arrivo: str,
    data_partenza: str,
) -> Dict[str, Any]:
    """Calculate total tourist tax. Each guest contributes
    tariffa * min(nights, max_notti) unless under esenti_under years old.
    Returns breakdown per guest + total.
    """
    arr = datetime.fromisoformat(data_arrivo)
    part = datetime.fromisoformat(data_partenza)
    nights = max(1, (part - arr).days)
    notti_tassabili = min(nights, max_notti)

    breakdown = []
    total = 0.0
    for g in guests:
        eta = None
        if g.get("data_nascita"):
            try:
                dn = g["data_nascita"].strip()
                # Accetta sia YYYY-MM-DD che YYYYMMDD (formato Alloggiati Web)
                if len(dn) == 8 and dn.isdigit():
                    dn = f"{dn[:4]}-{dn[4:6]}-{dn[6:8]}"
                bd = datetime.fromisoformat(dn)
                # Calcolo preciso: tiene conto del compleanno nell'anno di arrivo
                eta = arr.year - bd.year - ((arr.month, arr.day) < (bd.month, bd.day))
            except Exception:
                eta = None

        if eta is not None and eta < esenti_under:
            imposta_ospite = 0.0
            esente = True
            motivo_esenzione = f"Minore di {esenti_under} anni (età: {eta})"
        else:
            imposta_ospite = round(tariffa * notti_tassabili, 2)
            esente = False
            motivo_esenzione = None

        breakdown.append(
            {
                "nome": g.get("nome", ""),
                "cognome": g.get("cognome", ""),
                "eta": eta,
                "esente": esente,
                "motivo_esenzione": motivo_esenzione,
                "notti_tassabili": 0 if esente else notti_tassabili,
                "tariffa": tariffa,
                "totale_ospite": imposta_ospite,
            }
        )
        total += imposta_ospite

    return {
        "totale_imposta": round(total, 2),
        "nights": nights,
        "notti_tassabili": notti_tassabili,
        "tariffa": tariffa,
        "max_notti": max_notti,
        "esenti_under": esenti_under,
        "breakdown": breakdown,
    }
