/**
 * validation.js - Fase 0
 * Validazione e normalizzazione dati filamenti
 * 
 * Invarianti garantiti:
 * I1: spools_total === sealed_spools + open_spools
 * I2: total_weight_g === spools_total × unit_weight_g
 * I3: 0 ≤ remaining_weight_g ≤ total_weight_g
 * I4: used_weight_g === total_weight_g - remaining_weight_g
 * I5: 0 ≤ main_fraction ≤ 1
 * I6: open_spools_fractions.length ≤ open_spools
 * I7: ogni fraction è tra 0 e 1
 * I8: sealed_spools ≥ 0 e open_spools ≥ 0
 */

// ============================================
// CONFIGURAZIONE
// ============================================

const SCHEMA_VERSION = 1;

const DEFAULTS = {
  unit_weight_g: 1000,
  packaging_type: 'spool',
  main_fraction: 1,
  sealed_spools: 0,
  open_spools: 0
};

const VALID_PACKAGING_TYPES = ['spool', 'refill'];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Genera un ID univoco
 */
function generateId() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2);
}

/**
 * Clamp di un valore tra min e max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Verifica se un valore è un numero valido (non NaN, non Infinity)
 */
function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Converte a numero, ritorna default se non valido
 */
function toNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isValidNumber(num) ? num : defaultValue;
}

// ============================================
// VALIDAZIONE SINGOLO FILAMENTO
// ============================================

/**
 * Normalizza e valida un singolo filamento
 * 
 * @param {Object} raw - Dati grezzi del filamento
 * @returns {{ filament: Object, warnings: string[], errors: string[] }}
 */
