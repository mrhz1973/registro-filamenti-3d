# 🎯 SUPER PROMPT: Applicazione Web "Registro Filamenti 3D"

**Versione**: 4.0 Enterprise Edition  
**Tipo**: Single Page Application (SPA) Offline  
**Approccio**: Robustezza + Dettaglio Implementativo + Best Practices Avanzate

---

# PARTE 1: FILOSOFIA E PRINCIPI DI SVILUPPO 🧠

## 🎯 VISIONE GENERALE

Agisci come un **Senior Frontend Developer** specializzato in Vanilla JavaScript e architetture sostenibili. 

**Obiettivo**: Sviluppare una Single Page Application (SPA) offline per la gestione dell'inventario di filamenti per stampa 3D che sia:
- ✅ **Robusta**: Nessuna incoerenza dati, bug modal, comportamenti strani
- ✅ **Manutenibile**: Codice ben organizzato, separazione concerns
- ✅ **User-Friendly**: UX fluida, feedback chiari, errori gestiti
- ✅ **Production-Ready**: Non un prototipo, ma un'app solida

**IMPORTANTE**: Non voglio solo codice funzionante, voglio un'applicazione **enterprise-grade** che rispetti tutti i principi di robustezza descritti qui sotto.

---

## 📜 PRINCIPI FONDAMENTALI (NON NEGOZIABILI)

### **Principio 1: Coerenza dei Dati**

**Problema**: Salvare nel JSON sia dati immessi che valori calcolati porta a incoerenze.

**DIRETTIVA OBBLIGATORIA**:
```
✅ Salvare SOLO i dati di input:
   - Bobine sigillate/aperte (numeri)
   - Frazioni bobine aperte (array)
   - Peso unitario, prezzo (numeri)
   - Posizioni fisiche (array stringhe)
   - Brand, material, variant (stringhe)

❌ NON salvare MAI valori calcolati nel JSON:
   - remaining_weight (si calcola al volo)
   - total_weight (si calcola al volo)
   - total_value (si calcola al volo)
```

**Implementazione**:
```javascript
// ✅ CORRETTO - Funzione dominio che calcola al volo
export function calculateWeights(filament) {
  const sealedWeight = filament.sealed_spools * filament.unit_weight;
  const fractionsSum = filament.open_spools_fractions.reduce((a,b) => a+b, 0);
  const openWeight = fractionsSum * filament.unit_weight;
  
  // Ritorna oggetto con campi calcolati (non li salva!)
  return {
    ...filament,
    total_weight: sealedWeight + openWeight,
    remaining_weight: sealedWeight + openWeight
  };
}

// Nel rendering, usa sempre la funzione
const enrichedFilament = calculateWeights(filament);
console.log(enrichedFilament.remaining_weight); // Calcolato al volo
```

---

### **Principio 2: Invarianti sugli Array Dinamici**

**Problema**: Nei modal, i bug nascono quando la lunghezza di un array non segue il numero di bobine.

**DIRETTIVA OBBLIGATORIA**:
```
Quando open_spools cambia:
1. Se AUMENTA → Aggiungere default (1.0 per frazioni, "" per posizioni)
2. Se DIMINUISCE → Tagliare l'array (slice)
3. Mai lasciare "valori appesi" oltre il numero di bobine
```

**Implementazione**:
```javascript
// ✅ CORRETTO - Normalizzazione automatica
function normalizeArrays(filament) {
  const totalSpools = filament.sealed_spools + filament.open_spools;
  
  // Normalizza frazioni bobine aperte
  let fractions = filament.open_spools_fractions || [];
  while (fractions.length < filament.open_spools) {
    fractions.push(1.0); // Default: piena
  }
  fractions = fractions.slice(0, filament.open_spools);
  
  // Normalizza posizioni (tutte le bobine)
  let locations = filament.spools_locations || [];
  while (locations.length < totalSpools) {
    locations.push(""); // Default: vuota
  }
  locations = locations.slice(0, totalSpools);
  
  return {
    ...filament,
    open_spools_fractions: fractions,
    spools_locations: locations
  };
}

// Chiamare SEMPRE prima di usare i dati
const normalized = normalizeArrays(filament);
```

---

### **Principio 3: Statistiche Stabili (Event Sourcing)**

**Problema**: Calcolare "grammi usati" come differenza tra totale storico e residuo falsifica i dati se l'utente corregge l'inventario.

**DIRETTIVA OBBLIGATORIA** (se implementi tracking consumo):
```
✅ Usare un log di eventi (Event Sourcing):
   - Ogni modifica = evento con delta + timestamp
   - Statistiche = aggregazione eventi
   
❌ NON dedurre consumo dallo stato attuale
```

**Implementazione**:
```javascript
// ✅ CORRETTO - Event log
const eventLog = [
  {
    id: crypto.randomUUID(),
    type: "consumption",
    filament_id: "fil-123",
    delta_grams: -250,  // Negativo = consumo
    timestamp: "2024-12-20T10:00:00Z",
    note: "Stampa vaso"
  },
  {
    type: "purchase",
    filament_id: "fil-123",
    delta_grams: +1000,  // Positivo = acquisto
    timestamp: "2024-12-15T14:30:00Z"
  },
  {
    type: "correction",
    filament_id: "fil-123",
    delta_grams: +50,  // Correzione inventario
    timestamp: "2024-12-18T09:00:00Z",
    note: "Trovata bobina dimenticata"
  }
];

// Statistiche = somma eventi
function getTotalConsumption(filamentId, startDate, endDate) {
  return eventLog
    .filter(e => 
      e.filament_id === filamentId &&
      e.type === "consumption" &&
      e.timestamp >= startDate &&
      e.timestamp <= endDate
    )
    .reduce((sum, e) => sum + Math.abs(e.delta_grams), 0);
}
```

---

### **Principio 4: Modal Robusti e Uniformi**

**Problema**: Modal con comportamento inconsistente, scroll problematico, focus non gestito.

**DIRETTIVE OBBLIGATORIE**:

**4.1 Comportamento Chiusura Uniforme**:
```
✅ ESC → Chiude modal
✅ Click overlay → Chiude modal
✅ Bottone X → Chiude modal
✅ Stessi event listeners per tutti i modal
```

