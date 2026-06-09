/**
 * src/ui/events.js
 * Gestione eventi e interattività UI
 * 
 * Questo modulo gestisce tutti gli event listener dell'applicazione.
 * Usa event delegation dove possibile per gestire elementi dinamici.
 * 
 * Struttura:
 * - Setup eventi tabelle (magazzino, comprati)
 * - Setup eventi modali
 * - Setup eventi form
 * - Setup filtri e ricerca
 * - Setup ordinamento
 * - Setup keyboard shortcuts
 * - Setup drag & drop
 */

// =============================================
// EVENTI TABELLE
// =============================================

/**
 * Setup eventi tabella magazzino (delegation)
 * @param {Object} callbacks - Funzioni callback {openEditModal, deleteFilament}
 */
export function setupFilamentTableEvents(callbacks) {
  const { openEditModal, deleteFilament } = callbacks;
  
  const tbody = document.getElementById("filamentTableBody");
  if (!tbody) {
    console.warn("filamentTableBody non trovato");
    return;
  }

  // Event delegation per bottoni azione
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button.btn-action");
    if (!btn || !btn.hasAttribute("data-id")) return;
    
    const filamentId = btn.getAttribute("data-id");
    const btnText = btn.textContent.trim();
    
    if (btnText.includes("Modifica")) {
      openEditModal(filamentId);
    } else if (btnText.includes("Elimina")) {
      deleteFilament(filamentId);
    }
  });
}

/**
 * Setup eventi tabella comprati (delegation)
 * @param {Object} callbacks - Funzioni callback {openAddToStockModal}
 */
export function setupPurchasedTableEvents(callbacks) {
  const { openAddToStockModal } = callbacks;
  
  const tbody = document.getElementById("purchasedTableBody");
  if (!tbody) {
    console.warn("purchasedTableBody non trovato");
    return;
  }

  // Event delegation per bottone aggiungi
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button.btn-success, button.btn-action");
    if (!btn) return;
    
    const purchasedId = btn.getAttribute("data-purchased-id");
    if (purchasedId) {
      openAddToStockModal(purchasedId);
    }
  });
}

/**
 * Setup checkbox select all
 * @param {Function} onSelectionChange - Callback quando cambia selezione
 */
export function setupSelectAllCheckbox(onSelectionChange) {
  const selectAllCheckbox = document.getElementById("selectAllFilaments");
  if (!selectAllCheckbox) return;

  selectAllCheckbox.addEventListener("change", (e) => {
    const checked = e.target.checked;
    document
      .querySelectorAll(".filament-select-checkbox")
      .forEach((cb) => {
        cb.checked = checked;
      });
    
    if (onSelectionChange) {
      onSelectionChange(checked);
    }
  });
}

/**
 * Setup pulsante elimina selezionati
 * @param {Function} deleteSelected - Callback per eliminazione multipla
 */
export function setupDeleteSelectedButton(deleteSelected) {
  const btn = document.getElementById("deleteSelectedButton");
  if (!btn) return;

  btn.addEventListener("click", deleteSelected);
}

// =============================================
// EVENTI MODALI
// =============================================

/**
 * Setup eventi modal overlay (chiusura)
 * @param {Object} callbacks - Funzioni callback {closeSettings, closeConsumption, closeEdit, closeAddToStock}
 */
export function setupModalOverlayEvents(callbacks) {
  const overlay = document.getElementById("modalOverlay");
  if (!overlay) return;

  overlay.addEventListener("click", (e) => {
    // Non chiudere se il click è dentro il modal dialog
    if (e.target.closest(".modal-dialog")) {
      return;
    }

    const settingsModal = document.getElementById("settingsModal");
    const consumptionModal = document.getElementById("consumptionModal");
    const editModal = document.getElementById("editFilamentModal");
    const addToStockModal = document.getElementById("addToStockModal");

    if (settingsModal && settingsModal.classList.contains("is-open")) {
      callbacks.closeSettings();
    } else if (consumptionModal && consumptionModal.classList.contains("is-open")) {
      callbacks.closeConsumption();
    } else if (editModal && editModal.classList.contains("is-open")) {
      callbacks.closeEdit();
    } else if (addToStockModal && addToStockModal.classList.contains("is-open")) {
      callbacks.closeAddToStock();
    }
  });
}

