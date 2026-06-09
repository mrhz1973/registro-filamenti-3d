/**
 * src/main.js
 * Entry point dell'applicazione Registro Filamenti 3D
 * 
 * Questo modulo:
 * - Importa e inizializza tutti i moduli
 * - Gestisce il ciclo di vita dell'applicazione
 * - Coordina stato, rendering ed eventi
 * - Espone API pubbliche necessarie
 */

// =============================================
// IMPORTS
// =============================================

// Core modules
import { AppState } from './state.js';
import { load, save, exportJson, importJson } from './store.js';
import { normalizeAndValidateState } from './validation.js';

// Domain logic
import {
  canonicalizeBrand,
  canonicalizeMaterial,
  isLowStock,
  calculateTotalStats,
  calculateStockSummary,
  applyFilters,
  filterBySearch,
  sortFilaments,
  deduplicateFilamentsByIdentity,
  recalcWeightsForFilament,
  cleanBrandList,
  DEFAULT_BRANDS,
  DEFAULT_MATERIALS_ORDERED
} from './domain/filaments.js';

// UI modules
import {
  formatNumber,
  getColorHex,
  renderAll,
  renderFilamentTable,
  renderPurchasedTable,
  renderDashboard,
  renderStockSummary,
  renderBars,
  renderBrandOptions,
  renderMaterialOptions,
  renderColorOptions,
  renderLocationsList,
  populateFilterOptions,
  createColorDropdown,
  DEFAULT_COLORS
} from './ui/render.js';

import {
  setupAllEvents,
  showToast,
  debounce
} from './ui/events.js';

// =============================================
// COSTANTI APPLICAZIONE
// =============================================

const APP_VERSION = "V.90-Refactored";
const LOCATION_LIST_KEY = "registroFilamentiLocationList";
const LOW_STOCK_THRESHOLD_KEY = "registroFilamentiLowStockThreshold";

// =============================================
// STATO GLOBALE
// =============================================

// Inizializza appState immediatamente per evitare errori
let appState = new AppState();
let locationList = [];
let lowStockThreshold = 0.25;

// Stati UI
let stockFilters = {
  brand: "",
  material: "",
  packaging: "",
  lowStockOnly: false
};

let purchasedFilters = {
  brand: "",
  material: "",
  packaging: ""
};

let currentSearch = "";

let stockSortState = {
  field: null,
  direction: "asc"
};

let purchasedSortState = {
  field: null,
  direction: "asc"
};

// Modal state
let currentEditingFilamentId = null;
let currentConsumptionFilamentId = null;
let currentAddToStockPurchasedId = null;

// =============================================
// INIZIALIZZAZIONE
// =============================================

/**
 * Carica configurazione e preferenze da localStorage
 */
function loadConfiguration() {
  try {
    // Carica lista locations
    const locationsRaw = localStorage.getItem(LOCATION_LIST_KEY);
    if (locationsRaw) {
      locationList = JSON.parse(locationsRaw);
    } else {
      locationList = ["Box Ikea", "Scaffale 1", "Scaffale 2", "Scrivania"];
    }

    // Carica threshold scorte basse
    const thresholdRaw = localStorage.getItem(LOW_STOCK_THRESHOLD_KEY);
    if (thresholdRaw) {
      lowStockThreshold = parseFloat(thresholdRaw);
      if (isNaN(lowStockThreshold)) lowStockThreshold = 0.25;
    }

    console.log("📋 Configurazione caricata:", { locationList, lowStockThreshold });
  } catch (e) {
    console.error("Errore caricamento configurazione:", e);
  }
}

/**
 * Salva configurazione in localStorage
 */
function saveConfiguration() {
  try {
    localStorage.setItem(LOCATION_LIST_KEY, JSON.stringify(locationList));
    localStorage.setItem(LOW_STOCK_THRESHOLD_KEY, lowStockThreshold.toString());
  } catch (e) {
    console.error("Errore salvataggio configurazione:", e);
  }
}

/**
 * Carica stato applicazione da localStorage
 */
function loadState() {
  try {
    const loadResult = load(); // load() restituisce {state, stats, locationList}
    
    if (loadResult && loadResult.state && loadResult.state.filaments && loadResult.state.filaments.length > 0) {
      // Usa lo stato già validato e normalizzato da load()
      const loadedState = loadResult.state;
      
      appState.setState({
        filaments: loadedState.filaments || [],
        purchasedFilaments: loadedState.purchasedFilaments || [],
        brandList: loadedState.brandList || loadedState.brands || [...DEFAULT_BRANDS],
        materialList: loadedState.materialList || loadedState.materials || [...DEFAULT_MATERIALS_ORDERED]
      });

      console.log(`✅ Stato caricato: ${appState.getState().filaments.length} filamenti`);
      return true;
    } else {
      // Inizializzazione vuota - assicurati che lo stato sia inizializzato
      appState.setState({
        filaments: [],
        purchasedFilaments: [],
        brandList: [...DEFAULT_BRANDS],
        materialList: [...DEFAULT_MATERIALS_ORDERED]
      });
      console.log("📦 Stato inizializzato vuoto");
      return true;
    }
  } catch (e) {
    console.error("❌ Errore caricamento stato:", e);
    // Assicurati che lo stato sia sempre inizializzato anche in caso di errore
    appState.setState({
      filaments: [],
      purchasedFilaments: [],
      brandList: [...DEFAULT_BRANDS],
      materialList: [...DEFAULT_MATERIALS_ORDERED]
    });
    return false;
  }
}

/**
 * Salva stato applicazione
 */
function saveState() {
  try {
    const state = appState.getState();
    save(state);
    console.log("💾 Stato salvato");
  } catch (e) {
    console.error("❌ Errore salvataggio stato:", e);
    showToast("Errore nel salvataggio", "error");
  }
}

// =============================================
// RENDERING
// =============================================

/**
 * Rendering completo applicazione
 */
