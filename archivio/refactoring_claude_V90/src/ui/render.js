/**
 * src/ui/render.js
 * Funzioni di rendering e visualizzazione UI
 * 
 * Contiene:
 * - Helper HTML e formattazione
 * - Rendering tabelle (magazzino, comprati)
 * - Dashboard e statistiche
 * - Barre visualizzazione materiali
 * - Dropdown custom (colori, azioni)
 * - Liste e opzioni
 * - Storici e grafici
 */

import {
  canonicalizeBrand,
  canonicalizeMaterial,
  isLowStock,
  } from '../domain/filaments.js';

// =============================================
// COSTANTI COLORI
// =============================================

export const DEFAULT_COLORS = [
  "Nero", "Bianco", "Grigio", "Grigio chiaro", "Grigio scuro",
  "Argento", "Trasparente", "Rosso", "Rosso vino", "Rosso mattone",
  "Arancione", "Giallo", "Giallo pastello", "Verde", "Verde acido",
  "Verde oliva", "Verde minta", "Blu", "Blu scuro", "Blu navy",
  "Blu turchese", "Azzurro", "Ciano", "Viola", "Lilla", "Magenta",
  "Rosa", "Rosa chiaro", "Rosa caldo", "Marrone", "Marrone chiaro",
  "Beige", "Crema", "Oro", "Oro rosa", "Rame", "Bronzo"
];

// Mappa completa colori HEX (compresi codici Bambu Lab)
const COLOR_HEX_MAP = {
  // Colori base
  "Nero": "#000000",
  "Bianco": "#FFFFFF",
  "Grigio": "#8E9089",
  "Grigio chiaro": "#D1D3D5",
  "Grigio scuro": "#545454",
  "Argento": "#A6A9AA",
  "Trasparente": "#e5e7eb",
  "Rosso": "#C12E1F",
  "Rosso vino": "#9D2235",
  "Rosso mattone": "#9f332a",
  "Arancione": "#FF6A13",
  "Giallo": "#F4EE2A",
  "Giallo pastello": "#FEC600",
  "Verde": "#00AE42",
  "Verde acido": "#BECF00",
  "Verde oliva": "#68724D",
  "Verde minta": "#22c55e",
  "Blu": "#0A2989",
  "Blu scuro": "#042F56",
  "Blu navy": "#1e3a8a",
  "Blu turchese": "#00B1B7",
  "Turchese": "#00B1B7",
  "Azzurro": "#0086D6",
  "Ciano": "#00D9FF",
  "Viola": "#8B00FF",
  "Lilla": "#C8A2C8",
  "Magenta": "#FF00FF",
  "Rosa": "#FFAFD7",
  "Rosa chiaro": "#FFC0CB",
  "Rosa caldo": "#FF69B4",
  "Marrone": "#8B4513",
  "Marrone chiaro": "#D2B48C",
  "Marrone cacao": "#4F3422",
  "Beige": "#F5F5DC",
  "Crema": "#FFFDD0",
  "Oro": "#FFD700",
  "Oro rosa": "#E5AA70",
  "Rame": "#B87333",
  "Bronzo": "#CD7F32",
  "Gunmetal": "#2a3439",
  "Grafite": "#383428",
  
  // Bambu Lab PLA Basic
  "00100": "#000000", // Nero
  "00200": "#C12E1F", // Rosso
  "00201": "#9D2235", // Rosso bordeaux
  "00300": "#FF6A13", // Arancione
  "00400": "#F4EE2A", // Giallo
  "00401": "#E5AA70", // Oro
  "00402": "#FEC600", // Giallo pastello
  "00403": "#CD7F32", // Bronzo
  "00500": "#00AE42", // Verde
  "00600": "#0A2989", // Blu
  "00601": "#00B1B7", // Turchese
  "00700": "#8B00FF", // Viola
  "00800": "#FFAFD7", // Rosa
  "00900": "#4F3422", // Marrone cacao
  "01000": "#FFFFFF", // Bianco
  "01001": "#F0F8FF", // Bianco giada
  
  // Bambu Lab PLA Matte
  "01800": "#FFAFD7", // Rosa sakura
  "01100": "#030712", // Nero carbone
  
  // Bambu Lab PLA Silk
  "02100": "#000000", // Nero
  "02101": "#1F2937", // Nero titanio
  "02200": "#C12E1F", // Rosso
  "02300": "#FF6A13", // Arancione
  "02400": "#FFD700", // Oro
  "02401": "#E5AA70", // Oro rosa
  "02500": "#00AE42", // Verde
  "02600": "#0A2989", // Blu
  "02700": "#8B00FF", // Viola
  "02701": "#C8A2C8", // Lavanda
  "02800": "#FFAFD7", // Rosa
  "02900": "#B87333", // Rame
  "02901": "#8B4513", // Bronzo
  "03000": "#FFFFFF", // Bianco
  "03001": "#A6A9AA", // Argento
  
  // Bambu Lab PLA-CF
  "Burgundy Red": "#951e23",
  "Iris Purple": "#69398E",
  "Matcha Green": "#5c9748",
  "Jeans Blue": "#6e88bc",
  "Royal Blue": "#2842AD",
  "Lava Gray": "#4d5054",
  
  // Bambu Lab PLA Wood
  "13106": "#C4A77D", // White Oak
  "13204": "#8B4513", // Rosewood
  "13505": "#DEB887", // Classic Birch
  "13801": "#A0522D", // Clay Brown
  "13403": "#CC7722", // Ochre Yellow
  "Noce nero": "#4F3F24",
  "Black Walnut": "#4F3F24",
  
  // Bambu Lab PETG-CF
  "31100": "#000000",
  "Brick Red": "#9f332a",
  "Violet Purple": "#583061",
  "Indigo Blue": "#324585",
  "Malachite Green": "#16b08e",
  "Titan Gray": "#565656",
  
  // Bambu Lab PETG Translucent
  "32100": "#8E8E8E", // Grigio traslucido
  "32101": "#E8E8E8", // Trasparente
  "32200": "#F9C1BD", // Rosa traslucido
  "32300": "#FF911A", // Arancione traslucido
  "32501": "#77EDD7", // Teal traslucido
  "32700": "#D6ABFF", // Viola traslucido
  
  // Bambu Lab PETG HF
  "33100": "#FFFFFF", // Bianco
  "33101": "#ADB1B2", // Grigio
  "33102": "#000000", // Nero
  "33103": "#515151", // Dark Gray
  "33200": "#EB3A3A", // Rosso
  "33300": "#F75403", // Arancione
  "33400": "#FFD00B", // Giallo
  "33401": "#F9DFB9", // Crema
  "33500": "#00AE42", // Verde (Bambu Green)
  "33501": "#6EE53C", // Lime Green
  "33502": "#39541A", // Forest Green
  "33600": "#002E96", // Blu
  "33601": "#1F79E5", // Lake Blue
  "33801": "#875718", // Peanut Brown
  
  // Bambu Lab ASA-CF
  "46100": "#F5F1DD", // Aero White
  "46101": "#000000", // Nero
  
  // Bambu Lab Support
  "65102": "#E8DCC8", // Naturale
  "65500": "#4CAF50", // Green
  "66100": "#FFFFFF", // White
  "66400": "#E0E0E0", // PVA
  "Naturale": "#E8DCC8",
  
  // Bambu Lab PA6-CF, PET-CF
  "72100": "#000000",
  "71100": "#000000"
};

