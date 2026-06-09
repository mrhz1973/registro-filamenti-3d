# 🎯 PROMPT COMPLETO: Applicazione Web Registro Filamenti 3D Printing

## 📋 PANORAMICA GENERALE

Crea un'applicazione web completa per la gestione dell'inventario di filamenti per stampanti 3D. L'app deve essere una Single Page Application (SPA) con architettura modulare ES6, completamente funzionante offline, con persistenza localStorage e senza dipendenze esterne.

---

## 🎯 OBIETTIVI PRINCIPALI

L'applicazione deve permettere agli utenti di:
1. **Gestire un magazzino** di filamenti disponibili (in stock)
2. **Tracciare filamenti comprati** non ancora in uso
3. **Monitorare scorte basse** con alert automatici
4. **Gestire bobine multiple** dello stesso filamento con frazioni e posizioni diverse
5. **Analizzare statistiche** di consumo e valore inventario
6. **Importare/Esportare** dati in JSON per backup

---

## 🏗️ ARCHITETTURA TECNICA

### **Stack Tecnologico**

**OBBLIGATORIO**:
- ✅ Vanilla JavaScript ES6+ (NO framework esterni)
- ✅ HTML5 semantico
- ✅ CSS3 puro (NO preprocessori)
- ✅ Moduli ES6 (import/export)
- ✅ localStorage API per persistenza
- ✅ ZERO dipendenze npm/cdn

**PROIBITO**:
- ❌ React, Vue, Angular o altri framework
- ❌ jQuery
- ❌ Bootstrap, Tailwind o altri framework CSS
- ❌ Build tools (Webpack, Vite, ecc.)
- ❌ Transpiler (Babel)
- ❌ Backend/Database

### **Struttura File Modulare**

```
registro_filamenti/
├── index.html                      # Entry point HTML
├── styles.css                      # Stili globali
└── src/                           # Moduli JavaScript
    ├── main.js                    # Entry point, coordinamento
    ├── state.js                   # Gestione stato applicazione
    ├── store.js                   # Persistenza localStorage
    ├── validation.js              # Validazione e normalizzazione
    ├── domain/
    │   └── filaments.js          # Logica business
    └── ui/
        ├── render.js             # Rendering UI
        └── events.js             # Event handlers
```

---

## 📊 MODELLO DATI

### **1. Filamento in Magazzino**

```javascript
{
  id: "timestamp-random",              // UUID univoco
  brand: "Bambu Lab",                  // Brand normalizzato
  material: "PLA",                     // Tipo materiale
  variant: "Nero Opaco",               // Colore/variante
  packaging: "spool",                  // spool | cardboard | refill
  unit_weight: 1000,                   // Grammi per bobina (number)
  unit_price: 19.99,                   // Prezzo unitario (number|null)
  supplier: "Amazon",                  // Fornitore (string)
  notes: "Per stampe precisione",      // Note (string)
  
  // Bobine
  sealed_spools: 2,                    // Bobine sigillate (number)
  open_spools: 3,                      // Bobine aperte (number)
  
  // Array frazioni bobine aperte (uno per bobina)
  open_spools_fractions: [1, 0.75, 0.5], // Frazione 0-1 per ogni bobina aperta
  
  // Array posizioni (sealed poi open)
  spools_locations: [                  // Posizione fisica per ogni bobina
    "Scaffale 1",                      // Bobina sigillata 1
    "Scaffale 1",                      // Bobina sigillata 2
    "Scrivania",                       // Bobina aperta 1
    "Box Ikea",                        // Bobina aperta 2
    "Scaffale 2"                       // Bobina aperta 3
  ],
  
  // Array varianti (opzionale, per bobine colori diversi)
  spools_variants: [],                 // Colore specifico per bobina
  
  // Campi calcolati
  total_weight: 5000,                  // Peso totale (auto-calcolato)
  remaining_weight: 3250,              // Peso residuo (auto-calcolato)
  
  // Metadata
  location: "Scaffale 1",              // Posizione principale (retrocompatibilità)
  createdAt: "2024-12-20T10:00:00Z",  // Timestamp creazione
  updatedAt: "2024-12-20T10:00:00Z"   // Timestamp ultimo aggiornamento
}
```

### **2. Filamento Comprato**

```javascript
{
  id: "timestamp-random",
  brand: "Bambu Lab",
  material: "PLA",
  variant: "Rosso",
  packaging: "spool",
  quantity: 3,                         // Numero bobine
  unit_weight: 1000,
  unit_price: 18.50,
  supplier: "Official Store",
  order_date: "2024-12-15",
  purchasedAt: "2024-12-15T10:00:00Z"
}
```

### **3. Stato Applicazione**

```javascript
{
  filaments: [],           // Array filamenti in magazzino
  purchasedFilaments: [],  // Array filamenti comprati
  brandList: [],          // Lista brand (auto-popolata)
  materialList: [],       // Lista materiali predefiniti
  locationList: []        // Lista posizioni configurabili
}
```

### **4. Configurazione (localStorage separato)**

```javascript
{
  locationList: [          // Posizioni fisiche configurabili
    "Scaffale 1",
    "Scaffale 2", 
    "Box Ikea",
    "Scrivania"
  ],
  lowStockThreshold: 0.25  // Soglia scorte basse (frazione)
}
```

---

## 🎨 INTERFACCIA UTENTE

### **Layout Generale**

