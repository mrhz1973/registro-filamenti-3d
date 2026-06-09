/**
 * ui/render.js - Rendering UI
 * 
 * Funzioni per renderizzare dashboard, tabelle, filtri, ecc.
 */

import { isLowStock } from '../domain/filaments.js';

/**
 * Formatta numero con separatori migliaia
 */
export function formatNumber(num, decimals = 0) {
  if (num == null || isNaN(num)) return "0";
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * Formatta valuta
 */
export function formatCurrency(num) {
  if (num == null || isNaN(num)) return "€ 0,00";
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(num);
}

/**
 * Escape HTML per prevenire XSS
 */
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Renderizza dashboard con statistiche
 */
export function renderDashboard(stats, threshold) {
  const totalWeightEl = document.getElementById("totalRemainingGramsValue");
  const totalSpoolsEl = document.getElementById("totalSpoolsValue");
  const totalUsedEl = document.getElementById("totalUsedGramsValue");
  const lowStockEl = document.getElementById("lowStockCountValue");

  if (totalWeightEl) {
    totalWeightEl.textContent = formatNumber(stats.totalWeight, 0) + " g";
  }
  if (totalSpoolsEl) {
    totalSpoolsEl.textContent = formatNumber(stats.totalSpools, 0);
  }
  if (totalUsedEl) {
    totalUsedEl.textContent = formatNumber(stats.totalUsedGrams || 0, 0) + " g";
  }
  if (lowStockEl) {
    lowStockEl.textContent = formatNumber(stats.lowStockCount || 0, 0);
  }
}

/**
 * Renderizza tabella filamenti magazzino
 */
export function renderFilamentTable(filaments, sortState, filters, searchQuery, threshold, callbacks) {
  const tbody = document.getElementById("filamentTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Applica filtri e ricerca
  let filtered = [...filaments];

  if (filters.brand) {
    filtered = filtered.filter(f => f.brand === filters.brand);
  }
  if (filters.material) {
    filtered = filtered.filter(f => f.material === filters.material);
  }
  if (filters.packaging) {
    filtered = filtered.filter(f => f.packaging === filters.packaging);
  }

  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(f => {
      const searchable = [
        f.brand, f.material, f.variant, f.supplier, f.location, f.notes
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }

  // Ordina
  if (sortState.field) {
    filtered = sortFilaments(filtered, sortState.field, sortState.direction);
  }

  // Aggiorna indicatori sort
  document.querySelectorAll("#filamentTable th[data-sort-field]").forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.getAttribute("data-sort-field") === sortState.field) {
      th.classList.add(sortState.direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });

  // Render empty state
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 15;
    const hasFilters = filters.brand || filters.material || filters.packaging || searchQuery;
    td.innerHTML = hasFilters
      ? '<div class="empty-state"><div class="empty-state-title">Nessun risultato</div><div class="empty-state-text">Prova a modificare i filtri</div></div>'
      : '<div class="empty-state"><div class="empty-state-title">Magazzino vuoto</div><div class="empty-state-text">Aggiungi filamenti o importa JSON</div></div>';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Render righe
  filtered.forEach(f => {
    const tr = document.createElement("tr");
    const isLow = isLowStock(f, threshold);
    if (isLow) {
      tr.classList.add("low-stock-row");
    }

    const locations = f.spools_locations || [];
    const uniqueLocations = [...new Set(locations.filter(l => l))];
    const locationText = uniqueLocations.length === 0
      ? "—"
      : uniqueLocations.length === 1
        ? escapeHtml(uniqueLocations[0])
        : `${uniqueLocations.length} posizioni`;

    tr.innerHTML = `
      <td class="select-column">
        <input type="checkbox" class="row-checkbox" data-id="${escapeHtml(f.id)}" />
      </td>
      <td>${escapeHtml(f.brand)}</td>
      <td>${escapeHtml(f.material)}</td>
      <td>${escapeHtml(f.variant)}</td>
      <td>${escapeHtml(f.color_code || "")}</td>
      <td>${f.packaging === "refill" ? "♻️" : "🎡"}</td>
      <td style="text-align:center;">${f.sealed_spools + f.open_spools}</td>
      <td style="text-align:center;">${f.sealed_spools}</td>
      <td style="text-align:center;">${f.open_spools}</td>
      <td style="text-align:center;">${formatNumber(f.unit_weight)}</td>
      <td style="text-align:center;">${formatNumber(f.total_weight)}</td>
      <td style="text-align:center;">${formatNumber(f.remaining_weight)}</td>
      <td>
        <div class="bar-outer" style="width:100%;height:8px;">
          <div class="bar-inner" style="width:${Math.min(100, (f.remaining_weight / f.total_weight) * 100)}%;background:${isLow ? 'var(--danger)' : 'var(--success)'};"></div>
        </div>
      </td>
      <td style="text-align:center;">${f.unit_price ? formatCurrency(f.unit_price) : "—"}</td>
      <td>${locationText}</td>
      <td class="actions">
        <button class="btn-action btn-edit" data-id="${escapeHtml(f.id)}" title="Modifica">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>Modifica</span>
        </button>
        <button class="btn-action btn-consume" data-id="${escapeHtml(f.id)}" title="Consuma">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Consuma</span>
        </button>
        <button class="btn-action btn-danger" data-id="${escapeHtml(f.id)}" title="Elimina">
          <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>Elimina</span>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach event listeners
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onEdit(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-consume').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onConsume(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => callbacks.onDelete(btn.dataset.id));
  });
}

/**
 * Ordina filamenti
 */
function sortFilaments(filaments, field, direction) {
  return [...filaments].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    if (typeof aVal === "string") {
      const cmp = aVal.localeCompare(bVal);
      return direction === "asc" ? cmp : -cmp;
    }
    const cmp = aVal - bVal;
    return direction === "asc" ? cmp : -cmp;
  });
}

/**
 * Popola opzioni filtri
 */
export function populateFilterOptions(filaments, purchasedFilaments) {
  // Brand filter - stock
  const stockBrandSelect = document.getElementById("stockFilterBrand");
  if (stockBrandSelect) {
    const brands = [...new Set(filaments.map(f => f.brand).filter(Boolean))].sort();
    stockBrandSelect.innerHTML = '<option value="">Tutte le marche</option>' +
      brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  }

  // Brand filter - purchased
  const purchasedBrandSelect = document.getElementById("purchasedFilterBrand");
  if (purchasedBrandSelect) {
    const brands = [...new Set(purchasedFilaments.map(f => f.brand).filter(Boolean))].sort();
    purchasedBrandSelect.innerHTML = '<option value="">Tutte le marche</option>' +
      brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  }

  // Material filter - stock
  const stockMaterialSelect = document.getElementById("stockFilterMaterial");
  if (stockMaterialSelect) {
    const materials = [...new Set(filaments.map(f => f.material).filter(Boolean))].sort();
    stockMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>' +
      materials.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }

  // Material filter - purchased
  const purchasedMaterialSelect = document.getElementById("purchasedFilterMaterial");
  if (purchasedMaterialSelect) {
    const materials = [...new Set(purchasedFilaments.map(f => f.material).filter(Boolean))].sort();
    purchasedMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>' +
      materials.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }
}

/**
 * Renderizza lista posizioni nelle impostazioni
 */
export function renderLocationsList(locationList, callbacks) {
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
    renameBtn.addEventListener('click', () => {
      const newName = input.value.trim();
      if (newName && newName !== location && callbacks.renameLocation) {
        callbacks.renameLocation(location, newName);
      }
    });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger btn-xs";
    deleteBtn.dataset.locationDelete = index;
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <span>Elimina</span>
    `;
    deleteBtn.addEventListener('click', () => {
      if (callbacks.deleteLocation) {
        callbacks.deleteLocation(location);
      }
    });
    
    item.appendChild(input);
    item.appendChild(renameBtn);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  });
}

export default {
  formatNumber,
  formatCurrency,
  renderDashboard,
  renderFilamentTable,
  populateFilterOptions,
  renderLocationsList
};