function render() {
  if (!appState) {
    console.error("❌ appState non inizializzato");
    return;
  }
  
  const state = appState.getState();
  
  console.log("🎨 Render chiamato:", {
    filaments: state.filaments?.length || 0,
    purchasedFilaments: state.purchasedFilaments?.length || 0
  });
  
  // Verifica che gli elementi DOM esistano
  const filamentTableBody = document.getElementById("filamentTableBody");
  const purchasedTableBody = document.getElementById("purchasedTableBody");
  
  if (!filamentTableBody) {
    console.warn("⚠️ filamentTableBody non trovato nel DOM");
  }
  if (!purchasedTableBody) {
    console.warn("⚠️ purchasedTableBody non trovato nel DOM");
  }
  
  renderAll(state, {
    stock: stockFilters,
    purchased: purchasedFilters
  }, currentSearch, {
    stock: stockSortState,
    purchased: purchasedSortState
  });

  // Aggiorna anche liste dropdown
  renderBrandOptions(state.brandList || state.brands || []);
  renderMaterialOptions(state.materialList || state.materials || [], DEFAULT_MATERIALS_ORDERED);
  renderLocationsList(locationList);
  
  // Popola i dropdown dei filtri (brand, material)
  populateFilterOptions(state);
  
  // Inizializza dropdown colori per form aggiunta (solo una volta)
  const addColorContainer = document.getElementById("addColorDropdownContainer");
  if (addColorContainer && !window.addColorDropdown) {
    window.addColorDropdown = createColorDropdown("addColorDropdownContainer", {
      placeholder: "Seleziona colore...",
      allowCustom: true,
      customLabel: "Altro colore...",
      onSelect: (value) => {
        const customInput = document.getElementById("addColorCustom");
        if (customInput) {
          if (value === "__custom__") {
            customInput.style.display = "block";
            customInput.focus();
          } else {
            customInput.style.display = "none";
            customInput.value = "";
          }
        }
        // Aggiorna anteprima colore
        const dot = document.getElementById("addColorPreviewDot");
        const label = document.getElementById("addColorPreviewLabel");
        if (dot && label) {
          const hex = getColorHex(value);
          dot.style.background = hex;
          label.textContent = value || "Nessun colore selezionato";
        }
      }
    });
  }
  
  console.log("✅ Render completato");
}

/**
 * Rendering parziale (solo tabelle)
 */
function renderTables() {
  const state = appState.getState();
  renderFilamentTable(state, stockFilters, currentSearch, stockSortState);
  renderPurchasedTable(state, purchasedFilters, purchasedSortState);
}

/**
 * Rendering parziale (solo dashboard)
 */
function renderDashboardOnly() {
  const state = appState.getState();
  renderDashboard(state);
  renderStockSummary(state);
  renderBars(state);
}

// =============================================
// GESTIONE FILAMENTI - CRUD
// =============================================

/**
 * Gestisce l'aggiunta di un filamento dal form
 */
function handleAddFilament() {
  const brandSel = document.getElementById("addBrandSelect");
  const brandCustom = document.getElementById("addBrandCustom");
  const matSel = document.getElementById("addMaterialSelect");
  const matCustom = document.getElementById("addMaterialCustom");
  const colorCustom = document.getElementById("addColorCustom");
  const colorCodeInput = document.getElementById("addColorCodeInput");
  const spoolsTotalInput = document.getElementById("addSpoolsTotalInput");
  const sealedInput = document.getElementById("addSealedSpoolsInput");
  const openInput = document.getElementById("addOpenSpoolsInput");
  const unitWeightPreset = document.getElementById("addUnitWeightPreset");
  const unitWeightInput = document.getElementById("addUnitWeightInput");
  const packagingTypeSelect = document.getElementById("addPackagingType");
  const priceInput = document.getElementById("addPriceInput");
  const supplierInput = document.getElementById("addSupplierInput");
  const notesInput = document.getElementById("addNotesInput");
  const fractionSelect = document.getElementById("addFractionSelect");

  // Leggi brand
  let brand = "";
  if (brandSel && brandSel.value === "__custom__") {
    brand = brandCustom ? brandCustom.value.trim() : "";
  } else if (brandSel) {
    brand = brandSel.value;
  }
  brand = canonicalizeBrand(brand);

  // Leggi material
  let material = "";
  if (matSel && matSel.value === "__custom__") {
    material = matCustom ? matCustom.value.trim() : "";
  } else if (matSel) {
    material = matSel.value;
  }

  // Leggi colore dal dropdown
  let color = "";
  const dropdownColorValue = window.addColorDropdown ? window.addColorDropdown.getValue() : "";
  if (dropdownColorValue && dropdownColorValue !== "__custom__") {
    color = dropdownColorValue;
  } else if (colorCustom && colorCustom.value.trim()) {
    color = colorCustom.value.trim();
  }

  const colorCode = colorCodeInput && colorCodeInput.value ? colorCodeInput.value.trim() : "";
  const packagingType = packagingTypeSelect ? packagingTypeSelect.value : "spool";
  let unitPrice = priceInput && priceInput.value ? parseFloat(priceInput.value) : null;
  if (isNaN(unitPrice)) unitPrice = null;

  const sealedSpoolsRaw = parseInt(sealedInput ? sealedInput.value || "0" : "0", 10);
  const openSpoolsRaw = parseInt(openInput ? openInput.value || "0" : "0", 10);
  const sealedSpools = isNaN(sealedSpoolsRaw) ? 0 : sealedSpoolsRaw;
  const openSpools = isNaN(openSpoolsRaw) ? 0 : openSpoolsRaw;

  let unitWeight = 0;
  if (unitWeightPreset && unitWeightPreset.value && unitWeightPreset.value !== "__custom__") {
    unitWeight = parseFloat(unitWeightPreset.value);
  } else if (unitWeightInput) {
    const customWeight = parseFloat(unitWeightInput.value);
    unitWeight = isNaN(customWeight) ? 0 : customWeight;
  }

  const supplier = supplierInput ? supplierInput.value.trim() : "";
  const notes = notesInput ? notesInput.value.trim() : "";
  let mainFraction = parseFloat(fractionSelect ? fractionSelect.value || "1" : "1");
  if (isNaN(mainFraction)) mainFraction = 1;

  // Validazione
  if (!brand) {
    showToast("Seleziona o inserisci una marca.", "error");
    return;
  }
  if (!material) {
    showToast("Seleziona o inserisci un materiale.", "error");
    return;
  }
  if (!color) {
    showToast("Seleziona o inserisci un colore/variante.", "error");
    return;
  }
  if (sealedSpools < 0 || openSpools < 0) {
    showToast("I numeri di bobine nuove/aperte devono essere positivi.", "error");
    return;
  }

  const spoolsTotal = sealedSpools + openSpools;
  if (!spoolsTotal || spoolsTotal <= 0) {
    showToast("Inserisci almeno una bobina nuova o aperta per questo filamento.", "error");
    return;
  }

  if (!unitWeight || unitWeight <= 0 || isNaN(unitWeight)) {
    showToast("Inserisci i grammi per bobina (es. 1000).", "error");
    return;
  }

  // Aggiorna liste brand/material/color se necessario
  const state = appState.getState();
  let updatedBrandList = [...(state.brandList || state.brands || [])];
  let updatedMaterialList = [...(state.materialList || state.materials || [])];

  if (!updatedBrandList.includes(brand)) {
    updatedBrandList.push(brand);
    updatedBrandList = cleanBrandList(updatedBrandList);
  }
  if (!updatedMaterialList.includes(material)) {
    updatedMaterialList.push(material);
    updatedMaterialList = Array.from(new Set(updatedMaterialList));
  }

  // Crea filamento
  const id = Date.now().toString() + Math.random().toString(16).slice(2);
  const totalWeight = spoolsTotal * unitWeight;

  const filament = {
    id,
    brand,
    material,
    variant: color,
    color_code: colorCode,
    packaging_type: packagingType,
    spools_total: spoolsTotal,
    sealed_spools: sealedSpools,
    open_spools: openSpools,
    unit_weight_g: unitWeight,
    total_weight_g: totalWeight,
    remaining_weight_g: 0,
    used_weight_g: 0,
    main_fraction: openSpools > 0 ? mainFraction : 1,
    open_spools_fractions: openSpools > 0 ? [mainFraction] : undefined,
    unit_price: unitPrice,
    supplier,
    notes
  };

  // Calcola pesi
  recalcWeightsForFilament(filament);

  // Aggiungi e deduplica
  const updatedFilaments = [...state.filaments, filament];
  const deduplicated = deduplicateFilamentsByIdentity(updatedFilaments);

  // Aggiorna stato
  appState.setState({
    filaments: deduplicated,
    brandList: updatedBrandList,
    materialList: updatedMaterialList
  });
  
  saveState();
  render();

  // Reset form
  if (brandSel) brandSel.value = "";
  if (brandCustom) brandCustom.value = "";
  if (matSel) matSel.value = "";
  if (matCustom) matCustom.value = "";
  if (colorCustom) {
    colorCustom.value = "";
    colorCustom.style.display = "none";
  }
  if (colorCodeInput) colorCodeInput.value = "";
  if (spoolsTotalInput) spoolsTotalInput.value = "";
  if (sealedInput) sealedInput.value = "";
  if (openInput) openInput.value = "";
  if (unitWeightPreset) unitWeightPreset.value = "1000";
  if (unitWeightInput) unitWeightInput.value = "";
  if (priceInput) priceInput.value = "";
  if (supplierInput) supplierInput.value = "";
  if (notesInput) notesInput.value = "";
  if (fractionSelect) fractionSelect.value = "1";
  
  // Reset dropdown colore
  if (window.addColorDropdown) {
    window.addColorDropdown.setValue("");
  }
  
  // Reset anteprima colore
  const dot = document.getElementById("addColorPreviewDot");
  const label = document.getElementById("addColorPreviewLabel");
  if (dot) dot.style.background = "#e5e7eb";
  if (label) label.textContent = "Nessun colore selezionato";

  showToast("Filamento aggiunto al magazzino disponibile.", "success");
}