/**
 * Setup eventi modal consumo
 * @param {Object} callbacks - {close, apply}
 */
export function setupConsumptionModalEvents(callbacks) {
  const { close, apply } = callbacks;

  const closeBtn = document.getElementById("modalCloseButton");
  const cancelBtn = document.getElementById("modalCancelButton");
  const confirmBtn = document.getElementById("modalConfirmButton");

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (confirmBtn) confirmBtn.addEventListener("click", apply);
}

/**
 * Setup eventi modal edit filament
 * @param {Object} callbacks - {close, apply, updatePreview, updateRemaining}
 */
export function setupEditFilamentModalEvents(callbacks) {
  const { close, apply, updatePreview, updateRemaining } = callbacks;

  // Bottoni
  const closeBtn = document.getElementById("editModalCloseButton");
  const cancelBtn = document.getElementById("editModalCancelButton");
  const confirmBtn = document.getElementById("editModalConfirmButton");

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (confirmBtn) confirmBtn.addEventListener("click", apply);

  // Preview colore custom
  const colorCustom = document.getElementById("editColorCustom");
  if (colorCustom && updatePreview) {
    colorCustom.addEventListener("input", updatePreview);
  }

  // Aggiornamento peso residuo live
  if (updateRemaining) {
    const sealed = document.getElementById("editSpoolsSealed");
    const open = document.getElementById("editSpoolsOpen");
    const fraction = document.getElementById("editSpoolFraction");
    const unitWeight = document.getElementById("editUnitWeightInput");

    if (sealed) sealed.addEventListener("input", updateRemaining);
    if (open) open.addEventListener("input", updateRemaining);
    if (fraction) fraction.addEventListener("change", updateRemaining);
    if (unitWeight) unitWeight.addEventListener("input", updateRemaining);
  }
}

/**
 * Setup eventi modal add to stock
 * @param {Object} callbacks - {close, apply}
 */
export function setupAddToStockModalEvents(callbacks) {
  const { close, apply } = callbacks;

  const closeBtn = document.getElementById("addToStockModalClose");
  const cancelBtn = document.getElementById("addToStockModalCancel");
  const confirmBtn = document.getElementById("addToStockModalConfirm");

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (confirmBtn) confirmBtn.addEventListener("click", apply);
}

/**
 * Setup eventi modal settings
 * @param {Object} callbacks - {close, save}
 */
export function setupSettingsModalEvents(callbacks) {
  const { close, save } = callbacks;

  const closeBtn = document.getElementById("settingsCloseButton");
  const cancelBtn = document.getElementById("settingsCancelButton");
  const saveBtn = document.getElementById("settingsModalSave");
  const saveThresholdBtn = document.getElementById("saveThresholdButton");

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (saveBtn) saveBtn.addEventListener("click", save);
  if (saveThresholdBtn) saveThresholdBtn.addEventListener("click", save);
  
  // Setup pulsanti cancella dati
  const btnClearPurchased = document.getElementById("btnClearPurchasedOnly");
  const btnClearAvailable = document.getElementById("btnClearAvailableOnly");
  const btnClearAll = document.getElementById("btnClearAllData");
  
  if (btnClearPurchased && callbacks.clearPurchased) {
    btnClearPurchased.addEventListener("click", callbacks.clearPurchased);
  }
  
  if (btnClearAvailable && callbacks.clearAvailable) {
    btnClearAvailable.addEventListener("click", callbacks.clearAvailable);
  }
  
  if (btnClearAll && callbacks.clearAll) {
    btnClearAll.addEventListener("click", callbacks.clearAll);
  }
}

// =============================================
// EVENTI FORM
// =============================================

/**
 * Setup form aggiungi filamento
 * @param {Function} handleSubmit - Callback submit
 */
