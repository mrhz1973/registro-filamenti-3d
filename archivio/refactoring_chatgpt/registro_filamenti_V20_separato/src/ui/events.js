/**
 * ui/events.js - Gestione eventi UI
 * 
 * Setup event listeners, gestione modali, toast, ecc.
 */

/**
 * Debounce utility
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Mostra toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
    </div>
    <div class="toast-message">
      <div class="toast-title">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close-btn" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-remove dopo 3 secondi
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Setup tutti gli event listeners
 */
export function setupAllEvents(callbacks) {
  setupTableEvents(callbacks);
  setupFilterEvents(callbacks);
  setupModalEvents(callbacks);
  setupFormEvents(callbacks);
  setupKeyboardShortcuts(callbacks);
  setupThemeToggle();
  setupHeaderButtons(callbacks);
}

/**
 * Eventi tabelle (sort, select)
 */
function setupTableEvents(callbacks) {
  // Sort headers
  document.querySelectorAll('#filamentTable th[data-sort-field]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort-field');
      if (callbacks.onSort) {
        callbacks.onSort(field);
      }
    });
  });

  // Select all checkbox
  const selectAll = document.getElementById('selectAllFilaments');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.row-checkbox');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
  }
}

/**
 * Eventi filtri
 */
function setupFilterEvents(callbacks) {
  // Stock filters
  const brandFilter = document.getElementById('stockFilterBrand');
  if (brandFilter) {
    brandFilter.addEventListener('change', (e) => {
      if (callbacks.applyStockFilter) {
        callbacks.applyStockFilter({ brand: e.target.value });
      }
    });
  }

  const materialFilter = document.getElementById('stockFilterMaterial');
  if (materialFilter) {
    materialFilter.addEventListener('change', (e) => {
      if (callbacks.applyStockFilter) {
        callbacks.applyStockFilter({ material: e.target.value });
      }
    });
  }

  const packagingFilter = document.getElementById('stockFilterPackaging');
  if (packagingFilter) {
    packagingFilter.addEventListener('change', (e) => {
      if (callbacks.applyStockFilter) {
        callbacks.applyStockFilter({ packaging: e.target.value });
      }
    });
  }

  // Reset filters
  const resetBtn = document.getElementById('resetStockFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (callbacks.resetStockFilters) {
        callbacks.resetStockFilters();
      }
    });
  }

  // Search input (debounced)
  const searchInput = document.getElementById('stockSearchInput');
  if (searchInput) {
    const debouncedSearch = debounce((value) => {
      if (callbacks.handleSearch) {
        callbacks.handleSearch(value);
      }
    }, 300);

    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
      const clearBtn = document.getElementById('stockSearchClear');
      if (clearBtn) {
        clearBtn.style.display = e.target.value ? 'flex' : 'none';
      }
    });

    // Clear button
    const clearBtn = document.getElementById('stockSearchClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        if (callbacks.handleSearch) {
          callbacks.handleSearch('');
        }
      });
    }
  }
}

/**
 * Eventi modali
 */
function setupModalEvents(callbacks) {
  // Overlay click
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (callbacks.closeAllModals) {
          callbacks.closeAllModals();
        }
      }
    });
  }

  // Close buttons
  document.querySelectorAll('.modal-close-btn, .modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) {
        modal.classList.remove('is-open');
        if (overlay) overlay.classList.remove('is-open');
      }
    });
  });
}

/**
 * Eventi form
 */
function setupFormEvents(callbacks) {
  // Add filament button
  const addBtn = document.getElementById('addFilamentButton');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (callbacks.handleAddFilament) {
        callbacks.handleAddFilament();
      }
    });
  }

  // Import/Export buttons
  const importBtn = document.getElementById('importJsonButton');
  const importInput = document.getElementById('importJsonInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && callbacks.handleImportJson) {
        const reader = new FileReader();
        reader.onload = (event) => {
          callbacks.handleImportJson(event.target.result);
        };
        reader.readAsText(file);
      }
    });
  }

  const exportBtn = document.getElementById('exportJsonButton');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (callbacks.handleExportJson) {
        callbacks.handleExportJson();
      }
    });
  }
}

/**
 * Keyboard shortcuts
 */
function setupKeyboardShortcuts(callbacks) {
  document.addEventListener('keydown', (e) => {
    // ESC chiude modali
    if (e.key === 'Escape') {
      if (callbacks.closeAllModals) {
        callbacks.closeAllModals();
      }
    }

    // Ctrl+S salva
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (callbacks.triggerAutoSave) {
        callbacks.triggerAutoSave();
        showToast('Dati salvati', 'success');
      }
    }
  });
}

/**
 * Theme toggle
 */
function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggleButton');
  if (!themeToggle) return;

  // Carica tema salvato
  const savedTheme = localStorage.getItem('registroFilamentiTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeLabel(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('registroFilamentiTheme', newTheme);
    updateThemeLabel(newTheme);
  });
}

function updateThemeLabel(theme) {
  const label = document.getElementById('themeToggleLabel');
  if (label) {
    label.textContent = theme === 'light' ? 'Tema scuro' : 'Tema chiaro';
  }
}

/**
 * Setup header buttons
 */
function setupHeaderButtons(callbacks) {
  // Refresh button
  const refreshBtn = document.getElementById('refreshAppButton');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (callbacks.refreshApp) {
        callbacks.refreshApp();
      }
    });
  }

  // Settings button
  const settingsBtn = document.getElementById('settingsButton');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (callbacks.openSettings) {
        callbacks.openSettings();
      }
    });
  }

  // Undo/Redo buttons
  const undoBtn = document.getElementById('undoButton');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (callbacks.undo) {
        callbacks.undo();
      }
    });
  }

  const redoBtn = document.getElementById('redoButton');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      if (callbacks.redo) {
        callbacks.redo();
      }
    });
  }
}

export default {
  setupAllEvents,
  showToast,
  debounce
};












