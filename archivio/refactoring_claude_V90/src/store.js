/**
 * store.js - Fase 1
 * Modulo di persistenza per Registro Filamenti 3D
 * 
 * Responsabilità:
 * - Lettura/scrittura localStorage (ora)
 * - Preparato per migrazione a IndexedDB (dopo)
 * - Validazione dati in ingresso
 * - Gestione versione schema e migrazioni
 * 
 * API pubblica:
 * - load() → carica state
 * - save(state) → salva state
 * - exportJson() → esporta come JSON string
 * - importJson(jsonString) → importa con validazione
 * - getLastSaveTime() → timestamp ultimo salvataggio
 * - clear() → cancella tutto (con conferma)
 */

import { normalizeAndValidateState } from './validation.js';

// ============================================
// CONFIGURAZIONE
// ============================================

const CONFIG = {
  // Chiavi localStorage (manteniamo compatibilità con app esistente)
  STORAGE_KEY: 'registroFilamentiState_v3',
  LOCATION_LIST_KEY: 'registroFilamentiLocationList',
  
  // Versione schema corrente
  SCHEMA_VERSION: 1,
  
  // Backup automatico prima di operazioni distruttive
  BACKUP_KEY: 'registroFilamentiBackup'
};

// ============================================
// STATO INTERNO MODULO
// ============================================

let lastSaveTime = null;
let lastLoadTime = null;

// ============================================
// FUNZIONI PRIVATE
// ============================================

/**
 * Crea uno state vuoto valido
 */
function createEmptyState() {
  return {
    schemaVersion: CONFIG.SCHEMA_VERSION,
    filaments: [],
    purchasedFilaments: [],
    brands: [],
    materials: [],
    colors: []
  };
}

/**
 * Verifica se localStorage è disponibile
 */
function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Legge un valore da localStorage in modo sicuro
 */
function readFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`[Store] Errore lettura ${key}:`, e.message);
    return null;
  }
}

/**
 * Scrive un valore in localStorage in modo sicuro
 */
function writeToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[Store] Errore scrittura ${key}:`, e.message);
    // Possibile QuotaExceededError
    if (e.name === 'QuotaExceededError') {
      console.error('[Store] localStorage pieno!');
    }
    return false;
  }
}

/**
 * Applica migrazioni se necessario
 * Qui aggiungeremo logica quando cambierà lo schema
 */
function migrateIfNeeded(state) {
  const version = state.schemaVersion || 0;
  
  // Migrazione da v0 (senza versione) a v1
  if (version < 1) {
    console.log('[Store] Migrazione v0 → v1');
    state.schemaVersion = 1;
    // Eventuali trasformazioni dati...
  }
  
  // Future migrazioni:
  // if (version < 2) { ... }
  
  return state;
}

// ============================================
// API PUBBLICA
// ============================================

/**
 * Carica lo state da localStorage
 * 
 * @returns {{ state: Object, stats: Object, locationList: string[] }}
 */
export function load() {
  console.log('[Store] Caricamento...');
  
  if (!isStorageAvailable()) {
    console.warn('[Store] localStorage non disponibile');
    return {
      state: createEmptyState(),
      stats: { filaments: { total: 0, valid: 0 }, errors: [], warnings: [] },
      locationList: []
    };
  }
  
  // Leggi dati grezzi
  const rawState = readFromStorage(CONFIG.STORAGE_KEY);
  const locationList = readFromStorage(CONFIG.LOCATION_LIST_KEY) || [];
  
  // Se non ci sono dati, ritorna state vuoto
  if (!rawState) {
    console.log('[Store] Nessun dato salvato, state vuoto');
    return {
      state: createEmptyState(),
      stats: { filaments: { total: 0, valid: 0 }, errors: [], warnings: [] },
      locationList: []
    };
  }
  
  // Valida e normalizza
  const { state, stats } = normalizeAndValidateState(rawState);
  
  // Applica migrazioni
  const migratedState = migrateIfNeeded(state);
  
  lastLoadTime = Date.now();
  
  console.log(`[Store] Caricati ${stats.filaments.valid} filamenti`);
  if (stats.warnings.length > 0) {
    console.warn(`[Store] ${stats.warnings.length} warning durante caricamento`);
  }
  if (stats.errors.length > 0) {
    console.error(`[Store] ${stats.errors.length} errori durante caricamento`);
  }
  
  return {
    state: migratedState,
    stats,
    locationList: Array.isArray(locationList) ? locationList : []
  };
}

/**
 * Salva lo state in localStorage
 * 
 * @param {Object} state - State da salvare
 * @param {string[]} locationList - Lista posizioni (opzionale)
 * @returns {{ success: boolean, error?: string }}
 */
export function save(state, locationList = null) {
  if (!isStorageAvailable()) {
    return { success: false, error: 'localStorage non disponibile' };
  }
  
  if (!state || typeof state !== 'object') {
    return { success: false, error: 'State non valido' };
  }
  
  // Aggiungi versione schema se mancante
  const stateToSave = {
    ...state,
    schemaVersion: state.schemaVersion || CONFIG.SCHEMA_VERSION
  };
  
  // Salva state principale
  const mainSuccess = writeToStorage(CONFIG.STORAGE_KEY, stateToSave);
  
  if (!mainSuccess) {
    return { success: false, error: 'Errore salvataggio state' };
  }
  
  // Salva location list se fornita
  if (locationList !== null) {
    writeToStorage(CONFIG.LOCATION_LIST_KEY, locationList);
  }
  
  lastSaveTime = Date.now();
  console.log(`[Store] Salvato (${state.filaments?.length || 0} filamenti)`);
  
  return { success: true };
}

/**
 * Esporta lo state come stringa JSON formattata
 * 
 * @param {Object} state - State da esportare (se null, carica da storage)
 * @returns {string} JSON formattato
 */
export function exportJson(state = null) {
  const dataToExport = state || load().state;
  
  // Aggiungi metadata export
  const exportData = {
    ...dataToExport,
    exportedAt: new Date().toISOString(),
    exportVersion: CONFIG.SCHEMA_VERSION
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Importa da stringa JSON con validazione
 * 
 * @param {string} jsonString - JSON da importare
 * @param {Object} options - Opzioni { merge: boolean, backup: boolean }
 * @returns {{ success: boolean, state?: Object, stats?: Object, error?: string }}
 */
export function importJson(jsonString, options = {}) {
  const { merge = false, backup = true } = options;
  
  // Parse JSON
  let rawData;
  try {
    rawData = JSON.parse(jsonString);
  } catch (e) {
    return { success: false, error: `JSON non valido: ${e.message}` };
  }
  
  // Valida e normalizza
  const { state: importedState, stats } = normalizeAndValidateState(rawData);
  
  // Se ci sono errori critici, non procedere
  if (stats.errors.length > 0 && stats.filaments.valid === 0) {
    return { 
      success: false, 
      error: `Nessun filamento valido: ${stats.errors.join(', ')}`,
      stats 
    };
  }
  
  // Backup prima di sovrascrivere (se richiesto)
  if (backup && isStorageAvailable()) {
    const currentState = readFromStorage(CONFIG.STORAGE_KEY);
    if (currentState) {
      writeToStorage(CONFIG.BACKUP_KEY, {
        state: currentState,
        backedUpAt: new Date().toISOString()
      });
      console.log('[Store] Backup creato prima di import');
    }
  }
  
  // Merge o sostituzione
  let finalState;
  if (merge) {
    const current = load().state;
    finalState = mergeStates(current, importedState);
    console.log('[Store] Merge completato');
  } else {
    finalState = importedState;
  }
  
  return {
    success: true,
    state: finalState,
    stats
  };
}

/**
 * Merge di due state (usato per import con merge)
 */
function mergeStates(current, imported) {
  // Mappa ID esistenti per evitare duplicati
  const existingIds = new Set(current.filaments.map(f => f.id));
  const existingPurchasedIds = new Set(current.purchasedFilaments.map(f => f.id));
  
  // Aggiungi solo filamenti con ID non esistente
  const newFilaments = imported.filaments.filter(f => !existingIds.has(f.id));
  const newPurchased = imported.purchasedFilaments.filter(f => !existingPurchasedIds.has(f.id));
  
  return {
    ...current,
    filaments: [...current.filaments, ...newFilaments],
    purchasedFilaments: [...current.purchasedFilaments, ...newPurchased],
    // Merge liste senza duplicati
    brands: [...new Set([...current.brands, ...imported.brands])],
    materials: [...new Set([...current.materials, ...imported.materials])],
    colors: [...new Set([...current.colors, ...imported.colors])]
  };
}

/**
 * Restituisce il timestamp dell'ultimo salvataggio
 */
export function getLastSaveTime() {
  return lastSaveTime;
}

/**
 * Restituisce il timestamp dell'ultimo caricamento
 */
export function getLastLoadTime() {
  return lastLoadTime;
}

/**
 * Cancella tutti i dati (con backup automatico)
 * 
 * @param {boolean} confirm - Deve essere true per procedere
 * @returns {{ success: boolean, backupKey?: string }}
 */
export function clear(confirm = false) {
  if (!confirm) {
    console.warn('[Store] clear() richiede confirm=true');
    return { success: false };
  }
  
  if (!isStorageAvailable()) {
    return { success: false };
  }
  
  // Backup prima di cancellare
  const currentState = readFromStorage(CONFIG.STORAGE_KEY);
  if (currentState) {
    writeToStorage(CONFIG.BACKUP_KEY, {
      state: currentState,
      backedUpAt: new Date().toISOString()
    });
  }
  
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  localStorage.removeItem(CONFIG.LOCATION_LIST_KEY);
  
  console.log('[Store] Dati cancellati (backup disponibile)');
  
  return { success: true, backupKey: CONFIG.BACKUP_KEY };
}

/**
 * Ripristina dal backup
 * 
 * @returns {{ success: boolean, state?: Object }}
 */
export function restoreFromBackup() {
  const backup = readFromStorage(CONFIG.BACKUP_KEY);
  
  if (!backup || !backup.state) {
    return { success: false, error: 'Nessun backup disponibile' };
  }
  
  const { state, stats } = normalizeAndValidateState(backup.state);
  
  console.log(`[Store] Ripristinato backup del ${backup.backedUpAt}`);
  
  return { success: true, state, stats };
}

/**
 * Info sullo storage
 */
export function getStorageInfo() {
  if (!isStorageAvailable()) {
    return { available: false };
  }
  
  const stateRaw = localStorage.getItem(CONFIG.STORAGE_KEY) || '';
  const locationRaw = localStorage.getItem(CONFIG.LOCATION_LIST_KEY) || '';
  const backupRaw = localStorage.getItem(CONFIG.BACKUP_KEY) || '';
  
  return {
    available: true,
    stateSize: stateRaw.length,
    locationSize: locationRaw.length,
    backupSize: backupRaw.length,
    totalSize: stateRaw.length + locationRaw.length + backupRaw.length,
    hasBackup: backupRaw.length > 0,
    lastSaveTime,
    lastLoadTime
  };
}


