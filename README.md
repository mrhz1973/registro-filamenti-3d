# Registro Filamenti 3D — V.108

Applicazione locale per acquisti, magazzino, bobine e consumi di filamento. Apri `index.html` nel browser: non servono installazione, server o connessione a Internet.

## Aggiornamento e dati

Prima di aggiornare conserva un export JSON dal browser che contiene il tuo registro. I dati sono nel browser, **non nella cartella dell'app né su GitHub**. Cambiare browser, profilo, percorso `file://` o indirizzo di un server locale può mostrare un registro diverso o vuoto: in quel caso importa il backup, senza cancellare quello precedente.

V.108 legge i backup precedenti, incluso il formato V318. Il salvataggio usa ancora la chiave `registroFilamentiState_v3`, con un formato interno identificato da `schemaVersion: 4`. La versione dell'app resta V.108; la revisione dei dati aumenta separatamente.

## Aprire una bobina

Nell'editor usa **Apri bobina** sulla riga della sigillata interessata, poi **Salva modifiche**. La stessa bobina diventa aperta al 100%: sigillate diminuisce di una, aperte aumenta di una e il totale resta uguale. Posizione, colore, identificatore e grammi vengono mantenuti; l'apertura da sola non registra consumo.

Anche aumentando il contatore **Aperte** vengono convertite sigillate esistenti, dando priorità a quella selezionata nella vista posizioni. Il contatore non crea bobine aggiuntive quando mancano sigillate disponibili. Per registrare nuove bobine usa il modulo di aggiunta. Annulla nel modulo scarta le modifiche; dopo il salvataggio è disponibile Annulla/Ripristina.

## Backup automatici su disco

Il salvataggio nel browser è automatico dopo le operazioni confermate; le preferenze con debounce vengono salvate anche alla chiusura ordinaria della pagina. I campi ancora in una finestra di modifica richiedono Salva per essere applicati.

Per aggiungere un JSON su disco ogni cinque minuti, usa **Scegli cartella backup** nel pannello vicino ai comandi di import/export e autorizza la scrittura. È supportato nei browser desktop che espongono File System Access, come Chrome ed Edge. La prima copia viene creata subito; poi vengono salvate le modifiche a intervalli di cinque minuti. Quando non cambia nulla non vengono generate copie duplicate.

Ogni salvataggio crea un file datato e aggiorna `registro_filamenti_ultimo_backup.json`. Le copie precedenti non vengono cancellate. L'autorizzazione alla cartella viene ricordata tramite IndexedDB, separatamente dal registro e dal JSON: se il browser la revoca, premi **Riattiva backup**. Lo stato mostra cartella e ora dell'ultima scrittura riuscita; errori e permessi mancanti restano visibili. **Salva JSON ora** forza una copia; **Disattiva backup JSON** lascia intatti i file esistenti.

La pagina deve restare aperta: browser e sistema operativo possono ritardare i timer quando la scheda è sospesa. Al ritorno sulla scheda viene tentato un backup delle modifiche. Il file su disco può precedere l'ultima modifica fino al prossimo intervallo; il salvataggio locale nel browser conserva il registro più recente. Un arresto improvviso durante una scrittura non può essere garantito come riuscito. Su browser non supportati restano disponibili salvataggio locale ed esportazione manuale.

## Nomi e colori Bambu Lab

Inclusi offline 318 codici ufficiali Bambu Studio per 46 famiglie: nome italiano, nome inglese e colori RGBA, con provenienza fissata a un commit. La lista in [docs/catalogo-colori-bambu.csv](docs/catalogo-colori-bambu.csv) è consultabile anche fuori dall'app. Il campione su schermo è una rappresentazione digitale, non una garanzia della resa stampata, della trasparenza o della finitura del materiale.

Lista, schede e ricerca completano il nome a partire dal codice, anche quando il codice si trova in un campo separato. Le etichette personalizzate vengono conservate; i codici sconosciuti non ricevono associazioni inventate. Il rendering non riscrive i nomi e i codici del registro. I colori multicolore mostrano le tinte previste e quelli trasparenti un fondo a scacchi.