export function normalizeAndValidateFilament(raw) {
  const warnings = [];
  const errors = [];
  
  // Se input non è un oggetto, errore fatale
  if (!raw || typeof raw !== 'object') {
    errors.push('Input non è un oggetto valido');
    return { filament: null, warnings, errors };
  }

  // Copia per non mutare l'originale
  const f = { ...raw };

  // --- ID ---
  if (!f.id || typeof f.id !== 'string') {
    f.id = generateId();
    warnings.push('ID mancante o invalido, generato nuovo');
  }

  // --- Campi stringa richiesti (più permissivi) ---
  if (!f.brand || typeof f.brand !== 'string' || f.brand.trim() === '') {
    // Se brand è vuoto, prova a usare un default o genera errore solo se davvero critico
    if (f.brand === null || f.brand === undefined) {
      errors.push('Campo "brand" richiesto');
    } else {
      // Se è una stringa vuota, usa "Sconosciuto"
      f.brand = "Sconosciuto";
      warnings.push('Brand vuoto, impostato a "Sconosciuto"');
    }
  } else {
    f.brand = f.brand.trim();
  }

  if (!f.material || typeof f.material !== 'string' || f.material.trim() === '') {
    // Se material è vuoto, prova a usare un default o genera errore solo se davvero critico
    if (f.material === null || f.material === undefined) {
      errors.push('Campo "material" richiesto');
    } else {
      // Se è una stringa vuota, usa "PLA" come default
      f.material = "PLA";
      warnings.push('Material vuoto, impostato a "PLA"');
    }
  } else {
    f.material = f.material.trim();
  }

  // --- Campi stringa opzionali ---
  f.variant = typeof f.variant === 'string' ? f.variant.trim() : '';
  f.color_code = typeof f.color_code === 'string' ? f.color_code.trim() : '';
  f.supplier = typeof f.supplier === 'string' ? f.supplier.trim() : '';
  f.notes = typeof f.notes === 'string' ? f.notes.trim() : '';
  f.location = typeof f.location === 'string' ? f.location.trim() : '';

  // --- Packaging type ---
  if (!VALID_PACKAGING_TYPES.includes(f.packaging_type)) {
    if (f.packaging_type) {
      warnings.push(`packaging_type "${f.packaging_type}" non valido, uso "spool"`);
    }
    f.packaging_type = DEFAULTS.packaging_type;
  }

  // --- unit_weight_g ---
  f.unit_weight_g = toNumber(f.unit_weight_g, DEFAULTS.unit_weight_g);
  if (f.unit_weight_g <= 0) {
    warnings.push(`unit_weight_g ${f.unit_weight_g} non valido, uso ${DEFAULTS.unit_weight_g}`);
    f.unit_weight_g = DEFAULTS.unit_weight_g;
  }

  // --- unit_price ---
  if (f.unit_price !== null && f.unit_price !== undefined) {
    f.unit_price = toNumber(f.unit_price, null);
    if (f.unit_price !== null && f.unit_price < 0) {
      warnings.push('unit_price negativo, impostato a null');
      f.unit_price = null;
    }
  } else {
    f.unit_price = null;
  }

  // --- Conteggio bobine (I8: non negativi) ---
  f.sealed_spools = Math.max(0, Math.floor(toNumber(f.sealed_spools, DEFAULTS.sealed_spools)));
  f.open_spools = Math.max(0, Math.floor(toNumber(f.open_spools, DEFAULTS.open_spools)));

  // --- I1: spools_total === sealed_spools + open_spools ---
  const computedTotal = f.sealed_spools + f.open_spools;
  const declaredTotal = toNumber(f.spools_total, computedTotal);
  
  if (declaredTotal !== computedTotal) {
    warnings.push(`spools_total (${declaredTotal}) ≠ sealed + open (${computedTotal}), corretto`);
  }
  f.spools_total = computedTotal;

  // --- I2: total_weight_g === spools_total × unit_weight_g ---
  const computedTotalWeight = f.spools_total * f.unit_weight_g;
  if (toNumber(f.total_weight_g) !== computedTotalWeight) {
    if (f.total_weight_g !== undefined) {
      warnings.push(`total_weight_g ricalcolato: ${f.total_weight_g} → ${computedTotalWeight}`);
    }
  }
  f.total_weight_g = computedTotalWeight;

  // --- open_spools_fractions (I6, I7) ---
  if (!Array.isArray(f.open_spools_fractions)) {
    f.open_spools_fractions = [];
  }
  
  // I6: max open_spools elementi
  if (f.open_spools_fractions.length > f.open_spools) {
    warnings.push(`open_spools_fractions ha ${f.open_spools_fractions.length} elementi ma open_spools è ${f.open_spools}, troncato`);
    f.open_spools_fractions = f.open_spools_fractions.slice(0, f.open_spools);
  }
  
  // I7: ogni frazione tra 0 e 1
  f.open_spools_fractions = f.open_spools_fractions.map((frac, i) => {
    const num = toNumber(frac, 1);
    const clamped = clamp(num, 0, 1);
    if (num !== clamped) {
      warnings.push(`open_spools_fractions[${i}] fuori range (${num}), clampato a ${clamped}`);
    }
    return clamped;
  });

  // --- I5: main_fraction tra 0 e 1 ---
  f.main_fraction = toNumber(f.main_fraction, DEFAULTS.main_fraction);
  f.main_fraction = clamp(f.main_fraction, 0, 1);

  // --- Calcolo remaining_weight_g ---
  let computedRemaining = 0;
  
  // Bobine sigillate = 100%
  computedRemaining += f.sealed_spools * f.unit_weight_g;
  
  // Bobine aperte con frazione specificata
  for (let i = 0; i < f.open_spools_fractions.length; i++) {
    computedRemaining += f.open_spools_fractions[i] * f.unit_weight_g;
  }
  
  // Bobine aperte senza frazione specifica → usa main_fraction
  const openWithoutFraction = f.open_spools - f.open_spools_fractions.length;
  if (openWithoutFraction > 0) {
    computedRemaining += openWithoutFraction * f.main_fraction * f.unit_weight_g;
  }

  // I3: 0 ≤ remaining_weight_g ≤ total_weight_g
  computedRemaining = clamp(computedRemaining, 0, f.total_weight_g);
  
  const declaredRemaining = toNumber(f.remaining_weight_g, computedRemaining);
  if (Math.abs(declaredRemaining - computedRemaining) > 1) { // Tolleranza 1g per arrotondamenti
    warnings.push(`remaining_weight_g ricalcolato: ${declaredRemaining} → ${computedRemaining}`);
  }
  f.remaining_weight_g = Math.round(computedRemaining);

  // --- I4: used_weight_g = total - remaining ---
  f.used_weight_g = f.total_weight_g - f.remaining_weight_g;

  // --- Pulizia campi legacy/non necessari ---
  // (manteniamo spools_locations se presente per retrocompatibilità)
  if (f.spools_locations && !Array.isArray(f.spools_locations)) {
    delete f.spools_locations;
  }

  return { filament: f, warnings, errors };
}

