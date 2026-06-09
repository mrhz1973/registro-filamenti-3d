# 🧵 Registro Filamenti 3D

Web app locale per la gestione completa dell'inventario filamenti per stampa 3D (Bambu Lab e altri brand).

## 🚀 Avvio

Apri `index.html` nel browser. Fine. 😊

Nessuna installazione, nessun server: i dati vivono nel localStorage del browser e si esportano/importano come JSON.

## 📂 Struttura

| Percorso | Contenuto |
|----------|-----------|
| `index.html` + `app.js` + `styles.css` | **L'applicazione** (versione attiva) |
| `dati/` | Ultimo export JSON dei dati reali (per test e ripristino) |
| `fatture/` | PDF fatture Bambu Lab originali |
| `docs/` | Briefing per AI (Cursor), prompt storici |
| `archivio/` | Versioni precedenti e refactoring sperimentali (solo storico) |

## ✨ Funzionalità principali

- 📊 Dashboard con KPI (rotoli totali, grammi residui, valore magazzino)
- ➕ Aggiunta manuale + import automatico da fatture Bambu Lab (JSON)
- 📦 Magazzino con filtri multi-select, ricerca, stato bobine individuali
- 🎯 Check finale inventario fisico e visualizzazione posizioni scaffali
- 📈 Grafici consumi nel tempo (Chart.js)
- ⚠️ Report scorte basse con soglia configurabile
- ↩️ Undo/Redo persistente, tema light/dark, export/import JSON

## 🛠 Stack

Vanilla HTML/CSS/JavaScript — zero dipendenze, zero build, offline-first.

## 🤖 Sviluppo con AI

- **Orchestratore**: Claude (analisi, architettura, task definition, review)
- **Implementatore**: Cursor (modifiche al codice) — regole in `.cursorrules`, contesto in `docs/CURSOR_BRIEFING.md`

## 📌 Versionamento

La versione parte da `INITIAL_VERSION` in `app.js` e si auto-incrementa nel localStorage ad ogni salvataggio. Gli export si chiamano `registro_filamenti_YYYY-MM-DD_Vxxx.json`.
