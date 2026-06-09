/**
 * store.js - Gestione persistenza localStorage
 * 
 * Gestisce salvataggio/caricamento stato, import/export JSON,
 * e configurazione separata (locationList, threshold)
 */

// Chiavi localStorage
const STORAGE_KEY = 'registroFilamentiState_v3';
const LOCATION_LIST_KEY = 'registroFilamentiLocationList';
const LOW_STOCK_THRESHOLD_KEY = 'registroFilamentiLowStockThreshold';
const THEME_KEY = 'registroFilamentiTheme';
const UNDO_STACK_KEY = 'registroFilamentiUndoStack';
const REDO_STACK_KEY = 'registroFilamentiRedoStack';

/**
 * Carica stato da localStorage
 * @returns {Object|null} Stato caricato o null se errore
 */
export function load() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) {
      console.log("Nessun stato salvato trovato");
      return null;
    }

    const state = JSON.parse(json);
    console.log("Stato caricato:", {
      filaments: state.filaments?.length || 0,
      purchased: state.purchasedFilaments?.length || 0
    });
    return state;
  } catch (e) {
    console.error("Errore caricamento stato:", e);
    return null;
  }
}

/**
 * Salva stato in localStorage
 * @param {Object} state - Stato da salvare
 * @returns {boolean} true se successo
 */
export function save(state) {
  try {
    if (!state || typeof state !== 'object') {
      console.error("save: state deve essere un oggetto");
      return false;
    }

    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    console.log("Stato salvato:", {
      filaments: state.filaments?.length || 0,
      purchased: state.purchasedFilaments?.length || 0
    });
    return true;
  } catch (e) {
    console.error("Errore salvataggio stato:", e);
    // Se quota superata, prova a pulire vecchi dati
    if (e.name === 'QuotaExceededError') {
      console.warn("Quota localStorage superata, tentativo pulizia...");
      try {
        // Rimuovi vecchie versioni
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('registroFilamenti') && key !== STORAGE_KEY) {
            localStorage.removeItem(key);
          }
        }
        // Riprova
        localStorage.setItem(STORAGE_KEY, json);
        return true;
      } catch (e2) {
        console.error("Impossibile salvare anche dopo pulizia:", e2);
        return false;
      }
    }
    return false;
  }
}

/**
 * Carica lista posizioni da localStorage
 * @returns {string[]} Array di posizioni
 */
export function loadLocationList() {
  try {
    const json = localStorage.getItem(LOCATION_LIST_KEY);
    if (!json) {
      return ["box Ikea", "scaffale Top", "scaffale Down", "AMS/H2D", "Box Blu"];
    }
    const list = JSON.parse(json);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("Errore caricamento locationList:", e);
    return ["box Ikea", "scaffale Top", "scaffale Down", "AMS/H2D", "Box Blu"];
  }
}

/**
 * Salva lista posizioni in localStorage
 * @param {string[]} locationList - Array di posizioni
 */
export function saveLocationList(locationList) {
  try {
    if (!Array.isArray(locationList)) {
      console.error("saveLocationList: locationList deve essere un array");
      return false;
    }
    localStorage.setItem(LOCATION_LIST_KEY, JSON.stringify(locationList));
    return true;
  } catch (e) {
    console.error("Errore salvataggio locationList:", e);
    return false;
  }
}

/**
 * Carica soglia scorte basse
 * @returns {number} Soglia (default 0.25)
 */
export function loadLowStockThreshold() {
  try {
    const value = localStorage.getItem(LOW_STOCK_THRESHOLD_KEY);
    if (value === null) return 0.25;
    const threshold = parseFloat(value);
    return isNaN(threshold) ? 0.25 : Math.max(0, Math.min(1, threshold));
  } catch (e) {
    console.error("Errore caricamento threshold:", e);
    return 0.25;
  }
}

/**
 * Salva soglia scorte basse
 * @param {number} threshold - Soglia (0-1)
 */