```
┌─────────────────────────────────────────────┐
│  🎨 Header: Logo + Tema Toggle + Settings   │
├─────────────────────────────────────────────┤
│  📊 Dashboard: 4 Card Statistiche           │
├─────────────────────────────────────────────┤
│  📈 Grafici: Brand | Materiali              │
├─────────────────────────────────────────────┤
│  🔍 Filtri + Ricerca                        │
├─────────────────────────────────────────────┤
│  📋 Tabella Magazzino (ordinabile)          │
│     - Colonne: Brand | Material | Variant   │
│       Peso | Bobine | Posizioni | Azioni    │
├─────────────────────────────────────────────┤
│  🛒 Tabella Comprati                        │
│     - Colonne: Data | Brand | Material      │
│       Quantità | Prezzo | Azioni            │
└─────────────────────────────────────────────┘
```

### **Dashboard - 4 Card Statistiche**

```javascript
1. Peso Totale Magazzino
   - Icona: 📦
   - Valore: "12,450 g" (formattato con separatori migliaia)
   - Sottotitolo: "XX bobine totali"

2. Valore Magazzino  
   - Icona: 💰
   - Valore: "€ 234.50" (se prezzi disponibili)
   - Sottotitolo: "Valore stimato"

3. Scorte Basse
   - Icona: ⚠️
   - Valore: "3 filamenti" (conteggio sotto soglia)
   - Colore: Rosso se > 0, verde altrimenti

4. Filamenti Comprati
   - Icona: 🛒
   - Valore: "5 in attesa"
   - Sottotitolo: "Da aggiungere a magazzino"
```

### **Grafici**

```javascript
// Grafico 1: Distribuzione Brand
- Barra orizzontale per ogni brand
- Larghezza proporzionale al peso totale
- Label: "Brand Name - XXX g"
- Top 5 brands + "Altri"

// Grafico 2: Distribuzione Materiali  
- Barra orizzontale per ogni materiale
- Larghezza proporzionale al peso totale
- Label: "Material - XXX g"
- Colori distintivi per materiale
```

### **Tabella Magazzino - Colonne**

| Colonna | Descrizione | Ordinabile |
|---------|-------------|-----------|
| Brand | Nome brand | ✅ |
| Materiale | Tipo materiale | ✅ |
| Colore | Variante/colore | ✅ |
| Peso Residuo | Grammi disponibili | ✅ |
| Bobine | "2S + 3A" (Sigillate/Aperte) | ✅ |
| Posizioni | Lista posizioni | ❌ |
| Packaging | Icona tipo | ✅ |
| Azioni | Modifica/Elimina | ❌ |

### **Modal Edit Filamento - CRITICO**

**REQUISITO FONDAMENTALE**: Gestione bobine multiple dinamica!

```
┌─────────────────────────────────────────┐
│  Modifica Filamento                     │
├─────────────────────────────────────────┤
│  Brand: [Input]                         │
│  Materiale: [Input]                     │
│  Colore: [Input]                        │
│  Packaging: [Select]                    │
│  Peso Unitario: [Number] g             │
│  Prezzo: [Number] €                     │
│  Fornitore: [Input]                     │
├─────────────────────────────────────────┤
│  📦 Bobine:                             │
│     Sigillate: [Number]                 │
│     Aperte: [Number]                    │
├─────────────────────────────────────────┤
│  📋 Bobine Sigillate:                   │
│  [Se > 0, mostra lista dinamica]        │
│    • Bobina 1: Posizione [Select]      │
│    • Bobina 2: Posizione [Select]      │
├─────────────────────────────────────────┤
│  📋 Bobine Aperte:                      │
│  [Se > 0, mostra lista dinamica]        │
│    • Bobina 1:                          │
│        Frazione: [Select: 100%/75%/50%/25%/0%] │
│        Posizione: [Select]              │
│    • Bobina 2:                          │
│        Frazione: [Select]               │
│        Posizione: [Select]              │
├─────────────────────────────────────────┤
│  Peso residuo stimato: 2,250 g          │
│  [Preview calcolato in tempo reale]     │
├─────────────────────────────────────────┤
│  Note: [Textarea]                       │
├─────────────────────────────────────────┤
│  [Annulla] [Salva]                      │
└─────────────────────────────────────────┘
```

**IMPLEMENTAZIONE BOBINE MULTIPLE**:

```javascript
// Quando l'utente cambia il numero di bobine aperte:
function renderOpenSpoolsList(openSpools, existingFractions) {
  const container = document.getElementById("openSpoolsContainer");
  container.innerHTML = "";
  
  // Crea un campo per OGNI bobina
  for (let i = 0; i < openSpools; i++) {
    const spoolDiv = createSpoolField(i, existingFractions[i] || 1);
    container.appendChild(spoolDiv);
  }
}

function createSpoolField(index, currentFraction) {
  // Crea div container
  const div = document.createElement("div");
  
  // Label
  const label = document.createElement("span");
  label.textContent = `Bobina aperta ${index + 1}`;
  
  // Select frazione
  const fractionSelect = document.createElement("select");
  fractionSelect.innerHTML = `
    <option value="1">Piena (100%)</option>
    <option value="0.75">Tre quarti (75%)</option>
    <option value="0.5">Metà (50%)</option>
    <option value="0.25">Un quarto (25%)</option>
    <option value="0">Finita (0%)</option>
  `;
  fractionSelect.value = currentFraction;
  
  // Event listener per aggiornare preview peso
  fractionSelect.addEventListener("change", updateWeightPreview);
  
  // Select posizione
  const locationSelect = createLocationSelect();
  
  div.appendChild(label);
  div.appendChild(fractionSelect);
  div.appendChild(locationSelect);
  
  return div;
}
```

---

## ⚙️ FUNZIONALITÀ PRINCIPALI

