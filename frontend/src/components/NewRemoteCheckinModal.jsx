import { useState, useEffect } from "react";
import api from "@/lib/api";

export default function NewRemoteCheckinModal({ properties, onClose, onCreated }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.property_id || "");

  useEffect(() => {
    if (!propertyId && properties.length > 0) {
      setPropertyId(properties[0].property_id);
    }
  }, [properties]);
  const [dataArrivo, setDataArrivo] = useState("");
  const [dataPartenza, setDataPartenza] = useState("");
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState("it");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!propertyId || !dataArrivo || !dataPartenza || !email) return;
    setSending(true);
    setErr("");
    try {
      await api.post("/remote-checkins", {
        property_id: propertyId, data_arrivo: dataArrivo,
        data_partenza: dataPartenza, guest_email: email, lang,
      });
      onCreated();
    } catch (e) {
      setErr(e.response?.data?.detail || "Errore — riprova");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-background border border-border max-w-md w-full p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold uppercase tracking-widest text-zinc-100" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          Nuovo Check-in Remoto
        </h3>
        <p className="text-zinc-400 text-[11px] leading-relaxed">
          Invia un link all'ospite per raccogliere i dati di tutti i viaggiatori. Potrai rivedere e autorizzare prima dell'invio ad Alloggiati Web.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Struttura</span>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="input-modern">
            {properties.map((p) => <option key={p.property_id} value={p.property_id}>{p.nome}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-widest uppercase text-zinc-500">Arrivo *</span>
            <input type="date" value={dataArrivo} onChange={(e) => setDataArrivo(e.target.value)} className="input-modern font-mono" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-widest uppercase text-zinc-500">Partenza *</span>
            <input type="date" value={dataPartenza} onChange={(e) => setDataPartenza(e.target.value)} className="input-modern font-mono" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500">Email capogruppo *</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="ospite@email.com" autoFocus className="input-modern font-mono" />
        </label>
        <div className="flex items-center gap-2">
          {["it", "en", "de", "fr"].map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest cursor-pointer border transition-colors ${lang === l ? "border-amber-500 text-amber-300 bg-amber-500/10" : "border-border text-zinc-400 hover:border-zinc-500"}`}>
              {l}
            </button>
          ))}
          <span className="text-[10px] text-zinc-600 ml-1">lingua form</span>
        </div>
        {err && <p className="text-red-400 text-[11px] font-mono">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={send}
            disabled={!propertyId || !dataArrivo || !dataPartenza || !email || sending}
            className="flex-1 bg-zinc-100 hover:bg-white text-[#05050A] px-4 py-3 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-50 font-bold">
            {sending ? "Invio…" : "Invia form all'ospite"}
          </button>
          <button type="button" onClick={onClose}
            className="border border-border text-zinc-400 px-4 py-3 text-[10px] cursor-pointer hover:border-zinc-500">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
