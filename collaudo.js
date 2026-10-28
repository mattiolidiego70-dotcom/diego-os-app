/* ══════════════════════════════════════════════════════════════════════════
   COLLAUDO — IL FINTO BACKEND NEL BROWSER (27/10/2026)

   PERCHE' ESISTE. Diego deve poter giudicare la Tesoreria DAL TELEFONO,
   da remoto, oggi. Il backend di produzione e' in SOLA LETTURA e non ha le
   migrazioni nuove; il progetto Supabase di collaudo non e' creabile adesso.
   Allora l'API non si raggiunge: si SOSTITUISCE qui dentro. Questo file
   intercetta `fetch` e risponde con dati FINTI ma COERENTI, tenuti in
   localStorage, cosi' le modifiche restano fra un giro e l'altro.

   COSA PROVA E COSA NON PROVA. Prova interfaccia, flussi e percepito: dove
   si clicca, cosa si legge, se una scheda e' vuota o piena, come sta sul
   telefono. NON prova i numeri veri di Diego, NON prova il backend, NON
   prova l'import reale di un estratto. I numeri qui sono INVENTATI: scritti
   a mano in `SEMINA`, e i saldi li DERIVA il motorino qui sotto — percio'
   tornano, ma sono i saldi di un Diego immaginario.

   LA REGOLA DI SICUREZZA. Nessuna richiesta deve uscire verso la produzione.
   Quindi l'intercettazione non e' «best effort»: se una richiesta e'
   diretta all'host di produzione e il percorso non lo conosciamo, si
   RIFIUTA con un errore spiegato invece di lasciarla passare. Un buco qui
   significherebbe una demo che scrive sui soldi veri.

   LE FORME DELLE RISPOSTE vengono da `app/supabase/functions/soldi-app/index.ts`
   e dai render di `tesoreria.html`: i nomi dei campi sono quelli, perche' se
   una forma non torna la pagina non mostra un dato sbagliato, si ROMPE.

   Si carica PRIMA degli altri script (da `tesoreria-demo.html`, generata).
   `tesoreria.html` non lo include: la pagina vera non deve nemmeno sapere
   che questo file esiste.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CHIAVE = 'collaudo_tesoreria';
  var VERSIONE = 3;                       /* cambiarla invalida il salvato */
  var BASE_DEMO = 'https://demo-collaudo.invalido/soldi-app';

  /* le basi che questa demo sostituisce. La pagina calcola API_BASE da
     `location.hostname`: in locale legge `tesoreria_api`, altrove usa
     l'indirizzo di PRODUZIONE — che va intercettato per primo. */
  var PRODUZIONE = 'https://icsafmrkndgdksybagky.supabase.co/functions/v1/soldi-app';
  var HOST_PRODUZIONE = 'icsafmrkndgdksybagky.supabase.co';
  var BASI = [BASE_DEMO, PRODUZIONE, 'http://127.0.0.1:54811', 'http://localhost:54811',
              'http://127.0.0.1:54831', 'http://127.0.0.1:54821'];

  /* ── 1 · DATE. Tutto e' ancorato al MESE CORRENTE, non a date fisse:
        una demo con settembre cablato dentro, aperta a dicembre, mostrerebbe
        schede vuote e sembrerebbe rotta. ─────────────────────────────────── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(a, m, g) { return a + '-' + pad(m) + '-' + pad(g); }
  function giorniNelMese(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }
  function oggiISO() { var d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function meseOggi() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  /* `off` = scostamento in mesi dal mese corrente: -2 = due mesi indietro */
  function meseSpostato(off) {
    var d = new Date(), i = d.getFullYear() * 12 + d.getMonth() + off;
    return { anno: Math.floor(i / 12), mese: (i % 12) + 1 };
  }
  /* un giorno che non esiste in quel mese (il 31 a febbraio) si appoggia
     all'ultimo giorno: cosi' la data e' sempre un giorno vero */
  function giro(off, giorno) {
    var m = meseSpostato(off);
    return iso(m.anno, m.mese, Math.min(giorno, giorniNelMese(m.anno, m.mese)));
  }
  function piuGiorni(s, n) {
    var p = s.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }
  function piuMesiData(s, n) {
    var p = s.split('-').map(Number), i = p[0] * 12 + (p[1] - 1) + n;
    var a = Math.floor(i / 12), m = (i % 12) + 1;
    return iso(a, m, Math.min(p[2], giorniNelMese(a, m)));
  }
  function fineMese(s) {
    var p = s.split('-').map(Number);
    return iso(p[0], p[1], giorniNelMese(p[0], p[1]));
  }
  function dataValida(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    var p = String(s).split('-').map(Number);
    return p[1] >= 1 && p[1] <= 12 && p[2] >= 1 && p[2] <= giorniNelMese(p[0], p[1]);
  }
  function indiceMese(s) { var p = s.split('-').map(Number); return p[0] * 12 + (p[1] - 1); }

  /* ── 2 · LA SEMINA: i numeri scritti A MANO ───────────────────────────────
        Quattro conti (tre operativi + il conto tasse), due carte, una
        ventina di movimenti ricorrenti su cinque mesi (dai due precedenti ai
        due successivi, perche' il periodo di default della pagina parte da
        OGGI e arriva a fine del terzo mese: senza il futuro il prospetto
        sarebbe vuoto). I saldi NON sono scritti: li deriva il motorino. */
  function SEMINA() {
    var taglio = giro(-2, 1);           /* il saldo verificato: primo giorno di due mesi fa */
    var oggi = oggiISO();

    var conti = [
      { dbId: 1, id: 'c1', nome: 'Intesa corrente', tipo: 'corrente', dataTaglio: taglio,
        saldoTaglioCents: 482050, attivo: true, sogliaCents: 100000 },
      { dbId: 2, id: 'c2', nome: 'Fineco corrente', tipo: 'corrente', dataTaglio: taglio,
        saldoTaglioCents: 124000, attivo: true, sogliaCents: 50000 },
      { dbId: 3, id: 'c3', nome: 'Salvadanaio', tipo: 'salvadanaio', dataTaglio: taglio,
        saldoTaglioCents: 650000, attivo: true, sogliaCents: 0 },
      { dbId: 4, id: 'c4', nome: 'Conto tasse', tipo: 'tasse', dataTaglio: taglio,
        saldoTaglioCents: 310000, attivo: true, sogliaCents: 0 }
    ];
    var carte = [
      /* Fineco addebita il 10 e chiude il ciclo il 25: gli acquisti del mese
         scendono dal conto il 10 del mese dopo. */
      { dbId: 1, id: 'k1', nome: 'Fineco Mastercard', codice: '**41', contoId: 'c2',
        giornoAddebito: 10, giornoChiusura: 25, plafondCents: 250000, attivo: true },
      /* Intesa addebita il 15 e chiude il 10: addebito nello STESSO mese della
         chiusura, perche' il giorno di addebito viene dopo. */
      { dbId: 2, id: 'k2', nome: 'Intesa Visa', codice: '**07', contoId: 'c1',
        giornoAddebito: 15, giornoChiusura: 10, plafondCents: 150000, attivo: true }
    ];

    var seq = 100, mov = [];
    /* `stato`: un movimento passato e' rendicontato, uno futuro e' previsto.
       Si puo' forzare — serve per l'unico ARRETRATO della semina, cioe' una
       previsione con data passata e non pagata. */
    function m(contoId, cartaId, off, giorno, cents, descr, cat, sub, forza, pairId) {
      var data = giro(off, giorno);
      seq += 1;
      return { id: 't' + seq, dbId: seq, contoId: contoId, cartaId: cartaId || null,
        data: data, cents: cents, descrizione: descr, categoria: cat || null,
        sottocategoria: sub || null, stato: forza || (data <= oggi ? 'rendicontato' : 'previsto'),
        lato: pairId ? (cents < 0 ? 'uscita' : 'ingresso') : null, pairId: pairId || null,
        previstoCents: null, previstoData: null, dataContabile: null };
    }
    /* una RICORRENZA scritta una volta sola: lo stesso giorno in piu' mesi */
    function ogniMese(offs, fn) { offs.forEach(function (o) { mov.push(fn(o)); }); }
    var CINQUE = [-2, -1, 0, 1, 2];

    /* ENTRATE: le fatture incassate. Importi diversi mese per mese, come nella
       vita di un consulente: non e' uno stipendio fisso. */
    var FATTURE = { '-2': 320000, '-1': 285000, '0': 340000, '1': 300000, '2': 300000 };
    var NUMERI = { '-2': '2026/41', '-1': '2026/47', '0': '2026/52', '1': '2026/58', '2': '2026/63' };
    ogniMese(CINQUE, function (o) {
      return m('c1', null, o, 5, FATTURE[String(o)],
        'Fattura ' + NUMERI[String(o)] + ' — consulenza CFO', 'Entrate', 'Fatture');
    });
    /* AFFITTO dello studio: canone fisso, il 3 del mese */
    ogniMese(CINQUE, function (o) { return m('c1', null, o, 3, -95000, 'Affitto studio', 'Casa', 'Affitto'); });
    /* BOLLETTE: stimate, quindi cambiano */
    var LUCE = { '-2': -14250, '-1': -13180, '0': -15640, '1': -14500, '2': -14500 };
    ogniMese(CINQUE, function (o) { return m('c2', null, o, 18, LUCE[String(o)], 'Enel luce e gas', 'Casa', 'Utenze'); });
    /* SPESA al banco (bancomat, non carta) */
    var SPESA = { '-2': -8740, '-1': -9120, '0': -7980, '1': -8500, '2': -8500 };
    ogniMese(CINQUE, function (o) { return m('c1', null, o, 11, SPESA[String(o)], 'Esselunga', 'Spesa', 'Alimentari'); });
    /* I DUE FINANZIAMENTI: le rate sono movimenti veri, non solo righe di impegno */
    ogniMese(CINQUE, function (o) { return m('c1', null, o, 6, -28900, 'Rata auto', 'Trasporti', 'Auto'); });
    ogniMese(CINQUE, function (o) { return m('c2', null, o, 12, -15400, 'Rata prestito arredo', 'Casa', 'Arredo'); });
    /* il TERZO costo fisso: abbonamenti software */
    ogniMese(CINQUE, function (o) { return m('c2', null, o, 24, -4990, 'Abbonamenti software', 'Lavoro', 'Software'); });

    /* GIROCONTI: due lati, stesso pairId. Neutri sul patrimonio, e la pagina
       li esclude dal riepilogo di periodo proprio perche' portano il pairId. */
    [-1, 0].forEach(function (o, i) {
      var p = 'g-salv-' + i;
      mov.push(m('c1', null, o, 28, -50000, 'Giroconto al salvadanaio', 'Giroconti', null, null, p));
      mov.push(m('c3', null, o, 28, 50000, 'Giroconto dal conto', 'Giroconti', null, null, p));
    });
    /* l'ACCANTONAMENTO delle tasse: 25% convenzionale degli incassi del mese
       prima. 285.000 -> 71.250 e 340.000 -> 85.000: i numeri del riquadro
       tasse e questi giroconti sono LA STESSA COSA, non due cifre scollegate. */
    [{ o: -1, c: 71250 }, { o: 0, c: 85000 }].forEach(function (x, i) {
      var p = 'g-tasse-' + i;
      mov.push(m('c1', null, x.o, 20, -x.c, 'Accantonamento tasse 25%', 'Giroconti', null, null, p));
      mov.push(m('c4', null, x.o, 20, x.c, 'Accantonamento tasse 25%', 'Giroconti', null, null, p));
    });
    /* ALIMENTAZIONE passata: Intesa ha rifornito Fineco due volte. Senza
       questi, Fineco sarebbe gia' sotto zero oggi e sembrerebbe un errore;
       con questi, scende sotto soglia nel FUTURO — che e' il caso da vedere. */
    [-2, -1].forEach(function (o, i) {
      var p = 'g-alim-' + i;
      mov.push(m('c1', null, o, 26, -60000, 'Giroconto a Fineco', 'Giroconti', null, null, p));
      mov.push(m('c2', null, o, 26, 60000, 'Giroconto da Intesa', 'Giroconti', null, null, p));
    });
    /* UNA USCITA UNA TANTUM, perche' non sia tutto ricorrente */
    mov.push(m('c1', null, 1, 8, -68000, 'Assicurazione auto annuale', 'Trasporti', 'Assicurazione'));
    /* il PAGAMENTO delle tasse: esce dal conto tasse, non dal corrente */
    mov.push(m('c4', null, 1, 30, -215000, 'F24 acconto di novembre', 'Tasse', null));
    /* L'ARRETRATO dichiarato: previsto, data passata, non pagato. Serve a far
       vedere il riquadro «Impegni scaduti aperti» con un numero vero. */
    mov.push(m('c2', null, -1, 8, -3200, 'Rinnovo dominio (non pagato)', 'Lavoro', 'Software', 'previsto'));

    /* ACQUISTI SU CARTA: non toccano il conto alla loro data, entrano
       nell'addebito del ciclo. Distribuiti sui cicli giusti perche' la scheda
       Carte mostri «gli acquisti del ciclo da liquidare». */
    [
      ['k1', 'c2', -1, 3, -5400, 'Conad', 'Spesa', 'Alimentari'],
      ['k1', 'c2', -1, 16, -7320, 'Benzina Q8', 'Trasporti', 'Carburante'],
      ['k1', 'c2', 0, 2, -3250, 'Conad', 'Spesa', 'Alimentari'],
      ['k1', 'c2', 0, 7, -8990, 'Decathlon', 'Tempo libero', null],
      ['k1', 'c2', 0, 14, -4560, 'Esselunga', 'Spesa', 'Alimentari'],
      ['k1', 'c2', 0, 21, -12900, 'Amazon — scrivania', 'Casa', 'Arredo'],
      ['k1', 'c2', 1, 4, -4100, 'Conad', 'Spesa', 'Alimentari'],
      ['k2', 'c1', -1, 22, -4480, 'Hotel Bologna', 'Lavoro', null],
      ['k2', 'c1', 0, 13, -6700, 'Ristorante Al Portico', 'Tempo libero', null],
      ['k2', 'c1', 0, 19, -2340, 'Farmacia', 'Salute', null],
      ['k2', 'c1', 0, 26, -9150, 'Volo Roma', 'Lavoro', null]
    ].forEach(function (r) { mov.push(m(r[1], r[0], r[2], r[3], r[4], r[5], r[6], r[7])); });

    var categorie = [
      { id: 1, nome: 'Casa', attiva: true, sotto: [{ id: 11, nome: 'Affitto', attiva: true },
        { id: 12, nome: 'Utenze', attiva: true }, { id: 13, nome: 'Arredo', attiva: true }] },
      { id: 2, nome: 'Spesa', attiva: true, sotto: [{ id: 21, nome: 'Alimentari', attiva: true }] },
      { id: 3, nome: 'Trasporti', attiva: true, sotto: [{ id: 31, nome: 'Auto', attiva: true },
        { id: 32, nome: 'Carburante', attiva: true }, { id: 33, nome: 'Assicurazione', attiva: true }] },
      { id: 4, nome: 'Lavoro', attiva: true, sotto: [{ id: 41, nome: 'Software', attiva: true }] },
      { id: 5, nome: 'Tempo libero', attiva: true, sotto: [] },
      { id: 6, nome: 'Salute', attiva: true, sotto: [] },
      { id: 7, nome: 'Entrate', attiva: true, sotto: [{ id: 71, nome: 'Fatture', attiva: true }] },
      { id: 8, nome: 'Giroconti', attiva: true, sotto: [] },
      { id: 9, nome: 'Tasse', attiva: true, sotto: [] }
    ];
    /* i PARAMETRI: quelli concordati portano un valore, quelli da concordare
       restano vuoti DICHIARATI — la pagina ci conta per rifiutarsi di
       mostrare un importo fiscale */
    var parametri = [
      { chiave: 'promemoria.anticipo_default', valore: '5', stato: 'concordato' },
      { chiave: 'conto_tasse.identificativo', valore: 'Conto tasse', stato: 'concordato' },
      { chiave: 'conto_tasse.alimentazione', valore: 'giroconto mensile del 25%', stato: 'concordato' },
      { chiave: 'tasse_conv.giorno_scadenza', valore: 'ultimo giorno del mese', stato: 'concordato' },
      { chiave: 'tasse_conv.conto_origine', valore: 'Intesa corrente', stato: 'concordato' },
      { chiave: 'avvio.saldo_alla_data', valore: taglio, stato: 'verificato' },
      { chiave: 'conto_tasse.periodo_dovuto', valore: null, stato: 'da_concordare' },
      { chiave: 'fisco.regime', valore: null, stato: 'da_concordare' },
      { chiave: 'fisco.ateco', valore: null, stato: 'da_concordare' },
      { chiave: 'fisco.previdenza', valore: null, stato: 'da_concordare' },
      { chiave: 'salvadanaio.destinazione', valore: null, stato: 'da_concordare' }
    ];

    return {
      versione: VERSIONE,
      ancora: meseOggi(),
      conti: conti, carte: carte, movimenti: mov,
      categorie: categorie, parametri: parametri,
      prossimoId: seq + 1,
      /* OBIETTIVI: ripartiscono il salvadanaio. L'assegnato e' scritto a mano,
         il «non assegnato» e' il RESTO calcolato: assegnato + resto = saldo,
         sempre, anche dopo che Diego sposta una quota. */
      obiettivi: [
        { id: 1, contoId: 'c3', nome: 'Fondo emergenze', traguardo_cents: 1000000,
          assegnato_cents: 450000, note: 'sei mesi di costi fissi' },
        { id: 2, contoId: 'c3', nome: 'Viaggio Giappone', traguardo_cents: 400000,
          assegnato_cents: 200000, note: 'primavera 2027' }
      ],
      /* BUDGET: capienze per categoria. «Tempo libero» e' volutamente stretta,
         cosi' si vede il caso «oltre la capienza». */
      budget: [
        { categoria_id: 2, categoria: 'Spesa', capienza_cents: 45000, valido_da: giro(-2, 1) },
        { categoria_id: 5, categoria: 'Tempo libero', capienza_cents: 12000, valido_da: giro(-2, 1) }
      ],
      /* IMPEGNI: due finanziamenti e tre costi fissi, agganciati alle rate
         vere qui sopra (stesso giorno, stesso importo, stesso conto). */
      finanziamenti: [
        { id: 1, nome: 'Rata auto', contoId: 'c1', rata_cents: -28900, giorno: 6,
          frequenza: 'mensile', tipo_piano: 'rata_costante', capitale_cents: 1800000,
          tan_bp: 599, taeg_bp: 712, rate_totali: 72, rate_pagate: 23, rate_parziali: 0,
          completezza: 'completo', erogazione: 'al fornitore', spese_per_rata_cents: 200,
          spese_iniziali_cents: 35000, spese_iniziali_data: giro(-23, 6) },
        { id: 2, nome: 'Rata prestito arredo', contoId: 'c2', rata_cents: -15400, giorno: 12,
          frequenza: 'mensile', tipo_piano: 'sequenza_nota', capitale_cents: null,
          tan_bp: null, taeg_bp: null, rate_totali: 24, rate_pagate: 9, rate_parziali: 1,
          completezza: 'parziale', erogazione: null, spese_per_rata_cents: 0,
          spese_iniziali_cents: null, spese_iniziali_data: null }
      ],
      serie: [
        { id: 1, nome: 'Affitto studio', contoId: 'c1', tipo: 'canone', importo_cents: -95000,
          giorno: 3, frequenza: 'mensile', fine: null, stimato: false },
        { id: 2, nome: 'Enel luce e gas', contoId: 'c2', tipo: 'bolletta', importo_cents: -14500,
          giorno: 18, frequenza: 'mensile', fine: null, stimato: true },
        { id: 3, nome: 'Abbonamenti software', contoId: 'c2', tipo: 'canone', importo_cents: -4990,
          giorno: 24, frequenza: 'mensile', fine: null, stimato: false }
      ],
      /* le ENTRATE dell'Attivo: fatturato, atteso e incassato sono tre numeri
         diversi, e la demo li tiene diversi */
      entrate: [
        { id: 1, da: 'Alfa Manifatture Srl', tipo: 'fattura', numero: '2026/52',
          importo_cents: 340000, incassato_cents: 340000, stato: 'incassata',
          attesa_il: giro(0, 5), emessa_il: giro(-1, 28), rilevanza_fiscale: 'imponibile', versione: 1 },
        { id: 2, da: 'Beta Logistica Spa', tipo: 'fattura', numero: '2026/58',
          importo_cents: 300000, incassato_cents: 0, stato: 'attesa',
          attesa_il: giro(1, 5), emessa_il: giro(0, 28), rilevanza_fiscale: 'imponibile', versione: 1 },
        { id: 3, da: 'Gamma Consulting', tipo: 'fattura', numero: '2026/63',
          importo_cents: 300000, incassato_cents: 0, stato: 'attesa',
          attesa_il: giro(2, 5), emessa_il: null, rilevanza_fiscale: 'imponibile', versione: 1 },
        { id: 4, da: 'Rimborso spese convegno', tipo: 'fuori_piva', numero: null,
          importo_cents: 48000, incassato_cents: 48000, stato: 'incassata',
          attesa_il: giro(-1, 14), emessa_il: giro(-1, 10), rilevanza_fiscale: 'da_definire', versione: 1 }
      ],
      /* ALIMENTAZIONE: la regola e' CONFIGURATA, cosi' si vede la proposta.
         Soglia 500,00 e livello 1.500,00 su Fineco. */
      alimentazione: { configurata: true, conto_sorgente_id: 1, conto_sorgente: 'Intesa corrente',
        conto_alimentato_id: 2, conto_alimentato: 'Fineco corrente',
        soglia_cents: 50000, livello_obiettivo_cents: 150000 },
      promemoria: [
        { id: 1, titolo: 'Pagare il rinnovo del dominio', entita: 'transaction', entita_id: 103,
          quando: giro(-1, 8) + 'T09:00:00.000Z', anticipo_giorni: 5, ricorrenza: 'nessuna',
          canali: 'app,telegram', stato: 'fallito', attivo: true, tentativi: [{ quando: giro(-1, 3), esito: 'telegram non collegato' }] },
        { id: 2, titolo: 'Accantonare il 25% degli incassi del mese', entita: 'generico', entita_id: null,
          quando: fineMese(giro(0, 1)) + 'T09:00:00.000Z', anticipo_giorni: 5, ricorrenza: 'ogni_mese',
          canali: 'app', stato: 'programmato', attivo: true, tentativi: [] }
      ],
      scenari: [
        { id: 1, nome: 'Se cambio auto a gennaio', nota: 'anticipo e rata nuova',
          differenze: [{ id: 1, nome: 'Anticipo auto nuova', entita: 'transaction', op: 'insert',
            contoId: 'c1', data: giro(2, 15), cents: -850000, promossa: false, conflitto: false }] }
      ],
      /* ADA (nel codice `alfred`): cartelle, una conversazione, una richiesta
         in attesa — cosi' si vede il «chiede prima», il cuore del consenso. */
      alfred: {
        cartelle: [{ nome: 'Tesoreria', descrizione: 'soldi e scadenze', conversazioni: 1 },
                   { nome: 'Appunti', descrizione: 'cose da ricordare', conversazioni: 0 }],
        conversazioni: [{ id: 1, titolo: 'Quanto ho sul conto a fine mese?', cartella: 'Tesoreria',
          messaggi: 2, canale: 'app' }],
        in_attesa: [{ id: 1, riassunto: 'Spostare «Assicurazione auto annuale» al 20 del mese prossimo',
          frase: 'spostami l assicurazione auto di qualche giorno', azione: 'movimento_sposta', canale: 'app' }],
        messaggi: [
          { ruolo: 'diego', testo: 'Quanto ho sul conto a fine mese?', quando: giro(0, 24) + 'T18:12:00', canale: 'app', richiesta_id: null },
          { ruolo: 'ada', testo: 'A fine mese il prospetto prevede i due correnti sopra le loro soglie; Fineco pero’ scende sotto 500,00 fra due mesi: la proposta di giroconto è nel riquadro Alimentazione.', quando: giro(0, 24) + 'T18:12:04', canale: 'app', richiesta_id: null }
        ],
        permessi: [
          { azione: 'movimento_sposta', auto: false, richiede_consenso_esplicito: false },
          { azione: 'promemoria_crea', auto: true, richiede_consenso_esplicito: false },
          { azione: 'movimento_cancella', auto: false, richiede_consenso_esplicito: true, consenso_esplicito: false },
          { azione: 'giroconto_crea', auto: false, richiede_consenso_esplicito: true, consenso_esplicito: true,
            consenso_il: giro(-1, 12) + 'T10:00:00', consenso_da: 'pagina Tesoreria' },
          { azione: 'import_conferma', auto: false, richiede_consenso_esplicito: true, consenso_esplicito: false }
        ],
        memoria: [
          { chiave: 'conto_operativo', valore: 'Intesa corrente', origine: 'diego',
            nota: 'quello da cui parte tutto', aggiornata_il: giro(-1, 12) + 'T10:00:00' },
          { chiave: 'aliquota_convenzionale', valore: '25%', origine: 'app',
            nota: 'decisione 8 del 19/09', aggiornata_il: giro(-2, 2) + 'T09:00:00' }
        ]
      },
      journal: [
        { operation_id: 'op-demo-1', op: 'accantonamento_accredita', descrizione: 'giroconto 712,50 al conto tasse', annullata: false },
        { operation_id: 'op-demo-2', op: 'obiettivo_assegna', descrizione: '450,00 a «Fondo emergenze»', annullata: false },
        { operation_id: 'op-demo-3', op: 'budget_imposta', descrizione: 'Tempo libero 120,00 al mese', annullata: false },
        { operation_id: 'op-demo-4', op: 'movimento_sposta', descrizione: 'Esselunga spostata al giorno 11', annullata: true },
        { operation_id: 'op-demo-5', op: 'carta_crea', descrizione: 'Fineco Mastercard, addebito il 10', annullata: false }
      ],
      /* le chiusure mensili dell'accantonamento: il mese scorso e' CHIUSO e
         accreditato, il corrente e' vivo. La fotografia non si riscrive. */
      chiusure: [{ anno: meseSpostato(-1).anno, mese: meseSpostato(-1).mese, chiusa: true,
        chiusa_il: giro(0, 1) + 'T06:00:00', accantonamento_cents: 71250, accreditato: true,
        accredito_stato: 'actual', accredito_cents: 71250, accredito_movimento: 131 }]
    };
  }

  /* ── 3 · PERSISTENZA ─────────────────────────────────────────────────────
        Lo stato vive in localStorage: le modifiche di Diego restano fra un
        giro e l'altro. Se cambia il MESE l'ancora non e' piu' valida (le date
        seminate sono relative) e si riparte: e' una demo, lo si dichiara nel
        LEGGIMI, non si finge che i dati siano eterni. */
  var S = null;
  function carica() {
    try {
      var g = localStorage.getItem(CHIAVE);
      if (g) {
        var d = JSON.parse(g);
        if (d && d.versione === VERSIONE && d.ancora === meseOggi()) return d;
      }
    } catch (e) { /* localStorage non disponibile: si riparte dalla semina */ }
    return SEMINA();
  }
  function salva() {
    try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { /* niente da fare */ }
  }
  S = carica();
  /* LA SEMINA SI SCRIVE SUBITO, non alla prima modifica. Tenendola solo in
     memoria, lo stato non esisteva finche' Diego non toccava qualcosa: il
     bottone «Ricomincia da capo» non aveva niente da azzerare, e due schede
     aperte in due linguette avrebbero potuto divergere. */
  salva();

  /* azzeramento, chiamato dal bottone «Ricomincia da capo» di demo.html */
  window.collaudoAzzera = function () {
    try { localStorage.removeItem(CHIAVE); } catch (e) { /* niente */ }
    S = SEMINA(); salva();
    return true;
  };

  /* ── 4 · IL MOTORINO: cicli carta, addebiti derivati, saldi giornalieri ──
        Un acquisto su carta NON tocca il conto alla sua data: entra nel ciclo
        e scende tutto insieme il giorno dell'addebito. Questa e' l'unica
        regola di calcolo che la demo implementa, e la implementa UNA volta:
        /previsione, /carte, /rischio e /alimentazione la consumano tutti da
        qui, cosi' non possono dire numeri diversi fra loro. */
  function conto(id) { for (var i = 0; i < S.conti.length; i++) if (S.conti[i].id === id) return S.conti[i]; return null; }
  function carta(id) { for (var i = 0; i < S.carte.length; i++) if (S.carte[i].id === id) return S.carte[i]; return null; }

  function cicloDi(k, data) {
    var p = data.split('-').map(Number);
    var chiuso = p[0] * 12 + (p[1] - 1);
    /* oltre il giorno di chiusura l'acquisto appartiene al ciclo successivo */
    if (p[2] > k.giornoChiusura) chiuso += 1;
    var ca = Math.floor(chiuso / 12), cm = (chiuso % 12) + 1;
    /* se l'addebito cade DOPO la chiusura, scende nello stesso mese; se cade
       prima, scende il mese dopo. Niente altra assunzione. */
    var add = (k.giornoAddebito > k.giornoChiusura) ? chiuso : chiuso + 1;
    var aa = Math.floor(add / 12), am = (add % 12) + 1;
    return { ciclo: chiuso,
      chiusura: iso(ca, cm, Math.min(k.giornoChiusura, giorniNelMese(ca, cm))),
      addebito: iso(aa, am, Math.min(k.giornoAddebito, giorniNelMese(aa, am))) };
  }

  /* gli ADDEBITI derivati: uno per (carta, ciclo). Quelli con data <= taglio
     si presumono gia' dentro il saldo verificato e non si ricalcolano. */
  function addebiti(movimenti, taglio) {
    var per = {};
    movimenti.forEach(function (m) {
      if (!m.cartaId || m.stato === 'annullato') return;
      var k = carta(m.cartaId); if (!k) return;
      var c = cicloDi(k, m.data);
      var ch = m.cartaId + '|' + c.ciclo;
      if (!per[ch]) per[ch] = { cartaId: m.cartaId, ciclo: c.ciclo, contoId: k.contoId,
        data: c.addebito, cents: 0, acquisti: [] };
      per[ch].cents += m.cents;
      per[ch].acquisti.push(m);
    });
    return Object.keys(per).map(function (ch) { return per[ch]; })
      .filter(function (e) { return e.data > taglio; })
      .sort(function (x, y) { return x.data < y.data ? -1 : 1; });
  }

  /* le VOCI che toccano il conto: i movimenti non-carta piu' gli addebiti */
  function vociDiCassa(movimenti, taglio) {
    var v = movimenti.filter(function (m) { return !m.cartaId && m.stato !== 'annullato'; })
      .map(function (m) {
        return { id: m.id, dbId: m.dbId, contoId: m.contoId, cents: m.cents, tipo: 'movimento',
          derivato: false, cartaId: null, pairId: m.pairId, data: m.data,
          descrizione: m.descrizione, categoria: m.categoria, sottocategoria: m.sottocategoria,
          stato: m.stato, previstoCents: m.previstoCents, previstoData: m.previstoData,
          dataContabile: m.dataContabile, modificabile: m.stato !== 'rendicontato', lato: m.lato,
          daScenario: m.daScenario === true, scenarioOp: m.scenarioOp || null,
          differenzaId: m.differenzaId || null, ipotesiIgnorata: false };
      });
    addebiti(movimenti, taglio).forEach(function (e) {
      var k = carta(e.cartaId);
      v.push({ id: 'carta-' + e.cartaId + '-' + e.ciclo, dbId: null, contoId: e.contoId,
        cents: e.cents, tipo: 'carta', derivato: true, cartaId: e.cartaId, pairId: null,
        data: e.data, descrizione: 'Addebito ' + (k ? k.nome : e.cartaId),
        categoria: null, sottocategoria: null, stato: 'previsto',
        previstoCents: null, previstoData: null, dataContabile: null,
        modificabile: false, lato: null, daScenario: false, scenarioOp: null,
        differenzaId: null, ipotesiIgnorata: false });
    });
    return v.sort(function (x, y) { return x.data < y.data ? -1 : 1; });
  }

  /* i movimenti in gioco, filtrati per conto e arricchiti dallo scenario.
     Una voce nata in un'ipotesi porta `daScenario`, perche' la pagina deve
     sapere se scrivere nella base o nella differenza. */
  function modello(qs) {
    var taglio = S.conti.reduce(function (x, c) { return c.dataTaglio < x ? c.dataTaglio : x; }, S.conti[0].dataTaglio);
    var conti = S.conti.slice(), carte = S.carte.slice(), mov = S.movimenti.slice();
    var sid = qs.get('scenario_id');
    if (sid) {
      var sc = S.scenari.filter(function (x) { return String(x.id) === String(sid); })[0];
      if (sc) {
        (sc.differenze || []).forEach(function (d) {
          if (d.op !== 'insert' || d.promossa) return;
          mov.push({ id: 'ts' + d.id, dbId: 900000 + d.id, contoId: d.contoId, cartaId: null,
            data: d.data, cents: d.cents, descrizione: d.nome, categoria: null,
            sottocategoria: null, stato: 'previsto', lato: null, pairId: null,
            previstoCents: null, previstoData: null, dataContabile: null,
            daScenario: true, scenarioOp: 'insert', differenzaId: d.id });
        });
      }
    }
    var filtro = (qs.get('conti') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (filtro.length) {
      var ok = {};
      filtro.forEach(function (f) { ok[f] = true; ok['c' + String(f).replace(/^c/, '')] = true; });
      conti = conti.filter(function (c) { return ok[c.id] || ok[String(c.dbId)]; });
      var ids = {}; conti.forEach(function (c) { ids[c.id] = true; });
      carte = carte.filter(function (k) { return ids[k.contoId]; });
      mov = mov.filter(function (m) { return ids[m.contoId]; });
    }
    return { taglio: taglio, conti: conti, carte: carte, movimenti: mov };
  }

  /* la CAMMINATA giorno per giorno. `noto` e' false prima del saldo
     verificato: la' il saldo non e' zero, e' IGNOTO, e si dichiara. */
  function cammina(M, da, a) {
    var voci = vociDiCassa(M.movimenti, M.taglio);
    var saldo = {}, perGiorno = {};
    M.conti.forEach(function (c) { saldo[c.id] = c.saldoTaglioCents; });
    /* tutto cio' che e' successo fra il taglio e l'inizio della finestra */
    voci.forEach(function (v) {
      if (!(v.contoId in saldo)) return;
      if (v.data > M.taglio && v.data < da) saldo[v.contoId] += v.cents;
      if (v.data >= da && v.data <= a) {
        if (!perGiorno[v.data]) perGiorno[v.data] = [];
        perGiorno[v.data].push(v);
      }
    });
    var acquisti = {};
    M.movimenti.forEach(function (m) {
      if (!m.cartaId || m.stato === 'annullato') return;
      if (m.data < da || m.data > a) return;
      if (!acquisti[m.data]) acquisti[m.data] = [];
      acquisti[m.data].push(m);
    });

    var giorni = [], g = da, guardia = 0;
    while (g <= a && guardia < 800) {
      guardia += 1;
      (perGiorno[g] || []).forEach(function (v) {
        if (v.contoId in saldo) saldo[v.contoId] += v.cents;
      });
      var perConto = {}, notoPerConto = {}, totale = 0, noto = true;
      M.conti.forEach(function (c) {
        perConto[c.id] = saldo[c.id];
        var n = g >= c.dataTaglio;
        notoPerConto[c.id] = n;
        if (n) totale += saldo[c.id]; else noto = false;
      });
      giorni.push({ data: g, noto: noto, notoPerConto: notoPerConto, totale: totale,
        perConto: perConto,
        voci: (perGiorno[g] || []).map(function (v) {
          var o = {}; for (var k in v) if (k !== 'data') o[k] = v[k]; return o;
        }),
        acquistiCarta: (acquisti[g] || []).map(function (m) {
          return { id: m.id, dbId: m.dbId, contoId: m.contoId, cartaId: m.cartaId,
            cents: m.cents, descrizione: m.descrizione, categoria: m.categoria,
            sottocategoria: m.sottocategoria, stato: m.stato, toccaSaldo: false,
            modificabile: m.stato !== 'rendicontato', daScenario: false, scenarioOp: null,
            differenzaId: null, ipotesiIgnorata: false,
            nota: 'acquisto su carta: non tocca il conto, entra nell’addebito del ciclo' };
        }) });
      g = piuGiorni(g, 1);
    }
    return giorni;
  }

  /* ── 5 · AIUTI ──────────────────────────────────────────────────────────── */
  function qsDi(url) { return new URL(url, 'https://demo.invalido/').searchParams; }
  function nomeConto(id) { var c = conto(id); return c ? c.nome : null; }
  function nuovoId() { S.prossimoId += 1; return S.prossimoId; }
  function somma(arr, f) { return arr.reduce(function (x, y) { return x + f(y); }, 0); }

  function finestraDi(qs, mesiDefault) {
    var taglio = S.conti[0].dataTaglio;
    var da = qs.get('da') || taglio;
    var a = qs.get('a') || fineMese(piuMesiData(da, mesiDefault == null ? 5 : mesiDefault));
    if (!dataValida(da)) da = taglio;
    if (!dataValida(a) || a < da) a = fineMese(piuMesiData(da, 2));
    return { da: da, a: a };
  }

  /* il percorso giornaliero DI UN CONTO: serve a rischio e alimentazione */
  function percorsoConti(qs) {
    var f = finestraDi(qs, 2);
    var M = modello(qs);
    var giorni = cammina(M, f.da, f.a);
    var conti = M.conti.map(function (c) {
      var percorso = giorni.filter(function (g) { return g.notoPerConto[c.id]; })
        .map(function (g) { return { data: g.data, cents: g.perConto[c.id] }; });
      var min = null;
      percorso.forEach(function (p) { if (!min || p.cents < min.cents) min = { data: p.data, cents: p.cents }; });
      var primo = null;
      for (var i = 0; i < percorso.length; i++) {
        if (percorso[i].cents < c.sogliaCents) { primo = percorso[i].data; break; }
      }
      return { dbId: c.dbId, id: c.id, nome: c.nome, tipo: c.tipo,
        sogliaCents: c.sogliaCents, aRischio: primo != null,
        primoGiornoRischio: primo, minimo: min, percorso: percorso,
        avvisi: (c.avvisiRischio || []) };
    });
    return { da: f.da, a: f.a, conti: conti };
  }

  /* ── 6 · LE RISPOSTE ────────────────────────────────────────────────────── */
  var R = {};   /* GET */
  var W = {};   /* POST */

  R['/anagrafica'] = function () {
    return { conti: S.conti.map(function (c) {
        return { id: c.dbId, nome: c.nome, tipo: c.tipo, attivo: c.attivo,
          saldo_taglio_cents: c.saldoTaglioCents, data_taglio: c.dataTaglio,
          soglia_cents: c.sogliaCents };
      }),
      carte: S.carte.map(function (k) {
        return { id: k.dbId, nome: k.nome, codice: k.codice, conto_id: conto(k.contoId).dbId,
          giorno_addebito: k.giornoAddebito, giorno_chiusura: k.giornoChiusura,
          plafond_cents: k.plafondCents, attiva: k.attivo };
      }),
      categorie: S.categorie, parametri: S.parametri,
      permessi: S.alfred.permessi };
  };

  R['/previsione'] = function (qs) {
    var f = finestraDi(qs, 5);
    var M = modello(qs);
    if (!M.conti.length) return { conti: [], giorni: [], avviso: 'nessun conto configurato' };
    var giorni = cammina(M, f.da, f.a);
    /* il RIEPILOGO del periodo: i giroconti si contano a parte e si escludono,
       altrimenti spostare soldi fra conti propri sembrerebbe un incasso */
    var dentro = [];
    giorni.forEach(function (g) { g.voci.forEach(function (v) { dentro.push(v); }); });
    var ingressi = somma(dentro.filter(function (v) { return !v.pairId && v.cents > 0; }), function (v) { return v.cents; });
    var uscite = -somma(dentro.filter(function (v) { return !v.pairId && v.cents < 0; }), function (v) { return v.cents; });
    var giroconti = -somma(dentro.filter(function (v) { return v.pairId && v.cents < 0; }), function (v) { return v.cents; });
    var noti = giorni.filter(function (g) { return g.noto; });
    var minimo = null;
    noti.forEach(function (g) { if (!minimo || g.totale < minimo.cents) minimo = { data: g.data, cents: g.totale }; });
    var oggi = oggiISO();
    var arretrati = M.movimenti.filter(function (m) {
      return m.stato === 'previsto' && m.data < oggi && m.data >= M.taglio && !m.cartaId; }).length;
    return { taglio: M.taglio, da: f.da, a: f.a,
      conti: M.conti.map(function (c) {
        return { id: c.id, nome: c.nome, tipo: c.tipo, dataTaglio: c.dataTaglio,
          saldoTaglioCents: c.saldoTaglioCents, attivo: c.attivo }; }),
      taglioMin: M.taglio, taglioMax: M.taglio,
      giorni: giorni, minimo: minimo,
      riepilogo: { ingressi: ingressi, uscite: uscite, giroconti: giroconti },
      arretrati: arretrati, arretratiPreTaglio: 0, cicliPreTaglio: [], assunzioni: [] };
  };

  R['/carte'] = function (qs) {
    var al = qs.get('al') || oggiISO();
    if (!dataValida(al)) return { __stato: 400, errore: 'al: la data ' + al + ' non esiste nel calendario' };
    var M = modello(qs);
    var attive = M.carte.filter(function (k) { return k.attivo !== false; });
    var spente = M.carte.filter(function (k) { return k.attivo === false; });
    if (!M.conti.length || !attive.length) {
      return { al: al, carte: [], totali: { speseMeseCents: 0, prossimaLiquidazione: null },
        carteDisattivate: spente.map(function (k) { return { id: k.id, dbId: k.dbId, nome: k.nome }; }),
        avviso: !M.conti.length ? 'nessun conto configurato'
          : (spente.length ? 'nessuna carta attiva' : 'nessuna carta configurata') };
    }
    var eff = addebiti(M.movimenti, M.taglio);
    var mese = al.slice(0, 7);
    var vivi = M.movimenti.filter(function (m) { return m.cartaId && m.stato !== 'annullato'; });
    var carte = attive.map(function (k) {
      var miei = vivi.filter(function (m) { return m.cartaId === k.id; });
      var delMese = miei.filter(function (m) { return m.data.slice(0, 7) === mese; });
      /* la liquidazione PREVISTA successiva: il primo addebito con data >= al */
      var prossimi = eff.filter(function (e) { return e.cartaId === k.id && e.data >= al; });
      var pr = prossimi[0] || null;
      var acq = pr ? pr.acquisti.slice().sort(function (x, y) { return x.data < y.data ? -1 : 1; }) : [];
      return { id: k.id, dbId: k.dbId, nome: k.nome, codice: k.codice || null,
        contoId: k.contoId, conto: nomeConto(k.contoId),
        giornoAddebito: k.giornoAddebito, giornoChiusura: k.giornoChiusura,
        plafondCents: k.plafondCents == null ? null : k.plafondCents,
        assunzioneMeseSolare: k.giornoChiusura == null,
        speseMeseCents: somma(delMese, function (m) { return m.cents; }),
        acquistiMese: delMese.length,
        cicloCorrente: pr ? { ciclo: pr.ciclo, totaleCents: pr.cents, addebitoIl: pr.data,
          acquisti: acq.map(function (m) {
            return { id: m.id, dbId: String(m.dbId), data: m.data, cents: m.cents,
              descrizione: m.descrizione, categoria: m.categoria, stato: m.stato }; }) } : null,
        prossimaLiquidazione: pr ? { data: pr.data, cents: pr.cents, contoId: pr.contoId,
          conto: nomeConto(pr.contoId) } : null };
    });
    /* due carte che addebitano lo STESSO giorno si sommano e si dichiarano
       una per una: mostrare solo la prima nasconderebbe l'altra */
    var liq = carte.map(function (k) {
        return k.prossimaLiquidazione
          ? { data: k.prossimaLiquidazione.data, cents: k.prossimaLiquidazione.cents,
              contoId: k.prossimaLiquidazione.contoId, conto: k.prossimaLiquidazione.conto,
              cartaId: k.id, carta: k.nome } : null; })
      .filter(Boolean).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var stesso = liq.filter(function (x) { return liq.length && x.data === liq[0].data; });
    var prossima = stesso.length ? { data: stesso[0].data,
      cents: somma(stesso, function (x) { return x.cents; }),
      conto: stesso.map(function (x) { return x.conto; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' + '),
      carte: stesso.map(function (x) { return { cartaId: x.cartaId, carta: x.carta, cents: x.cents,
        contoId: x.contoId, conto: x.conto }; }) } : null;
    return { al: al, carte: carte,
      totali: { speseMeseCents: somma(carte, function (k) { return k.speseMeseCents; }),
        prossimaLiquidazione: prossima },
      carteDisattivate: spente.map(function (k) { return { id: k.id, dbId: k.dbId, nome: k.nome }; }),
      assunzioni: [],
      nota: 'gli acquisti su carta vivono qui e nell’addebito del ciclo: non sono spese del conto alla loro data' };
  };

  R['/rischio'] = function (qs) {
    var r = percorsoConti(qs);
    var conti = r.conti.map(function (c) {
      var o = {}; for (var k in c) if (k !== 'percorso') o[k] = c[k]; return o; });
    return { da: r.da, a: r.a, conti: conti,
      contiARischio: conti.filter(function (c) { return c.aRischio; }).length,
      anticipoDefaultGiorni: 5,
      nota: 'sotto la soglia (stretto) il conto è a rischio: il promemoria nasce da ' +
        'POST /rischio/genera, idempotente per conto e giorno — non da un orologio' };
  };

  R['/alimentazione'] = function (qs) {
    var cfg = S.alimentazione;
    if (!cfg || !cfg.configurata) {
      return { configurata: false, motivo: (cfg && cfg.motivo) || 'Regola da concordare: ' +
        'senza conti, soglia e livello obiettivo non si propone niente' };
    }
    var r = percorsoConti(qs);
    var alim = r.conti.filter(function (c) { return c.dbId === cfg.conto_alimentato_id; })[0];
    var fuori = { configurata: true, conto_sorgente_id: cfg.conto_sorgente_id,
      conto_sorgente: cfg.conto_sorgente, conto_alimentato_id: cfg.conto_alimentato_id,
      conto_alimentato: cfg.conto_alimentato, soglia_cents: cfg.soglia_cents,
      livello_obiettivo_cents: cfg.livello_obiettivo_cents,
      impronta: [cfg.conto_sorgente_id, cfg.conto_alimentato_id, cfg.soglia_cents,
                 cfg.livello_obiettivo_cents].join(':'),
      da: r.da, a: r.a };
    if (!alim) {
      fuori.proposta = null;
      fuori.avviso = 'il conto alimentato non compare nella previsione: niente da proporre';
      return fuori;
    }
    var proposta = null;
    for (var i = 0; i < alim.percorso.length; i++) {
      if (alim.percorso[i].cents < cfg.soglia_cents) {
        proposta = { giorno: alim.percorso[i].data, saldoPrevistoCents: alim.percorso[i].cents,
          importoCents: cfg.livello_obiettivo_cents - alim.percorso[i].cents,
          contoSorgenteId: cfg.conto_sorgente_id, contoSorgente: cfg.conto_sorgente,
          contoAlimentatoId: cfg.conto_alimentato_id, contoAlimentato: cfg.conto_alimentato };
        break;
      }
    }
    fuori.proposta = proposta;
    fuori.nota = proposta
      ? 'PROPOSTA, non eseguita: il giroconto lo crea solo il bottone, con journal e annullo'
      : 'nel periodo il conto alimentato resta sopra la sua soglia: niente da proporre';
    return fuori;
  };

  R['/obiettivi'] = function () {
    var M = modello(new URLSearchParams(''));
    /* il saldo del salvadanaio e' quello A FINE PREVISIONE: anche un prelievo
       previsto lontano riduce gia' l'assegnabile, e la pagina lo dichiara */
    var a = fineMese(piuMesiData(oggiISO(), 11));
    var giorni = cammina(M, M.taglio, a);
    var ultimo = giorni[giorni.length - 1] || { perConto: {} };
    var sal = S.conti.filter(function (c) { return c.tipo === 'salvadanaio'; }).map(function (c) {
      var oo = S.obiettivi.filter(function (o) { return o.contoId === c.id; });
      var saldo = ultimo.perConto[c.id] == null ? c.saldoTaglioCents : ultimo.perConto[c.id];
      var assegnato = somma(oo, function (o) { return o.assegnato_cents; });
      return { conto_id: c.dbId, nome: c.nome, saldo_cents: saldo,
        assegnato_cents: assegnato, non_assegnato_cents: saldo - assegnato,
        obiettivi: oo.map(function (o) {
          var bp = o.traguardo_cents ? Math.round(o.assegnato_cents * 10000 / o.traguardo_cents) : null;
          return { id: o.id, nome: o.nome, traguardo_cents: o.traguardo_cents,
            assegnato_cents: o.assegnato_cents, progresso_bp: bp,
            raggiunto: o.traguardo_cents != null && o.assegnato_cents >= o.traguardo_cents,
            note: o.note || '' }; }) };
    });
    return { salvadanai: sal, saldo_riferimento: 'fine previsione',
      nota: 'assegnato + non assegnato = saldo del salvadanaio, sempre' };
  };

  R['/budget'] = function (qs) {
    var anno = Number(qs.get('anno') || oggiISO().slice(0, 4));
    var mese = Number(qs.get('mese') || Number(oggiISO().slice(5, 7)));
    var pref = anno + '-' + pad(mese);
    var righe = S.budget.map(function (b) {
      /* lo SPESO si LEGGE dai movimenti, non lo scrive nessuno. Gli acquisti
         su carta contano nel budget alla LORO data: e' la spesa di Diego,
         anche se il conto scende dopo. */
      var suoi = S.movimenti.filter(function (m) {
        return m.categoria === b.categoria && m.data.slice(0, 7) === pref &&
          m.cents < 0 && m.stato !== 'annullato'; });
      var speso = -somma(suoi.filter(function (m) { return m.stato === 'rendicontato'; }), function (m) { return m.cents; });
      var previsto = -somma(suoi.filter(function (m) { return m.stato !== 'rendicontato'; }), function (m) { return m.cents; });
      return { categoria_id: b.categoria_id, categoria: b.categoria,
        capienza_cents: b.capienza_cents, speso_cents: speso, previsto_cents: previsto,
        residuo_cents: b.capienza_cents - speso - previsto,
        oltre: (speso + previsto) > b.capienza_cents };
    });
    return { anno: anno, mese: mese, budget: righe,
      nota: 'lo speso è letto dai movimenti del mese, gli acquisti su carta alla loro data: ' +
        'la pagina non scrive nessuno di questi numeri' };
  };

  R['/impegni'] = function (qs) {
    var f = finestraDi(qs, 2);
    var M = modello(qs);
    var ids = {}; M.conti.forEach(function (c) { ids[c.id] = true; });
    var voci = [];
    S.finanziamenti.filter(function (x) { return ids[x.contoId]; }).forEach(function (x) {
      var rate = M.movimenti.filter(function (m) {
        return m.descrizione === x.nome && m.data >= f.da && m.data <= f.a; });
      var fut = M.movimenti.filter(function (m) { return m.descrizione === x.nome && m.data >= oggiISO(); })
        .sort(function (p, q) { return p.data < q.data ? -1 : 1; });
      voci.push({ chiave: 'f' + x.id, nome: x.nome, tipo: 'finanziamento',
        conto: nomeConto(x.contoId), prossima_scadenza: fut.length ? fut[0].data : null,
        totale_periodo_cents: somma(rate, function (m) { return m.cents; }), stimato: false,
        serie: null,
        finanziamento: { id: x.id, rata_cents: x.rata_cents, frequenza: x.frequenza,
          tipo_piano: x.tipo_piano, capitale_cents: x.capitale_cents,
          residuo_capitale_cents: x.capitale_cents == null ? null
            : Math.max(0, x.capitale_cents - Math.round(x.capitale_cents * x.rate_pagate / x.rate_totali)),
          interessi_totali_cents: x.tan_bp == null ? null
            : Math.abs(x.rata_cents) * x.rate_totali - x.capitale_cents,
          tan_bp: x.tan_bp, taeg_bp: x.taeg_bp,
          somma_rate_cents: Math.abs(x.rata_cents) * x.rate_totali,
          spese_per_rata_cents: x.spese_per_rata_cents, rate_totali: x.rate_totali,
          rate_pagate: x.rate_pagate, rate_parziali: x.rate_parziali,
          completezza: x.completezza, erogazione: x.erogazione,
          spese_iniziali_cents: x.spese_iniziali_cents, spese_iniziali_data: x.spese_iniziali_data,
          nota_parziali: x.rate_parziali ? 'una rata è stata pagata in parte: resta aperto il residuo' : null,
          nota_tan_taeg: x.tan_bp == null
            ? 'senza TAN gli interessi non si calcolano: questa è una sequenza di pagamenti nota'
            : 'TAN dichiarato da te; il TAEG è quello del contratto, non ricalcolato qui' } });
    });
    S.serie.filter(function (x) { return ids[x.contoId]; }).forEach(function (x) {
      var righe = M.movimenti.filter(function (m) {
        return m.descrizione === x.nome && m.data >= f.da && m.data <= f.a; });
      var fut = M.movimenti.filter(function (m) { return m.descrizione === x.nome && m.data >= oggiISO(); })
        .sort(function (p, q) { return p.data < q.data ? -1 : 1; });
      voci.push({ chiave: 's' + x.id, nome: x.nome, tipo: x.tipo, conto: nomeConto(x.contoId),
        prossima_scadenza: fut.length ? fut[0].data : null,
        totale_periodo_cents: somma(righe, function (m) { return m.cents; }),
        stimato: x.stimato, finanziamento: null,
        serie: { id: x.id, importo_cents: x.importo_cents, frequenza: x.frequenza,
          giorno: x.giorno, fine: x.fine, stimato: x.stimato } });
    });
    var perTipo = {};
    voci.forEach(function (v) { perTipo[v.tipo] = (perTipo[v.tipo] || 0) + v.totale_periodo_cents; });
    /* i MESI: le stesse righe delle colonne, raggruppate diversamente. Non una
       seconda query che potrebbe divergere. */
    var mesi = [], i0 = indiceMese(f.da), i1 = indiceMese(f.a);
    for (var i = i0; i <= i1; i++) {
      var aa = Math.floor(i / 12), mm = (i % 12) + 1, pref = aa + '-' + pad(mm);
      var dentro = {}, tot = 0;
      voci.forEach(function (v) {
        var nome = v.nome;
        var righe = M.movimenti.filter(function (m) {
          return m.descrizione === nome && m.data.slice(0, 7) === pref &&
            m.data >= f.da && m.data <= f.a; });
        var c = somma(righe, function (m) { return m.cents; });
        if (c) { dentro[v.tipo] = (dentro[v.tipo] || 0) + c; tot += c; }
      });
      mesi.push({ mese: pref, totale_cents: tot, per_tipo: dentro });
    }
    return { finestra: f, voci: voci,
      totali: { voci: voci.length, totale_cents: somma(voci, function (v) { return v.totale_periodo_cents; }),
        per_tipo: perTipo },
      mesi: mesi, righe_usate: somma(voci, function () { return 1; }) +
        M.movimenti.filter(function (m) { return m.data >= f.da && m.data <= f.a; }).length };
  };

  R['/attivo'] = function (qs) {
    var anni = (qs.get('anni') || '').split(',').map(function (x) { return Number(x.trim()); })
      .filter(function (x) { return x > 1900; });
    if (!anni.length) anni = [new Date().getFullYear() - 1, new Date().getFullYear()];
    var dentro = S.entrate.filter(function (e) {
      var y = Number((e.emessa_il || e.attesa_il || '').slice(0, 4));
      return anni.indexOf(y) >= 0; });
    var da = Number(qs.get('da_riga') || 0), limite = Number(qs.get('limite') || 50);
    var conf = [];
    anni.forEach(function (y) {
      ['fattura', 'fuori_piva'].forEach(function (t) {
        var r = dentro.filter(function (e) {
          return e.tipo === t && Number((e.emessa_il || e.attesa_il || '').slice(0, 4)) === y; });
        if (!r.length) return;
        conf.push({ anno: y, tipo: t,
          fatturato_cents: somma(r, function (e) { return e.importo_cents; }),
          fatturato_provvisorio_cents: somma(r.filter(function (e) { return !e.emessa_il; }), function (e) { return e.importo_cents; }),
          fatturato_certo_cents: somma(r.filter(function (e) { return !!e.emessa_il; }), function (e) { return e.importo_cents; }),
          atteso_cents: somma(r.filter(function (e) { return e.stato === 'attesa'; }), function (e) { return e.importo_cents; }),
          incassato_cents: somma(r, function (e) { return e.incassato_cents; }) });
      });
    });
    return { anni: anni, confronto_anni: conf,
      entrate: dentro.slice(da, da + limite).map(function (e) {
        var o = {}; for (var k in e) o[k] = e[k];
        o.in_previsione = !!e.attesa_il;
        o.senza_data_emissione = !e.emessa_il;
        return o; }),
      entrate_totali: dentro.length, limite: limite,
      da_definire: dentro.filter(function (e) { return e.rilevanza_fiscale === 'da_definire'; }).length,
      nota_fuori_piva: 'fuori partita IVA non vuol dire esente: finché non lo dici, resta da definire',
      nota_anni: 'fatturato, atteso e incassato sono tre numeri diversi e restano diversi',
      nota_fatturato: 'una entrata senza data di emissione conta come fatturato PROVVISORIO',
      nota_elenco: 'l’elenco si carica a blocchi: niente sparisce dopo la cinquantesima' };
  };

  R['/attivo/riserva'] = function (qs) {
    var al = qs.get('al') || oggiISO();
    if (!dataValida(al)) return { __stato: 400, errore: 'al: la data ' + al + ' non esiste nel calendario' };
    var M = modello(qs);
    var dentro = M.conti.filter(function (c) {
      return c.attivo === true && ['corrente', 'prepagata', 'salvadanaio', 'tasse'].indexOf(c.tipo) >= 0; });
    if (!dentro.length) return { al: al, componenti: [], totale_cents: null, avviso: 'nessun conto configurato' };
    var esclusi = { carte: 'il plafond di una carta non è denaro disponibile',
      conti_chiusi: 'i conti non attivi restano fuori' };
    if (al < M.taglio) {
      return { al: al, componenti: dentro.map(function (c) {
          return { conto_id: c.dbId, nome: c.nome, tipo: c.tipo, cents: null, noto: false,
            dataTaglio: c.dataTaglio }; }),
        totale_cents: null, conti_non_noti: dentro.map(function (c) { return c.nome; }),
        esclusi: esclusi,
        nota: 'prima del ' + M.taglio + ' il saldo non è ricostruito: non è zero, è ignoto' };
    }
    var giorni = cammina(M, M.taglio, al);
    var ultimo = giorni[giorni.length - 1] || { perConto: {}, notoPerConto: {} };
    var comp = dentro.map(function (c) {
      return { conto_id: c.dbId, nome: c.nome, tipo: c.tipo,
        cents: ultimo.perConto[c.id] == null ? null : ultimo.perConto[c.id],
        noto: ultimo.notoPerConto[c.id] === true, dataTaglio: c.dataTaglio }; });
    var ignoti = comp.filter(function (c) { return !c.noto; });
    return { al: al, componenti: comp,
      totale_cents: ignoti.length ? null : somma(comp, function (c) { return c.cents || 0; }),
      conti_non_noti: ignoti.map(function (c) { return c.nome; }), esclusi: esclusi,
      nota: 'patrimonio alla data indicata, ogni conto una volta sola: non è l’incasso ' +
        'del periodo né denaro libero da impegni' };
  };

  /* ── TASSE CONVENZIONALI: il 25% dichiarato, non un calcolo fiscale ──── */
  function incassiFatturaDi(anno, mese) {
    var pref = anno + '-' + pad(mese);
    return somma(S.movimenti.filter(function (m) {
      return m.categoria === 'Entrate' && m.cents > 0 && m.stato === 'rendicontato' &&
        m.data.slice(0, 7) === pref; }), function (m) { return m.cents; });
  }
  function meseConv(anno, mese) {
    var inc = incassiFatturaDi(anno, mese);
    return { anno: anno, mese: mese, incassi_fattura_cents: inc, aliquota_bp: 2500,
      accantonamento_cents: Math.round(inc * 2500 / 10000),
      rettifiche: [], rettifiche_cents: 0 };
  }
  R['/tasse/convenzionale'] = function () {
    var oggi = oggiISO();
    var anno = Number(oggi.slice(0, 4)), mese = Number(oggi.slice(5, 7));
    var prec = meseSpostato(-1);
    var ch = S.chiusure.filter(function (c) { return c.anno === prec.anno && c.mese === prec.mese; })[0];
    if (!ch) {
      ch = { anno: prec.anno, mese: prec.mese, chiusa: false, accantonamento_cents: null,
        accreditato: false, accreditabile: false,
        motivo_blocco: 'il mese non è ancora chiuso: prima si fotografa, poi si accredita' };
    }
    return { aliquota_bp: 2500, aliquota_valido_da: anno + '-01-01',
      giorno_convenzione: 'ultimo giorno del mese',
      mese: meseConv(anno, mese),
      chiusura: ch,
      prossime_scadenze: [
        { tipo: 'acconto_novembre', data: iso(anno, 11, 30), anno_riferimento: anno,
          etichetta: 'ipotesi, modificabile' },
        { tipo: 'saldo_e_primo_acconto', data: iso(anno + 1, 6, 30), anno_riferimento: anno,
          etichetta: 'ipotesi, modificabile' },
        { tipo: 'acconto_novembre', data: iso(anno + 1, 11, 30), anno_riferimento: anno + 1,
          etichetta: 'ipotesi, modificabile' }
      ],
      motore_legale: 'il motore fiscale legale è SUPERATO per questa consegna: resta consultabile ' +
        'nella scheda sotto, ma l’accantonamento operativo è questo 25% convenzionale',
      nota: 'decisioni 8-9 del 19/09: aliquota e calendario sono IPOTESI dichiarate, modificabili' };
  };
  R['/tasse/convenzionale/mese'] = function (qs) {
    return meseConv(Number(qs.get('anno') || oggiISO().slice(0, 4)),
      Number(qs.get('mese') || Number(oggiISO().slice(5, 7))));
  };
  R['/tasse/convenzionale/anno'] = function (qs) {
    var anno = Number(qs.get('anno') || oggiISO().slice(0, 4)), mesi = [];
    for (var i = 1; i <= 12; i++) mesi.push(meseConv(anno, i));
    return { anno: anno, mesi: mesi,
      accantonamento_cents: somma(mesi, function (x) { return x.accantonamento_cents; }) };
  };
  R['/tasse/convenzionale/scadenze'] = function () { return R['/tasse/convenzionale']().prossime_scadenze; };
  R['/tasse/convenzionale/aliquote'] = function () {
    return [{ aliquota_bp: 2500, valido_da: oggiISO().slice(0, 4) + '-01-01',
      nota: 'convenzionale, concordata con Diego' }];
  };

  /* ── FISCO legale: SUPERATO, e si dichiara. Non si inventa un importo. ── */
  R['/fisco/copertura'] = function () {
    var ct = S.conti.filter(function (c) { return c.tipo === 'tasse'; })[0];
    if (!ct) return { conto_tasse: null, avviso: 'nessun conto tasse configurato' };
    var M = modello(new URLSearchParams(''));
    var giorni = cammina(M, M.taglio, oggiISO());
    var ultimo = giorni[giorni.length - 1] || { perConto: {} };
    var saldo = ultimo.perConto[ct.id] == null ? ct.saldoTaglioCents : ultimo.perConto[ct.id];
    var dovuti = [{ anno_imposta: new Date().getFullYear() - 1, tipo: 'acconto',
      dovuto_cents: 215000, scadenza: giro(1, 30), rate: 1,
      fonte: 'registrato a mano da Diego sulla delega F24' }];
    var aperto = somma(dovuti, function (d) { return d.dovuto_cents; });
    return { conto_tasse: ct.dbId, saldo_verificato_cents: saldo, data_saldo: oggiISO(),
      dovuto_aperto_cents: aperto, differenza_cents: saldo - aperto, dovuti: dovuti,
      nota: 'il dovuto sono le scadenze REGISTRATE: quelle non registrate non compaiono, ' +
        'e non vengono indovinate' };
  };
  R['/fisco/calcolo'] = function (qs) {
    var anno = Number(qs.get('anno') || new Date().getFullYear() - 1);
    return { anno: anno, calcolabile: false,
      perche: 'il motore fiscale legale è SUPERATO per questa consegna, e i parametri che ' +
        'servirebbero restano «da decidere con te»: un importo fiscale plausibile è più ' +
        'pericoloso di un importo assente',
      manca: ['il regime fiscale', 'il codice ATECO e il suo coefficiente',
        'quale dei due casi previdenziali è il tuo'],
      base: { anno: anno, incassato_imponibile_cents: 1245000, incassato_escluso_cents: 48000,
        entrate_da_definire: 1,
        criterio: 'per cassa: conta quello che è arrivato davvero, non quello fatturato',
        avviso: 'una entrata fuori partita IVA con rilevanza da definire resta fuori dall’imponibile' },
      alternative_previdenza: [] };
  };
  R['/fisco/scadenze'] = function (qs) {
    var anno = Number(qs.get('anno') || new Date().getFullYear() - 1);
    return { anno: anno, scadenze: [
        { tipo: 'saldo e primo acconto', data: iso(anno + 1, 6, 30),
          ambito: 'persone fisiche con partita IVA', ti_riguarda: null, fonte: null, proiezione: false },
        { tipo: 'secondo acconto', data: iso(anno + 1, 11, 30),
          ambito: 'persone fisiche con partita IVA', ti_riguarda: null, fonte: null, proiezione: true }
      ],
      avviso: 'nella DEMO non c’è nessuna fonte normativa letta: le righe qui sopra sono ' +
        'segnaposto, non date verificate',
      nota: 'nessuna scadenza viene inventata: «ti riguarda» resta da decidere con te' };
  };
  R['/fisco/fonti'] = function () { return []; };
  R['/fisco/base'] = function (qs) { return R['/fisco/calcolo'](qs).base; };
  R['/fisco/base-prevista'] = function (qs) { return R['/fisco/calcolo'](qs).base; };
  R['/fisco/aliquota'] = function () { return { aliquota_bp: null, fonte: null, avviso: 'nessuna fonte letta nella demo' }; };
  R['/fisco/contributi'] = function () { return { versati_cents: null, dedotti_cents: null, avviso: 'nessun dato nella demo' }; };
  R['/fisco/saldo-acconti'] = function () { return { saldo_cents: null, acconti: [], avviso: 'nessun dato nella demo' }; };
  R['/fisco/regole'] = function () { return []; };
  R['/fisco/previsione'] = function () { return { anni: [], avviso: 'previsione decennale non disponibile nella demo' }; };

  R['/promemoria'] = function () {
    var oggi = oggiISO();
    var STATI = { app: true, telegram: false };
    return { promemoria: S.promemoria.map(function (p) {
        var quando = String(p.quando).slice(0, 10);
        var avviso = piuGiorni(quando, -(p.anticipo_giorni || 0));
        var canali = String(p.canali).split(',');
        return { id: p.id, titolo: p.titolo, entita: p.entita, entita_id: p.entita_id,
          quando: p.quando, prossimo_avviso: avviso + 'T09:00:00.000Z',
          anticipo_giorni: p.anticipo_giorni, ricorrenza: p.ricorrenza, canali: p.canali,
          canali_non_collegati: canali.filter(function (c) { return !STATI[c]; }),
          stato: p.stato, tentativi: p.tentativi || [], attivo: p.attivo,
          in_ritardo: p.attivo && quando < oggi && p.stato !== 'consegna_osservata',
          /* niente in attesa di ack: la demo non finge una consegna osservata */
          in_attesa_di_ack: [] };
      }),
      canali: [{ nome: 'app', descrizione: 'questa pagina', collegato: true },
        { nome: 'telegram', descrizione: 'il bot di Ada', collegato: false }],
      nota_stati: 'per un canale non collegato il promemoria resta PROGRAMMATO: nessuna ' +
        'consegna è stata osservata, e non si dichiara il contrario' };
  };

  R['/scenari'] = function () {
    return S.scenari.map(function (s) {
      var d = s.differenze || [];
      return { id: s.id, nome: s.nome, nota: s.nota,
        differenze_aperte: d.filter(function (x) { return !x.promossa; }).length,
        promosse: d.filter(function (x) { return x.promossa; }).length,
        conflitti: d.filter(function (x) { return x.conflitto; }).length };
    });
  };

  R['/journal'] = function (qs) {
    var n = Number(qs.get('quanti') || 20);
    return S.journal.slice(0, n);
  };
  R['/inbox/righe'] = function () {
    /* nessun estratto caricato: la demo non inventa righe bancarie, che sono
       fatti immutabili. L'import vero e' fuori dalla demo, e si dichiara. */
    return [];
  };
  R['/ingest/aperti'] = function () { return []; };

  R['/alfred'] = function (qs) {
    var a = S.alfred;
    var cid = qs.get('conversazione_id');
    var msg = cid ? a.messaggi.filter(function (m) { return true; }) : a.messaggi;
    return { cartelle: a.cartelle, conversazioni: a.conversazioni, in_attesa: a.in_attesa,
      messaggi: msg, permessi: a.permessi, memoria: a.memoria,
      nota_memoria: 'quello che Ada sa di Tesoreria, in chiaro e con la provenienza: ' +
        'si corregge da qui, e ogni correzione passa dallo storico' };
  };

  /* ── 7 · LE SCRITTURE. Quello che la demo sa fare DAVVERO si scrive in
        localStorage e si rilegge; quello che non sa fare lo DICE, con un
        errore spiegato — meglio un rifiuto chiaro di un falso successo. ── */
  function nonInDemo(cosa) {
    return { __stato: 501, errore: 'nella DEMO ' + cosa + ' non è disponibile: ' +
      'serve il backend vero. Tutto il resto della pagina funziona.' };
  }

  W['/obiettivi'] = function (qs, corpo) {
    var c = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_id); })[0];
    if (!c) return { __stato: 400, errore: 'conto non trovato' };
    var o = { id: nuovoId(), contoId: c.id, nome: String(corpo.nome || '').trim(),
      traguardo_cents: corpo.traguardo_cents == null ? null : Number(corpo.traguardo_cents),
      assegnato_cents: 0, note: corpo.note || '' };
    S.obiettivi.push(o);
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'obiettivo_crea',
      descrizione: 'obiettivo «' + o.nome + '»', annullata: false });
    salva();
    return { id: o.id, nome: o.nome, traguardo_cents: o.traguardo_cents,
      nota: 'nasce senza quota assegnata: il salvadanaio non cambia' };
  };
  function quota(id, verso, corpo) {
    var o = S.obiettivi.filter(function (x) { return x.id === Number(id); })[0];
    if (!o) return { __stato: 404, errore: 'obiettivo non trovato' };
    var c = Number(corpo.importo_cents);
    var vista = R['/obiettivi']().salvadanai.filter(function (s) {
      return s.conto_id === conto(o.contoId).dbId; })[0] || { non_assegnato_cents: 0 };
    if (verso === 'assegna' && c > vista.non_assegnato_cents) {
      return { __stato: 409, errore: 'nel salvadanaio non assegnato ci sono solo ' +
        (vista.non_assegnato_cents / 100).toFixed(2) + ': assegnato + non assegnato = saldo, sempre' };
    }
    if (verso === 'togli' && c > o.assegnato_cents) {
      return { __stato: 409, errore: 'a questo obiettivo sono assegnati meno di così' };
    }
    o.assegnato_cents += (verso === 'assegna' ? c : -c);
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'obiettivo_' + verso,
      descrizione: (c / 100).toFixed(2) + ' su «' + o.nome + '»', annullata: false });
    salva();
    var dopo = R['/obiettivi']().salvadanai.filter(function (s) {
      return s.conto_id === conto(o.contoId).dbId; })[0];
    return { cents: c, nome: o.nome, assegnato_cents: o.assegnato_cents,
      non_assegnato_cents: dopo.non_assegnato_cents,
      nota: 'la riserva totale non è cambiata: si è solo spostata l’etichetta' };
  }
  W['/budget'] = function (qs, corpo) {
    var cat = S.categorie.filter(function (c) { return c.id === Number(corpo.categoria_id); })[0];
    if (!cat) return { __stato: 400, errore: 'categoria non trovata' };
    var b = S.budget.filter(function (x) { return x.categoria_id === cat.id; })[0];
    if (b) { b.capienza_cents = Number(corpo.capienza_cents); b.valido_da = corpo.valido_da; }
    else S.budget.push({ categoria_id: cat.id, categoria: cat.nome,
      capienza_cents: Number(corpo.capienza_cents), valido_da: corpo.valido_da });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'budget_imposta',
      descrizione: cat.nome + ' ' + (Number(corpo.capienza_cents) / 100).toFixed(2) + ' al mese',
      annullata: false });
    salva();
    return { categoria: cat.nome, capienza_cents: Number(corpo.capienza_cents),
      valido_da: corpo.valido_da,
      nota: 'vale dal mese indicato in avanti: i mesi passati non si riscrivono' };
  };
  W['/promemoria'] = function (qs, corpo) {
    var p = { id: nuovoId(), titolo: String(corpo.titolo || '').trim(),
      entita: corpo.entita || 'generico', entita_id: corpo.entita_id || null,
      quando: corpo.quando, anticipo_giorni: Number(corpo.anticipo_giorni || 0),
      ricorrenza: corpo.ricorrenza || 'nessuna', canali: corpo.canali || 'app',
      stato: 'programmato', attivo: true, tentativi: [] };
    S.promemoria.push(p);
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'promemoria_crea',
      descrizione: p.titolo, annullata: false });
    salva();
    var scollegati = String(p.canali).split(',').filter(function (c) { return c !== 'app'; });
    return { id: p.id, avviso: 'Programmato.' + (scollegati.length
      ? ' Attenzione: ' + scollegati.join(', ') + ' non è collegato, su quel canale resta ' +
        'PROGRAMMATO e nessuna consegna sarà osservata.' : '') };
  };
  W['/alimentazione/config'] = function (qs, corpo) {
    var s = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_sorgente_id); })[0];
    var a = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_alimentato_id); })[0];
    if (!s || !a) return { __stato: 400, errore: 'conto sorgente o alimentato non trovato' };
    if (s.id === a.id) return { __stato: 400, errore: 'sorgente e alimentato non possono essere lo stesso conto' };
    S.alimentazione = { configurata: true, conto_sorgente_id: s.dbId, conto_sorgente: s.nome,
      conto_alimentato_id: a.dbId, conto_alimentato: a.nome,
      soglia_cents: Number(corpo.soglia_cents), livello_obiettivo_cents: Number(corpo.livello_obiettivo_cents) };
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'alimentazione_config',
      descrizione: s.nome + ' alimenta ' + a.nome, annullata: false });
    salva();
    return { nota: 'regola salvata: la rilettura è quella scritta' };
  };
  W['/alimentazione/giroconto'] = function (qs, corpo) {
    var cfg = S.alimentazione;
    if (!cfg || !cfg.configurata) return { __stato: 409, errore: 'regola non configurata' };
    var impronta = [cfg.conto_sorgente_id, cfg.conto_alimentato_id, cfg.soglia_cents,
      cfg.livello_obiettivo_cents].join(':');
    /* se la regola e' cambiata fra la vista e il click, si RIFIUTA e si
       spiega: applicare in silenzio una regola che nessuno ha visto e' peggio */
    if (corpo.config_impronta && corpo.config_impronta !== impronta) {
      return { __stato: 409, errore: 'la regola è cambiata dopo che hai visto la proposta: ' +
        'rileggi il riquadro e decidi sulla regola attuale' };
    }
    var cents = Number(corpo.importo_cents), data = corpo.data;
    if (!dataValida(data)) return { __stato: 400, errore: 'data non valida' };
    var p = 'g-alim-manuale-' + nuovoId();
    var s = S.conti.filter(function (x) { return x.dbId === cfg.conto_sorgente_id; })[0];
    var a = S.conti.filter(function (x) { return x.dbId === cfg.conto_alimentato_id; })[0];
    var i1 = nuovoId(), i2 = nuovoId();
    S.movimenti.push({ id: 't' + i1, dbId: i1, contoId: s.id, cartaId: null, data: data,
      cents: -cents, descrizione: 'Giroconto a ' + a.nome, categoria: 'Giroconti',
      sottocategoria: null, stato: 'previsto', lato: 'uscita', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    S.movimenti.push({ id: 't' + i2, dbId: i2, contoId: a.id, cartaId: null, data: data,
      cents: cents, descrizione: 'Giroconto da ' + s.nome, categoria: 'Giroconti',
      sottocategoria: null, stato: 'previsto', lato: 'ingresso', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'alimentazione_giroconto',
      descrizione: (cents / 100).toFixed(2) + ' da ' + s.nome + ' a ' + a.nome, annullata: false });
    salva();
    return { movimento: i2, cents: cents, data: data, stato: 'planned' };
  };
  W['/rischio/genera'] = function (qs, corpo) {
    var r = percorsoConti(new URLSearchParams(
      'da=' + (corpo.da || oggiISO()) + '&a=' + (corpo.a || fineMese(piuMesiData(oggiISO(), 2))) +
      (corpo.conti ? '&conti=' + encodeURIComponent(corpo.conti) : '')));
    var generati = [], gia = [];
    r.conti.filter(function (c) { return c.aRischio; }).forEach(function (c) {
      var titolo = c.nome + ' sotto soglia il ' + c.primoGiornoRischio;
      /* IDEMPOTENTE per conto e giorno: ripetere il bottone non duplica */
      var esiste = S.promemoria.filter(function (p) { return p.titolo === titolo; })[0];
      if (esiste) { gia.push(c.nome); return; }
      var p = { id: nuovoId(), titolo: titolo, entita: 'conto', entita_id: c.dbId,
        quando: c.primoGiornoRischio + 'T09:00:00.000Z', anticipo_giorni: 5,
        ricorrenza: 'nessuna', canali: 'app', stato: 'programmato', attivo: true, tentativi: [] };
      S.promemoria.push(p);
      var cc = conto(c.id);
      cc.avvisiRischio = (cc.avvisiRischio || []).concat([
        { giorno: c.primoGiornoRischio, promemoria_stato: 'programmato' }]);
      generati.push(c.nome);
    });
    S.journal.unshift({ operation_id: corpo.operation_id || ('op-rischio-' + nuovoId()),
      op: 'rischio_genera', descrizione: generati.length + ' promemoria di rischio', annullata: false });
    salva();
    return { generati: generati, gia: gia };
  };
  W['/rischio/soglia'] = function (qs, corpo) {
    var c = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_id); })[0];
    if (!c) return { __stato: 404, errore: 'conto non trovato' };
    c.sogliaCents = Number(corpo.soglia_cents); salva();
    return { conto: c.nome, soglia_cents: c.sogliaCents };
  };
  W['/movimenti/modifica'] = function (qs, corpo) {
    var m = S.movimenti.filter(function (x) { return x.dbId === Number(corpo.id); })[0];
    if (!m) return { __stato: 404, errore: 'movimento non trovato' };
    if (m.stato === 'rendicontato') return { __stato: 409,
      errore: 'un fatto rendicontato non si riscrive: è avvenuto' };
    var p = corpo.patch || {};
    if (p.amount_cents != null) m.cents = Number(p.amount_cents);
    if (p.date) { if (!dataValida(p.date)) return { __stato: 400, errore: 'data non valida' }; m.data = p.date; }
    if (p.account_id != null) {
      var c = S.conti.filter(function (x) { return x.dbId === Number(p.account_id); })[0];
      if (!c) return { __stato: 400, errore: 'conto non trovato' };
      m.contoId = c.id;
    }
    if ('category_id' in p) {
      var cat = S.categorie.filter(function (x) { return x.id === Number(p.category_id); })[0];
      m.categoria = cat ? cat.nome : null;
      var sub = cat && (cat.sotto || []).filter(function (x) { return x.id === Number(p.subcategory_id); })[0];
      m.sottocategoria = sub ? sub.nome : null;
    }
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'movimento_modifica',
      descrizione: m.descrizione, annullata: false });
    salva();
    return { id: m.dbId, mosse: 1 };
  };
  W['/movimenti/sposta'] = function (qs, corpo) {
    var ids = (corpo.ids || []).map(Number);
    var trovati = S.movimenti.filter(function (m) { return ids.indexOf(m.dbId) >= 0; });
    if (trovati.length !== ids.length) return { __stato: 404, errore: 'una delle voci non esiste' };
    var bloccate = trovati.filter(function (m) { return m.stato === 'rendicontato'; });
    /* ATOMICO: se una non si puo' muovere, non si muove NIENTE */
    if (bloccate.length) return { __stato: 409,
      errore: bloccate.length + ' voci sono rendicontate: nessuna spostata' };
    var lati = 0;
    trovati.forEach(function (m) {
      if (corpo.data) m.data = corpo.data;
      if (corpo.conto_id != null) {
        var c = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_id); })[0];
        if (c) m.contoId = c.id;
      }
      /* l'altro lato di un giroconto segue: mezzo giroconto non e' un giroconto */
      if (m.pairId && corpo.data) {
        S.movimenti.forEach(function (o) {
          if (o.pairId === m.pairId && o.dbId !== m.dbId && ids.indexOf(o.dbId) < 0) {
            o.data = corpo.data; lati += 1;
          }
        });
      }
    });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'movimento_sposta',
      descrizione: trovati.length + ' voci spostate', annullata: false });
    salva();
    return { mosse: trovati.length, lati_giroconto: lati };
  };
  W['/anagrafica/carta'] = function (qs, corpo) {
    var c = S.conti.filter(function (x) { return x.dbId === Number(corpo.conto_id); })[0];
    if (!c) return { __stato: 400, errore: 'conto non trovato' };
    var id = nuovoId();
    S.carte.push({ dbId: id, id: 'k' + id, nome: String(corpo.nome).trim(),
      codice: corpo.codice || null, contoId: c.id,
      giornoAddebito: Number(corpo.giorno_addebito),
      giornoChiusura: corpo.giorno_chiusura == null ? null : Number(corpo.giorno_chiusura),
      plafondCents: corpo.plafond_cents == null ? null : Number(corpo.plafond_cents), attivo: true });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'carta_crea',
      descrizione: corpo.nome, annullata: false });
    salva();
    return { id: id };
  };
  W['/scenari'] = function (qs, corpo) {
    var id = nuovoId();
    S.scenari.push({ id: id, nome: String(corpo.nome).trim(), nota: corpo.nota || '', differenze: [] });
    salva();
    return { id: id, nome: String(corpo.nome).trim() };
  };
  W['/alfred/memoria'] = function (qs, corpo) {
    var k = String(corpo.chiave).trim();
    var r = S.alfred.memoria.filter(function (m) { return m.chiave === k; })[0];
    if (r) { r.valore = corpo.valore; r.origine = corpo.origine || 'diego';
      r.nota = corpo.nota || r.nota; r.aggiornata_il = new Date().toISOString(); }
    else S.alfred.memoria.push({ chiave: k, valore: corpo.valore, origine: corpo.origine || 'diego',
      nota: corpo.nota || '', aggiornata_il: new Date().toISOString() });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'alfred_memoria',
      descrizione: k, annullata: false });
    salva();
    return { chiave: k };
  };
  W['/alfred/consenso'] = function (qs, corpo) {
    var p = S.alfred.permessi.filter(function (x) { return x.azione === corpo.azione; })[0];
    if (!p) return { __stato: 404, errore: 'azione non trovata' };
    if (!p.richiede_consenso_esplicito) return { __stato: 409,
      errore: 'questa azione non passa dal consenso esplicito' };
    p.consenso_esplicito = !!corpo.concedi;
    p.consenso_il = corpo.concedi ? new Date().toISOString() : null;
    p.consenso_da = corpo.concedi ? 'pagina Tesoreria (demo)' : null;
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'alfred_consenso',
      descrizione: corpo.azione + (corpo.concedi ? ' concesso' : ' revocato'), annullata: false });
    salva();
    return { azione: corpo.azione, consenso_esplicito: p.consenso_esplicito };
  };
  W['/alfred/cartella'] = function (qs, corpo) {
    var n = String(corpo.nome).trim();
    if (S.alfred.cartelle.filter(function (c) { return c.nome === n; }).length) {
      return { __stato: 409, errore: 'una cartella con questo nome esiste già' };
    }
    S.alfred.cartelle.push({ nome: n, descrizione: corpo.descrizione || '', conversazioni: 0 });
    salva();
    return { nome: n };
  };
  W['/alfred/comando'] = function (qs, corpo) {
    var frase = String(corpo.frase || '');
    var conv = S.alfred.conversazioni[0];
    if (!conv) {
      conv = { id: nuovoId(), titolo: frase.slice(0, 40), cartella: 'Tesoreria', messaggi: 0, canale: 'app' };
      S.alfred.conversazioni.unshift(conv);
    }
    S.alfred.messaggi.push({ ruolo: 'diego', testo: frase,
      quando: new Date().toISOString().slice(0, 19), canale: 'app', richiesta_id: null });
    conv.messaggi += 1;
    /* la DEMO non ha un modello linguistico: lo dice, invece di fingere di
       aver capito. Le due cose che sa riconoscere le riconosce davvero. */
    var saldo = /saldo|quanto ho|conto/i.test(frase);
    var rischio = /rischio|soglia|sotto/i.test(frase);
    var testo;
    if (saldo || rischio) {
      var r = percorsoConti(new URLSearchParams('da=' + oggiISO() + '&a=' + fineMese(piuMesiData(oggiISO(), 2))));
      var aR = r.conti.filter(function (c) { return c.aRischio; });
      testo = aR.length
        ? aR.map(function (c) { return c.nome + ' scende sotto la sua soglia il ' + c.primoGiornoRischio; }).join('; ') +
          '. La proposta di giroconto è nel riquadro Alimentazione.'
        : 'Nel periodo mostrato nessun conto scende sotto la sua soglia.';
    } else {
      testo = 'Nella DEMO non c’è nessun modello linguistico collegato: non ho capito la ' +
        'frase e non invento una risposta. Chiedimi del saldo o dei conti a rischio: quelle due ' +
        'le leggo dai dati finti.';
    }
    S.alfred.messaggi.push({ ruolo: 'ada', testo: testo,
      quando: new Date().toISOString().slice(0, 19), canale: 'app', richiesta_id: null });
    conv.messaggi += 1;
    salva();
    return { conversazione_id: conv.id, risposta: testo, capito: !!(saldo || rischio),
      chiede_conferma: false, scritto: false,
      so_fare: ['dire il saldo previsto', 'dire quali conti scendono sotto soglia'] };
  };
  function alfredDecide(id, decisione) {
    var r = S.alfred.in_attesa.filter(function (x) { return x.id === Number(id); })[0];
    if (!r) return { __stato: 404, errore: 'richiesta non trovata o già decisa' };
    S.alfred.in_attesa = S.alfred.in_attesa.filter(function (x) { return x.id !== Number(id); });
    if (decisione === 'rifiuta') { salva(); return { scritto: false, riassunto: r.riassunto }; }
    /* conferma: nella demo l'azione si esegue solo se la sappiamo fare */
    if (r.azione === 'movimento_sposta') {
      var m = S.movimenti.filter(function (x) { return x.descrizione === 'Assicurazione auto annuale'; })[0];
      if (m && m.stato !== 'rendicontato') m.data = giro(1, 20);
      S.journal.unshift({ operation_id: 'op-ada-' + nuovoId(), op: 'movimento_sposta',
        descrizione: r.riassunto, annullata: false });
      salva();
      return { scritto: true, riassunto: r.riassunto };
    }
    salva();
    return { scritto: false, riassunto: r.riassunto,
      esito: { errore: 'nella DEMO questa azione non è eseguibile: serve il backend vero' } };
  }
  W['/annulla'] = function (qs, corpo) {
    var r = S.journal.filter(function (x) { return x.operation_id === corpo.operation_id; })[0];
    if (!r) return { __stato: 404, errore: 'operazione non trovata nello storico' };
    if (r.annullata) return { __stato: 409, errore: 'già annullata' };
    r.annullata = true;
    salva();
    /* ONESTA': nella demo l'annullo marca lo storico ma NON ricostruisce il
       dato all'indietro. Si dichiara, non si finge. */
    return { annullata: true,
      avviso: 'nella DEMO l’annullo marca lo storico ma non ricostruisce il dato: ' +
        'usa «Ricomincia da capo» per tornare ai dati iniziali' };
  };
  W['/tasse/convenzionale/chiudi'] = function (qs, corpo) {
    var anno = Number(corpo.anno), mese = Number(corpo.mese);
    var esiste = S.chiusure.filter(function (c) { return c.anno === anno && c.mese === mese; })[0];
    if (esiste && esiste.chiusa) return { __stato: 409,
      errore: 'il mese è già chiuso: la fotografia non si riscrive' };
    var m = meseConv(anno, mese);
    var ch = { anno: anno, mese: mese, chiusa: true, chiusa_il: new Date().toISOString(),
      accantonamento_cents: m.accantonamento_cents, accreditato: false, accreditabile: true,
      motivo_blocco: null };
    S.chiusure = S.chiusure.filter(function (c) { return !(c.anno === anno && c.mese === mese); }).concat([ch]);
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'accantonamento_chiudi',
      descrizione: pad(mese) + '/' + anno, annullata: false });
    salva();
    return { accantonamento_cents: m.accantonamento_cents };
  };
  W['/tasse/convenzionale/accredita'] = function (qs, corpo) {
    var anno = Number(corpo.anno), mese = Number(corpo.mese);
    var ch = S.chiusure.filter(function (c) { return c.anno === anno && c.mese === mese; })[0];
    if (!ch || !ch.chiusa) return { __stato: 409, errore: 'prima si chiude il mese, poi si accredita' };
    if (ch.accreditato) return { __stato: 409, errore: 'già accreditato: per rifarlo annulla prima quello' };
    var ct = S.conti.filter(function (c) { return c.tipo === 'tasse'; })[0];
    var orig = S.conti.filter(function (c) { return c.nome === 'Intesa corrente'; })[0];
    if (!ct || !orig) return { __stato: 409, errore: 'manca il conto tasse o il conto d’origine' };
    var cents = ch.accantonamento_cents, p = 'g-tasse-manuale-' + nuovoId();
    var i1 = nuovoId(), i2 = nuovoId();
    /* il bottone esegue il giroconto ADESSO fra conti propri: si dichiara
       gia' avvenuto se il corpo lo chiede, altrimenti resta previsto */
    var stato = corpo.gia_avvenuto ? 'rendicontato' : 'previsto';
    S.movimenti.push({ id: 't' + i1, dbId: i1, contoId: orig.id, cartaId: null, data: oggiISO(),
      cents: -cents, descrizione: 'Accantonamento tasse 25%', categoria: 'Giroconti',
      sottocategoria: null, stato: stato, lato: 'uscita', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    S.movimenti.push({ id: 't' + i2, dbId: i2, contoId: ct.id, cartaId: null, data: oggiISO(),
      cents: cents, descrizione: 'Accantonamento tasse 25%', categoria: 'Giroconti',
      sottocategoria: null, stato: stato, lato: 'ingresso', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    ch.accreditato = true;
    ch.accredito_stato = corpo.gia_avvenuto ? 'actual' : 'planned';
    ch.accredito_cents = cents;
    ch.accredito_movimento = i2;
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'accantonamento_accredita',
      descrizione: (cents / 100).toFixed(2) + ' al conto tasse', annullata: false });
    salva();
    return { cents: cents, movimento: i2, stato: ch.accredito_stato };
  };
  W['/attivo/salvadanaio'] = function (qs, corpo) {
    var da = S.conti.filter(function (x) { return x.dbId === Number(corpo.da_conto_id); })[0];
    var a = S.conti.filter(function (x) { return x.dbId === Number(corpo.a_conto_id); })[0];
    if (!da || !a) return { __stato: 400, errore: 'conto non trovato' };
    if (da.id === a.id) return { __stato: 400, errore: 'i due conti devono essere diversi' };
    var cents = Number(corpo.importo_cents), p = 'g-sd-' + nuovoId();
    var stato = corpo.gia_avvenuto ? 'rendicontato' : 'previsto';
    var i1 = nuovoId(), i2 = nuovoId();
    S.movimenti.push({ id: 't' + i1, dbId: i1, contoId: da.id, cartaId: null, data: corpo.data,
      cents: -cents, descrizione: 'Giroconto a ' + a.nome, categoria: 'Giroconti',
      sottocategoria: null, stato: stato, lato: 'uscita', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    S.movimenti.push({ id: 't' + i2, dbId: i2, contoId: a.id, cartaId: null, data: corpo.data,
      cents: cents, descrizione: 'Giroconto da ' + da.nome, categoria: 'Giroconti',
      sottocategoria: null, stato: stato, lato: 'ingresso', pairId: p,
      previstoCents: null, previstoData: null, dataContabile: null });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'salvadanaio',
      descrizione: (cents / 100).toFixed(2) + ' da ' + da.nome + ' a ' + a.nome, annullata: false });
    salva();
    return { tipo: a.tipo === 'salvadanaio' ? 'versamento' : 'prelievo', cents: cents,
      data: corpo.data, stato: corpo.gia_avvenuto ? 'actual' : 'planned',
      nota: 'neutro sul patrimonio: i due lati si compensano' };
  };
  W['/attivo/entrata'] = function (qs, corpo) {
    var id = nuovoId();
    S.entrate.push({ id: id, da: String(corpo.da).trim(), tipo: corpo.tipo,
      numero: corpo.numero || null, importo_cents: Number(corpo.importo_cents),
      incassato_cents: 0, stato: corpo.data_attesa ? 'attesa' : 'bozza',
      attesa_il: corpo.data_attesa || null, emessa_il: corpo.data_emissione || null,
      rilevanza_fiscale: corpo.rilevanza_fiscale || 'da_definire', versione: 1 });
    S.journal.unshift({ operation_id: corpo.operation_id, op: 'entrata_crea',
      descrizione: corpo.da, annullata: false });
    salva();
    return { id: id, in_previsione: !!corpo.data_attesa,
      nota: corpo.data_attesa ? null : 'Senza data attesa non ha un giorno in cui passare: resta fuori dalla previsione.',
      avviso_fiscale: corpo.rilevanza_fiscale === 'da_definire'
        ? 'La rilevanza fiscale resta da definire: fuori partita IVA non vuol dire esente' : null };
  };

  /* ── 8 · IL ROUTER ──────────────────────────────────────────────────────── */
  function instrada(metodo, percorso, qs, corpo) {
    var m;
    if (metodo === 'GET') {
      if (R[percorso]) return R[percorso](qs);
      if ((m = percorso.match(/^\/scenari\/(\d+)\/differenze$/))) {
        var s = S.scenari.filter(function (x) { return String(x.id) === m[1]; })[0];
        if (!s) return { __stato: 404, errore: 'ipotesi non trovata' };
        var d = s.differenze || [];
        return { aperte: d.filter(function (x) { return !x.promossa; }).length,
          promosse: d.filter(function (x) { return x.promossa; }).length,
          conflitti: d.filter(function (x) { return x.conflitto; }).length,
          effetto_somma_cents: somma(d.filter(function (x) { return !x.promossa; }), function (x) { return x.cents; }),
          differenze: d.map(function (x) {
            return { id: x.id, nome: x.nome, entita: x.entita, op: x.op, base: null,
              ipotesi: { cents: x.cents, data: x.data }, effetto_cents: x.cents,
              promossa: x.promossa, conflitto: x.conflitto, voci_figlie: 0,
              base_versione: null, promossa_il: x.promossa_il || null }; }) };
      }
      if ((m = percorso.match(/^\/impegni\/finanziamento\/(\d+)\/piano$/))) {
        var f = S.finanziamenti.filter(function (x) { return String(x.id) === m[1]; })[0];
        if (!f) return { __stato: 404, errore: 'finanziamento non trovato' };
        var piano = [], residuo = f.capitale_cents;
        for (var i = 1; i <= f.rate_totali; i++) {
          /* senza capitale e senza TAN la scomposizione NON si calcola: resta
             ignota dichiarata, non zero */
          var cap = null, inte = null, res = null;
          if (f.capitale_cents != null && f.tan_bp != null) {
            inte = Math.round(residuo * f.tan_bp / 10000 / 12);
            cap = Math.abs(f.rata_cents) - inte;
            residuo = Math.max(0, residuo - cap);
            res = residuo;
          }
          piano.push({ seq: i, scadenza: giro(i - f.rate_pagate, f.giorno),
            rata_cents: f.rata_cents, capitale_cents: cap, interessi_cents: inte,
            residuo_cents: res,
            stato: i <= f.rate_pagate ? 'rendicontata'
              : (i === f.rate_pagate + 1 && f.rate_parziali ? 'parziale' : 'prevista') });
        }
        return piano;
      }
      if ((m = percorso.match(/^\/inbox\/riga\/(\d+)\/candidati$/))) return [];
      if ((m = percorso.match(/^\/ingest\/(\d+)\/non-capite$/))) return [];
      return { __stato: 404, errore: 'percorso sconosciuto nella demo: ' + percorso };
    }
    /* POST / PATCH */
    if (W[percorso]) return W[percorso](qs, corpo || {});
    if ((m = percorso.match(/^\/obiettivi\/(\d+)\/(assegna|togli)$/))) return quota(m[1], m[2], corpo || {});
    if ((m = percorso.match(/^\/alfred\/richiesta\/(\d+)\/(conferma|rifiuta)$/))) return alfredDecide(m[1], m[2]);
    if ((m = percorso.match(/^\/promemoria\/(\d+)\/spegni$/))) {
      var p = S.promemoria.filter(function (x) { return String(x.id) === m[1]; })[0];
      if (!p) return { __stato: 404, errore: 'promemoria non trovato' };
      p.attivo = false; salva(); return { id: p.id, attivo: false };
    }
    if ((m = percorso.match(/^\/promemoria\/(\d+)\/visto$/))) return { ack: false };
    if ((m = percorso.match(/^\/scenari\/(\d+)\/modifica$/))) {
      var sc = S.scenari.filter(function (x) { return String(x.id) === m[1]; })[0];
      if (!sc) return { __stato: 404, errore: 'ipotesi non trovata' };
      sc.nome = String((corpo || {}).nome || sc.nome).trim(); salva(); return { id: sc.id };
    }
    if (percorso === '/scenari/ordine') {
      var ordine = ((corpo || {}).ids || []).map(Number);
      S.scenari.sort(function (a, b) { return ordine.indexOf(a.id) - ordine.indexOf(b.id); });
      salva(); return { quante: ordine.length };
    }
    if ((m = percorso.match(/^\/impegni\/serie\/(\d+)\/modifica$/))) {
      var se = S.serie.filter(function (x) { return String(x.id) === m[1]; })[0];
      if (!se) return { __stato: 404, errore: 'serie non trovata' };
      var c = corpo || {};
      if (c.attivo === false) {
        /* spegnere: sparisce il FUTURO, resta il passato pagato */
        S.movimenti = S.movimenti.filter(function (x) {
          return !(x.descrizione === se.nome && x.data >= c.da_data && x.stato !== 'rendicontato'); });
        S.serie = S.serie.filter(function (x) { return x.id !== se.id; });
        salva();
        return { generazione: { aggiornate: 0, nuove: 0 } };
      }
      var agg = 0;
      S.movimenti.forEach(function (x) {
        if (x.descrizione === se.nome && x.data >= c.da_data && x.stato !== 'rendicontato') {
          x.cents = Number(c.importo_cents); agg += 1;
        }
      });
      se.importo_cents = Number(c.importo_cents);
      se.giorno = Number(c.giorno || se.giorno);
      se.fine = c.fine || null;
      salva();
      return { generazione: { aggiornate: agg, nuove: 0, saltate_rendicontate:
        S.movimenti.filter(function (x) { return x.descrizione === se.nome && x.stato === 'rendicontato'; }).length } };
    }
    if ((m = percorso.match(/^\/attivo\/entrata\/(\d+)\/modifica$/))) {
      var e = S.entrate.filter(function (x) { return String(x.id) === m[1]; })[0];
      if (!e) return { __stato: 404, errore: 'entrata non trovata' };
      var b = corpo || {};
      if (b.versione_vista != null && Number(b.versione_vista) !== e.versione) {
        return { __stato: 409, errore: 'l’entrata è cambiata mentre la guardavi: rileggi e riprova' };
      }
      if (e.incassato_cents > 0 && b.importo_cents != null) {
        return { __stato: 409, errore: 'di questa entrata sono già arrivati dei soldi: ' +
          'l’importo non si riscrive sopra un fatto avvenuto' };
      }
      if (b.importo_cents != null) e.importo_cents = Number(b.importo_cents);
      if ('data_attesa' in b) e.attesa_il = b.data_attesa;
      if ('data_emissione' in b) e.emessa_il = b.data_emissione;
      if (b.rilevanza_fiscale) e.rilevanza_fiscale = b.rilevanza_fiscale;
      e.versione += 1; e.stato = e.incassato_cents >= e.importo_cents ? 'incassata'
        : (e.attesa_il ? 'attesa' : 'bozza');
      salva();
      return { id: e.id, in_previsione: !!e.attesa_il };
    }
    /* quello che la demo NON sa fare lo dice, con il percorso in chiaro */
    if (/^\/ingest\//.test(percorso)) return nonInDemo('l’import di un estratto');
    if (/^\/inbox\//.test(percorso)) return nonInDemo('la riconciliazione dell’inbox');
    if (/^\/fisco\//.test(percorso)) return nonInDemo('la registrazione di un dovuto fiscale');
    if (/^\/impegni\//.test(percorso)) return nonInDemo('la creazione di impegni e finanziamenti');
    if (/^\/scenari\//.test(percorso)) return nonInDemo('la scrittura dentro le ipotesi');
    return { __stato: 404, errore: 'percorso sconosciuto nella demo: ' + percorso };
  }

  /* ── 9 · L'INTERCETTAZIONE ──────────────────────────────────────────────── */
  function risposta(dato, metodo, percorso) {
    var stato = 200, corpo = dato;
    if (dato && typeof dato === 'object' && dato.__stato) {
      stato = dato.__stato;
      corpo = {}; for (var k in dato) if (k !== '__stato') corpo[k] = dato[k];
    }
    /* un log leggibile: aprendo la console si vede CHE la demo ha risposto,
       e quindi che nessuna richiesta e' uscita verso la produzione */
    if (stato >= 400) console.info('[demo] ' + metodo + ' ' + percorso + ' -> ' + stato);
    return new Response(JSON.stringify(corpo), { status: stato,
      headers: { 'content-type': 'application/json' } });
  }

  function percorsoDi(url) {
    for (var i = 0; i < BASI.length; i++) {
      if (url.indexOf(BASI[i]) === 0) return url.slice(BASI[i].length) || '/';
    }
    return null;
  }

  var fetchVero = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (risorsa, opzioni) {
    var url, metodo, corpoTesto;
    try {
      if (risorsa && typeof risorsa === 'object' && risorsa.url) {
        url = risorsa.url; metodo = (risorsa.method || 'GET').toUpperCase();
      } else {
        url = String(risorsa);
        metodo = ((opzioni && opzioni.method) || 'GET').toUpperCase();
      }
      corpoTesto = opzioni && opzioni.body;
    } catch (e) {
      return fetchVero ? fetchVero(risorsa, opzioni) : Promise.reject(e);
    }
    var assoluto = url;
    try { assoluto = new URL(url, location.href).href; } catch (e) { /* resta com'e' */ }

    var percorso = percorsoDi(assoluto) || percorsoDi(url);
    if (percorso == null) {
      /* LA GUARDIA: una richiesta all'host di produzione che non sappiamo
         tradurre NON passa. Meglio una demo che si lamenta di una pagina
         che scrive sui soldi veri. */
      if (assoluto.indexOf(HOST_PRODUZIONE) >= 0) {
        console.error('[demo] BLOCCATA una richiesta verso la produzione: ' + assoluto);
        return Promise.resolve(new Response(JSON.stringify({
          errore: 'la DEMO ha bloccato una richiesta verso il backend di produzione (' +
            assoluto + '): nessun dato vero è stato toccato' }),
          { status: 503, headers: { 'content-type': 'application/json' } }));
      }
      return fetchVero ? fetchVero(risorsa, opzioni) : Promise.reject(new Error('fetch non disponibile'));
    }

    var senzaQuery = percorso.split('?')[0];
    var qs = qsDi('https://demo.invalido' + percorso);
    var corpo = null;
    if (corpoTesto) { try { corpo = JSON.parse(corpoTesto); } catch (e) { corpo = null; } }

    /* un filo di attesa: senza, gli stati «sto leggendo…» non si vedrebbero
       mai e la demo mentirebbe sul percepito di una rete reale */
    return new Promise(function (ris) {
      setTimeout(function () {
        var dato;
        try { dato = instrada(metodo, senzaQuery, qs, corpo); }
        catch (e) {
          console.error('[demo] errore interno su ' + metodo + ' ' + senzaQuery, e);
          dato = { __stato: 500, errore: 'errore interno della demo su ' + senzaQuery + ': ' + e.message };
        }
        ris(risposta(dato, metodo, senzaQuery));
      }, 90);
    });
  };

  /* ── 10 · I FLAG. La pagina chiede un codice se `app_token` e' vuoto: nella
        demo il codice non serve, quindi se ne mette uno finto e si DICE che
        e' finto. `tesoreria_api` punta a un indirizzo che non esiste: se per
        qualunque motivo l'intercettazione non partisse, la richiesta
        morirebbe nel nulla invece di arrivare in produzione. ──────────── */
  try {
    localStorage.setItem('tesoreria_api', BASE_DEMO);
    if (!localStorage.getItem('app_token')) localStorage.setItem('app_token', 'demo-dati-finti');
  } catch (e) { /* private browsing: la pagina chiedera' il codice, e basta scriverne uno */ }

  window.collaudoAttivo = true;
  console.info('[demo] finto backend attivo: dati FINTI in localStorage, nessuna rete verso la produzione');
})();
