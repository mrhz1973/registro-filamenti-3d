/**
 * domain/filaments.js - Logica business filamenti
 * 
 * Funzioni pure per calcoli, statistiche, filtri, ordinamento
 */

/**
 * Calcola statistiche totali
 * @param {Array} filaments - Array filamenti
 * @returns {Object} Statistiche
 */
export function calculateTotalStats(filaments) {
  const totalWeight = filaments.reduce((sum, f) => sum + (f.remaining_weight || 0), 0);
  
  const totalValue = filaments.reduce((sum, f) => {
    if (!f.unit_price || f.unit_price <= 0) return sum;
    const spools = (f.remaining_weight || 0) / (f.unit_weight || 1);
    return sum + (spools * f.unit_price);
  }, 0);

  const totalSpools = filaments.reduce((sum, f) => 
    sum + (f.sealed_spools || 0) + (f.open_spools || 0), 0
  );

  const totalItems = filaments.length;

  return {
    totalWeight,
    totalValue,
    totalSpools,
    totalItems
  };
}

/**
 * Verifica se filamento è in scorte basse
 * @param {Object} filament - Filamento da verificare
 * @param {number} threshold - Soglia (0-1)
 * @returns {boolean}
 */
export function isLowStock(filament, threshold = 0.25) {
  const totalCapacity = (filament.sealed_spools || 0) + (filament.open_spools || 0);
  if (totalCapacity === 0) return false;

  const fractionsSum = Array.isArray(filament.open_spools_fractions)
    ? filament.open_spools_fractions.reduce((a, b) => a + b, 0)
    : 0;
  
  const currentCapacity = (filament.sealed_spools || 0) + fractionsSum;
  const ratio = currentCapacity / totalCapacity;

  return ratio <= threshold;
}

/**
 * Conta filamenti in scorte basse
 * @param {Array} filaments - Array filamenti
 * @param {number} threshold - Soglia
 * @returns {number}
 */
export function countLowStock(filaments, threshold = 0.25) {
  return filaments.filter(f => isLowStock(f, threshold)).length;
}

/**
 * Calcola riepilogo per brand
 * @param {Array} filaments - Array filamenti
 * @returns {Object} { [brand]: weight }
 */
export function calculateBrandSummary(filaments) {
  const byBrand = {};
  
  filaments.forEach(f => {
    const brand = f.brand || "Unknown";
    if (!byBrand[brand]) {
      byBrand[brand] = 0;
    }
    byBrand[brand] += f.remaining_weight || 0;
  });

  return byBrand;
}

/**
 * Calcola riepilogo per materiale
 * @param {Array} filaments - Array filamenti
 * @returns {Object} { [material]: weight }
 */
export function calculateMaterialSummary(filaments) {
  const byMaterial = {};
  
  filaments.forEach(f => {
    const material = f.material || "Unknown";
    if (!byMaterial[material]) {
      byMaterial[material] = 0;
    }
    byMaterial[material] += f.remaining_weight || 0;
  });

  return byMaterial;
}

/**
 * Applica filtri ai filamenti
 * @param {Array} filaments - Array filamenti
 * @param {Object} filters - Oggetto filtri
 * @param {number} threshold - Soglia scorte basse
 * @returns {Array} Filamenti filtrati
 */
export function applyFilters(filaments, filters, threshold = 0.25) {
  let result = [...filaments];

  if (filters.brand && filters.brand !== "") {
    result = result.filter(f => f.brand === filters.brand);
  }

  if (filters.material && filters.material !== "") {
    result = result.filter(f => f.material === filters.material);
  }

  if (filters.packaging && filters.packaging !== "") {
    result = result.filter(f => f.packaging === filters.packaging);
  }

  if (filters.lowStockOnly) {
    result = result.filter(f => isLowStock(f, threshold));
  }

  return result;
}

/**
 * Filtra per ricerca full-text
 * @param {Array} filaments - Array filamenti
 * @param {string} query - Query di ricerca
 * @returns {Array} Filamenti filtrati
 */
