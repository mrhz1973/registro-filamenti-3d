/**
 * src/domain/filaments.js
 * Business logic per la gestione dei filamenti 3D
 * 
 * Contiene:
 * - Calcoli peso residuo e percentuali
 * - Statistiche aggregate
 * - Filtri e ordinamento
 * - Canonicalizzazione e validazione
 * - Helper functions
 */

// =============================================
// COSTANTI
// =============================================

export const DEFAULT_BRANDS = [
  "3DJake",
  "AMZ3D",
  "Amazon Basics",
  "Amolen",
  "Anycubic",
  "AnkerMake",
  "AzureFilm",
  "Bambu Lab",
  "BIQU",
  "ColorFabb",
  "Creality",
  "Devil Design",
  "eSUN",
  "Elegoo",
  "Extrudr",
  "Fiberlogy",
  "Fillamentum",
  "Flashforge",
  "Geeetech",
  "Gembird",
  "Hatchbox",
  "Kimya",
  "Kexcelled",
  "Kodak",
  "MatterHackers",
  "Overture",
  "Polymaker",
  "Prusament",
  "Raise3D",
  "SainSmart",
  "Spectrum",
  "Sunlu",
  "Tecbears",
  "TreeD",
  "Ultimaker",
  "Verbatim",
  "Voxelab",
  "XYZprinting",
  "Zortrax"
];

export const DEFAULT_MATERIALS_ORDERED = [
  "PLA",
  "PETG HF",
  "PLA+",
  "PETG",
  "ASA",
  "ABS",
  "TPU",
  "PLA Silk",
  "PLA Matte",
  "PLA-CF",
  "PLA HS",
  "PLA Wood",
  "PLA Tough+",
  "PETG-CF",
  "PETG Translucent",
  "PETG Glow",
  "PETG Matte",
  "Nylon",
  "Nylon-CF",
  "PC",
  "PC-CF",
  "PP",
  "HIPS",
  "PVA",
  "Support PLA/PETG",
  "Support",
  "PA",
  "PA6-CF",
  "PETG-GF",
  "PET",
  "PET CF",
  "PETG HS",
  "PETG Pro",
  "ASA-CF",
  "ASA HS",
  "ABS-CF",
  "ABS HS",
  "TPU 95A",
  "TPU 98A",
  "TPU 85A",
  "FLEX",
  "TPE",
  "Resina",
  "Altro"
];

const MATERIAL_CANON_MAP = {
  "pla basic": "PLA",
  "pla+": "PLA+",
  "pla plus": "PLA+",
  "support for pla/petg": "Support PLA/PETG",
  "supporto pla/petg": "Support PLA/PETG",
  "support pla petg": "Support PLA/PETG",
  "support for pa/pet": "Support PA/PET",
  "support for abs": "Support ABS",
  "pa6-cf": "PA6-CF",
  "pa6 cf": "PA6-CF",
  "pet-cf": "PET-CF",
  "pet cf": "PET-CF",
  "pla-cf": "PLA-CF",
  "pla cf": "PLA-CF",
  "petg-cf": "PETG-CF",
  "petg cf": "PETG-CF",
  "asa-cf": "ASA-CF",
  "asa cf": "ASA-CF",
  "abs-cf": "ABS-CF",
  "abs cf": "ABS-CF",
  "pc-cf": "PC-CF",
  "pc cf": "PC-CF",
  "petg translucent": "PETG Translucent",
  "petg traslucido": "PETG Translucent",
  "pla tough+": "PLA Tough+",
  "pla tough plus": "PLA Tough+",
  "pla toughplus": "PLA Tough+",
  "pla wood": "PLA Wood",
  "pla legno": "PLA Wood",
  "pla matte": "PLA Matte",
  "pla opaco": "PLA Matte",
  "pla silk": "PLA Silk",
  "pla seta": "PLA Silk",
  "petg hf": "PETG HF",
  "petg high flow": "PETG HF"
};

