# Registro Filamenti 3D - V.90

Applicazione web offline per la gestione dell'inventario di filamenti per stampanti 3D.

## 🎯 Caratteristiche

- ✅ **Architettura modulare ES6** - 7 moduli separati per manutenibilità
- ✅ **Persistenza localStorage** - Dati salvati localmente nel browser
- ✅ **Zero dipendenze** - Vanilla JavaScript, HTML5, CSS3
- ✅ **Gestione bobine multiple** - Supporto per N bobine con frazioni e posizioni individuali
- ✅ **Dashboard statistiche** - Peso totale, valore, scorte basse
- ✅ **Filtri e ricerca** - Filtra per brand, materiale, packaging, ricerca full-text
- ✅ **Import/Export JSON** - Backup e ripristino dati
- ✅ **Tema chiaro/scuro** - Interfaccia personalizzabile
- ✅ **Responsive design** - Funziona su desktop, tablet, mobile

## 📁 Struttura File

```
registro_filamenti_V20_separato/
├── index.html              # Entry point HTML
├── styles.css              # Stili globali
├── README.md              # Questa documentazione
└── src/                   # Moduli JavaScript ES6
    ├── main.js            # Entry point, coordinamento
    ├── state.js           # Gestione stato immutabile
    ├── store.js           # Persistenza localStorage
    ├── validation.js      # Validazione e normalizzazione
    ├── domain/
    │   └── filaments.js   # Logica business
    └── ui/
        ├── render.js      # Rendering UI
        └── events.js       # Event handlers
```

## 🚀 Come Usare

### Avvio

1. Apri `index.html` in un browser moderno (Chrome, Firefox, Edge, Safari)
2. L'app si carica automaticamente e cerca dati salvati in localStorage
3. Se è la prima volta, il magazzino sarà vuoto

### Aggiungere Filamenti

1. Vai alla sezione **"2. Aggiungi / importa filamenti"**
2. Compila i campi:
   - **Marca**: Seleziona dalla lista o inserisci nuova
   - **Materiale**: Seleziona dalla lista o inserisci nuovo
   - **Colore/Variante**: Inserisci il colore
   - **Bobine nuove**: Numero bobine sigillate
   - **Bobine aperte**: Numero bobine già aperte
   - **Frazione residua**: Quanto rimane nella bobina più consumata (100%, 75%, 50%, 25%, 0%)
3. Clicca **"Aggiungi filamento"**

### Importare Dati

1. Clicca **"📥 Importa JSON"**
2. Seleziona un file JSON esportato in precedenza
3. I dati vengono importati e validati automaticamente

### Esportare Dati

1. Clicca **"📤 Esporta database"**
2. Il file JSON viene scaricato automaticamente
3. Conserva il file per backup

### Filtrare e Cercare

- **Filtri**: Usa i dropdown nella sezione "3a. Magazzino" per filtrare per marca, materiale, tipo
- **Ricerca**: Usa la barra di ricerca per cercare per testo (marca, materiale, colore, fornitore, note)
- **Reset**: Clicca "Reset" per rimuovere tutti i filtri

### Ordinare Tabella

- Clicca sull'header di una colonna per ordinare
- Clicca di nuovo per invertire l'ordine (asc/desc)

### Gestire Posizioni

1. Apri **Impostazioni** (pulsante in alto a destra)
2. Nella sezione **"Gestione posizioni"**:
   - **Aggiungi**: Inserisci nome e clicca "Aggiungi"
   - **Rinomina**: Modifica il campo e clicca "Rinomina"
   - **Elimina**: Clicca "Elimina" (verifica che non sia usata da filamenti)

## 🔧 Architettura Tecnica

### Moduli

#### `state.js`
- Gestisce lo stato applicazione con pattern Observer
- Garantisce immutabilità (sempre nuove copie)
- Notifica observers ad ogni cambiamento

