import { useNavigate } from "react-router-dom";

/**
 * Privacy page — full GDPR notice (same content as PrivacyModal), as a
 * standalone, public, indexable page. Linked from the landing footer.
 */
export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#05050A] text-zinc-300 px-5 py-10 md:py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-6" data-testid="privacy-page">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
            data-testid="privacy-back-btn"
          >
            ← Indietro
          </button>
          <a
            href="/"
            className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 hover:text-zinc-100"
          >
            dedomo.it
          </a>
        </div>

        <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400">
          Informativa Privacy / GDPR
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">
          Trattamento dei dati personali
        </h1>

        <div className="text-[14px] leading-relaxed space-y-4">
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

          <div className="border border-[#1E1E28] p-4 bg-[#0E0E14] text-[13px] font-mono">
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

        <div className="border-t border-[#1E1E28] pt-6 mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            data-testid="privacy-close-btn"
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-[0.25em] text-[11px] px-8 py-3 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