export function filterBySearch(filaments, query) {
  if (!query || query.trim() === "") {
    return filaments;
  }

  const lowerQuery = query.toLowerCase().trim();
  
  return filaments.filter(f => {
    const brand = (f.brand || "").toLowerCase();
    const material = (f.material || "").toLowerCase();
    const variant = (f.variant || "").toLowerCase();
    const supplier = (f.supplier || "").toLowerCase();
    const notes = (f.notes || "").toLowerCase();

    return brand.includes(lowerQuery) ||
           material.includes(lowerQuery) ||
           variant.includes(lowerQuery) ||
           supplier.includes(lowerQuery) ||
           notes.includes(lowerQuery);
  });
}

/**
 * Ordina filamenti per campo
 * @param {Array} filaments - Array filamenti
 * @param {string} field - Campo per ordinamento
 * @param {string} direction - 'asc' o 'desc'
 * @returns {Array} Filamenti ordinati
 */
export function sortFilaments(filaments, field, direction = "asc") {
  if (!field) return [...filaments];

  return [...filaments].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    // Handle null/undefined
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";

    // String comparison
    if (typeof aVal === "string") {
      const comparison = aVal.localeCompare(bVal, 'it', { sensitivity: 'base' });
      return direction === "asc" ? comparison : -comparison;
    }

    // Number comparison
    const comparison = aVal - bVal;
    return direction === "asc" ? comparison : -comparison;
  });
}

/**
 * Ricalcola pesi per filamento
 * @param {Object} filament - Filamento
 * @returns {Object} Filamento con pesi ricalcolati
 */
export function recalcWeightsForFilament(filament) {
  const sealedWeight = (filament.sealed_spools || 0) * (filament.unit_weight || 0);
  
  const fractionsSum = Array.isArray(filament.open_spools_fractions)
    ? filament.open_spools_fractions.reduce((a, b) => a + b, 0)
    : 0;
  
  const openWeight = fractionsSum * (filament.unit_weight || 0);
  const total_weight = sealedWeight + openWeight;
  const remaining_weight = total_weight;

  return {
    ...filament,
    total_weight,
    remaining_weight
  };
}

/**
 * Deduplica filamenti per identità (brand+material+variant+packaging)
 * @param {Array} filaments - Array filamenti
 * @returns {Array} Filamenti deduplicati
 */
export function deduplicateFilamentsByIdentity(filaments) {
  const seen = new Map();
  
  return filaments.filter(f => {
    const key = `${f.brand}-${f.material}-${f.variant}-${f.packaging}`.toLowerCase();
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.set(key, true);
    return true;
  });
}

/**
 * Estrae lista brand unici da filamenti
 * @param {Array} filaments - Array filamenti
 * @returns {string[]} Array brand unici ordinati
 */
export function extractBrandList(filaments) {
  const brands = new Set();
  
  filaments.forEach(f => {
    if (f.brand && f.brand.trim() !== "") {
      brands.add(f.brand.trim());
    }
  });
  
  return Array.from(brands).sort();
}

/**
 * Estrae lista materiali unici da filamenti
 * @param {Array} filaments - Array filamenti
 * @returns {string[]} Array materiali unici ordinati
 */
export function extractMaterialList(filaments) {
  const materials = new Set();
  
  filaments.forEach(f => {
    if (f.material && f.material.trim() !== "") {
      materials.add(f.material.trim());
    }
  });
  
  return Array.from(materials).sort();
}

/**
 * Normalizza brand (case-insensitive match)
 */
export function canonicalizeBrand(brand, brandList = []) {
  if (!brand || typeof brand !== 'string') return brand;
  
  const normalized = brand.trim();
  const match = brandList.find(
    b => b.toLowerCase() === normalized.toLowerCase()
  );
  
  return match || normalized;
}

/**
 * Normalizza materiale (uppercase)
 */
export function canonicalizeMaterial(material) {
  if (!material || typeof material !== 'string') return material;
  return material.trim().toUpperCase();
}

export default {
  calculateTotalStats,
  isLowStock,
  countLowStock,
  calculateBrandSummary,
  calculateMaterialSummary,
  applyFilters,
  filterBySearch,
  sortFilaments,
  recalcWeightsForFilament,
  deduplicateFilamentsByIdentity,
  extractBrandList,
  extractMaterialList,
  canonicalizeBrand,
  canonicalizeMaterial
};