**4.2 Scroll Corretto**:
```css
/* Body quando modal aperto */
body.modal-open {
  overflow: hidden !important;
}

/* Modal overlay */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;  /* Scroll esterno */
  padding: 2rem 1rem;
  align-items: flex-start;  /* NON center! */
}

/* Modal dialog */
.modal-dialog {
  max-height: none;  /* NO limite */
  margin: 0 auto;
}

/* Modal body - scroll interno */
.modal-body {
  max-height: calc(100vh - 16rem);
  overflow-y: auto;
  padding-right: 0.5rem;  /* Spazio scrollbar */
}
```

**4.3 Focus Trap** (CRITICO):
```javascript
function setupFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Salva elemento attivo prima di aprire
  const previouslyFocused = document.activeElement;
  
  // Focus trap
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      // Shift+Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  modal.addEventListener('keydown', trapFocus);
  
  // Focus primo elemento
  firstElement.focus();
  
  // Cleanup al close
  return () => {
    modal.removeEventListener('keydown', trapFocus);
    previouslyFocused?.focus();
  };
}
```

**4.4 Drag & Drop** (se implementato):
```
✅ Applicare SOLO a .modal-dialog (header)
❌ MAI all'overlay
✅ Resettare posizione alla chiusura
```

```javascript
function makeDraggable(modalDialog) {
  const header = modalDialog.querySelector('.modal-header');
  if (!header) return;
  
  let isDragging = false;
  let initialX, initialY, currentX, currentY;
  
  header.style.cursor = 'move';
  
  function onMouseDown(e) {
    isDragging = true;
    initialX = e.clientX - (modalDialog.offsetLeft || 0);
    initialY = e.clientY - (modalDialog.offsetTop || 0);
  }
  
  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    
    modalDialog.style.position = 'absolute';
    modalDialog.style.left = currentX + 'px';
    modalDialog.style.top = currentY + 'px';
  }
  
  function onMouseUp() {
    isDragging = false;
  }
  
  header.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  // Cleanup
  return () => {
    header.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // Reset posizione
    modalDialog.style.position = '';
    modalDialog.style.left = '';
    modalDialog.style.top = '';
  };
}
```

---

### **Principio 5: Versioning e Migrazioni**

**Problema**: Import JSON da versioni precedenti rompe l'app.

**DIRETTIVA OBBLIGATORIA**:
```
✅ Ogni stato JSON deve avere schema_version
✅ In import, controllare versione e migrare se necessario
✅ Fornire feedback visivo (Toast) su errori/migrazioni
```

**Implementazione**:
```javascript
// Versione corrente
const CURRENT_SCHEMA_VERSION = "4.0";

// Struttura JSON
const state = {
  schema_version: CURRENT_SCHEMA_VERSION,
  filaments: [...],
  purchasedFilaments: [...],
  // ... altri dati
};

// Migrazioni
const migrations = {
  "2.0": function migrateFrom2to3(data) {
    // Migra main_fraction → open_spools_fractions
    data.filaments = data.filaments.map(f => {
      if (f.main_fraction !== undefined && !f.open_spools_fractions) {
        f.open_spools_fractions = [f.main_fraction];
        delete f.main_fraction;
      }
      return f;
    });
    
    data.schema_version = "3.0";
    return data;
  },
  
  "3.0": function migrateFrom3to4(data) {
    // Aggiungi campo nuovo se necessario
    data.filaments = data.filaments.map(f => ({
      ...f,
      spools_variants: f.spools_variants || []
    }));
    
    data.schema_version = "4.0";
    return data;
  }
};

// Funzione import con migrazione
export function importJson(jsonString) {
  try {
    let data = JSON.parse(jsonString);
    
    // Se manca schema_version, è versione antica
    if (!data.schema_version) {
      data.schema_version = "1.0";
    }
    
    // Applica migrazioni in sequenza
    let currentVersion = data.schema_version;
    const versions = ["2.0", "3.0", "4.0"];
    
    for (const version of versions) {
      if (currentVersion < version && migrations[currentVersion]) {
        console.log(`Migrating from ${currentVersion} to next version...`);
        data = migrations[currentVersion](data);
        currentVersion = data.schema_version;
      }
    }
    
    // Verifica versione finale
    if (data.schema_version !== CURRENT_SCHEMA_VERSION) {
      showToast(`Dati migrati da v${data.schema_version} a v${CURRENT_SCHEMA_VERSION}`, 'info');
    }
    
    // Normalizza dati
    data = normalizeAndValidateState(data);
    
    return data;
    
  } catch (e) {
    console.error("Errore import JSON:", e);
    showToast("Errore: File JSON non valido", 'error');
    return null;
  }
}
```

---

### **Principio 6: Separazione Domini**

**DIRETTIVA OBBLIGATORIA**:
```
Il codice DEVE essere organizzato in layer distinti:

1. DOMINIO (domain/)
   - Logica pura (funzioni pure)
   - Calcoli matematici
   - Validazioni business
   - ZERO dipendenze da DOM/localStorage

2. STATO (state.js)
   - Gestione stato in memoria
   - Pattern observer/store
   - Immutabilità

3. PERSISTENZA (store.js)
   - localStorage I/O
   - Import/Export JSON
   - Versioning

4. UI (ui/)
   - Rendering HTML
   - Event handlers
   - Interazioni DOM
```

**Struttura File OBBLIGATORIA**:
```
/
├── index.html
├── styles.css
└── src/
    ├── main.js              # Orchestrator
    ├── domain/
    │   └── filaments.js    # ✅ Logica pura
    ├── state.js            # ✅ State management
    ├── store.js            # ✅ Persistenza
    └── ui/
        ├── render.js       # ✅ Rendering
        └── events.js       # ✅ Eventi
```

---

### **Principio 7: ID Univoci e Sicuri**

**DIRETTIVA OBBLIGATORIA**:
```
✅ Usare crypto.randomUUID() per tutti gli ID
❌ NON usare timestamp + random
```

**Implementazione**:
```javascript
// ✅ CORRETTO
function createFilament(data) {
  return {
    id: crypto.randomUUID(),  // "550e8400-e29b-41d4-a716-446655440000"
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ❌ SBAGLIATO
function createFilament(data) {
  return {
    id: `${Date.now()}-${Math.random()}`,  // Collisioni possibili!
    ...data
  };
}
```

---

# PARTE 2: SPECIFICHE ARCHITETTURALI E TECNICHE 🏗️

## 🎯 STACK TECNOLOGICO

### **Vincoli Tecnologici (NON NEGOZIABILI)**