/**
 * Aggiungi nuovo filamento (funzione helper)
 */
function addFilament(filamentData) {
  try {
    const state = appState.getState();
    const newFilament = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...filamentData,
      brand: canonicalizeBrand(filamentData.brand),
      material: canonicalizeMaterial(filamentData.material)
    };

    const updatedFilaments = [...state.filaments, newFilament];
    
    appState.setState({ filaments: updatedFilaments });
    saveState();
    render();
    
    showToast("Filamento aggiunto con successo", "success");
    return newFilament;
  } catch (e) {
    console.error("Errore aggiunta filamento:", e);
    showToast("Errore nell'aggiunta del filamento", "error");
    return null;
  }
}

/**
 * Modifica filamento esistente
 */
function updateFilament(id, updates) {
  try {
    const state = appState.getState();
    const updatedFilaments = state.filaments.map(f => 
      f.id === id ? { ...f, ...updates } : f
    );
    
    appState.setState({ filaments: updatedFilaments });
    saveState();
    render();
    
    showToast("Filamento modificato", "success");
    return true;
  } catch (e) {
    console.error("Errore modifica filamento:", e);
    showToast("Errore nella modifica", "error");
    return false;
  }
}

/**
 * Elimina filamento
 */
function deleteFilament(id) {
  if (!confirm("Sei sicuro di voler eliminare questo filamento?")) {
    return false;
  }

  try {
    const state = appState.getState();
    const updatedFilaments = state.filaments.filter(f => f.id !== id);
    
    appState.setState({ filaments: updatedFilaments });
    saveState();
    render();
    
    showToast("Filamento eliminato", "success");
    return true;
  } catch (e) {
    console.error("Errore eliminazione:", e);
    showToast("Errore nell'eliminazione", "error");
    return false;
  }
}

/**
 * Elimina filamenti selezionati
 */
function deleteSelectedFilaments() {
  const checkboxes = document.querySelectorAll(".filament-select-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("Nessun filamento selezionato", "warning");
    return;
  }

  if (!confirm(`Eliminare ${checkboxes.length} filamenti selezionati?`)) {
    return;
  }

  try {
    const idsToDelete = Array.from(checkboxes).map(cb => cb.getAttribute("data-id"));
    const state = appState.getState();
    const updatedFilaments = state.filaments.filter(f => !idsToDelete.includes(f.id));
    
    appState.setState({ filaments: updatedFilaments });
    saveState();
    render();
    
    showToast(`${checkboxes.length} filamenti eliminati`, "success");
  } catch (e) {
    console.error("Errore eliminazione multipla:", e);
    showToast("Errore nell'eliminazione", "error");
  }
}