// ============================================
// VALIDAZIONE STATE COMPLETO
// ============================================

/**
 * Valida e normalizza l'intero state dell'applicazione
 * 
 * @param {Object} rawState - State grezzo (da localStorage o import)
 * @returns {{ state: Object, stats: Object }}
 */
export function normalizeAndValidateState(rawState) {
  const stats = {
    filaments: { total: 0, valid: 0, fixed: 0, rejected: 0 },
    purchased: { total: 0, valid: 0, fixed: 0, rejected: 0 },
    warnings: [],
    errors: []
  };

  const state = {
    schemaVersion: SCHEMA_VERSION,
    filaments: [],
    purchasedFilaments: [],
    brandList: [],
    materialList: [],
    brands: [], // Alias per compatibilità
    materials: [], // Alias per compatibilità
    colors: []
  };

  if (!rawState || typeof rawState !== 'object') {
    stats.errors.push('State non è un oggetto valido');
    return { state, stats };
  }

  // --- Filamenti disponibili ---
  if (Array.isArray(rawState.filaments)) {
    stats.filaments.total = rawState.filaments.length;
    
    for (const raw of rawState.filaments) {
      const { filament, warnings, errors } = normalizeAndValidateFilament(raw);
      
      if (errors.length > 0) {
        stats.filaments.rejected++;
        stats.errors.push(`Filamento rifiutato: ${errors.join(', ')}`);
      } else {
        state.filaments.push(filament);
        stats.filaments.valid++;
        
        if (warnings.length > 0) {
          stats.filaments.fixed++;
          stats.warnings.push(...warnings.map(w => `[${filament.id.slice(-6)}] ${w}`));
        }
      }
    }
  }

  // --- Filamenti acquistati (stessa validazione) ---
  if (Array.isArray(rawState.purchasedFilaments)) {
    stats.purchased.total = rawState.purchasedFilaments.length;
    
    for (const raw of rawState.purchasedFilaments) {
      const { filament, warnings, errors } = normalizeAndValidateFilament(raw);
      
      if (errors.length > 0) {
        stats.purchased.rejected++;
        stats.errors.push(`Acquisto rifiutato: ${errors.join(', ')}`);
      } else {
        state.purchasedFilaments.push(filament);
        stats.purchased.valid++;
        
        if (warnings.length > 0) {
          stats.purchased.fixed++;
          stats.warnings.push(...warnings.map(w => `[purchased:${filament.id.slice(-6)}] ${w}`));
        }
      }
    }
  }

  // --- Liste (brands, materials, colors) ---
  // Supporta sia brands che brandList per compatibilità
  const brandsArray = Array.isArray(rawState.brands) 
    ? rawState.brands 
    : (Array.isArray(rawState.brandList) ? rawState.brandList : []);
  
  state.brands = brandsArray.filter(b => typeof b === 'string' && b.trim());
  state.brandList = state.brands; // Alias per compatibilità
    
  // Supporta sia materials che materialList per compatibilità
  const materialsArray = Array.isArray(rawState.materials)
    ? rawState.materials
    : (Array.isArray(rawState.materialList) ? rawState.materialList : []);
    
  state.materials = materialsArray.filter(m => typeof m === 'string' && m.trim());
  state.materialList = state.materials; // Alias per compatibilità
    
  state.colors = Array.isArray(rawState.colors)
    ? rawState.colors.filter(c => typeof c === 'string' && c.trim())
    : [];

  return { state, stats };
}