// Mappa prezzi Bambu Lab (IVA inclusa)
const BAMBU_PRICE_MAP = {
  // PLA Basic (singoli colori, sconto 57%)
  "A00-K0-1.75-1000-SPLFREE": 10.14,  // Nero
  "A00-R2-1.75-1000-SPLFREE": 10.14,  // Rosso bordeaux
  "A00-Y4-1.75-1000-SPLFREE": 10.14,  // Oro
  "A00-B5-1.75-1000-SPLFREE": 10.14,  // Turchese
  "A00-W1-1.75-1000-SPLFREE": 10.14,  // Bianco giada
  "A00-Y3-1.75-1000-SPLFREE": 10.14,  // Bronzo
  "A00-P1-1.75-1000-SPLFREE": 10.14,  // Rosa
  "A00-N1-1.75-1000-SPLFREE": 10.14,  // Marrone cacao
  "A00-PALLET-1.75-10000-SPLFREE": 11.57, // Pack 10 colori
  
  // PLA Matte
  "A01-P3-1.75-1000-SPLFREE": 10.14,  // Rosa sakura
  "A01-K1-1.75-1000-SPLFREE": 10.14,  // Carbone
  
  // PLA Tough+
  "A10-K0-1.75-1000-SPL": 24.90,      // Nero
  
  // PLA Wood
  "A16-K0-1.75-1000-SPL": 25.83,      // Noce nero
  
  // PETG HF (sconto 50%)
  "G02-W0-1.75-1000-SPL": 13.33,      // Bianco
  "G02-K0-1.75-1000-SPL": 13.33,      // Nero spool
  "G02-K0-1.75-1000-SPLFREE": 10.14,  // Nero refill
  "G02-B0-1.75-1000-SPL": 13.33,      // Blu
  "G02-R0-1.75-1000-SPL": 13.33,      // Rosso
  "G02-D0-1.75-1000-SPL": 13.33,      // Grigio
  
  // PETG Translucent (sconto 35%)
  "G01-P0-1.75-1000-SPLFREE": 15.32,  // Viola traslucido
  "G01-P1-1.75-1000-SPLFREE": 15.32,  // Rosa traslucido
  "G01-D0-1.75-1000-SPLFREE": 15.32,  // Grigio traslucido
  "G01-C0-1.75-1000-SPLFREE": 15.32,  // Trasparente
  
  // Materiali CF
  "B51-K0-1.75-1000-SPL": 39.97,      // ASA-CF Nero
  "G50-K0-1.75-1000-SPL": 36.90,      // PETG-CF Nero
  "N05-K0-1.75-500-SPL": 36.90,       // PA6-CF Nero
  
  // Support
  "S05-C0-1.75-500-SPL": 30.34,       // Support PLA/PETG
  "S04-Y0-1.75-500-SPL": 32.29,       // PVA
};

// =============================================
// CANONICALIZZAZIONE E PULIZIA
// =============================================

/**
 * Canonicalizza il nome di una marca
 * @param {string} rawBrand - Nome marca grezzo
 * @returns {string} - Nome canonicalizzato
 */
export function canonicalizeBrand(rawBrand) {
  if (!rawBrand) return "";
  const trimmed = String(rawBrand).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const match = DEFAULT_BRANDS.find((db) =>
    lower.startsWith(db.toLowerCase())
  );
  return match || trimmed;
}

/**
 * Canonicalizza il nome di un materiale
 * @param {string} rawMaterial - Nome materiale grezzo
 * @returns {string} - Nome canonicalizzato
 */
export function canonicalizeMaterial(rawMaterial) {
  if (!rawMaterial) return "";
  const trimmed = String(rawMaterial).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  
  // Prima cerca nella mappa di canonicalizzazione
  if (MATERIAL_CANON_MAP[lower]) {
    return MATERIAL_CANON_MAP[lower];
  }
  
  // Poi cerca match esatto nei materiali default
  const match = DEFAULT_MATERIALS_ORDERED.find((dm) =>
    lower === dm.toLowerCase()
  );
  
  return match || trimmed;
}

/**
 * Pulisce e deduplica una lista di brand
 * @param {string[]} list - Lista brand
 * @returns {string[]} - Lista pulita
 */