### **1. Dashboard e Statistiche**

```javascript
// Calcola statistiche in tempo reale
function calculateTotalStats(filaments) {
  return {
    totalWeight: sum(filaments.map(f => f.remaining_weight)),
    totalValue: sum(filaments.map(f => 
      (f.remaining_weight / f.unit_weight) * (f.unit_price || 0)
    )),
    totalSpools: sum(filaments.map(f => 
      f.sealed_spools + f.open_spools
    )),
    lowStockCount: filaments.filter(f => 
      isLowStock(f, threshold)
    ).length
  };
}

function isLowStock(filament, threshold) {
  const totalCapacity = filament.sealed_spools + filament.open_spools;
  if (totalCapacity === 0) return false;
  
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const currentCapacity = filament.sealed_spools + fractionsSum;
  
  return (currentCapacity / totalCapacity) <= threshold;
}
```

### **2. Filtri e Ricerca**

```javascript
// Filtri multipli
const filters = {
  brand: "",           // Filtra per brand
  material: "",        // Filtra per materiale  
  packaging: "",       // Filtra per packaging
  lowStockOnly: false  // Solo scorte basse
};

// Ricerca full-text (debounced 300ms)
function searchFilaments(query, filaments) {
  const lowerQuery = query.toLowerCase();
  return filaments.filter(f => 
    f.brand.toLowerCase().includes(lowerQuery) ||
    f.material.toLowerCase().includes(lowerQuery) ||
    f.variant.toLowerCase().includes(lowerQuery) ||
    f.supplier?.toLowerCase().includes(lowerQuery)
  );
}
```

### **3. Ordinamento Tabella**

```javascript
// Click su header colonna → ordina
let sortState = {
  field: null,      // Campo corrente
  direction: "asc"  // asc | desc
};

function sortFilaments(filaments, field, direction) {
  return [...filaments].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (typeof aVal === "string") {
      return direction === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return direction === "asc"
      ? aVal - bVal
      : bVal - aVal;
  });
}
```

### **4. Aggiungi/Modifica Filamento**

**Validazioni obbligatorie**:
- ✅ Brand non vuoto
- ✅ Material non vuoto  
- ✅ Variant non vuoto
- ✅ unit_weight > 0
- ✅ sealed_spools >= 0
- ✅ open_spools >= 0
- ✅ open_spools_fractions.length === open_spools
- ✅ Tutte le frazioni tra 0 e 1

**Calcoli automatici**:
```javascript
function recalcWeightsForFilament(filament) {
  // Peso totale bobine sigillate
  const sealedWeight = filament.sealed_spools * filament.unit_weight;
  
  // Peso totale bobine aperte (somma frazioni)
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const openWeight = fractionsSum * filament.unit_weight;
  
  filament.total_weight = sealedWeight + openWeight;
  filament.remaining_weight = sealedWeight + openWeight;
  
  return filament;
}
```

### **5. Import/Export JSON**

```javascript
// Export
function exportJson(state) {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `registro_filamenti_${timestamp()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Import
function importJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    const validated = normalizeAndValidateState(data);
    return validated;
  } catch (e) {
    console.error("Invalid JSON", e);
    return null;
  }
}
```

### **6. Aggiungi a Magazzino**

```javascript
// Da filamento comprato → magazzino
function addToStock(purchasedFilament) {
  const newFilament = {
    id: generateId(),
    brand: purchasedFilament.brand,
    material: purchasedFilament.material,
    variant: purchasedFilament.variant,
    packaging: purchasedFilament.packaging,
    unit_weight: purchasedFilament.unit_weight,
    unit_price: purchasedFilament.unit_price,
    supplier: purchasedFilament.supplier,
    sealed_spools: purchasedFilament.quantity || 1,
    open_spools: 0,
    open_spools_fractions: [],
    spools_locations: [],
    createdAt: new Date().toISOString()
  };
  
  // Ricalcola pesi
  return recalcWeightsForFilament(newFilament);
}
```

---

## 🎨 STILE E DESIGN

### **Tema e Colori**

```css
:root {
  /* Colori primari */
  --primary: #6366f1;          /* Indigo */
  --primary-dark: #4f46e5;
  --primary-light: #818cf8;
  
  /* Colori secondari */
  --success: #10b981;          /* Green */
  --warning: #f59e0b;          /* Amber */
  --danger: #ef4444;           /* Red */
  --info: #3b82f6;            /* Blue */
  
  /* Neutri light theme */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-soft: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border: #e5e7eb;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --bg-soft: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af;
  --border: #374151;
}
```

### **Componenti UI**

**Card**:
```css
.card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border);
}
```

**Button**:
```css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

**Table**:
```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
}

.table th {
  background: var(--bg-soft);
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.table th:hover {
  background: var(--bg-secondary);
}

.table td {
  padding: 1rem;
  border-top: 1px solid var(--border);
}

.table tr:hover {
  background: var(--bg-secondary);
}
```

**Modal** (IMPORTANTE - FIX SCROLL):
```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: none;
  align-items: flex-start;  /* ✅ NON center! */
  justify-content: center;
  z-index: 1000;
  padding: 2rem 1rem;
  overflow-y: auto;         /* ✅ Scroll esterno */
}

.modal.is-open {
  display: flex;
}

.modal-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: none;        /* ✅ NO limite altezza */
  margin: 0 auto;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 1.5rem;
  max-height: calc(100vh - 16rem);  /* ✅ Limite interno */
  overflow-y: auto;                 /* ✅ Scroll interno */
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
```