// =============================================
// GESTIONE MODALI
// =============================================

/**
 * Apri modal impostazioni
 */
function openSettingsModal(event) {
  const modal = document.getElementById("settingsModal");
  const overlay = document.getElementById("modalOverlay");
  if (modal && overlay) {
    // Centra il modal nello schermo
    const modalDialog = modal.querySelector(".modal-dialog");
    if (modalDialog) {
      // Reset eventuali posizioni precedenti
      modalDialog.style.position = "relative";
      modalDialog.style.left = "auto";
      modalDialog.style.top = "auto";
      modalDialog.style.transform = "none";
      modalDialog.style.margin = "auto";
    }
    
    modal.classList.add("is-open");
    overlay.classList.add("is-open");
    
    // Carica valori correnti
    const thresholdInput = document.getElementById("lowStockThresholdInput");
    if (thresholdInput) {
      const saved = localStorage.getItem("registroFilamentiLowStockThreshold");
      thresholdInput.value = saved || "25";
    }
    
    // Aggiorna lista posizioni
    renderLocationsList(locationList);
  }
}

/**
 * Chiudi modal impostazioni
 */
function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  const overlay = document.getElementById("modalOverlay");
  if (modal && overlay) {
    modal.classList.remove("is-open");
    overlay.classList.remove("is-open");
  }
}

/**
 * Salva impostazioni
 */
function saveSettingsData() {
  const thresholdInput = document.getElementById("lowStockThresholdInput");
  if (thresholdInput) {
    const threshold = parseInt(thresholdInput.value, 10);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      localStorage.setItem("registroFilamentiLowStockThreshold", threshold.toString());
      showToast("Impostazioni salvate", "success");
    } else {
      showToast("Soglia allarme non valida (0-100)", "error");
    }
  }
  closeSettingsModal();
}

/**
 * Cancella filamenti comprati
 */
function clearPurchasedData() {
  if (!confirm("Sei sicuro di voler cancellare TUTTI i filamenti comprati? Questa azione non può essere annullata.")) {
    return;
  }
  
  appState.setState({ purchasedFilaments: [] });
  saveState();
  render();
  showToast("Filamenti comprati cancellati", "success");
  closeSettingsModal();
}

/**
 * Cancella filamenti disponibili
 */
function clearAvailableData() {
  if (!confirm("Sei sicuro di voler cancellare TUTTI i filamenti disponibili? Questa azione non può essere annullata.")) {
    return;
  }
  
  appState.setState({ filaments: [] });
  saveState();
  render();
  showToast("Filamenti disponibili cancellati", "success");
  closeSettingsModal();
}

/**
 * Cancella tutti i dati
 */
function clearAllData() {
  if (!confirm("ATTENZIONE: Sei sicuro di voler cancellare TUTTI i dati?\n\nQuesta azione cancellerà:\n- Tutti i filamenti disponibili\n- Tutti i filamenti comprati\n- Tutte le liste personalizzate\n\nQuesta azione NON può essere annullata!")) {
    return;
  }
  
  if (!confirm("Ultima conferma: cancellare TUTTO?")) {
    return;
  }
  
  appState.setState({
    filaments: [],
    purchasedFilaments: [],
    brandList: [...DEFAULT_BRANDS],
    materialList: [...DEFAULT_MATERIALS_ORDERED]
  });
  
  // Pulisci anche localStorage
  localStorage.removeItem("registroFilamentiState_v3");
  localStorage.removeItem("registroFilamentiLocations");
  localStorage.removeItem("registroFilamentiBrands");
  localStorage.removeItem("registroFilamentiMaterials");
  localStorage.removeItem("registroFilamentiColors");
  
  saveState();
  render();
  showToast("Tutti i dati sono stati cancellati", "success");
  closeSettingsModal();
}

// =============================================
// FUNZIONI HELPER PER MODAL EDIT
// =============================================

/**
 * Genera HTML options per dropdown posizioni
 */
function generateLocationOptions(selectedValue = "") {
  return `
    <option value="">Nessuna posizione</option>
    ${locationList.map(loc => 
      `<option value="${loc}" ${loc === selectedValue ? "selected" : ""}>${loc}</option>`
    ).join("")}
  `;
}

/**
 * Aggiorna preview peso residuo nella modal edit
 */
function updateEditRemainingGrams() {
  const unitWeightInput = document.getElementById("editUnitWeightInput");
  const spoolsSealedInput = document.getElementById("editSpoolsSealed");
  const spoolsOpenInput = document.getElementById("editSpoolsOpen");
  const remainingEl = document.getElementById("editRemainingGrams");
  
  if (!unitWeightInput || !spoolsSealedInput || !spoolsOpenInput || !remainingEl) return;
  
  const unitWeight = parseFloat(unitWeightInput.value) || 0;
  const sealed = parseInt(spoolsSealedInput.value) || 0;
  const open = parseInt(spoolsOpenInput.value) || 0;
  
  // Calcola somma frazioni bobine aperte
  let fractionsSum = 0;
  if (window.currentOpenSpoolsFractions && Array.isArray(window.currentOpenSpoolsFractions)) {
    fractionsSum = window.currentOpenSpoolsFractions.slice(0, open).reduce((sum, f) => sum + (parseFloat(f) || 0), 0);
  } else {
    fractionsSum = open; // Default: tutte piene
  }
  
  const remainingGrams = (sealed + fractionsSum) * unitWeight;
  remainingEl.textContent = formatNumber(remainingGrams) + " g";
}

/**
 * Apri modal modifica filamento - IMPLEMENTAZIONE COMPLETA CON BOBINE MULTIPLE
 */
