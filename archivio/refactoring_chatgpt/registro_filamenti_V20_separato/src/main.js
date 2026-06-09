/**
 * main.js - Entry point applicazione
 * 
 * Coordina tutti i moduli e gestisce il ciclo di vita dell'app
 */

import { getAppState } from './state.js';
import { 
  load, save, loadLocationList, saveLocationList, 
  loadLowStockThreshold, saveLowStockThreshold,
  exportJson, importJson, loadTheme, saveTheme 
} from './store.js';
import { normalizeAndValidateState, validateFilament } from './validation.js';
import {
  calculateTotalStats, isLowStock, countLowStock,
  applyFilters, filterBySearch, sortFilaments,
  recalcWeightsForFilament, extractBrandList, extractMaterialList
} from './domain/filaments.js';
import { renderDashboard, renderFilamentTable, populateFilterOptions, renderLocationsList } from './ui/render.js';
import { setupAllEvents, showToast } from './ui/events.js';

// Stato globale
const appState = getAppState();
let locationList = [];
let lowStockThreshold = 0.25;
let currentSearch = "";
let sortState = { field: null, direction: "asc" };
let stockFilters = { brand: "", material: "", packaging: "" };

// Inizializzazione
async function init() {
  console.log("🚀 Inizializzazione app...");

  // Carica configurazione
  locationList = loadLocationList();
  lowStockThreshold = loadLowStockThreshold();
  
  // Carica tema
  const theme = loadTheme();
  document.documentElement.setAttribute('data-theme', theme);

  // Carica stato salvato
  const savedState = load();
  if (savedState) {
    const normalized = normalizeAndValidateState(savedState);
    appState.replaceState(normalized);
    console.log("✅ Stato caricato:", {
      filaments: normalized.filaments.length,
      purchased: normalized.purchasedFilaments.length
    });
  }

  // Setup event listeners
  setupAllEvents({
    onSort: handleSort,
    applyStockFilter: handleApplyStockFilter,
    resetStockFilters: handleResetStockFilters,
    handleSearch: handleSearch,
    handleAddFilament: handleAddFilament,
    handleImportJson: handleImportJson,
    handleExportJson: handleExportJson,
    onEdit: handleEditFilament,
    onConsume: handleConsumeFilament,
    onDelete: handleDeleteFilament,
    closeAllModals: closeAllModals,
    triggerAutoSave: autoSave,
    refreshApp: refreshApp,
    openSettings: openSettingsModal,
    undo: handleUndo,
    redo: handleRedo,
    renameLocation: handleRenameLocation,
    deleteLocation: handleDeleteLocation
  });

  // Render iniziale
  renderAll();

  console.log("✅ App inizializzata");
}

/**
 * Renderizza tutto
 */
function renderAll() {
  const state = appState.getState();
  
  // Dashboard
  const stats = calculateTotalStats(state.filaments);
  stats.lowStockCount = countLowStock(state.filaments, lowStockThreshold);
  renderDashboard(stats, lowStockThreshold);

  // Tabella filamenti
  renderFilamentTable(
    state.filaments,
    sortState,
    stockFilters,
    currentSearch,
    lowStockThreshold,
    {
      onEdit: handleEditFilament,
      onConsume: handleConsumeFilament,
      onDelete: handleDeleteFilament
    }
  );

  // Popola filtri
  populateFilterOptions(state.filaments, state.purchasedFilaments);
}

/**
 * Gestione ordinamento
 */
function handleSort(field) {
  if (sortState.field === field) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
  } else {
    sortState.field = field;
    sortState.direction = "asc";
  }
  renderAll();
}

/**
 * Applica filtri stock
 */
function handleApplyStockFilter(filters) {
  stockFilters = { ...stockFilters, ...filters };
  renderAll();
}

/**
 * Reset filtri stock
 */
function handleResetStockFilters() {
  stockFilters = { brand: "", material: "", packaging: "" };
  document.getElementById('stockFilterBrand').value = "";
  document.getElementById('stockFilterMaterial').value = "";
  document.getElementById('stockFilterPackaging').value = "";
  renderAll();
}