export function cleanBrandList(list) {
  const result = [];
  const seen = new Set();
  (list || []).forEach((b) => {
    const canon = canonicalizeBrand(b);
    if (!canon) return;
    const key = canon.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(canon);
    }
  });
  return result;
}

/**
 * Pulisce e deduplica una lista di materiali
 * @param {string[]} list - Lista materiali
 * @returns {string[]} - Lista pulita
 */
export function cleanMaterialList(list) {
  const result = [];
  const seen = new Set();
  (list || []).forEach((m) => {
    const canon = canonicalizeMaterial(m);
    if (!canon) return;
    const key = canon.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(canon);
    }
  });
  return result;
}

// =============================================
// CALCOLI PESO E RESIDUO
// =============================================

/**
 * Ricalcola peso residuo e consumato per un filamento
 * @param {Object} f - Oggetto filamento (viene modificato in place)
 */
export function recalcWeightsForFilament(f) {
  if (!f) return;

  const unit = f.unit_weight_g || 0;
  let remaining = 0;

  // Bobine sigillate = piene
  if (f.sealed_spools > 0) {
    remaining += f.sealed_spools * unit;
  }

  // Bobine aperte: usa l'array delle frazioni se disponibile
  if (f.open_spools > 0) {
    if (Array.isArray(f.open_spools_fractions) && f.open_spools_fractions.length > 0) {
      // Nuovo sistema: array delle frazioni
      for (let i = 0; i < Math.min(f.open_spools, f.open_spools_fractions.length); i++) {
        const fraction = typeof f.open_spools_fractions[i] === "number" 
          ? f.open_spools_fractions[i] 
          : 1;
        remaining += fraction * unit;
      }
    } else {
      // Vecchio sistema: retrocompatibilità
      const finished = f.finished_spools || 0;
      const nonFinishedOpen = f.open_spools - finished;
      
      if (nonFinishedOpen > 0) {
        const fraction = typeof f.main_fraction === "number" ? f.main_fraction : 1;
        remaining += fraction * unit;
        if (nonFinishedOpen > 1) {
          remaining += (nonFinishedOpen - 1) * unit;
        }
      }
    }
  }

  // Caso esplicito: nessuna bobina -> tutto consumato
  if (f.sealed_spools === 0 && f.open_spools === 0) {
    remaining = 0;
  }

  f.remaining_weight_g = remaining;
  f.used_weight_g = Math.max(
    0,
    (f.total_weight_g || 0) - f.remaining_weight_g
  );
}

/**
 * Calcola percentuale residua
 * @param {Object} f - Filamento
 * @returns {number} - Percentuale (0-100)
 */
export function calculatePercentageRemaining(f) {
  if (!f || !f.total_weight_g || f.total_weight_g === 0) return 0;
  return (f.remaining_weight_g / f.total_weight_g) * 100;
}

/**
 * Determina se un filamento è a scorta bassa
 * @param {Object} f - Filamento
 * @returns {boolean}
 */
export function isLowStock(f) {
  const ratio = f.total_weight_g > 0
    ? f.remaining_weight_g / f.total_weight_g
    : 0;
  const stockSpools = f.sealed_spools + f.open_spools;
  const lastOpen = stockSpools === 1 && f.open_spools === 1 && f.main_fraction < 1;

  return ratio <= 0.25 || lastOpen;
}

// =============================================
// STATISTICHE AGGREGATE
// =============================================

/**
 * Calcola statistiche totali su una lista di filamenti
 * @param {Object[]} filaments - Array filamenti
 * @returns {Object} - Statistiche totali
 */
export function calculateTotalStats(filaments) {
  let totalSpools = 0;
  let totalWeight = 0;
  let totalRemaining = 0;
  let lowCount = 0;

  filaments.forEach((f) => {
    totalSpools += f.spools_total || 0;
    totalWeight += f.total_weight_g || 0;
    totalRemaining += f.remaining_weight_g || 0;
    if (isLowStock(f)) lowCount++;
  });

  const totalUsed = Math.max(0, totalWeight - totalRemaining);

  return {
    totalSpools,
    totalWeight,
    totalRemaining,
    totalUsed,
    lowStockCount: lowCount
  };
}