export function setupAddFilamentForm(handleSubmit) {
  const btn = document.getElementById("addFilamentButton");
  if (!btn) return;

  btn.addEventListener("click", handleSubmit);

  // Toggle custom brand
  const brandSelect = document.getElementById("addBrandSelect");
  const brandCustom = document.getElementById("addBrandCustom");
  
  if (brandSelect && brandCustom) {
    brandSelect.addEventListener("change", () => {
      if (brandSelect.value === "__custom__") {
        brandCustom.style.display = "block";
        brandCustom.focus();
      } else {
        brandCustom.style.display = "none";
        brandCustom.value = "";
      }
    });
  }

  // Toggle custom material
  const matSelect = document.getElementById("addMaterialSelect");
  const matCustom = document.getElementById("addMaterialCustom");
  
  if (matSelect && matCustom) {
    matSelect.addEventListener("change", () => {
      if (matSelect.value === "__custom__") {
        matCustom.style.display = "block";
        matCustom.focus();
      } else {
        matCustom.style.display = "none";
        matCustom.value = "";
      }
    });
  }

  // Calcolo automatico bobine totali
  const sealedInput = document.getElementById("addSealedSpoolsInput");
  const openInput = document.getElementById("addOpenSpoolsInput");
  const totalInput = document.getElementById("addSpoolsTotalInput");
  
  const updateTotal = () => {
    if (totalInput && sealedInput && openInput) {
      const sealed = parseInt(sealedInput.value || "0", 10);
      const open = parseInt(openInput.value || "0", 10);
      const total = isNaN(sealed) ? 0 : sealed + (isNaN(open) ? 0 : open);
      totalInput.value = total > 0 ? total : "";
    }
  };
  
  if (sealedInput) sealedInput.addEventListener("input", updateTotal);
  if (openInput) openInput.addEventListener("input", updateTotal);

  // Gestione unit weight preset
  const unitWeightPreset = document.getElementById("addUnitWeightPreset");
  const unitWeightInput = document.getElementById("addUnitWeightInput");
  
  if (unitWeightPreset && unitWeightInput) {
    unitWeightPreset.addEventListener("change", () => {
      if (unitWeightPreset.value === "__custom__") {
        unitWeightInput.style.display = "block";
        unitWeightInput.focus();
      } else {
        unitWeightInput.style.display = "none";
        unitWeightInput.value = "";
      }
    });
  }
}

/**
 * Setup form aggiungi filamento comprato
 * @param {Function} handleSubmit - Callback submit
 */
export function setupAddPurchasedForm(handleSubmit) {
  const btn = document.getElementById("addPurchasedButton");
  if (!btn) return;

  btn.addEventListener("click", handleSubmit);

  // Toggle custom brand
  const brandSelect = document.getElementById("addPurchasedBrand");
  const brandCustom = document.getElementById("addPurchasedBrandCustom");
  
  if (brandSelect && brandCustom) {
    brandSelect.addEventListener("change", () => {
      if (brandSelect.value === "__custom__") {
        brandCustom.style.display = "block";
        brandCustom.focus();
      } else {
        brandCustom.style.display = "none";
      }
    });
  }
}

/**
 * Setup bottoni import/export
 * @param {Object} callbacks - {exportJson, exportInvoices, importJson}
 */
export function setupImportExportButtons(callbacks) {
  const { exportJson, exportInvoices, importJson } = callbacks;

  // Export JSON magazzino
  const exportBtn = document.getElementById("exportJsonButton");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportJson);
  }

  // Export fatture
  const exportInvoicesBtn = document.getElementById("exportInvoicesButton");
  if (exportInvoicesBtn) {
    exportInvoicesBtn.addEventListener("click", exportInvoices);
  }

  // Import JSON
  const importBtn = document.getElementById("importJsonButton");
  const importInput = document.getElementById("importJsonInput");
  
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => {
      importInput.click();
    });
    
    if (importJson) {
      importInput.addEventListener("change", importJson);
    }
    
    // Toast info al click
    importInput.addEventListener("click", () => {
      console.log("Seleziona file JSON da importare");
    });
  }
}

// =============================================
// EVENTI FILTRI E RICERCA
// =============================================

/**
 * Setup filtri tabella magazzino
 * @param {Object} callbacks - {onFilterChange, onReset}
 */