/**
 * Gestione ricerca
 */
function handleSearch(query) {
  currentSearch = query;
  renderAll();
}

/**
 * Aggiungi filamento
 */
function handleAddFilament() {
  const brandSelect = document.getElementById('addBrandSelect');
  const brandCustom = document.getElementById('addBrandCustom');
  const materialSelect = document.getElementById('addMaterialSelect');
  const materialCustom = document.getElementById('addMaterialCustom');
  const variantInput = document.getElementById('addColorCustom');
  const sealedInput = document.getElementById('addSealedSpoolsInput');
  const openInput = document.getElementById('addOpenSpoolsInput');
  const unitWeightInput = document.getElementById('addUnitWeightInput');
  const fractionSelect = document.getElementById('addFractionSelect');

  const brand = brandSelect?.value || brandCustom?.value || "";
  const material = materialSelect?.value || materialCustom?.value || "";
  const variant = variantInput?.value || "";
  const sealed_spools = parseInt(sealedInput?.value) || 0;
  const open_spools = parseInt(openInput?.value) || 0;
  const unit_weight = parseInt(unitWeightInput?.value) || 1000;
  const main_fraction = parseFloat(fractionSelect?.value) || 1;

  // Validazione
  if (!brand || !material || !variant) {
    showToast("Compila tutti i campi obbligatori", "error");
    return;
  }

  if (sealed_spools === 0 && open_spools === 0) {
    showToast("Devi inserire almeno una bobina", "error");
    return;
  }

  // Crea filamento
  const filament = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    brand: brand.trim(),
    material: material.trim(),
    variant: variant.trim(),
    packaging: document.getElementById('addPackagingType')?.value || "spool",
    unit_weight,
    unit_price: parseFloat(document.getElementById('addPriceInput')?.value) || null,
    supplier: document.getElementById('addSupplierInput')?.value || "",
    notes: document.getElementById('addNotesInput')?.value || "",
    sealed_spools,
    open_spools,
    open_spools_fractions: Array(open_spools).fill(main_fraction),
    spools_locations: Array(sealed_spools + open_spools).fill(""),
    location: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Ricalcola pesi
  const filamentWithWeights = recalcWeightsForFilament(filament);

  // Aggiungi allo stato
  const state = appState.getState();
  state.filaments.push(filamentWithWeights);
  
  // Aggiorna brand/material lists
  if (!state.brandList.includes(filament.brand)) {
    state.brandList.push(filament.brand);
    state.brandList.sort();
  }
  if (!state.materialList.includes(filament.material)) {
    state.materialList.push(filament.material);
    state.materialList.sort();
  }

  appState.setState(state);
  autoSave();
  renderAll();
  showToast("Filamento aggiunto", "success");

  // Reset form
  if (brandSelect) brandSelect.value = "";
  if (brandCustom) brandCustom.value = "";
  if (materialSelect) materialSelect.value = "";
  if (materialCustom) materialCustom.value = "";
  if (variantInput) variantInput.value = "";
  if (sealedInput) sealedInput.value = "";
  if (openInput) openInput.value = "";
  if (unitWeightInput) unitWeightInput.value = "";
}

/**
 * Modifica filamento
 */
function handleEditFilament(id) {
  const state = appState.getState();
  const filament = state.filaments.find(f => f.id === id);
  if (!filament) {
    showToast("Filamento non trovato", "error");
    return;
  }

  // TODO: Apri modal edit con tutti i campi
  showToast("Modal edit - da implementare", "info");
}

/**
 * Consuma filamento
 */
function handleConsumeFilament(id) {
  // TODO: Apri modal consumo
  showToast("Modal consumo - da implementare", "info");
}

/**
 * Elimina filamento
 */