/**
 * Calcola riepilogo scorte (nuove/aperte/extra)
 * @param {Object[]} filaments - Array filamenti
 * @returns {Object} - Riepilogo scorte
 */
export function calculateStockSummary(filaments) {
  let newCount = 0;
  let openCount = 0;
  let extraCount = 0;
  let remainingTotal = 0;

  filaments.forEach((f) => {
    newCount += f.sealed_spools || 0;
    openCount += f.open_spools || 0;
    remainingTotal += f.remaining_weight_g || 0;
    
    // Ricariche (refill) con bobine aperte = rulli extra
    if (f.packaging_type === "refill" && (f.open_spools || 0) > 0) {
      extraCount += f.open_spools || 0;
    }
  });

  return {
    newSpools: newCount,
    openSpools: openCount,
    extraSpools: extraCount,
    remainingGrams: remainingTotal
  };
}

/**
 * Raggruppa statistiche per brand
 * @param {Object[]} filaments - Array filamenti
 * @returns {Object[]} - Array di statistiche per brand
 */
export function calculateStatsByBrand(filaments) {
  const brandMap = new Map();

  filaments.forEach((f) => {
    const brand = canonicalizeBrand(f.brand || "");
    if (!brand) return;

    if (!brandMap.has(brand)) {
      brandMap.set(brand, {
        brand,
        count: 0,
        totalSpools: 0,
        totalWeight: 0,
        remainingWeight: 0,
        totalValue: 0
      });
    }

    const stats = brandMap.get(brand);
    stats.count++;
    stats.totalSpools += f.spools_total || 0;
    stats.totalWeight += f.total_weight_g || 0;
    stats.remainingWeight += f.remaining_weight_g || 0;
    
    if (f.unit_price && f.spools_total) {
      stats.totalValue += (f.unit_price * f.spools_total);
    }
  });

  return Array.from(brandMap.values()).sort((a, b) => 
    b.remainingWeight - a.remainingWeight
  );
}

/**
 * Raggruppa statistiche per materiale
 * @param {Object[]} filaments - Array filamenti
 * @returns {Object[]} - Array di statistiche per materiale
 */
export function calculateStatsByMaterial(filaments) {
  const materialMap = new Map();

  filaments.forEach((f) => {
    const material = canonicalizeMaterial(f.material || "");
    if (!material) return;

    if (!materialMap.has(material)) {
      materialMap.set(material, {
        material,
        count: 0,
        totalSpools: 0,
        totalWeight: 0,
        remainingWeight: 0
      });
    }

    const stats = materialMap.get(material);
    stats.count++;
    stats.totalSpools += f.spools_total || 0;
    stats.totalWeight += f.total_weight_g || 0;
    stats.remainingWeight += f.remaining_weight_g || 0;
  });

  return Array.from(materialMap.values()).sort((a, b) => 
    b.remainingWeight - a.remainingWeight
  );
}

// =============================================
// FILTRI
// =============================================

/**
 * Applica filtri multipli a una lista di filamenti
 * @param {Object[]} filaments - Array filamenti
 * @param {Object} filters - Oggetto filtri {brand, material, packaging, location}
 * @returns {Object[]} - Array filtrato
 */
export function applyFilters(filaments, filters = {}) {
  let result = filaments;

  if (filters.brand) {
    result = result.filter(f => f.brand === filters.brand);
  }
  if (filters.material) {
    result = result.filter(f => f.material === filters.material);
  }
  if (filters.packaging) {
    result = result.filter(f => f.packaging_type === filters.packaging);
  }
  if (filters.location) {
    result = result.filter(f => f.location === filters.location);
  }
  if (filters.lowStockOnly) {
    result = result.filter(f => isLowStock(f));
  }

  return result;
}

