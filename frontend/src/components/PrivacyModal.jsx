/**
 * Privacy notice modal (Italian GDPR consent for guest check-in).
 *
 * Used on the check-in review step (step 4). The wrapper checkbox lives in
 * the parent; clicking the link "Accetto Regolamento Privacy" opens this
 * full-text modal with a single "Chiudi" button.
 */
export default function PrivacyModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4"
      data-testid="privacy-modal"
      onClick={onClose}
    >
      <div
        className="bg-[#0E0E14] border border-amber-500/40 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0E0E14] border-b border-[#1E1E28] px-5 py-3 flex justify-between items-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400">
            Informativa Privacy
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100 text-lg cursor-pointer"
            data-testid="privacy-modal-close-x"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 text-zinc-300 text-[13px] leading-relaxed space-y-3">
          <p>
            Dichiaro di aver preso visione dell&apos;informativa sul trattamento
            dei dati personali e di essere informato che i dati contenuti nel
            mio documento di identità saranno trattati esclusivamente per
            l&apos;adempimento degli obblighi di legge relativi alla
            registrazione degli ospiti.
          </p>
          <p>
            Autorizzo l&apos;acquisizione del documento mediante scansione
            elettronica con tecnologia OCR (riconoscimento ottico dei caratteri)
            al solo scopo di estrarre automaticamente i dati necessari agli
            adempimenti previsti dalla normativa vigente.
          </p>
          <p className="font-bold text-zinc-100">Prendo atto che:</p>
          <ul className="list-none space-y-2 pl-4">
            <li>
              • I dati estratti dal documento saranno utilizzati esclusivamente
              per gli adempimenti previsti dall&apos;art. 109 del T.U.L.P.S.,
              dalle normative statistiche e turistiche applicabili e da ogni
              altro obbligo di legge connesso all&apos;ospitalità.
            </li>
            <li>
              • I dati potranno essere comunicati esclusivamente alle Autorità
              competenti e agli enti pubblici previsti dalla normativa vigente,
              inclusi il portale Alloggiati Web della Polizia di Stato e il
              sistema Ross1000.
            </li>
            <li>
              • L&apos;immagine del documento viene utilizzata esclusivamente
              per il tempo tecnico necessario all&apos;estrazione dei dati e
              non viene conservata. Terminato il processo di acquisizione e
              trasmissione dei dati, l&apos;immagine viene cancellata.
            </li>
          </ul>

          <div className="border border-[#1E1E28] p-3 bg-black/30 text-[12px] font-mono">
            <p><span className="text-zinc-500">Titolare del trattamento:</span> Paolo Manni</p>
            <p><span className="text-zinc-500">Indirizzo:</span> Via Montanara 35, 65100 Pescara (PE)</p>
            <p>
              <span className="text-zinc-500">Email: </span>
              <a href="mailto:info@dedomo.it" className="text-amber-400 underline">info@dedomo.it</a>
            </p>
          </div>

          <p>
            <b className="text-zinc-100">Finalità del trattamento:</b>{" "}
            adempimento degli obblighi di legge relativi alla registrazione
            degli ospiti e alle comunicazioni obbligatorie alle Autorità
            competenti.
          </p>
          <p>
            <b className="text-zinc-100">Base giuridica del trattamento:</b>{" "}
            adempimento di obblighi legali cui è soggetto il titolare del
            trattamento ai sensi dell&apos;art. 6, par. 1, lett. c) del
            Regolamento (UE) 2016/679 (GDPR). L&apos;utilizzo della tecnologia
            OCR costituisce una modalità tecnica di acquisizione dei dati
            finalizzata al perseguimento di tali obblighi.
          </p>
          <p>
            <b className="text-zinc-100">Periodo di conservazione:</b> i dati
            personali saranno conservati per il tempo necessario
            all&apos;adempimento degli obblighi di legge e per gli eventuali
            termini di conservazione previsti dalla normativa applicabile.
          </p>
          <p>
            L&apos;avvenuta presa visione della presente informativa e
            l&apos;accettazione della procedura di acquisizione saranno
            registrate con data e ora per finalità di accountability e
            dimostrazione della conformità agli obblighi normativi.
          </p>
          <p>
            L&apos;interessato potrà esercitare i diritti previsti dagli
            articoli 15 e seguenti del GDPR, nei limiti consentiti dalla
            normativa applicabile e compatibilmente con gli obblighi legali di
            conservazione, contattando il titolare all&apos;indirizzo e-mail
            sopra indicato.
          </p>
          <p>
            Resta salvo il diritto di proporre reclamo al Garante per la
            Protezione dei Dati Personali.
          </p>
        </div>

        <div className="sticky bottom-0 bg-[#0E0E14] border-t border-[#1E1E28] px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            data-testid="privacy-modal-close-btn"
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-[0.25em] text-[11px] px-6 py-2 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