export function setupStockFilters(callbacks) {
  const { onFilterChange, onReset } = callbacks;

  const brandFilter = document.getElementById("stockFilterBrand");
  const materialFilter = document.getElementById("stockFilterMaterial");
  const packagingFilter = document.getElementById("stockFilterPackaging");
  const resetBtn = document.getElementById("stockFilterReset");

  if (brandFilter) {
    brandFilter.addEventListener("change", (e) => {
      onFilterChange({ brand: e.target.value });
    });
  }

  if (materialFilter) {
    materialFilter.addEventListener("change", (e) => {
      onFilterChange({ material: e.target.value });
    });
  }

  if (packagingFilter) {
    packagingFilter.addEventListener("change", (e) => {
      onFilterChange({ packaging: e.target.value });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", onReset);
  }
}

/**
 * Setup filtri tabella comprati
 * @param {Object} callbacks - {onFilterChange, onReset}
 */
export function setupPurchasedFilters(callbacks) {
  const { onFilterChange, onReset } = callbacks;

  const brandFilter = document.getElementById("purchasedFilterBrand");
  const materialFilter = document.getElementById("purchasedFilterMaterial");
  const packagingFilter = document.getElementById("purchasedFilterPackaging");
  const resetBtn = document.getElementById("purchasedFilterReset");

  if (brandFilter) {
    brandFilter.addEventListener("change", (e) => {
      onFilterChange({ brand: e.target.value });
    });
  }

  if (materialFilter) {
    materialFilter.addEventListener("change", (e) => {
      onFilterChange({ material: e.target.value });
    });
  }

  if (packagingFilter) {
    packagingFilter.addEventListener("change", (e) => {
      onFilterChange({ packaging: e.target.value });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", onReset);
  }
}

/**
 * Setup barra ricerca con debounce
 * @param {Function} onSearch - Callback ricerca
 * @param {number} debounceMs - Millisecondi debounce (default 300)
 */
export function setupSearchBar(onSearch, debounceMs = 300) {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  let debounceTimeout = null;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      onSearch(e.target.value);
    }, debounceMs);
  });
}

// =============================================
// EVENTI ORDINAMENTO
// =============================================

/**
 * Setup ordinamento tabella (click su header)
 * @param {string} tableId - ID tabella
 * @param {Function} onSort - Callback(field, direction)
 * @param {Object} currentSort - Stato ordinamento corrente {field, direction}
 */
export function setupTableSorting(tableId, onSort, getCurrentSort) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = table.querySelectorAll("thead th[data-sort-field]");
  
  headers.forEach((th) => {
    // Rimuovi listener precedenti clonando l'elemento
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
    
    newTh.addEventListener("click", () => {
      const field = newTh.getAttribute("data-sort-field");
      const currentSort = getCurrentSort ? getCurrentSort() : { field: null, direction: "asc" };
      
      let direction = "asc";
      if (currentSort && currentSort.field === field) {
        direction = currentSort.direction === "asc" ? "desc" : "asc";
      }
      
      onSort(field, direction);
    });
  });
}

// =============================================
// EVENTI SEZIONI COLLAPSIBILI
// =============================================

/**
 * Setup toggle sezione comprati
 * @param {Function} onToggle - Callback toggle (optional)
 */
export function setupPurchasedSectionToggle(onToggle) {
  const toggleBtn = document.getElementById("togglePurchasedSection");
  const content = document.getElementById("purchasedSectionContent");
  
  if (!toggleBtn || !content) return;

  let isMinimized = false;
  
  toggleBtn.addEventListener("click", () => {
    isMinimized = !isMinimized;
    
    if (isMinimized) {
      content.style.display = "none";
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px;">
          <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Espandi</span>
      `;
    } else {
      content.style.display = "block";
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px;">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Minimizza</span>
      `;
    }
    
    if (onToggle) onToggle(isMinimized);
  });
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================

/**
 * Setup scorciatoie tastiera
 * @param {Object} callbacks - {closeModals, save, undo, redo, search}
 */
export function setupKeyboardShortcuts(callbacks) {
  const { closeModals, save, undo, redo, search } = callbacks;

  document.addEventListener("keydown", (e) => {
    // ESC - Chiudi modali
    if (e.key === "Escape") {
      if (closeModals) closeModals();
      return;
    }

    // Ctrl+S - Salva (previeni default browser)
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      if (save) save();
      return;
    }

    // Ctrl+Z - Undo
    if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (undo) undo();
      return;
    }

    // Ctrl+Y o Ctrl+Shift+Z - Redo
    if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "z")) {
      e.preventDefault();
      if (redo) redo();
      return;
    }

    // Ctrl+F - Focus ricerca
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      if (search) search();
      return;
    }
  });
}

