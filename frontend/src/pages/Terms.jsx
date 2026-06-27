import { useNavigate } from "react-router-dom";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#05050A] text-zinc-300 px-5 py-10 md:py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 hover:text-zinc-100 cursor-pointer"
          >
            ← Indietro
          </button>
          <a href="/" className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 hover:text-zinc-100">
            dedomo.it
          </a>
        </div>

        <span className="text-[10px] tracking-[0.3em] uppercase text-amber-400">
          Termini e condizioni
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">
          Termini di utilizzo del servizio
        </h1>
        <p className="text-[12px] text-zinc-500 font-mono">Ultimo aggiornamento: giugno 2025</p>

        <div className="text-[14px] leading-relaxed space-y-6">

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">1. Descrizione del servizio</h2>
            <p>
              Dedomo è una piattaforma SaaS che consente ai gestori di strutture ricettive di adempiere agli obblighi
              di legge relativi alla registrazione degli ospiti (Alloggiati Web / Polizia di Stato, Ross1000),
              al calcolo dell'imposta di soggiorno e alla produzione di documentazione fiscale. Il servizio è fornito
              da Paolo Manni, Via Montanara 35, 65123 Pescara (PE) — <a href="mailto:info@dedomo.it" className="text-amber-400 underline">info@dedomo.it</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">2. Accettazione dei termini</h2>
            <p>
              L'utilizzo del servizio implica l'accettazione integrale dei presenti Termini. Se non si accettano,
              è necessario interrompere immediatamente l'utilizzo di Dedomo.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">3. Registrazione e account</h2>
            <p>
              Per accedere al servizio è necessario creare un account con credenziali valide. L'utente è responsabile
              della riservatezza delle proprie credenziali e di tutte le attività effettuate tramite il proprio account.
              È vietata la cessione dell'account a terzi.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">4. Piano gratuito e abbonamento</h2>
            <p>
              Dedomo offre un piano gratuito con funzionalità limitate (5 invii di prova). Per l'utilizzo completo
              è richiesto un abbonamento annuale a pagamento, con tariffazione per numero di proprietà gestite.
              I prezzi sono indicati nella pagina Prezzi e sono IVA esclusa salvo diversa indicazione.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">5. Pagamenti e rimborsi</h2>
            <p>
              I pagamenti sono gestiti tramite Stripe. L'abbonamento si rinnova automaticamente alla scadenza annuale.
              L'utente può disdire in qualsiasi momento tramite il portale di gestione abbonamento; la disdetta avrà
              effetto alla fine del periodo già pagato. Non sono previsti rimborsi per periodi parziali, salvo
              diverso accordo scritto.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">6. Obblighi dell'utente</h2>
            <p>L'utente si impegna a:</p>
            <ul className="list-none space-y-1 pl-4">
              <li>• utilizzare il servizio nel rispetto della normativa vigente;</li>
              <li>• non trasmettere dati falsi, incompleti o relativi a soggetti terzi senza il loro consenso;</li>
              <li>• non tentare di accedere a funzionalità o dati non autorizzati;</li>
              <li>• non utilizzare il servizio per attività illecite o fraudolente.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">7. Disponibilità del servizio</h2>
            <p>
              Dedomo si impegna a garantire la massima disponibilità del servizio, ma non può escludere
              interruzioni per manutenzione, aggiornamenti o cause di forza maggiore. Non è garantita una
              disponibilità continuativa del 100%.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">8. Limitazione di responsabilità</h2>
            <p>
              Dedomo non è responsabile per eventuali errori o ritardi nelle trasmissioni ai portali istituzionali
              (Alloggiati Web, Ross1000) dovuti a malfunzionamenti di tali sistemi esterni. L'utente rimane
              il responsabile dell'adempimento degli obblighi di legge. La responsabilità complessiva di Dedomo
              non potrà in nessun caso superare l'importo pagato dall'utente negli ultimi 12 mesi.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">9. Proprietà intellettuale</h2>
            <p>
              Tutti i diritti sul software, il design e i contenuti di Dedomo sono riservati. È vietata la
              riproduzione, distribuzione o modifica senza autorizzazione scritta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">10. Modifiche ai termini</h2>
            <p>
              Dedomo si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche
              saranno comunicate via email con almeno 15 giorni di preavviso. Il proseguimento nell'utilizzo
              del servizio dopo tale data costituisce accettazione delle modifiche.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-zinc-100 font-bold text-[15px]">11. Legge applicabile e foro competente</h2>
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente
              in via esclusiva il Foro di Pescara.
            </p>
          </section>

          <div className="border border-[#1E1E28] p-4 bg-[#0E0E14] text-[13px] font-mono">
            <p><span className="text-zinc-500">Titolare del servizio:</span> Paolo Manni</p>
            <p><span className="text-zinc-500">Indirizzo:</span> Via Montanara 35, 65123 Pescara (PE)</p>
            <p>
              <span className="text-zinc-500">Email: </span>
              <a href="mailto:info@dedomo.it" className="text-amber-400 underline">info@dedomo.it</a>
            </p>
          </div>
        </div>

        <div className="border-t border-[#1E1E28] pt-6 mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-[0.25em] text-[11px] px-8 py-3 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