// ============================================
// UTILITY PER TEST E DEBUG
// ============================================

/**
 * Verifica tutti gli invarianti su un filamento
 * Utile per debug e test
 * 
 * @param {Object} f - Filamento da verificare
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function checkInvariants(f) {
  const violations = [];

  // I1
  if (f.spools_total !== f.sealed_spools + f.open_spools) {
    violations.push(`I1: spools_total (${f.spools_total}) ≠ sealed + open (${f.sealed_spools + f.open_spools})`);
  }

  // I2
  if (f.total_weight_g !== f.spools_total * f.unit_weight_g) {
    violations.push(`I2: total_weight_g (${f.total_weight_g}) ≠ spools × unit (${f.spools_total * f.unit_weight_g})`);
  }

  // I3
  if (f.remaining_weight_g < 0 || f.remaining_weight_g > f.total_weight_g) {
    violations.push(`I3: remaining_weight_g (${f.remaining_weight_g}) fuori range [0, ${f.total_weight_g}]`);
  }

  // I4
  if (f.used_weight_g !== f.total_weight_g - f.remaining_weight_g) {
    violations.push(`I4: used_weight_g (${f.used_weight_g}) ≠ total - remaining (${f.total_weight_g - f.remaining_weight_g})`);
  }

  // I5
  if (f.main_fraction < 0 || f.main_fraction > 1) {
    violations.push(`I5: main_fraction (${f.main_fraction}) fuori range [0, 1]`);
  }

  // I6
  if (f.open_spools_fractions.length > f.open_spools) {
    violations.push(`I6: open_spools_fractions.length (${f.open_spools_fractions.length}) > open_spools (${f.open_spools})`);
  }

  // I7
  f.open_spools_fractions.forEach((frac, i) => {
    if (frac < 0 || frac > 1) {
      violations.push(`I7: open_spools_fractions[${i}] (${frac}) fuori range [0, 1]`);
    }
  });

  // I8
  if (f.sealed_spools < 0) violations.push(`I8: sealed_spools (${f.sealed_spools}) < 0`);
  if (f.open_spools < 0) violations.push(`I8: open_spools (${f.open_spools}) < 0`);

  return { valid: violations.length === 0, violations };
}

/**
 * Stampa report di validazione
 */
export function printValidationReport(stats) {
  console.group('📋 Report Validazione');
  
  console.log(`Filamenti: ${stats.filaments.valid}/${stats.filaments.total} validi`);
  if (stats.filaments.fixed > 0) console.log(`  ⚠️ ${stats.filaments.fixed} corretti automaticamente`);
  if (stats.filaments.rejected > 0) console.log(`  ❌ ${stats.filaments.rejected} rifiutati`);
  
  console.log(`Acquisti: ${stats.purchased.valid}/${stats.purchased.total} validi`);
  if (stats.purchased.fixed > 0) console.log(`  ⚠️ ${stats.purchased.fixed} corretti automaticamente`);
  if (stats.purchased.rejected > 0) console.log(`  ❌ ${stats.purchased.rejected} rifiutati`);
  
  if (stats.warnings.length > 0) {
    console.groupCollapsed(`⚠️ ${stats.warnings.length} warning`);
    stats.warnings.forEach(w => console.log(w));
    console.groupEnd();
  }
  
  if (stats.errors.length > 0) {
    console.groupCollapsed(`❌ ${stats.errors.length} errori`);
    stats.errors.forEach(e => console.log(e));
    console.groupEnd();
  }
  
  console.groupEnd();
}