// =============================================
// AUTO-SAVE
// =============================================

/**
 * Setup auto-save con debounce
 * @param {Function} saveFunction - Funzione di salvataggio
 * @param {number} intervalMs - Intervallo salvataggio periodico (default 30s)
 */
export function setupAutoSave(saveFunction, intervalMs = 30000) {
  let autoSaveIntervalId = null;

  // Salvataggio periodico
  function startPeriodicAutoSave() {
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
    }
    
    autoSaveIntervalId = setInterval(() => {
      saveFunction();
    }, intervalMs);
  }

  // Salvataggio before unload
  function setupBeforeUnloadSave() {
    window.addEventListener("beforeunload", () => {
      saveFunction();
    });

    // Salva anche quando la pagina perde focus
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        saveFunction();
      }
    });
  }

  startPeriodicAutoSave();
  setupBeforeUnloadSave();

  // Return cleanup function
  return () => {
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
    }
  };
}

// =============================================
// DRAG & DROP MODALI
// =============================================

/**
 * Setup drag & drop per rendere una modale trascinabile
 * @param {string} modalId - ID della modale
 * @param {string} handleSelector - Selettore dell'elemento da usare come "handle" (es. ".modal-header")
 */
export function setupModalDragging(modalId, handleSelector = ".modal-header") {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const header = modal.querySelector(handleSelector);
  if (!header) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  header.style.cursor = "move";

  header.addEventListener("mousedown", (e) => {
    // Non attivare drag se si clicca su un bottone
    if (e.target.closest("button")) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = modal.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;

    modal.style.position = "fixed";
    modal.style.left = initialX + "px";
    modal.style.top = initialY + "px";
    modal.style.transform = "none";
    modal.style.margin = "0";

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    modal.style.left = (initialX + deltaX) + "px";
    modal.style.top = (initialY + deltaY) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
    }
  });
}

// =============================================
// GESTIONE LOCATIONS
// =============================================

/**
 * Setup gestione lista posizioni (aggiungi/elimina/rinomina)
 * @param {Object} callbacks - {addLocation, deleteLocation, renameLocation}
 */
export function setupLocationsManagement(callbacks) {
  const { addLocation, deleteLocation, renameLocation } = callbacks;

  // Bottone aggiungi
  const addBtn = document.getElementById("addLocationButton");
  const input = document.getElementById("newLocationInput");

  console.log("🔧 setupLocationsManagement:", { addBtn: !!addBtn, input: !!input, addLocation: !!addLocation, renameLocation: !!renameLocation });

  if (addBtn && input && addLocation) {
    // Rimuovi vecchi listener clonando il bottone
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    newAddBtn.addEventListener("click", () => {
      console.log("📍 Click su Aggiungi posizione");
      const value = input.value.trim();
      if (value) {
        addLocation(value);
        input.value = "";
      }
    });

    // Aggiungi anche con Enter (usa un nuovo input per evitare duplicati)
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    newInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const value = newInput.value.trim();
        if (value) {
          addLocation(value);
          newInput.value = "";
        }
      }
    });
  }

  // Delegazione per bottoni elimina e rinomina - usa il modal come container
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal) {
    // Listener delegato sul modal (non clonare, aggiungi solo se non esiste)
    if (!settingsModal.hasAttribute("data-locations-listener")) {
      settingsModal.setAttribute("data-locations-listener", "true");
      
      // Elimina posizione (click sul bottone X)
      if (deleteLocation) {
        settingsModal.addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-location-index]");
          if (!btn) return;

          console.log("🗑️ Click su Elimina posizione");
          const index = parseInt(btn.getAttribute("data-location-index"), 10);
          if (!isNaN(index)) {
            deleteLocation(index);
          }
        });
      }
      
      // Rinomina posizione (Enter o blur sull'input)
      if (renameLocation) {
        // Enter per salvare
        settingsModal.addEventListener("keypress", (e) => {
          const input = e.target.closest("input[data-location-rename]");
          if (!input || e.key !== "Enter") return;
          
          e.preventDefault();
          const index = parseInt(input.getAttribute("data-location-rename"), 10);
          if (!isNaN(index)) {
            console.log("✏️ Rinomina posizione (Enter):", index, input.value);
            renameLocation(index, input.value);
            input.blur();
          }
        });
        
        // Blur per salvare (quando si clicca fuori)
        settingsModal.addEventListener("focusout", (e) => {
          const input = e.target.closest("input[data-location-rename]");
          if (!input) return;
          
          const index = parseInt(input.getAttribute("data-location-rename"), 10);
          if (!isNaN(index)) {
            console.log("✏️ Rinomina posizione (blur):", index, input.value);
            renameLocation(index, input.value);
          }
        });
      }
    }
  }
}

