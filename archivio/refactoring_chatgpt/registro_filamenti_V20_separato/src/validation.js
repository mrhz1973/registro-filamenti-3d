/**
 * validation.js - Validazione e normalizzazione dati
 * 
 * Garantisce integrità e coerenza dei dati importati/inseriti
 */

/**
 * Normalizza e valida stato completo
 * @param {Object} state - Stato da normalizzare
 * @returns {Object} Stato normalizzato
 */
export function normalizeAndValidateState(state) {
  if (!state || typeof state !== 'object') {
    console.warn("normalizeAndValidateState: stato non valido, ritorno stato vuoto");
    return {
      filaments: [],
      purchasedFilaments: [],
      brandList: [],
      materialList: [],
      colorList: [],
      locationList: []
    };
  }

  return {
    filaments: normalizeFilaments(state.filaments || []),
    purchasedFilaments: normalizePurchasedFilaments(state.purchasedFilaments || []),
    brandList: normalizeBrandList(state.brandList || []),
    materialList: Array.isArray(state.materialList) ? state.materialList : [],
    colorList: Array.isArray(state.colorList) ? state.colorList : [],
    locationList: Array.isArray(state.locationList) ? state.locationList : []
  };
}

/**
 * Normalizza array di filamenti
 * @param {Array} filaments - Array filamenti da normalizzare
 * @returns {Array} Array filamenti normalizzati
 */
export function normalizeFilaments(filaments) {
  if (!Array.isArray(filaments)) {
    console.warn("normalizeFilaments: non è un array");
    return [];
  }

  return filaments.map((f, index) => {
    try {
      return normalizeFilament(f, index);
    } catch (e) {
      console.error(`Errore normalizzazione filamento ${index}:`, e);
      return null;
    }
  }).filter(f => f !== null);
}

/**
 * Normalizza singolo filamento
 * @param {Object} f - Filamento da normalizzare
 * @param {number} index - Indice per logging
 * @returns {Object} Filamento normalizzato
 */
function normalizeFilament(f, index) {
  if (!f || typeof f !== 'object') {
    throw new Error("Filamento non valido");
  }

  // ID univoco
  const id = f.id || generateId();

  // Campi obbligatori (stringhe)
  const brand = String(f.brand || "Unknown").trim();
  const material = String(f.material || "Unknown").trim();
  const variant = String(f.variant || "").trim();

  // Numeri validi
  const unit_weight = Math.max(1, parseInt(f.unit_weight) || 1000);
  const sealed_spools = Math.max(0, parseInt(f.sealed_spools) || 0);
  const open_spools = Math.max(0, parseInt(f.open_spools) || 0);

  // INVARIANTE CRITICO: Array frazioni
  let open_spools_fractions = [];
  
  // Migrazione da vecchio sistema (main_fraction)
  if (f.main_fraction != null && open_spools > 0) {
    const mainFraction = Math.max(0, Math.min(1, parseFloat(f.main_fraction) || 1));
    open_spools_fractions = Array(open_spools).fill(mainFraction);
  } else if (Array.isArray(f.open_spools_fractions)) {
    // Array esistente: normalizza e taglia
    open_spools_fractions = f.open_spools_fractions
      .slice(0, open_spools)
      .map(fr => Math.max(0, Math.min(1, parseFloat(fr) || 1)));
  } else {
    // Default: tutte piene
    open_spools_fractions = Array(open_spools).fill(1);
  }

  // INVARIANTE: lunghezza array frazioni = open_spools
  while (open_spools_fractions.length < open_spools) {
    open_spools_fractions.push(1);
  }
  open_spools_fractions = open_spools_fractions.slice(0, open_spools);

  // INVARIANTE CRITICO: Array posizioni
  const totalSpools = sealed_spools + open_spools;
  let spools_locations = [];

  // Migrazione da vecchio sistema (location singola)
  if (f.location && !Array.isArray(f.spools_locations)) {
    spools_locations = Array(totalSpools).fill(f.location);
  } else if (Array.isArray(f.spools_locations)) {
    // Array esistente: normalizza e taglia
    spools_locations = f.spools_locations
      .slice(0, totalSpools)
      .map(loc => String(loc || "").trim());
  } else {
    // Default: vuoto
    spools_locations = Array(totalSpools).fill("");
  }

  // INVARIANTE: lunghezza array posizioni = totalSpools
  while (spools_locations.length < totalSpools) {
    spools_locations.push("");
  }
  spools_locations = spools_locations.slice(0, totalSpools);

  // Altri campi
  const packaging = f.packaging || f.packaging_type || "spool";
  const unit_price = f.unit_price != null ? parseFloat(f.unit_price) : null;
  const supplier = String(f.supplier || "").trim();
  const notes = String(f.notes || "").trim();
  const location = String(f.location || "").trim(); // Retrocompatibilità

  // Array varianti (opzionale)
  const spools_variants = Array.isArray(f.spools_variants)
    ? f.spools_variants.slice(0, totalSpools).map(v => String(v || "").trim())
    : [];

  // Calcolo pesi (derivati, non salvati)
  const sealedWeight = sealed_spools * unit_weight;
  const fractionsSum = open_spools_fractions.reduce((a, b) => a + b, 0);
  const openWeight = fractionsSum * unit_weight;
  const total_weight = sealedWeight + openWeight;
  const remaining_weight = total_weight; // Inizialmente uguale

  // Timestamps
  const createdAt = f.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  return {
    id,
    brand,
    material,
    variant,
    packaging,
    unit_weight,
    unit_price,
    supplier,
    notes,
    sealed_spools,
    open_spools,
    open_spools_fractions,
    spools_locations,
    spools_variants,
    total_weight,
    remaining_weight,
    location, // Retrocompatibilità
    createdAt,
    updatedAt
  };
}