function handleDeleteFilament(id) {
  if (!confirm("Sei sicuro di voler eliminare questo filamento?")) {
    return;
  }

  const state = appState.getState();
  state.filaments = state.filaments.filter(f => f.id !== id);
  appState.setState(state);
  autoSave();
  renderAll();
  showToast("Filamento eliminato", "success");
}

/**
 * Import JSON
 */
function handleImportJson(jsonString) {
  const imported = importJson(jsonString);
  if (!imported) {
    showToast("Errore importazione JSON", "error");
    return;
  }

  const normalized = normalizeAndValidateState(imported);
  appState.replaceState(normalized);
  autoSave();
  renderAll();
  showToast("JSON importato con successo", "success");
}

/**
 * Export JSON
 */
function handleExportJson() {
  const state = appState.getState();
  const json = exportJson(state);
  
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registro_filamenti_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast("JSON esportato", "success");
}

/**
 * Auto-save
 */
function autoSave() {
  const state = appState.getState();
  save(state);
}

/**
 * Refresh app
 */
function refreshApp() {
  const savedState = load();
  if (savedState) {
    const normalized = normalizeAndValidateState(savedState);
    appState.replaceState(normalized);
    renderAll();
    showToast("App ricaricata", "success");
  } else {
    showToast("Nessun dato salvato", "info");
  }
}

/**
 * Apri modal impostazioni
 */
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('is-open');
    document.getElementById('modalOverlay')?.classList.add('is-open');
    
    // Renderizza lista posizioni
    renderLocationsList(locationList, {
      renameLocation: handleRenameLocation,
      deleteLocation: handleDeleteLocation
    });
  }
}

/**
 * Chiudi tutti i modali
 */
function closeAllModals() {
  document.querySelectorAll('.modal.is-open').forEach(modal => {
    modal.classList.remove('is-open');
  });
  document.getElementById('modalOverlay')?.classList.remove('is-open');
}

/**
 * Undo
 */
function handleUndo() {
  // TODO: Implementare undo
  showToast("Undo - da implementare", "info");
}

/**
 * Redo
 */
function handleRedo() {
  // TODO: Implementare redo
  showToast("Redo - da implementare", "info");
}

/**
 * Rinomina posizione
 */
function handleRenameLocation(oldName, newName) {
  if (!newName || newName.trim() === "") {
    showToast("Il nome non può essere vuoto", "error");
    return;
  }

  if (locationList.includes(newName)) {
    showToast("Posizione già esistente", "error");
    return;
  }

  const index = locationList.indexOf(oldName);
  if (index === -1) return;

  locationList[index] = newName;
  saveLocationList(locationList);

  // Aggiorna filamenti
  const state = appState.getState();
  state.filaments.forEach(f => {
    if (f.location === oldName) {
      f.location = newName;
    }
    if (Array.isArray(f.spools_locations)) {
      f.spools_locations = f.spools_locations.map(loc => loc === oldName ? newName : loc);
    }
  });
  appState.setState(state);
  autoSave();

  renderLocationsList(locationList, {
    renameLocation: handleRenameLocation,
    deleteLocation: handleDeleteLocation
  });
  renderAll();
  showToast(`Posizione "${oldName}" rinominata in "${newName}"`, "success");
}

/**
 * Elimina posizione
 */
function handleDeleteLocation(location) {
  if (!confirm(`Eliminare la posizione "${location}"?`)) {
    return;
  }

  locationList = locationList.filter(l => l !== location);
  saveLocationList(locationList);

  // Rimuovi da filamenti
  const state = appState.getState();
  state.filaments.forEach(f => {
    if (f.location === location) {
      f.location = "";
    }
    if (Array.isArray(f.spools_locations)) {
      f.spools_locations = f.spools_locations.map(loc => loc === location ? "" : loc);
    }
  });
  appState.setState(state);
  autoSave();

  renderLocationsList(locationList, {
    renameLocation: handleRenameLocation,
    deleteLocation: handleDeleteLocation
  });
  renderAll();
  showToast(`Posizione "${location}" eliminata`, "success");
}

// Avvio app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default {
  init,
  renderAll,
  autoSave
};