// =============================================
// HELPER FUNZIONI FORMATTAZIONE
// =============================================

/**
 * Formatta un numero con separatore migliaia
 * @param {number} num - Numero da formattare
 * @param {number} decimals - Decimali da mostrare
 * @returns {string} - Numero formattato
 */
export function formatNumber(num, decimals = 0) {
  if (isNaN(num)) return "0";
  return num.toLocaleString("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Ottiene codice HEX da nome colore
 * @param {string} colorName - Nome colore
 * @returns {string} - Codice hex
 */
export function getColorHex(colorName) {
  if (!colorName) return "#e5e7eb";
  
  // Match diretto
  const direct = COLOR_HEX_MAP[colorName];
  if (direct) return direct;
  
  // Estrai codice Bambu (es. "Nero (33102)" -> "33102")
  const codeMatch = colorName.match(/\((\d{5})\)/);
  if (codeMatch) {
    const bambuCode = codeMatch[1];
    if (COLOR_HEX_MAP[bambuCode]) return COLOR_HEX_MAP[bambuCode];
  }
  
  // Cerca codice numerico
  const numMatch = colorName.match(/\b(\d{5})\b/);
  if (numMatch) {
    const code = numMatch[1];
    if (COLOR_HEX_MAP[code]) return COLOR_HEX_MAP[code];
  }
  
  const lower = colorName.toLowerCase();
  
  // Match keywords
  if (lower.includes("nero") || lower.includes("black")) return COLOR_HEX_MAP["Nero"];
  if (lower.includes("bianco") || lower.includes("white")) return COLOR_HEX_MAP["Bianco"];
  if (lower.includes("grigio") || lower.includes("grey") || lower.includes("gray")) return COLOR_HEX_MAP["Grigio"];
  if (lower.includes("rosso") || lower.includes("red")) return COLOR_HEX_MAP["Rosso"];
  if (lower.includes("arancione") || lower.includes("orange")) return COLOR_HEX_MAP["Arancione"];
  if (lower.includes("giallo") || lower.includes("yellow") || lower.includes("oro") || lower.includes("gold")) {
    if (lower.includes("oro") || lower.includes("gold")) return COLOR_HEX_MAP["Oro"];
    return COLOR_HEX_MAP["Giallo"];
  }
  if (lower.includes("bambu green")) return "#00AE42";
  if (lower.includes("verde") || lower.includes("green")) return COLOR_HEX_MAP["Verde"];
  if (lower.includes("blu") || lower.includes("blue")) return COLOR_HEX_MAP["Blu"];
  if (lower.includes("viola") || lower.includes("purple")) return COLOR_HEX_MAP["Viola"];
  if (lower.includes("rosa") || lower.includes("pink")) return COLOR_HEX_MAP["Rosa"];
  if (lower.includes("marrone") || lower.includes("brown") || lower.includes("noce") || lower.includes("walnut")) return COLOR_HEX_MAP["Marrone"];
  if (lower.includes("trasparente") || lower.includes("transparent") || lower.includes("traslucido") || lower.includes("translucent")) return COLOR_HEX_MAP["Trasparente"];
  
  return "#e5e7eb";
}

/**
 * Determina se un colore è scuro (per contrasto testo)
 * @param {string} hexColor - Codice hex
 * @returns {boolean}
 */
export function isColorDark(hexColor) {
  if (!hexColor || hexColor === "#e5e7eb") return false;
  
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.35;
}

/**
 * Genera HTML per pill colorato
 * @param {string} colorName - Nome colore
 * @returns {string} - HTML pill
 */
export function getColoredPillHtml(colorName) {
  const hex = getColorHex(colorName);
  const displayName = colorName || "N/D";
  const displayNameLower = displayName.toLowerCase();
  
  // Forza testo nero per bianchi
  const whiteKeywords = ["bianco giada", "bianco", "jade white", "white"];
  const isWhiteColor = whiteKeywords.some(w => displayNameLower.includes(w));
  const isHexWhite = hex && (
    hex.toUpperCase() === "#FFFFFF" || 
    hex.toUpperCase() === "#FFF" ||
    hex.toUpperCase() === "#FEFEFE"
  );
  
  // Check luminosità
  let isVeryLight = false;
  if (hex && !isHexWhite) {
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.substr(0, 2), 16);
    const g = parseInt(hexClean.substr(2, 2), 16);
    const b = parseInt(hexClean.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    isVeryLight = luminance > 0.9;
  }
  
  let textClass;
  if (isWhiteColor || isHexWhite || isVeryLight) {
    textClass = "dark-text";
  } else {
    const isDark = isColorDark(hex);
    textClass = isDark ? "light-text" : "dark-text";
  }
  
  return `<span class="pill-colored ${textClass}" style="background: ${hex};" title="${displayName}">${displayName}</span>`;
}

// =============================================
// RENDERING TABELLE
// =============================================

/**
 * Rendering tabella magazzino disponibile
 * @param {Object} state - Stato applicazione
 * @param {Object} filters - Filtri attivi
 * @param {string} searchTerm - Termine ricerca
 * @param {Object} sortState - Stato ordinamento
 */
export function renderFilamentTable(state, filters, searchTerm, sortState) {
  const tbody = document.getElementById("filamentTableBody");
  if (!tbody) {
    console.error("filamentTableBody non trovato!");
    return;
  }

  tbody.innerHTML = "";

  let filtered = state.filaments.slice();
  
  // Applica filtri dropdown
  if (filters.brand) {
    filtered = filtered.filter(f => f.brand === filters.brand);
  }
  if (filters.material) {
    filtered = filtered.filter(f => f.material === filters.material);
  }
  if (filters.packaging) {
    filtered = filtered.filter(f => f.packaging_type === filters.packaging);
  }
  
  // Applica ricerca testuale
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter((f) => {
      const hay =
        (f.brand || "") + " " +
        (f.material || "") + " " +
        (f.variant || "") + " " +
        (f.color_code || "") + " " +
        (f.packaging_type || "") + " " +
        (f.supplier || "") + " " +
        (f.location || "") + " " +
        (f.notes || "");
      return hay.toLowerCase().includes(term);
    });
  }

  // Aggiorna indicatori ordinamento
  const ths = document.querySelectorAll(
    "#filamentTable thead th[data-sort-field]"
  );
  ths.forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    const field = th.getAttribute("data-sort-field");
    if (field === sortState.field) {
      th.classList.add(
        sortState.direction === "asc" ? "sorted-asc" : "sorted-desc"
      );
    }
  });

  // Empty state
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 18;
    const hasFilters = filters.brand || filters.material || filters.packaging || (searchTerm && searchTerm.trim());
    td.innerHTML = hasFilters
      ? '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><path d="M3 4h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-state-title">Nessun risultato con i filtri attuali.</div><div class="empty-state-text">Prova a modificare o resettare i filtri.</div></div>'
      : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 9h8M8 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6 5V4h12v1" stroke="currentColor" stroke-width="1.4"/></svg><div class="empty-state-title">Il magazzino è vuoto.</div><div class="empty-state-text">Aggiungi il primo filamento oppure importa un JSON esportato in precedenza.</div></div>';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Prepara righe per ordinamento (con raggruppamento posizione/colore)
  const rowsToSort = [];

  filtered.forEach((f) => {
    // Raggruppa per posizione E colore
    const locationsColorsMap = new Map();
    const totalSpools = (f.sealed_spools || 0) + (f.open_spools || 0);
    
    // Logica raggruppamento (identica all'originale)
    if (f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.length > 0) {
      f.spools_locations.forEach((location, index) => {
        const loc = location && location.trim() !== "" ? location : "";
        const spoolColor = (f.spools_variants && Array.isArray(f.spools_variants) && f.spools_variants[index] && f.spools_variants[index].trim() !== "")
          ? f.spools_variants[index]
          : f.variant;
        
        const key = `${loc}|${spoolColor}`;
        if (!locationsColorsMap.has(key)) {
          locationsColorsMap.set(key, {
            location: loc,
            color: spoolColor,
            count: 0,
            sealed: 0,
            open: 0,
            openFractions: []
          });
        }
        const group = locationsColorsMap.get(key);
        group.count++;
        if (index < (f.sealed_spools || 0)) {
          group.sealed++;
        } else {
          group.open++;
          const openIndex = index - (f.sealed_spools || 0);
          if (f.open_spools_fractions && Array.isArray(f.open_spools_fractions) && openIndex < f.open_spools_fractions.length) {
            group.openFractions.push(f.open_spools_fractions[openIndex]);
          } else {
            group.openFractions.push(1);
          }
        }
      });
    } else if (f.location && f.location.trim() !== "") {
      const defaultLocation = f.location;
      if (f.spools_variants && Array.isArray(f.spools_variants) && f.spools_variants.length > 0) {
        f.spools_variants.forEach((spoolColor, index) => {
          const color = spoolColor && spoolColor.trim() !== "" ? spoolColor : f.variant;
          const key = `${defaultLocation}|${color}`;
          if (!locationsColorsMap.has(key)) {
            locationsColorsMap.set(key, {
              location: defaultLocation,
              color: color,
              count: 0,
              sealed: 0,
              open: 0,
              openFractions: []
            });
          }
          const group = locationsColorsMap.get(key);
          group.count++;
          if (index < (f.sealed_spools || 0)) {
            group.sealed++;
          } else {
            group.open++;
            const openIndex = index - (f.sealed_spools || 0);
            if (f.open_spools_fractions && Array.isArray(f.open_spools_fractions) && openIndex < f.open_spools_fractions.length) {
              group.openFractions.push(f.open_spools_fractions[openIndex]);
            } else {
              group.openFractions.push(1);
            }
          }
        });
      } else {
        locationsColorsMap.set(`${defaultLocation}|${f.variant}`, {
          location: defaultLocation,
          color: f.variant,
          count: totalSpools,
          sealed: f.sealed_spools || 0,
          open: f.open_spools || 0,
          openFractions: f.open_spools_fractions || []
        });
      }
    } else {
      // Nessuna posizione
      if (f.spools_variants && Array.isArray(f.spools_variants) && f.spools_variants.length > 0) {
        f.spools_variants.forEach((spoolColor, index) => {
          const color = spoolColor && spoolColor.trim() !== "" ? spoolColor : f.variant;
          const key = `|${color}`;
          if (!locationsColorsMap.has(key)) {
            locationsColorsMap.set(key, {
              location: "",
              color: color,
              count: 0,
              sealed: 0,
              open: 0,
              openFractions: []
            });
          }
          const group = locationsColorsMap.get(key);
          group.count++;
          if (index < (f.sealed_spools || 0)) {
            group.sealed++;
          } else {
            group.open++;
            const openIndex = index - (f.sealed_spools || 0);
            if (f.open_spools_fractions && Array.isArray(f.open_spools_fractions) && openIndex < f.open_spools_fractions.length) {
              group.openFractions.push(f.open_spools_fractions[openIndex]);
            } else {
              group.openFractions.push(1);
            }
          }
        });
      } else {
        locationsColorsMap.set(`|${f.variant}`, {
          location: "",
          color: f.variant,
          count: totalSpools,
          sealed: f.sealed_spools || 0,
          open: f.open_spools || 0,
          openFractions: f.open_spools_fractions || []
        });
      }
    }
    
    // Per ogni gruppo, calcola pesi e crea riga
    locationsColorsMap.forEach((group) => {
      let groupRemainingWeight = 0;
      groupRemainingWeight += group.sealed * (f.unit_weight_g || 0);
      group.openFractions.forEach(frac => {
        groupRemainingWeight += frac * (f.unit_weight_g || 0);
      });
      
      const groupTotalWeight = group.count * (f.unit_weight_g || 0);
      const ratio = groupTotalWeight > 0 ? groupRemainingWeight / groupTotalWeight : 0;
      const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      
      rowsToSort.push({
        filament: f,
        group: group,
        groupRemainingWeight: groupRemainingWeight,
        groupTotalWeight: groupTotalWeight,
        ratio: ratio,
        percentage: percentage
      });
    });
  });
  
  // Ordina righe
  if (sortState.field) {
    const field = sortState.field;
    const dir = sortState.direction === "asc" ? 1 : -1;
    
    rowsToSort.sort((a, b) => {
      if (field === "remaining_weight_g") {
        return (a.ratio - b.ratio) * dir;
      }
      
      const va = a.filament[field];
      const vb = b.filament[field];
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va || "").localeCompare(String(vb || ""), "it", {
        sensitivity: "base"
      }) * dir;
    });
  }
  
  // Rendering righe HTML
  rowsToSort.forEach(({ filament: f, group, groupRemainingWeight, groupTotalWeight, ratio, percentage }) => {
    const tr = document.createElement("tr");
    if (isLowStock(f)) {
      tr.classList.add("low-stock-row");
    }

    const pillHtml = getColoredPillHtml(group.color);
    const packagingLabel = f.packaging_type === "refill" ? "Ricarica" : "Bobina";
    const priceDisplay = f.unit_price != null ? "€" + formatNumber(f.unit_price, 2) : "-";
      
    // Colore barra
    let barColor = "#22c55e";
    if (ratio <= 0.25) barColor = "#ef4444";
    else if (ratio <= 0.5) barColor = "#f59e0b";
      
    const barHtml = `
      <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
        <div style="flex: 1; background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 10px; position: relative;">
          <div style="width: ${percentage}%; height: 100%; background: ${barColor}; transition: width 0.3s ease; border-radius: 999px;"></div>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; min-width: 35px; text-align: right;">${percentage}%</span>
      </div>
    `;

    tr.innerHTML = `
      <td class="select-column"><input type="checkbox" class="filament-select-checkbox" data-id="${f.id}"></td>
      <td>${canonicalizeBrand(f.brand) || "-"}</td>
      <td>${f.material || "-"}</td>
      <td>${pillHtml}</td>
      <td>${f.color_code || "-"}</td>
      <td>${packagingLabel}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.count}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.sealed}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.open}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(f.unit_weight_g || 0)}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(groupTotalWeight)}</td>
      <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(groupRemainingWeight)}</td>
      <td style="padding: 0.35rem 0.5rem; vertical-align: middle;">${barHtml}</td>
      <td style="white-space: nowrap; padding: 0.35rem 0.25rem; text-align: center;">${priceDisplay}</td>
      <td style="padding: 0.35rem 0.25rem;">${group.location || "-"}</td>
      <td style="white-space: nowrap;">
        <button type="button" class="btn-action btn-success" data-id="${f.id}" title="Modifica filamento">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M16.474 5.408l2.118 2.118M18 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>Modifica</span>
        </button>
        <button type="button" class="btn-action btn-success" data-id="${f.id}" title="Elimina filamento" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger);">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M6.5 7.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M9 7.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M9.5 11v5M14.5 11v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="7.5" y="7.5" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          <span>Elimina</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Inizializza ridimensionamento colonne
  initResizableColumns();
}

/**
 * Rendering tabella comprati
 * @param {Object} state - Stato applicazione
 * @param {Object} filters - Filtri attivi
 * @param {Object} sortState - Stato ordinamento
 */
export function renderPurchasedTable(state, filters, sortState) {
  const tbody = document.getElementById("purchasedTableBody");
  if (!tbody) {
    console.error("purchasedTableBody non trovato!");
    return;
  }

  tbody.innerHTML = "";

  if (!state.purchasedFilaments || state.purchasedFilaments.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.textContent = "In attesa dei dati delle fatture. Importa un JSON di fatture per vedere qui i filamenti comprati.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Applica filtri
  let filtered = state.purchasedFilaments.slice();
  if (filters.brand) {
    filtered = filtered.filter(f => f.brand === filters.brand);
  }
  if (filters.material) {
    filtered = filtered.filter(f => f.material === filters.material);
  }
  if (filters.packaging) {
    filtered = filtered.filter(f => f.packaging_type === filters.packaging);
  }

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);"><svg viewBox="0 0 24 24" fill="none" style="width:32px;height:32px;margin:0 auto 0.5rem;display:block;opacity:0.5;"><path d="M3 4h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Nessun risultato con i filtri attuali.<br><small>Prova a modificare o resettare i filtri.</small></div>';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Ordinamento
  let sorted = filtered.slice();
  if (sortState.field) {
    const field = sortState.field;
    const dir = sortState.direction === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let va = a[field];
      let vb = b[field];
      if (field === "quantity_spools") {
        va = a.quantity_spools != null ? a.quantity_spools : a.quantitySpools;
        vb = b.quantity_spools != null ? b.quantity_spools : b.quantitySpools;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va || "").localeCompare(String(vb || ""), "it", {
        sensitivity: "base"
      }) * dir;
    });
  }

  // Aggiorna indicatori ordinamento
  const ths = document.querySelectorAll("#purchasedTable thead th[data-sort-field]");
  ths.forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    const field = th.getAttribute("data-sort-field");
    if (field === sortState.field) {
      th.classList.add(sortState.direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });

  // Rendering righe
  sorted.forEach((p, index) => {
    const tr = document.createElement("tr");
    const qty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools != null ? p.quantitySpools : 1);
    const rowId = p.id || `purchased-row-${index}`;
    const packagingLabel = p.packaging_type === "refill" ? "Ricarica" : (p.packaging_type === "spool" ? "Bobina" : "-");
    const priceDisplay = p.unit_price != null ? "€" + formatNumber(p.unit_price, 2) : "-";

    // Multi-color detection
    const variantLower = (p.variant || "").toLowerCase();
    const isMultiColor = variantLower.includes("pack") || 
                         variantLower.includes("pallet") || 
                         variantLower.includes("misti") ||
                         variantLower.includes("colori") ||
                         qty >= 10;

    let pillHtml;
    if (isMultiColor) {
      pillHtml = `<span class="pill-colored light-text" style="background: linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6);" title="${p.variant || "Multi-colore"}">${p.variant || "Multi-colore"}</span>`;
      tr.style.background = "linear-gradient(90deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08), rgba(34,197,94,0.08), rgba(59,130,246,0.08), rgba(139,92,246,0.08))";
    } else {
      pillHtml = getColoredPillHtml(p.variant);
      const colorHex = getColorHex(p.variant);
      if (colorHex && colorHex !== "#9ca3af" && colorHex !== "#e5e7eb") {
        tr.style.background = `linear-gradient(90deg, ${colorHex}15, ${colorHex}08, transparent)`;
      }
    }

    tr.innerHTML = `
      <td>${p.order_date || "-"}</td>
      <td>${canonicalizeBrand(p.brand) || "-"}</td>
      <td>${p.material || "-"}</td>
      <td>${pillHtml}</td>
      <td>${p.color_code || "-"}</td>
      <td>${packagingLabel}</td>
      <td>${qty}</td>
      <td>${priceDisplay}</td>
      <td style="white-space: nowrap;">
        <button type="button" class="btn-action btn-success" data-purchased-id="${rowId}" title="Aggiungi al magazzino">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>Aggiungi</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =============================================
// DASHBOARD E STATISTICHE
// =============================================

/**
 * Rendering dashboard statistiche principali
 * @param {Object} state - Stato applicazione
 */
export function renderDashboard(state) {
  const totalSpoolsEl = document.getElementById("totalSpoolsValue");
  const totalRemEl = document.getElementById("totalRemainingGramsValue");
  const totalUsedEl = document.getElementById("totalUsedGramsValue");
  const lowStockEl = document.getElementById("lowStockCountValue");

  let totalSpools = 0;
  let totalWeight = 0;
  let totalRemaining = 0;
  let lowCount = 0;

  state.filaments.forEach((f) => {
    totalSpools += f.spools_total || 0;
    totalWeight += f.total_weight_g || 0;
    totalRemaining += f.remaining_weight_g || 0;
    if (isLowStock(f)) lowCount++;
  });

  const used = Math.max(0, totalWeight - totalRemaining);

  if (totalSpoolsEl) totalSpoolsEl.textContent = formatNumber(totalSpools);
  if (totalRemEl) totalRemEl.textContent = formatNumber(totalRemaining, 0) + " g";
  if (totalUsedEl) totalUsedEl.textContent = formatNumber(used, 0) + " g";
  if (lowStockEl) lowStockEl.textContent = formatNumber(lowCount);
}

/**
 * Rendering riepilogo scorte (nuove/aperte/extra)
 * @param {Object} state - Stato applicazione
 */
export function renderStockSummary(state) {
  const newEl = document.getElementById("stockNewSpoolsCount");
  const openEl = document.getElementById("stockOpenSpoolsCount");
  const extraEl = document.getElementById("stockExtraSpoolsCount");
  const gramsEl = document.getElementById("stockRemainingGramsTotal");

  let newCount = 0;
  let openCount = 0;
  let extraCount = 0;
  let rem = 0;

  state.filaments.forEach((f) => {
    newCount += f.sealed_spools || 0;
    openCount += f.open_spools || 0;
    rem += f.remaining_weight_g || 0;
    
    if (f.packaging_type === "refill" && (f.open_spools || 0) > 0) {
      extraCount += f.open_spools || 0;
    }
  });

  if (newEl) newEl.textContent = formatNumber(newCount);
  if (openEl) openEl.textContent = formatNumber(openCount);
  if (extraEl) extraEl.textContent = formatNumber(extraCount);
  if (gramsEl) gramsEl.textContent = formatNumber(rem, 0) + " g";
}

/**
 * Rendering barre materiale per gruppo
 * @param {Object} state - Stato applicazione
 * @param {string[]} groupKeywords - Keywords gruppo (es. ["pla"])
 * @param {string} containerId - ID contenitore DOM
 */
export function renderBarsForGroup(state, groupKeywords, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const items = state.filaments.filter((f) =>
    groupKeywords.some((kw) =>
      (f.material || "").toLowerCase().includes(kw.toLowerCase())
    )
  );

  if (items.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 3"/><path d="M9 12.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><div class="empty-state-title">Nessun filamento di questo tipo.</div><div class="empty-state-text">Quando aggiungi PLA / PETG lo vedrai qui con una barra di residuo.</div></div>';
    return;
  }

  items.forEach((f) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const ratio = f.total_weight_g > 0 ? f.remaining_weight_g / f.total_weight_g : 0;
    if (ratio <= 0.25) row.classList.add("low-stock");
    else if (ratio <= 0.5) row.classList.add("medium-stock");
    else row.classList.add("high-stock");

    const stockSpools = f.sealed_spools + f.open_spools;
    const lastOpen = stockSpools === 1 && f.open_spools === 1 && f.main_fraction < 1;
    if (lastOpen) row.classList.add("last-spool");

    const colorHex = getColorHex(f.variant);
    const isDark = isColorDark(colorHex);
    const textClass = isDark ? "light-text" : "dark-text";
    
    const titleBrand = canonicalizeBrand(f.brand || "");
    const titleMaterial = f.material || "";
    const titleVariant = f.variant || "";
    const detail =
      "Rotoli: " +
      stockSpools +
      " | Residuo: " +
      formatNumber(f.remaining_weight_g || 0, 0) +
      " g";

    const header = document.createElement("div");
    header.className = "bar-row-header";
    const materialText = titleMaterial ? `${titleMaterial} – ` : "";
    header.innerHTML = `<span>${titleBrand} – ${materialText}<span class="pill-colored ${textClass}" style="background:${colorHex};padding:0.15rem 0.5rem;font-size:0.8rem;">${titleVariant}</span></span><span>${detail}</span>`;
    row.appendChild(header);

    const barOuter = document.createElement("div");
    barOuter.className = "bar-outer";

    const barInner = document.createElement("div");
    barInner.className = "bar-inner";

    const pct = f.total_weight_g > 0
      ? Math.max(5, Math.min(100, (f.remaining_weight_g / f.total_weight_g) * 100))
      : 0;

    barInner.style.width = pct + "%";

    if (ratio <= 0.25) {
      barInner.style.background = "linear-gradient(90deg,#f97373,#b91c1c)";
    } else if (ratio <= 0.5) {
      barInner.style.background = "linear-gradient(90deg,#fbbf24,#b45309)";
    } else {
      barInner.style.background = "linear-gradient(90deg,#22c55e,#15803d)";
    }

    barOuter.appendChild(barInner);
    row.appendChild(barOuter);
    container.appendChild(row);
  });
}

/**
 * Rendering barre PLA e PETG
 * @param {Object} state - Stato applicazione
 */
export function renderBars(state) {
  renderBarsForGroup(state, ["pla"], "barsPlaContainer");
  renderBarsForGroup(state, ["petg"], "barsPetgContainer");
}

// =============================================
// HELPER INTERATTIVITÀ TABELLE
// =============================================

/**
 * Inizializza ridimensionamento colonne tabella
 */
export function initResizableColumns() {
  const table = document.getElementById("filamentTable");
  if (!table) return;
  
  // Rimuovi handler precedenti
  const existingHandles = table.querySelectorAll(".resize-handle");
  existingHandles.forEach(h => h.remove());
  
  const headers = table.querySelectorAll("th.resizable");
  headers.forEach((header) => {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";
    resizeHandle.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      cursor: col-resize;
      background: transparent;
      z-index: 10;
    `;
    
    if (header.style.position !== "relative") {
      header.style.position = "relative";
    }
    header.appendChild(resizeHandle);
    
    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.pageX;
      startWidth = header.offsetWidth;
      header.classList.add("resizing");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
      e.stopPropagation();
    });
    
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const diff = e.pageX - startX;
      const minWidth = header.style.minWidth ? parseInt(header.style.minWidth) : 45;
      const newWidth = Math.max(minWidth, startWidth + diff);
      header.style.width = newWidth + "px";
      
      // Aggiorna celle colonna
      const colIndex = Array.from(header.parentElement.children).indexOf(header);
      const rows = table.querySelectorAll("tbody tr");
      rows.forEach(row => {
        const cell = row.children[colIndex];
        if (cell) cell.style.width = newWidth + "px";
      });
    };
    
    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        header.classList.remove("resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
}

// =============================================
// DROPDOWN E OPZIONI
// =============================================

/**
 * Genera opzioni location per select
 * @param {string[]} locationList - Array posizioni
 * @param {string} selectedValue - Valore selezionato
 * @returns {string} - HTML opzioni
 */
export function generateLocationOptions(locationList, selectedValue = "") {
  return locationList
    .map((loc) => {
      const selected = loc === selectedValue ? " selected" : "";
      return `<option value="${loc}"${selected}>${loc}</option>`;
    })
    .join("");
}

/**
 * Rendering lista posizioni
 * @param {string[]} locationList - Array posizioni
 */
export function renderLocationsList(locationList) {
  const container = document.getElementById("locationsListContainer");
  if (!container) return;

  container.innerHTML = "";

  if (locationList.length === 0) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Nessuna posizione configurata</div>';
    return;
  }

  locationList.forEach((location, index) => {
    const item = document.createElement("div");
    item.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--surface-soft); border-radius: 0.5rem; margin-bottom: 0.5rem;";
    
    const input = document.createElement("input");
    input.type = "text";
    input.value = location;
    input.style.cssText = "flex: 1; padding: 0.4rem; border-radius: 0.375rem; border: 1px solid var(--border-subtle); background: var(--surface); color: var(--text-main);";
    input.dataset.locationIndex = index;
    
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn-secondary btn-xs";
    renameBtn.dataset.locationRename = index;
    renameBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Rinomina</span>
    `;
    
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger btn-xs";
    deleteBtn.dataset.locationDelete = index;
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>Elimina</span>
    `;
    
    item.appendChild(input);
    item.appendChild(renameBtn);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  });
}

/**
 * Rendering opzioni brand per dropdown
 * @param {string[]} brandList - Array brand
 */
export function renderBrandOptions(brandList) {
  // Popola dropdown modifica filamento
  const editSelect = document.getElementById("editFilamentBrand");
  if (editSelect) {
    const currentValue = editSelect.value;
    const brandsClean = brandList.slice().sort((a, b) => a.localeCompare(b, "it"));

    editSelect.innerHTML = '<option value="">-- Altro (scrivi sotto) --</option>';
    brandsClean.forEach((brand) => {
      const option = document.createElement("option");
      option.value = brand;
      option.textContent = brand;
      if (brand === currentValue) option.selected = true;
      editSelect.appendChild(option);
    });
  }
  
  // Popola dropdown aggiungi filamento
  const addSelect = document.getElementById("addBrandSelect");
  if (addSelect) {
    const currentValue = addSelect.value;
    const brandsClean = brandList.slice().sort((a, b) => a.localeCompare(b, "it"));
    
    // Separa brand Bambu Lab dagli altri
    const bambuBrands = [];
    const otherBrands = [];
    
    brandsClean.forEach((b) => {
      const canon = b.toLowerCase();
      if (canon.startsWith("bambu")) {
        if (!bambuBrands.includes(b)) bambuBrands.push(b);
      } else {
        otherBrands.push(b);
      }
    });
    
    addSelect.innerHTML = "";
    
    // Gruppo Bambu Lab
    if (bambuBrands.length > 0) {
      const bambuGroup = document.createElement("optgroup");
      bambuGroup.label = "Bambu Lab";
      bambuBrands.forEach((brand) => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        if (brand === currentValue) option.selected = true;
        bambuGroup.appendChild(option);
      });
      addSelect.appendChild(bambuGroup);
    }
    
    // Altri brand
    if (otherBrands.length > 0) {
      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Altri Brand";
      otherBrands.forEach((brand) => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        if (brand === currentValue) option.selected = true;
        otherGroup.appendChild(option);
      });
      addSelect.appendChild(otherGroup);
    }
    
    // Opzione custom
    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "➕ Aggiungi nuovo brand...";
    addSelect.appendChild(customOption);
  }
}

/**
 * Rendering opzioni materiali per dropdown
 * @param {string[]} materialList - Array materiali
 * @param {string[]} defaultMaterialsOrdered - Materiali default ordinati
 */
export function renderMaterialOptions(materialList, defaultMaterialsOrdered) {
  // Popola dropdown modifica filamento
  const editSelect = document.getElementById("editFilamentMaterial");
  if (editSelect) {
    const currentValue = editSelect.value;

    // Materiali principali in ordine
    const main = defaultMaterialsOrdered.filter((m) =>
      ["PLA", "PETG", "PLA+", "PETG HF", "ASA", "ABS", "TPU"].includes(m)
    );
    const rest = materialList.filter((m) => !main.includes(m));

    editSelect.innerHTML = "";

    // Gruppo materiali comuni
    const commonGroup = document.createElement("optgroup");
    commonGroup.label = "Materiali Comuni";
    main.forEach((m) => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = m;
      if (m === currentValue) option.selected = true;
      commonGroup.appendChild(option);
    });
    editSelect.appendChild(commonGroup);

    // Altri materiali
    if (rest.length > 0) {
      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Altri Materiali";
      rest
        .slice()
        .sort((a, b) => a.localeCompare(b, "it"))
        .forEach((m) => {
          const option = document.createElement("option");
          option.value = m;
          option.textContent = m;
          if (m === currentValue) option.selected = true;
          otherGroup.appendChild(option);
        });
      editSelect.appendChild(otherGroup);
    }

    // Opzione custom
    const customOption = document.createElement("option");
    customOption.value = "";
    customOption.textContent = "-- Altro (scrivi sotto) --";
    editSelect.appendChild(customOption);
  }
  
  // Popola dropdown aggiungi filamento
  const addSelect = document.getElementById("addMaterialSelect");
  if (addSelect) {
    const currentValue = addSelect.value;

    // Materiali principali in ordine
    const main = defaultMaterialsOrdered.filter((m) =>
      ["PLA", "PETG", "PLA+", "PETG HF", "ASA", "ABS", "TPU"].includes(m)
    );
    const rest = materialList.filter((m) => !main.includes(m));

    addSelect.innerHTML = "";

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleziona materiale";
    addSelect.appendChild(placeholder);

    // Gruppo materiali comuni
    const commonGroup = document.createElement("optgroup");
    commonGroup.label = "Materiali Comuni";
    main.forEach((m) => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = m;
      if (m === currentValue) option.selected = true;
      commonGroup.appendChild(option);
    });
    addSelect.appendChild(commonGroup);

    // Altri materiali
    if (rest.length > 0) {
      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Altri Materiali";
      rest
        .slice()
        .sort((a, b) => a.localeCompare(b, "it"))
        .forEach((m) => {
          const option = document.createElement("option");
          option.value = m;
          option.textContent = m;
          if (m === currentValue) option.selected = true;
          otherGroup.appendChild(option);
        });
      addSelect.appendChild(otherGroup);
    }

    // Opzione custom
    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "➕ Aggiungi nuovo materiale...";
    addSelect.appendChild(customOption);
  }
}

/**
 * Rendering opzioni colori per dropdown
 * @param {string} brandHint - Suggerimento brand per colori specifici
 */
export function renderColorOptions(brandHint = "") {
  const select = document.getElementById("editFilamentVariant");
  if (!select) return;

  const currentValue = select.value;
  let colorOptions = [...DEFAULT_COLORS];

  // Colori specifici Bambu Lab
  if (brandHint && brandHint.toLowerCase().includes("bambu")) {
    const bambuColors = [
      "Nero (33102)",
      "Bianco (33100)",
      "Grigio (33101)",
      "Rosso (33200)",
      "Arancione (33300)",
      "Giallo (33400)",
      "Verde (33500) - Bambu Green",
      "Blu (33600)",
      "Rosa sakura (01800)",
      "Nero carbone (01100)",
      "Viola traslucido (32700)",
      "Trasparente (32101)"
    ];
    colorOptions = [...bambuColors, ...DEFAULT_COLORS];
  }

  select.innerHTML = "";
  colorOptions.forEach((color) => {
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    if (color === currentValue) option.selected = true;
    select.appendChild(option);
  });

  // Opzione custom
  const customOption = document.createElement("option");
  customOption.value = "";
  customOption.textContent = "-- Altro colore --";
  select.appendChild(customOption);
}

/**
 * Crea dropdown custom per colori (con preview)
 * @param {string} containerId - ID contenitore
 * @param {Object} options - Opzioni dropdown
 * @returns {Object|null} - Riferimento wrapper o null
 */
export function createColorDropdown(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const {
    placeholder = "Seleziona colore...",
    allowCustom = true,
    customLabel = "Altro colore...",
    onSelect = () => {},
    initialValue = ""
  } = options;

  const wrapper = document.createElement("div");
  wrapper.className = "color-dropdown-wrapper";
  wrapper.setAttribute("data-dropdown-id", containerId);

  // Trigger button
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "color-dropdown-trigger";
  trigger.innerHTML = `
    <span class="color-dot" style="background: #e5e7eb;"></span>
    <span class="color-text">${placeholder}</span>
    <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  // Menu
  const menu = document.createElement("div");
  menu.className = "color-dropdown-menu";

  // Search
  const searchDiv = document.createElement("div");
  searchDiv.className = "color-dropdown-search";
  searchDiv.innerHTML = `<input type="text" placeholder="Cerca colore..." />`;
  menu.appendChild(searchDiv);

  // Options container
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "color-dropdown-options";

  DEFAULT_COLORS.forEach((color) => {
    const option = document.createElement("div");
    option.className = "color-dropdown-option";
    option.setAttribute("data-value", color);
    const hex = getColorHex(color);
    option.innerHTML = `
      <span class="color-dot" style="background: ${hex};"></span>
      <span class="color-name">${color}</span>
    `;
    optionsContainer.appendChild(option);
  });

  // Opzione custom se permessa
  if (allowCustom) {
    const customOption = document.createElement("div");
    customOption.className = "color-dropdown-option custom-option";
    customOption.setAttribute("data-value", "__custom__");
    customOption.innerHTML = `
      <span class="color-dot" style="background: #e5e7eb; border: 1px dashed #9ca3af;"></span>
      <span class="color-name">${customLabel}</span>
    `;
    optionsContainer.appendChild(customOption);
  }

  menu.appendChild(optionsContainer);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  container.innerHTML = "";
  container.appendChild(wrapper);

  // Setup event listeners
  let isOpen = false;
  const searchInput = searchDiv.querySelector("input");

  // Toggle menu
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    if (isOpen) {
      wrapper.classList.add("open");
      menu.style.display = "block";
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 10);
      }
    } else {
      wrapper.classList.remove("open");
      menu.style.display = "none";
    }
  });

  // Chiudi menu quando si clicca fuori
  const closeHandler = (e) => {
    if (!wrapper.contains(e.target)) {
      isOpen = false;
      wrapper.classList.remove("open");
      menu.style.display = "none";
    }
  };
  document.addEventListener("click", closeHandler);

  // Ricerca colori
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const options = optionsContainer.querySelectorAll(".color-option");
      options.forEach((opt) => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = text.includes(term) ? "flex" : "none";
      });
    });

    searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Selezione opzione
  optionsContainer.querySelectorAll(".color-dropdown-option").forEach((option) => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = option.getAttribute("data-value");
      setColorDropdownValue(wrapper, value === "__custom__" ? "" : value);
      isOpen = false;
      menu.style.display = "none";
      onSelect(value);
    });
  });

  if (initialValue) {
    setColorDropdownValue(wrapper, initialValue);
  }

  // Metodi pubblici per controllare il dropdown
  wrapper.getValue = () => {
    const colorText = wrapper.querySelector(".color-text");
    return colorText ? colorText.textContent : "";
  };

  wrapper.setValue = (value) => {
    setColorDropdownValue(wrapper, value);
  };

  wrapper.refresh = () => {
    // Ricarica le opzioni se necessario
  };

  return wrapper;
}

