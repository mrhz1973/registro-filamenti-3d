# 📋 Briefing Progetto: Registro Filamenti 3D

> **Per Cursor AI**: Leggi questo documento PRIMA di toccare il codice. Contiene contesto, architettura, convenzioni e roadmap. Le regole operative sono in `.cursorrules` nella root.

---

## 🎯 Project Overview

**Nome**: Registro Filamenti 3D
**Tipo**: Web app single-page per gestione inventario filamenti stampa 3D
**Utente**: Singolo (Martino, stampante Bambu Lab H2D) — uso personale quotidiano
**Lingua UI**: Italiano
**Stato**: ✅ FUNZIONANTE e USATO QUOTIDIANAMENTE — non rompere nulla!

### Scopo
Tracciare l'intero ciclo di vita dei filamenti: acquisto (import da fatture Bambu Lab) → stock (bobine sigillate/aperte/parziali) → consumo → statistiche.

---

## 🛠 Tech Stack

- **Vanilla HTML/CSS/JavaScript** — NO framework, NO build tools, NO bundler
- **Storage**: localStorage del browser (chiave `registroFilamentiState_v3`)
- **Persistenza**: Import/Export JSON manuale
- **Charts**: Chart.js via CDN
- **Niente backend**: tutto offline-first

---

## 📁 Struttura Repository

```
registro-filamenti-3d/
├── index.html      ← ENTRY POINT (app principale)
├── app.js          ← TUTTA la logica (~9.700 righe)
├── styles.css      ← TUTTI gli stili (~2.200 righe)
├── dati/
│   └── registro_filamenti_2026-03-12_V318.json  ← ultimo export reale (per test)
├── fatture/        ← PDF fatture Bambu Lab (riferimento, non toccare)
├── docs/           ← briefing e prompt storici
└── archivio/       ← versioni vecchie (NON usare come riferimento per nuovo codice)
    ├── APP_pre-fix/             ← versione prima del fix dropdown
    ├── refactoring_claude_V90/  ← tentativo refactoring modulare (dicembre 2025)
    └── refactoring_chatgpt/     ← tentativo refactoring ChatGPT (dicembre 2025)
```

⚠️ **I file in `archivio/` sono SOLO storici.** Il codice attivo è nella root.

---

## 🔢 Sistema di Versionamento (IMPORTANTE)

Il versionamento è **dinamico e auto-incrementante**:

```javascript
const INITIAL_VERSION = "V.100";        // base nel codice
const VERSION_KEY = "registroFilamentiAppVersion";  // localStorage
```

- La versione visualizzata si incrementa automaticamente nel localStorage ad ogni salvataggio
- L'utente è attualmente a **V.318** (export del 12 marzo 2026)
- **Quando modifichi il codice in modo significativo**: incrementa `INITIAL_VERSION` (es. V.100 → V.101). Il codice forza l'aggiornamento se `initialNum >= storedNum`
- Gli export JSON si chiamano `registro_filamenti_YYYY-MM-DD_Vxxx.json`

---

## 🏗 Architettura `app.js` (~9.700 righe, IIFE singola)

Moduli logici principali (in ordine approssimativo nel file):

| Modulo | Cosa fa |
|--------|---------|
| **Costanti & State** | `STORAGE_KEY`, `VERSION_KEY`, stato globale filaments |
| **Versioning dinamico** | `loadVersion()`, auto-incremento |
| **Floating Layer** | `initFloatingLayer()` — portal per dropdown (FIX z-index) |
| **Color dropdowns** | Dropdown colori custom con mappa colori Bambu Lab |
| **Multi-select dropdowns** | `createMultiSelectDropdown()` (~riga 3870) filtri tabella |
| **Import/Export** | Parsing JSON fatture + export stato |
| **Rendering tabelle** | Stock, acquistati, stato bobine |
| **Sistema bobine** | Gestione individuale: sigillate/aperte/parziali con grammi |
| **Undo/Redo** | Stack persistente max 50 azioni (`registroFilamentiUndoStack`) |
| **Canonicalizzazione** | "PLA Basic" ≡ "PLA" per matching |
| **Dashboard/KPI** | Summary cards (rotoli totali, grammi residui, ecc.) |
| **Check Finale** | Inventario fisico con spunta "posizionato" |
| **Storage Visualization** | Visualizzazione posizioni magazzino/scaffali |
| **Low Stock Report** | Modal report scorte basse con soglia configurabile |
| **Charts** | Grafici consumi con Chart.js |
| **Toast & Sound** | Notifiche 3s + suono conferma |
| **Modal draggabili** | Drag via header, scroll position salvata |

### Pattern chiave già implementati (NON reinventare)