#### `store.js`
- Persistenza in localStorage
- Gestione chiavi separate per configurazione
- Import/Export JSON con validazione

#### `validation.js`
- Normalizza dati importati/inseriti
- Valida struttura e tipi
- Migra dati da versioni vecchie
- **Invarianti critiche**:
  - `open_spools_fractions.length === open_spools`
  - `spools_locations.length === sealed_spools + open_spools`

#### `domain/filaments.js`
- Logica business pura (agnostica dalla UI)
- Calcoli statistiche
- Filtri, ricerca, ordinamento
- Verifica scorte basse

#### `ui/render.js`
- Rendering dashboard, tabelle, filtri
- Formattazione numeri e valute
- Escape HTML per sicurezza

#### `ui/events.js`
- Setup event listeners
- Gestione modali, toast, shortcuts
- Debounce per performance

#### `main.js`
- Coordinamento tra moduli
- Gestione ciclo di vita app
- CRUD operazioni filamenti

### Modello Dati

#### Filamento
```javascript
{
  id: "timestamp-random",
  brand: "Bambu Lab",
  material: "PLA",
  variant: "Nero",
  packaging: "spool",
  unit_weight: 1000,
  unit_price: 19.99,
  supplier: "Amazon",
  notes: "",
  sealed_spools: 2,
  open_spools: 3,
  open_spools_fractions: [1, 0.75, 0.5],  // Una per ogni bobina aperta
  spools_locations: ["Scaffale 1", "Scaffale 1", "Box", "Box", "Scrivania"],
  total_weight: 5000,      // Calcolato
  remaining_weight: 3250,  // Calcolato
  location: "Scaffale 1",  // Retrocompatibilità
  createdAt: "2024-12-20T10:00:00Z",
  updatedAt: "2024-12-20T10:00:00Z"
}
```

## 🛡️ Validazione e Sicurezza

- **XSS Prevention**: Escape HTML in tutti i rendering
- **Type Validation**: Controllo tipi su tutti gli input
- **Array Invariants**: Validazione lunghezza array frazioni/posizioni
- **Schema Versioning**: Supporto migrazioni future

## 📝 Note Importanti

### Bobine Multiple

L'app supporta **N bobine multiple** dello stesso filamento:
- Ogni bobina aperta ha la sua **frazione residua** (0-1)
- Ogni bobina ha la sua **posizione fisica**
- I pesi vengono calcolati automaticamente

### Calcoli Automatici

- **Peso totale**: `sealed_spools × unit_weight + sum(fractions) × unit_weight`
- **Peso residuo**: Uguale al peso totale (inizialmente)
- **Scorte basse**: Se `(sealed + sum(fractions)) / total_spools <= threshold`

### Persistenza

- Dati salvati in `localStorage` del browser
- **Chiavi**:
  - `registroFilamentiState_v3` - Stato principale
  - `registroFilamentiLocationList` - Lista posizioni
  - `registroFilamentiLowStockThreshold` - Soglia scorte basse
  - `registroFilamentiTheme` - Tema (light/dark)

## 🐛 Troubleshooting

### Dati non si salvano
- Verifica che il browser supporti localStorage
- Controlla la console per errori
- Verifica che non ci sia quota localStorage superata

### Import JSON fallisce
- Verifica formato JSON valido
- Controlla struttura dati (deve avere `filaments` array)
- Guarda console per errori specifici

### Tabella non si aggiorna
- Ricarica la pagina (F5)
- Verifica che i filtri non nascondano tutti i risultati
- Controlla console per errori JavaScript

## 🔄 Versioni

- **V.90** - Architettura modulare ES6, gestione bobine multiple, validazione robusta

## 📄 Licenza

Uso personale - Nessuna licenza specifica

## 👤 Autore

Applicazione creata per gestione personale inventario filamenti 3D.

---

**Nota**: Questa è un'applicazione offline che funziona completamente nel browser. I dati sono salvati localmente e non vengono inviati a server esterni.












