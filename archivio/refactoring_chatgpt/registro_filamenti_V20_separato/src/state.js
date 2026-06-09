/**
 * state.js - Gestione stato applicazione
 * 
 * Implementa pattern Observer per notificare i cambiamenti
 * e garantisce immutabilità dello stato
 */

// Schema version per migrazioni future
export const SCHEMA_VERSION = "3.0";

/**
 * Stato iniziale dell'applicazione
 */
const initialState = {
  filaments: [],
  purchasedFilaments: [],
  brandList: [],
  materialList: [
    "PLA", "PETG", "ABS", "TPU", "Nylon", "HIPS", "ASA", "PC", "PVA",
    "PLA+", "PLA Silk", "PLA Matte", "PLA Wood", "PLA-CF",
    "PETG HF", "PETG-CF", "PETG Translucent",
    "PA6-CF", "Support PLA/PETG"
  ],
  colorList: [
    "Nero", "Bianco", "Grigio", "Rosso", "Blu", "Verde", "Giallo",
    "Arancione", "Viola", "Rosa", "Marrone", "Oro", "Argento",
    "Trasparente", "Naturale"
  ],
  locationList: ["box Ikea", "scaffale Top", "scaffale Down", "AMS/H2D", "Box Blu"]
};

/**
 * Classe per gestione stato con Observer pattern
 */
export class AppState {
  constructor() {
    this._state = JSON.parse(JSON.stringify(initialState));
    this._observers = [];
    this._version = SCHEMA_VERSION;
  }

  /**
   * Ritorna copia profonda dello stato (immutabilità)
   */
  getState() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /**
   * Aggiorna lo stato e notifica gli observers
   * @param {Object} updates - Oggetto con le proprietà da aggiornare
   */
  setState(updates) {
    if (!updates || typeof updates !== 'object') {
      console.error("setState: updates deve essere un oggetto");
      return;
    }

    // Merge updates nello stato
    this._state = {
      ...this._state,
      ...JSON.parse(JSON.stringify(updates))
    };

    // Notifica observers
    this._notifyObservers();
  }

  /**
   * Sostituisce completamente lo stato
   * @param {Object} newState - Nuovo stato completo
   */
  replaceState(newState) {
    if (!newState || typeof newState !== 'object') {
      console.error("replaceState: newState deve essere un oggetto");
      return;
    }

    this._state = JSON.parse(JSON.stringify({
      ...initialState,
      ...newState
    }));

    this._notifyObservers();
  }

  /**
   * Registra un observer per i cambiamenti di stato
   * @param {Function} callback - Funzione chiamata ad ogni cambiamento
   * @returns {Function} Funzione per rimuovere l'observer
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      console.error("subscribe: callback deve essere una funzione");
      return () => {};
    }

    this._observers.push(callback);

    // Ritorna funzione per unsubscribe
    return () => {
      this._observers = this._observers.filter(obs => obs !== callback);
    };
  }

  /**
   * Notifica tutti gli observers
   */
  _notifyObservers() {
    const stateCopy = this.getState();
    this._observers.forEach(callback => {
      try {
        callback(stateCopy);
      } catch (e) {
        console.error("Errore in observer:", e);
      }
    });
  }

  /**
   * Ritorna la versione dello schema
   */
  getVersion() {
    return this._version;
  }
}

// Istanza singleton
let appStateInstance = null;

/**
 * Ritorna l'istanza singleton dello stato
 */
export function getAppState() {
  if (!appStateInstance) {
    appStateInstance = new AppState();
  }
  return appStateInstance;
}

/**
 * Reset dell'istanza (utile per test)
 */
export function resetAppState() {
  appStateInstance = new AppState();
  return appStateInstance;
}

export default AppState;












