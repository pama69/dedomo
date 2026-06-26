/**
 * Client-side OCR using OpenAI Vision.
 * Runs in browser to bypass Railway's outbound connection limits.
 * API key should be in REACT_APP_OPENAI_API_KEY env var.
 */

const SYSTEM_PROMPT = `Sei un esperto OCR specializzato in documenti italiani ed esteri: Carta d'Identità (CIE/CIE elettronica/cartacea), Passaporto, Patente di Guida.

Devi estrarre i dati anagrafici dal documento. Se è presente una zona MRZ (Machine Readable Zone), usala come fonte primaria perché è più affidabile.

Restituisci ESCLUSIVAMENTE un JSON valido (no markdown, no testo extra) con questi campi:
{
  "cognome": "string",
  "nome": "string",
  "sesso": "M|F",
  "data_nascita": "YYYY-MM-DD",
  "luogo_nascita": "string",
  "stato_nascita_nome": "string",
  "stato_nascita_iso3": "ITA|...",
  "cittadinanza_nome": "string",
  "cittadinanza_iso3": "ITA|...",
  "tipo_documento": "CARTA_IDENTITA|CARTA_IDENTITA_ELETTRONICA|PASSAPORTO|PATENTE",
  "numero_documento": "string",
  "is_foreign": boolean,
  "note": "string (se hai dubbi o hai dovuto interpretare)"
}`;

export async function extractDocumentClient(imageBase64, mimeType = "image/jpeg") {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Scansione documento non disponibile" };
  }

  try {
    // Strip data: prefix if present
    let b64 = imageBase64;
    if (b64.startsWith("data:")) {
      b64 = b64.split(",")[1];
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Estrai i dati anagrafici da questo documento e restituisci SOLO il JSON richiesto.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${b64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return {
        error: `OpenAI ${response.status}: ${err.error?.message || "Errore sconosciuto"}`,
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { error: `Risposta non valida: ${text.slice(0, 100)}` };
    }

    const json = JSON.parse(match[0]);
    return { success: true, data: json };
  } catch (e) {
    return { error: `Errore OCR client: ${e.message}` };
  }
}