function openEditFilamentModal(id) {
  currentEditingFilamentId = id;
  const state = appState.getState();
  const filament = state.filaments.find(f => f.id === id);
  
  if (!filament) {
    showToast("Filamento non trovato", "error");
    return;
  }

  const modal = document.getElementById("editFilamentModal");
  const overlay = document.getElementById("modalOverlay");
  
  if (!modal || !overlay) {
    console.error("Modal elements not found");
    return;
  }

  // Popola campi base
  const editBrand = document.getElementById("editBrand");
  const editMaterial = document.getElementById("editMaterial");
  const editVariant = document.getElementById("editVariant");
  const editPackaging = document.getElementById("editPackagingType");
  const editUnitWeight = document.getElementById("editUnitWeightInput");
  const editPrice = document.getElementById("editPriceInput");
  const editSupplier = document.getElementById("editSupplierInput");
  const editNotes = document.getElementById("editNotesInput");
  const editSpoolsSealed = document.getElementById("editSpoolsSealed");
  const editSpoolsOpen = document.getElementById("editSpoolsOpen");
  
  if (editBrand) editBrand.value = filament.brand || "";
  if (editMaterial) editMaterial.value = filament.material || "";
  if (editVariant) editVariant.value = filament.variant || "";
  if (editPackaging) editPackaging.value = filament.packaging || "spool";
  if (editUnitWeight) editUnitWeight.value = filament.unit_weight || 1000;
  if (editPrice) editPrice.value = filament.unit_price != null ? filament.unit_price : "";
  if (editSupplier) editSupplier.value = filament.supplier || "";
  if (editNotes) editNotes.value = filament.notes || "";
  if (editSpoolsSealed) editSpoolsSealed.value = filament.sealed_spools || 0;
  if (editSpoolsOpen) editSpoolsOpen.value = filament.open_spools || 0;
  
  const sealedSpools = filament.sealed_spools || 0;
  const openSpools = filament.open_spools || 0;
  const totalSpools = sealedSpools + openSpools;
  
  // Prepara array posizioni
  let spoolsLocations = Array.isArray(filament.spools_locations) 
    ? [...filament.spools_locations] 
    : [];
  
  while (spoolsLocations.length < totalSpools) {
    spoolsLocations.push(filament.location || "");
  }
  
  // Prepara array varianti
  let spoolsVariants = Array.isArray(filament.spools_variants) 
    ? [...filament.spools_variants] 
    : [];
  
  while (spoolsVariants.length < totalSpools) {
    spoolsVariants.push(filament.variant || "");
  }
  
  // Prepara array frazioni
  let openSpoolsFractions = Array.isArray(filament.open_spools_fractions) 
    ? [...filament.open_spools_fractions] 
    : [];
  
  while (openSpoolsFractions.length < openSpools) {
    // Migrazione da vecchio sistema
    if (openSpoolsFractions.length === 0 && filament.main_fraction != null) {
      openSpoolsFractions.push(filament.main_fraction);
    } else {
      openSpoolsFractions.push(1);
    }
  }
  
  // Salva in variabili globali per applyEditFilament
  window.currentSpoolsLocations = spoolsLocations;
  window.currentSpoolsVariants = spoolsVariants;
  window.currentOpenSpoolsFractions = openSpoolsFractions;
  
  // Renderizza bobine sigillate
  const sealedSpoolsList = document.getElementById("editSealedSpoolsList");
  const sealedSpoolsListContainer = document.getElementById("editSealedSpoolsListContainer");
  
  if (sealedSpoolsList && sealedSpoolsListContainer) {
    if (sealedSpools === 0) {
      sealedSpoolsList.style.display = "none";
    } else {
      sealedSpoolsList.style.display = "block";
      sealedSpoolsListContainer.innerHTML = "";
      
      for (let i = 0; i < sealedSpools; i++) {
        const spoolDiv = document.createElement("div");
        spoolDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; background: var(--surface-soft); border-radius: 0.25rem;";
        
        const labelText = document.createElement("span");
        labelText.style.cssText = "font-size: 0.8rem; font-weight: 500;";
        labelText.textContent = `Bobina sigillata ${i + 1}`;
        spoolDiv.appendChild(labelText);
        
        const controlsDiv = document.createElement("div");
        controlsDiv.style.cssText = "display: flex; gap: 0.5rem;";
        
        // Select posizione
        const locationLabel = document.createElement("label");
        locationLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        
        const locationLabelText = document.createElement("span");
        locationLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        locationLabelText.textContent = "Posizione:";
        
        const locationSelect = document.createElement("select");
        locationSelect.style.cssText = "width: 100%;";
        locationSelect.dataset.spoolIndex = i;
        locationSelect.dataset.spoolType = "sealed";
        locationSelect.innerHTML = generateLocationOptions(spoolsLocations[i] || "");
        
        locationSelect.addEventListener("change", () => {
          const index = parseInt(locationSelect.dataset.spoolIndex, 10);
          window.currentSpoolsLocations[index] = locationSelect.value.trim();
        });
        
        locationLabel.appendChild(locationLabelText);
        locationLabel.appendChild(locationSelect);
        controlsDiv.appendChild(locationLabel);
        
        spoolDiv.appendChild(controlsDiv);
        sealedSpoolsListContainer.appendChild(spoolDiv);
      }
    }
  }
  
  // Renderizza bobine aperte
  const openSpoolsList = document.getElementById("editOpenSpoolsList");
  const openSpoolsListContainer = document.getElementById("editOpenSpoolsListContainer");
  
  if (openSpoolsList && openSpoolsListContainer) {
    if (openSpools === 0) {
      openSpoolsList.style.display = "none";
    } else {
      openSpoolsList.style.display = "block";
      openSpoolsListContainer.innerHTML = "";
      
      for (let i = 0; i < openSpools; i++) {
        const spoolDiv = document.createElement("div");
        spoolDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; background: var(--surface-soft); border-radius: 0.25rem;";
        
        const labelText = document.createElement("span");
        labelText.style.cssText = "font-size: 0.8rem; font-weight: 500;";
        labelText.textContent = `Bobina aperta ${i + 1}`;
        spoolDiv.appendChild(labelText);
        
        const controlsDiv = document.createElement("div");
        controlsDiv.style.cssText = "display: flex; gap: 0.5rem;";
        
        // Select frazione
        const fractionLabel = document.createElement("label");
        fractionLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        
        const fractionLabelText = document.createElement("span");
        fractionLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        fractionLabelText.textContent = "Frazione:";
        
        const fractionSelect = document.createElement("select");
        fractionSelect.style.cssText = "width: 100%;";
        fractionSelect.dataset.spoolIndex = i;
        
        const fractionOptions = [
          { value: "1", text: "Piena (100%)" },
          { value: "0.75", text: "Tre quarti (75%)" },
          { value: "0.5", text: "Metà (50%)" },
          { value: "0.25", text: "Un quarto (25%)" },
          { value: "0", text: "Finita (0%)" }
        ];
        
        fractionOptions.forEach(opt => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.text;
          fractionSelect.appendChild(option);
        });
        
        const currentFraction = openSpoolsFractions[i] !== undefined ? openSpoolsFractions[i] : 1;
        fractionSelect.value = String(currentFraction);
        
        fractionSelect.addEventListener("change", () => {
          const index = parseInt(fractionSelect.dataset.spoolIndex, 10);
          window.currentOpenSpoolsFractions[index] = parseFloat(fractionSelect.value);
          updateEditRemainingGrams();
        });
        
        fractionLabel.appendChild(fractionLabelText);
        fractionLabel.appendChild(fractionSelect);
        controlsDiv.appendChild(fractionLabel);
        
        // Select posizione
        const locationLabel = document.createElement("label");
        locationLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        
        const locationLabelText = document.createElement("span");
        locationLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        locationLabelText.textContent = "Posizione:";
        
        const locationSelect = document.createElement("select");
        locationSelect.style.cssText = "width: 100%;";
        locationSelect.dataset.spoolIndex = i;
        locationSelect.dataset.spoolType = "open";
        locationSelect.innerHTML = generateLocationOptions(spoolsLocations[sealedSpools + i] || "");
        
        locationSelect.addEventListener("change", () => {
          const index = parseInt(locationSelect.dataset.spoolIndex, 10);
          window.currentSpoolsLocations[sealedSpools + index] = locationSelect.value.trim();
        });
        
        locationLabel.appendChild(locationLabelText);
        locationLabel.appendChild(locationSelect);
        controlsDiv.appendChild(locationLabel);
        
        spoolDiv.appendChild(controlsDiv);
        openSpoolsListContainer.appendChild(spoolDiv);
      }
    }
  }
  
  // Event listeners per aggiornare liste quando cambiano i numeri
  if (editSpoolsSealed) {
    editSpoolsSealed.addEventListener("input", updateEditRemainingGrams);
  }
  
  if (editSpoolsOpen) {
    editSpoolsOpen.addEventListener("input", updateEditRemainingGrams);
  }
  
  if (editUnitWeight) {
    editUnitWeight.addEventListener("input", updateEditRemainingGrams);
  }
  
  // Aggiorna preview peso residuo
  updateEditRemainingGrams();
  
  // Mostra modal
  modal.classList.add("is-open");
  overlay.classList.add("is-open");
}