/**
 * Normalizza array filamenti comprati
 * @param {Array} purchased - Array filamenti comprati
 * @returns {Array} Array normalizzato
 */
export function normalizePurchasedFilaments(purchased) {
  if (!Array.isArray(purchased)) {
    return [];
  }

  return purchased.map(p => {
    try {
      return normalizePurchasedFilament(p);
    } catch (e) {
      console.error("Errore normalizzazione filamento comprato:", e);
      return null;
    }
  }).filter(p => p !== null);
}

/**
 * Normalizza singolo filamento comprato
 */
function normalizePurchasedFilament(p) {
  if (!p || typeof p !== 'object') {
    throw new Error("Filamento comprato non valido");
  }

  return {
    id: p.id || generateId(),
    brand: String(p.brand || "Unknown").trim(),
    material: String(p.material || "Unknown").trim(),
    variant: String(p.variant || "").trim(),
    packaging: p.packaging || p.packaging_type || "spool",
    quantity: Math.max(1, parseInt(p.quantity) || parseInt(p.quantity_spools) || 1),
    unit_weight: Math.max(1, parseInt(p.unit_weight) || 1000),
    unit_price: p.unit_price != null ? parseFloat(p.unit_price) : null,
    supplier: String(p.supplier || "").trim(),
    order_date: p.order_date || new Date().toISOString().split('T')[0],
    purchasedAt: p.purchasedAt || new Date().toISOString()
  };
}

/**
 * Normalizza lista brand
 */
function normalizeBrandList(brandList) {
  if (!Array.isArray(brandList)) {
    return [];
  }
  return brandList
    .map(b => String(b || "").trim())
    .filter(b => b.length > 0)
    .sort();
}

/**
 * Valida filamento prima di salvare
 * @param {Object} f - Filamento da validare
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateFilament(f) {
  const errors = [];

  if (!f.brand || f.brand.trim() === "") {
    errors.push("Brand obbligatorio");
  }

  if (!f.material || f.material.trim() === "") {
    errors.push("Materiale obbligatorio");
  }

  if (!f.variant || f.variant.trim() === "") {
    errors.push("Colore/Variante obbligatorio");
  }

  if (!f.unit_weight || f.unit_weight <= 0) {
    errors.push("Peso unitario deve essere > 0");
  }

  if (f.sealed_spools < 0 || f.open_spools < 0) {
    errors.push("Numero bobine non può essere negativo");
  }

  if (f.sealed_spools === 0 && f.open_spools === 0) {
    errors.push("Deve esserci almeno una bobina (sigillata o aperta)");
  }

  // Validazione array frazioni
  if (Array.isArray(f.open_spools_fractions)) {
    if (f.open_spools_fractions.length !== f.open_spools) {
      errors.push(`Array frazioni deve avere lunghezza ${f.open_spools}`);
    }
    f.open_spools_fractions.forEach((fr, i) => {
      if (fr < 0 || fr > 1) {
        errors.push(`Frazione bobina ${i + 1} deve essere tra 0 e 1`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Genera ID univoco
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  normalizeAndValidateState,
  normalizeFilaments,
  normalizePurchasedFilaments,
  validateFilament
};