**OBBLIGATORIO**:
- ✅ **Vanilla JavaScript ES6+** - Moduli import/export
- ✅ **HTML5 Semantico** - Tag appropriati, accessibilità
- ✅ **CSS3 Puro** - Variabili CSS, no preprocessori
- ✅ **localStorage API** - Persistenza locale
- ✅ **crypto.randomUUID()** - Generazione ID

**PROIBITO**:
- ❌ Framework (React, Vue, Angular, Svelte, ecc.)
- ❌ Librerie UI (jQuery, Bootstrap, Tailwind, ecc.)
- ❌ Build Tools (Webpack, Vite, Rollup, ecc.)
- ❌ Transpiler (Babel, TypeScript → compilato)
- ❌ Package Manager per runtime (npm install in produzione)

**Requisiti Browser**:
- Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- Support ES6 Modules
- Support localStorage
- Support crypto.randomUUID()

---

## 📊 MODELLO DATI COMPLETO

### **1. Filamento in Magazzino**

```javascript
{
  // ===== IDENTITY =====
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID v4
  
  // ===== DATI BASE (Input) =====
  brand: "Bambu Lab",              // String, normalizzato
  material: "PLA",                 // String, normalizzato
  variant: "Nero Opaco",           // String (colore/variante)
  packaging: "spool",              // "spool" | "cardboard" | "refill"
  
  // ===== PESI E PREZZI (Input) =====
  unit_weight: 1000,               // Number (grammi per bobina)
  unit_price: 19.99,               // Number | null (prezzo per bobina)
  supplier: "Amazon",              // String
  notes: "Per stampe precisione",  // String
  
  // ===== BOBINE (Input) =====
  sealed_spools: 2,                // Number >= 0
  open_spools: 3,                  // Number >= 0
  
  // ===== ARRAY DINAMICI (Input) =====
  // INVARIANTE: length === open_spools
  open_spools_fractions: [1.0, 0.75, 0.5],  // Array<Number 0-1>
  
  // INVARIANTE: length === (sealed_spools + open_spools)
  spools_locations: [               // Array<String>
    "Scaffale 1",     // Sealed 1
    "Scaffale 1",     // Sealed 2
    "Scrivania",      // Open 1
    "Box Ikea",       // Open 2
    "Scaffale 2"      // Open 3
  ],
  
  // OPZIONALE: Varianti specifiche per bobina
  spools_variants: [],             // Array<String> (se bobine hanno colori diversi)
  
  // ===== METADATA (Input) =====
  location: "Scaffale 1",          // String (retrocompatibilità, prima posizione non vuota)
  createdAt: "2024-12-20T10:00:00.000Z",  // ISO 8601
  updatedAt: "2024-12-20T15:30:00.000Z",  // ISO 8601
  
  // ===== CAMPI CALCOLATI (NON salvare in JSON!) =====
  // Questi vengono calcolati al volo con calculateWeights()
  total_weight: 5000,       // sealed*unit + sum(fractions)*unit
  remaining_weight: 3250    // Alias di total_weight
}
```

### **2. Filamento Comprato**

```javascript
{
  id: "660e9511-f39c-52e5-b827-557766551111",
  brand: "Bambu Lab",
  material: "PLA",
  variant: "Rosso",
  packaging: "spool",
  
  quantity: 3,              // Number di bobine
  unit_weight: 1000,        // Number
  unit_price: 18.50,        // Number | null
  supplier: "Official Store",
  
  order_date: "2024-12-15",            // Date string
  purchasedAt: "2024-12-15T10:00:00.000Z"  // ISO 8601
}
```

### **3. Stato Applicazione**

```javascript
{
  // ===== VERSIONING =====
  schema_version: "4.0",
  
  // ===== DATI PRINCIPALI =====
  filaments: [],           // Array<Filament>
  purchasedFilaments: [],  // Array<PurchasedFilament>
  
  // ===== CONFIGURAZIONE =====
  brandList: [],          // Array<String> (auto-popolata)
  materialList: [         // Array<String> (predefinita + custom)
    "PLA", "PETG", "ABS", "TPU", "Nylon", "ASA", "HIPS"
  ],
  locationList: [         // Array<String> (configurabile utente)
    "Scaffale 1", "Scaffale 2", "Box Ikea", "Scrivania"
  ],
  
  // ===== IMPOSTAZIONI =====
  lowStockThreshold: 0.25,  // Number 0-1 (soglia scorte basse)
  theme: "light",           // "light" | "dark"
  
  // ===== EVENT LOG (opzionale) =====
  eventLog: []  // Array<Event> per tracking consumo
}
```

### **4. Event (opzionale, per tracking)**

```javascript
{
  id: "770f0622-g40d-63f6-c938-668877662222",
  type: "consumption",     // "consumption" | "purchase" | "correction"
  filament_id: "550e8400-e29b-41d4-a716-446655440000",
  delta_grams: -250,       // Number (negativo = consumo, positivo = acquisto)
  timestamp: "2024-12-20T10:00:00.000Z",
  note: "Stampa vaso grande",
  user: "martino"          // Opzionale
}
```

---

## 🎨 INTERFACCIA UTENTE

### **Layout Generale**

```
┌─────────────────────────────────────────────┐
│  Header                                      │
│  [Logo] [Nav Tabs] [Theme] [Settings]       │
├─────────────────────────────────────────────┤
│  Dashboard (Tab attivo)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  Card   │ │  Card   │ │  Card   │       │
│  │ Peso    │ │ Valore  │ │ Scorte  │       │
│  └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────┤
│  Grafici                                     │
│  [Barra Brand] [Barra Materiali]            │
├─────────────────────────────────────────────┤
│  Magazzino (Tab)                             │
│  [Filtri] [Ricerca]                         │
│  ┌─────────────────────────────────────┐   │
│  │ Tabella Filamenti (ordinabile)      │   │
│  │ Brand | Material | Peso | Bobine    │   │
│  └─────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  Acquisti (Tab)                              │
│  [Filtri]                                    │
│  ┌─────────────────────────────────────┐   │
│  │ Tabella Comprati                     │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### **Dashboard - 4 Card Statistiche**

Ogni card ha struttura:
```html
<div class="stat-card">
  <div class="stat-icon">📦</div>
  <div class="stat-value">12,450 g</div>
  <div class="stat-label">Peso Totale</div>
  <div class="stat-subtitle">45 bobine</div>