/**
 * Chiudi modal edit
 */
function closeEditFilamentModal() {
  const modal = document.getElementById("editFilamentModal");
  const overlay = document.getElementById("modalOverlay");
  if (modal && overlay) {
    modal.classList.remove("is-open");
    overlay.classList.remove("is-open");
    currentEditingFilamentId = null;
  }
}

/**
 * Applica modifiche da modal edit - IMPLEMENTAZIONE COMPLETA
 */
function applyEditFilament() {
  if (!currentEditingFilamentId) return;

  try {
    const state = appState.getState();
    const filament = state.filaments.find(f => f.id === currentEditingFilamentId);
    
    if (!filament) {
      showToast("Filamento non trovato", "error");
      return;
    }

    // Raccogli dati da form
    const brand = document.getElementById("editBrand")?.value || "";
    const material = document.getElementById("editMaterial")?.value || "";
    const variant = document.getElementById("editVariant")?.value || "";
    const packaging = document.getElementById("editPackagingType")?.value || "spool";
    const unitWeight = parseFloat(document.getElementById("editUnitWeightInput")?.value) || 1000;
    const price = document.getElementById("editPriceInput")?.value;
    const supplier = document.getElementById("editSupplierInput")?.value || "";
    const notes = document.getElementById("editNotesInput")?.value || "";
    const sealedSpools = parseInt(document.getElementById("editSpoolsSealed")?.value) || 0;
    const openSpools = parseInt(document.getElementById("editSpoolsOpen")?.value) || 0;
    
    if (!variant || variant.trim() === "") {
      showToast("Il colore/variante è obbligatorio", "error");
      return;
    }
    
    if (unitWeight <= 0) {
      showToast("I grammi per bobina devono essere maggiori di 0", "error");
      return;
    }
    
    // Prepara oggetto updates
    const updates = {
      brand,
      material,
      variant,
      packaging,
      unit_weight: unitWeight,
      unit_price: price ? parseFloat(price) : null,
      supplier,
      notes,
      sealed_spools: sealedSpools,
      open_spools: openSpools
    };
    
    // Raccogli frazioni bobine aperte
    if (window.currentOpenSpoolsFractions && openSpools > 0) {
      updates.open_spools_fractions = window.currentOpenSpoolsFractions.slice(0, openSpools);
    } else {
      updates.open_spools_fractions = [];
    }
    
    // Raccogli posizioni bobine
    if (window.currentSpoolsLocations) {
      const totalSpools = sealedSpools + openSpools;
      updates.spools_locations = window.currentSpoolsLocations.slice(0, totalSpools);
      
      // Mantieni location per retrocompatibilità
      const firstLocation = updates.spools_locations.find(loc => loc && loc.trim() !== "") || "";
      updates.location = firstLocation;
    } else {
      updates.spools_locations = [];
      updates.location = "";
    }
    
    // Raccogli varianti bobine
    if (window.currentSpoolsVariants) {
      const totalSpools = sealedSpools + openSpools;
      updates.spools_variants = window.currentSpoolsVariants.slice(0, totalSpools);
    } else {
      updates.spools_variants = [];
    }
    
    // Aggiorna filamento
    updateFilament(currentEditingFilamentId, updates);
    closeEditFilamentModal();
  } catch (error) {
    console.error("Errore nel salvataggio del filamento:", error);
    showToast("Errore nel salvataggio: " + (error.message || "Errore sconosciuto"), "error");
  }
}

/**
 * Apri modal aggiungi da comprati
 */
function openAddToStockModal(purchasedId) {
  currentAddToStockPurchasedId = purchasedId;
  const modal = document.getElementById("addToStockModal");
  if (modal) {
    modal.classList.add("is-open");
    document.getElementById("modalOverlay").classList.add("is-open");
  }
}