/**
 * Imposta valore dropdown colore
 * @param {HTMLElement} wrapper - Wrapper dropdown
 * @param {string} value - Valore da impostare
 */
export function setColorDropdownValue(wrapper, value) {
  if (!wrapper) return;

  const colorDot = wrapper.querySelector(".color-dot");
  const colorText = wrapper.querySelector(".color-text");

  if (colorDot && colorText) {
    const hex = getColorHex(value);
    colorDot.style.background = hex;
    colorText.textContent = value || "N/D";
  }
}

// =============================================
// RENDERING COMPLETO
// =============================================

/**
 * Rendering completo di tutta l'UI
 * @param {Object} state - Stato applicazione
 * @param {Object} filters - Filtri attivi
 * @param {string} searchTerm - Termine ricerca
 * @param {Object} sortStates - Stati ordinamento {stock, purchased}
 */
export function renderAll(state, filters, searchTerm, sortStates) {
  renderFilamentTable(state, filters.stock, searchTerm, sortStates.stock);
  renderPurchasedTable(state, filters.purchased, sortStates.purchased);
  renderDashboard(state);
  renderStockSummary(state);
  renderBars(state);
  
  // Popola i dropdown dei filtri
  populateFilterOptions(state);
}

/**
 * Popola i dropdown dei filtri (brand, material) per stock e purchased
 * @param {Object} state - State applicazione con filaments e purchasedFilaments
 */