</div>
```

Card richieste:
1. **Peso Totale** - Somma remaining_weight, numero bobine
2. **Valore Magazzino** - Somma (bobine * prezzo) se disponibile
3. **Scorte Basse** - Conteggio filamenti sotto soglia (con colore alert)
4. **Comprati** - Conteggio filamenti in lista acquisti

### **Tabella Magazzino**

Colonne (tutte ordinabili tranne Azioni):
| Colonna | Tipo | Ordinabile | Descrizione |
|---------|------|------------|-------------|
| Brand | String | ✅ | Nome brand |
| Materiale | String | ✅ | Tipo materiale |
| Colore | String | ✅ | Variante/colore |
| Peso Residuo | Number | ✅ | Grammi disponibili |
| Bobine | String | ❌ | "2S + 3A" (Sigillate/Aperte) |
| Posizioni | Array | ❌ | Lista posizioni o conteggio |
| Packaging | Icon | ✅ | Icona tipo |
| Azioni | Buttons | ❌ | Modifica/Elimina |

### **Modal Edit Filamento - IMPLEMENTAZIONE CRITICA**

Questo è il **componente più importante** dell'intera app!

**Requisiti OBBLIGATORI**:
1. ✅ Rendering dinamico N bobine → N campi
2. ✅ Focus trap (Tab cicla solo dentro modal)
3. ✅ ESC chiude
4. ✅ Scroll interno corretto
5. ✅ Validazione real-time
6. ✅ Preview peso residuo live

**Struttura Modal**:
```
┌────────────────────────────────────┐
│ ✕  Modifica Filamento             │  ← Header draggable
├────────────────────────────────────┤
│ Brand: [___________]               │
│ Materiale: [_______]               │
│ Colore: [__________]               │
│ Packaging: [Select ▼]             │
│ Peso Unitario: [____] g           │
│ Prezzo: [______] €                │
│ Fornitore: [_______]              │
├────────────────────────────────────┤
│ 📦 Bobine Sigillate: [2]          │
│                                    │
│ Bobine Sigillate (2):             │
│ • Bobina 1: Pos [Select ▼]       │  ← Dinamico!
│ • Bobina 2: Pos [Select ▼]       │
├────────────────────────────────────┤
│ 📦 Bobine Aperte: [3]             │
│                                    │
│ Bobine Aperte (3):                │
│ • Bobina 1:                       │  ← Dinamico!
│   Frazione [Select ▼] Pos [▼]    │
│ • Bobina 2:                       │
│   Frazione [Select ▼] Pos [▼]    │
│ • Bobina 3:                       │
│   Frazione [Select ▼] Pos [▼]    │
├────────────────────────────────────┤
│ 💡 Peso residuo: 3,250 g          │  ← Preview live
├────────────────────────────────────┤
│ Note: [____________]              │
├────────────────────────────────────┤
│         [Annulla] [Salva]         │
└────────────────────────────────────┘
```

**Opzioni Frazione** (7 livelli di granularità):
```javascript
const fractionOptions = [
  { value: "1", text: "Piena (100%)" },
  { value: "0.9", text: "Quasi piena (~90%)" },
  { value: "0.75", text: "Tre quarti (~75%)" },
  { value: "0.5", text: "Metà (~50%)" },
  { value: "0.25", text: "Un quarto (~25%)" },
  { value: "0.1", text: "Quasi vuota (~10%)" },
  { value: "0", text: "Finita (0%)" }
];
```

**Implementazione Rendering Dinamico**:
```javascript
function renderOpenSpoolsList(openSpools, existingFractions, existingLocations) {
  const container = document.getElementById("openSpoolsContainer");
  container.innerHTML = "";
  
  // Normalizza array
  const fractions = existingFractions || [];
  while (fractions.length < openSpools) fractions.push(1.0);
  const normalizedFractions = fractions.slice(0, openSpools);
  
  // Salva in window per accesso globale
  window.currentOpenSpoolsFractions = normalizedFractions;
  window.currentSpoolsLocations = existingLocations || [];
  
  // Crea un campo per OGNI bobina
  for (let i = 0; i < openSpools; i++) {
    const spoolDiv = createOpenSpoolField(i, normalizedFractions[i]);
    container.appendChild(spoolDiv);
  }
}

function createOpenSpoolField(index, currentFraction) {
  const div = document.createElement("div");
  div.className = "spool-field";
  
  // Label
  const label = document.createElement("span");
  label.textContent = `Bobina aperta ${index + 1}`;
  label.className = "spool-label";
  
  // Select frazione
  const fractionSelect = document.createElement("select");
  fractionSelect.className = "fraction-select";
  fractionSelect.dataset.index = index;
  
  fractionOptions.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.text;
    if (parseFloat(opt.value) === currentFraction) {
      option.selected = true;
    }
    fractionSelect.appendChild(option);
  });
  
  // Event: aggiorna frazione e preview
  fractionSelect.addEventListener("change", (e) => {
    window.currentOpenSpoolsFractions[index] = parseFloat(e.target.value);
    updateWeightPreview();
  });
  
  // Select posizione
  const locationSelect = createLocationSelect(
    window.currentSpoolsLocations[index] || ""
  );
  locationSelect.dataset.index = index;
  locationSelect.addEventListener("change", (e) => {
    window.currentSpoolsLocations[index] = e.target.value;
  });
  
  div.appendChild(label);
  div.appendChild(fractionSelect);
  div.appendChild(locationSelect);
  
  return div;
}

function updateWeightPreview() {
  const unitWeight = parseFloat(document.getElementById("unitWeight").value) || 0;
  const sealed = parseInt(document.getElementById("sealedSpools").value) || 0;
  const open = parseInt(document.getElementById("openSpools").value) || 0;
  
  const sealedWeight = sealed * unitWeight;
  const fractionsSum = window.currentOpenSpoolsFractions
    ?.slice(0, open)
    .reduce((a, b) => a + b, 0) || 0;
  const openWeight = fractionsSum * unitWeight;
  
  const total = sealedWeight + openWeight;
  
  document.getElementById("weightPreview").textContent = 
    formatNumber(total) + " g";
}
```

---

## ⚙️ FUNZIONALITÀ PRINCIPALI

### **1. Dashboard e Statistiche**

```javascript
// Calcola statistiche complete
export function calculateDashboardStats(filaments, threshold) {
  // Arricchisci filamenti con pesi calcolati
  const enriched = filaments.map(calculateWeights);
  
  const totalWeight = enriched.reduce((sum, f) => sum + f.remaining_weight, 0);
  
  const totalValue = enriched.reduce((sum, f) => {
    if (!f.unit_price) return sum;
    const spools = f.remaining_weight / f.unit_weight;
    return sum + (spools * f.unit_price);
  }, 0);
  
  const totalSpools = filaments.reduce(
    (sum, f) => sum + f.sealed_spools + f.open_spools,
    0
  );
  
  const lowStockCount = enriched.filter(f => 
    isLowStock(f, threshold)
  ).length;
  
  return {
    totalWeight,
    totalValue,
    totalSpools,
    lowStockCount,
    filamentCount: filaments.length
  };
}

