/**
 * src/state.js
 * Gestione stato centralizzato con pattern Observer
 */

import { save } from './store.js';

/**
 * Classe per gestione stato applicazione (pattern Observer)
 */
export class AppState {
  constructor() {
    this.state = {
      filaments: [],
      purchasedFilaments: [],
      brandList: [],
      materialList: [],
      consumptionHistory: []
    };
    
    this.subscribers = [];
  }

  /**
   * Subscribe a cambiamenti stato
   * @param {Function} callback - Funzione da chiamare quando stato cambia
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notifica subscribers di cambiamento
   * @param {string} path - Path del campo modificato (es. 'ui.currentSearch')
   * @param {*} oldValue - Valore precedente
   */
  notify(path = null, oldValue = null) {
    this.subscribers.forEach(callback => {
      try {
        // Supporta sia callback(state) che callback(newState, oldState, path)
        if (callback.length === 3) {
          callback(this.state, oldValue, path);
        } else {
          callback(this.state);
        }
      } catch (e) {
        console.error("Errore in subscriber:", e);
      }
    });
  }

  /**
   * Ottieni stato corrente (read-only copy)
   * @returns {Object} - Copia stato
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Aggiorna stato (immutable)
   * @param {Object} updates - Aggiornamenti da applicare
   * @param {boolean} autoSave - Se true, salva automaticamente (default: true)
   */
  setState(updates, autoSave = true) {
    this.state = {
      ...this.state,
      ...updates
    };
    
    // Auto-save quando stato cambia (se richiesto)
    if (autoSave) {
      save(this.state);
    }
    
    // Notifica subscribers
    this.notify();
  }

  /**
   * Reset stato a valori iniziali
   */
  reset() {
    this.state = {
      filaments: [],
      purchasedFilaments: [],
      brandList: [],
      materialList: [],
      consumptionHistory: []
    };
    
    save(this.state);
    this.notify();
  }
}

// =============================================
// ISTANZA GLOBALE E API COMPATIBILITÀ TEST
// =============================================

// Istanza globale per compatibilità con i test
let globalStateInstance = null;

/**
 * Inizializza stato (per compatibilità test)
 * @returns {Object} - {success: boolean, stats: Object}
 */
export function init() {
  try {
    if (!globalStateInstance) {
      globalStateInstance = new AppState();
    }
    
    const state = globalStateInstance.getState();
    
    // Aggiungi alias per compatibilità con i test
    const stateWithAliases = {
      ...state,
      brands: state.brandList || [],
      materials: state.materialList || [],
      locationList: state.locationList || []
    };
    
    // Aggiorna lo stato con gli alias
    globalStateInstance.setState(stateWithAliases);
    
    return {
      success: true,
      stats: {
        filaments: state.filaments.length,
        purchasedFilaments: state.purchasedFilaments.length,
        brandList: state.brandList.length,
        materialList: state.materialList.length
      }
    };
  } catch (e) {
    console.error("Errore inizializzazione stato:", e);
    return {
      success: false,
      stats: {}
    };
  }
}

/**
 * Ottieni stato corrente (per compatibilità test)
 * @returns {Object} - Stato applicazione con alias
 */
export function getState() {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  const state = globalStateInstance.getState();
  
  // Aggiungi alias per compatibilità con i test
  return {
    ...state,
    brands: state.brandList || [],
    materials: state.materialList || [],
    locationList: state.locationList || []
  };
}

/**
 * Aggiorna stato (per compatibilità test)
 * @param {Object} updates - Aggiornamenti
 */
export function setState(updates) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  globalStateInstance.setState(updates);
}

/**
 * Subscribe a cambiamenti (per compatibilità test)
 * @param {Function} callback - Callback
 * @returns {Function} - Unsubscribe
 */
export function subscribe(callback) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  return globalStateInstance.subscribe(callback);
}

/**
 * Reset stato (per compatibilità test)
 */
export function reset() {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  globalStateInstance.reset();
}

/**
 * Ottieni campo specifico dello stato (per compatibilità test)
 * @param {string} field - Campo da ottenere
 * @returns {*} - Valore del campo
 */
export function get(field) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  const state = globalStateInstance.getState();
  return state[field] || null;
}

/**
 * Aggiungi filamento (per compatibilità test)
 * @param {Object} filamentData - Dati filamento
 * @returns {Object} - Filamento creato con ID
 */
