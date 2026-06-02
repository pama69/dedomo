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


def generate_comune_receipt(
    numero_ricevuta: str,
    data_ricevuta: str,  # YYYY-MM-DD
    comune_nome: str,
    property_name: str,
    property_address: str,
    property_comune: str,
    ospite_nome_cognome: str,
    ospite_residenza: str,
    importo: float,
    data_arrivo: str,
    data_partenza: str,
    pernottamenti: int,
    proprietario: str = "",
    codice_fiscale: str = "",
    n_adulti: int = 0,
    n_esenti: int = 0,
    causale_extra: str = "",
    comune_pec: str = "",
    comune_piva: str = "",
) -> bytes:
    """Generate PDF receipt for municipal tourist tax (Italian format).

    Layout mimics the user-provided HTML template.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    primary = colors.HexColor("#003087")
    accent = colors.HexColor("#d32f2f")

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle", parent=styles["Heading1"], fontSize=18,
        textColor=primary, alignment=1, spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "SubStyle", parent=styles["Normal"], fontSize=14,
        textColor=accent, alignment=1, fontName="Helvetica-Bold", spaceAfter=4,
    )
    h2_style = ParagraphStyle(
        "H2Style", parent=styles["Heading2"], fontSize=16,
        textColor=primary, alignment=1, spaceAfter=8,
    )
    body = styles["Normal"]
    body.fontSize = 10

    story = []
    story.append(Paragraph(f"COMUNE DI {comune_nome.upper()}", title_style))
    story.append(Paragraph("IMPOSTA DI SOGGIORNO", sub_style))
    story.append(Paragraph("Ricevuta / Quietanza", h2_style))

    # Separator line via empty table
    sep = Table([[""]], colWidths=[16 * cm], rowHeights=[0.05 * cm])
    sep.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), primary)]))
    story.append(sep)
    story.append(Spacer(1, 0.4 * cm))

    # Info header
    data_fmt = datetime.fromisoformat(data_ricevuta).strftime("%d/%m/%Y")
    # Build right-side block with proprietario/CF if provided
    right_lines = ["<b>Struttura Ricettiva:</b>"]
    right_lines.append(property_name)
    right_lines.append(f"{property_address} — {property_comune}")
    if proprietario:
        right_lines.append("<br/><b>Proprietario:</b>")
        right_lines.append(proprietario)
    if codice_fiscale:
        right_lines.append(f"<b>C.F.:</b> {codice_fiscale}")
    right_html = "<br/>".join(right_lines)
    head_info = [
        [
            Paragraph(f"<b>N. Ricevuta:</b> {numero_ricevuta}<br/><b>Data:</b> {data_fmt}", body),
            Paragraph(f"<para alignment='right'>{right_html}</para>", body),
        ]
    ]
    t = Table(head_info, colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Ospite table
    ospite_data = [
        [Paragraph("<b>Ospite</b>", body), ""],
        ["Nome e Cognome:", ospite_nome_cognome],
        ["Residenza:", ospite_residenza or "—"],
    ]
    t = Table(ospite_data, colWidths=[5 * cm, 11 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f4ff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), primary),
        ("SPAN", (0, 0), (1, 0)),
        ("BOX", (0, 0), (-1, -1), 0.75, primary),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, primary),
        ("FONT", (0, 1), (0, -1), "Helvetica-Bold", 10),
        ("FONT", (1, 1), (1, -1), "Helvetica", 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Soggiorno + Totale (totale come ultima riga, allineato a destra)
    arrivo_fmt = datetime.fromisoformat(data_arrivo).strftime("%d/%m/%Y")
    partenza_fmt = datetime.fromisoformat(data_partenza).strftime("%d/%m/%Y")
    importo_label_style = ParagraphStyle(
        "ImpLabel", parent=body, fontSize=11, alignment=0,
        textColor=primary, fontName="Helvetica-Bold",
    )
    importo_value_style = ParagraphStyle(
        "ImpValue", parent=body, fontSize=14, alignment=2,
        textColor=accent, fontName="Helvetica-Bold",
    )
    soggiorno_data = [
        ["Periodo di soggiorno:", f"Dal {arrivo_fmt} al {partenza_fmt}"],
        ["N. Adulti:", str(n_adulti)],
        ["N. Persone esenti autocertificate:", str(n_esenti)],
        ["N. pernottamenti:", str(pernottamenti)],
        [
            Paragraph("TOTALE IMPOSTA DI SOGGIORNO", importo_label_style),
            Paragraph(f"€ {importo:.2f}", importo_value_style),
        ],
    ]
    t = Table(soggiorno_data, colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, primary),
        ("INNERGRID", (0, 0), (-1, -2), 0.5, primary),
        ("LINEABOVE", (0, -1), (-1, -1), 1.2, primary),
        ("FONT", (0, 0), (0, -2), "Helvetica-Bold", 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        # Highlight total row
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FAFAFA")),
        ("TOPPADDING", (0, -1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
        ("VALIGN", (0, -1), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    causale = (
        "<b>Causale:</b> Pagamento Imposta di Soggiorno ex art. 4 D.Lgs. 23/2011 "
        "e Regolamento Comunale. Operazione fuori campo IVA."
    )
    if causale_extra:
        causale = f"<b>Causale:</b> {causale_extra}"
    story.append(Paragraph(causale, body))
    story.append(Spacer(1, 0.3 * cm))

    note_style = ParagraphStyle(
        "Note", parent=body, fontSize=9, textColor=colors.HexColor("#444444"),
    )
    story.append(Paragraph(
        f"L'importo sopra indicato sarà riversato al Comune di {comune_nome} "
        "secondo le modalità previste dal regolamento.<br/>"
        "<b>Conservare questa ricevuta.</b>",
        note_style,
    ))
    story.append(Spacer(1, 1.5 * cm))

    # Signatures
    firma_left_lines = ["______________________________________"]
    if proprietario:
        firma_left_lines.append(f"<b>{proprietario}</b>")
        firma_left_lines.append("<font size='8'>Gestore / Titolare Struttura</font>")
    else:
        firma_left_lines.append("Firma del Gestore / Titolare Struttura")
    firma_left_lines.append("<font size='8'>Timbro della Struttura</font>")
    firma_data = [[
        Paragraph(
            "<para alignment='center'>" + "<br/>".join(firma_left_lines) + "</para>",
            body,
        ),
        Paragraph(
            "<para alignment='center'>______________________________________<br/>"
            "Firma dell'Ospite (facoltativa)</para>",
            body,
        ),
    ]]
    t = Table(firma_data, colWidths=[8 * cm, 8 * cm])
    story.append(t)
    story.append(Spacer(1, 0.8 * cm))

    footer_style = ParagraphStyle(
        "Footer", parent=body, fontSize=8, alignment=1,
        textColor=colors.HexColor("#666666"),
    )
    footer_parts = [f"Comune di {comune_nome}"]
    if comune_piva:
        footer_parts.append(f"P.IVA {comune_piva}")
    if comune_pec:
        footer_parts.append(f"PEC: {comune_pec}")
    story.append(Paragraph(" • ".join(footer_parts), footer_style))

    doc.build(story)
    return buf.getvalue()


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
        "Documento generato automaticamente da Dedomo. Conservare per riferimento fiscale.",
        footer_style,
    ))

    doc.build(story)
    return buf.getvalue()