// Verifica scorte basse
export function isLowStock(filament, threshold = 0.25) {
  const totalCapacity = filament.sealed_spools + filament.open_spools;
  if (totalCapacity === 0) return false;
  
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const currentCapacity = filament.sealed_spools + fractionsSum;
  
  return (currentCapacity / totalCapacity) <= threshold;
}
```

### **2. Filtri e Ricerca**

```javascript
// Stato filtri
const filters = {
  brand: "",           // Brand selezionato
  material: "",        // Materiale selezionato
  packaging: "",       // Tipo packaging
  lowStockOnly: false  // Solo scorte basse
};

// Applica filtri
export function applyFilters(filaments, filters, threshold) {
  let result = [...filaments];
  
  if (filters.brand) {
    result = result.filter(f => f.brand === filters.brand);
  }
  
  if (filters.material) {
    result = result.filter(f => f.material === filters.material);
  }
  
  if (filters.packaging) {
    result = result.filter(f => f.packaging === filters.packaging);
  }
  
  if (filters.lowStockOnly) {
    result = result.filter(f => isLowStock(f, threshold));
  }
  
  return result;
}

// Ricerca full-text (debounced 300ms)
export function searchFilaments(query, filaments) {
  if (!query || query.trim() === "") return filaments;
  
  const lowerQuery = query.toLowerCase();
  return filaments.filter(f =>
    f.brand.toLowerCase().includes(lowerQuery) ||
    f.material.toLowerCase().includes(lowerQuery) ||
    f.variant.toLowerCase().includes(lowerQuery) ||
    f.supplier?.toLowerCase().includes(lowerQuery) ||
    f.notes?.toLowerCase().includes(lowerQuery)
  );
}
```

### **3. Ordinamento Tabella**

```javascript
let sortState = {
  field: null,      // Campo corrente
  direction: "asc"  // "asc" | "desc"
};