/**
 * Filtra filamenti per ricerca testuale
 * @param {Object[]} filaments - Array filamenti
 * @param {string} searchTerm - Termine di ricerca
 * @returns {Object[]} - Array filtrato
 */
export function filterBySearch(filaments, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return filaments;

  const term = searchTerm.trim().toLowerCase();
  
  return filaments.filter(f => {
    const brand = (f.brand || "").toLowerCase();
    const material = (f.material || "").toLowerCase();
    const variant = (f.variant || "").toLowerCase();
    const location = (f.location || "").toLowerCase();
    const notes = (f.notes || "").toLowerCase();

    return brand.includes(term) ||
           material.includes(term) ||
           variant.includes(term) ||
           location.includes(term) ||
           notes.includes(term);
  });
}

// =============================================
// ORDINAMENTO
// =============================================

/**
 * Ordina filamenti per campo
 * @param {Object[]} filaments - Array filamenti
 * @param {string} field - Campo per ordinamento
 * @param {string} direction - "asc" o "desc"
 * @returns {Object[]} - Array ordinato (nuovo array)
 */
export function sortFilaments(filaments, field, direction = "asc") {
  const sorted = [...filaments];
  const mult = direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];

    // Gestione stringhe
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    // Gestione null/undefined
    if (valA == null) valA = "";
    if (valB == null) valB = "";

    if (valA < valB) return -1 * mult;
    if (valA > valB) return 1 * mult;
    return 0;
  });

  return sorted;
}

// =============================================
// DEDUPLICAZIONE E AGGREGAZIONE
// =============================================

/**
 * Deduplica filamenti con stessa identità (brand/material/variant/color/peso)
 * Aggrega le quantità
 * @param {Object[]} list - Array filamenti
 * @returns {Object[]} - Array deduplicato
 */
export function deduplicateFilamentsByIdentity(list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const map = new Map();

  list.forEach((orig) => {
    if (!orig) return;
    const brand = canonicalizeBrand(orig.brand || "");
    const material = canonicalizeMaterial(orig.material);
    const variant = (orig.variant || "").trim();
    const colorCode = (orig.color_code || "").trim();
    const unit = orig.unit_weight_g || 0;

    const key =
      brand.toLowerCase() +
      "||" +
      material.toLowerCase() +
      "||" +
      variant.toLowerCase() +
      "||" +
      colorCode.toLowerCase() +
      "||" +
      unit;

    const f = {
      ...orig,
      brand,
      material,
      variant,
      color_code: colorCode,
      unit_weight_g: unit
    };

    if (!map.has(key)) {
      const spoolsFromCounts = (f.sealed_spools || 0) + (f.open_spools || 0);
      const baseSpools =
        typeof f.spools_total === "number" && f.spools_total >= 0
          ? f.spools_total
          : spoolsFromCounts;
      const totalWeight =
        typeof f.total_weight_g === "number" && f.total_weight_g >= 0
          ? f.total_weight_g
          : baseSpools * unit;

      let remaining =
        typeof f.remaining_weight_g === "number" && f.remaining_weight_g >= 0
          ? f.remaining_weight_g
          : undefined;
      let used =
        typeof f.used_weight_g === "number" && f.used_weight_g >= 0
          ? f.used_weight_g
          : undefined;

      if (typeof remaining !== "number" && typeof used === "number") {
        remaining = Math.max(0, totalWeight - used);
      }
      if (
        typeof remaining !== "number" &&
        typeof used !== "number" &&
        typeof totalWeight === "number"
      ) {
        remaining = totalWeight;
        used = 0;
      }
      if (
        typeof used !== "number" &&
        typeof remaining === "number" &&
        typeof totalWeight === "number"
      ) {
        used = Math.max(0, totalWeight - remaining);
      }

      const base = {
        ...f,
        spools_total: baseSpools,
        sealed_spools: f.sealed_spools || 0,
        open_spools: f.open_spools || 0,
        total_weight_g: totalWeight,
        remaining_weight_g: remaining != null ? remaining : 0,
        used_weight_g: used != null ? used : 0,
        main_fraction:
          typeof f.main_fraction === "number" ? f.main_fraction : 1
      };

      map.set(key, base);
    } else {
      const agg = map.get(key);
      const addSpools =
        typeof f.spools_total === "number" && f.spools_total >= 0
          ? f.spools_total
          : (f.sealed_spools || 0) + (f.open_spools || 0);
      const totalWeightAdd =
        typeof f.total_weight_g === "number" && f.total_weight_g >= 0
          ? f.total_weight_g
          : addSpools * unit;

      let remainingAdd =
        typeof f.remaining_weight_g === "number" &&
        f.remaining_weight_g >= 0
          ? f.remaining_weight_g
          : undefined;
      let usedAdd =
        typeof f.used_weight_g === "number" && f.used_weight_g >= 0
          ? f.used_weight_g
          : undefined;

      if (typeof remainingAdd !== "number" && typeof usedAdd === "number") {
        remainingAdd = Math.max(0, totalWeightAdd - usedAdd);
      }
      if (
        typeof remainingAdd !== "number" &&
        typeof usedAdd !== "number"
      ) {
        remainingAdd = totalWeightAdd;
        usedAdd = 0;
      }
      if (
        typeof usedAdd !== "number" &&
        typeof remainingAdd === "number"
      ) {
        usedAdd = Math.max(0, totalWeightAdd - remainingAdd);
      }

      agg.spools_total += addSpools;
      agg.sealed_spools += f.sealed_spools || 0;
      agg.open_spools += f.open_spools || 0;
      agg.total_weight_g += totalWeightAdd;
      agg.remaining_weight_g += remainingAdd;
      agg.used_weight_g += usedAdd;

      const frac =
        typeof f.main_fraction === "number" ? f.main_fraction : 1;
      const currentFrac =
        typeof agg.main_fraction === "number" ? agg.main_fraction : 1;
      agg.main_fraction = Math.min(currentFrac, frac);

      if (f.supplier && !agg.supplier) agg.supplier = f.supplier;
      if (f.notes) {
        agg.notes = agg.notes ? agg.notes + "; " + f.notes : f.notes;
      }
    }
  });

  return Array.from(map.values());
}

