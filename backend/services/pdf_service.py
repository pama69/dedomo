"""
PDF generation for tourist tax receipts.
"""

import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.units import cm


def generate_tax_receipt(
    property_name: str,
    property_address: str,
    property_comune: str,
    property_cin: str,
    data_arrivo: str,
    data_partenza: str,
    guests: List[Dict[str, Any]],
    calculation: Dict[str, Any],
    receipt_number: str,
) -> bytes:
    """Generate a PDF receipt for tourist tax payment."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor("#000000"),
    )
    sub_style = ParagraphStyle(
        "SubStyle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#666666"),
        spaceAfter=12,
    )
    story = []
    story.append(Paragraph("RICEVUTA IMPOSTA DI SOGGIORNO", title_style))
    story.append(Paragraph(f"N. {receipt_number} · Emessa il {datetime.now().strftime('%d/%m/%Y %H:%M')}", sub_style))

    # Property block
    prop_data = [
        ["STRUTTURA", property_name],
        ["INDIRIZZO", property_address],
        ["COMUNE", property_comune],
        ["CIN", property_cin or "—"],
    ]
    t = Table(prop_data, colWidths=[4 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
        ("FONT", (1, 0), (1, -1), "Helvetica", 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Stay info
    story.append(Paragraph("DETTAGLI SOGGIORNO", ParagraphStyle("h", parent=styles["Heading3"], fontSize=11)))
    stay_data = [
        ["Arrivo", datetime.fromisoformat(data_arrivo).strftime("%d/%m/%Y")],
        ["Partenza", datetime.fromisoformat(data_partenza).strftime("%d/%m/%Y")],
        ["Notti totali", str(calculation.get("nights", 0))],
        ["Notti tassabili", str(calculation.get("notti_tassabili", 0))],
        ["Tariffa / notte", f"€ {calculation.get('tariffa', 0):.2f}"],
    ]
    t = Table(stay_data, colWidths=[5 * cm, 11 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
        ("FONT", (1, 0), (1, -1), "Courier", 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Guests breakdown
    story.append(Paragraph("OSPITI", ParagraphStyle("h", parent=styles["Heading3"], fontSize=11)))
    rows = [["#", "Cognome Nome", "Età", "Notti", "Imposta", "Note"]]
    for i, b in enumerate(calculation.get("breakdown", []), 1):
        rows.append([
            str(i),
            f"{b.get('cognome','')} {b.get('nome','')}",
            str(b.get("eta") or "—"),
            str(b.get("notti_tassabili", 0)),
            f"€ {b.get('totale_ospite', 0):.2f}",
            b.get("motivo_esenzione") or "—",
        ])
    t = Table(rows, colWidths=[1 * cm, 6 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm, 3.5 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Total
    total = calculation.get("totale_imposta", 0)
    total_style = ParagraphStyle(
        "Total",
        parent=styles["Normal"],
        fontSize=14,
        alignment=2,  # right
        fontName="Helvetica-Bold",
    )
    story.append(Paragraph(f"TOTALE IMPOSTA: € {total:.2f}", total_style))
    story.append(Spacer(1, 1 * cm))

    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=7,
        textColor=colors.HexColor("#999999"),
    )
    story.append(Paragraph(
        "Documento generato automaticamente da Ospitalo. Conservare per riferimento fiscale.",
        footer_style,
    ))

    doc.build(story)
    return buf.getvalue()