export function sortFilaments(filaments, field, direction) {
  if (!field) return filaments;
  
  return [...filaments].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    // Gestisci null/undefined
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    
    // Confronto stringhe
    if (typeof aVal === "string") {
      const comparison = aVal.localeCompare(bVal);
      return direction === "asc" ? comparison : -comparison;
    }
    
    // Confronto numeri
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

// Setup click headers
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    
    if (sortState.field === field) {
      sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    } else {
      sortState.field = field;
      sortState.direction = "asc";
    }
    
    renderFilamentTable(sortFilaments(filaments, sortState.field, sortState.direction));
  });
});
```

### **4. Import/Export con Versioning**

```javascript
// Export
export function exportJsonToFile(state) {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `filamenti_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast("Backup esportato con successo", "success");
}

// Import con migrazioni (già mostrato in Principio 5)
export function importJsonFromFile(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const imported = importJson(e.target.result);
      
      if (imported) {
        appState.setState(imported);
        save(imported);
        renderAll();
        showToast("Dati importati con successo", "success");
      }
    } catch (err) {
      console.error("Import error:", err);
      showToast("Errore durante l'import", "error");
    }
  };
  
  reader.onerror = () => {
    showToast("Errore lettura file", "error");
  };
  
  reader.readAsText(file);
}
```

---

# PARTE 3: IMPLEMENTAZIONE DETTAGLIATA 💻

## 🔧 MODULI JAVASCRIPT

### **1. domain/filaments.js - Logica Pura**

**Responsabilità**: Funzioni pure, zero side-effects, zero dipendenze DOM/localStorage

```javascript
/**
 * domain/filaments.js
 * Logica business pura per gestione filamenti
 */

// ===== COSTANTI =====
export const DEFAULT_BRANDS = [
  "Bambu Lab", "Polymaker", "Prusament", "eSun", 
  "Sunlu", "Eryone", "Creality", "Overture"
];

export const DEFAULT_MATERIALS = [
  "PLA", "PETG", "ABS", "TPU", "Nylon", "ASA", 
  "HIPS", "PC", "PVA", "BVOH"
];

export const PACKAGING_TYPES = ["spool", "cardboard", "refill"];

export const FRACTION_OPTIONS = [
  { value: 1, text: "Piena (100%)" },
  { value: 0.9, text: "Quasi piena (~90%)" },
  { value: 0.75, text: "Tre quarti (~75%)" },
  { value: 0.5, text: "Metà (~50%)" },
  { value: 0.25, text: "Un quarto (~25%)" },
  { value: 0.1, text: "Quasi vuota (~10%)" },
  { value: 0, text: "Finita (0%)" }
];

// ===== NORMALIZZAZIONE =====

export function canonicalizeBrand(brand) {
  const normalized = brand.trim();
  const match = DEFAULT_BRANDS.find(
    b => b.toLowerCase() === normalized.toLowerCase()
  );
  return match || normalized;
}

export function canonicalizeMaterial(material) {
  const normalized = material.trim().toUpperCase();
  return DEFAULT_MATERIALS.includes(normalized) 
    ? normalized 
    : material.trim();
}

// ===== CALCOLI PESI (Principio 1) =====

/**
 * Calcola pesi totali e residui
 * IMPORTANTE: Non modifica l'oggetto, ritorna nuovo oggetto
 */
export function calculateWeights(filament) {
  const sealedWeight = filament.sealed_spools * filament.unit_weight;
  
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const openWeight = fractionsSum * filament.unit_weight;
  
  return {
    ...filament,
    total_weight: sealedWeight + openWeight,
    remaining_weight: sealedWeight + openWeight
  };
}

// ===== NORMALIZZAZIONE ARRAY (Principio 2) =====

/**
 * Normalizza array bobine secondo invarianti
 */
export function normalizeSpoolArrays(filament) {
  const totalSpools = filament.sealed_spools + filament.open_spools;
  
  // Normalizza frazioni
  let fractions = filament.open_spools_fractions || [];
  while (fractions.length < filament.open_spools) {
    fractions.push(1.0);
  }
  fractions = fractions.slice(0, filament.open_spools);
  
  // Normalizza posizioni
  let locations = filament.spools_locations || [];
  while (locations.length < totalSpools) {
    locations.push("");
  }
  locations = locations.slice(0, totalSpools);
  
  // Normalizza varianti (opzionale)
  let variants = filament.spools_variants || [];
  while (variants.length < totalSpools) {
    variants.push("");
  }
  variants = variants.slice(0, totalSpools);
  
  return {
    ...filament,
    open_spools_fractions: fractions,
    spools_locations: locations,
    spools_variants: variants
  };
}

// ===== VALIDAZIONE =====

/**
 * Valida un filamento
 * Ritorna { valid: boolean, errors: string[] }
 */
export function validateFilament(filament) {
  const errors = [];
  
  if (!filament.brand || filament.brand.trim() === "") {
    errors.push("Brand è obbligatorio");
  }
  
  if (!filament.material || filament.material.trim() === "") {
    errors.push("Materiale è obbligatorio");
  }
  
  if (!filament.variant || filament.variant.trim() === "") {
    errors.push("Colore/Variante è obbligatorio");
  }
  
  if (filament.unit_weight <= 0) {
    errors.push("Peso unitario deve essere maggiore di 0");
  }
  
  if (filament.sealed_spools < 0) {
    errors.push("Bobine sigillate non può essere negativo");
  }
  
  if (filament.open_spools < 0) {
    errors.push("Bobine aperte non può essere negativo");
  }
  
  // Valida frazioni
  if (filament.open_spools > 0) {
    if (!Array.isArray(filament.open_spools_fractions)) {
      errors.push("Frazioni bobine aperte deve essere un array");
    } else if (filament.open_spools_fractions.length !== filament.open_spools) {
      errors.push(`Frazioni deve avere ${filament.open_spools} elementi`);
    } else {
      filament.open_spools_fractions.forEach((f, i) => {
        if (f < 0 || f > 1) {
          errors.push(`Frazione bobina ${i+1} deve essere tra 0 e 1`);
        }
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ===== SCORTE BASSE =====

export function isLowStock(filament, threshold = 0.25) {
  const totalCapacity = filament.sealed_spools + filament.open_spools;
  if (totalCapacity === 0) return false;
  
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const currentCapacity = filament.sealed_spools + fractionsSum;
  
  return (currentCapacity / totalCapacity) <= threshold;
}

// ===== STATISTICHE =====

export function calculateTotalStats(filaments, threshold) {
  const enriched = filaments.map(calculateWeights);
  
  const totalWeight = enriched.reduce((sum, f) => sum + f.remaining_weight, 0);
  
  const totalValue = enriched.reduce((sum, f) => {
    if (!f.unit_price) return sum;
    const spools = f.remaining_weight / f.unit_weight;
    return sum + (spools * f.unit_price);
  }, 0);
  
  const totalSpools = filaments.reduce(
    (sum, f) => sum + f.sealed_spools + f.open_spools,
    0
  );
  
  const lowStockCount = enriched.filter(f => isLowStock(f, threshold)).length;
  
  return {
    totalWeight,
    totalValue,
    totalSpools,
    lowStockCount,
    filamentCount: filaments.length
  };
}

export function calculateStockSummary(filaments) {
  const enriched = filaments.map(calculateWeights);
  
  const byBrand = {};
  const byMaterial = {};
  
  enriched.forEach(f => {
    byBrand[f.brand] = (byBrand[f.brand] || 0) + f.remaining_weight;
    byMaterial[f.material] = (byMaterial[f.material] || 0) + f.remaining_weight;
  });
  
  return { byBrand, byMaterial };
}

// ===== FILTRI E RICERCA =====

export function applyFilters(filaments, filters, threshold) {
  let result = [...filaments];
  
  if (filters.brand) {
    result = result.filter(f => f.brand === filters.brand);
  }
  
  if (filters.material) {
    result = result.filter(f => f.material === filters.material);
  }
  
  if (filters.packaging) {
    result = result.filter(f => f.packaging === filters.packaging);
  }
  
  if (filters.lowStockOnly) {
    result = result.filter(f => isLowStock(f, threshold));
  }
  
  return result;
}

export function searchFilaments(query, filaments) {
  if (!query || query.trim() === "") return filaments;
  
  const lowerQuery = query.toLowerCase();
  return filaments.filter(f =>
    f.brand.toLowerCase().includes(lowerQuery) ||
    f.material.toLowerCase().includes(lowerQuery) ||
    f.variant.toLowerCase().includes(lowerQuery) ||
    f.supplier?.toLowerCase().includes(lowerQuery) ||
    f.notes?.toLowerCase().includes(lowerQuery)
  );
}

export function sortFilaments(filaments, field, direction = "asc") {
  if (!field) return filaments;
  
  return [...filaments].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    
    if (typeof aVal === "string") {
      const comparison = aVal.localeCompare(bVal);
      return direction === "asc" ? comparison : -comparison;
    }
    
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

// ===== UTILITY =====

export function deduplicateFilamentsByIdentity(filaments) {
  const seen = new Set();
  return filaments.filter(f => {
    const key = `${f.brand}-${f.material}-${f.variant}-${f.packaging}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function cleanBrandList(filaments) {
  const brands = new Set(filaments.map(f => f.brand));
  return [...brands].sort((a, b) => a.localeCompare(b));
}
```

### **2. state.js - State Management**

```javascript
/**
 * state.js
 * Gestione stato immutabile con pattern observer
 */

export class AppState {
  constructor() {
    this._state = {
      schema_version: "4.0",
      filaments: [],
      purchasedFilaments: [],
      brandList: [],
      materialList: DEFAULT_MATERIALS,
      locationList: [],
      lowStockThreshold: 0.25,
      theme: "light",
      eventLog: []
    };
    
    this._observers = [];
  }
  
  /**
   * Ottieni copia immutabile dello stato
   */
  getState() {
    return JSON.parse(JSON.stringify(this._state));
  }
  
  /**
   * Aggiorna stato (immutabile)
   */
  setState(newState) {
    if (!newState || typeof newState !== 'object') {
      throw new Error("Invalid state");
    }
    
    // Deep copy per immutabilità
    this._state = JSON.parse(JSON.stringify(newState));
    
    // Notifica observers
    this._notifyObservers();
  }
  
  /**
   * Aggiorna parziale
   */
  patchState(updates) {
    this._state = {
      ...this._state,
      ...updates
    };
    
    this._notifyObservers();
  }
  
  /**
   * Subscribe a cambiamenti
   */
  subscribe(callback) {
    this._observers.push(callback);
    
    // Ritorna unsubscribe function
    return () => {
      this._observers = this._observers.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notifica observers
   */
  _notifyObservers() {
    const state = this.getState();
    this._observers.forEach(callback => {
      try {
        callback(state);
      } catch (err) {
        console.error("Observer error:", err);
      }
    });
  }
}
```

### **3. store.js - Persistenza**

```javascript
/**
 * store.js
 * Gestione persistenza localStorage e I/O
 */

const STORAGE_KEY = 'registroFilamentiState_v4';
const CURRENT_SCHEMA_VERSION = "4.0";

// ===== LOAD/SAVE =====

export function load() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    
    const data = JSON.parse(json);
    
    // Migra se necessario
    return migrateToCurrentVersion(data);
    
  } catch (e) {
    console.error("Errore caricamento:", e);
    return null;
  }
}

export function save(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error("Errore salvataggio:", e);
    return false;
  }
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
}