export function addFilament(filamentData) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  const newFilament = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    ...filamentData,
    created_at: new Date().toISOString()
  };
  
  const updatedFilaments = [...state.filaments, newFilament];
  
  // Aggiorna anche brandList se necessario
  const updatedBrandList = [...state.brandList];
  if (filamentData.brand && !updatedBrandList.includes(filamentData.brand)) {
    updatedBrandList.push(filamentData.brand);
  }
  
  // Aggiorna anche materialList se necessario
  const updatedMaterialList = [...state.materialList];
  if (filamentData.material && !updatedMaterialList.includes(filamentData.material)) {
    updatedMaterialList.push(filamentData.material);
  }
  
  globalStateInstance.setState({
    filaments: updatedFilaments,
    brandList: updatedBrandList,
    materialList: updatedMaterialList
  });
  
  return newFilament;
}

/**
 * Aggiorna filamento (per compatibilità test)
 * @param {string} id - ID filamento
 * @param {Object} updates - Aggiornamenti
 * @returns {Object|null} - Filamento aggiornato o null se non trovato
 */
export function updateFilament(id, updates) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  let updatedFilament = null;
  
  const updatedFilaments = state.filaments.map(f => {
    if (f.id === id) {
      updatedFilament = { ...f, ...updates };
      return updatedFilament;
    }
    return f;
  });
  
  if (updatedFilament) {
    globalStateInstance.setState({ filaments: updatedFilaments });
  }
  
  return updatedFilament;
}

/**
 * Elimina filamento (per compatibilità test)
 * @param {string} id - ID filamento
 * @returns {boolean} - Successo operazione
 */
export function deleteFilament(id) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  const updatedFilaments = state.filaments.filter(f => f.id !== id);
  
  globalStateInstance.setState({ filaments: updatedFilaments });
  return true;
}

// =============================================
// FUNZIONI UI STATE (per compatibilità test)
// =============================================

/**
 * Imposta ricerca (per compatibilità test)
 * @param {string} searchTerm - Termine ricerca
 */
export function setSearch(searchTerm) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  const oldSearch = state.ui?.currentSearch || null;
  
  const updatedState = {
    ...state,
    ui: {
      ...state.ui,
      currentSearch: searchTerm
    }
  };
  
  globalStateInstance.state = updatedState;
  globalStateInstance.notify('ui.currentSearch', oldSearch);
  save(updatedState);
}

/**
 * Imposta filtro (per compatibilità test)
 * @param {string} filterType - Tipo filtro (es. 'brand', 'material')
 * @param {string} value - Valore filtro
 */
export function setFilter(filterType, value) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  const oldValue = state.ui?.filters?.[filterType] || null;
  
  const updatedState = {
    ...state,
    ui: {
      ...state.ui,
      filters: {
        ...state.ui?.filters,
        [filterType]: value
      }
    }
  };
  
  globalStateInstance.state = updatedState;
  globalStateInstance.notify(`ui.filters.${filterType}`, oldValue);
  save(updatedState);
}

/**
 * Imposta tema (per compatibilità test)
 * @param {string} theme - Tema ('light' o 'dark')
 */
export function setTheme(theme) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  const oldTheme = state.ui?.theme || null;
  
  const updatedState = {
    ...state,
    ui: {
      ...state.ui,
      theme: theme
    }
  };
  
  globalStateInstance.state = updatedState;
  globalStateInstance.notify('ui.theme', oldTheme);
  save(updatedState);
}

/**
 * Batch update - aggiorna più campi in una volta (per compatibilità test)
 * @param {Object} updates - Oggetto con path come chiavi (es. {'ui.currentSearch': 'test'})
 */
export function batchUpdate(updates) {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  let updatedState = { ...state };
  
  // Applica tutti gli aggiornamenti
  Object.keys(updates).forEach(path => {
    const value = updates[path];
    const parts = path.split('.');
    
    let current = updatedState;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      } else {
        current[part] = { ...current[part] };
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  });
  
  globalStateInstance.state = updatedState;
  // Notifica una sola volta per batch update
  globalStateInstance.notify('batch', state);
  save(updatedState);
}

/**
 * Debug - mostra stato completo in console (per compatibilità test)
 */
export function debug() {
  if (!globalStateInstance) {
    globalStateInstance = new AppState();
  }
  
  const state = globalStateInstance.getState();
  
  console.group('🔍 State Debug');
  console.log('Stato completo:', state);
  console.log('Filamenti:', state.filaments.length);
  console.log('Brands:', state.brandList?.length || state.brands?.length || 0);
  console.log('Materials:', state.materialList?.length || state.materials?.length || 0);
  console.log('Subscribers:', globalStateInstance.subscribers.length);
  console.groupEnd();
  
  return state;
}


