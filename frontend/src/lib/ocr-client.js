/**
 * OCR via backend (POST /api/ocr).
 * Passa l'immagine base64 al backend Python che chiama OpenAI Vision server-side.
 */
import api from "@/lib/api";

export async function extractDocumentClient(imageBase64, mimeType = "image/jpeg") {
  try {
    let b64 = imageBase64;
    if (b64.startsWith("data:")) {
      b64 = b64.split(",")[1];
    }
    const r = await api.post("/ocr", { image_base64: b64, mime_type: mimeType });
    return r.data;
  } catch (e) {
    return { error: e.response?.data?.detail || "Errore OCR — riprova" };
  }
}

/**
 * OCR pubblica per il form remote check-in (no auth, valida tramite token).
 */
export async function extractDocumentPublic(token, imageBase64, mimeType = "image/jpeg") {
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  try {
    let b64 = imageBase64;
    if (b64.startsWith("data:")) {
      b64 = b64.split(",")[1];
    }
    const r = await fetch(`${BACKEND}/api/public/remote-checkin/${token}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: b64, mime_type: mimeType }),
    });
    const data = await r.json();
    if (!r.ok) return { error: data.detail || "Errore OCR" };
    return data;
  } catch (e) {
    return { error: "Errore di connessione — riprova" };
  }
}