**1. Floating Layer (portal) per dropdown** — risolve z-index/stacking context:
```javascript
const floatingLayer = document.getElementById('floating-layer') || initFloatingLayer();
floatingLayer.appendChild(menu);
menu.classList.add('is-portal-active');
// + doppio requestAnimationFrame per il positioning
// + body.classList.add('dropdown-open') per abbassare la tabella
```

**2. Salvataggio parent originale** per ripristino menu alla chiusura (`data-original-parent`)

**3. Scroll position save/restore** per i modal

---

## 📊 Modello Dati

### Filament object
```javascript
{
  id: "F-20251024-PLA-BASIC-NERO",
  brand: "Bambu Lab",
  material: "PLA Basic",
  variant: "Nero (10101)",
  color_code: "10101",
  spools_total: 3,
  sealed_spools: 2,
  open_spools: 1,
  unit_weight_g: 1000,
  remaining_partial_g: 750,
  shelf_position: "A3",
  packaging_type: "Ricarica",       // o "Filamento con bobina"
  price_per_spool_eur: 23.57,
  notes: "...",
  orders: [{ order_id, invoice_id, order_date }]
}
```

### Invoice JSON (formato import fatture)
```javascript
{
  orders: [{
    orderNumber: "EN...", invoiceDate: "2025-11-07", brand: "Bambu Lab",
    items: [{ material, sku, bambuColorName, bambuColorCode, form,
              weight_g_per_spool, qty_spools, price_eur }]
  }]
}
```

⚠️ **Backward compatibility obbligatoria**: l'import deve continuare a leggere i JSON vecchi.

---

## ✅ Funzionalità Complete (NON rifare, NON rompere)

- Dashboard "Panoramica" con summary cards KPI
- Aggiunta manuale filamenti (con dropdown colori, fornitori, posizioni)
- Import fatture Bambu Lab da JSON / Export stato
- Magazzino con filtri multi-select (✅ fix dropdown sopra tabella FUNZIONANTE)
- Sezione Acquistati con filtri
- Stato Bobine (gestione individuale sigillate/aperte/parziali)
- Check Finale (inventario fisico)
- Visualizzazione Magazzino (posizioni/scaffali)
- Grafici consumi (Chart.js)
- Report Scorte Basse con soglia configurabile
- Undo/Redo persistente
- Tema light/dark
- Modal trascinabili
- Toast 3 secondi + suoni
- Note sui filamenti
- Eliminazione bobine selettiva

---

## 🐛 Bug noti / Lavori in corso

**Nessun bug bloccante noto al momento.**
Il famoso bug "dropdown coperto dalla tabella" è stato RISOLTO con il pattern floating layer (vedi `docs/PROMPT_FIX_DROPDOWN.md` per la storia).

---

## 🎨 Roadmap (priorità dell'utente)

### 1. Dashboard stile Grafana (PRIORITÀ ALTA)
Evolvere la UI verso un look professionale data-rich:
- Palette dark: canvas `#111217`, panel `#181B1F`, elevated `#22252B`, bordi `#334155`
- Testo: `#D8D9DA` primario, `#8E8E8E` secondario (mai bianco puro)
- Semantici: `#73BF69` ok / `#FADE2A` warning / `#F2495C` critico
- KPI cards: 1 metrica per card, valore 32-48px bold, trend indicator ↑↓
- Progress bar livello bobine con threshold colore (verde >25%, giallo 10-25%, rosso <10%)
- Layout griglia 12 colonne, gap 16px, pattern Bento Box
- Typography: Inter, scale 12-14-16-18-24-32, spacing base 8px
- Valutare ApexCharts per gauge radiali (dark mode nativo) in sostituzione/affiancamento Chart.js

### 2. PWA (PRIORITÀ MEDIA)
- manifest.json + service worker per installazione e offline
- Attenzione: il localStorage rimane la fonte dati

### 3. Integrazione Bambu Studio (ESPLORATIVA)
- Import log di stampa per consumo automatico grammi

---

## ⚙️ Principi del Progetto (rispettare SEMPRE)

1. **Pratico > Estetico** — funzionalità prima del design
2. **NON riscrivere da zero** — modifiche chirurgiche al codice esistente
3. **Vanilla JS only** — no framework, no npm, no build step
4. **Tutto in italiano** — UI, commenti, messaggi
5. **Offline-first** — nessuna chiamata server
6. **Backward compatibility** — import JSON vecchi deve funzionare
7. **Incrementa INITIAL_VERSION** ad ogni modifica significativa
8. **Testa con** `dati/registro_filamenti_2026-03-12_V318.json`
9. **Conferma prima di modifiche estese** — proponi il piano, poi implementa