- **Esporta JSON** crea una copia dello stato corrente, comprendendo inventario, acquisti, consumi, cataloghi, posizioni e impostazioni. La cronologia di annullamento rimane nel browser e non gonfia il file di backup.
- **Ripristina backup** sostituisce l'intero registro dopo validazione e conferma. Accetta anche un inventario vuoto. Un file non valido non modifica lo stato.
- **Importa fatture** aggiunge acquisti; non è un ripristino del registro. I numeri con virgola decimale sono supportati e le quantità non valide vengono rifiutate.
- Un salvataggio non riuscito viene segnalato. Un registro corrotto o modificato da un'altra scheda non viene sovrascritto automaticamente: esporta la copia di recupero o le modifiche prima di ricaricare.
- Il browser conserva, quando lo spazio lo consente, anche la copia precedente in `registroFilamentiState_v3_lastGood`. Questa protezione locale non sostituisce un backup JSON conservato altrove.

## Funzionalità

- Dashboard, ricerca, filtri e ordinamento del magazzino.
- Inserimento manuale e importazione di fatture JSON.
- Bobine sigillate, aperte e finite; colore, posizione e residuo individuali.
- AMS HT prevede una bobina e AMS 2 Pro quattro per unità. Gli alias AMS/H2D, AMS Pro e AMS 2 Pro indicano la stessa unità; i nomi numerati distinguono unità diverse. Se si supera la capacità, il salvataggio resta possibile e un avviso rosso persistente mostra numero presente e capacità.
- Le schede della vista posizioni aprono ed evidenziano la bobina cliccata. Si possono trascinare le bobine fra le posizioni, comprese quelle vuote già presenti nell'elenco; lo spostamento è annullabile.
- Trasferimenti dagli acquisti al magazzino senza creare falsi consumi.
- Storico consumi, grafici SVG e bilancio delle quantità.
- Annulla/Ripristina delle operazioni con dati e storico coerenti.
- Soglia scorte configurabile, inventario fisico e vista delle posizioni.
- Tema chiaro/scuro, finestre trascinabili e interfaccia adattata a schermi piccoli.

I vecchi backup non contengono necessariamente tutta la storia degli acquisti o dei consumi. La migrazione conserva le quantità disponibili; non inventa date o movimenti mancanti. Il bilancio distingue la massa iniziale registrata dai consumi documentati nello storico.

## Sviluppo e verifiche

Solo HTML, CSS e JavaScript vanilla, senza dipendenze o compilazione dell'app. I file attivi sono `index.html`, `app.js` e `styles.css`. `archivio/` contiene esclusivamente versioni storiche; `dati/` e `fatture/` sono riferimenti esistenti.

Con Node.js 22 o successivo:

```text
node --check app.js
node --test tests/data.test.cjs tests/domain.test.cjs tests/mutation.test.cjs tests/ams-capacity.test.cjs tests/ams-view.test.cjs tests/colors.test.cjs tests/file-backup.test.cjs
```

Questi controlli sono eseguiti anche su GitHub. La suite facoltativa `tests/browser.test.cjs` richiede Playwright e Chromium già disponibili nell'ambiente di test; non aggiunge dipendenze all'app. `PLAYWRIGHT_MODULE` può indicare il modulo installato e `CHROMIUM_EXECUTABLE` il browser. Ogni prova usa un contesto nuovo, dati sintetici o una copia del backup di riferimento e un server locale temporaneo.

```text
node --test tests/browser.test.cjs
```

Per una verifica pratica: importa una copia del backup, modifica una bobina e annulla; esporta e ripristina; prova filtri, trascinamento delle finestre e tema chiaro/scuro. Esegui queste prove in un profilo dedicato, separato dal registro personale.

Le note della versione sono in [docs/V108.md](docs/V108.md); le versioni precedenti sono documentate in [docs/V107.md](docs/V107.md), [docs/V105.md](docs/V105.md) e [docs/V104.md](docs/V104.md). Le convenzioni di lavoro sono in `.cursorrules` e `docs/CURSOR_BRIEFING.md`.