**Toast Notifications**:
```css
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: var(--bg-primary);
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border-left: 4px solid var(--primary);
  z-index: 2000;
  animation: slideIn 0.3s ease;
}

.toast.success { border-left-color: var(--success); }
.toast.error { border-left-color: var(--danger); }
.toast.warning { border-left-color: var(--warning); }

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### **Responsive Design**

```css
/* Tablet */
@media (max-width: 768px) {
  .dashboard-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .modal-dialog {
    max-width: 90%;
  }
}

/* Mobile */
@media (max-width: 480px) {
  .dashboard-cards {
    grid-template-columns: 1fr;
  }
  
  .table {
    font-size: 0.875rem;
  }
  
  .table th,
  .table td {
    padding: 0.5rem;
  }
}
```

---

## 🔧 MODULI JAVASCRIPT - DETTAGLI

### **1. main.js - Entry Point**

**Responsabilità**:
- Inizializzazione app
- Coordinamento tra moduli
- Setup event listeners globali
- Funzioni modal e UI principale

**Struttura**:
```javascript
// Imports
import { AppState } from './state.js';
import { load, save } from './store.js';
import { normalizeAndValidateState } from './validation.js';
import { calculateTotalStats, isLowStock, /* ... */ } from './domain/filaments.js';
import { renderAll, renderFilamentTable, /* ... */ } from './ui/render.js';
import { setupAllEvents, showToast } from './ui/events.js';

// Costanti
const APP_VERSION = "3.0";
const LOCATION_LIST_KEY = "registroFilamentiLocationList";
const LOW_STOCK_THRESHOLD_KEY = "registroFilamentiLowStockThreshold";

// Stato globale
let appState = new AppState();
let locationList = [];
let lowStockThreshold = 0.25;
let currentEditingFilamentId = null;

// Inizializzazione
async function init() {
  loadConfiguration();
  const savedState = load();
  if (savedState) {
    appState.setState(normalizeAndValidateState(savedState));
  }
  setupAllEvents({ /* callbacks */ });
  render();
}

// Rendering
function render() {
  const state = appState.getState();
  renderDashboard(calculateTotalStats(state.filaments));
  renderFilamentTable(state.filaments);
  renderPurchasedTable(state.purchasedFilaments);
}

// CRITICO: Funzione modal edit completa
function openEditFilamentModal(id) {
  const filament = appState.getState().filaments.find(f => f.id === id);
  
  // Popola campi base
  document.getElementById("editBrand").value = filament.brand;
  // ... altri campi ...
  
  // IMPORTANTE: Rendering bobine multiple
  renderEditSealedSpoolsList(filament.sealed_spools, filament.spools_locations);
  renderEditOpenSpoolsList(
    filament.open_spools, 
    filament.open_spools_fractions,
    filament.spools_locations
  );
  
  // Event listeners
  setupModalEventListeners();
  
  // Mostra modal
  document.getElementById("editFilamentModal").classList.add("is-open");
}

function renderEditOpenSpoolsList(count, fractions, locations) {
  const container = document.getElementById("openSpoolsContainer");
  container.innerHTML = "";
  
  // Salva in window per applyEditFilament
  window.currentOpenSpoolsFractions = fractions || [];
  window.currentSpoolsLocations = locations || [];
  
  for (let i = 0; i < count; i++) {
    const spoolDiv = createOpenSpoolField(i, fractions[i], locations[i]);
    container.appendChild(spoolDiv);
  }
}

function createOpenSpoolField(index, fraction, location) {
  // Crea container
  const div = document.createElement("div");
  
  // Label
  const label = document.createElement("span");
  label.textContent = `Bobina aperta ${index + 1}`;
  
  // Select frazione
  const fractionSelect = document.createElement("select");
  fractionSelect.innerHTML = `
    <option value="1" ${fraction === 1 ? 'selected' : ''}>Piena (100%)</option>
    <option value="0.75" ${fraction === 0.75 ? 'selected' : ''}>Tre quarti (75%)</option>
    <option value="0.5" ${fraction === 0.5 ? 'selected' : ''}>Metà (50%)</option>
    <option value="0.25" ${fraction === 0.25 ? 'selected' : ''}>Un quarto (25%)</option>
    <option value="0" ${fraction === 0 ? 'selected' : ''}>Finita (0%)</option>
  `;
  fractionSelect.dataset.index = index;
  fractionSelect.addEventListener("change", (e) => {
    window.currentOpenSpoolsFractions[index] = parseFloat(e.target.value);
    updateWeightPreview();
  });
  
  // Select posizione
  const locationSelect = createLocationSelect(location);
  locationSelect.dataset.index = index;
  locationSelect.addEventListener("change", (e) => {
    window.currentSpoolsLocations[index] = e.target.value;
  });
  
  div.appendChild(label);
  div.appendChild(fractionSelect);
  div.appendChild(locationSelect);
  
  return div;
}

function applyEditFilament() {
  const filament = appState.getState().filaments.find(
    f => f.id === currentEditingFilamentId
  );
  
  // Raccogli dati form
  const updates = {
    brand: document.getElementById("editBrand").value,
    material: document.getElementById("editMaterial").value,
    // ... altri campi ...
    open_spools: parseInt(document.getElementById("editOpenSpools").value),
    open_spools_fractions: window.currentOpenSpoolsFractions,
    spools_locations: window.currentSpoolsLocations
  };
  
  // Valida
  if (!updates.brand || !updates.material) {
    showToast("Campi obbligatori mancanti", "error");
    return;
  }
  
  // Aggiorna
  updateFilament(currentEditingFilamentId, updates);
  closeEditFilamentModal();
  showToast("Filamento aggiornato", "success");
}