export function populateFilterOptions(state) {
  const filaments = state.filaments || [];
  const purchasedFilaments = state.purchasedFilaments || [];
  
  // Filtri per magazzino disponibile
  const stockBrandSelect = document.getElementById("stockFilterBrand");
  const stockMaterialSelect = document.getElementById("stockFilterMaterial");
  
  // Filtri per comprati
  const purchasedBrandSelect = document.getElementById("purchasedFilterBrand");
  const purchasedMaterialSelect = document.getElementById("purchasedFilterMaterial");
  
  // Raccogli marche e materiali unici dai filamenti
  const stockBrands = new Set(filaments.map(f => f.brand).filter(Boolean));
  const stockMaterials = new Set(filaments.map(f => f.material).filter(Boolean));
  
  const purchasedBrandsRaw = new Set(purchasedFilaments.map(f => f.brand).filter(Boolean));
  const purchasedMaterialsRaw = new Set(purchasedFilaments.map(f => f.material).filter(Boolean));
  
  // Se non ci sono brand nei purchased, usa quelli dai filaments (potrebbero essere stati trasferiti)
  const purchasedBrands = purchasedBrandsRaw.size > 0 ? purchasedBrandsRaw : stockBrands;
  const purchasedMaterials = purchasedMaterialsRaw.size > 0 ? purchasedMaterialsRaw : stockMaterials;
  
  console.log("🔍 populateFilterOptions:", {
    stockBrands: Array.from(stockBrands).length,
    purchasedBrandsRaw: Array.from(purchasedBrandsRaw).length,
    purchasedBrandsFinal: Array.from(purchasedBrands).length,
    purchasedFilamentsCount: purchasedFilaments.length
  });
  
  // Popola select marche stock
  if (stockBrandSelect) {
    const currentVal = stockBrandSelect.value;
    stockBrandSelect.innerHTML = '<option value="">Tutte le marche</option>';
    Array.from(stockBrands).sort((a, b) => a.localeCompare(b, "it")).forEach(brand => {
      const opt = document.createElement("option");
      opt.value = brand;
      opt.textContent = brand;
      if (brand === currentVal) opt.selected = true;
      stockBrandSelect.appendChild(opt);
    });
  }
  
  // Popola select materiali stock
  if (stockMaterialSelect) {
    const currentVal = stockMaterialSelect.value;
    stockMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>';
    Array.from(stockMaterials).sort((a, b) => a.localeCompare(b, "it")).forEach(material => {
      const opt = document.createElement("option");
      opt.value = material;
      opt.textContent = material;
      if (material === currentVal) opt.selected = true;
      stockMaterialSelect.appendChild(opt);
    });
  }
  
  // Popola select marche purchased
  if (purchasedBrandSelect) {
    const currentVal = purchasedBrandSelect.value;
    purchasedBrandSelect.innerHTML = '<option value="">Tutte le marche</option>';
    Array.from(purchasedBrands).sort((a, b) => a.localeCompare(b, "it")).forEach(brand => {
      const opt = document.createElement("option");
      opt.value = brand;
      opt.textContent = brand;
      if (brand === currentVal) opt.selected = true;
      purchasedBrandSelect.appendChild(opt);
    });
  }
  
  // Popola select materiali purchased
  if (purchasedMaterialSelect) {
    const currentVal = purchasedMaterialSelect.value;
    purchasedMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>';
    Array.from(purchasedMaterials).sort((a, b) => a.localeCompare(b, "it")).forEach(material => {
      const opt = document.createElement("option");
      opt.value = material;
      opt.textContent = material;
      if (material === currentVal) opt.selected = true;
      purchasedMaterialSelect.appendChild(opt);
    });
  }
}