export function saveLowStockThreshold(threshold) {
  try {
    const value = Math.max(0, Math.min(1, parseFloat(threshold)));
    localStorage.setItem(LOW_STOCK_THRESHOLD_KEY, String(value));
    return true;
  } catch (e) {
    console.error("Errore salvataggio threshold:", e);
    return false;
  }
}

/**
 * Carica tema salvato
 * @returns {string} 'light' o 'dark'
 */
export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch (e) {
    return 'dark';
  }
}

/**
 * Salva tema
 * @param {string} theme - 'light' o 'dark'
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch (e) {
    console.error("Errore salvataggio tema:", e);
    return false;
  }
}

/**
 * Export stato come JSON string
 * @param {Object} state - Stato da esportare
 * @returns {string} JSON string
 */
export function exportJson(state) {
  try {
    const exportData = {
      ...state,
      schema_version: "3.0",
      export_date: new Date().toISOString(),
      export_version: "V.89"
    };
    return JSON.stringify(exportData, null, 2);
  } catch (e) {
    console.error("Errore export JSON:", e);
    return null;
  }
}

/**
 * Import JSON da string
 * @param {string} jsonString - JSON string da importare
 * @returns {Object|null} Stato importato o null se errore
 */
export function importJson(jsonString) {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      console.error("importJson: jsonString deve essere una stringa");
      return null;
    }

    const data = JSON.parse(jsonString);
    
    // Verifica struttura base
    if (!data || typeof data !== 'object') {
      throw new Error("Dati non validi");
    }

    // Normalizza struttura
    const imported = {
      filaments: Array.isArray(data.filaments) ? data.filaments : [],
      purchasedFilaments: Array.isArray(data.purchasedFilaments) ? data.purchasedFilaments : [],
      brandList: Array.isArray(data.brandList) ? data.brandList : [],
      materialList: Array.isArray(data.materialList) ? data.materialList : [],
      colorList: Array.isArray(data.colorList) ? data.colorList : [],
      locationList: Array.isArray(data.locationList) ? data.locationList : []
    };

    console.log("JSON importato:", {
      filaments: imported.filaments.length,
      purchased: imported.purchasedFilaments.length,
      schema_version: data.schema_version || "unknown"
    });

    return imported;
  } catch (e) {
    console.error("Errore import JSON:", e);
    return null;
  }
}

/**
 * Cancella tutti i dati salvati
 */
export function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOCATION_LIST_KEY);
    localStorage.removeItem(LOW_STOCK_THRESHOLD_KEY);
    localStorage.removeItem(UNDO_STACK_KEY);
    localStorage.removeItem(REDO_STACK_KEY);
    console.log("Tutti i dati cancellati");
    return true;
  } catch (e) {
    console.error("Errore cancellazione dati:", e);
    return false;
  }
}

/**
 * Salva stack undo/redo
 */
export function saveUndoRedoStacks(undoStack, redoStack) {
  try {
    localStorage.setItem(UNDO_STACK_KEY, JSON.stringify(undoStack));
    localStorage.setItem(REDO_STACK_KEY, JSON.stringify(redoStack));
    return true;
  } catch (e) {
    console.error("Errore salvataggio undo/redo:", e);
    return false;
  }
}

/**
 * Carica stack undo/redo
 */
export function loadUndoRedoStacks() {
  try {
    const undoRaw = localStorage.getItem(UNDO_STACK_KEY);
    const redoRaw = localStorage.getItem(REDO_STACK_KEY);
    
    const undoStack = undoRaw ? JSON.parse(undoRaw) : [];
    const redoStack = redoRaw ? JSON.parse(redoRaw) : [];
    
    return { undoStack, redoStack };
  } catch (e) {
    console.error("Errore caricamento undo/redo:", e);
    return { undoStack: [], redoStack: [] };
  }
}

export default {
  load,
  save,
  loadLocationList,
  saveLocationList,
  loadLowStockThreshold,
  saveLowStockThreshold,
  loadTheme,
  saveTheme,
  exportJson,
  importJson,
  clearAll,
  saveUndoRedoStacks,
  loadUndoRedoStacks
};












