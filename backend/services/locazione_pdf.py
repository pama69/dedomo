"""Locazione receipt generator.

Generates the HTML rendering (for in-browser print) and the PDF (ReportLab fallback)
of the rental receipt based on the user-provided template.

Compute rules (per user spec 2026-06-03):
- importo_locazione: user input
- imposta_soggiorno: pre-calculated from check-in (passed in)
- marca_bollo: €2 if importo_locazione > 77.47, else 0
- totale: importo_locazione + imposta_soggiorno + marca_bollo
- numero ricevuta: auto-increment per CF proprietario (modifiable on input)
"""
from datetime import datetime
from io import BytesIO
from typing import Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

MONTHS_IT = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]


def _fmt_date_it(dt: datetime) -> str:
    return f"{dt.day:02d} {MONTHS_IT[dt.month - 1]} {dt.year}"


def _fmt_amount(v: float) -> str:
    s = f"{v:,.2f}"  # 1,234.56
    # Italian style: thousands "." decimal ","
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def compute_totals(importo_locazione: float, imposta_soggiorno: float) -> Dict[str, float]:
    """Returns dict with importo_locazione, imposta_soggiorno, marca_bollo, totale."""
    marca = 2.0 if importo_locazione > 77.47 else 0.0
    return {
        "importo_locazione": round(importo_locazione, 2),
        "imposta_soggiorno": round(imposta_soggiorno, 2),
        "marca_bollo": marca,
        "totale": round(importo_locazione + imposta_soggiorno + marca, 2),
    }