// =============================================
// GESTIONE STORICO CONSUMI
// =============================================

/**
 * Setup gestione storico consumi
 * @param {Object} callbacks - {deleteEntry, clearAll}
 */
export function setupConsumptionHistory(callbacks) {
  const { deleteEntry, clearAll } = callbacks;

  // Delegazione per elimina singola entry
  const container = document.getElementById("consumptionHistoryList");
  if (container && deleteEntry) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-entry-id]");
      if (!btn) return;

      const entryId = btn.getAttribute("data-entry-id");
      if (entryId) {
        deleteEntry(entryId);
      }
    });
  }

  // Bottone cancella tutto
  const clearBtn = document.getElementById("clearHistoryButton");
  if (clearBtn && clearAll) {
    clearBtn.addEventListener("click", clearAll);
  }
}

// =============================================
// DROPDOWN CUSTOM
// =============================================

/**
 * Setup dropdown custom (per colori, marche, ecc)
 * @param {string} wrapperId - ID wrapper dropdown
 * @param {Function} onSelect - Callback(value)
 */
export function setupCustomDropdown(wrapperId, onSelect) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const trigger = wrapper.querySelector(".dropdown-trigger");
  const menu = wrapper.querySelector(".dropdown-menu");
  const searchInput = menu?.querySelector("input[type='text']");
  const options = menu?.querySelectorAll(".dropdown-option");

  if (!trigger || !menu) return;

  let isOpen = false;

  // Toggle menu
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    menu.style.display = isOpen ? "block" : "none";
    
    if (isOpen && searchInput) {
      searchInput.focus();
    }
  });

  // Ricerca
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      options.forEach((opt) => {
        const text = opt.textContent.toLowerCase();
        opt.style.display = text.includes(term) ? "flex" : "none";
      });
    });

    // Previeni chiusura al click su input
    searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // Selezione opzione
  options.forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = opt.getAttribute("data-value");
      
      if (onSelect) {
        onSelect(value);
      }

      // Chiudi menu
      isOpen = false;
      menu.style.display = "none";
    });
  });

  // Chiudi cliccando fuori
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      isOpen = false;
      menu.style.display = "none";
    }
  });
}

// =============================================
// THEME TOGGLE
// =============================================

/**
 * Setup toggle tema dark/light
 * @param {Function} onThemeChange - Callback(theme)
 */
export function setupThemeToggle(onThemeChange) {
  const toggleBtn = document.getElementById("themeToggleButton");
  const label = document.getElementById("themeToggleLabel");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    
    if (label) {
      label.textContent = newTheme === "dark" ? "Tema chiaro" : "Tema scuro";
    }
    
    if (onThemeChange) {
      onThemeChange(newTheme);
    }

    // Salva preferenza
    localStorage.setItem("registroFilamentiTheme", newTheme);
  });

  // Carica tema salvato
  const savedTheme = localStorage.getItem("registroFilamentiTheme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  if (label) {
    label.textContent = savedTheme === "dark" ? "Tema chiaro" : "Tema scuro";
  }
}