// Gestione filamenti
function addFilament(data) { /* ... */ }
function updateFilament(id, updates) { /* ... */ }
function deleteFilament(id) { /* ... */ }

// Import/Export
function handleExportJson() { /* ... */ }
function handleImportJson(file) { /* ... */ }

// Avvio
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

### **2. state.js - Gestione Stato**

```javascript
/**
 * Classe per gestione stato immutabile
 */
export class AppState {
  constructor() {
    this._state = {
      filaments: [],
      purchasedFilaments: [],
      brandList: [],
      materialList: ["PLA", "PETG", "ABS", "TPU", "Nylon"],
      locationList: []
    };
  }
  
  getState() {
    // Ritorna copia profonda per immutabilità
    return JSON.parse(JSON.stringify(this._state));
  }
  
  setState(newState) {
    // Valida prima di aggiornare
    if (!newState || typeof newState !== 'object') {
      throw new Error("Invalid state");
    }
    
    // Aggiorna stato
    this._state = JSON.parse(JSON.stringify(newState));
    
    // Trigger evento per observers (opzionale)
    this._notifyObservers();
  }
  
  _notifyObservers() {
    // Implementa pattern observer se necessario
  }
}
```

### **3. store.js - Persistenza**

```javascript
/**
 * Gestione persistenza localStorage
 */

const STORAGE_KEY = 'registroFilamentiState_v3';
const LOCATION_LIST_KEY = 'registroFilamentiLocationList';  // ✅ IMPORTANTE!
const LOW_STOCK_THRESHOLD_KEY = 'registroFilamentiLowStockThreshold';

/**
 * Carica stato da localStorage
 */
export function load() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    
    const state = JSON.parse(json);
    return state;
  } catch (e) {
    console.error("Errore caricamento stato:", e);
    return null;
  }
}

/**
 * Salva stato in localStorage
 */
export function save(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error("Errore salvataggio stato:", e);
    return false;
  }
}

/**
 * Export JSON per download
 */
export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

/**
 * Import JSON da file
 */
export function importJson(jsonString) {
  try {
    const state = JSON.parse(jsonString);
    // Valida struttura base
    if (!state.filaments || !Array.isArray(state.filaments)) {
      throw new Error("Invalid state structure");
    }
    return state;
  } catch (e) {
    console.error("Errore import JSON:", e);
    return null;
  }
}

/**
 * Cancella tutti i dati
 */
export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LOCATION_LIST_KEY);
  localStorage.removeItem(LOW_STOCK_THRESHOLD_KEY);
}
```

### **4. validation.js - Validazione**

```javascript
/**
 * Normalizza e valida stato applicazione
 */
export function normalizeAndValidateState(state) {
  const normalized = {
    filaments: normalizeFilaments(state.filaments || []),
    purchasedFilaments: normalizePurchased(state.purchasedFilaments || []),
    brandList: Array.isArray(state.brandList) ? state.brandList : [],
    materialList: Array.isArray(state.materialList) 
      ? state.materialList 
      : ["PLA", "PETG", "ABS", "TPU"],
    locationList: Array.isArray(state.locationList) ? state.locationList : []
  };
  
  return normalized;
}

function normalizeFilaments(filaments) {
  return filaments.map(f => {
    // Invariante 1: ID univoco
    const id = f.id || `${Date.now()}-${Math.random()}`;
    
    // Invariante 2: Campi obbligatori
    const brand = String(f.brand || "Unknown").trim();
    const material = String(f.material || "Unknown").trim();
    const variant = String(f.variant || "").trim();
    
    // Invariante 3: Numeri validi
    const unit_weight = Math.max(1, parseInt(f.unit_weight) || 1000);
    const sealed_spools = Math.max(0, parseInt(f.sealed_spools) || 0);
    const open_spools = Math.max(0, parseInt(f.open_spools) || 0);
    
    // Invariante 4: Array frazioni
    let open_spools_fractions = Array.isArray(f.open_spools_fractions)
      ? f.open_spools_fractions
      : [];
    
    // Migrazione da vecchio sistema
    if (open_spools_fractions.length === 0 && open_spools > 0) {
      if (f.main_fraction != null) {
        open_spools_fractions = [f.main_fraction];
      }
      while (open_spools_fractions.length < open_spools) {
        open_spools_fractions.push(1);
      }
    }
    
    // Invariante 5: Frazioni valide (0-1)
    open_spools_fractions = open_spools_fractions
      .slice(0, open_spools)
      .map(fr => Math.max(0, Math.min(1, parseFloat(fr) || 1)));
    
    // Invariante 6: Array posizioni
    let spools_locations = Array.isArray(f.spools_locations)
      ? f.spools_locations
      : [];
    
    const totalSpools = sealed_spools + open_spools;
    while (spools_locations.length < totalSpools) {
      spools_locations.push(f.location || "");
    }
    spools_locations = spools_locations.slice(0, totalSpools);
    
    // Invariante 7: Calcolo pesi
    const sealedWeight = sealed_spools * unit_weight;
    const fractionsSum = open_spools_fractions.reduce((a,b) => a+b, 0);
    const openWeight = fractionsSum * unit_weight;
    
    return {
      id,
      brand,
      material,
      variant,
      packaging: f.packaging || "spool",
      unit_weight,
      unit_price: f.unit_price != null ? parseFloat(f.unit_price) : null,
      supplier: f.supplier || "",
      notes: f.notes || "",
      sealed_spools,
      open_spools,
      open_spools_fractions,
      spools_locations,
      spools_variants: f.spools_variants || [],
      total_weight: sealedWeight + openWeight,
      remaining_weight: sealedWeight + openWeight,
      location: f.location || "",
      createdAt: f.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

function normalizePurchased(purchased) {
  // Simile a normalizeFilaments ma per filamenti comprati
  return purchased.map(p => ({
    id: p.id || `${Date.now()}-${Math.random()}`,
    brand: String(p.brand || "Unknown").trim(),
    material: String(p.material || "Unknown").trim(),
    variant: String(p.variant || "").trim(),
    packaging: p.packaging || "spool",
    quantity: Math.max(1, parseInt(p.quantity) || 1),
    unit_weight: Math.max(1, parseInt(p.unit_weight) || 1000),
    unit_price: p.unit_price != null ? parseFloat(p.unit_price) : null,
    supplier: p.supplier || "",
    order_date: p.order_date || new Date().toISOString().split('T')[0],
    purchasedAt: p.purchasedAt || new Date().toISOString()
  }));
}
```