// ===== MIGRAZIONI (Principio 5) =====

const migrations = {
  "2.0": function migrateFrom2to3(data) {
    data.filaments = data.filaments.map(f => {
      if (f.main_fraction !== undefined && !f.open_spools_fractions) {
        f.open_spools_fractions = [f.main_fraction];
        delete f.main_fraction;
      }
      return f;
    });
    
    data.schema_version = "3.0";
    return data;
  },
  
  "3.0": function migrateFrom3to4(data) {
    // Aggiungi eventLog se mancante
    if (!data.eventLog) {
      data.eventLog = [];
    }
    
    // Normalizza ID a UUID
    data.filaments = data.filaments.map(f => ({
      ...f,
      id: f.id.includes('-') ? f.id : crypto.randomUUID()
    }));
    
    data.schema_version = "4.0";
    return data;
  }
};

function migrateToCurrentVersion(data) {
  if (!data.schema_version) {
    data.schema_version = "1.0";
  }
  
  let currentVersion = data.schema_version;
  const versions = ["2.0", "3.0", "4.0"];
  
  for (const version of versions) {
    if (currentVersion < version && migrations[currentVersion]) {
      console.log(`Migrating from ${currentVersion} to next version...`);
      data = migrations[currentVersion](data);
      currentVersion = data.schema_version;
    }
  }
  
  return data;
}

// ===== IMPORT/EXPORT =====

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

export function importJson(jsonString) {
  try {
    let data = JSON.parse(jsonString);
    
    // Migra se necessario
    data = migrateToCurrentVersion(data);
    
    // Normalizza
    data = normalizeAndValidateState(data);
    
    return data;
    
  } catch (e) {
    console.error("Errore import:", e);
    return null;
  }
}

export function normalizeAndValidateState(state) {
  // Importa qui le funzioni da domain/filaments.js
  import { normalizeSpoolArrays, calculateWeights } from './domain/filaments.js';
  
  // Normalizza filamenti
  const filaments = (state.filaments || []).map(f => {
    let normalized = normalizeSpoolArrays(f);
    
    // Assicura ID UUID
    if (!normalized.id || !normalized.id.includes('-')) {
      normalized.id = crypto.randomUUID();
    }
    
    // Assicura timestamp
    if (!normalized.createdAt) {
      normalized.createdAt = new Date().toISOString();
    }
    normalized.updatedAt = new Date().toISOString();
    
    return normalized;
  });
  
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    filaments,
    purchasedFilaments: state.purchasedFilaments || [],
    brandList: state.brandList || [],
    materialList: state.materialList || DEFAULT_MATERIALS,
    locationList: state.locationList || [],
    lowStockThreshold: state.lowStockThreshold || 0.25,
    theme: state.theme || "light",
    eventLog: state.eventLog || []
  };
}
```

---

## 🎨 STILE E DESIGN

### **Sistema Colori e Variabili CSS**

```css
:root {
  /* ===== COLORI PRIMARI ===== */
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --primary-light: #818cf8;
  
  /* ===== COLORI FUNZIONALI ===== */
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #3b82f6;
  
  /* ===== THEME LIGHT ===== */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-soft: #f3f4f6;
  --surface-soft: #e5e7eb;
  
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  
  --border: #e5e7eb;
  --border-strong: #d1d5db;
  
  /* ===== SHADOWS ===== */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
  
  /* ===== SPACING ===== */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* ===== BORDER RADIUS ===== */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  
  /* ===== TRANSITIONS ===== */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}

/* THEME DARK */
[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --bg-soft: #374151;
  --surface-soft: #4b5563;
  
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  
  --border: #374151;
  --border-strong: #4b5563;
  
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
}
```

### **Modal CSS (Principio 4) - CRITICO**

```css
/* ===== MODAL OVERLAY ===== */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  
  display: none;
  align-items: flex-start;  /* ✅ NON center! */
  justify-content: center;
  
  z-index: 1000;
  padding: 2rem 1rem;
  overflow-y: auto;  /* ✅ Scroll esterno */
  
  animation: fadeIn var(--transition-base);
}

.modal.is-open {
  display: flex;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ===== MODAL DIALOG ===== */
.modal-dialog {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 600px;
  max-height: none;  /* ✅ NO limite */
  margin: 0 auto;
  box-shadow: var(--shadow-xl);
  
  animation: slideDown var(--transition-base);
  
  /* Per drag & drop */
  position: relative;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== MODAL HEADER ===== */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border);
  
  /* Per drag & drop */
  cursor: move;
  user-select: none;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color var(--transition-fast);
}

.modal-close:hover {
  color: var(--text-primary);
}

/* ===== MODAL BODY ===== */
.modal-body {
  padding: var(--spacing-lg);
  max-height: calc(100vh - 16rem);  /* ✅ Limite interno */
  overflow-y: auto;  /* ✅ Scroll interno */
  padding-right: calc(var(--spacing-lg) + 0.5rem);  /* Spazio scrollbar */
}

/* Scrollbar styling */
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: var(--radius-sm);
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* ===== MODAL FOOTER ===== */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border);
}