// =============================================
// HEADER BUTTONS
// =============================================

/**
 * Setup pulsanti header (refresh, undo, redo, settings)
 */
export function setupHeaderButtons(callbacks) {
  const { refresh, undo, redo, settings } = callbacks || {};
  
  // Refresh app button
  const refreshBtn = document.getElementById("refreshAppButton");
  if (refreshBtn && refresh) {
    // Rimuovi listener precedenti clonando il bottone
    const newBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
    newBtn.addEventListener("click", refresh);
  }
  
  // Undo button (placeholder - implementare sistema undo/redo completo)
  const undoBtn = document.getElementById("undoButton");
  if (undoBtn && undo) {
    const newBtn = undoBtn.cloneNode(true);
    undoBtn.parentNode.replaceChild(newBtn, undoBtn);
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      undo();
    });
  }
  
  // Redo button (placeholder - implementare sistema undo/redo completo)
  const redoBtn = document.getElementById("redoButton");
  if (redoBtn && redo) {
    const newBtn = redoBtn.cloneNode(true);
    redoBtn.parentNode.replaceChild(newBtn, redoBtn);
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      redo();
    });
  }
  
  // Settings button
  const settingsBtn = document.getElementById("settingsButton");
  if (settingsBtn && settings) {
    const newBtn = settingsBtn.cloneNode(true);
    settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
    newBtn.addEventListener("click", settings);
  }
}

// =============================================
// TOOLTIP
// =============================================

/**
 * Setup tooltip su elementi con data-tooltip
 */