### **5. domain/filaments.js - Logica Business**

```javascript
/**
 * Logica business per filamenti
 */

// Costanti
export const DEFAULT_BRANDS = [
  "Bambu Lab", "Polymaker", "Prusament", "eSun", 
  "Sunlu", "Eryone", "Creality", "Overture"
];

export const DEFAULT_MATERIALS = [
  "PLA", "PETG", "ABS", "TPU", "Nylon", "HIPS", 
  "ASA", "PC", "PVA", "BVOH"
];

// Normalizzazione
export function canonicalizeBrand(brand) {
  const normalized = brand.trim();
  // Trova match case-insensitive
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

// Calcoli
export function calculateTotalStats(filaments) {
  const totalWeight = filaments.reduce(
    (sum, f) => sum + f.remaining_weight, 
    0
  );
  
  const totalValue = filaments.reduce((sum, f) => {
    if (!f.unit_price) return sum;
    const spools = (f.remaining_weight / f.unit_weight);
    return sum + (spools * f.unit_price);
  }, 0);
  
  const totalSpools = filaments.reduce(
    (sum, f) => sum + f.sealed_spools + f.open_spools,
    0
  );
  
  return {
    totalWeight,
    totalValue,
    totalSpools,
    totalItems: filaments.length
  };
}

export function calculateStockSummary(filaments) {
  const byBrand = {};
  const byMaterial = {};
  
  filaments.forEach(f => {
    // Per brand
    if (!byBrand[f.brand]) {
      byBrand[f.brand] = 0;
    }
    byBrand[f.brand] += f.remaining_weight;
    
    // Per materiale
    if (!byMaterial[f.material]) {
      byMaterial[f.material] = 0;
    }
    byMaterial[f.material] += f.remaining_weight;
  });
  
  return { byBrand, byMaterial };
}

// Verifica scorte basse
export function isLowStock(filament, threshold = 0.25) {
  const totalCapacity = filament.sealed_spools + filament.open_spools;
  if (totalCapacity === 0) return false;
  
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const currentCapacity = filament.sealed_spools + fractionsSum;
  
  return (currentCapacity / totalCapacity) <= threshold;
}

// Filtri
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

// Ricerca
export function filterBySearch(filaments, query) {
  if (!query || query.trim() === "") return filaments;
  
  const lowerQuery = query.toLowerCase();
  return filaments.filter(f =>
    f.brand.toLowerCase().includes(lowerQuery) ||
    f.material.toLowerCase().includes(lowerQuery) ||
    f.variant.toLowerCase().includes(lowerQuery) ||
    f.supplier?.toLowerCase().includes(lowerQuery)
  );
}

// Ordinamento
export function sortFilaments(filaments, field, direction = "asc") {
  if (!field) return filaments;
  
  return [...filaments].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    // Handle null/undefined
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    
    // String comparison
    if (typeof aVal === "string") {
      return direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    // Number comparison
    return direction === "asc"
      ? aVal - bVal
      : bVal - aVal;
  });
}

// Ricalcolo pesi
export function recalcWeightsForFilament(filament) {
  const sealedWeight = filament.sealed_spools * filament.unit_weight;
  const fractionsSum = filament.open_spools_fractions?.reduce((a,b) => a+b, 0) || 0;
  const openWeight = fractionsSum * filament.unit_weight;
  
  filament.total_weight = sealedWeight + openWeight;
  filament.remaining_weight = sealedWeight + openWeight;
  
  return filament;
}

// Deduplicazione
export function deduplicateFilamentsByIdentity(filaments) {
  const seen = new Set();
  return filaments.filter(f => {
    const key = `${f.brand}-${f.material}-${f.variant}-${f.packaging}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

### **6. ui/render.js - Rendering**

```javascript
/**
 * Funzioni rendering UI
 */

// Utility formattazione
export function formatNumber(num) {
  return new Intl.NumberFormat('it-IT').format(Math.round(num));
}

export function formatCurrency(num) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(num);
}

// Rendering dashboard
export function renderDashboard(stats, threshold) {
  const container = document.getElementById("dashboardCards");
  if (!container) return;
  
  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">📦</div>
      <div class="stat-value">${formatNumber(stats.totalWeight)} g</div>
      <div class="stat-label">Peso Totale</div>
      <div class="stat-subtitle">${stats.totalSpools} bobine</div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div class="stat-value">${formatCurrency(stats.totalValue)}</div>
      <div class="stat-label">Valore Magazzino</div>
      <div class="stat-subtitle">Stima prezzi</div>
    </div>
    
    <div class="stat-card ${stats.lowStockCount > 0 ? 'warning' : ''}">
      <div class="stat-icon">⚠️</div>
      <div class="stat-value">${stats.lowStockCount}</div>
      <div class="stat-label">Scorte Basse</div>
      <div class="stat-subtitle">Soglia ${Math.round(threshold * 100)}%</div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🛒</div>
      <div class="stat-value">${stats.purchasedCount}</div>
      <div class="stat-label">Da Aggiungere</div>
      <div class="stat-subtitle">Filamenti comprati</div>
    </div>
  `;
}