/**
 * Chiudi modal add to stock
 */
function closeAddToStockModal() {
  const modal = document.getElementById("addToStockModal");
  if (modal) {
    modal.classList.remove("is-open");
    document.getElementById("modalOverlay").classList.remove("is-open");
    currentAddToStockPurchasedId = null;
  }
}

/**
 * Chiudi tutte le modali (shortcut ESC)
 */
function closeAllModals() {
  closeEditFilamentModal();
  closeAddToStockModal();
  closeSettingsModal();
  
  const overlay = document.getElementById("modalOverlay");
  if (overlay) {
    overlay.classList.remove("is-open");
  }
}

// =============================================
// FILTRI E RICERCA
// =============================================

/**
 * Applica filtro magazzino
 */
function applyStockFilter(filterUpdate) {
  stockFilters = { ...stockFilters, ...filterUpdate };
  renderTables();
}

/**
 * Reset filtri magazzino
 */
function resetStockFilters() {
  stockFilters = {
    brand: "",
    material: "",
    packaging: "",
    lowStockOnly: false
  };
  
  // Reset UI
  const brandFilter = document.getElementById("stockFilterBrand");
  const materialFilter = document.getElementById("stockFilterMaterial");
  const packagingFilter = document.getElementById("stockFilterPackaging");
  
  if (brandFilter) brandFilter.value = "";
  if (materialFilter) materialFilter.value = "";
  if (packagingFilter) packagingFilter.value = "";
  
  renderTables();
  showToast("Filtri resettati", "info");
}

/**
 * Applica filtro comprati
 */
function applyPurchasedFilter(filterUpdate) {
  purchasedFilters = { ...purchasedFilters, ...filterUpdate };
  renderTables();
}

/**
 * Reset filtri comprati
 */
function resetPurchasedFilters() {
  purchasedFilters = {
    brand: "",
    material: "",
    packaging: ""
  };
  
  const brandFilter = document.getElementById("purchasedFilterBrand");
  const materialFilter = document.getElementById("purchasedFilterMaterial");
  const packagingFilter = document.getElementById("purchasedFilterPackaging");
  
  if (brandFilter) brandFilter.value = "";
  if (materialFilter) materialFilter.value = "";
  if (packagingFilter) packagingFilter.value = "";
  
  renderTables();
  showToast("Filtri resettati", "info");
}

/**
 * Gestione ricerca
 */
const handleSearch = debounce((searchTerm) => {
  currentSearch = searchTerm;
  renderTables();
}, 300);

// =============================================
// ORDINAMENTO
// =============================================

/**
 * Applica ordinamento tabella magazzino
 */
function applySortStock(field, direction) {
  stockSortState = { field, direction };
  window.stockSortState = stockSortState; // Esponi per setupTableSorting
  renderTables();
}

/**
 * Applica ordinamento tabella comprati
 */
function applySortPurchased(field, direction) {
  purchasedSortState = { field, direction };
  window.purchasedSortState = purchasedSortState; // Esponi per setupTableSorting
  renderTables();
}

// =============================================
// IMPORT/EXPORT
// =============================================

/**
 * Esporta JSON magazzino
 */
function handleExportJson() {
  try {
    const json = exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filamenti-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast("JSON esportato con successo", "success");
  } catch (e) {
    console.error("Errore export:", e);
    showToast("Errore nell'esportazione", "error");
  }
}

/**
 * Importa JSON
 */
function handleImportJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = importJson(e.target.result);
      
      if (result.success && result.state) {
        const imported = result.state;
        
        console.log("📥 Dati importati:", {
          filaments: imported.filaments?.length || 0,
          purchasedFilaments: imported.purchasedFilaments?.length || 0,
          brandList: imported.brandList?.length || imported.brands?.length || 0,
          materialList: imported.materialList?.length || imported.materials?.length || 0
        });
        
        // Mostra esempio primo filamento per debug
        if (imported.filaments && imported.filaments.length > 0) {
          console.log("📋 Esempio primo filamento:", {
            id: imported.filaments[0].id,
            brand: imported.filaments[0].brand,
            material: imported.filaments[0].material,
            variant: imported.filaments[0].variant
          });
        }
        
        // Normalizza e valida prima di impostare
        const validationResult = normalizeAndValidateState(imported);
        const validated = validationResult.state; // Estrai lo state dal risultato
        
        console.log("✅ Dati validati:", {
          filaments: validated.filaments?.length || 0,
          purchasedFilaments: validated.purchasedFilaments?.length || 0,
          brandList: validated.brandList?.length || validated.brands?.length || 0,
          materialList: validated.materialList?.length || validated.materials?.length || 0
        });
        
        // Mostra errori di validazione se ci sono
        if (validationResult.stats && validationResult.stats.errors && validationResult.stats.errors.length > 0) {
          console.error("❌ Errori validazione:", validationResult.stats.errors.slice(0, 5));
          console.log("📊 Statistiche validazione:", {
            total: validationResult.stats.filaments?.total || 0,
            valid: validationResult.stats.filaments?.valid || 0,
            rejected: validationResult.stats.filaments?.rejected || 0,
            fixed: validationResult.stats.filaments?.fixed || 0
          });
        }
        
        // Se ci sono filamenti validati, usali; altrimenti prova a usare quelli originali
        const finalFilaments = validated.filaments && validated.filaments.length > 0 
          ? validated.filaments 
          : (imported.filaments || []);
        
        appState.setState({
          filaments: finalFilaments,
          purchasedFilaments: validated.purchasedFilaments || imported.purchasedFilaments || [],
          brandList: validated.brandList || validated.brands || imported.brandList || imported.brands || [...DEFAULT_BRANDS],
          materialList: validated.materialList || validated.materials || imported.materialList || imported.materials || [...DEFAULT_MATERIALS_ORDERED]
        });
        
        saveState();
        
        console.log("🎨 Chiamata render()...");
        render();
        
        const count = finalFilaments.length;
        showToast(`Importati ${count} filamenti`, "success");
        console.log(`✅ Import completato: ${count} filamenti`);
      } else {
        const errorMsg = result.error || "Errore nell'importazione";
        console.error("Errore import:", errorMsg, result);
        showToast(errorMsg, "error");
      }
    } catch (err) {
      console.error("Errore import:", err);
      showToast("Errore nell'importazione: " + err.message, "error");
    }
  };
  
  reader.readAsText(file);
}