def render_html(data: Dict[str, Any]) -> str:
    """Render the receipt HTML based on the user template.

    Required keys in data:
      numero, data_emissione (ISO date), proprietario_nome, proprietario_indirizzo,
      proprietario_cf, capogruppo_nome, capogruppo_residenza, periodo_inizio,
      periodo_fine, importo_locazione, imposta_soggiorno, marca_bollo, totale,
      iban, banca, swift, luogo_emissione (str optional)
    """
    de = datetime.fromisoformat(data["data_emissione"])
    pi = datetime.fromisoformat(data["periodo_inizio"])
    pf = datetime.fromisoformat(data["periodo_fine"])
    luogo = data.get("luogo_emissione") or ""
    luogo_data = f"{luogo}, {_fmt_date_it(de)}" if luogo else _fmt_date_it(de)

    rows_html = []
    rows_html.append(
        f"<tr><td>Canone di locazione</td><td class='right'>€ {_fmt_amount(data['importo_locazione'])}</td></tr>"
    )
    if data["imposta_soggiorno"] > 0:
        rows_html.append(
            f"<tr><td>Imposta di soggiorno</td><td class='right'>€ {_fmt_amount(data['imposta_soggiorno'])}</td></tr>"
        )
    if data["marca_bollo"] > 0:
        rows_html.append(
            f"<tr><td>Marca da bollo</td><td class='right'>€ {_fmt_amount(data['marca_bollo'])}</td></tr>"
        )
    rows = "\n".join(rows_html)

    swift_line = f"<p class='muted small'>SWIFT/BIC: {data['swift']}</p>" if data.get("swift") else ""
    banca_line = f"<p class='muted small'>{data['banca']}</p>" if data.get("banca") else ""

    return f"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Ricevuta di Locazione {data['numero']}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         background: linear-gradient(135deg, #f1f5f9 0%, #ecfdf5 100%);
         padding: 48px 16px; margin: 0; color: #1e293b; }}
  .container {{ max-width: 640px; margin: 0 auto; }}
  .receipt {{ background: #fff; border: 1px solid #d1fae5; border-radius: 16px; overflow: hidden;
              box-shadow: 0 10px 30px -10px rgba(16,185,129,0.15); }}
  .header {{ background: linear-gradient(90deg, #047857 0%, #0d9488 100%); color: #fff; padding: 28px 32px;
             display: flex; justify-content: space-between; align-items: center; }}
  .header h1 {{ font-size: 28px; margin: 0 0 4px 0; letter-spacing: -0.02em; font-weight: 600; }}
  .header .sub {{ color: #a7f3d0; font-size: 13px; }}
  .header .num {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22px; font-weight: 500; }}
  .body {{ padding: 32px; }}
  .block {{ margin-bottom: 28px; }}
  .label {{ color: #047857; font-weight: 500; font-size: 14px; margin-bottom: 4px; }}
  .name {{ font-weight: 600; font-size: 18px; color: #1e293b; }}
  .muted {{ color: #64748b; }}
  .small {{ font-size: 13px; }}
  .xs {{ font-size: 11px; }}
  table {{ width: 100%; border-collapse: collapse; border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden; }}
  td {{ padding: 14px 24px; border-bottom: 1px solid #f1f5f9; color: #334155; }}
  tr:last-child td {{ border-bottom: none; }}
  td.right {{ text-align: right; font-weight: 500; color: #1e293b; }}
  .total {{ display: flex; justify-content: flex-end; margin: 32px 0; }}
  .total-card {{ background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 16px; padding: 20px 32px; text-align: right; }}
  .total-label {{ color: #059669; font-size: 11px; letter-spacing: 0.2em; font-weight: 500; margin-bottom: 4px; }}
  .total-amount {{ font-size: 36px; font-weight: 600; color: #065f46; }}
  .iban-box {{ border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; background: #f8fafc; font-size: 13px; }}
  .iban-box .iban {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #047857; font-weight: 500; }}
  .legal {{ font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; line-height: 1.5; }}
  .footer {{ background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;
             display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }}
  .print-hint {{ text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }}
  .print-btn {{ display: inline-block; background: #047857; color: #fff; padding: 12px 28px; border-radius: 8px;
                font-weight: 500; text-decoration: none; cursor: pointer; border: none; font-size: 14px; }}
  .actions {{ text-align: center; margin-top: 24px; }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .actions, .print-hint {{ display: none; }}
    .receipt {{ box-shadow: none; border: none; }}
  }}
</style>
</head>
<body>
<div class="container">
  <div class="receipt">
    <div class="header">
      <div>
        <h1>Ricevuta di Locazione</h1>
        <div class="sub">Quietanza di pagamento</div>
      </div>
      <div style="text-align:right">
        <div class="num">{data['numero']}</div>
        <div class="sub">{luogo_data}</div>
      </div>
    </div>
    <div class="body">
      <div class="block">
        <p class="name">{data['proprietario_nome']}</p>
        <p class="muted">{data['proprietario_indirizzo']}</p>
        <p class="muted small">CF: {data['proprietario_cf']}</p>
      </div>
      <div class="block">
        <p class="label">Si ricevono dal Sig./Sig.ra</p>
        <p class="name">{data['capogruppo_nome']}</p>
        <p class="muted">{data['capogruppo_residenza']}</p>
      </div>
      <div class="block">
        <p class="muted small">Periodo di locazione</p>
        <p style="font-weight:500;color:#334155">{_fmt_date_it(pi)} — {_fmt_date_it(pf)}</p>
      </div>
      <table>{rows}</table>
      <div class="total">
        <div class="total-card">
          <div class="total-label">TOTALE PAGATO</div>
          <div class="total-amount">€ {_fmt_amount(data['totale'])}</div>
        </div>
      </div>
      <div class="iban-box block">
        <p class="muted" style="margin-bottom:8px">Pagamento ricevuto tramite bonifico a favore di:</p>
        <p style="font-weight:500">{data['proprietario_nome']}</p>
        <p class="iban">{data.get('iban', '')}</p>
        {banca_line}
        {swift_line}
      </div>
      <div class="legal">
        <p>La presente ricevuta non costituisce fattura ai sensi dell'art. 21 DPR 633/72, in quanto rilasciata da soggetto non esercente attività commerciale, artistica o professionale.</p>
        <p style="margin-top:8px">Riferimenti normativi: art. 1, comma 1, lett. b) Legge 220/2011 e art. 1199 Codice Civile.</p>
      </div>
    </div>
    <div class="footer">
      <div>Documento n. {data['numero']} · {de.strftime('%d/%m/%Y')}</div>
      <div>Grazie</div>
    </div>
  </div>
  <div class="actions">
    <button class="print-btn" onclick="window.print()">Stampa / Salva PDF</button>
  </div>
  <p class="print-hint">Premi STAMPA e seleziona "Salva come PDF" per archiviare la ricevuta.</p>
</div>
</body>
</html>"""


# ============ ReportLab PDF generator ============
PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
EMERALD_DARK = HexColor("#065f46")
EMERALD = HexColor("#047857")
TEAL = HexColor("#0d9488")
SLATE_900 = HexColor("#0f172a")
SLATE_700 = HexColor("#334155")
SLATE_500 = HexColor("#64748b")
SLATE_400 = HexColor("#94a3b8")
SLATE_200 = HexColor("#e2e8f0")
SLATE_100 = HexColor("#f1f5f9")
SLATE_50 = HexColor("#f8fafc")
EMERALD_50 = HexColor("#ecfdf5")
EMERALD_100 = HexColor("#d1fae5")


def render_pdf(data: Dict[str, Any]) -> bytes:
    """Generate the PDF version of the receipt."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Ricevuta Locazione {data['numero']}")

    de = datetime.fromisoformat(data["data_emissione"])
    pi = datetime.fromisoformat(data["periodo_inizio"])
    pf = datetime.fromisoformat(data["periodo_fine"])
    luogo = data.get("luogo_emissione") or ""
    luogo_data = f"{luogo}, {_fmt_date_it(de)}" if luogo else _fmt_date_it(de)

    # White background
    c.setFillColor(HexColor("#ffffff"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # ---- Header (gradient effect with two solid bands) ----
    header_y = PAGE_H - 50 * mm
    header_h = 30 * mm
    c.setFillColor(EMERALD)
    c.rect(MARGIN, header_y, (PAGE_W - 2 * MARGIN) * 0.55, header_h, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.rect(MARGIN + (PAGE_W - 2 * MARGIN) * 0.55, header_y, (PAGE_W - 2 * MARGIN) * 0.45, header_h, fill=1, stroke=0)
    # Header text
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN + 8 * mm, header_y + header_h - 12 * mm, "Ricevuta di Locazione")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#a7f3d0"))
    c.drawString(MARGIN + 8 * mm, header_y + header_h - 18 * mm, "Quietanza di pagamento")
    # Numero a destra
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Courier-Bold", 14)
    c.drawRightString(PAGE_W - MARGIN - 8 * mm, header_y + header_h - 12 * mm, data["numero"])
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#a7f3d0"))
    c.drawRightString(PAGE_W - MARGIN - 8 * mm, header_y + header_h - 18 * mm, luogo_data)

    # ---- Body ----
    y = header_y - 10 * mm
    content_x = MARGIN + 4 * mm
    content_w = PAGE_W - 2 * MARGIN - 8 * mm

    # Proprietario
    c.setFillColor(SLATE_900)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(content_x, y, data["proprietario_nome"])
    y -= 5 * mm
    c.setFillColor(SLATE_500)
    c.setFont("Helvetica", 9)
    c.drawString(content_x, y, data["proprietario_indirizzo"])
    y -= 4 * mm
    c.setFont("Helvetica", 8)
    c.drawString(content_x, y, f"CF: {data['proprietario_cf']}")

    # Pagante
    y -= 9 * mm
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(content_x, y, "Si ricevono dal Sig./Sig.ra")
    y -= 5 * mm
    c.setFillColor(SLATE_900)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(content_x, y, data["capogruppo_nome"])
    y -= 5 * mm
    c.setFillColor(SLATE_500)
    c.setFont("Helvetica", 9)
    c.drawString(content_x, y, data["capogruppo_residenza"])

    # Periodo
    y -= 9 * mm
    c.setFillColor(SLATE_500)
    c.setFont("Helvetica", 8)
    c.drawString(content_x, y, "Periodo di locazione")
    y -= 4 * mm
    c.setFillColor(SLATE_700)
    c.setFont("Helvetica", 10)
    c.drawString(content_x, y, f"{_fmt_date_it(pi)} — {_fmt_date_it(pf)}")

    # Importi table
    y -= 10 * mm
    table_rows = [("Canone di locazione", data["importo_locazione"])]
    if data["imposta_soggiorno"] > 0:
        table_rows.append(("Imposta di soggiorno", data["imposta_soggiorno"]))
    if data["marca_bollo"] > 0:
        table_rows.append(("Marca da bollo", data["marca_bollo"]))

    table_h = 11 * mm * len(table_rows)
    table_x = content_x
    table_y = y - table_h
    c.setStrokeColor(SLATE_100)
    c.setFillColor(HexColor("#ffffff"))
    c.roundRect(table_x, table_y, content_w, table_h, 6, fill=1, stroke=1)
    for i, (label, val) in enumerate(table_rows):
        row_y = y - (i + 1) * 11 * mm + 4 * mm
        c.setFillColor(SLATE_700)
        c.setFont("Helvetica", 10)
        c.drawString(table_x + 6 * mm, row_y, label)
        c.setFillColor(SLATE_900)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(table_x + content_w - 6 * mm, row_y, f"€ {_fmt_amount(val)}")
        if i < len(table_rows) - 1:
            c.setStrokeColor(SLATE_100)
            c.line(table_x, y - (i + 1) * 11 * mm, table_x + content_w, y - (i + 1) * 11 * mm)
    y = table_y - 8 * mm

    # Totale (card a destra)
    total_w = 70 * mm
    total_h = 20 * mm
    total_x = MARGIN + content_w - total_w + 4 * mm
    total_y = y - total_h
    c.setFillColor(EMERALD_50)
    c.setStrokeColor(EMERALD_100)
    c.roundRect(total_x, total_y, total_w, total_h, 8, fill=1, stroke=1)
    c.setFillColor(EMERALD)
    c.setFont("Helvetica-Bold", 7)
    c.drawRightString(total_x + total_w - 6 * mm, total_y + total_h - 7 * mm, "TOTALE PAGATO")
    c.setFillColor(EMERALD_DARK)
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(total_x + total_w - 6 * mm, total_y + 5 * mm, f"€ {_fmt_amount(data['totale'])}")
    y = total_y - 10 * mm

    # IBAN box
    iban_h = 24 * mm
    if data.get("swift"):
        iban_h += 5 * mm
    if data.get("banca"):
        iban_h += 5 * mm
    iban_y = y - iban_h
    c.setFillColor(SLATE_50)
    c.setStrokeColor(SLATE_200)
    c.setDash(2, 2)
    c.roundRect(content_x, iban_y, content_w, iban_h, 6, fill=1, stroke=1)
    c.setDash()
    yy = iban_y + iban_h - 6 * mm
    c.setFillColor(SLATE_500)
    c.setFont("Helvetica", 8)
    c.drawString(content_x + 4 * mm, yy, "Pagamento ricevuto tramite bonifico a favore di:")
    yy -= 5 * mm
    c.setFillColor(SLATE_900)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(content_x + 4 * mm, yy, data["proprietario_nome"])
    yy -= 5 * mm
    c.setFillColor(EMERALD)
    c.setFont("Courier-Bold", 10)
    c.drawString(content_x + 4 * mm, yy, data.get("iban", ""))
    if data.get("banca"):
        yy -= 4.5 * mm
        c.setFillColor(SLATE_500)
        c.setFont("Helvetica", 8)
        c.drawString(content_x + 4 * mm, yy, data["banca"])
    if data.get("swift"):
        yy -= 4.5 * mm
        c.setFillColor(SLATE_500)
        c.setFont("Helvetica", 8)
        c.drawString(content_x + 4 * mm, yy, f"SWIFT/BIC: {data['swift']}")

    # Nota legale
    y = iban_y - 8 * mm
    c.setFillColor(SLATE_400)
    c.setFont("Helvetica", 7)
    legal1 = "La presente ricevuta non costituisce fattura ai sensi dell'art. 21 DPR 633/72,"
    legal2 = "in quanto rilasciata da soggetto non esercente attività commerciale, artistica o professionale."
    legal3 = "Riferimenti normativi: art. 1, comma 1, lett. b) Legge 220/2011 e art. 1199 Codice Civile."
    c.drawString(content_x, y, legal1)
    c.drawString(content_x, y - 3.2 * mm, legal2)
    c.drawString(content_x, y - 9 * mm, legal3)

    # Footer
    c.setFillColor(SLATE_400)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN, 12 * mm, f"Documento n. {data['numero']} · {de.strftime('%d/%m/%Y')}")
    c.drawRightString(PAGE_W - MARGIN, 12 * mm, "Grazie")

    c.save()
    return buf.getvalue()