/* ===== BODY QUANDO MODAL APERTO ===== */
body.modal-open {
  overflow: hidden !important;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .modal {
    padding: 1rem 0.5rem;
  }
  
  .modal-dialog {
    max-width: 95%;
  }
  
  .modal-body {
    max-height: calc(100vh - 12rem);
    padding: var(--spacing-md);
  }
  
  .modal-header,
  .modal-footer {
    padding: var(--spacing-md);
  }
}
```

---

# PARTE 4: CHECKLIST E CRITERI DI SUCCESSO ✅

## 📋 CHECKLIST IMPLEMENTAZIONE

### **MUST HAVE** (Obbligatorio - Tutti devono essere ✅)

**Architettura**:
- [ ] Moduli ES6 (7 file: main, state, store, validation, domain/filaments, ui/render, ui/events)
- [ ] Separazione domini (logica pura, stato, persistenza, UI)
- [ ] Zero dipendenze esterne
- [ ] Funziona su server statico (no build)

**Principi Robustezza**:
- [ ] Coerenza dati (solo input salvato, calcoli al volo)
- [ ] Invarianti array (normalizzazione automatica)
- [ ] Versioning JSON (schema_version + migrazioni)
- [ ] UUID per ID (crypto.randomUUID())
- [ ] Validazione completa input

**Modal**:
- [ ] Focus trap funzionante
- [ ] ESC chiude
- [ ] Overlay chiude
- [ ] Scroll interno corretto
- [ ] Body overflow: hidden quando aperto
- [ ] Rendering bobine dinamico (N bobine → N campi)

**Funzionalità Core**:
- [ ] Dashboard (4 card statistiche)
- [ ] Tabella magazzino ordinabile
- [ ] Gestione bobine multiple (frazioni + posizioni)
- [ ] Filtri (brand, material, packaging, low stock)
- [ ] Ricerca full-text (debounced)
- [ ] Import/Export JSON (con migrazioni)
- [ ] Theme dark/light
- [ ] Toast notifications

**UX**:
- [ ] Feedback visivo operazioni (loading, success, error)
- [ ] Validazione real-time form
- [ ] Preview peso residuo live
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Keyboard shortcuts (ESC, Ctrl+S)
- [ ] Conferma azioni distruttive

### **SHOULD HAVE** (Fortemente Raccomandato)

- [ ] Animazioni smooth (fade, slide)
- [ ] Empty states curati
- [ ] Error boundaries
- [ ] Console logging strutturato
- [ ] Commenti JSDoc
- [ ] README completo

### **NICE TO HAVE** (Opzionale)

- [ ] Drag & drop modal (solo header)
- [ ] Event log per tracking consumo
- [ ] Undo/Redo
- [ ] Export PDF report
- [ ] PWA (Service Worker)

---

## 🎯 CRITERI DI SUCCESSO

L'applicazione è considerata **completa e production-ready** se soddisfa:

### **1. Robustezza Dati** ✅
- ✅ Nessuna incoerenza calcoli (sempre fresh)
- ✅ Array sempre allineati (nessun valore appeso)
- ✅ Migrazioni funzionanti (vecchi JSON importabili)
- ✅ Validazione previene corruzione

### **2. UX Fluida** ✅
- ✅ Modal si comportano uniformemente
- ✅ Focus trap mantiene accessibilità
- ✅ Scroll sempre corretto (mai fuori viewport)
- ✅ Feedback chiaro per ogni azione
- ✅ Zero "comportamenti strani"

### **3. Codice Manutenibile** ✅
- ✅ Separazione concerns rispettata
- ✅ Funzioni pure testabili
- ✅ Naming consistente e chiaro
- ✅ Nessuna dipendenza circolare
- ✅ Commenti dove necessario

### **4. Performance** ✅
- ✅ First render < 100ms
- ✅ Re-render on update < 50ms
- ✅ Ricerca debounced (300ms)
- ✅ localStorage save < 10ms

### **5. Accessibilità** ✅
- ✅ HTML semantico
- ✅ ARIA labels dove necessario
- ✅ Keyboard navigation completa
- ✅ Focus visibile
- ✅ Contrasto colori adeguato

---

## 🚀 DELIVERABLE FINALI

Devi fornire questi file:

### **1. File Applicazione** (9 file)
```
✅ index.html (con template modal)
✅ styles.css (con variabili e fix modal)
✅ src/main.js
✅ src/state.js
✅ src/store.js
✅ src/domain/filaments.js
✅ src/ui/render.js
✅ src/ui/events.js
```

### **2. Documentazione** (3 file)
```
✅ README.md - Istruzioni uso
✅ ARCHITECTURE.md - Spiegazione architettura
✅ CHANGELOG.md - Versioni e fix
```

### **3. File Opzionali**
```
⏸️ data-example.json - Dati demo
⏸️ TESTING.md - Guida testing manuale
```

---

# CONCLUSIONE 🎉

## 🎯 **RECAP SUPER PROMPT**

Questo prompt integra:

✅ **Filosofia Robusta** (Parte 1)
- Principi non negoziabili
- Best practices testate
- Focus su solidità

✅ **Specifiche Dettagliate** (Parte 2)
- Stack tecnologico
- Modello dati completo
- UI/UX definita

✅ **Implementazione Concreta** (Parte 3)
- Codice esempio per ogni modulo
- CSS completo con fix
- Pattern avanzati

✅ **Quality Assurance** (Parte 4)
- Checklist verificabile
- Criteri oggettivi
- Deliverable chiari

---

## 💪 **GARANZIE**

Seguendo questo prompt, otterrai:

1. ✅ **App Robusta** - Zero bug modal, dati sempre coerenti
2. ✅ **Codice Manutenibile** - Separazione domini, funzioni pure
3. ✅ **UX Professionale** - Focus trap, scroll corretto, feedback chiari
4. ✅ **Production Ready** - Versioning, migrazioni, validazione completa
5. ✅ **Zero Dipendenze** - Vanilla JS, gira ovunque

---

## 🚀 **INIZIA LO SVILUPPO!**

**Priorità implementazione**:
1. Domain logic (filaments.js) - Logica pura
2. State + Store - Gestione dati
3. UI Basic - Rendering senza modal
4. Modal con focus trap - Feature critica
5. Filtri e ricerca - UX
6. Polish - Animazioni, error handling

**Testa frequentemente**:
- Dopo ogni modulo
- Con dati reali
- Su diversi browser
- Mobile e desktop

**Mantieni i principi**:
- Dati coerenti (Principio 1)
- Array allineati (Principio 2)
- Modal robusti (Principio 4)
- Versioning (Principio 5)

---

**Buon lavoro! 🎨💻🚀**