// Rendering grafici
export function renderBars(filaments) {
  const summary = calculateStockSummary(filaments);
  
  renderBrandBars(summary.byBrand);
  renderMaterialBars(summary.byMaterial);
}

function renderBrandBars(byBrand) {
  const container = document.getElementById("brandBarsContainer");
  if (!container) return;
  
  // Ordina per peso decrescente
  const sorted = Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);  // Top 5
  
  const maxWeight = Math.max(...sorted.map(([_, w]) => w));
  
  container.innerHTML = sorted.map(([brand, weight]) => {
    const percentage = (weight / maxWeight) * 100;
    return `
      <div class="bar-item">
        <div class="bar-label">${brand}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="bar-value">${formatNumber(weight)} g</div>
      </div>
    `;
  }).join('');
}

// Rendering tabella magazzino
export function renderFilamentTable(filaments, sortState, callbacks) {
  const tbody = document.getElementById("filamentsTableBody");
  if (!tbody) return;
  
  if (filaments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem;">
          Nessun filamento in magazzino
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filaments.map(f => `
    <tr data-id="${f.id}">
      <td>${escapeHtml(f.brand)}</td>
      <td>${escapeHtml(f.material)}</td>
      <td>${escapeHtml(f.variant)}</td>
      <td>${formatNumber(f.remaining_weight)} g</td>
      <td>
        ${f.sealed_spools}S + ${f.open_spools}A
      </td>
      <td>
        ${renderSpoolsLocations(f.spools_locations)}
      </td>
      <td>
        ${renderPackagingIcon(f.packaging)}
      </td>
      <td class="actions">
        <button class="btn-icon btn-edit" data-id="${f.id}" title="Modifica">
          ✏️
        </button>
        <button class="btn-icon btn-delete" data-id="${f.id}" title="Elimina">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
  
  // Attach event listeners
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onEdit(btn.dataset.id);
    });
  });
  
  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onDelete(btn.dataset.id);
    });
  });
}

function renderSpoolsLocations(locations) {
  if (!locations || locations.length === 0) return "—";
  
  const unique = [...new Set(locations.filter(l => l))];
  if (unique.length === 0) return "—";
  if (unique.length === 1) return escapeHtml(unique[0]);
  
  return `
    <span title="${unique.map(escapeHtml).join(', ')}">
      ${unique.length} posizioni
    </span>
  `;
}

function renderPackagingIcon(packaging) {
  const icons = {
    spool: '🎡',
    cardboard: '📦',
    refill: '♻️'
  };
  return icons[packaging] || '📦';
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Altre funzioni rendering...
export function renderPurchasedTable(purchased, sortState, callbacks) { /* ... */ }
export function renderStockSummary(summary) { /* ... */ }
export function renderLocationsList(locations, callbacks) { /* ... */ }
export function populateFilterOptions(filaments, purchased) { /* ... */ }
```

### **7. ui/events.js - Event Handlers**

```javascript
/**
 * Gestione eventi UI
 */

// Setup tutti gli eventi
export function setupAllEvents(callbacks) {
  // Eventi tabelle
  setupTableEvents(callbacks);
  
  // Eventi filtri
  setupFilterEvents(callbacks);
  
  // Eventi modal
  setupModalEvents(callbacks);
  
  // Eventi form
  setupFormEvents(callbacks);
  
  // Keyboard shortcuts
  setupKeyboardShortcuts(callbacks);
  
  // Theme toggle
  setupThemeToggle();
}

function setupTableEvents(callbacks) {
  // Sort headers
  document.querySelectorAll('.table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      callbacks.onSort(field);
    });
  });
  
  // Checkbox selezione multipla
  const selectAllCheckbox = document.getElementById('selectAll');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.row-checkbox');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
  }
}

function setupFilterEvents(callbacks) {
  // Filtro brand
  const brandFilter = document.getElementById('stockFilterBrand');
  if (brandFilter) {
    brandFilter.addEventListener('change', (e) => {
      callbacks.applyStockFilter({ brand: e.target.value });
    });
  }
  
  // Filtro material
  const materialFilter = document.getElementById('stockFilterMaterial');
  if (materialFilter) {
    materialFilter.addEventListener('change', (e) => {
      callbacks.applyStockFilter({ material: e.target.value });
    });
  }
  
  // Checkbox scorte basse
  const lowStockCheck = document.getElementById('filterLowStock');
  if (lowStockCheck) {
    lowStockCheck.addEventListener('change', (e) => {
      callbacks.applyStockFilter({ lowStockOnly: e.target.checked });
    });
  }
  
  // Ricerca (debounced)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      callbacks.handleSearch(e.target.value);
    }, 300));
  }
}

function setupModalEvents(callbacks) {
  // Chiudi modal con overlay click
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      callbacks.closeAllModals();
    });
  }
  
  // Bottoni chiudi modal
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.closeAllModals();
    });
  });
}

function setupKeyboardShortcuts(callbacks) {
  document.addEventListener('keydown', (e) => {
    // ESC chiude modal
    if (e.key === 'Escape') {
      callbacks.closeAllModals();
    }
    
    // Ctrl+S salva (previeni default)
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      callbacks.triggerAutoSave();
      showToast('Dati salvati', 'success');
    }
  });
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  
  // Carica tema salvato
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

// Toast notifications
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Debounce utility
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
```

---

## 📋 CHECKLIST IMPLEMENTAZIONE

### **MUST HAVE** (Obbligatorio)

- [ ] Architettura modulare ES6 (7 file)
- [ ] localStorage per persistenza
- [ ] Dashboard con 4 card statistiche
- [ ] Tabella magazzino ordinabile
- [ ] Tabella filamenti comprati
- [ ] **Gestione bobine multiple con frazioni**
- [ ] Modal edit completamente funzionante
- [ ] Filtri (brand, material, packaging, low stock)
- [ ] Ricerca full-text
- [ ] Import/Export JSON
- [ ] Validazione dati robusta
- [ ] Calcolo automatico pesi
- [ ] Grafici brand/materiali
- [ ] Alert scorte basse
- [ ] Theme dark/light
- [ ] Modal con scroll corretto (NON centrata!)
- [ ] Toast notifications
- [ ] Keyboard shortcuts (ESC, Ctrl+S)
- [ ] Responsive design (mobile/tablet)

### **SHOULD HAVE** (Fortemente raccomandato)

- [ ] Animazioni smooth
- [ ] Transizioni CSS
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling robusto
- [ ] Console logging strutturato
- [ ] Commenti JSDoc
- [ ] README.md completo

### **NICE TO HAVE** (Opzionale)

- [ ] Undo/Redo
- [ ] Drag & drop per ordinamento
- [ ] Grafici avanzati (Chart.js)
- [ ] Export PDF report
- [ ] QR code per bobine
- [ ] PWA (Service Worker)

---

## 🎯 CRITERI DI SUCCESSO

L'app è considerata **completa e funzionante** se:

1. ✅ **Tutti i MUST HAVE sono implementati**
2. ✅ **ZERO dipendenze esterne** (tutto vanilla)
3. ✅ **Modal bobine multiple funziona** (N bobine → N campi)
4. ✅ **Salvataggio/caricamento localStorage funziona**
5. ✅ **Import/Export JSON funziona**
6. ✅ **Validazione previene dati corrotti**
7. ✅ **Calcoli pesi sono corretti**
8. ✅ **UI è responsive** (mobile/tablet/desktop)
9. ✅ **No errori console** in condizioni normali
10. ✅ **Codice è ben strutturato** e commentato

---

## 🚀 DELIVERABLE FINALI

Devi fornire:

1. **File applicazione completa**:
   - `index.html`
   - `styles.css`
   - `src/main.js`
   - `src/state.js`
   - `src/store.js`
   - `src/validation.js`
   - `src/domain/filaments.js`
   - `src/ui/render.js`
   - `src/ui/events.js`

2. **Documentazione**:
   - `README.md` - Come usare l'app
   - `ARCHITECTURE.md` - Spiegazione architettura

3. **File opzionali**:
   - `CHANGELOG.md` - Versioni e fix
   - File JSON di esempio con dati demo

---

## 💡 NOTE IMPORTANTI

### **Priorità Assolute**

1. **BOBINE MULTIPLE**: La gestione delle bobine multiple è CRITICA. L'app DEVE permettere di:
   - Avere N bobine aperte dello stesso filamento
   - Assegnare una frazione (100%, 75%, 50%, 25%, 0%) a OGNI bobina
   - Assegnare una posizione fisica a OGNI bobina
   - Salvare correttamente tutti questi dati
   - Visualizzare correttamente N campi nella modal edit

2. **MODAL SCROLL**: Le modal DEVONO:
   - Partire dall'alto della pagina (NON centrate verticalmente)
   - Avere scroll interno quando il contenuto è lungo
   - NON richiedere scroll della pagina

3. **VALIDAZIONE**: I dati DEVONO essere validati per prevenire corruzione

4. **IMMUTABILITÀ**: Lo stato DEVE essere immutabile (sempre nuove copie)

### **Best Practices**

- ✅ Usa `const` e `let`, MAI `var`
- ✅ Usa arrow functions quando appropriato
- ✅ Usa template literals per HTML
- ✅ Usa destructuring quando migliora leggibilità
- ✅ Usa spread operator per immutabilità
- ✅ Commenta codice complesso
- ✅ Valida input utente SEMPRE
- ✅ Gestisci errori con try/catch
- ✅ Usa nomi variabili descrittivi
- ✅ Mantieni funzioni piccole e focused

### **Anti-Patterns da Evitare**

- ❌ Mutare stato direttamente
- ❌ Usare var
- ❌ Concatenazione stringhe per HTML
- ❌ innerHTML senza escaping
- ❌ Event listeners duplicati
- ❌ Variabili globali non necessarie
- ❌ Funzioni monolitiche >100 righe
- ❌ Magic numbers (usa costanti)
- ❌ Dipendenze circolari tra moduli
- ❌ localStorage senza try/catch

---

## 🎯 CONCLUSIONE

Questo prompt fornisce tutte le informazioni necessarie per creare un'applicazione web completa, moderna e funzionante per la gestione dell'inventario di filamenti 3D.

**L'applicazione deve**:
- Essere completamente vanilla (no framework)
- Avere architettura modulare ES6
- Gestire bobine multiple correttamente
- Validare e persistere dati
- Essere responsive e accessibile
- Avere UI pulita e moderna

**Inizia dall'architettura** (7 moduli), poi implementa le funzionalità una alla volta, testando frequentemente.

**La priorità è**: Bobine multiple → Persistenza → UI → Polish

Buon lavoro! 🚀