// =============================================
// HELPER PREZZI
// =============================================

/**
 * Ottiene prezzo automatico da SKU Bambu Lab
 * @param {string} sku - SKU prodotto
 * @returns {number|null} - Prezzo o null
 */
export function getAutoPrice(sku) {
  if (!sku) return null;
  return BAMBU_PRICE_MAP[sku] || null;
}

// =============================================
// RAGGRUPPAMENTO
// =============================================

/**
 * Raggruppa filamenti per brand
 * @param {Object[]} filaments - Array filamenti
 * @returns {Map<string, Object[]>} - Mappa brand -> filamenti
 */
export function groupByBrand(filaments) {
  const groups = new Map();
  
  filaments.forEach(f => {
    const brand = canonicalizeBrand(f.brand || "");
    if (!groups.has(brand)) {
      groups.set(brand, []);
    }
    groups.get(brand).push(f);
  });

  return groups;
}

/**
 * Raggruppa filamenti per materiale
 * @param {Object[]} filaments - Array filamenti
 * @returns {Map<string, Object[]>} - Mappa materiale -> filamenti
 */
export function groupByMaterial(filaments) {
  const groups = new Map();
  
  filaments.forEach(f => {
    const material = canonicalizeMaterial(f.material || "");
    if (!groups.has(material)) {
      groups.set(material, []);
    }
    groups.get(material).push(f);
  });

  return groups;
}

/**
 * Filtra filamenti per gruppi di materiali (es. PLA, PETG)
 * @param {Object[]} filaments - Array filamenti
 * @param {string[]} groupKeywords - Keywords del gruppo (es. ["pla"])
 * @returns {Object[]} - Array filtrato
 */
export function filterByMaterialGroup(filaments, groupKeywords) {
  return filaments.filter((f) =>
    groupKeywords.some((kw) =>
      (f.material || "")
        .toLowerCase()
        .includes(kw.toLowerCase())
    )
  );
}