export function setupTooltips() {
  const elements = document.querySelectorAll("[data-tooltip]");
  
  elements.forEach((el) => {
    let tooltip = null;

    el.addEventListener("mouseenter", () => {
      const text = el.getAttribute("data-tooltip");
      if (!text) return;

      tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.textContent = text;
      document.body.appendChild(tooltip);

      const rect = el.getBoundingClientRect();
      tooltip.style.position = "fixed";
      tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + "px";
      tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + "px";
    });

    el.addEventListener("mouseleave", () => {
      if (tooltip && tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
        tooltip = null;
      }
    });
  });
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================

/**
 * Setup sistema toast per notifiche
 * @param {string} containerId - ID contenitore toast (default: crea automaticamente)
 */
export function setupToastContainer(containerId = "toastContainer") {
  let container = document.getElementById(containerId);
  
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.cssText = `
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;
    document.body.appendChild(container);
  }

  return container;
}

/**
 * Mostra toast notification
 * @param {string} message - Messaggio
 * @param {string} type - Tipo (success, error, warning, info)
 * @param {number} duration - Durata in ms (default 3000)
 */
export function showToast(message, type = "info", duration = 3000) {
  const container = setupToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toast.style.cssText = `
    padding: 0.75rem 1rem;
    border-radius: 8px;
    color: white;
    font-size: 0.9rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease;
    cursor: pointer;
  `;

  // Colori per tipo
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };
  toast.style.background = colors[type] || colors.info;

  container.appendChild(toast);

  // Click per chiudere
  toast.addEventListener("click", () => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  });

  // Auto-remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }, duration);
}

// =============================================
// SETUP COMPLETO
// =============================================

/**
 * Inizializza tutti gli eventi dell'applicazione
 * @param {Object} handlers - Oggetto con tutti gli handler
 * @returns {Function} - Cleanup function
 */
export function setupAllEvents(handlers) {
  const {
    // Tabelle
    openEditModal,
    deleteFilament,
    openAddToStockModal,
    deleteSelected,
    
    // Modali
    closeSettings,
    closeConsumption,
    closeEdit,
    closeAddToStock,
    applyConsumption,
    applyEdit,
    applyAddToStock,
    saveSettings,
    
    // Form
    addFilament,
    addPurchased,
    exportJson,
    exportInvoices,
    importJson,
    
    // Filtri
    onStockFilterChange,
    onStockFilterReset,
    onPurchasedFilterChange,
    onPurchasedFilterReset,
    onSearch,
    
    // Ordinamento
    onStockSort,
    onPurchasedSort,
    
    // Locations
    addLocation,
    deleteLocation,
    renameLocation,
    
    // History
    deleteHistoryEntry,
    clearHistory,
    
    // Auto-save
    autoSave,
    
    // Keyboard
    closeAllModals,
    save,
    
    // Theme
    onThemeChange,
    
    // Header buttons
    refreshApp,
    undo,
    redo,
    openSettings,
    
    // Settings clear functions
    clearPurchasedData,
    clearAvailableData,
    clearAllData
  } = handlers;

  // Setup tutti gli eventi
  setupFilamentTableEvents({ openEditModal, deleteFilament });
  setupPurchasedTableEvents({ openAddToStockModal });
  setupSelectAllCheckbox();
  setupDeleteSelectedButton(deleteSelected);
  
  setupModalOverlayEvents({
    closeSettings,
    closeConsumption,
    closeEdit,
    closeAddToStock
  });
  
  setupConsumptionModalEvents({
    close: closeConsumption,
    apply: applyConsumption
  });
  
  setupEditFilamentModalEvents({
    close: closeEdit,
    apply: applyEdit
  });
  
  setupAddToStockModalEvents({
    close: closeAddToStock,
    apply: applyAddToStock
  });
  
  setupSettingsModalEvents({
    close: closeSettings,
    save: saveSettings,
    clearPurchased: clearPurchasedData,
    clearAvailable: clearAvailableData,
    clearAll: clearAllData
  });
  
  setupAddFilamentForm(addFilament);
  setupAddPurchasedForm(addPurchased);
  
  setupImportExportButtons({
    exportJson,
    exportInvoices,
    importJson
  });
  
  setupStockFilters({
    onFilterChange: onStockFilterChange,
    onReset: onStockFilterReset
  });
  
  setupPurchasedFilters({
    onFilterChange: onPurchasedFilterChange,
    onReset: onPurchasedFilterReset
  });
  
  setupSearchBar(onSearch);
  
  // Setup sorting con funzione che restituisce stato corrente
  if (onStockSort) {
    setupTableSorting("filamentTable", onStockSort, () => {
      return window.stockSortState || { field: null, direction: "asc" };
    });
  }
  
  if (onPurchasedSort) {
    setupTableSorting("purchasedTable", onPurchasedSort, () => {
      return window.purchasedSortState || { field: null, direction: "asc" };
    });
  }
  
  setupPurchasedSectionToggle();
  
  setupKeyboardShortcuts({
    closeModals: closeAllModals,
    save
  });
  
  if (addLocation && deleteLocation) {
    setupLocationsManagement({ addLocation, deleteLocation, renameLocation });
  }
  
  if (deleteHistoryEntry && clearHistory) {
    setupConsumptionHistory({
      deleteEntry: deleteHistoryEntry,
      clearAll: clearHistory
    });
  }
  
  if (onThemeChange) {
    setupThemeToggle(onThemeChange);
  }
  
  setupTooltips();
  
  // Setup pulsanti header (usa le funzioni dai parametri)
  if (refreshApp || undo || redo || openSettings) {
    setupHeaderButtons({
      refresh: refreshApp,
      undo: undo,
      redo: redo,
      settings: openSettings
    });
  }
  
  // Auto-save
  let cleanupAutoSave = null;
  if (autoSave) {
    cleanupAutoSave = setupAutoSave(autoSave);
  }
  
  // Drag modali
  setupModalDragging("editFilamentModal");
  setupModalDragging("consumptionModal");
  setupModalDragging("addToStockModal");
  setupModalDragging("settingsModal");

  // Return cleanup
  return () => {
    if (cleanupAutoSave) {
      cleanupAutoSave();
    }
  };
}

// =============================================
// UTILITY
// =============================================

/**
 * Debounce function
 * @param {Function} func - Funzione da eseguire
 * @param {number} wait - Millisecondi di attesa
 * @returns {Function} - Funzione debounced
 */
export function debounce(func, wait) {
  let timeout = null;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Funzione da eseguire
 * @param {number} limit - Limite in millisecondi
 * @returns {Function} - Funzione throttled
 */
export function throttle(func, limit) {
  let inThrottle = false;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