// =============================================
// LOCATIONS MANAGEMENT
// =============================================

/**
 * Aggiungi location
 */
function addLocation(location) {
  if (!location || locationList.includes(location)) {
    showToast("Posizione già esistente o non valida", "warning");
    return;
  }

  locationList.push(location);
  saveConfiguration();
  renderLocationsList(locationList);
  showToast("Posizione aggiunta", "success");
}

/**
 * Elimina location
 */
function deleteLocation(index) {
  if (index < 0 || index >= locationList.length) return;

  const location = locationList[index];
  if (!confirm(`Eliminare la posizione "${location}"?`)) return;

  locationList.splice(index, 1);
  saveConfiguration();
  renderLocationsList(locationList);
  showToast("Posizione eliminata", "success");
}

/**
 * Rinomina location
 */
function renameLocation(index, newName) {
  if (index < 0 || index >= locationList.length) return;
  if (!newName || newName.trim() === "") {
    showToast("Il nome non può essere vuoto", "warning");
    renderLocationsList(locationList); // Ripristina il valore originale
    return;
  }
  
  const trimmedName = newName.trim();
  
  // Controlla se il nome esiste già (escludendo la posizione corrente)
  if (locationList.some((loc, i) => i !== index && loc.toLowerCase() === trimmedName.toLowerCase())) {
    showToast("Questa posizione esiste già", "warning");
    renderLocationsList(locationList); // Ripristina il valore originale
    return;
  }
  
  locationList[index] = trimmedName;
  saveConfiguration();
  showToast("Posizione rinominata", "success");
}

// =============================================
// SETUP EVENTI
// =============================================

/**
 * Inizializza tutti gli event listener
 */
function setupEvents() {
  setupAllEvents({
    // Tabelle
    openEditModal: openEditFilamentModal,
    deleteFilament: deleteFilament,
    openAddToStockModal: openAddToStockModal,
    deleteSelected: deleteSelectedFilaments,
    
    // Modali
    closeSettings: closeSettingsModal,
    closeConsumption: () => {},
    closeEdit: closeEditFilamentModal,
    closeAddToStock: closeAddToStockModal,
    applyConsumption: () => {},
    applyEdit: applyEditFilament,
    applyAddToStock: () => {},
    saveSettings: saveSettingsData,
    
    // Settings clear functions
    clearPurchasedData: clearPurchasedData,
    clearAvailableData: clearAvailableData,
    clearAllData: clearAllData,
    
    // Form
    addFilament: handleAddFilament,
    addPurchased: () => {},
    exportJson: handleExportJson,
    exportInvoices: () => {},
    importJson: handleImportJson,
    
    // Filtri
    onStockFilterChange: applyStockFilter,
    onStockFilterReset: resetStockFilters,
    onPurchasedFilterChange: applyPurchasedFilter,
    onPurchasedFilterReset: resetPurchasedFilters,
    onSearch: handleSearch,
    
    // Ordinamento
    onStockSort: applySortStock,
    onPurchasedSort: applySortPurchased,
    
    // Locations
    addLocation: addLocation,
    deleteLocation: deleteLocation,
    renameLocation: renameLocation,
    
    // History
    deleteHistoryEntry: () => {},
    clearHistory: () => {},
    
    // Auto-save
    autoSave: saveState,
    
    // Keyboard
    closeAllModals: closeAllModals,
    save: saveState,
    
    // Theme
    onThemeChange: (theme) => {
      console.log("Theme changed:", theme);
    },
    
    // Header buttons
    refreshApp: () => {
      loadState();
      render();
      showToast("Dati ricaricati dal browser", "success");
    },
    undo: () => {
      showToast("Undo non ancora implementato", "info");
    },
    redo: () => {
      showToast("Redo non ancora implementato", "info");
    },
    openSettings: openSettingsModal
  });

  console.log("✅ Eventi configurati");
}

// =============================================
// BOOTSTRAP APPLICAZIONE
// =============================================

/**
 * Inizializzazione applicazione
 */
function initializeApp() {
  try {
    console.log(`🚀 Inizializzazione Registro Filamenti ${APP_VERSION}`);
    
    // 1. Carica configurazione
    loadConfiguration();
    
    // 2. Carica stato
    const loaded = loadState();
    if (!loaded) {
      showToast("Errore nel caricamento dati", "warning");
    }
    
    // 3. Subscribe a cambiamenti stato per auto-render
    appState.subscribe(() => {
      console.log("📊 Stato cambiato, re-rendering...");
      // Potremmo fare auto-render qui ma per ora lo gestiamo manualmente
    });
    
    // 4. Setup eventi
    setupEvents();
    
    // 5. Rendering iniziale
    render();
    
    // 6. Mostra benvenuto
    const state = appState.getState();
    const count = state.filaments.length;
    showToast(`Benvenuto! ${count} filamenti caricati`, "success", 2000);
    
    console.log("✅ Applicazione inizializzata con successo");
  } catch (e) {
    console.error("❌ Errore critico nell'inizializzazione:", e);
    alert("Errore critico nell'inizializzazione. Controlla la console.");
  }
}

// =============================================
// AVVIO APPLICAZIONE
// =============================================

// Inizializza quando il DOM è pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// =============================================
// ESPORTAZIONI (per debug/console)
// =============================================

// Assicurati che appState sia inizializzato prima di esporre l'API
if (!appState) {
  appState = new AppState();
  appState.setState({
    filaments: [],
    purchasedFilaments: [],
    brandList: [...DEFAULT_BRANDS],
    materialList: [...DEFAULT_MATERIALS_ORDERED]
  });
}

window.FilamentiApp = {
  version: APP_VERSION,
  getState: () => {
    if (!appState) {
      console.error("❌ appState non disponibile");
      return null;
    }
    return appState.getState();
  },
  saveState,
  render,
  addFilament,
  updateFilament,
  deleteFilament,
  exportJson: handleExportJson
};

console.log("💡 App API disponibile in window.FilamentiApp");
console.log("📊 Stato iniziale:", window.FilamentiApp.getState());


