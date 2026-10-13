  const STORAGE_KEY = "registroFilamentiState_v3";
  // Escape solo in uscita: i dati originali restano testo, anche se contengono HTML.
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  const VERSION_KEY = "registroFilamentiAppVersion";
  const INITIAL_VERSION = "V.104";
  let APP_VERSION = INITIAL_VERSION;
  // Esponi APP_VERSION globalmente per permettere aggiornamento automatico della versione nell'HTML
  if (typeof window !== 'undefined') {
    window.APP_VERSION = APP_VERSION;
  }
  
  // Salva la posizione di scroll prima di aprire un modal per ripristinarla alla chiusura
  let savedScrollPosition = { top: 0, left: 0 };
  const UNDO_STACK_KEY = "registroFilamentiUndoStack";
  const REDO_STACK_KEY = "registroFilamentiRedoStack";
  const LOCATION_LIST_KEY = "registroFilamentiLocations";
  const LOW_STOCK_THRESHOLD_KEY = "registroFilamentiLowStockThreshold";

  // Sistema Undo/Redo
  let undoStack = [];
  let redoStack = [];
  const MAX_UNDO_HISTORY = 50; // Massimo 50 azioni nella cronologia

  // Salva gli stack undo/redo nel localStorage
  function saveUndoRedoStacks() {
    autoSave(); // Gli stack sono salvati insieme al registro, senza chiavi divergenti.
  }

  function loadUndoRedoStacks() {
    // loadState ha già ripristinato gli stack validati dello stesso snapshot.
  }

  // Funzione per riprodurre un suono di conferma
  function playSuccessSound() {
    try {
      // Crea o riusa il contesto audio (alcuni browser richiedono interazione utente)
      let audioContext = window.successAudioContext;
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.successAudioContext = audioContext;
      }
      
      // Se il contesto è sospeso (richiede interazione utente), prova a riprenderlo
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          // Se non riesce, ignora silenziosamente
          return;
        });
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Suono breve e piacevole (frequenza 800Hz, durata 200ms, volume più alto)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Se l'audio non è supportato, ignora silenziosamente
      console.debug("Audio non supportato:", e);
    }
  }
  const CONSUMPTION_HISTORY_KEY = "registroFilamentiConsumptionHistory";

  // Polyfill per console.assert (non disponibile in tutti i browser)
  if (typeof console.assert !== "function") {
    console.assert = function(condition, message) {
      if (!condition) {
        console.error("Assertion failed:", message);
      }
    };
  }
  const THEME_KEY = "registroFilamentiTheme";
  const BRAND_LIST_KEY = "registroFilamentiBrands";
  const MATERIAL_LIST_KEY = "registroFilamentiMaterials";
  const COLOR_LIST_KEY = "registroFilamentiColors";

  let filaments = [];
  let purchasedFilaments = [];
  let brandList = [];
  let materialList = [];
  let colorList = [];
  let locationList = ["box Ikea", "Box", "scaffale 1", "scaffale 5", "scaffale 6"]; // Posizioni di default
  let currentSearch = "";
  let sortState = { field: null, direction: "asc" };
  let purchasedSortState = { field: null, direction: "asc" };
  let pendingPurchasedTransfer = null;
  
  // Filtri per tabella magazzino disponibile
  let stockFilters = { brand: [], material: [], packaging: [] }; // Array per selezione multipla
  // Filtri per tabella comprati
  let purchasedFilters = { brand: "", material: "", packaging: "" };
  // Storico consumi
  let consumptionHistory = [];

  // Stato UI delle finestre: nessuna modifica ai dati del registro.
  const modalStack = [];
  const modalBackgroundState = new Map();
  let modalBodyOverflow = "";

  function modalFocusableElements(modal) {
    const selector = "button, input:not([type='hidden']), select, textarea, a[href], [tabindex='0']";
    const roots = [modal];
    if (activeColorDropdown && modal.contains(activeColorDropdown)) roots.push(activeColorDropdown._colorMenu);
    return roots.flatMap(root => root ? Array.from(root.querySelectorAll(selector)) : [])
      .filter(el => !el.disabled && !el.closest("[hidden], [inert]") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
  }

  function openModalCentered(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById("modalOverlay");
    if (!modal || modal.classList.contains("is-open")) return;
    if (activeColorDropdown) closeColorDropdown(activeColorDropdown);
    if (activeMultiSelectDropdown) activeMultiSelectDropdown.close();
    if (modalStack.length === 0) {
      savedScrollPosition = { top: window.scrollY, left: window.scrollX };
      modalBodyOverflow = document.body.style.overflow;
      document.querySelectorAll("body > header, body > main").forEach(el => {
        modalBackgroundState.set(el, el.inert);
        el.inert = true;
      });
      document.body.style.overflow = "hidden";
    }
    const previous = modalStack[modalStack.length - 1];
    if (previous) previous.modal.inert = true;
    modalStack.push({ modal, opener: document.activeElement });
    resetModalPosition(modalId);
    modal.hidden = false;
    modal.inert = false;
    modal.setAttribute("aria-modal", "true");
    modal.classList.add("is-open");
    if (overlay) { overlay.hidden = false; overlay.classList.add("is-open"); }
    requestAnimationFrame(() => {
      if (!modal.classList.contains("is-open")) return;
      resetModalPosition(modalId);
      (modalFocusableElements(modal)[0] || modal).focus({ preventScroll: true });
    });
  }

  function closeModalCentered(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains("is-open")) return;
    if (activeColorDropdown && modal.contains(activeColorDropdown)) closeColorDropdown(activeColorDropdown);
    const index = modalStack.findIndex(entry => entry.modal === modal);
    const entry = index >= 0 ? modalStack.splice(index, 1)[0] : null;
    modal.classList.remove("is-open");
    modal.hidden = true;
    modal.inert = true;
    modal.setAttribute("aria-modal", "false");
    resetModalPosition(modalId);
    const previous = modalStack[modalStack.length - 1];
    if (previous) {
      previous.modal.inert = false;
    } else {
      const overlay = document.getElementById("modalOverlay");
      if (overlay) { overlay.classList.remove("is-open"); overlay.hidden = true; }
      modalBackgroundState.forEach((wasInert, el) => { el.inert = wasInert; });
      modalBackgroundState.clear();
      document.body.style.overflow = modalBodyOverflow;
      window.scrollTo({ top: savedScrollPosition.top, left: savedScrollPosition.left, behavior: "instant" });
    }
    const opener = entry && entry.opener;
    if (opener && opener.isConnected && !opener.closest("[hidden], [inert]")) {
      opener.focus({ preventScroll: true });
    } else if (previous) {
      (modalFocusableElements(previous.modal)[0] || previous.modal).focus({ preventScroll: true });
    }
  }

  function initDraggableModals() {
    document.querySelectorAll(".modal").forEach(modal => {
      if (modal.dataset.uiReady) return;
      modal.dataset.uiReady = "true";
      modal.hidden = !modal.classList.contains("is-open");
      modal.inert = modal.hidden;
      modal.tabIndex = -1;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", String(!modal.hidden));
      const title = modal.querySelector(".modal-title");
      if (title) { title.id ||= modal.id + "Title"; modal.setAttribute("aria-labelledby", title.id); }
      modal.querySelectorAll(".modal-close-btn, .modal-close").forEach(button => button.setAttribute("aria-label", "Chiudi finestra"));
      modal.addEventListener("click", event => { if (event.target === modal) closeModalCentered(modal.id); });
      const dialog = modal.querySelector(".modal-dialog");
      const header = modal.querySelector(".modal-header");
      if (!dialog || !header) return;
      let drag = null;
      header.addEventListener("pointerdown", event => {
        if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) return;
        const rect = dialog.getBoundingClientRect();
        drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        if (!dialog.classList.contains("is-positioned")) dialog._originalWidth = dialog.style.width;
        dialog.classList.add("is-positioned", "is-dragging");
        dialog.style.width = rect.width + "px";
        dialog.style.left = rect.left + "px";
        dialog.style.top = rect.top + "px";
        header.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      header.addEventListener("pointermove", event => {
        if (!drag) return;
        const rect = dialog.getBoundingClientRect();
        dialog.style.left = Math.max(0, Math.min(drag.left + event.clientX - drag.x, innerWidth - rect.width)) + "px";
        dialog.style.top = Math.max(0, Math.min(drag.top + event.clientY - drag.y, innerHeight - rect.height)) + "px";
      });
      const endDrag = () => { drag = null; dialog.classList.remove("is-dragging"); };
      header.addEventListener("pointerup", endDrag);
      header.addEventListener("pointercancel", endDrag);
      header.addEventListener("lostpointercapture", endDrag);
    });
  }

  function resetModalPosition(modalId) {
    const modal = document.getElementById(modalId);
    const dialog = modal && modal.querySelector(".modal-dialog");
    if (!dialog) return;
    if (dialog.classList.contains("is-positioned")) dialog.style.width = dialog._originalWidth || "";
    dialog.classList.remove("is-positioned", "is-dragging");
    ["position", "left", "top", "right", "bottom", "margin"].forEach(name => dialog.style.removeProperty(name));
    modal.scrollTop = 0;
    const body = modal.querySelector(".modal-body");
    if (body) body.scrollTop = 0;
    dialog.scrollTop = 0;
  }

  const defaultBrands = [
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
    "Zortrax",
    "Fiberology Pro",
    "Prusa Research",
    "Monoprice",
    "Real Filament",
    "Smartfil",
    "Colorprint",
    "Fibercree",
    "FiberForce",
    "FillFlex",
    "Mosaic",
    "Eryone",
    "NovaMaker",
    "FlashForge Pro",
    "Overture Pro",
    "Sunlu Pro",
    "Sunlu Industrial",
    "GEEETECH Pro"
  ];

  const defaultMaterialsOrdered = [
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

  // Mappa canonicalizzazione materiali (varianti -> nome standard)
  const materialCanonMap = {
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

  const defaultColors = [
    "Nero",
    "Bianco",
    "Grigio",
    "Grigio chiaro",
    "Grigio scuro",
    "Argento",
    "Trasparente",
    "Rosso",
    "Rosso vino",
    "Rosso mattone",
    "Arancione",
    "Giallo",
    "Giallo pastello",
    "Verde",
    "Verde acido",
    "Verde oliva",
    "Verde menta",
    "Blu",
    "Blu scuro",
    "Blu navy",
    "Blu turchese",
    "Azzurro",
    "Ciano",
    "Viola",
    "Lilla",
    "Magenta",
    "Rosa",
    "Rosa chiaro",
    "Rosa caldo",
    "Marrone",
    "Marrone chiaro",
    "Beige",
    "Crema",
    "Oro",
    "Oro rosa",
    "Rame",
    "Bronzo",
    "Gunmetal",
    "Grafite",
    "Nero carbone",
    "Nero seta",
    "Nero opaco",
    "Bianco seta",
    "Bianco ghiaccio",
    "Glow in the dark",
    "Arcobaleno",
    "Seta arcobaleno",
    "Legno chiaro",
    "Legno scuro",
    "Marmo",
    "Marmo bianco",
    "Marmo nero",
    "Marmo grigio",
    
    // === BAMBU LAB PLA BASIC - Codici (10xxx) ===
    "10100", // Bianco giada
    "10101", // Nero
    "10102", // Grigio
    "10103", // Dark Gray
    "10200", // Rosso
    "10201", // Rosso scuro
    "10203", // Rosa
    "10205", // Rosso bordeaux
    "10300", // Arancione
    "10301", // Pumpkin Orange
    "10400", // Giallo
    "10401", // Oro
    "10402", // Sunflower Yellow
    "10403", // Lemon Yellow
    "10500", // Verde (Bambu Green)
    "10501", // Mistletoe Green
    "10502", // Bright Green
    "10503", // Grass Green
    "10504", // Lime Green
    "10505", // Forest Green
    "10600", // Blu
    "10601", // Cobalt Blue
    "10602", // Lake Blue
    "10603", // Dark Blue
    "10605", // Turchese
    "10606", // Cyan
    "10700", // Viola
    "10701", // Indigo Purple
    "10702", // Lilac Purple
    "10800", // Marrone
    "10801", // Bronzo
    "10802", // Marrone cacao
    "10803", // Peanut Brown
    
    // === BAMBU LAB PLA BASIC - Nomi ===
    "Bianco giada",
    "Jade White",
    "Maroon Red",
    "Rosso bordeaux",
    "Turchese",
    "Turquoise",
    "Marrone cacao",
    "Cocoa Brown",
    "Bambu Green",
    "Mistletoe Green",
    "Bright Green",
    "Cobalt Blue",
    "Pumpkin Orange",
    "Blue Grey",
    "Indigo Purple",
    "Hot Pink",
    "Sunflower Yellow",
    
    // === BAMBU LAB PLA MATTE - Codici (11xxx) ===
    "11101", // Carbone
    "11201", // Rosa sakura
    
    // === BAMBU LAB PLA MATTE - Nomi ===
    "Carbone",
    "Charcoal",
    "Rosa sakura",
    "Sakura Pink",
    "Ivory White",
    "Bone White",
    "Desert Tan",
    "Latte Brown",
    "Caramel",
    "Terracotta",
    "Dark Brown",
    "Dark Chocolate",
    "Lilac Purple",
    "Mandarin Orange",
    "Lemon Yellow",
    "Plum",
    "Scarlet Red",
    "Dark Red",
    "Dark Green",
    "Grass Green",
    "Apple Green",
    "Ice Blue",
    "Sky Blue",
    "Marine Blue",
    "Dark Blue",
    "Ash Gray",
    "Nardo Gray",
    
    // === BAMBU LAB PLA TOUGH+ - Codici (12xxx) ===
    "12104", // Nero
    "12105", // Gray
    "12106", // Silver
    "12107", // White
    "12201", // Red
    "12301", // Orange
    "12401", // Yellow
    "12501", // Green
    "12601", // Cyan
    "12701", // Purple
    
    // === BAMBU LAB PLA WOOD - Codici (13xxx) ===
    "13107", // Noce nero
    "13106", // White Oak
    "13204", // Rosewood
    "13505", // Classic Birch
    "13801", // Clay Brown
    "13403", // Ochre Yellow
    
    // === BAMBU LAB PLA WOOD - Nomi ===
    "Noce nero",
    "Black Walnut",
    "White Oak",
    "Rosewood",
    "Classic Birch",
    "Clay Brown",
    "Ochre Yellow",
    
    // === BAMBU LAB PETG-CF - Codici (31xxx) ===
    "31100", // Nero
    
    // === BAMBU LAB PETG TRANSLUCENT - Codici (32xxx) ===
    "32100", // Grigio traslucido
    "32101", // Trasparente
    "32200", // Rosa traslucido
    "32300", // Arancione traslucido
    "32501", // Teal traslucido
    "32700", // Viola traslucido
    
    // === BAMBU LAB PETG TRANSLUCENT - Nomi ===
    "Grigio traslucido",
    "Translucent Gray",
    "Rosa traslucido",
    "Translucent Pink",
    "Viola traslucido",
    "Translucent Purple",
    "Translucent Teal",
    "Translucent Orange",
    
    // === BAMBU LAB PETG HF - Codici (33xxx) ===
    "33100", // Bianco
    "33101", // Grigio
    "33102", // Nero
    "33103", // Dark Gray
    "33200", // Rosso
    "33201", // Dark Red
    "33202", // Maroon Red
    "33300", // Arancione
    "33301", // Pumpkin Orange
    "33400", // Giallo
    "33401", // Crema
    "33402", // Gold
    "33500", // Verde (Bambu Green)
    "33501", // Lime Green
    "33502", // Forest Green
    "33503", // Mistletoe Green
    "33600", // Blu
    "33601", // Lake Blue
    "33602", // Cobalt Blue
    "33603", // Dark Blue
    "33700", // Viola
    "33701", // Indigo Purple
    "33800", // Marrone
    "33801", // Peanut Brown
    "33802", // Cocoa Brown
    
    // === BAMBU LAB PETG HF - Nomi ===
    "Lake Blue",
    "Forest Green",
    "Lime Green",
    "Peanut Brown",
    
    // === BAMBU LAB TPU - Codici (40xxx) ===
    "40100", // White
    "40101", // Black
    "40102", // Gray
    "40103", // Dark Gray
    "40200", // Red
    "40201", // Dark Red
    "40300", // Orange
    "40400", // Yellow
    "40500", // Green
    "40501", // Mistletoe Green
    "40600", // Blue
    "40601", // Lake Blue
    "40700", // Purple
    "40800", // Brown
    "40801", // Peanut Brown
    
    // === BAMBU LAB TPU - Nomi ===
    "TPU White",
    "TPU Black",
    "TPU Gray",
    "TPU Red",
    "TPU Orange",
    "TPU Yellow",
    "TPU Green",
    "TPU Blue",
    "TPU Purple",
    "TPU Brown",
    
    // === BAMBU LAB ASA-CF - Codici (46xxx) ===
    "46100", // ASA Aero White
    "46101", // ASA-CF Nero
    
    // === BAMBU LAB SUPPORT - Codici (65xxx, 66xxx) ===
    "65102", // Naturale
    "65500", // Green
    "66100", // Support ABS White
    "66400", // PVA Trasparente
    
    // === BAMBU LAB SUPPORT - Nomi ===
    "Naturale",
    
    // === BAMBU LAB PA6-CF - Codici (72xxx) ===
    "72100", // PA6-CF Nero
    
    // === BAMBU LAB PET-CF - Codici (71xxx) ===
    "71100", // PET-CF Black
    
    // === BAMBU LAB PLA-CF - Nomi ===
    "Burgundy Red",
    "Iris Purple",
    "Matcha Green",
    "Jeans Blue",
    "Royal Blue",
    "Lava Gray",
    
    // === BAMBU LAB PETG-CF - Nomi ===
    "Brick Red",
    "Violet Purple",
    "Indigo Blue",
    "Malachite Green",
    "Titan Gray"
  ];

  const colorHexMap = {
    // === COLORI GENERICI ===
    Nero: "#000000",
    "Nero carbone": "#000000",
    "Nero seta": "#030712",
    "Nero opaco": "#000000",
    Bianco: "#FFFFFF",
    "Bianco seta": "#f3f4f6",
    "Bianco ghiaccio": "#e5f0ff",
    Grigio: "#8E9089",
    "Grigio chiaro": "#D1D3D5",
    "Grigio scuro": "#545454",
    Argento: "#A6A9AA",
    Trasparente: "#e5e7eb",
    Rosso: "#C12E1F",
    "Rosso vino": "#9D2235",
    "Rosso mattone": "#9f332a",
    Arancione: "#FF6A13",
    Giallo: "#F4EE2A",
    "Giallo pastello": "#FEC600",
    Verde: "#00AE42",
    "Verde acido": "#BECF00",
    "Verde oliva": "#68724D",
    "Verde menta": "#22c55e",
    Blu: "#0A2989",
    "Blu scuro": "#042F56",
    "Blu navy": "#1e3a8a",
    "Blu turchese": "#00B1B7",
    Azzurro: "#0086D6",
    Ciano: "#009BD8",
    Viola: "#5E43B7",
    Lilla: "#AE96D4",
    Magenta: "#EC008C",
    Rosa: "#F55A74",
    "Rosa chiaro": "#F5547C",
    "Rosa caldo": "#fb7185",
    Marrone: "#9D432C",
    "Marrone chiaro": "#AE835B",
    Beige: "#F7E6DE",
    Crema: "#F9DFB9",
    Oro: "#E4BD68",
    "Oro rosa": "#f97373",
    Rame: "#ea580c",
    Bronzo: "#847D48",
    Gunmetal: "#374151",
    Grafite: "#111827",
    "Glow in the dark": "#bbf7d0",
    Arcobaleno: "#f97316",
    "Seta arcobaleno": "#e879f9",
    "Legno chiaro": "#fbbf77",
    "Legno scuro": "#4F3F24",
    Marmo: "#e8e4e0",
    "Marmo bianco": "#f5f5f5",
    "Marmo nero": "#2d2d2d",
    "Marmo grigio": "#9e9e9e",
    "Marble": "#e8e4e0",
    "White Marble": "#f5f5f5",
    "Black Marble": "#2d2d2d",
    
    // === BAMBU LAB PLA BASIC (codici 10xxx) ===
    "10100": "#FFFFFF", // Bianco giada / Jade White
    "10101": "#000000", // Nero / Black
    "10102": "#8E9089", // Grigio / Gray
    "10103": "#515151", // Dark Gray
    "10200": "#EB3A3A", // Rosso / Red
    "10201": "#C12E1F", // Rosso scuro / Dark Red
    "10203": "#F55A74", // Rosa / Pink
    "10205": "#9D2235", // Rosso bordeaux / Maroon Red
    "10300": "#F75403", // Arancione / Orange
    "10301": "#FF9016", // Pumpkin Orange
    "10400": "#FFD00B", // Giallo / Yellow
    "10401": "#E4BD68", // Oro / Gold
    "10402": "#FEC600", // Sunflower Yellow
    "10403": "#F4D53F", // Lemon Yellow
    "10500": "#00AE42", // Verde / Green (Bambu Green)
    "10501": "#3F8E43", // Mistletoe Green
    "10502": "#BECF00", // Bright Green
    "10503": "#61C680", // Grass Green
    "10504": "#6EE53C", // Lime Green
    "10505": "#39541A", // Forest Green
    "10600": "#002E96", // Blu / Blue
    "10601": "#0056B8", // Cobalt Blue
    "10602": "#1F79E5", // Lake Blue
    "10603": "#0A2989", // Dark Blue
    "10605": "#00B1B7", // Turchese / Turquoise
    "10606": "#009BD8", // Cyan
    "10700": "#5E43B7", // Viola / Purple
    "10701": "#482960", // Indigo Purple
    "10702": "#AE96D4", // Lilac Purple
    "10800": "#9D432C", // Marrone / Brown
    "10801": "#847D48", // Bronzo / Bronze
    "10802": "#6F5034", // Marrone cacao / Cocoa Brown
    "10803": "#875718", // Peanut Brown
    "Bianco giada": "#FFFFFF",
    "Jade White": "#FFFFFF",
    "Maroon Red": "#9D2235",
    "Rosso bordeaux": "#9D2235",
    Turchese: "#00B1B7",
    Turquoise: "#00B1B7",
    "Marrone cacao": "#6F5034",
    "Cocoa Brown": "#6F5034",
    "Bambu Green": "#00AE42",
    "Mistletoe Green": "#3F8E43",
    "Bright Green": "#BECF00",
    "Cobalt Blue": "#0056B8",
    "Pumpkin Orange": "#FF9016",
    "Blue Grey": "#5B6579",
    "Indigo Purple": "#482960",
    "Hot Pink": "#F5547C",
    "Sunflower Yellow": "#FEC600",
    
    // === BAMBU LAB PLA MATTE (codici 11xxx) ===
    "11101": "#000000", // Carbone / Charcoal
    "11201": "#E8AFCF", // Rosa sakura / Sakura Pink
    Carbone: "#000000",
    Charcoal: "#000000",
    "Rosa sakura": "#E8AFCF",
    "Sakura Pink": "#E8AFCF",
    "Ivory White": "#FFFFFF",
    "Bone White": "#CBC6B8",
    "Desert Tan": "#E8DBB7",
    "Latte Brown": "#D3B7A7",
    Caramel: "#AE835B",
    Terracotta: "#B15533",
    "Dark Brown": "#7D6556",
    "Dark Chocolate": "#4D3324",
    "Lilac Purple": "#AE96D4",
    "Mandarin Orange": "#F99963",
    "Lemon Yellow": "#F7D959",
    Plum: "#950051",
    "Scarlet Red": "#DE4343",
    "Dark Red": "#BB3D43",
    "Dark Green": "#68724D",
    "Grass Green": "#61C680",
    "Apple Green": "#C2E189",
    "Ice Blue": "#A3D8E1",
    "Sky Blue": "#56B7E6",
    "Marine Blue": "#0078BF",
    "Dark Blue": "#042F56",
    "Ash Gray": "#9B9EA0",
    "Nardo Gray": "#757575",
    
    // === BAMBU LAB PLA TOUGH+ (codici 12xxx) ===
    "12104": "#000000", // Nero / Black
    "12105": "#AFB1AE", // Gray
    "12106": "#959698", // Silver
    "12107": "#FFFFFF", // White
    "12201": "#EB3A3A", // Red
    "12301": "#DC3A27", // Orange
    "12401": "#F4D53F", // Yellow
    "12501": "#00AE42", // Green
    "12601": "#009BD8", // Cyan
    "12701": "#5E43B7", // Purple
    
    // === BAMBU LAB PLA WOOD (codici 13xxx) ===
    "13107": "#4F3F24", // Noce nero / Black Walnut
    "13106": "#C4A77D", // White Oak
    "13204": "#8B4513", // Rosewood
    "13505": "#DEB887", // Classic Birch
    "13801": "#A0522D", // Clay Brown
    "13403": "#CC7722", // Ochre Yellow
    "Noce nero": "#4F3F24",
    "Black Walnut": "#4F3F24",
    "White Oak": "#C4A77D",
    Rosewood: "#8B4513",
    "Classic Birch": "#DEB887",
    "Clay Brown": "#A0522D",
    "Ochre Yellow": "#CC7722",
    
    // === BAMBU LAB PETG-CF (codici 31xxx) ===
    "31100": "#000000", // Nero
    
    // === BAMBU LAB PETG TRANSLUCENT (codici 32xxx) ===
    "32100": "#8E8E8E", // Grigio traslucido
    "32101": "#E8E8E8", // Trasparente
    "32200": "#F9C1BD", // Rosa traslucido
    "32300": "#FF911A", // Arancione traslucido
    "32501": "#77EDD7", // Teal traslucido
    "32700": "#D6ABFF", // Viola traslucido
    "Grigio traslucido": "#8E8E8E",
    "Translucent Gray": "#8E8E8E",
    "Rosa traslucido": "#F9C1BD",
    "Translucent Pink": "#F9C1BD",
    "Viola traslucido": "#D6ABFF",
    "Translucent Purple": "#D6ABFF",
    "Translucent Teal": "#77EDD7",
    "Translucent Orange": "#FF911A",
    
    // === BAMBU LAB PETG HF (codici 33xxx) ===
    "33100": "#FFFFFF", // Bianco / White
    "33101": "#ADB1B2", // Grigio / Gray
    "33102": "#000000", // Nero / Black
    "33103": "#515151", // Dark Gray
    "33200": "#EB3A3A", // Rosso / Red
    "33201": "#C12E1F", // Dark Red
    "33202": "#9D2235", // Maroon Red
    "33300": "#F75403", // Arancione / Orange
    "33301": "#FF9016", // Pumpkin Orange
    "33400": "#FFD00B", // Giallo / Yellow
    "33401": "#F9DFB9", // Crema / Cream
    "33402": "#E4BD68", // Gold
    "33500": "#00AE42", // Verde (Bambu Green!)
    "33501": "#6EE53C", // Lime Green
    "33502": "#39541A", // Forest Green
    "33503": "#3F8E43", // Mistletoe Green
    "33600": "#002E96", // Blu / Blue
    "33601": "#1F79E5", // Lake Blue
    "33602": "#0056B8", // Cobalt Blue
    "33603": "#0A2989", // Dark Blue
    "33700": "#5E43B7", // Viola / Purple
    "33701": "#482960", // Indigo Purple
    "33800": "#9D432C", // Marrone / Brown
    "33801": "#875718", // Peanut Brown
    "33802": "#6F5034", // Cocoa Brown
    "Lake Blue": "#1F79E5",
    "Forest Green": "#39541A",
    "Lime Green": "#6EE53C",
    "Peanut Brown": "#875718",
    
    // === BAMBU LAB ASA-CF (codici 46xxx) ===
    "46100": "#F5F1DD", // ASA Aero White
    "46101": "#000000", // ASA-CF Nero
    
    // === BAMBU LAB SUPPORT (codici 65xxx, 66xxx) ===
    "65102": "#E8DCC8", // Naturale - Support PLA/PETG
    "65500": "#4CAF50", // Green - Support PA/PET
    "66100": "#FFFFFF", // Support ABS White
    "66400": "#E0E0E0", // PVA Trasparente
    Naturale: "#E8DCC8",
    
    // === BAMBU LAB PA6-CF (codici 72xxx) ===
    "72100": "#000000", // PA6-CF Nero
    
    // === BAMBU LAB PET-CF (codici 71xxx) ===
    "71100": "#000000", // PET-CF Black
    
    // === BAMBU LAB PLA-CF ===
    "Burgundy Red": "#951e23",
    "Iris Purple": "#69398E",
    "Matcha Green": "#5c9748",
    "Jeans Blue": "#6e88bc",
    "Royal Blue": "#2842AD",
    "Lava Gray": "#4d5054",
    
    // === BAMBU LAB PETG-CF ===
    "Brick Red": "#9f332a",
    "Violet Purple": "#583061",
    "Indigo Blue": "#324585",
    "Malachite Green": "#16b08e",
    "Titan Gray": "#565656",
    
    // === BAMBU LAB TPU (codici 40xxx) ===
    "40100": "#FFFFFF", // White
    "40101": "#000000", // Black
    "40102": "#8E9089", // Gray
    "40103": "#515151", // Dark Gray
    "40200": "#EB3A3A", // Red
    "40201": "#C12E1F", // Dark Red
    "40300": "#F75403", // Orange
    "40400": "#FFD00B", // Yellow
    "40500": "#00AE42", // Green
    "40501": "#3F8E43", // Mistletoe Green
    "40600": "#002E96", // Blue
    "40601": "#1F79E5", // Lake Blue
    "40700": "#5E43B7", // Purple
    "40800": "#9D432C", // Brown
    "40801": "#875718", // Peanut Brown
    "TPU White": "#FFFFFF",
    "TPU Black": "#000000",
    "TPU Gray": "#8E9089",
    "TPU Red": "#EB3A3A",
    "TPU Orange": "#F75403",
    "TPU Yellow": "#FFD00B",
    "TPU Green": "#00AE42",
    "TPU Blue": "#002E96",
    "TPU Purple": "#5E43B7",
    "TPU Brown": "#9D432C"
  };

  // Canonicalizzazione marche (SUNLU PLA-HF -> Sunlu)
  function canonicalizeBrand(rawBrand) {
    if (!rawBrand) return "";
    const trimmed = String(rawBrand).trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    const match = defaultBrands.find((db) =>
      lower.startsWith(db.toLowerCase())
    );
    return match || trimmed;
  }

  // Canonicalizzazione materiali (PLA Basic -> PLA, etc.)
  function canonicalizeMaterial(rawMaterial) {
    if (!rawMaterial) return "";
    const trimmed = String(rawMaterial).trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    
    // Prima cerca nella mappa di canonicalizzazione
    if (materialCanonMap[lower]) {
      return materialCanonMap[lower];
    }
    
    // Poi cerca match parziale nei materiali default
    const match = defaultMaterialsOrdered.find((dm) =>
      lower === dm.toLowerCase()
    );
    
    return match || trimmed;
  }

  function cleanBrandList(list) {
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

  function cleanMaterialList(list) {
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

  // Mappa prezzi Bambu Lab dalle fatture (prezzo unitario per bobina, IVA inclusa)
  // Chiave: SKU o codice colore, Valore: prezzo unitario €
  const bambuPriceMap = {
    // PLA Basic (singoli colori, sconto 57%)
    "A00-K0-1.75-1000-SPLFREE": 10.14,  // Nero
    "A00-R2-1.75-1000-SPLFREE": 10.14,  // Rosso bordeaux
    "A00-Y4-1.75-1000-SPLFREE": 10.14,  // Oro
    "A00-B5-1.75-1000-SPLFREE": 10.14,  // Turchese
    "A00-W1-1.75-1000-SPLFREE": 10.14,  // Bianco giada
    "A00-Y3-1.75-1000-SPLFREE": 10.14,  // Bronzo
    "A00-P1-1.75-1000-SPLFREE": 10.14,  // Rosa
    "A00-N1-1.75-1000-SPLFREE": 10.14,  // Marrone cacao
    "A00-PALLET-1.75-10000-SPLFREE": 11.57, // Pack 10 colori (€115.70 / 10)
    
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
  
  // Funzione per ottenere prezzo automatico da SKU
  function getAutoPrice(sku) {
    if (!sku) return null;
    return bambuPriceMap[sku] || null;
  }

  function captureDomainState() {
    if (typeof captureStateSnapshot === "function") return captureStateSnapshot(true);
    return JSON.parse(JSON.stringify({ filaments, purchasedFilaments, consumptionHistory, brandList, materialList, colorList, undoStack, redoStack }));
  }

  function commitDomainState(previous) {
    if (saveState(true) !== false) return true;
    if (typeof applyStateSnapshot === "function") applyStateSnapshot(previous, true);
    else {
      ({ filaments, purchasedFilaments, consumptionHistory, brandList, materialList, colorList, undoStack, redoStack } = previous);
    }
    renderAll();
    showToast("Salvataggio non riuscito: la modifica non è stata applicata. I valori del modulo restano disponibili.", "error");
    return false;
  }

  function createSpoolId() {
    if (typeof makeStableId === "function") return makeStableId("bobina");
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "bobina-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function requireSpoolNumber(value, label, integer = false) {
    const number = typeof value === "number" ? value : Number(value);
    if (value === null || value === "" || !Number.isFinite(number) || number < 0 || (integer && !Number.isSafeInteger(number))) {
      throw new Error(label + ": inserisci un numero " + (integer ? "intero " : "") + "non negativo.");
    }
    return number;
  }

  // Converte una volta i vecchi conteggi senza cambiare la massa conservata.
  function normalizeFilamentSpools(f) {
    if (!f || typeof f !== "object") throw new Error("Filamento non valido.");
    const unit = requireSpoolNumber(f.unit_weight_g, "Peso per bobina");
    if (unit <= 0) throw new Error("Il peso per bobina deve essere maggiore di zero.");
    const sealed = requireSpoolNumber(f.sealed_spools ?? 0, "Bobine sigillate", true);
    const open = requireSpoolNumber(f.open_spools ?? 0, "Bobine aperte", true);
    const historicalCount = requireSpoolNumber(f.spools_total ?? sealed + open, "Bobine totali", true);
    const declaredFinished = requireSpoolNumber(f.finished_spools ?? 0, "Bobine terminate", true);
    let finished = f.spool_state_version === 1 ? declaredFinished : Math.max(0, historicalCount - sealed - open);
    const fractions = Array.isArray(f.open_spools_fractions) ? f.open_spools_fractions.slice(0, open) : [];
    fractions.forEach(value => {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("Frazione residua non valida.");
    });
    if (fractions.length < open) {
      const missing = open - fractions.length;
      const known = fractions.reduce((sum, value) => sum + value, 0);
      let missingFraction;
      if (Number.isFinite(f.remaining_weight_g)) {
        missingFraction = f.remaining_weight_g / unit - sealed - known;
        if (missingFraction < -0.000001 || missingFraction > missing + 0.000001) throw new Error("Residuo incompatibile con il numero di bobine.");
        missingFraction = Math.max(0, Math.min(missing, missingFraction));
      } else {
        const main = f.main_fraction ?? 1;
        if (!Number.isFinite(main) || main < 0 || main > 1) throw new Error("Frazione principale non valida.");
        missingFraction = Math.max(0, missing - (f.spool_state_version === 1 ? 0 : declaredFinished) - 1) + main;
        if (f.spool_state_version !== 1 && declaredFinished >= missing) missingFraction = 0;
      }
      // Le ultime bobine restano piene; la frazione parziale precede quelle piene.
      for (let i = 0; i < missing; i++) fractions.push(Math.max(0, Math.min(1, missingFraction - (missing - i - 1))));
    }
    const locations = Array.isArray(f.spools_locations) ? f.spools_locations : [];
    const variants = Array.isArray(f.spools_variants) ? f.spools_variants : [];
    const ids = Array.isArray(f.spools_ids) ? f.spools_ids : [];
    const active = [];
    const seen = new Set();
    for (let i = 0; i < sealed + open; i++) {
      const fraction = i < sealed ? 1 : fractions[i - sealed];
      if (fraction === 0) { finished++; continue; }
      let id = typeof ids[i] === "string" && ids[i] ? ids[i] : createSpoolId();
      if (seen.has(id)) id = createSpoolId();
      seen.add(id);
      active.push({ id, sealed: i < sealed, fraction, location: locations[i] ?? f.location ?? "", variant: variants[i] ?? f.variant ?? "" });
    }
    f.spool_state_version = 1;
    f.finished_spools = finished;
    f.sealed_spools = active.filter(spool => spool.sealed).length;
    f.open_spools = active.length - f.sealed_spools;
    f.spools_total = active.length + finished;
    f.open_spools_fractions = active.filter(spool => !spool.sealed).map(spool => spool.fraction);
    f.spools_locations = active.map(spool => spool.location);
    f.spools_variants = active.map(spool => spool.variant);
    f.spools_ids = active.map(spool => spool.id);
    f.main_fraction = f.open_spools_fractions.length ? Math.min(...f.open_spools_fractions) : 1;
    f.location = f.spools_locations.find(location => location) || "";
    const previousTotal = f.total_weight_g == null ? 0 : requireSpoolNumber(f.total_weight_g, "Peso totale");
    f.total_weight_g = Math.max(previousTotal, f.spools_total * unit);
    return f;
  }

  function getActiveFilamentSpools(f) {
    return (f.spools_ids || []).map((id, index) => ({
      id,
      sealed: index < f.sealed_spools,
      fraction: index < f.sealed_spools ? 1 : f.open_spools_fractions[index - f.sealed_spools],
      location: f.spools_locations[index] || "",
      variant: f.spools_variants[index] || f.variant || ""
    }));
  }

  function setActiveFilamentSpools(f, spools) {
    const ordered = [...spools.filter(spool => spool.sealed), ...spools.filter(spool => !spool.sealed)];
    f.sealed_spools = ordered.filter(spool => spool.sealed).length;
    f.open_spools = ordered.length - f.sealed_spools;
    f.spools_ids = ordered.map(spool => spool.id || createSpoolId());
    f.spools_locations = ordered.map(spool => spool.location || "");
    f.spools_variants = ordered.map(spool => spool.variant || f.variant || "");
    f.open_spools_fractions = ordered.filter(spool => !spool.sealed).map(spool => spool.fraction);
    f.spools_total = ordered.length + (f.finished_spools || 0);
    return f;
  }

  function getFilamentIdentity(f) {
    return JSON.stringify([
      canonicalizeBrand(f.brand || "").toLowerCase(), canonicalizeMaterial(f.material || "").toLowerCase(),
      String(f.variant || "").trim().toLowerCase(), String(f.color_code || "").trim().toLowerCase(),
      f.unit_weight_g, f.packaging_type || "spool", f.unit_price ?? null, f.supplier || "", f.source_purchase_id || ""
    ]);
  }

  function transferPurchasedSpools(purchasedId, quantity, sealed, fractions, price, supplier) {
    const p = purchasedFilaments.find(entry => entry.id === purchasedId);
    if (!p) throw new Error("Acquisto non trovato.");
    const available = requireSpoolNumber(p.quantity_spools ?? p.quantitySpools ?? 0, "Quantità disponibile", true);
    const qty = requireSpoolNumber(quantity, "Quantità", true);
    const sealedCount = requireSpoolNumber(sealed, "Bobine sigillate", true);
    if (qty < 1 || qty > available || sealedCount + fractions.length !== qty) throw new Error("Quantità di trasferimento non valida.");
    const unit = requireSpoolNumber(p.unit_weight_g ?? 1000, "Peso per bobina");
    if (unit <= 0 || fractions.some(fraction => !Number.isFinite(fraction) || fraction <= 0 || fraction > 1)) throw new Error("Peso o frazioni non validi.");
    const unitPrice = price == null ? null : requireSpoolNumber(price, "Prezzo");
    const entry = { id: createSpoolId(), brand: canonicalizeBrand(p.brand), material: canonicalizeMaterial(p.material),
      variant: p.variant || "", color_code: p.color_code || "", packaging_type: p.packaging_type || "spool", unit_weight_g: unit,
      unit_price: unitPrice, supplier: supplier || "", source_purchase_id: p.id, sealed_spools: sealedCount,
      open_spools: fractions.length, open_spools_fractions: fractions.slice(), finished_spools: 0, spools_total: qty,
      total_weight_g: qty * unit, notes: "", spool_state_version: 1 };
    recalcWeightsForFilament(entry);
    const nextFilaments = deduplicateFilamentsByIdentity([...filaments, entry]);
    const previous = captureDomainState();
    saveStateForUndo(`Trasferite ${qty} bobine al magazzino`);
    p.quantity_purchased_original = Math.max(p.quantity_purchased_original ?? available, available);
    p.quantity_spools = available - qty;
    if ("quantitySpools" in p) p.quantitySpools = p.quantity_spools;
    filaments = nextFilaments;
    if (!commitDomainState(previous)) return false;
    renderAll();
    return qty;
  }

  // Unisce più righe identiche di magazzino in una sola (stessa marca/materiale/colore/codice/peso)
  function deduplicateFilamentsByIdentity(list) {
    if (!Array.isArray(list)) throw new Error("Elenco filamenti non valido.");
    const grouped = new Map();
    for (const original of list) {
      const f = JSON.parse(JSON.stringify(original));
      f.brand = canonicalizeBrand(f.brand || "");
      f.material = canonicalizeMaterial(f.material || "");
      f.variant = String(f.variant || "").trim();
      f.color_code = String(f.color_code || "").trim();
      recalcWeightsForFilament(f);
      const key = getFilamentIdentity(f);
      if (!grouped.has(key)) { grouped.set(key, f); continue; }
      const aggregate = grouped.get(key);
      const spools = [...getActiveFilamentSpools(aggregate), ...getActiveFilamentSpools(f)];
      aggregate.finished_spools += f.finished_spools;
      aggregate.total_weight_g += f.total_weight_g;
      setActiveFilamentSpools(aggregate, spools);
      if (f.notes) aggregate.notes = [aggregate.notes, f.notes].filter(Boolean).join("; ");
      recalcWeightsForFilament(aggregate);
    }
    return Array.from(grouped.values());
  }

  function showToast(message, type = "info") {
    // Riproduci suono per azioni confermate
    if (type === "success") {
      playSuccessSound();
    }
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const iconDiv = document.createElement("div");
    iconDiv.className = "toast-icon";
    let iconSvg = "";

    if (type === "success") {
      iconSvg =
        '<svg viewBox="0 0 24 24" fill="none"><path d="M5.5 12.5 9.5 16.5 18.5 7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/></svg>';
    } else if (type === "error") {
      iconSvg =
        '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M12 8v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="15.5" r="0.9" fill="currentColor"/></svg>';
    } else {
      iconSvg =
        '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M12 9v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7" r="0.9" fill="currentColor"/></svg>';
    }

    iconDiv.innerHTML = iconSvg;

    const msgDiv = document.createElement("div");
    msgDiv.className = "toast-message";

    const titleDiv = document.createElement("div");
    titleDiv.className = "toast-title";
    if (type === "success") {
      titleDiv.textContent = "Operazione completata";
    } else if (type === "error") {
      titleDiv.textContent = "Errore";
    } else {
      titleDiv.textContent = "Informazione";
    }

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "toast-body";
    bodyDiv.textContent = message;

    msgDiv.appendChild(titleDiv);
    msgDiv.appendChild(bodyDiv);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast-close-btn";
    closeBtn.setAttribute("aria-label", "Chiudi notifica");
    closeBtn.textContent = "×";

    toast.appendChild(iconDiv);
    toast.appendChild(msgDiv);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    const removeToast = () => {
      toast.classList.add("toast-hide");
      setTimeout(() => {
        toast.remove();
      }, 250);
    };

    closeBtn.addEventListener("click", () => {
      removeToast();
    });

    setTimeout(() => {
      removeToast();
    }, 3000);
  }

  function formatNumber(num, decimals = 0) {
    if (isNaN(num)) return "0";
    return num.toLocaleString("it-IT", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  const STOCK_THRESHOLD_LOW = 0.25;
  const STOCK_THRESHOLD_MED = 0.5;

  // Restituisce colore e classe per le barre di stock in base al ratio residuo (0..1)
  // Soglie: verde > 50%, giallo 25-50%, rosso <= 25%
  function getStockBarStyle(ratio) {
    const styles = getComputedStyle(document.documentElement);
    if (ratio <= STOCK_THRESHOLD_LOW) {
      return { color: styles.getPropertyValue("--gf-red").trim() || "#F2495C", cls: "low-stock" };
    }
    if (ratio <= STOCK_THRESHOLD_MED) {
      return { color: styles.getPropertyValue("--gf-yellow").trim() || "#FADE2A", cls: "medium-stock" };
    }
    return { color: styles.getPropertyValue("--gf-green").trim() || "#73BF69", cls: "high-stock" };
  }

  function getColorHex(colorName) {
    if (typeof colorName !== "string" || !colorName) return "#e5e7eb";
    
    // Prima prova match diretto
    const direct = colorHexMap[colorName];
    if (typeof direct === "string") return direct;
    
    // Estrai codice Bambu se presente (es. "Nero (33102)" -> "33102")
    const codeMatch = colorName.match(/\((\d{5})\)/);
    if (codeMatch) {
      const bambuCode = codeMatch[1];
      if (colorHexMap[bambuCode]) return colorHexMap[bambuCode];
    }
    
    // Cerca anche solo il codice numerico se presente
    const numMatch = colorName.match(/\b(\d{5})\b/);
    if (numMatch) {
      const code = numMatch[1];
      if (colorHexMap[code]) return colorHexMap[code];
    }
    
    const lower = colorName.toLowerCase();

    // Match per parole chiave in italiano e inglese
    if (lower.includes("nero") || lower.includes("black") || lower.includes("charcoal") || lower.includes("carbone")) return colorHexMap["Nero"];
    if (lower.includes("bianco") || lower.includes("white") || lower.includes("ivory")) return colorHexMap["Bianco"];
    if (lower.includes("grigio") || lower.includes("grey") || lower.includes("gray")) return colorHexMap["Grigio"];
    if (lower.includes("silver") || lower.includes("argento")) return colorHexMap["Argento"];
    if (lower.includes("rosso") || lower.includes("red") || lower.includes("bordeaux") || lower.includes("maroon")) return colorHexMap["Rosso"];
    if (lower.includes("aranc") || lower.includes("orange")) return colorHexMap["Arancione"];
    if (lower.includes("giall") || lower.includes("yellow") || lower.includes("gold") || lower.includes("oro")) {
      if (lower.includes("oro") || lower.includes("gold")) return colorHexMap["Oro"];
      return colorHexMap["Giallo"];
    }
    if (lower.includes("bambu green")) return "#00AE42";
    if (lower.includes("verde") || lower.includes("green")) return colorHexMap["Verde"];
    if (lower.includes("turchese") || lower.includes("turquoise") || lower.includes("teal")) return colorHexMap["Turchese"];
    if (lower.includes("blu") || lower.includes("blue") || lower.includes("azzurro")) return colorHexMap["Blu"];
    if (lower.includes("ciano") || lower.includes("cyan")) return colorHexMap["Ciano"];
    if (lower.includes("viola") || lower.includes("purple") || lower.includes("lilla") || lower.includes("lilac")) return colorHexMap["Viola"];
    if (lower.includes("rosa") || lower.includes("pink") || lower.includes("sakura")) return colorHexMap["Rosa"];
    if (lower.includes("marrone") || lower.includes("brown") || lower.includes("wood") || lower.includes("noce") || lower.includes("walnut") || lower.includes("cacao") || lower.includes("cocoa")) {
      if (lower.includes("noce") || lower.includes("walnut")) return colorHexMap["Noce nero"];
      if (lower.includes("cacao") || lower.includes("cocoa")) return colorHexMap["Marrone cacao"];
      return colorHexMap["Marrone"];
    }
    if (lower.includes("rame") || lower.includes("copper")) return colorHexMap["Rame"];
    if (lower.includes("bronzo") || lower.includes("bronze")) return colorHexMap["Bronzo"];
    if (lower.includes("beige")) return colorHexMap["Beige"];
    if (lower.includes("crema") || lower.includes("cream")) return colorHexMap["Crema"];
    if (lower.includes("trasparente") || lower.includes("transparent") || lower.includes("clear") || lower.includes("traslucido") || lower.includes("translucent")) {
      if (lower.includes("viola") || lower.includes("purple")) return colorHexMap["Viola traslucido"];
      if (lower.includes("rosa") || lower.includes("pink")) return colorHexMap["Rosa traslucido"];
      if (lower.includes("grigio") || lower.includes("gray")) return colorHexMap["Grigio traslucido"];
      return colorHexMap["Trasparente"];
    }
    if (lower.includes("glow")) return colorHexMap["Glow in the dark"];
    if (lower.includes("rainbow") || lower.includes("arcobaleno")) return colorHexMap["Arcobaleno"];
    if (lower.includes("naturale") || lower.includes("natural")) return colorHexMap["Naturale"];

    return "#e5e7eb";
  }

  // Funzione per ottenere il nome del colore da un codice
  function getColorNameFromCode(code) {
    if (!code || typeof code !== 'string') return "";
    
    // Mappa codici -> nomi colori
    const codeToNameMap = {
      // PLA BASIC (10xxx)
      "10100": "Bianco giada / Jade White",
      "10101": "Nero / Black",
      "10102": "Grigio / Gray",
      "10103": "Grigio scuro / Dark Gray",
      "10200": "Rosso / Red",
      "10201": "Rosso scuro / Dark Red",
      "10203": "Rosa / Pink",
      "10205": "Rosso bordeaux / Maroon Red",
      "10300": "Arancione / Orange",
      "10301": "Arancione zucca / Pumpkin Orange",
      "10400": "Giallo / Yellow",
      "10401": "Oro / Gold",
      "10402": "Giallo girasole / Sunflower Yellow",
      "10403": "Giallo limone / Lemon Yellow",
      "10500": "Verde / Green (Bambu Green)",
      "10501": "Verde vischio / Mistletoe Green",
      "10502": "Verde brillante / Bright Green",
      "10503": "Verde erba / Grass Green",
      "10504": "Verde lime / Lime Green",
      "10505": "Verde foresta / Forest Green",
      "10600": "Blu / Blue",
      "10601": "Blu cobalto / Cobalt Blue",
      "10602": "Blu lago / Lake Blue",
      "10603": "Blu scuro / Dark Blue",
      "10605": "Turchese / Turquoise",
      "10606": "Ciano / Cyan",
      "10700": "Viola / Purple",
      "10701": "Viola indaco / Indigo Purple",
      "10702": "Viola lilla / Lilac Purple",
      "10800": "Marrone / Brown",
      "10801": "Bronzo / Bronze",
      "10802": "Marrone cacao / Cocoa Brown",
      "10803": "Marrone arachide / Peanut Brown",
      // PLA MATTE (11xxx)
      "11101": "Carbone / Charcoal",
      "11201": "Rosa sakura / Sakura Pink",
      // PLA TOUGH+ (12xxx)
      "12104": "Nero / Black",
      "12105": "Grigio / Gray",
      "12106": "Argento / Silver",
      "12107": "Bianco / White",
      "12201": "Rosso / Red",
      "12301": "Arancione / Orange",
      "12401": "Giallo / Yellow",
      "12501": "Verde / Green",
      "12601": "Ciano / Cyan",
      "12701": "Viola / Purple",
      // PLA WOOD (13xxx)
      "13107": "Noce nero / Black Walnut",
      "13106": "Quercia bianca / White Oak",
      "13204": "Palissandro / Rosewood",
      "13505": "Betulla classica / Classic Birch",
      "13801": "Marrone argilla / Clay Brown",
      "13403": "Giallo ocra / Ochre Yellow",
      // PETG-CF (31xxx)
      "31100": "Nero / Black",
      // PETG TRANSLUCENT (32xxx)
      "32100": "Grigio traslucido / Translucent Gray",
      "32101": "Trasparente / Transparent",
      "32200": "Rosa traslucido / Translucent Pink",
      "32300": "Arancione traslucido / Translucent Orange",
      "32501": "Teal traslucido / Translucent Teal",
      "32700": "Viola traslucido / Translucent Purple",
      // PETG HF (33xxx)
      "33100": "Bianco / White",
      "33101": "Grigio / Gray",
      "33102": "Nero / Black",
      "33103": "Grigio scuro / Dark Gray",
      "33200": "Rosso / Red",
      "33201": "Rosso scuro / Dark Red",
      "33202": "Rosso bordeaux / Maroon Red",
      "33300": "Arancione / Orange",
      "33301": "Arancione zucca / Pumpkin Orange",
      "33400": "Giallo / Yellow",
      "33401": "Crema / Cream",
      "33402": "Oro / Gold",
      "33500": "Verde / Green (Bambu Green)",
      "33501": "Verde lime / Lime Green",
      "33502": "Verde foresta / Forest Green",
      "33503": "Verde vischio / Mistletoe Green",
      "33600": "Blu / Blue",
      "33601": "Blu lago / Lake Blue",
      "33602": "Blu cobalto / Cobalt Blue",
      "33603": "Blu scuro / Dark Blue",
      "33700": "Viola / Purple",
      "33701": "Viola indaco / Indigo Purple",
      "33800": "Marrone / Brown",
      "33801": "Marrone arachide / Peanut Brown",
      "33802": "Marrone cacao / Cocoa Brown",
      // TPU (40xxx)
      "40100": "Bianco / White",
      "40101": "Nero / Black",
      "40102": "Grigio / Gray",
      "40103": "Grigio scuro / Dark Gray",
      "40200": "Rosso / Red",
      "40201": "Rosso scuro / Dark Red",
      "40300": "Arancione / Orange",
      "40400": "Giallo / Yellow",
      "40500": "Verde / Green",
      "40501": "Verde vischio / Mistletoe Green",
      "40600": "Blu / Blue",
      "40601": "Blu lago / Lake Blue",
      "40700": "Viola / Purple",
      "40800": "Marrone / Brown",
      "40801": "Marrone arachide / Peanut Brown",
      // ASA-CF (46xxx)
      "46100": "Bianco aero / ASA Aero White",
      "46101": "Nero / ASA-CF Black",
      // SUPPORT (65xxx, 66xxx)
      "65102": "Naturale / Natural",
      "65500": "Verde / Green",
      "66100": "Bianco / Support ABS White",
      "66400": "Trasparente / PVA Transparent",
      // PA6-CF (72xxx)
      "72100": "Nero / PA6-CF Black",
      // PET-CF (71xxx)
      "71100": "Nero / PET-CF Black"
    };
    
    return codeToNameMap[code] || "";
  }

  // Determina se un colore è scuro (per scegliere testo bianco o nero)
  function isColorDark(hexColor) {
    if (!hexColor || hexColor === "#e5e7eb") return false;
    
    // Rimuovi # se presente
    const hex = hexColor.replace("#", "");
    
    // Converti in RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calcola luminosità relativa (formula W3C)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Soglia abbassata a 0.35 per avere testo nero su tutti i colori chiari
    return luminance < 0.35;
  }

  // Genera HTML per pill colorato completamente
  function getColoredPillHtml(colorName) {
    const hex = getColorHex(colorName);
    const displayName = colorName || "N/D";
    const displayNameLower = displayName.toLowerCase();
    
    // Forza testo nero per colori bianchi/chiari specifici
    const whiteKeywords = ["bianco giada", "bianco", "bianco ghiaccio", "bianco seta", "jade white", "white"];
    const isWhiteColor = whiteKeywords.some(w => displayNameLower.includes(w));
    
    // Controlla anche se l'hex è bianco o molto chiaro
    const isHexWhite = hex && (
      hex.toUpperCase() === "#FFFFFF" || 
      hex.toUpperCase() === "#FFF" ||
      hex.toUpperCase() === "#FEFEFE" ||
      hex.toUpperCase() === "#FDFDFD"
    );
    
    // Controlla anche se l'hex è molto chiaro (luminosità > 0.9)
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
      textClass = "dark-text"; // Forza testo nero per bianco/colori molto chiari
    } else {
      const isDark = isColorDark(hex);
      textClass = isDark ? "light-text" : "dark-text";
    }
    
    return `<span class="pill-colored ${textClass}" style="background: ${hex};" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>`;
  }

  // =============================================
  // CUSTOM COLOR DROPDOWN FUNCTIONS
  // =============================================

  let activeColorDropdown = null;

  function createColorDropdown(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    if (activeColorDropdown && (!activeColorDropdown.isConnected || container.contains(activeColorDropdown))) closeColorDropdown(activeColorDropdown);
    const { placeholder = "Seleziona colore...", allowCustom = true, customLabel = "Altro colore...", onSelect = () => {}, initialValue = "" } = options;
    const wrapper = document.createElement("div");
    wrapper.className = "color-dropdown-wrapper";
    wrapper.dataset.dropdownId = containerId;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "color-dropdown-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", containerId + "Menu");
    trigger.innerHTML = '<span class="color-dot" style="background:#e5e7eb"></span><span class="color-text"></span><svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/></svg>';
    trigger.querySelector(".color-text").textContent = placeholder;
    const menu = document.createElement("div");
    menu.id = containerId + "Menu";
    menu.className = "color-dropdown-menu";
    menu.hidden = true;
    wrapper._colorMenu = menu;
    const searchDiv = document.createElement("div");
    searchDiv.className = "color-dropdown-search";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Cerca colore...";
    searchInput.setAttribute("aria-label", "Cerca colore");
    searchDiv.appendChild(searchInput);
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "color-dropdown-options";
    menu.append(searchDiv, optionsContainer);
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = containerId + "_value";
    hiddenInput.id = containerId + "_value";
    wrapper.append(trigger, menu, hiddenInput);
    container.replaceChildren(wrapper);
    function renderOptions(filter = searchInput.value) {
      optionsContainer.replaceChildren();
      const colors = colorList.filter(color => color.toLowerCase().includes(filter.toLowerCase()));
      colors.forEach(color => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "color-dropdown-option" + (hiddenInput.value === color ? " selected" : "");
        button.dataset.value = color;
        const dot = document.createElement("span");
        dot.className = "color-dot";
        dot.style.background = getColorHex(color);
        const label = document.createElement("span");
        label.className = "color-name";
        const name = /^\d{5}$/.test(color) ? getColorNameFromCode(color) : null;
        label.textContent = name ? color + " - " + name : color;
        button.append(dot, label);
        button.addEventListener("click", () => selectColorOption(wrapper, color, onSelect));
        optionsContainer.appendChild(button);
      });
      if (allowCustom) {
        const custom = document.createElement("button");
        custom.type = "button";
        custom.className = "color-dropdown-option custom-option";
        custom.dataset.value = "__custom__";
        custom.textContent = customLabel;
        custom.addEventListener("click", () => selectColorOption(wrapper, "__custom__", onSelect));
        optionsContainer.appendChild(custom);
      } else if (!colors.length) {
        const empty = document.createElement("div");
        empty.className = "color-dropdown-empty";
        empty.textContent = "Nessun colore trovato";
        optionsContainer.appendChild(empty);
      }
    }
    trigger.addEventListener("click", event => { event.stopPropagation(); renderOptions(); toggleColorDropdown(wrapper); });
    trigger.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); renderOptions(); if (!wrapper.classList.contains("open")) toggleColorDropdown(wrapper); menu.querySelector("button")?.focus(); }
    });
    searchInput.addEventListener("input", () => renderOptions());
    menu.addEventListener("keydown", event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      if (event.target === searchInput && event.key !== "ArrowDown") return;
      const buttons = Array.from(optionsContainer.querySelectorAll("button"));
      if (!buttons.length) return;
      event.preventDefault();
      let index = buttons.indexOf(document.activeElement);
      index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
      buttons[index].focus();
    });
    if (initialValue) setColorDropdownValue(wrapper, initialValue);
    return { wrapper, setValue: value => setColorDropdownValue(wrapper, value), getValue: () => hiddenInput.value, refresh: () => renderOptions() };
  }

  function toggleColorDropdown(wrapper) {
    if (wrapper.classList.contains("open")) { closeColorDropdown(wrapper); return; }
    if (activeColorDropdown) closeColorDropdown(activeColorDropdown);
    if (activeMultiSelectDropdown) activeMultiSelectDropdown.close();
    const menu = wrapper._colorMenu;
    const trigger = wrapper.querySelector(".color-dropdown-trigger");
    if (!menu) return;
    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    activeColorDropdown = wrapper;
    initFloatingLayer().appendChild(menu);
    menu.hidden = false;
    menu.classList.add("is-portal-active");
    const reposition = () => positionColorDropdownMenu(trigger, menu);
    wrapper._repositionHandler = reposition;
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    reposition();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (activeColorDropdown === wrapper) reposition(); }));
    menu.querySelector("input")?.focus({ preventScroll: true });
  }

  function positionColorDropdownMenu(trigger, menu) {
    if (menu.hidden || !trigger.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 180), innerWidth - 16);
    menu.style.width = width + "px";
    menu.style.maxHeight = Math.min(250, Math.max(80, innerHeight - 16)) + "px";
    const height = Math.min(menu.scrollHeight, 250, innerHeight - 16);
    const below = innerHeight - rect.bottom - 8;
    let top = below >= height ? rect.bottom + 4 : rect.top >= height + 8 ? rect.top - height - 4 : Math.max(8, innerHeight - height - 8);
    menu.style.top = top + "px";
    menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + "px";
  }

  function selectColorOption(wrapper, value, onSelect) {
    if (value !== "__custom__") setColorDropdownValue(wrapper, value);
    else wrapper.querySelector("input[type='hidden']").value = "";
    closeColorDropdown(wrapper);
    wrapper.querySelector(".color-dropdown-trigger").focus({ preventScroll: true });
    onSelect(value);
  }

  function closeColorDropdown(wrapper) {
    if (!wrapper) return;
    const menu = wrapper._colorMenu;
    wrapper.classList.remove("open");
    wrapper.querySelector(".color-dropdown-trigger")?.setAttribute("aria-expanded", "false");
    if (activeColorDropdown === wrapper) activeColorDropdown = null;
    if (menu) {
      menu.hidden = true;
      menu.classList.remove("is-portal-active");
      menu.removeAttribute("style");
      wrapper.appendChild(menu);
    }
    if (wrapper._repositionHandler) {
      window.removeEventListener("scroll", wrapper._repositionHandler, true);
      window.removeEventListener("resize", wrapper._repositionHandler);
      wrapper._repositionHandler = null;
    }
  }

  function setColorDropdownValue(wrapper, value) {
    const trigger = wrapper.querySelector(".color-dropdown-trigger");
    const hiddenInput = wrapper.querySelector("input[type='hidden']");
    const colorDot = trigger.querySelector(".color-dot");
    const colorText = trigger.querySelector(".color-text");

    if (value && value !== "__custom__") {
      hiddenInput.value = value;
      const hex = getColorHex(value);
      colorDot.style.background = hex;
      colorText.textContent = value;
    } else {
      hiddenInput.value = "";
      colorDot.style.background = "#e5e7eb";
      colorText.textContent = "Seleziona colore...";
    }
  }

  document.addEventListener("click", event => {
    if (activeColorDropdown && !activeColorDropdown.contains(event.target) && !activeColorDropdown._colorMenu.contains(event.target)) closeColorDropdown(activeColorDropdown);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && activeColorDropdown) {
      const trigger = activeColorDropdown.querySelector(".color-dropdown-trigger");
      closeColorDropdown(activeColorDropdown);
      trigger.focus({ preventScroll: true });
      event.preventDefault();
    }
  });

  // =============================================
  // ACTION DROPDOWN FOR TRANSFER BUTTON
  // =============================================

  let activeActionDropdown = null;

  function toggleActionDropdown(wrapper) {
    const isOpen = wrapper.classList.contains("open");
    
    // Close all action dropdowns first
    document.querySelectorAll(".action-dropdown-wrapper.open").forEach(w => {
      w.classList.remove("open");
    });

    if (!isOpen) {
      wrapper.classList.add("open");
      activeActionDropdown = wrapper;
    } else {
      activeActionDropdown = null;
    }
  }

  // Close action dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (activeActionDropdown && !activeActionDropdown.contains(e.target)) {
      activeActionDropdown.classList.remove("open");
      activeActionDropdown = null;
    }
  });

  // Funzione per aggiunta al magazzino con selezione quantità
  function addToStockWithQuantity(purchasedId) {
    const p = purchasedFilaments.find(entry => entry.id === purchasedId);
    if (!p) return;
    const value = prompt("Quante bobine sigillate vuoi trasferire?", "1");
    if (value === null) return;
    try {
      const qty = requireSpoolNumber(value, "Quantità", true);
      if (transferPurchasedSpools(purchasedId, qty, qty, [], p.unit_price ?? null, p.supplier || "") === false) return;
      showToast(`${qty} bobine trasferite.`, "success");
    } catch (error) { showToast(error.message, "error"); }
  }

  // Funzione per aggiunta diretta al magazzino
  function quickAddToStock(purchasedId) {
    const p = purchasedFilaments.find(entry => entry.id === purchasedId);
    if (!p) return;
    try {
      if (transferPurchasedSpools(purchasedId, 1, 1, [], p.unit_price ?? null, p.supplier || "") === false) return;
      showToast("Una bobina trasferita.", "success");
    } catch (error) { showToast(error.message, "error"); }
  }

  // Esponi le funzioni globalmente per l'onclick
  window.addToStockWithQuantity = addToStockWithQuantity;
  window.quickAddToStock = quickAddToStock;

  // Funzione per aprire il modal "Aggiungi al magazzino"
  function openAddToStockModal(purchasedId) {
    const p = purchasedFilaments.find(x => x.id === purchasedId);
    if (!p) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    const maxQty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools || 0);
    if (maxQty < 1) {
      showToast("Non ci sono bobine disponibili da trasferire.", "error");
      return;
    }

    const modal = document.getElementById("addToStockModal");
    const info = document.getElementById("addToStockInfo");
    const qtyInput = document.getElementById("addToStockQty");
    const sealedInput = document.getElementById("addToStockSealed");
    const openInput = document.getElementById("addToStockOpen");
    const priceInput = document.getElementById("addToStockPrice");
    const supplierInput = document.getElementById("addToStockSupplier");
    const hiddenId = document.getElementById("addToStockPurchasedId");
    const openSpoolsSection = document.getElementById("addToStockOpenSpoolsSection");
    const openSpoolsContainer = document.getElementById("addToStockOpenSpoolsListContainer");

    if (!modal || !info || !qtyInput || !sealedInput || !openInput || !hiddenId) {
      showToast("Errore: elementi del modal non trovati.", "error");
      return;
    }

    // Popola informazioni
    const filamentStr = `${canonicalizeBrand(p.brand)} – ${p.material || "-"} – ${p.variant || "-"}`;
    info.textContent = `${filamentStr}. Disponibili: ${maxQty} bobina/e.`;

    // Imposta valori di default
    qtyInput.max = maxQty;
    qtyInput.value = "1";
    sealedInput.value = "1";
    openInput.value = "0";
    priceInput.value = p.unit_price != null ? String(p.unit_price) : "";
    supplierInput.value = p.supplier || "";
    hiddenId.value = purchasedId;

    // Nascondi sezione bobine aperte
    if (openSpoolsSection) openSpoolsSection.style.display = "none";
    if (openSpoolsContainer) openSpoolsContainer.innerHTML = "";

    // Event listener per aggiornare la sezione bobine aperte
    const updateOpenSpoolsSection = () => {
      const openCount = Number(document.getElementById("addToStockOpen").value) || 0;
      if (openCount > 0 && openSpoolsSection && openSpoolsContainer) {
        openSpoolsSection.style.display = "block";
        openSpoolsContainer.innerHTML = "";
        for (let i = 0; i < openCount; i++) {
          const label = document.createElement("label");
          label.style.margin = "0";
          label.innerHTML = `
            <span style="font-size: 0.8rem;">Bobina ${i + 1} - Frazione rimanente:</span>
            <select class="add-to-stock-fraction-select" data-index="${i}" style="width: 100%;">
              <option value="1">Piena (1/1)</option>
              <option value="0.75">3/4</option>
              <option value="0.5">Mezza (1/2)</option>
              <option value="0.25">1/4</option>
              <option value="0.1">Quasi finita (1/10)</option>
            </select>
          `;
          openSpoolsContainer.appendChild(label);
        }
      } else if (openSpoolsSection) {
        openSpoolsSection.style.display = "none";
      }
    };

    // Rimuovi vecchi listener e aggiungi nuovi
    const newOpenInput = openInput.cloneNode(true);
    openInput.parentNode.replaceChild(newOpenInput, openInput);
    newOpenInput.addEventListener("input", updateOpenSpoolsSection);

    // Apri modal
    openModalCentered("addToStockModal");
  }

  // Funzione per chiudere il modal "Aggiungi al magazzino"
  function closeAddToStockModal() {
    closeModalCentered("addToStockModal");
  }

  // Funzione per applicare l'aggiunta al magazzino
  function applyAddToStock() {
    try {
      const value = id => document.getElementById(id)?.value ?? "";
      const qty = requireSpoolNumber(value("addToStockQty"), "Quantità", true);
      const sealed = requireSpoolNumber(value("addToStockSealed"), "Bobine sigillate", true);
      const open = requireSpoolNumber(value("addToStockOpen"), "Bobine aperte", true);
      if (sealed + open !== qty) throw new Error("Sigillate e aperte devono coincidere con la quantità trasferita.");
      const controls = document.querySelectorAll("#addToStockOpenSpoolsListContainer .add-to-stock-fraction-select");
      if (open !== controls.length) throw new Error("Imposta la frazione residua per ogni bobina aperta.");
      const fractions = Array.from(controls, control => Number(control.value));
      const price = value("addToStockPrice").trim();
      if (transferPurchasedSpools(value("addToStockPurchasedId"), qty, sealed, fractions, price === "" ? null : Number(price), value("addToStockSupplier").trim()) === false) return;
      closeAddToStockModal();
      playSuccessSound();
      showToast(`${qty} bobine trasferite al magazzino.`, "success");
    } catch (error) { showToast(error.message, "error"); }
  }

  // Calcolo centralizzato dei pesi residui/usati per un singolo filamento
  function recalcWeightsForFilament(f) {
    normalizeFilamentSpools(f);
    const remaining = (f.sealed_spools + f.open_spools_fractions.reduce((sum, fraction) => sum + fraction, 0)) * f.unit_weight_g;
    f.remaining_weight_g = Math.round(remaining * 1000000) / 1000000;
    f.used_weight_g = Math.max(0, f.total_weight_g - f.remaining_weight_g);
    return f;
  }

  // Salvataggio automatico con debounce
  let autoSaveTimeout = null;
  let lastSaveTime = null;
  const AUTO_SAVE_DEBOUNCE_MS = 2000; // 2 secondi di attesa dopo l'ultima modifica
  const AUTO_SAVE_INTERVAL_MS = 30000; // Salvataggio periodico ogni 30 secondi
  let autoSaveIntervalId = null;
  let isSaving = false;

  // Funzione per incrementare la versione
  function incrementVersion() {
    // Compatibilità con i chiamanti storici: la versione identifica il codice.
    APP_VERSION = INITIAL_VERSION;
    updateVersionUI();
  }

  // Funzione per aggiornare il titolo e il badge con la versione corrente
  function updateVersionUI() {
    try {
      const baseTitle = "Registro Filamenti 3D - Magazzino locale";
      if (typeof document !== "undefined") {
        document.title = `${APP_VERSION} - ${baseTitle}`;
      }
      const headerTitle = document.querySelector("header h1");
      if (headerTitle) {
        let badge = document.getElementById("appVersionBadge");
        if (!badge) {
          badge = document.createElement("span");
          badge.id = "appVersionBadge";
          badge.className = "badge";
          headerTitle.appendChild(badge);
        }
        badge.textContent = APP_VERSION;
      }
      // Aggiorna anche window.APP_VERSION
      if (typeof window !== 'undefined') {
        window.APP_VERSION = APP_VERSION;
      }
    } catch (e) {
      console.error("Errore nell'aggiornare la versione UI:", e);
    }
  }

  // Funzione per caricare la versione da localStorage
  function loadVersion() {
    APP_VERSION = INITIAL_VERSION;
    updateVersionUI();
  }

  // Schema unico: i cataloghi mantengono i nomi dei backup precedenti.
  const STATE_SCHEMA_VERSION = 4;
  const LAST_GOOD_STATE_KEY = STORAGE_KEY + "_lastGood";
  let dataRevision = 0;
  let appSettings = { theme: "dark", lowStockThreshold: 25 };
  let stateReady = false;
  let storageWriteBlocked = false;
  let storageBlockReason = "";
  let lastKnownStorageRaw = null;
  let lastKnownStorageValid = false;
  let lastSavedPayload = "";
  let isApplyingState = false;
  let storageListenerInstalled = false;

  function makeStableId(prefix = "id") {
    const suffix = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    return prefix + "-" + suffix;
  }

  function cloneStateValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseImportNumber(value, label, options = {}) {
    if ((value === null || value === undefined || value === "") && options.optional) return null;
    let parsed = value;
    if (typeof parsed === "string") {
      let text = parsed.trim().replace(/^€\s*|\s*€$/g, "").replace(/\s/g, "");
      // Nei file italiani la virgola è decimale; i punti prima della virgola sono migliaia.
      if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, "");
      if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) throw new Error(label + ": numero non valido");
      parsed = Number(text.replace(",", "."));
    }
    if (typeof parsed !== "number" || !Number.isFinite(parsed) ||
        parsed < (options.min === undefined ? 0 : options.min) ||
        (options.max !== undefined && parsed > options.max) ||
        (options.integer && !Number.isSafeInteger(parsed))) {
      throw new Error(label + ": valore fuori intervallo");
    }
    return parsed;
  }

  function requireRecord(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + ": oggetto richiesto");
    return value;
  }

  function validateText(value, label, fallback = "") {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "string") throw new Error(label + ": testo richiesto");
    return value;
  }

  function validateTextList(value, label, fallback = []) {
    if (value === undefined) return [...fallback];
    if (!Array.isArray(value)) throw new Error(label + ": elenco richiesto");
    return Array.from(new Set(value.map(item => validateText(item, label))));
  }

  function validateStateCandidate(input, includeHistory = true) {
    const source = requireRecord(input, "Registro");
    if (source.schemaVersion !== undefined && source.schemaVersion !== STATE_SCHEMA_VERSION) {
      throw new Error("Versione del formato non supportata: " + source.schemaVersion);
    }
    if (!Array.isArray(source.filaments)) throw new Error("Elenco filamenti mancante o non valido");
    if (source.filaments.length > 10000) throw new Error("Il registro supera 10.000 filamenti");
    if (source.schemaVersion === STATE_SCHEMA_VERSION) {
      for (const key of ["purchasedFilaments", "brands", "materials", "colors", "consumptionHistory", "locations"]) {
        if (!Array.isArray(source[key])) throw new Error("Snapshot v4 incompleto: " + key);
      }
      requireRecord(source.settings, "Impostazioni v4");
    }
    const ids = new Set();
    const allSpoolIds = new Set();
    let activeSpoolCount = 0;
    const candidateFilaments = source.filaments.map((record, index) => {
      const f = cloneStateValue(requireRecord(record, "Filamento " + (index + 1)));
      for (const field of ["id", "brand", "material", "variant", "color_code", "supplier", "notes", "location", "packaging_type", "source_purchase_id"]) {
        f[field] = validateText(f[field], "Filamento: " + field);
      }
      f.id = f.id || makeStableId("fil");
      if (ids.has(f.id)) throw new Error("ID filamento duplicato: " + f.id);
      ids.add(f.id);
      f.brand = canonicalizeBrand(f.brand);
      f.material = canonicalizeMaterial(f.material);
      if (!f.location && f.shelf_position !== undefined) f.location = validateText(f.shelf_position, "Posizione legacy");
      if (f.spool_state_version !== undefined && f.spool_state_version !== 1) throw new Error("Versione bobine non supportata");
      const packaging = f.packaging_type.toLowerCase();
      f.packaging_type = ["refill", "ricarica", "senza bobina"].includes(packaging) ? "refill" : "spool";
      for (const field of ["sealed_spools", "open_spools", "finished_spools", "spools_total"]) {
        if (f[field] !== undefined) f[field] = parseImportNumber(f[field], field, { integer: true, max: 100000 });
      }
      f.sealed_spools = f.sealed_spools === undefined ? 0 : f.sealed_spools;
      f.open_spools = f.open_spools === undefined ? 0 : f.open_spools;
      activeSpoolCount += f.sealed_spools + f.open_spools;
      if (activeSpoolCount > 100000) throw new Error("Il registro supera 100.000 bobine attive");
      f.unit_weight_g = parseImportNumber(f.unit_weight_g, "Peso unitario", { min: Number.MIN_VALUE });
      for (const field of ["total_weight_g", "remaining_weight_g", "used_weight_g", "removed_weight_g"]) {
        if (f[field] !== undefined) f[field] = parseImportNumber(f[field], field);
      }
      f.unit_price = parseImportNumber(f.unit_price ?? f.price_per_spool_eur, "Prezzo unitario", { optional: true });
      if (f.main_fraction !== undefined) f.main_fraction = parseImportNumber(f.main_fraction, "Frazione residua", { max: 1 });
      if (f.open_spools_fractions !== undefined) {
        if (!Array.isArray(f.open_spools_fractions)) throw new Error("Frazioni bobine: elenco richiesto");
        f.open_spools_fractions = f.open_spools_fractions.map(value => parseImportNumber(value, "Frazione bobina", { max: 1 }));
        if (f.spool_state_version === 1 && f.open_spools_fractions.length !== f.open_spools) throw new Error("Numero frazioni incoerente con le bobine aperte");
      }
      for (const field of ["spools_locations", "spools_variants", "spools_ids"]) {
        if (f[field] !== undefined) {
          if (!Array.isArray(f[field])) throw new Error(field + ": elenco richiesto");
          f[field] = f[field].map(value => validateText(value, field));
        }
      }
      if (f.spool_state_version === 1) {
        if (!Array.isArray(f.open_spools_fractions) || f.open_spools_fractions.length !== f.open_spools) throw new Error("Frazioni bobine v1 incomplete");
        for (const field of ["spools_locations", "spools_variants", "spools_ids"]) {
          if (!Array.isArray(f[field]) || f[field].length !== f.sealed_spools + f.open_spools) throw new Error(field + ": lunghezza incoerente con le bobine attive");
        }
        if (f.spools_ids.some(id => !id) || new Set(f.spools_ids).size !== f.spools_ids.length) throw new Error("Identità bobine duplicate o mancanti");
        for (const id of f.spools_ids) {
          if (allSpoolIds.has(id)) throw new Error("Identità bobina condivisa tra filamenti: " + id);
          allSpoolIds.add(id);
        }
      }
      if (f.spools_prices !== undefined) {
        if (!Array.isArray(f.spools_prices)) throw new Error("Prezzi bobine: elenco richiesto");
        f.spools_prices = f.spools_prices.map(value => parseImportNumber(value, "Prezzo bobina", { optional: true }));
      }
      recalcWeightsForFilament(f);
      return f;
    });
    const purchaseIds = new Set();
    if (source.purchasedFilaments !== undefined && !Array.isArray(source.purchasedFilaments)) throw new Error("Acquisti: elenco richiesto");
    const candidatePurchases = (source.purchasedFilaments || []).map(record => {
      const p = cloneStateValue(requireRecord(record, "Acquisto"));
      for (const field of ["id", "brand", "material", "variant", "color_code", "sku", "order_number", "order_date", "packaging_type"]) {
        p[field] = validateText(p[field], "Acquisto: " + field);
      }
      p.id = p.id || makeStableId("purchase");
      if (purchaseIds.has(p.id)) throw new Error("ID acquisto duplicato: " + p.id);
      purchaseIds.add(p.id);
      p.brand = canonicalizeBrand(p.brand);
      p.material = canonicalizeMaterial(p.material);
      p.quantity_spools = parseImportNumber(p.quantity_spools ?? p.quantitySpools ?? 0, "Quantità acquisto", { integer: true });
      if (p.quantity_purchased_original !== undefined) p.quantity_purchased_original = parseImportNumber(p.quantity_purchased_original, "Quantità acquistata originale", { integer: true });
      if (p.quantity_purchased_original !== undefined && p.quantity_purchased_original < p.quantity_spools) throw new Error("Quantità acquistata originale inferiore a quella residua");
      p.unit_price = parseImportNumber(p.unit_price, "Prezzo acquisto", { optional: true });
      p.unit_weight_g = parseImportNumber(p.unit_weight_g, "Peso acquisto", { optional: true, min: Number.MIN_VALUE });
      return p;
    });
    if (source.consumptionHistory !== undefined && !Array.isArray(source.consumptionHistory)) throw new Error("Consumi: elenco richiesto");
    const consumptionIds = new Set();
    const candidateConsumption = (source.consumptionHistory || []).map(record => {
      const entry = cloneStateValue(requireRecord(record, "Consumo"));
      for (const field of ["id", "filamentId", "brand", "material", "variant", "timestamp"]) entry[field] = validateText(entry[field], "Consumo: " + field);
      entry.id = entry.id || makeStableId("cons");
      if (consumptionIds.has(entry.id)) throw new Error("ID consumo duplicato: " + entry.id);
      consumptionIds.add(entry.id);
      if (!Number.isFinite(Date.parse(entry.timestamp))) throw new Error("Data consumo non valida");
      entry.gramsConsumed = parseImportNumber(entry.gramsConsumed, "Grammi consumati", { min: Number.MIN_VALUE });
      return entry;
    });
    const settings = source.settings === undefined ? {} : requireRecord(source.settings, "Impostazioni");
    const theme = settings.theme === undefined ? "dark" : settings.theme;
    if (!["dark", "light"].includes(theme)) throw new Error("Tema non valido");
    const inferredLocations = candidateFilaments.flatMap(f => [f.location, ...(f.spools_locations || [])]).filter(Boolean);
    const candidate = {
      schemaVersion: STATE_SCHEMA_VERSION,
      app_version: INITIAL_VERSION,
      data_revision: parseImportNumber(source.data_revision ?? 0, "Revisione dati", { integer: true }),
      filaments: candidateFilaments,
      purchasedFilaments: candidatePurchases,
      brands: cleanBrandList(validateTextList(source.brands, "Marche", defaultBrands).concat(candidateFilaments.map(f => f.brand), candidatePurchases.map(p => p.brand))),
      materials: cleanMaterialList(validateTextList(source.materials, "Materiali", defaultMaterialsOrdered).concat(candidateFilaments.map(f => f.material), candidatePurchases.map(p => p.material))),
      colors: validateTextList(source.colors, "Colori", defaultColors),
      consumptionHistory: candidateConsumption,
      locations: validateTextList(source.locations, "Posizioni", inferredLocations),
      settings: { theme, lowStockThreshold: parseImportNumber(settings.lowStockThreshold ?? 25, "Soglia scorte", { max: 100 }) }
    };
    if (includeHistory) {
      for (const key of ["undoStack", "redoStack"]) {
        if (source[key] !== undefined && !Array.isArray(source[key])) throw new Error("Cronologia non valida");
        candidate[key] = (source[key] || []).slice(-MAX_UNDO_HISTORY).map(snapshot => ({
          ...validateStateCandidate(snapshot, false),
          actionDescription: validateText(snapshot.actionDescription, "Descrizione azione", "Azione"),
          timestamp: validateText(snapshot.timestamp, "Data azione", new Date().toISOString())
        }));
      }
    }
    return candidate;
  }

  function captureStateSnapshot(includeHistory = false) {
    const state = {
      schemaVersion: STATE_SCHEMA_VERSION, app_version: INITIAL_VERSION, data_revision: dataRevision,
      filaments, purchasedFilaments, brands: brandList, materials: materialList, colors: colorList,
      consumptionHistory, locations: locationList, settings: appSettings
    };
    if (includeHistory) Object.assign(state, { undoStack, redoStack });
    return cloneStateValue(state);
  }

  function applyStateSnapshot(state, restoreHistory = false, refreshSettings = true) {
    const snapshot = cloneStateValue(state);
    filaments = snapshot.filaments;
    purchasedFilaments = snapshot.purchasedFilaments;
    brandList = snapshot.brands;
    materialList = snapshot.materials;
    colorList = snapshot.colors;
    consumptionHistory = snapshot.consumptionHistory;
    locationList = snapshot.locations;
    appSettings = snapshot.settings;
    if (restoreHistory) {
      undoStack = snapshot.undoStack || [];
      redoStack = snapshot.redoStack || [];
    }
    if (refreshSettings) {
      isApplyingState = true;
      try { applyTheme(appSettings.theme); } finally { isApplyingState = false; }
    }
  }

  function statePayload(state) {
    const payload = { ...state };
    delete payload.data_revision;
    delete payload.saved_at;
    return JSON.stringify(payload);
  }

  function reportStorageError(message, error) {
    console.error(message, error || "");
    updateAutoSaveIndicator(false);
    showToast(message + " Esporta un backup prima di chiudere la pagina.", "error");
  }

  function commitMutation(actionDescription, mutate) {
    if (!stateReady || storageWriteBlocked) {
      reportStorageError(storageBlockReason || "Il registro non è pronto per le modifiche.");
      return false;
    }
    const before = captureStateSnapshot(true);
    try {
      saveStateForUndo(actionDescription);
      mutate();
      const candidate = validateStateCandidate(captureStateSnapshot(true));
      applyStateSnapshot(candidate, true);
      if (!saveState()) { applyStateSnapshot(before, true); updateHistoryUI(); return false; }
      updateHistoryUI();
      return true;
    } catch (error) {
      applyStateSnapshot(before, true);
      updateHistoryUI();
      showToast("Modifica non applicata: " + error.message, "error");
      return false;
    }
  }

  function installStorageConflictListener() {
    if (storageListenerInstalled) return;
    storageListenerInstalled = true;
    window.addEventListener("storage", event => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.newValue !== lastKnownStorageRaw) {
        storageWriteBlocked = true;
        storageBlockReason = "Il registro è cambiato in un'altra scheda. Esporta le modifiche di questa scheda e ricarica.";
        reportStorageError(storageBlockReason);
      }
    });
  }

  // Funzione di salvataggio effettivo
  function saveState(shouldIncrementVersion = false) {
    // Il parametro legacy resta accettato: la versione app non cambia con i dati.
    if (isSaving || !stateReady) return false;
    if (storageWriteBlocked) {
      reportStorageError(storageBlockReason || "Salvataggio bloccato per proteggere i dati.");
      return false;
    }
    isSaving = true;
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (currentRaw !== lastKnownStorageRaw) {
        storageWriteBlocked = true;
        storageBlockReason = "Un'altra scheda ha modificato il registro. Esporta questa copia e ricarica.";
        throw new Error(storageBlockReason);
      }
      const state = validateStateCandidate(captureStateSnapshot(true));
      const payload = statePayload(state);
      if (payload === lastSavedPayload && currentRaw !== null) {
        updateAutoSaveIndicator(true);
        return true;
      }
      state.data_revision = dataRevision + 1;
      state.saved_at = new Date().toISOString();
      const raw = JSON.stringify(state);
      // setItem sulla chiave principale è atomico: un errore quota conserva il registro precedente.
      // La copia precedente è facoltativa e non impedisce il salvataggio principale se lo spazio è poco.
      let recoveryWarning = false;
      if (currentRaw !== null && lastKnownStorageValid) {
        try { localStorage.setItem(LAST_GOOD_STATE_KEY, currentRaw); }
        catch (error) { recoveryWarning = true; console.warn("Copia precedente non aggiornata:", error); }
      }
      try {
        localStorage.setItem(STORAGE_KEY, raw);
      } catch (error) {
        const quotaExceeded = error.name === "QuotaExceededError" || /QuotaExceededError|quota/i.test(error.message || "");
        if (!quotaExceeded || localStorage.getItem(LAST_GOOD_STATE_KEY) === null) throw error;
        // Libera esclusivamente la copia secondaria; il registro precedente resta nella chiave primaria
        // fino alla riuscita del singolo nuovo tentativo. Non si riduce la cronologia per nascondere l'errore.
        localStorage.removeItem(LAST_GOOD_STATE_KEY);
        recoveryWarning = true;
        localStorage.setItem(STORAGE_KEY, raw);
      }
      lastKnownStorageRaw = raw;
      lastKnownStorageValid = true;
      lastSavedPayload = payload;
      dataRevision = state.data_revision;
      // Anche la memoria adotta gli stessi valori normalizzati (incluse identità bobine).
      applyStateSnapshot(state, true, false);
      lastSaveTime = Date.now();
      updateAutoSaveIndicator(true);
      if (recoveryWarning) showToast("Registro salvato; spazio insufficiente per aggiornare la copia precedente. Esporta un backup.", "warning");
      return true;
    } catch (error) {
      reportStorageError(storageBlockReason || "Salvataggio non riuscito: " + error.message, error);
      return false;
    } finally {
      isSaving = false;
    }
  }

  function autoSave() {
    if (!stateReady || storageWriteBlocked) return;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    updateAutoSaveIndicator(null, true);
    autoSaveTimeout = setTimeout(() => {
      autoSaveTimeout = null;
      saveState();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  function startPeriodicAutoSave() {
    if (autoSaveIntervalId) clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = setInterval(() => {
      if (stateReady && !storageWriteBlocked && (!lastSaveTime || Date.now() - lastSaveTime >= AUTO_SAVE_DEBOUNCE_MS)) saveState();
    }, AUTO_SAVE_INTERVAL_MS);
    installStorageConflictListener();
  }

  function setupBeforeUnloadSave() {
    const flush = () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = null;
      return !stateReady || (!storageWriteBlocked && saveState());
    };
    window.addEventListener("beforeunload", event => {
      if (!flush()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden && !storageWriteBlocked) flush(); });
  }

  // Aggiorna indicatore visivo del salvataggio
  function updateAutoSaveIndicator(success = null, saving = false) {
    let indicator = document.getElementById("autoSaveIndicator");
    
    if (!indicator) {
      // Crea l'indicatore se non esiste
      indicator = document.createElement("div");
      indicator.id = "autoSaveIndicator";
      indicator.style.cssText = `
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        padding: 0.5rem 0.75rem;
        background: var(--surface-strong);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        font-size: 0.75rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: opacity 0.3s ease;
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(indicator);
    }
    
    if (saving) {
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416" stroke-linecap="round">
            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
          </circle>
        </svg>
        <span>Salvataggio...</span>
      `;
      indicator.style.opacity = "1";
    } else if (success === true) {
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; color: #22c55e;">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Salvato</span>
      `;
      indicator.style.opacity = "1";
      // Nascondi dopo 2 secondi
      setTimeout(() => {
        indicator.style.opacity = "0";
      }, 2000);
    } else if (success === false) {
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; color: #ef4444;">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Errore salvataggio</span>
      `;
      indicator.style.opacity = "1";
      setTimeout(() => {
        indicator.style.opacity = "0";
      }, 3000);
    }
  }

  // Aggiungi animazione spin per il loader
  if (!document.getElementById("autoSaveIndicatorStyle")) {
    const style = document.createElement("style");
    style.id = "autoSaveIndicatorStyle";
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Funzione per salvare solo le posizioni (usata quando si modificano le posizioni)
  function saveLocationList() {
    return saveState();
  }

  // Salva lo stato per undo/redo
  function saveStateForUndo(actionDescription = "Azione") {
    if (!stateReady || storageWriteBlocked) return false;
    undoStack.push({ ...captureStateSnapshot(), actionDescription, timestamp: new Date().toISOString() });
    if (undoStack.length > MAX_UNDO_HISTORY) undoStack.shift();
    redoStack = [];
    updateHistoryUI();
    return true;
  }

  function undoAction() {
    if (!undoStack.length) return showToast("Nessuna azione da annullare", "info");
    const before = captureStateSnapshot(true);
    const previous = undoStack.pop();
    redoStack.push({ ...captureStateSnapshot(), actionDescription: previous.actionDescription, timestamp: new Date().toISOString() });
    applyStateSnapshot(validateStateCandidate(previous, false));
    if (!saveState()) { applyStateSnapshot(before, true); updateHistoryUI(); return; }
    renderAll();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    updateHistoryUI();
    showToast("Annullato: " + previous.actionDescription, "success");
  }

  function redoAction() {
    if (!redoStack.length) return showToast("Nessuna azione da ripristinare", "info");
    const before = captureStateSnapshot(true);
    const next = redoStack.pop();
    undoStack.push({ ...captureStateSnapshot(), actionDescription: next.actionDescription, timestamp: new Date().toISOString() });
    if (undoStack.length > MAX_UNDO_HISTORY) undoStack.shift();
    applyStateSnapshot(validateStateCandidate(next, false));
    if (!saveState()) { applyStateSnapshot(before, true); updateHistoryUI(); return; }
    renderAll();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    updateHistoryUI();
    showToast("Ripristinato: " + next.actionDescription, "success");
  }

  function updateHistoryUI() {
    const undoBtn = document.getElementById("undoButton");
    const redoBtn = document.getElementById("redoButton");
    const historyList = document.getElementById("historyList");
    const undoDropdown = document.getElementById("undoDropdown");
    const redoDropdown = document.getElementById("redoDropdown");
    const undoDropdownList = document.getElementById("undoDropdownList");
    const redoDropdownList = document.getElementById("redoDropdownList");
    
    if (undoBtn) {
      undoBtn.disabled = undoStack.length === 0;
      undoBtn.title = undoStack.length > 0 
        ? `Annulla: ${undoStack[undoStack.length - 1].actionDescription}`
        : "Nessuna azione da annullare";
    }
    
    if (redoBtn) {
      redoBtn.disabled = redoStack.length === 0;
      redoBtn.title = redoStack.length > 0
        ? `Ripristina: ${redoStack[redoStack.length - 1].actionDescription}`
        : "Nessuna azione da ripristinare";
    }
    
    // Aggiorna dropdown undo (ultime 5 azioni)
    if (undoDropdownList) {
      undoDropdownList.innerHTML = "";
      const recentUndo = [...undoStack].slice(-5).reverse(); // Ultime 5, più recente prima
      
      if (recentUndo.length === 0) {
        undoDropdownList.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted); font-size: 0.75rem; text-align: center;">Nessuna azione</div>';
      } else {
        recentUndo.forEach((state, index) => {
          const item = document.createElement("div");
          item.className = "undo-redo-dropdown-item";
          item.style.cssText = "padding: 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border-subtle); font-size: 0.8rem; transition: background 0.2s;";
          item.addEventListener("mouseenter", () => {
            item.style.background = "var(--surface-soft)";
          });
          item.addEventListener("mouseleave", () => {
            item.style.background = "transparent";
          });
          
          const date = new Date(state.timestamp);
          const timeStr = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
          item.innerHTML = `
            <div style="font-weight: 500; color: var(--text-main);">${escapeHtml(state.actionDescription)}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">${timeStr}</div>
          `;
          
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            // Annulla fino a questo punto (index 0 = più recente, quindi annulla index+1 volte)
            for (let i = 0; i <= index; i++) {
              undoAction();
            }
            if (undoDropdown) undoDropdown.style.display = "none";
          });
          
          undoDropdownList.appendChild(item);
        });
      }
    }
    
    // Aggiorna dropdown redo (ultime 5 azioni)
    if (redoDropdownList) {
      redoDropdownList.innerHTML = "";
      const recentRedo = [...redoStack].slice(-5).reverse(); // Ultime 5, più recente prima
      
      if (recentRedo.length === 0) {
        redoDropdownList.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted); font-size: 0.75rem; text-align: center;">Nessuna azione</div>';
      } else {
        recentRedo.forEach((state, index) => {
          const item = document.createElement("div");
          item.className = "undo-redo-dropdown-item";
          item.style.cssText = "padding: 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border-subtle); font-size: 0.8rem; transition: background 0.2s;";
          item.addEventListener("mouseenter", () => {
            item.style.background = "var(--surface-soft)";
          });
          item.addEventListener("mouseleave", () => {
            item.style.background = "transparent";
          });
          
          const date = new Date(state.timestamp);
          const timeStr = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
          item.innerHTML = `
            <div style="font-weight: 500; color: var(--text-main);">${escapeHtml(state.actionDescription)}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">${timeStr}</div>
          `;
          
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            // Ripristina fino a questo punto (index 0 = più recente, quindi ripristina index+1 volte)
            for (let i = 0; i <= index; i++) {
              redoAction();
            }
            if (redoDropdown) redoDropdown.style.display = "none";
          });
          
          redoDropdownList.appendChild(item);
        });
      }
    }
    
    if (historyList) {
      renderHistoryList();
    }
  }

  // Funzione per tornare a uno stato specifico nella cronologia
  function restoreToHistoryState(targetIndex) {
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= undoStack.length) return;
    const previous = captureStateSnapshot(true);
    const target = undoStack[targetIndex];
    redoStack.push({ ...captureStateSnapshot(), actionDescription: target.actionDescription, timestamp: new Date().toISOString() });
    undoStack = undoStack.slice(0, targetIndex);
    applyStateSnapshot(validateStateCandidate(target, false));
    if (!saveState()) { applyStateSnapshot(previous, true); updateHistoryUI(); return; }
    refreshStateViews();
    showToast("Ripristinato a: " + target.actionDescription, "success");
  }

  // Renderizza la lista della cronologia
  function renderHistoryList() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;
    
    historyList.innerHTML = "";
    
    // Mostra le ultime 10 azioni (più recenti in cima)
    const recentHistory = [...undoStack].reverse().slice(0, 10);
    
    if (recentHistory.length === 0) {
      historyList.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Nessuna azione nella cronologia</div>';
      return;
    }
    
    recentHistory.forEach((state, displayIndex) => {
      // Calcola l'indice reale nello stack (dal più recente al più vecchio)
      const realIndex = undoStack.length - 1 - displayIndex;
      
      const item = document.createElement("div");
      item.style.cssText = "padding: 0.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; cursor: pointer; transition: background 0.2s;";
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--surface-soft)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", () => {
        restoreToHistoryState(realIndex);
      });
      item.title = "Clicca per tornare a questo punto";
      
      const leftDiv = document.createElement("div");
      leftDiv.style.cssText = "display: flex; align-items: center; gap: 0.5rem; flex: 1;";
      
      const icon = document.createElement("span");
      icon.innerHTML = "↩";
      icon.style.cssText = "font-size: 1rem; color: var(--accent);";
      
      const description = document.createElement("span");
      description.textContent = state.actionDescription;
      description.style.cssText = "color: var(--text-main);";
      
      leftDiv.appendChild(icon);
      leftDiv.appendChild(description);
      
      const time = document.createElement("span");
      const date = new Date(state.timestamp);
      time.textContent = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      time.style.cssText = "color: var(--text-muted); font-size: 0.75rem;";
      
      item.appendChild(leftDiv);
      item.appendChild(time);
      historyList.appendChild(item);
    });
  }

  function loadState() {
    stateReady = false;
    storageWriteBlocked = false;
    storageBlockReason = "";
    lastKnownStorageValid = false;
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      lastKnownStorageRaw = currentRaw;
      let raw = currentRaw;
      if (raw === null) {
        for (const key of ["registroFilamentiState_v2", "registroFilamentiState_v1", "registroFilamentiState"]) {
          const old = localStorage.getItem(key);
          if (old !== null) { raw = old; break; }
        }
      }
      let input = raw === null ? { filaments: [], purchasedFilaments: [] } : JSON.parse(raw);
      requireRecord(input, "Registro salvato");
      if (input.schemaVersion === undefined) {
        // Solo la migrazione legge le chiavi separate. Dopo il primo salvataggio il v4 è autorevole.
        const readLegacy = (key, fallback) => {
          const value = localStorage.getItem(key);
          return value === null ? fallback : JSON.parse(value);
        };
        input = { ...input };
        input.brands = input.brands ?? readLegacy(BRAND_LIST_KEY, defaultBrands);
        input.materials = input.materials ?? readLegacy(MATERIAL_LIST_KEY, defaultMaterialsOrdered);
        input.colors = input.colors ?? readLegacy(COLOR_LIST_KEY, defaultColors);
        input.locations = input.locations ?? readLegacy(LOCATION_LIST_KEY, undefined);
        input.consumptionHistory = input.consumptionHistory ?? readLegacy(CONSUMPTION_HISTORY_KEY, []);
        input.settings = input.settings ?? {
          theme: localStorage.getItem(THEME_KEY) || "dark",
          lowStockThreshold: localStorage.getItem(LOW_STOCK_THRESHOLD_KEY) ?? 25
        };
        // Gli snapshot legacy non comprendono consumi/posizioni e non possono garantire un undo coerente.
        input.undoStack = [];
        input.redoStack = [];
      }
      const candidate = validateStateCandidate(input);
      applyStateSnapshot(candidate, true);
      dataRevision = candidate.data_revision;
      lastKnownStorageValid = true;
      lastSavedPayload = input.schemaVersion === STATE_SCHEMA_VERSION ? statePayload(candidate) : "";
      stateReady = true;
      installStorageConflictListener();
      return true;
    } catch (error) {
      storageWriteBlocked = true;
      storageBlockReason = "Dati salvati non validi: " + error.message + ". Il registro originale non verrà sovrascritto.";
      reportStorageError(storageBlockReason, error);
      return false;
    }
  }

  // Funzione helper per generare le opzioni dei dropdown posizione
  function generateLocationOptions(selectedValue = "") {
    // Normalizza il valore selezionato per il confronto (trim, lowercase)
    const normalizedSelected = selectedValue ? selectedValue.trim().toLowerCase() : "";
    
    return `
      <option value="">Nessuna posizione</option>
      ${locationList.map(loc => {
        const normalizedLoc = loc ? loc.trim().toLowerCase() : "";
        const isSelected = normalizedLoc === normalizedSelected && normalizedSelected !== "";
        return `<option value="${escapeHtml(loc)}" ${isSelected ? "selected" : ""}>${escapeHtml(loc)}</option>`;
      }).join("")}
    `;
  }
  
  // Funzione per renderizzare la lista delle posizioni nelle impostazioni
  function renderLocationsList() {
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
      input.dataset.index = index;
      
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "btn-secondary btn-xs";
      renameBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Rinomina</span>
      `;
      renameBtn.addEventListener("click", () => {
        const newName = input.value.trim();
        if (!newName) {
          showToast("Il nome della posizione non può essere vuoto.", "error");
          return;
        }
        if (newName === location) {
          return; // Nessun cambiamento
        }
        if (locationList.some((name, candidateIndex) => candidateIndex !== index && name.toLocaleLowerCase("it-IT") === newName.toLocaleLowerCase("it-IT"))) {
          showToast("Una posizione con questo nome esiste già.", "error");
          return;
        }
        
        const oldName = location;
        if (!commitMutation(`Rinominata posizione: ${oldName}`, () => {
          locationList[index] = newName;
          filaments.forEach(f => {
            if (f.location === oldName) f.location = newName;
            if (Array.isArray(f.spools_locations)) {
              f.spools_locations = f.spools_locations.map(loc => loc === oldName ? newName : loc);
            }
          });
        })) return;
        renderAll();
        renderLocationsList();
        showToast(`Posizione "${oldName}" rinominata in "${newName}".`, "success");
      });
      
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-danger btn-xs";
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>Elimina</span>
      `;
      deleteBtn.addEventListener("click", () => {
        // Controlla se ci sono filamenti che usano questa posizione
        const usedInFilaments = filaments.some(f => 
          f.location === location || 
          (f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.includes(location))
        );
        
        if (usedInFilaments) {
          const ok = window.confirm(
            `La posizione "${location}" è utilizzata da alcuni filamenti. Eliminarla rimuoverà la posizione da tutti i filamenti. Continuare?`
          );
          if (!ok) return;
        }
        if (!commitMutation(`Eliminata posizione: ${location}`, () => {
          locationList.splice(index, 1);
          filaments.forEach(f => {
            if (f.location === location) f.location = "";
            if (Array.isArray(f.spools_locations)) {
              f.spools_locations = f.spools_locations.map(loc => loc === location ? "" : loc);
            }
          });
        })) return;
        renderAll();
        renderLocationsList();
        showToast(`Posizione "${location}" eliminata.`, "success");
      });
      
      item.appendChild(input);
      item.appendChild(renameBtn);
      item.appendChild(deleteBtn);
      container.appendChild(item);
    });
  }

  // =============================================
  // FUNZIONI STORICO CONSUMI
  // =============================================
  
  function loadConsumptionHistory() {
    // Lo storico fa parte dello snapshot atomico già caricato da loadState.
    return consumptionHistory;
  }

  function saveConsumptionHistory() {
    return saveState();
  }

  function addConsumptionEntry(filament, gramsConsumed, options = {}) {
    if (!Number.isFinite(gramsConsumed) || gramsConsumed <= 0) return;
    const entry = {
      id: typeof makeStableId === "function" ? makeStableId("cons") : createSpoolId(),
      timestamp: new Date().toISOString(), filamentId: filament.id, brand: filament.brand,
      material: filament.material, variant: filament.variant, gramsConsumed
    };
    consumptionHistory.push(entry);
    if (options.persist !== false) saveConsumptionHistory();
  }

  function calculateConsumptionByDifference() {
    const grouped = new Map();
    const getEntry = f => {
      const brand = canonicalizeBrand(f.brand || "");
      const material = canonicalizeMaterial(f.material || "");
      const unit = f.unit_weight_g || 1000;
      const key = JSON.stringify([brand, material, (f.variant || "").trim(), (f.color_code || "").trim(), unit]);
      if (!grouped.has(key)) grouped.set(key, { brand, material, variant: f.variant || "", color_code: f.color_code || "", unit_weight_g: unit,
        quantity_spools: 0, total_weight_g: 0, present_weight_g: 0, consumed_weight_g: 0 });
      return grouped.get(key);
    };
    purchasedFilaments.forEach(p => {
      const pending = p.quantity_spools ?? p.quantitySpools ?? 0;
      if (pending <= 0) return;
      const entry = getEntry(p);
      entry.quantity_spools += pending;
      entry.total_weight_g += pending * entry.unit_weight_g;
      entry.present_weight_g += pending * entry.unit_weight_g;
    });
    filaments.forEach(f => {
      const entry = getEntry(f);
      // Il bilancio fisico usa il carico registrato e rettificato dell'inventario.
      // Gli acquisti originali restano nello storico fatture, non vengono sommati due volte.
      entry.quantity_spools += f.spools_total || 0;
      entry.total_weight_g += f.total_weight_g || 0;
      entry.present_weight_g += f.remaining_weight_g || 0;
    });
    const results = Array.from(grouped.values());
    results.forEach(entry => { entry.consumed_weight_g = entry.total_weight_g - entry.present_weight_g; });
    results.sort((a, b) => b.consumed_weight_g - a.consumed_weight_g);
    return { results, totals: results.reduce((totals, entry) => ({
      purchased: totals.purchased + entry.total_weight_g, present: totals.present + entry.present_weight_g,
      consumed: totals.consumed + entry.consumed_weight_g
    }), { purchased: 0, present: 0, consumed: 0 }) };
  }
  
  function renderConsumptionByDifference() {
    const container = document.getElementById("consumptionByDifferenceContainer");
    if (!container) return;
    
    const calc = calculateConsumptionByDifference();
    
    if (calc.results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text">Nessun dato disponibile. Aggiungi filamenti acquistati o presenti in magazzino.</div>
        </div>
      `;
      return;
    }
    
    // Riepilogo totale
    const summaryHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="padding: 1rem; background: var(--surface); border-radius: 0.5rem; border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Massa iniziale registrata</div>
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary);">${formatNumber(calc.totals.purchased, 0)} g</div>
        </div>
        <div style="padding: 1rem; background: var(--surface); border-radius: 0.5rem; border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Presente totale</div>
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--success);">${formatNumber(calc.totals.present, 0)} g</div>
        </div>
        <div style="padding: 1rem; background: var(--surface); border-radius: 0.5rem; border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Consumato totale</div>
          <div style="font-size: 1.5rem; font-weight: 600; color: var(--danger);">${formatNumber(calc.totals.consumed, 0)} g</div>
        </div>
      </div>
    `;
    
    // Tabella dettagliata
    const tableHtml = `
      <div class="history-table-wrapper">
        <table class="history-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Materiale</th>
              <th>Colore</th>
              <th style="text-align: right;">Caricato</th>
              <th style="text-align: right;">Presente</th>
              <th style="text-align: right;">Consumato</th>
            </tr>
          </thead>
          <tbody>
            ${calc.results.map(r => {
              const consumedColor = r.consumed_weight_g > 0 ? "var(--danger)" : r.consumed_weight_g < 0 ? "var(--warning)" : "var(--text-muted)";
              return `
                <tr>
                  <td>${escapeHtml(r.brand || "-")}</td>
                  <td>${escapeHtml(r.material || "-")}</td>
                  <td>${escapeHtml(r.variant || "-")}</td>
                  <td style="text-align: right;">${formatNumber(r.total_weight_g, 0)} g</td>
                  <td style="text-align: right;">${formatNumber(r.present_weight_g, 0)} g</td>
                  <td style="text-align: right; font-weight: 600; color: ${consumedColor};">
                    ${r.consumed_weight_g > 0 ? "+" : ""}${formatNumber(r.consumed_weight_g, 0)} g
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = summaryHtml + tableHtml;
  }

  function renderConsumptionStats() {
    const totalEl = document.getElementById("statTotalConsumed");
    const monthEl = document.getElementById("statThisMonth");
    const avgEl = document.getElementById("statAvgPerDay");
    const entriesEl = document.getElementById("statEntries");

    if (!consumptionHistory.length) {
      if (totalEl) totalEl.textContent = "0 g";
      if (monthEl) monthEl.textContent = "0 g";
      if (avgEl) avgEl.textContent = "0 g";
      if (entriesEl) entriesEl.textContent = "0";
      return;
    }

    const total = consumptionHistory.reduce((sum, e) => sum + (e.gramsConsumed || 0), 0);
    
    const now = new Date();
    const thisMonth = consumptionHistory.filter(e => {
      const d = new Date(e.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + (e.gramsConsumed || 0), 0);

    // Calcola media giornaliera
    const dates = consumptionHistory.map(e => new Date(e.timestamp).toDateString());
    const uniqueDays = new Set(dates).size;
    const avg = uniqueDays > 0 ? Math.round(total / uniqueDays) : 0;

    if (totalEl) totalEl.textContent = formatNumber(total, 0) + " g";
    if (monthEl) monthEl.textContent = formatNumber(thisMonth, 0) + " g";
    if (avgEl) avgEl.textContent = formatNumber(avg, 0) + " g";
    if (entriesEl) entriesEl.textContent = formatNumber(consumptionHistory.length);
  }

  function renderConsumptionHistory() {
    const tbody = document.getElementById("consumptionHistoryBody");
    if (!tbody) return;

    if (!consumptionHistory.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nessun consumo registrato</td></tr>';
      return;
    }

    // Ordina dal più recente
    const sorted = consumptionHistory.slice().sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    tbody.innerHTML = sorted.slice(0, 50).map((entry, idx) => {
      const d = new Date(entry.timestamp);
      const dateStr = d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      const filamentStr = `${entry.brand || ""} ${entry.material || ""} ${entry.variant || ""}`.trim() || "-";
      
      return `<tr>
        <td>${dateStr}</td>
        <td>${escapeHtml(filamentStr)}</td>
        <td style="font-weight:600;color:var(--danger);">-${formatNumber(entry.gramsConsumed, 0)} g</td>
        <td>
          <button type="button" class="btn-xs btn-outline" data-consumption-id="${escapeHtml(entry.id)}" title="Elimina">✕</button>
        </td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("button[data-consumption-id]").forEach(button => {
      button.addEventListener("click", () => deleteConsumptionEntry(button.dataset.consumptionId));
    });
  }

  function deleteConsumptionEntry(entryId) {
    if (!consumptionHistory.some(entry => entry.id === entryId)) return;
    if (!commitMutation("Eliminata voce storico consumi", () => {
      consumptionHistory = consumptionHistory.filter(e => e.id !== entryId);
    })) return;
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    showToast("Voce eliminata dallo storico.", "success");
  }

  function clearAllConsumptionHistory() {
    if (!consumptionHistory.length || !window.confirm("Vuoi davvero cancellare tutto lo storico consumi?")) return;
    if (!commitMutation("Cancellato storico consumi", () => { consumptionHistory = []; })) return;
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    showToast("Storico consumi cancellato.", "success");
  }

  let currentChartView = "7d";

  function renderConsumptionChart() {
    const container = document.getElementById("consumptionChartContainer");
    const legendEl = document.getElementById("chartLegend");
    if (!container) return;

    if (!consumptionHistory.length) {
      container.innerHTML = `
        <div class="chart-empty">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 19h16M4 15l4-4 4 4 8-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <div>Nessun dato di consumo disponibile.</div>
          <div style="font-size:0.75rem;margin-top:0.25rem;">Aggiorna lo stato di un filamento per registrare i consumi.</div>
        </div>`;
      if (legendEl) legendEl.innerHTML = "";
      return;
    }

    // Filtra per periodo
    const now = new Date();
    let filtered = consumptionHistory;
    let daysBack = 7;
    
    if (currentChartView === "7d") {
      daysBack = 7;
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = consumptionHistory.filter(e => new Date(e.timestamp) >= cutoff);
    } else if (currentChartView === "30d") {
      daysBack = 30;
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = consumptionHistory.filter(e => new Date(e.timestamp) >= cutoff);
    } else {
      // Tutto - calcola giorni dal primo al ultimo
      if (consumptionHistory.length > 0) {
        const dates = consumptionHistory.map(e => new Date(e.timestamp));
        const minDate = new Date(Math.min(...dates));
        daysBack = Math.ceil((now - minDate) / (24 * 60 * 60 * 1000)) + 1;
      }
    }

    if (!filtered.length) {
      container.innerHTML = `
        <div class="chart-empty">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 19h16M4 15l4-4 4 4 8-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <div>Nessun consumo nel periodo selezionato.</div>
        </div>`;
      if (legendEl) legendEl.innerHTML = "";
      return;
    }

    // Raggruppa per giorno
    const dailyData = Object.create(null);
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyData[key] = { total: 0, byMaterial: Object.create(null) };
    }

    filtered.forEach(entry => {
      const key = entry.timestamp.slice(0, 10);
      if (!dailyData[key]) {
        dailyData[key] = { total: 0, byMaterial: Object.create(null) };
      }
      dailyData[key].total += entry.gramsConsumed || 0;
      
      const mat = entry.material || "Altro";
      if (!dailyData[key].byMaterial[mat]) {
        dailyData[key].byMaterial[mat] = 0;
      }
      dailyData[key].byMaterial[mat] += entry.gramsConsumed || 0;
    });

    // Prepara dati per grafico
    const sortedDays = Object.keys(dailyData).sort();
    const values = sortedDays.map(k => dailyData[k].total);
    const maxVal = Math.max(...values, 100);

    // Colori per materiali
    const materialColors = {
      "PLA": "#22c55e",
      "PLA Basic": "#22c55e",
      "PLA Matte": "#16a34a",
      "PLA+": "#15803d",
      "PETG": "#3b82f6",
      "PETG HF": "#3b82f6",
      "PETG-CF": "#1d4ed8",
      "ASA": "#f59e0b",
      "ASA-CF": "#d97706",
      "ABS": "#ef4444",
      "TPU": "#8b5cf6",
      "Nylon": "#ec4899",
      "PA6-CF": "#be185d",
      "Altro": "#6b7280"
    };

    // SVG Chart
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const xStep = sortedDays.length > 1 ? chartWidth / (sortedDays.length - 1) : chartWidth;

    // Genera path per linea
    let pathD = "";
    const points = sortedDays.map((day, i) => {
      const x = padding.left + (sortedDays.length > 1 ? i * xStep : chartWidth / 2);
      const y = padding.top + chartHeight - (dailyData[day].total / maxVal) * chartHeight;
      return { x, y, day, value: dailyData[day].total };
    });

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }
    }

    // Area fill
    let areaD = pathD;
    if (points.length > 0) {
      areaD += ` L ${points[points.length - 1].x} ${padding.top + chartHeight}`;
      areaD += ` L ${points[0].x} ${padding.top + chartHeight} Z`;
    }

    // Y axis labels
    const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)];

    // X axis labels (mostra solo alcuni)
    const xLabelStep = Math.max(1, Math.floor(sortedDays.length / 6));

    let svg = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05"/>
          </linearGradient>
        </defs>
        
        <!-- Grid lines -->
        ${yLabels.map(val => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3"/>`;
        }).join("")}
        
        <!-- Y axis labels -->
        ${yLabels.map(val => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          return `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${val}g</text>`;
        }).join("")}
        
        <!-- Area -->
        <path d="${areaD}" fill="url(#areaGradient)"/>
        
        <!-- Line -->
        <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Points -->
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
          <title>${escapeHtml(p.day)}: ${formatNumber(p.value, 0)}g</title>
        `).join("")}
        
        <!-- X axis labels -->
        ${points.filter((_, i) => i % xLabelStep === 0 || i === points.length - 1).map(p => {
          const label = p.day.slice(5); // MM-DD
          return `<text x="${p.x}" y="${height - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${label}</text>`;
        }).join("")}
      </svg>
    `;

    container.innerHTML = svg;

    // Legenda per materiali usati
    const allMaterials = new Set();
    filtered.forEach(e => allMaterials.add(e.material || "Altro"));
    
    if (legendEl && allMaterials.size > 0) {
      legendEl.innerHTML = Array.from(allMaterials).map(mat => {
        const color = Object.hasOwn(materialColors, mat) ? materialColors[mat] : materialColors["Altro"];
        const total = filtered.filter(e => (e.material || "Altro") === mat)
          .reduce((sum, e) => sum + (e.gramsConsumed || 0), 0);
        return `<div class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${color}"></span>
          ${escapeHtml(mat)}: ${formatNumber(total, 0)}g
        </div>`;
      }).join("");
    }
  }

  // =============================================
  // FUNZIONI FILTRI
  // =============================================

  let activeMultiSelectDropdown = null;
  const multiSelectControllers = new Map();

  function initFloatingLayer() {
    let layer = document.getElementById("floating-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "floating-layer";
      document.body.appendChild(layer);
      // Gli editor possono ricostruire i propri campi mentre un menu è aperto.
      new MutationObserver(() => {
        if (activeColorDropdown && !activeColorDropdown.isConnected) closeColorDropdown(activeColorDropdown);
        if (activeMultiSelectDropdown && !activeMultiSelectDropdown.wrapper.isConnected) activeMultiSelectDropdown.close();
      }).observe(document.body, { childList: true, subtree: true });
    }
    return layer;
  }

  function createMultiSelectDropdown(containerId, options, filterKey, placeholder, allLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    multiSelectControllers.get(containerId)?.destroy();
    const controller = new AbortController();
    const listen = (target, type, handler, extra = {}) => target.addEventListener(type, handler, { ...extra, signal: controller.signal });
    const wrapper = document.createElement("div");
    wrapper.className = "multi-select-wrapper";
    wrapper.dataset.filterKey = filterKey;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "multi-select-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", containerId + "Menu");
    const menu = document.createElement("div");
    menu.id = containerId + "Menu";
    menu.className = "multi-select-menu";
    menu.hidden = true;
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "multi-select-options";
    function updateTriggerText() {
      const selected = Array.isArray(stockFilters[filterKey]) ? stockFilters[filterKey] : [];
      const labelFor = value => { const option = options.find(option => (typeof option === "string" ? option : option.value) === value); return typeof option === "string" ? option : option?.label || value; };
      trigger.textContent = !selected.length ? allLabel || placeholder : selected.length === 1 ? labelFor(selected[0]) : selected.length + " selezionati";
    }
    options.forEach(option => {
      const value = typeof option === "string" ? option : option.value;
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = (stockFilters[filterKey] || []).includes(value);
      listen(checkbox, "change", () => {
        const selected = new Set(stockFilters[filterKey] || []);
        if (checkbox.checked) selected.add(value); else selected.delete(value);
        stockFilters[filterKey] = Array.from(selected);
        updateTriggerText();
        renderFilamentTable();
      });
      const text = document.createElement("span");
      text.textContent = typeof option === "string" ? option : option.label;
      label.append(checkbox, text);
      optionsContainer.appendChild(label);
    });
    menu.appendChild(optionsContainer);
    wrapper.append(trigger, menu);
    container.replaceChildren(wrapper);
    updateTriggerText();
    let repositionFrame = 0;
    function positionMenu() {
      if (menu.hidden) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 200), innerWidth - 16);
      menu.style.width = width + "px";
      menu.style.maxHeight = Math.min(300, innerHeight - 16) + "px";
      const height = menu.getBoundingClientRect().height;
      const top = innerHeight - rect.bottom - 8 >= height ? rect.bottom + 4 : rect.top >= height + 8 ? rect.top - height - 4 : Math.max(8, innerHeight - height - 8);
      menu.style.top = top + "px";
      menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + "px";
    }
    function reposition() { cancelAnimationFrame(repositionFrame); repositionFrame = requestAnimationFrame(positionMenu); }
    function closeMenu(restoreFocus = false) {
      cancelAnimationFrame(repositionFrame);
      menu.hidden = true;
      menu.classList.remove("is-portal-active");
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      wrapper.appendChild(menu);
      menu.removeAttribute("style");
      if (activeMultiSelectDropdown === api) activeMultiSelectDropdown = null;
      document.body.classList.remove("dropdown-open");
      if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }
    function openMenu() {
      if (activeMultiSelectDropdown) activeMultiSelectDropdown.close();
      if (activeColorDropdown) closeColorDropdown(activeColorDropdown);
      menu.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
        checkbox.checked = (stockFilters[filterKey] || []).includes(checkbox.value);
      });
      updateTriggerText();
      activeMultiSelectDropdown = api;
      initFloatingLayer().appendChild(menu);
      menu.hidden = false;
      menu.classList.add("is-portal-active");
      wrapper.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      document.body.classList.add("dropdown-open");
      positionMenu();
      requestAnimationFrame(() => requestAnimationFrame(positionMenu));
      menu.querySelector("input")?.focus({ preventScroll: true });
    }
    const api = { wrapper, close: closeMenu, destroy: () => { closeMenu(); controller.abort(); } };
    multiSelectControllers.set(containerId, api);
    listen(trigger, "click", event => { event.stopPropagation(); if (wrapper.classList.contains("open")) closeMenu(); else openMenu(); });
    listen(trigger, "keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); openMenu(); } });
    listen(document, "click", event => { if (wrapper.classList.contains("open") && !wrapper.contains(event.target) && !menu.contains(event.target)) closeMenu(); });
    listen(document, "keydown", event => { if (event.key === "Escape" && wrapper.classList.contains("open")) { closeMenu(true); event.preventDefault(); } });
    listen(menu, "keydown", event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const inputs = Array.from(menu.querySelectorAll("input"));
      if (!inputs.length) return;
      event.preventDefault();
      const next = (inputs.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1) + inputs.length) % inputs.length;
      inputs[next].focus();
    });
    listen(window, "scroll", reposition, { capture: true });
    listen(window, "resize", reposition);
  }

  function populateFilterOptions() {
    // Filtri per magazzino disponibile - crea dropdown con checkbox
    const stockBrandContainer = document.getElementById("stockFilterBrandContainer");
    const stockMaterialContainer = document.getElementById("stockFilterMaterialContainer");
    const stockPackagingContainer = document.getElementById("stockFilterPackagingContainer");
    
    // Filtri per comprati (mantieni select per ora)
    const purchasedBrandSelect = document.getElementById("purchasedFilterBrand");
    const purchasedMaterialSelect = document.getElementById("purchasedFilterMaterial");

    // Raccogli marche e materiali unici dai filamenti
    const stockBrands = Array.from(new Set(filaments.map(f => f.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it"));
    const stockMaterials = Array.from(new Set(filaments.map(f => f.material).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it"));
    
    const purchasedBrands = new Set(purchasedFilaments.map(f => f.brand).filter(Boolean));
    const purchasedMaterials = new Set(purchasedFilaments.map(f => f.material).filter(Boolean));

    // Crea dropdown marche stock
    if (stockBrandContainer) {
      createMultiSelectDropdown(
        "stockFilterBrandContainer",
        stockBrands,
        "brand",
        "Tutte le marche",
        "Tutte le marche"
      );
    }

    // Crea dropdown materiali stock
    if (stockMaterialContainer) {
      createMultiSelectDropdown(
        "stockFilterMaterialContainer",
        stockMaterials,
        "material",
        "Tutti i materiali",
        "Tutti i materiali"
      );
    }

    // Crea dropdown packaging stock
    if (stockPackagingContainer) {
      createMultiSelectDropdown(
        "stockFilterPackagingContainer",
        [
          { value: "spool", label: "Bobina" },
          { value: "refill", label: "Ricarica" }
        ],
        "packaging",
        "Tutti i tipi",
        "Tutti i tipi"
      );
    }

    // Popola select marche purchased
    if (purchasedBrandSelect) {
      const currentVal = purchasedBrandSelect.value;
      purchasedBrandSelect.innerHTML = '<option value="">Tutte le marche</option>';
      Array.from(purchasedBrands).sort((a, b) => a.localeCompare(b, "it")).forEach(brand => {
        const opt = document.createElement("option");
        opt.value = brand;
        opt.textContent = brand;
        purchasedBrandSelect.appendChild(opt);
      });
      purchasedBrandSelect.value = currentVal;
    }

    // Popola select materiali purchased
    if (purchasedMaterialSelect) {
      const currentVal = purchasedMaterialSelect.value;
      purchasedMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>';
      Array.from(purchasedMaterials).sort((a, b) => a.localeCompare(b, "it")).forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        purchasedMaterialSelect.appendChild(opt);
      });
      purchasedMaterialSelect.value = currentVal;
    }
  }

  function applyStockFilters(list) {
    let result = list;
    
    // Filtra per brand (array)
    if (stockFilters.brand && Array.isArray(stockFilters.brand) && stockFilters.brand.length > 0) {
      result = result.filter(f => {
        const normalizedBrand = canonicalizeBrand(f.brand || "");
        return stockFilters.brand.some(selectedBrand => canonicalizeBrand(selectedBrand) === normalizedBrand);
      });
    }
    
    // Filtra per material (array)
    if (stockFilters.material && Array.isArray(stockFilters.material) && stockFilters.material.length > 0) {
      result = result.filter(f => stockFilters.material.includes(f.material));
    }
    
    // Filtra per packaging (array)
    if (stockFilters.packaging && Array.isArray(stockFilters.packaging) && stockFilters.packaging.length > 0) {
      result = result.filter(f => stockFilters.packaging.includes(f.packaging_type));
    }
    
    return result;
  }

  function applyPurchasedFilters(list) {
    let result = list;
    
    if (purchasedFilters.brand) {
      result = result.filter(f => f.brand === purchasedFilters.brand);
    }
    if (purchasedFilters.material) {
      result = result.filter(f => f.material === purchasedFilters.material);
    }
    if (purchasedFilters.packaging) {
      result = result.filter(f => f.packaging_type === purchasedFilters.packaging);
    }
    
    return result;
  }

  function resetStockFilters() {
    stockFilters = { brand: [], material: [], packaging: [] };
    // Reset checkbox nei filtri multipli
    const brandCheckboxes = document.querySelectorAll("#stockFilterBrandContainer input[type='checkbox']");
    brandCheckboxes.forEach(cb => cb.checked = false);
    const materialCheckboxes = document.querySelectorAll("#stockFilterMaterialContainer input[type='checkbox']");
    materialCheckboxes.forEach(cb => cb.checked = false);
    const packagingCheckboxes = document.querySelectorAll("#stockFilterPackagingContainer input[type='checkbox']");
    packagingCheckboxes.forEach(cb => cb.checked = false);
    
    // Aggiorna i testi dei trigger
    document.querySelectorAll(".multi-select-wrapper").forEach(wrapper => {
      const trigger = wrapper.querySelector(".multi-select-trigger");
      const filterKey = wrapper.getAttribute("data-filter-key");
      if (filterKey === "brand") {
        trigger.textContent = "Tutte le marche";
      } else if (filterKey === "material") {
        trigger.textContent = "Tutti i materiali";
      } else if (filterKey === "packaging") {
        trigger.textContent = "Tutti i tipi";
      }
    });
    
    renderFilamentTable();
    showToast("Filtri magazzino resettati.", "info");
  }

  function resetPurchasedFilters() {
    purchasedFilters = { brand: "", material: "", packaging: "" };
    document.getElementById("purchasedFilterBrand").value = "";
    document.getElementById("purchasedFilterMaterial").value = "";
    document.getElementById("purchasedFilterPackaging").value = "";
    renderPurchasedTable();
    showToast("Filtri comprati resettati.", "info");
  }

  function setupFilterListeners() {
    // Filtri stock
    const stockBrand = document.getElementById("stockFilterBrand");
    const stockMaterial = document.getElementById("stockFilterMaterial");
    const stockPackaging = document.getElementById("stockFilterPackaging");
    const resetStock = document.getElementById("resetStockFilters");

    // I listener per i checkbox sono già gestiti in populateFilterOptions
    // Rimuoviamo i listener vecchi per i select (non più necessari)
    if (resetStock) {
      resetStock.addEventListener("click", resetStockFilters);
    }

    // Filtri purchased
    const purchasedBrand = document.getElementById("purchasedFilterBrand");
    const purchasedMaterial = document.getElementById("purchasedFilterMaterial");
    const purchasedPackaging = document.getElementById("purchasedFilterPackaging");
    const resetPurchased = document.getElementById("resetPurchasedFilters");

    if (purchasedBrand) {
      purchasedBrand.addEventListener("change", (e) => {
        purchasedFilters.brand = e.target.value;
        renderPurchasedTable();
      });
    }
    if (purchasedMaterial) {
      purchasedMaterial.addEventListener("change", (e) => {
        purchasedFilters.material = e.target.value;
        renderPurchasedTable();
      });
    }
    if (purchasedPackaging) {
      purchasedPackaging.addEventListener("change", (e) => {
        purchasedFilters.packaging = e.target.value;
        renderPurchasedTable();
      });
    }
    if (resetPurchased) {
      resetPurchased.addEventListener("click", resetPurchasedFilters);
    }

    // Chart view buttons
    const btn7d = document.getElementById("chartView7d");
    const btn30d = document.getElementById("chartView30d");
    const btnAll = document.getElementById("chartViewAll");

    [btn7d, btn30d, btnAll].forEach(btn => {
      if (btn) {
        btn.addEventListener("click", () => {
          [btn7d, btn30d, btnAll].forEach(b => b && b.classList.remove("active"));
          btn.classList.add("active");
          currentChartView = btn.id.replace("chartView", "");
          renderConsumptionChart();
        });
      }
    });

    // Clear history button
    const clearHistoryBtn = document.getElementById("clearConsumptionHistory");
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", clearAllConsumptionHistory);
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const label = document.getElementById("themeToggleLabel");
    const btn = document.getElementById("themeToggleButton");
    if (label) {
      label.textContent = theme === "dark" ? "Tema chiaro" : "Tema scuro";
    }
    if (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark"
          ? "Passa al tema chiaro"
          : "Passa al tema scuro"
      );
    }
    appSettings.theme = theme;
    if (stateReady && !isApplyingState) autoSave();
  }

  function initTheme() {
    const startTheme = appSettings.theme;
    applyTheme(startTheme);

    const toggleBtn = document.getElementById("themeToggleButton");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        commitMutation("Modificato tema", () => { appSettings.theme = next; });
      });
    }
  }

  function renderBrandOptions() {
    const select = document.getElementById("addBrandSelect");
    if (!select) return;
    select.innerHTML = "";

    const brandsClean = cleanBrandList(brandList);
    const bambuBrands = [];
    const otherBrands = [];

    brandsClean.forEach((b) => {
      const canon = canonicalizeBrand(b);
      if (canon.toLowerCase().startsWith("bambu")) {
        if (!bambuBrands.includes(canon)) bambuBrands.push(canon);
      } else {
        if (!otherBrands.includes(canon)) otherBrands.push(canon);
      }
    });

    otherBrands.sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );

    const brandsSorted = bambuBrands.concat(otherBrands);

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleziona una marca";
    select.appendChild(placeholder);

    brandsSorted.forEach((brand) => {
      const opt = document.createElement("option");
      opt.value = brand;
      opt.textContent = brand;
      select.appendChild(opt);
    });

    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "➕ Aggiungi nuova marca...";
    select.appendChild(customOpt);
  }

  function renderMaterialOptions() {
    const select = document.getElementById("addMaterialSelect");
    if (!select) return;
    select.innerHTML = "";

    const main = [
      "PLA",
      "PETG HF",
      "PLA+",
      "PETG",
      "ASA",
      "ABS",
      "TPU"
    ];
    const rest = materialList.filter((m) => !main.includes(m));
    const ordered = main.concat(
      rest.sort((a, b) =>
        a.localeCompare(b, "it", { sensitivity: "base" })
      )
    );

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleziona materiale";
    select.appendChild(placeholder);

    ordered.forEach((mat) => {
      const opt = document.createElement("option");
      opt.value = mat;
      opt.textContent = mat;
      select.appendChild(opt);
    });

    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "➕ Aggiungi nuovo materiale...";
    select.appendChild(customOpt);
  }

  function renderColorOptions() {
    // Aggiorna il dropdown personalizzato se esiste
    if (window.addColorDropdown && window.addColorDropdown.refresh) {
      window.addColorDropdown.refresh();
    }
    // La vecchia logica per il select non è più necessaria
  }

  function updateColorPreviewFromSelection() {
    const customInput = document.getElementById("addColorCustom");
    const dot = document.getElementById("addColorPreviewDot");
    const label = document.getElementById("addColorPreviewLabel");

    let colorName = "";

    // Leggi dal nuovo dropdown personalizzato
    const dropdownValue = window.addColorDropdown ? window.addColorDropdown.getValue() : "";
    if (dropdownValue && dropdownValue !== "__custom__") {
      colorName = dropdownValue;
    } else if (customInput && customInput.value.trim()) {
      colorName = customInput.value.trim();
    }

    const hex = getColorHex(colorName);

    if (dot) {
      dot.style.background = hex;
    }
    if (label) {
      label.textContent = colorName || "Nessun colore selezionato";
    }
  }

  function handleAddFilament() {
    try {
      const value = id => document.getElementById(id)?.value ?? "";
      const brand = canonicalizeBrand(value("addBrandSelect") === "__custom__" ? value("addBrandCustom").trim() : value("addBrandSelect"));
      const material = canonicalizeMaterial(value("addMaterialSelect") === "__custom__" ? value("addMaterialCustom").trim() : value("addMaterialSelect"));
      const selected = window.addColorDropdown?.getValue();
      const variant = selected && selected !== "__custom__" ? selected : value("addColorCustom").trim();
      if (!brand || !material || !variant) throw new Error("Marca, materiale e colore sono obbligatori.");
      const sealed = requireSpoolNumber(value("addSealedSpoolsInput") || "0", "Sigillate", true);
      const open = requireSpoolNumber(value("addOpenSpoolsInput") || "0", "Aperte", true);
      const count = sealed + open;
      if (count < 1 || count > 10000) throw new Error("Inserisci da 1 a 10000 bobine.");
      const preset = value("addUnitWeightPreset");
      const unit = requireSpoolNumber(preset && preset !== "__custom__" ? preset : value("addUnitWeightInput"), "Peso per bobina");
      if (unit <= 0) throw new Error("Il peso per bobina deve essere maggiore di zero.");
      const fraction = requireSpoolNumber(value("addFractionSelect") || "1", "Frazione residua");
      if (fraction > 1) throw new Error("La frazione residua non può superare 1.");
      const priceText = value("addPriceInput").trim();
      let price = priceText === "" ? null : requireSpoolNumber(priceText, "Prezzo");
      let purchase = null;
      if (pendingPurchasedTransfer) {
        purchase = purchasedFilaments[pendingPurchasedTransfer.entryIndex];
        const available = purchase?.quantity_spools ?? purchase?.quantitySpools ?? 0;
        if (!purchase || count > available || count > pendingPurchasedTransfer.maxQuantity) throw new Error("La quantità supera le bobine acquistate disponibili.");
        if (price === null) price = purchase.unit_price ?? null;
      }
      const f = { id: createSpoolId(), brand, material, variant, color_code: value("addColorCodeInput").trim(),
        packaging_type: value("addPackagingType") || "spool", unit_weight_g: unit, unit_price: price,
        supplier: value("addSupplierInput").trim(), notes: value("addNotesInput").trim(),
        sealed_spools: sealed, open_spools: open, finished_spools: 0, spools_total: count,
        total_weight_g: count * unit, spool_state_version: 1,
        open_spools_fractions: Array.from({ length: open }, (_, index) => index === 0 ? fraction : 1),
        spools_locations: Array.from({ length: count }, (_, index) => value(`addSpoolLocation_${index}`).trim()) };
      if (purchase) f.source_purchase_id = purchase.id;
      recalcWeightsForFilament(f);
      const next = deduplicateFilamentsByIdentity([...filaments, f]);
      const previous = captureDomainState();
      saveStateForUndo(`Aggiunto filamento: ${brand} – ${material} – ${variant}`);
      filaments = next;
      if (purchase) {
        const available = purchase.quantity_spools ?? purchase.quantitySpools ?? 0;
        purchase.quantity_purchased_original = purchase.quantity_purchased_original ?? available;
        purchase.quantity_spools = available - count;
        if ("quantitySpools" in purchase) purchase.quantitySpools = purchase.quantity_spools;
      }
      if (!brandList.includes(brand)) brandList.push(brand);
      if (!materialList.includes(material)) materialList.push(material);
      if (!colorList.includes(variant)) colorList.push(variant);
      if (!commitDomainState(previous)) return;
      pendingPurchasedTransfer = null;
      renderBrandOptions(); renderMaterialOptions(); renderColorOptions(); renderAll();
      ["addBrandSelect", "addBrandCustom", "addMaterialSelect", "addMaterialCustom", "addColorCustom", "addColorCodeInput",
        "addSpoolsTotalInput", "addSealedSpoolsInput", "addOpenSpoolsInput", "addSupplierInput", "addNotesInput", "addPriceInput"].forEach(id => {
        const element = document.getElementById(id); if (element) element.value = "";
      });
      if (window.addColorDropdown) window.addColorDropdown.setValue("");
      const fractionSelect = document.getElementById("addFractionSelect"); if (fractionSelect) fractionSelect.value = "1";
      const locations = document.getElementById("addSpoolsLocationsList"); if (locations) locations.replaceChildren();
      const locationsContainer = document.getElementById("addSpoolsLocationsContainer"); if (locationsContainer) locationsContainer.style.display = "none";
      updateColorPreviewFromSelection();
      showToast("Filamento aggiunto al magazzino disponibile.", "success");
    } catch (error) { showToast(error.message || "Dati non validi.", "error"); }
  }

  function isLowStock(f) {
    const activeCapacity = ((f.sealed_spools || 0) + (f.open_spools || 0)) * (f.unit_weight_g || 0);
    return activeCapacity > 0 && (f.remaining_weight_g || 0) / activeCapacity <= getLowStockThreshold() / 100;
  }

  function renderFilamentTable() {
    const tbody = document.getElementById("filamentTableBody");
    if (!tbody) {
      console.error("filamentTableBody non trovato!");
      return;
    }

    console.log("renderFilamentTable chiamata. Filamenti totali:", filaments.length);
    console.log("Filtri attivi:", stockFilters);
    console.log("Ricerca attiva:", currentSearch);

    tbody.innerHTML = "";

    let filtered = filaments.filter(f => (f.sealed_spools || 0) + (f.open_spools || 0) > 0);
    console.log("Filamenti dopo slice:", filtered.length);
    
    // Applica filtri dropdown
    filtered = applyStockFilters(filtered);
    console.log("Filamenti dopo filtri:", filtered.length);
    
    // Applica ricerca testuale
    if (currentSearch.trim()) {
      const term = currentSearch.toLowerCase();
      filtered = filtered.filter((f) => {
        const hay = [f.brand, f.material, f.variant, f.color_code, f.packaging_type,
          f.supplier, f.location, f.notes, ...(f.spools_variants || []), ...(f.spools_locations || [])]
          .filter(Boolean).join(" ");
        return hay.toLowerCase().includes(term);
      });
    }

    // Non ordiniamo qui, ma dopo aver creato le righe con i gruppi
    // perché ogni filamento può avere più righe (una per gruppo posizione+colore)

    const ths = document.querySelectorAll(
      "#filamentTable thead th[data-sort-field]"
    );
    ths.forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const field = th.getAttribute("data-sort-field");
      if (field === sortState.field) {
        th.classList.add(
          sortState.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
        );
      }
    });

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 18;
      const hasFilters = Object.values(stockFilters).some(values => values.length > 0) || currentSearch.trim();
      td.innerHTML = hasFilters
        ? '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><path d="M3 4h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-state-title">Nessun risultato con i filtri attuali.</div><div class="empty-state-text">Prova a modificare o resettare i filtri.</div></div>'
        : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 9h8M8 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6 5V4h12v1" stroke="currentColor" stroke-width="1.4"/></svg><div class="empty-state-title">Il magazzino è vuoto.</div><div class="empty-state-text">Aggiungi il primo filamento oppure importa un JSON esportato in precedenza.</div></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const rowsToSort = []; // Array per memorizzare i dati delle righe prima del rendering

    filtered.forEach((f) => {
      const locationsColorsMap = new Map();
      const normalized = JSON.parse(JSON.stringify(f));
      recalcWeightsForFilament(normalized);
      getActiveFilamentSpools(normalized).forEach(spool => {
        const key = JSON.stringify([spool.location, spool.variant]);
        if (!locationsColorsMap.has(key)) locationsColorsMap.set(key, {
          location: spool.location, color: spool.variant, count: 0, sealed: 0, open: 0, openFractions: [], spoolIds: []
        });
        const group = locationsColorsMap.get(key);
        group.count++;
        group.spoolIds.push(spool.id);
        if (spool.sealed) group.sealed++;
        else { group.open++; group.openFractions.push(spool.fraction); }
      });

      // Crea una riga per ogni combinazione posizione+colore
      locationsColorsMap.forEach((group) => {
        // Calcola peso residuo per questo gruppo
        let groupRemainingWeight = 0;
        groupRemainingWeight += group.sealed * (f.unit_weight_g || 0);
        group.openFractions.forEach(frac => {
          groupRemainingWeight += frac * (f.unit_weight_g || 0);
        });
        
        const groupTotalWeight = group.count * (f.unit_weight_g || 0);
        
        // Calcola la percentuale residua per la barra
        const ratio = groupTotalWeight > 0 ? groupRemainingWeight / groupTotalWeight : 0;
        const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        
        // Salva i dati della riga per l'ordinamento
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
    
    // Ordina le righe se necessario
    if (sortState.field) {
      const field = sortState.field;
      const dir = sortState.direction === "asc" ? 1 : -1;
      
      rowsToSort.sort((a, b) => {
        if (field === "remaining_weight_g") return (a.groupRemainingWeight - b.groupRemainingWeight) * dir;
        if (field === "remaining_ratio") return (a.ratio - b.ratio) * dir;
        
        // Per location, usa la posizione del gruppo (group.location) e raggruppa per posizione
        if (field === "location") {
          const locA = a.group.location || "";
          const locB = b.group.location || "";
          
          // Le posizioni vuote vanno sempre alla fine
          if (locA === "" && locB !== "") return 1;
          if (locA !== "" && locB === "") return -1;
          if (locA === "" && locB === "") {
            // Entrambe vuote, ordina per marca
            const brandA = canonicalizeBrand(a.filament.brand || "");
            const brandB = canonicalizeBrand(b.filament.brand || "");
            return brandA.localeCompare(brandB, "it", { sensitivity: "base" });
          }
          
          // Prima ordina per posizione (raggruppa tutti i filamenti della stessa posizione)
          const locCompare = locA.localeCompare(locB, "it", { sensitivity: "base" }) * dir;
          if (locCompare !== 0) return locCompare;
          
          // Se la posizione è uguale, ordina per marca, poi materiale, poi colore per mantenere coerenza
          const brandA = canonicalizeBrand(a.filament.brand || "");
          const brandB = canonicalizeBrand(b.filament.brand || "");
          const brandCompare = brandA.localeCompare(brandB, "it", { sensitivity: "base" });
          if (brandCompare !== 0) return brandCompare;
          
          const matA = a.filament.material || "";
          const matB = b.filament.material || "";
          const matCompare = matA.localeCompare(matB, "it", { sensitivity: "base" });
          if (matCompare !== 0) return matCompare;
          
          const colorA = a.group.color || "";
          const colorB = b.group.color || "";
          return colorA.localeCompare(colorB, "it", { sensitivity: "base" });
        }
        
        // Per altri campi, usa il valore del filamento o del gruppo
        let va, vb;
        
        // Alcuni campi potrebbero essere nel gruppo invece che nel filamento
        if (field === "brand") {
          va = canonicalizeBrand(a.filament.brand || "");
          vb = canonicalizeBrand(b.filament.brand || "");
        } else if (field === "material") {
          va = a.filament.material || "";
          vb = b.filament.material || "";
        } else if (field === "variant" || field === "color") {
          va = a.group.color || a.filament.variant || "";
          vb = b.group.color || b.filament.variant || "";
        } else if (field === "spools_total" || field === "total_spools") {
          va = a.group.count || 0;
          vb = b.group.count || 0;
        } else if (field === "sealed_spools" || field === "sealed") {
          va = a.group.sealed || 0;
          vb = b.group.sealed || 0;
        } else if (field === "open_spools" || field === "open") {
          va = a.group.open || 0;
          vb = b.group.open || 0;
        } else if (field === "total_weight_g" || field === "total_weight") {
          va = a.groupTotalWeight || 0;
          vb = b.groupTotalWeight || 0;
        } else {
          va = a.filament[field];
          vb = b.filament[field];
        }
        
        // Gestisci valori nulli/undefined - mettili sempre alla fine
        if (va == null && vb == null) {
          // Entrambi nulli, ordina per marca come fallback
          const brandA = canonicalizeBrand(a.filament.brand || "");
          const brandB = canonicalizeBrand(b.filament.brand || "");
          return brandA.localeCompare(brandB, "it", { sensitivity: "base" });
        }
        if (va == null) return 1 * dir; // a va alla fine
        if (vb == null) return -1 * dir; // b va alla fine
        
        // Confronto numerico
        if (typeof va === "number" && typeof vb === "number") {
          const diff = va - vb;
          if (diff === 0) {
            // Se sono uguali, ordina per marca come fallback
            const brandA = canonicalizeBrand(a.filament.brand || "");
            const brandB = canonicalizeBrand(b.filament.brand || "");
            return brandA.localeCompare(brandB, "it", { sensitivity: "base" });
          }
          return diff * dir;
        }
        
        // Confronto stringa
        const strA = String(va || "").trim();
        const strB = String(vb || "").trim();
        if (strA === "" && strB === "") {
          // Entrambi vuoti, ordina per marca come fallback
          const brandA = canonicalizeBrand(a.filament.brand || "");
          const brandB = canonicalizeBrand(b.filament.brand || "");
          return brandA.localeCompare(brandB, "it", { sensitivity: "base" });
        }
        if (strA === "") return 1 * dir; // a va alla fine
        if (strB === "") return -1 * dir; // b va alla fine
        
        const compare = strA.localeCompare(strB, "it", { sensitivity: "base" });
        if (compare === 0) {
          // Se sono uguali, ordina per marca come fallback
          const brandA = canonicalizeBrand(a.filament.brand || "");
          const brandB = canonicalizeBrand(b.filament.brand || "");
          return brandA.localeCompare(brandB, "it", { sensitivity: "base" });
        }
        return compare * dir;
      });
    }
    
    // Crea le righe HTML ordinate
    rowsToSort.forEach(({ filament: f, group, groupRemainingWeight, groupTotalWeight, ratio, percentage }) => {
      const tr = document.createElement("tr");
      if (isLowStock(f)) {
        tr.classList.add("low-stock-row");
      }

      // Usa il colore specifico del gruppo invece del colore principale
      const pillHtml = getColoredPillHtml(group.color);
      
      const packagingLabel = f.packaging_type === "refill" ? "Ricarica" : "Bobina";
      const priceDisplay = f.unit_price != null ? "€" + formatNumber(f.unit_price, 2) : "-";
        
        const { color: barColor, cls: barClass } = getStockBarStyle(ratio);
        
        // Crea l'HTML della barra
        const barHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
            <div style="flex: 1; background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 10px; position: relative;">
              <div style="width: ${percentage}%; height: 100%; background: ${barColor}; transition: width 0.3s ease; border-radius: 999px;"></div>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; min-width: 35px; text-align: right;">${percentage}%</span>
          </div>
        `;

      tr.innerHTML = `
        <td class="select-column"><input type="checkbox" class="filament-select-checkbox" data-id="${escapeHtml(f.id)}" data-spool-ids='${escapeHtml(JSON.stringify(group.spoolIds))}'></td>
        <td>${escapeHtml(canonicalizeBrand(f.brand) || "-")}</td>
        <td>${escapeHtml(f.material || "-")}</td>
        <td>${pillHtml}</td>
        <td>${escapeHtml(f.color_code || "-")}</td>
        <td>${packagingLabel}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.count}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.sealed}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.open}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(f.unit_weight_g || 0)}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(groupTotalWeight)}</td>
          <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(groupRemainingWeight)}</td>
          <td style="padding: 0.35rem 0.5rem; vertical-align: middle;">${barHtml}</td>
          <td style="white-space: nowrap; padding: 0.35rem 0.25rem; text-align: center;">${priceDisplay}</td>
          <td style="padding: 0.35rem 0.25rem;">${escapeHtml(group.location || "-")}</td>
          <td style="white-space: nowrap;">
            <button type="button" class="btn-action btn-success" data-id="${
            escapeHtml(f.id)
          }" title="Modifica filamento">
              <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
              <path d="M16.474 5.408l2.118 2.118M18 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
              <span>Modifica</span>
          </button>
            <button type="button" class="btn-action btn-success" data-id="${
              escapeHtml(f.id)
            }" data-spool-ids='${escapeHtml(JSON.stringify(group.spoolIds))}' title="Elimina bobine della riga" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger);">
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
    
    // Inizializza ridimensionamento colonne dopo il rendering
    initResizableColumns();
  }

  // Funzionalità ridimensionamento colonne (stile Excel)
  function initResizableColumns() {
    const table = document.getElementById("filamentTable");
    if (!table) return;
    table.querySelectorAll("th.resizable").forEach(header => {
      if (header.querySelector(".resize-handle")) return;
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      handle.setAttribute("aria-label", "Larghezza colonna " + header.textContent.trim());
      header.appendChild(handle);
      let drag = null;
      function setWidth(width) {
        const minimum = parseFloat(getComputedStyle(header).minWidth) || 45;
        header.style.width = Math.max(minimum, width) + "px";
        handle.setAttribute("aria-valuenow", String(Math.round(Math.max(minimum, width))));
        const index = Array.from(header.parentElement.children).indexOf(header);
        table.querySelectorAll("tbody tr").forEach(row => { if (row.children[index]) row.children[index].style.width = header.style.width; });
      }
      handle.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        drag = { x: event.clientX, width: header.getBoundingClientRect().width };
        header.classList.add("resizing");
        handle.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopPropagation();
      });
      handle.addEventListener("pointermove", event => { if (drag) setWidth(drag.width + event.clientX - drag.x); });
      const finish = () => { drag = null; header.classList.remove("resizing"); };
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
      handle.addEventListener("lostpointercapture", finish);
      handle.addEventListener("click", event => event.stopPropagation());
      handle.addEventListener("keydown", event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault(); event.stopPropagation();
        setWidth(header.getBoundingClientRect().width + (event.key === "ArrowRight" ? 10 : -10));
      });
    });
  }

  function renderPurchasedTable() {
    const tbody = document.getElementById("purchasedTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!purchasedFilaments || purchasedFilaments.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.textContent =
        "In attesa dei dati delle fatture. Importa un JSON di fatture per vedere qui i filamenti comprati.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Applica filtri dropdown
    let filtered = applyPurchasedFilters(purchasedFilaments.filter(p => (p.quantity_spools ?? p.quantitySpools ?? 0) > 0));

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);"><svg viewBox="0 0 24 24" fill="none" style="width:32px;height:32px;margin:0 auto 0.5rem;display:block;opacity:0.5;"><path d="M3 4h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Nessun risultato con i filtri attuali.<br><small>Prova a modificare o resettare i filtri.</small></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Apply sorting for purchased table
    let sorted = filtered.slice();
    if (purchasedSortState.field) {
      const field = purchasedSortState.field;
      const dir = purchasedSortState.direction === "asc" ? 1 : -1;
      sorted.sort((a, b) => {
        let va = a[field];
        let vb = b[field];
        // Handle quantity_spools alias
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

    // Update sort indicators
    const ths = document.querySelectorAll(
      "#purchasedTable thead th[data-sort-field]"
    );
    ths.forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const field = th.getAttribute("data-sort-field");
      if (field === purchasedSortState.field) {
        th.classList.add(
          purchasedSortState.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
        );
      }
    });

    sorted.forEach((p, index) => {
      const tr = document.createElement("tr");
      const qty =
        p.quantity_spools != null
          ? p.quantity_spools
          : p.quantitySpools != null
          ? p.quantitySpools
          : 1;
      const rowId = p.id || `purchased-row-${index}`;
      const packagingLabel = p.packaging_type === "refill" ? "Ricarica" : (p.packaging_type === "spool" ? "Bobina" : "-");
      const priceDisplay = p.unit_price != null ? "€" + formatNumber(p.unit_price, 2) : "-";

      // Determine if this is a multi-color pack
      const variantLower = (p.variant || "").toLowerCase();
      const isMultiColor = variantLower.includes("pack") || 
                           variantLower.includes("pallet") || 
                           variantLower.includes("misti") ||
                           variantLower.includes("colori") ||
                           qty >= 10;

      // Create color pill HTML
      let pillHtml;
      if (isMultiColor) {
        // Rainbow gradient for multi-color packs
        pillHtml = `<span class="pill-colored light-text" style="background: linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6);" title="${escapeHtml(p.variant || "Multi-colore")}">${escapeHtml(p.variant || "Multi-colore")}</span>`;
        tr.style.background = "linear-gradient(90deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08), rgba(34,197,94,0.08), rgba(59,130,246,0.08), rgba(139,92,246,0.08))";
      } else {
        pillHtml = getColoredPillHtml(p.variant);
        // Apply subtle colored background to row
        const colorHex = getColorHex(p.variant);
        if (colorHex && colorHex !== "#9ca3af" && colorHex !== "#e5e7eb") {
          tr.style.background = `linear-gradient(90deg, ${colorHex}15, ${colorHex}08, transparent)`;
        }
      }

      tr.innerHTML = `
        <td>${escapeHtml(p.order_date || "-")}</td>
        <td>${escapeHtml(canonicalizeBrand(p.brand) || "-")}</td>
        <td>${escapeHtml(p.material || "-")}</td>
        <td>${pillHtml}</td>
        <td>${escapeHtml(p.color_code || "-")}</td>
        <td>${packagingLabel}</td>
        <td>${qty}</td>
        <td>${priceDisplay}</td>
        <td style="white-space: nowrap;">
          <button type="button" class="btn-action btn-success" data-purchased-id="${escapeHtml(rowId)}" title="Aggiungi al magazzino">
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

  function renderDashboard() {
    const totalSpoolsEl = document.getElementById("totalSpoolsValue");
    const totalRemEl = document.getElementById(
      "totalRemainingGramsValue"
    );
    const totalUsedEl = document.getElementById("totalUsedGramsValue");
    const lowStockEl = document.getElementById("lowStockCountValue");

    let totalSpools = 0;
    let totalWeight = 0;
    let totalRemaining = 0;
    let lowCount = 0;

    filaments.forEach((f) => {
      totalSpools += (f.sealed_spools || 0) + (f.open_spools || 0);
      totalWeight += f.total_weight_g || 0;
      totalRemaining += f.remaining_weight_g || 0;
      if (isLowStock(f)) lowCount++;
    });

    const used = Math.max(0, totalWeight - totalRemaining);

    if (totalSpoolsEl)
      totalSpoolsEl.textContent = formatNumber(totalSpools);
    if (totalRemEl)
      totalRemEl.textContent = formatNumber(totalRemaining, 0) + " g";
    if (totalUsedEl)
      totalUsedEl.textContent = formatNumber(used, 0) + " g";
    if (lowStockEl) lowStockEl.textContent = formatNumber(lowCount);
  }

  function renderStockSummary() {
    const newEl = document.getElementById("stockNewSpoolsCount");
    const openEl = document.getElementById("stockOpenSpoolsCount");
    const extraEl = document.getElementById("stockExtraSpoolsCount");
    const gramsEl = document.getElementById("stockRemainingGramsTotal");

    let newCount = 0;
    let openCount = 0;
    let extraCount = 0;
    let rem = 0;

    filaments.forEach((f) => {
      newCount += f.sealed_spools || 0;
      openCount += f.open_spools || 0;
      rem += f.remaining_weight_g || 0;
      
      // Se è una ricarica (refill) e ha bobine aperte, 
      // sta usando rulli extra (non inclusi nella confezione)
      if (f.packaging_type === "refill" && (f.open_spools || 0) > 0) {
        extraCount += f.open_spools || 0;
      }
    });

    if (newEl) newEl.textContent = formatNumber(newCount);
    if (openEl) openEl.textContent = formatNumber(openCount);
    if (extraEl) extraEl.textContent = formatNumber(extraCount);
    if (gramsEl) gramsEl.textContent = formatNumber(rem, 0) + " g";
  }

  // Stato di ordinamento per la tabella visualizzazione aggregata
  let spoolsStateSortState = { field: "remaining_weight_g", direction: "asc" };
  let finishedFilamentsSortState = { field: null, direction: "asc" };

  function renderSpoolsStateTable() {
    const tbody = document.getElementById("spoolsStateTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Raggruppa i filamenti per marca, materiale e variante
    const groupedMap = new Map(); // Map<"brand|material|variant", {brand, material, variant, totalSpools, totalWeight, remainingWeight}>

    filaments.forEach(f => {
      const normalized = JSON.parse(JSON.stringify(f));
      recalcWeightsForFilament(normalized);
      getActiveFilamentSpools(normalized).forEach(spool => {
        const brand = canonicalizeBrand(f.brand || "");
        const material = f.material || "";
        const variant = spool.variant;
        const key = JSON.stringify([brand, material, variant]);
        if (!groupedMap.has(key)) groupedMap.set(key, { brand, material, variant, totalSpools: 0, totalWeight: 0, remainingWeight: 0 });
        const group = groupedMap.get(key);
        group.totalSpools++;
        group.totalWeight += normalized.unit_weight_g;
        group.remainingWeight += spool.fraction * normalized.unit_weight_g;
      });
    });

    // Converti in array e filtra quelli con residuo > 0
    let grouped = Array.from(groupedMap.values()).filter(g => g.remainingWeight > 0);

    if (grouped.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Nessun filamento disponibile</td>';
      tbody.appendChild(tr);
      return;
    }

    // Applica ordinamento
    if (spoolsStateSortState.field) {
      const field = spoolsStateSortState.field;
      const dir = spoolsStateSortState.direction === "asc" ? 1 : -1;
      
      // Mappa i campi HTML ai campi dell'oggetto group
      const fieldMap = {
        "brand": "brand",
        "material": "material",
        "variant": "variant",
        "remaining_weight_g": "remainingWeight",
        "spools_total": "totalSpools"
      };
      
      const actualField = fieldMap[field] || field;
      
      grouped.sort((a, b) => {
        let va = a[actualField];
        let vb = b[actualField];
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * dir;
        }
        return String(va || "").localeCompare(String(vb || ""), "it", {
          sensitivity: "base"
        }) * dir;
      });
    }

    // Aggiorna indicatori di ordinamento
    const ths = document.querySelectorAll(
      "#spoolsStateTableContainer th[data-sort-field]"
    );
    ths.forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const field = th.getAttribute("data-sort-field");
      if (field === spoolsStateSortState.field) {
        th.classList.add(
          spoolsStateSortState.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
        );
      }
    });

    // Renderizza le righe
    grouped.forEach((group) => {
      const tr = document.createElement("tr");
      
      const ratio = group.totalWeight > 0 ? group.remainingWeight / group.totalWeight : 0;
      const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      
      const { color: barColor } = getStockBarStyle(ratio);
      
      const barHtml = `
        <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
          <div style="flex: 1; background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 10px; position: relative;">
            <div style="width: ${percentage}%; height: 100%; background: ${barColor}; transition: width 0.3s ease; border-radius: 999px;"></div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; min-width: 35px; text-align: right;">${percentage}%</span>
        </div>
      `;

      const pillHtml = getColoredPillHtml(group.variant);

      tr.innerHTML = `
        <td>${escapeHtml(group.brand || "-")}</td>
        <td>${escapeHtml(group.material || "-")}</td>
        <td>${pillHtml}</td>
        <td style="text-align: center;">${formatNumber(group.remainingWeight, 0)}</td>
        <td style="text-align: center;">${formatNumber(group.totalSpools)}</td>
        <td style="padding: 0.35rem 0.5rem; vertical-align: middle;">${barHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderFinishedFilamentsTable() {
    const tbody = document.getElementById("finishedFilamentsTableBody");
    if (!tbody) return;
    tbody.replaceChildren();
    const grouped = new Map();
    filaments.forEach(f => {
      const count = f.finished_spools || 0;
      if (!count) return;
      const key = JSON.stringify([f.brand, f.material, f.variant, f.packaging_type]);
      if (!grouped.has(key)) grouped.set(key, { brand: f.brand, material: f.material, variant: f.variant,
        packaging: f.packaging_type || "spool", count: 0, weight: 0 });
      const group = grouped.get(key);
      group.count += count;
      group.weight += count * f.unit_weight_g;
    });
    const rows = Array.from(grouped.values());
    const { field, direction } = finishedFilamentsSortState;
    if (field) rows.sort((a, b) => String(a[field] || "").localeCompare(String(b[field] || ""), "it") * (direction === "asc" ? 1 : -1));
    document.querySelectorAll("#finishedFilamentsTable th[data-sort-field]").forEach(th => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sortField === field) th.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    });
    if (!rows.length) {
      const row = document.createElement("tr"), cell = document.createElement("td");
      cell.colSpan = 7; cell.textContent = "Nessuna bobina terminata"; row.appendChild(cell); tbody.appendChild(row);
    }
    rows.forEach(group => {
      const row = document.createElement("tr");
      [group.brand, group.material, group.variant, formatNumber(group.count), formatNumber(group.weight),
        formatNumber(group.weight), group.packaging === "refill" ? "Ricarica" : "Bobina"].forEach(value => {
        const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }

  function renderBarsForGroup(groupKeywords, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const items = filaments.filter((f) =>
      groupKeywords.some((kw) =>
        (f.material || "")
          .toLowerCase()
          .includes(kw.toLowerCase())
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

      const ratio =
        ((f.sealed_spools || 0) + (f.open_spools || 0)) * f.unit_weight_g > 0
          ? f.remaining_weight_g / (((f.sealed_spools || 0) + (f.open_spools || 0)) * f.unit_weight_g)
          : 0;
      if (ratio <= 0.25) row.classList.add("low-stock");
      else if (ratio <= 0.5) row.classList.add("medium-stock");
      else row.classList.add("high-stock");

      const stockSpools = f.sealed_spools + f.open_spools;
      const lastOpen =
        stockSpools === 1 &&
        f.open_spools === 1 &&
        f.main_fraction < 1;
      if (lastOpen) row.classList.add("last-spool");

      // Get color for the name highlight
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
      header.innerHTML = `<span>${escapeHtml(titleBrand)} – ${escapeHtml(materialText)}<span class="pill-colored ${textClass}" style="background:${colorHex};padding:0.15rem 0.5rem;font-size:0.8rem;">${escapeHtml(titleVariant)}</span></span><span>${detail}</span>`;
      row.appendChild(header);

      const barOuter = document.createElement("div");
      barOuter.className = "bar-outer";

      const barInner = document.createElement("div");
      barInner.className = "bar-inner";

      const pct =
        ((f.sealed_spools || 0) + (f.open_spools || 0)) * f.unit_weight_g > 0
          ? Math.max(
              5,
              Math.min(
                100,
                (f.remaining_weight_g / (((f.sealed_spools || 0) + (f.open_spools || 0)) * f.unit_weight_g)) * 100
              )
            )
          : 0;

      barInner.style.width = pct + "%";

      if (ratio <= 0.25) {
        barInner.style.background =
          "linear-gradient(90deg,#f97373,#b91c1c)";
      } else if (ratio <= 0.5) {
        barInner.style.background =
          "linear-gradient(90deg,#fbbf24,#b45309)";
      } else {
        barInner.style.background =
          "linear-gradient(90deg,#22c55e,#15803d)";
      }

      barOuter.appendChild(barInner);
      row.appendChild(barOuter);
      container.appendChild(row);
    });
  }

  function renderBars() {
    renderBarsForGroup(["pla"], "barsPlaContainer");
    renderBarsForGroup(["petg"], "barsPetgContainer");
  }

  // Stato di ordinamento per barra residua aggregata
  let remainingBarSortState = { field: "remaining_ratio", direction: "asc" };


  function renderStorageVisualization() {
    const container = document.getElementById("storageVisualizationContainer");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Raggruppa i filamenti per posizione
    // Usa una Map per normalizzare le posizioni (chiave normalizzata -> {originalName, spools})
    const locationsMap = new Map(); // Map<normalizedLocation, {originalName, spools: []}>
    
    // Funzione per normalizzare una posizione (rimuove spazi extra, converte in lowercase)
    function normalizeLocation(loc) {
      return loc.trim().toLowerCase().replace(/\s+/g, ' ');
    }
    
    filaments.forEach(f => {
      const totalSpools = (f.sealed_spools || 0) + (f.open_spools || 0);
      const remainingWeight = f.remaining_weight_g || 0;
      
      // Escludi i filamenti completamente finiti (stesso filtro di renderFilamentTable)
      if (remainingWeight === 0 || (totalSpools === 0 && remainingWeight === 0)) {
        return; // Salta questo filamento - è finito
      }
      
      // Se ha spools_locations, usa quello
      if (f.spools_locations && Array.isArray(f.spools_locations)) {
        f.spools_locations.forEach((location, index) => {
          if (location && location.trim() !== "") {
            const normalized = normalizeLocation(location);
            if (!locationsMap.has(normalized)) {
              locationsMap.set(normalized, {
                originalName: location.trim(), // Mantieni la prima occorrenza come nome originale
                spools: []
              });
            }
            const entry = locationsMap.get(normalized);
            // Se troviamo un nome più "standard" (es. con maiuscole corrette), usalo
            const trimmed = location.trim();
            if (trimmed.length > 0 && (entry.originalName.toLowerCase() !== normalized || 
                (trimmed[0] === trimmed[0].toUpperCase() && entry.originalName[0] !== entry.originalName[0].toUpperCase()))) {
              // Preferisci nomi con maiuscole corrette
              if (trimmed[0] === trimmed[0].toUpperCase() && entry.originalName[0] !== entry.originalName[0].toUpperCase()) {
                entry.originalName = trimmed;
              }
            }
            entry.spools.push({
              filament: f,
              spoolIndex: index,
              isSealed: index < (f.sealed_spools || 0)
            });
          }
        });
      } 
      // Altrimenti usa il campo location globale
      else if (f.location && f.location.trim() !== "") {
        const normalized = normalizeLocation(f.location);
        if (!locationsMap.has(normalized)) {
          locationsMap.set(normalized, {
            originalName: f.location.trim(),
            spools: []
          });
        }
        const entry = locationsMap.get(normalized);
        // Aggiungi tutte le bobine a questa posizione
        for (let i = 0; i < totalSpools; i++) {
          entry.spools.push({
            filament: f,
            spoolIndex: i,
            isSealed: i < (f.sealed_spools || 0)
          });
        }
      }
    });
    
    // Se non ci sono posizioni, mostra un messaggio
    if (locationsMap.size === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <svg viewBox="0 0 24 24" fill="none" style="width: 64px; height: 64px; margin: 0 auto 1rem; opacity: 0.5;">
            <path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
          </svg>
          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">Nessuna bobina posizionata</div>
          <div>Assegna posizioni ai filamenti per vederli qui</div>
        </div>
      `;
      return;
    }
    
    // Ordina le posizioni (usa il nome originale per l'ordinamento)
    const sortedLocations = Array.from(locationsMap.entries())
      .map(([normalized, entry]) => ({ normalized, originalName: entry.originalName }))
      .sort((a, b) => a.originalName.localeCompare(b.originalName, "it", { sensitivity: "base" }));
    
    // Crea un contenitore per ogni posizione
    sortedLocations.forEach(({ normalized, originalName }) => {
      const entry = locationsMap.get(normalized);
      const spools = entry.spools;
      const location = originalName; // Usa il nome originale per la visualizzazione
      
      const locationCard = document.createElement("div");
      locationCard.style.cssText = "background: var(--surface-soft); border-radius: 0.75rem; padding: 1rem; border: 2px solid var(--border-subtle); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); position: relative; overflow: hidden;";
      
      // Aggiungi un effetto "box" con bordi interni
      locationCard.style.cssText += "background: linear-gradient(to bottom, var(--surface-soft) 0%, rgba(15, 23, 42, 0.95) 100%);";
      
      const locationHeader = document.createElement("div");
      locationHeader.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--border-subtle);";
      
      // Funzione per ottenere icona e descrizione in base al nome posizione
      function getLocationInfo(locName) {
        const lowerName = locName.toLowerCase();
        if (lowerName.includes('ams') || lowerName.includes('h2d')) {
          return {
            icon: `<svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
              <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="12" cy="3" r="1.5" fill="currentColor"/>
            </svg>`,
            description: "AMS e stampante 3D"
          };
        } else if (lowerName.includes('box blue') || lowerName.includes('box ikea')) {
          return {
            icon: `<svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
              <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="rgba(59, 130, 246, 0.1)"/>
              <path d="M4 10h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M4 14h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`,
            description: "Box di plastica trasparente grande (8+ bobine)"
          };
        } else if (lowerName.includes('box piccolo')) {
          return {
            icon: `<svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
              <rect x="6" y="8" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`,
            description: "Box piccolo (1 bobina)"
          };
        } else if (lowerName.includes('scaffale')) {
          return {
            icon: `<svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
              <rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M3 9h18M3 13h18M3 17h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M2 5h20M2 19h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`,
            description: "Ripiani di armadio chiuso con ante"
          };
        }
        // Default
        return {
          icon: `<svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px;">
            <path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
          </svg>`,
          description: ""
        };
      }
      
      const locationInfo = getLocationInfo(location);
      
      const locationTitle = document.createElement("h3");
      locationTitle.style.cssText = "margin: 0; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.3rem;";
      locationTitle.innerHTML = `
        ${locationInfo.icon}
        <span>${escapeHtml(location)}</span>
      `;
      
      const locationDescription = document.createElement("div");
      locationDescription.style.cssText = "font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem; font-style: italic;";
      locationDescription.textContent = locationInfo.description;
      
      const spoolsCount = document.createElement("span");
      spoolsCount.style.cssText = "font-size: 0.65rem; color: var(--text-muted); font-weight: 600;";
      spoolsCount.textContent = `${spools.length} bobina${spools.length !== 1 ? 'e' : 'a'}`;
      
      locationHeader.appendChild(locationTitle);
      locationHeader.appendChild(spoolsCount);
      locationCard.appendChild(locationHeader);
      if (locationInfo.description) {
        locationCard.appendChild(locationDescription);
      }
      
      // Container per le bobine - layout orizzontale come scaffale/box
      const spoolsGrid = document.createElement("div");
      spoolsGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: stretch; padding: 0.5rem; background: rgba(15, 23, 42, 0.3); border-radius: 0.5rem; border: 1px solid var(--border-subtle); min-height: 200px;";
      
      spools.forEach(({ filament, spoolIndex, isSealed }) => {
        const spoolCard = document.createElement("div");
        spoolCard.style.cssText = "background: var(--surface); border-radius: 0.5rem; padding: 0.75rem; border: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; width: 140px; min-height: 180px; flex-shrink: 0;";
        spoolCard.title = `Clicca per modificare: ${canonicalizeBrand(filament.brand)} – ${filament.material} – ${filament.variant}`;
        
        spoolCard.addEventListener("click", () => {
          openEditFilamentModal(filament.id);
        });
        
        spoolCard.addEventListener("mouseenter", () => {
          spoolCard.style.transform = "translateY(-2px)";
          spoolCard.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.25)";
          spoolCard.style.borderColor = "var(--accent)";
        });
        
        spoolCard.addEventListener("mouseleave", () => {
          spoolCard.style.transform = "translateY(0)";
          spoolCard.style.boxShadow = "none";
          spoolCard.style.borderColor = "var(--border-subtle)";
        });
        
        // Header con status badge
        const cardHeader = document.createElement("div");
        cardHeader.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;";
        
        // Indicatore sigillata/aperta
        const statusBadge = document.createElement("div");
        statusBadge.style.cssText = `display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 700; ${
          isSealed 
            ? "background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);"
            : "background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3);"
        }`;
        statusBadge.textContent = isSealed ? "NUOVA" : "APERTA";
        
        cardHeader.appendChild(statusBadge);
        spoolCard.appendChild(cardHeader);
        
        // Colore del filamento - usa il colore specifico della bobina se disponibile
        const spoolVariant = (filament.spools_variants && Array.isArray(filament.spools_variants) && filament.spools_variants[spoolIndex]) 
          ? filament.spools_variants[spoolIndex] 
          : filament.variant;
        const colorHex = getColorHex(spoolVariant);
        const colorDot = document.createElement("div");
        colorDot.style.cssText = `width: 100%; height: 50px; border-radius: 0.375rem; background: ${colorHex}; margin-bottom: 0.5rem; border: 2px solid var(--border-subtle); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);`;
        
        // Info filamento
        const brandText = document.createElement("div");
        brandText.style.cssText = "font-size: 0.6rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        brandText.textContent = canonicalizeBrand(filament.brand) || "-";
        
        const materialText = document.createElement("div");
        materialText.style.cssText = "font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        materialText.textContent = filament.material || "-";
        
        const variantText = document.createElement("div");
        variantText.style.cssText = "font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        variantText.textContent = spoolVariant || "-";
        
        // Calcola residuo e percentuale
        let fraction = 1;
        let percentage = 100;
        let remainingGrams = filament.unit_weight_g || 1000;
        
        if (isSealed) {
          // Bobina sigillata = 100%
          fraction = 1;
          percentage = 100;
          remainingGrams = filament.unit_weight_g || 1000;
        } else if (filament.open_spools_fractions && Array.isArray(filament.open_spools_fractions)) {
          const openIndex = spoolIndex - (filament.sealed_spools || 0);
          if (openIndex >= 0 && openIndex < filament.open_spools_fractions.length) {
            fraction = filament.open_spools_fractions[openIndex] || 1;
            percentage = Math.round(fraction * 100);
            remainingGrams = Math.round((filament.unit_weight_g || 1000) * fraction);
          }
        }
        
        // Indicatore visivo del residuo - barra di progresso
        const progressContainer = document.createElement("div");
        progressContainer.style.cssText = "margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);";
        
        const { color: progressColor } = getStockBarStyle(fraction);
        
        const progressBarWrapper = document.createElement("div");
        progressBarWrapper.style.cssText = "background: rgba(15, 23, 42, 0.6); border-radius: 999px; overflow: hidden; height: 8px; margin-bottom: 0.4rem; position: relative;";
        
        const progressBar = document.createElement("div");
        progressBar.style.cssText = `width: ${percentage}%; height: 100%; background: ${progressColor}; transition: width 0.3s ease; border-radius: 999px; box-shadow: 0 0 8px ${progressColor}40;`;
        
        progressBarWrapper.appendChild(progressBar);
        
        const progressText = document.createElement("div");
        progressText.style.cssText = "display: flex; align-items: center; justify-content: space-between; font-size: 0.6rem;";
        
        const percentageText = document.createElement("span");
        percentageText.style.cssText = "font-weight: 700; color: var(--text-muted); font-size: 0.6rem;";
        percentageText.textContent = `${percentage}%`;
        
        const gramsText = document.createElement("span");
        gramsText.style.cssText = "color: var(--text-muted); font-size: 0.6rem;";
        gramsText.textContent = `${formatNumber(remainingGrams, 0)}g`;
        
        progressText.appendChild(percentageText);
        progressText.appendChild(gramsText);
        
        progressContainer.appendChild(progressBarWrapper);
        progressContainer.appendChild(progressText);
        
        spoolCard.appendChild(colorDot);
        spoolCard.appendChild(brandText);
        spoolCard.appendChild(materialText);
        spoolCard.appendChild(variantText);
        spoolCard.appendChild(progressContainer);
        
        spoolsGrid.appendChild(spoolCard);
      });
      
      locationCard.appendChild(spoolsGrid);
      container.appendChild(locationCard);
    });
  }

  // Funzione per renderizzare la tabella barra residua aggregata
  function renderRemainingBarTable() {
    const tbody = document.getElementById("remainingBarTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (filaments.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 9h8M8 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6 5V4h12v1" stroke="currentColor" stroke-width="1.4"/></svg><div class="empty-state-title">Il magazzino è vuoto.</div><div class="empty-state-text">Aggiungi il primo filamento oppure importa un JSON esportato in precedenza.</div></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Raggruppa i filamenti per brand + material + variant (ignorando le posizioni)
    const groupedMap = new Map(); // Map<"brand|material|variant", {brand, material, variant, totalSpools, totalWeight, remainingWeight}>

    filaments.forEach((f) => {
      const brand = canonicalizeBrand(f.brand) || "";
      const material = f.material || "";
      const variant = f.variant || "";
      const key = `${brand}|${material}|${variant}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          brand: brand,
          material: material,
          variant: variant,
          totalSpools: 0,
          totalWeight: 0,
          remainingWeight: 0
        });
      }

      const group = groupedMap.get(key);
      const totalSpools = (f.sealed_spools || 0) + (f.open_spools || 0);
      const unitWeight = f.unit_weight_g || 0;
      const totalWeight = totalSpools * unitWeight;
      
      // Calcola peso residuo
      let remainingWeight = 0;
      remainingWeight += (f.sealed_spools || 0) * unitWeight;
      if (f.open_spools_fractions && Array.isArray(f.open_spools_fractions)) {
        f.open_spools_fractions.forEach(frac => {
          remainingWeight += frac * unitWeight;
        });
      } else if (f.open_spools > 0) {
        // Se non ci sono frazioni specifiche, usa la frazione principale o 1
        remainingWeight += (f.open_spools || 0) * unitWeight * (f.main_fraction || 1);
      }

      group.totalSpools += totalSpools;
      group.totalWeight += totalWeight;
      group.remainingWeight += remainingWeight;
    });

    // Converti la Map in array per l'ordinamento
    const rowsToSort = Array.from(groupedMap.values()).map(group => {
      const ratio = group.totalWeight > 0 ? group.remainingWeight / group.totalWeight : 0;
      const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      return {
        ...group,
        ratio: ratio,
        percentage: percentage
      };
    });

    // Applica ordinamento
    if (remainingBarSortState.field) {
      const field = remainingBarSortState.field;
      const dir = remainingBarSortState.direction === "asc" ? 1 : -1;
      
      rowsToSort.sort((a, b) => {
        if (field === "remaining_ratio") {
          return (a.ratio - b.ratio) * dir;
        }
        
        const va = a[field];
        const vb = b[field];
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * dir;
        }
        return String(va || "").localeCompare(String(vb || ""), "it", {
          sensitivity: "base"
        }) * dir;
      });
    }

    // Aggiorna indicatori di ordinamento
    const ths = document.querySelectorAll(
      "#remainingBarTable thead th[data-sort-field]"
    );
    ths.forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const field = th.getAttribute("data-sort-field");
      if (field === remainingBarSortState.field) {
        th.classList.add(
          remainingBarSortState.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
        );
      }
    });

    // Renderizza le righe
    rowsToSort.forEach((group) => {
      const tr = document.createElement("tr");
      
      const { color: barColor, cls: barClass } = getStockBarStyle(group.ratio);
      
      // Crea l'HTML della barra
      const barHtml = `
        <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
          <div style="flex: 1; background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 10px; position: relative;">
            <div style="width: ${group.percentage}%; height: 100%; background: ${barColor}; transition: width 0.3s ease; border-radius: 999px;"></div>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; min-width: 35px; text-align: right;">${group.percentage}%</span>
        </div>
      `;

      const pillHtml = getColoredPillHtml(group.variant);

      tr.innerHTML = `
        <td>${escapeHtml(group.brand || "-")}</td>
        <td>${escapeHtml(group.material || "-")}</td>
        <td>${pillHtml}</td>
        <td style="text-align: center; padding: 0.35rem 0.25rem;">${group.totalSpools}</td>
        <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(group.totalWeight)}</td>
        <td style="text-align: center; padding: 0.35rem 0.25rem;">${formatNumber(group.remainingWeight)}</td>
        <td style="padding: 0.35rem 0.5rem; vertical-align: middle;">${barHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAll() {
    populateFilterOptions();
    renderFilamentTable();
    renderPurchasedTable();
    renderDashboard();
    renderStockSummary();
    renderSpoolsStateTable();
    renderBars();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    // renderRemainingBarTable(); // Disabilitato - duplicato, si usa renderSpoolsStateTable()
    renderConsumptionByDifference();
    renderStorageVisualization();
    renderFinishedFilamentsTable();
  }

  function openConsumptionModal(filamentId) {
    const modal = document.getElementById("consumptionModal");
    const overlay = document.getElementById("modalOverlay");
    const info = document.getElementById("consumptionInfo");
    const totalInput = document.getElementById("consumptionSpoolsTotal");
    const sealedInput = document.getElementById(
      "consumptionSealedInput"
    );
    const openInput = document.getElementById("consumptionOpenInput");
    const fractionSelect = document.getElementById(
      "consumptionFractionSelect"
    );
    const hiddenId = document.getElementById("consumptionFilamentId");
    const spoolDeletionSection = document.getElementById("spoolDeletionSection");
    const spoolDeletionList = document.getElementById("spoolDeletionList");

    const f = filaments.find((x) => x.id === filamentId);
    if (!f) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    if (info) {
      info.textContent =
        canonicalizeBrand(f.brand) +
        " – " +
        (f.material || "-") +
        " – " +
        (f.variant || "-") +
        ". Bobine totali: " +
        f.spools_total +
        " (nuove: " +
        (f.sealed_spools || 0) +
        ", aperte: " +
        (f.open_spools || 0) +
        ").";
    }
    if (totalInput) totalInput.value = f.spools_total || 0;
    if (sealedInput) sealedInput.value = f.sealed_spools || 0;
    if (openInput) openInput.value = f.open_spools || 0;
    if (fractionSelect)
      fractionSelect.value = String(
        typeof f.main_fraction === "number" ? f.main_fraction : 1
      );
    if (hiddenId) hiddenId.value = f.id;

    // Nascondi la sezione di eliminazione bobine inizialmente
    if (spoolDeletionSection) {
      spoolDeletionSection.style.display = "none";
      if (spoolDeletionList) spoolDeletionList.innerHTML = "";
    }

    // Listener per mostrare/nascondere la sezione di eliminazione quando cambia il numero di bobine
    const updateSpoolDeletionSection = () => {
      if (!spoolDeletionSection || !spoolDeletionList) return;
      
      const currentTotal = parseInt(totalInput?.value || "0", 10);
      const currentSealed = parseInt(sealedInput?.value || "0", 10);
      const currentOpen = parseInt(openInput?.value || "0", 10);
      const newTotal = currentSealed + currentOpen;
      
      // Se il nuovo totale è minore del totale attuale, mostra la sezione di selezione
      if (newTotal < f.spools_total && f.spools_total > 1) {
        spoolDeletionSection.style.display = "block";
        
        // Crea la lista delle bobine da eliminare
        spoolDeletionList.innerHTML = "";
        const spoolsToDelete = f.spools_total - newTotal;
        
        // Crea checkbox per ogni bobina disponibile
        const totalSpools = f.spools_total;
        const sealedSpools = f.sealed_spools || 0;
        const openSpools = f.open_spools || 0;
        
        let spoolIndex = 0;
        
        // Bobine sigillate
        for (let i = 0; i < sealedSpools; i++) {
          spoolIndex++;
          const spoolDiv = document.createElement("div");
          spoolDiv.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--surface); border-radius: 0.25rem;";
          
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `spool-delete-${spoolIndex}`;
          checkbox.name = "spoolToDelete";
          checkbox.value = `sealed-${i}`;
          checkbox.dataset.spoolType = "sealed";
          checkbox.dataset.spoolIndex = i;
          
          const label = document.createElement("label");
          label.htmlFor = `spool-delete-${spoolIndex}`;
          label.style.cssText = "cursor: pointer; flex: 1; font-size: 0.85rem;";
          label.textContent = `Bobina sigillata ${spoolIndex}`;
          
          spoolDiv.appendChild(checkbox);
          spoolDiv.appendChild(label);
          spoolDeletionList.appendChild(spoolDiv);
        }
        
        // Bobine aperte
        const openSpoolsFractions = f.open_spools_fractions || [];
        for (let i = 0; i < openSpools; i++) {
          spoolIndex++;
          const spoolDiv = document.createElement("div");
          spoolDiv.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--surface); border-radius: 0.25rem;";
          
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `spool-delete-${spoolIndex}`;
          checkbox.name = "spoolToDelete";
          checkbox.value = `open-${i}`;
          checkbox.dataset.spoolType = "open";
          checkbox.dataset.spoolIndex = i;
          
          const label = document.createElement("label");
          label.htmlFor = `spool-delete-${spoolIndex}`;
          label.style.cssText = "cursor: pointer; flex: 1; font-size: 0.85rem;";
          const fraction = openSpoolsFractions[i] !== undefined ? openSpoolsFractions[i] : 1;
          const fractionPercent = Math.round(fraction * 100);
          label.textContent = `Bobina aperta ${spoolIndex} (${fractionPercent}% rimanente)`;
          
          spoolDiv.appendChild(checkbox);
          spoolDiv.appendChild(label);
          spoolDeletionList.appendChild(spoolDiv);
        }
        
        // Aggiungi hint
        const hint = document.createElement("div");
        hint.style.cssText = "margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);";
        hint.textContent = `Seleziona ${spoolsToDelete} bobina/e da eliminare`;
        spoolDeletionList.appendChild(hint);
      } else {
        spoolDeletionSection.style.display = "none";
        if (spoolDeletionList) spoolDeletionList.innerHTML = "";
      }
    };

    // Aggiungi listener ai campi
    if (sealedInput) {
      sealedInput.addEventListener("input", updateSpoolDeletionSection);
    }
    if (openInput) {
      openInput.addEventListener("input", updateSpoolDeletionSection);
    }

    openModalCentered("consumptionModal");

    if (sealedInput) {
      sealedInput.focus();
      if (typeof sealedInput.select === "function") {
        sealedInput.select();
      }
    }
  }

  function closeConsumptionModal() {
    closeModalCentered("consumptionModal");
  }

  function applyConsumptionUpdate() {
    try {
      const value = id => document.getElementById(id)?.value ?? "";
      const index = filaments.findIndex(f => f.id === value("consumptionFilamentId"));
      if (index < 0) throw new Error("Filamento non trovato.");
      const original = JSON.parse(JSON.stringify(filaments[index]));
      recalcWeightsForFilament(original);
      const sealed = requireSpoolNumber(value("consumptionSealedInput"), "Sigillate", true);
      const open = requireSpoolNumber(value("consumptionOpenInput"), "Aperte", true);
      const fraction = requireSpoolNumber(value("consumptionFractionSelect"), "Frazione");
      if (fraction > 1 || sealed + open > original.sealed_spools + original.open_spools) throw new Error("Stato bobine non valido.");
      const draft = JSON.parse(JSON.stringify(original));
      const items = getActiveFilamentSpools(original);
      draft.finished_spools += items.length - sealed - open;
      const kept = items.slice(0, sealed + open).map((spool, i) => ({ ...spool, sealed: i < sealed,
        fraction: i < sealed ? 1 : (i === sealed ? fraction : spool.fraction) }));
      setActiveFilamentSpools(draft, kept);
      recalcWeightsForFilament(draft);
      const consumed = Math.max(0, original.remaining_weight_g - draft.remaining_weight_g);
      const previousState = captureDomainState();
      saveStateForUndo(`Aggiornato consumo: ${draft.brand} – ${draft.variant}`);
      filaments[index] = draft;
      if (consumed > 0) addConsumptionEntry(draft, consumed, { persist: false });
      if (!commitDomainState(previousState)) return;
      renderAll(); closeConsumptionModal();
      showToast("Consumo aggiornato.", "success");
    } catch (error) { showToast(error.message, "error"); }
  }

  // --- Edit Filament Modal Functions ---
  function openEditFilamentModal(filamentId) {
    const original = filaments.find(f => f.id === filamentId);
    if (!original) return;
    const draft = JSON.parse(JSON.stringify(original));
    recalcWeightsForFilament(draft);
    const session = { id: filamentId, original: JSON.parse(JSON.stringify(draft)), draft,
      spools: getActiveFilamentSpools(draft), removed: [], explicitFinished: 0, initialFinished: draft.finished_spools };
    const originalIds = new Set(session.spools.map(spool => spool.id));
    let refreshSpoolRows = () => {};
    const applyGlobalColor = value => {
      const color = String(value || "").trim();
      if (!color || color === "__custom__") return;
      session.globalVariant = color;
      session.spools.forEach(spool => { spool.variant = color; });
      refreshSpoolRows();
    };
    window.filamentEditSession = session;
    const input = id => document.getElementById(id);
    const put = (id, value) => { const element = input(id); if (element) element.value = value; };
    put("editFilamentId", filamentId);
    put("editUnitWeightInput", draft.unit_weight_g);
    put("editPackagingType", draft.packaging_type || "spool");
    put("editPriceInput", draft.unit_price ?? "");
    put("editColorCodeInput", draft.color_code || "");
    put("editSupplierInput", draft.supplier || "");
    put("editNotesInput", draft.notes || "");
    put("editColorCustom", "");
    const info = input("editFilamentInfo");
    if (info) info.textContent = `${draft.brand} – ${draft.material} – ${draft.variant} · ${draft.finished_spools} bobine già terminate`;
    ["editFinishedSpoolsLabel", "editSpoolFractionLabel", "editSpoolsLocationsList"].forEach(id => { if (input(id)) input(id).style.display = "none"; });
    const globalLocationLabel = input("editLocationInput")?.closest("label");
    if (globalLocationLabel) globalLocationLabel.style.display = "none";
    const custom = input("editColorCustom");
    if (custom) {
      custom.style.display = "none";
      custom.onchange = () => {
        const value = custom.value.trim();
        if (value) { session.customGlobalApplied = value; applyGlobalColor(value); }
      };
    }
    window.editColorDropdown = createColorDropdown("editColorDropdownContainer", {
      initialValue: draft.variant || "", allowCustom: true,
      onSelect(value) {
        if (custom) { custom.style.display = value === "__custom__" ? "block" : "none"; custom.value = ""; }
        if (value !== "__custom__") applyGlobalColor(value);
        updateEditColorPreview();
      }
    });

    const syncBuffer = () => {
      const sealed = session.spools.filter(spool => spool.sealed);
      const open = session.spools.filter(spool => !spool.sealed);
      session.spools = [...sealed, ...open];
      window.currentOpenSpoolsFractions = open.map(spool => spool.fraction);
      window.currentSpoolsLocations = session.spools.map(spool => spool.location);
      window.currentSpoolsVariants = session.spools.map(spool => spool.variant);
      put("editSpoolsSealed", sealed.length);
      put("editSpoolsOpen", open.length);
      put("editSpoolsTotal", session.spools.length);
      updateEditRemainingGrams();
    };

    const renderSpools = () => {
      syncBuffer();
      [true, false].forEach(isSealed => {
        const container = input(isSealed ? "editSealedSpoolsListContainer" : "editOpenSpoolsListContainer");
        const section = input(isSealed ? "editSealedSpoolsList" : "editOpenSpoolsList");
        const items = session.spools.filter(spool => spool.sealed === isSealed);
        if (section) section.style.display = items.length ? "block" : "none";
        if (!container) return;
        container.replaceChildren();
        items.forEach((spool, index) => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem;background:var(--surface-soft);border-radius:.25rem";
          row.dataset.spoolId = spool.id;
          const title = document.createElement("span");
          title.textContent = `Bobina ${isSealed ? "sigillata" : "aperta"} ${index + 1}`;
          title.style.width = "100%";
          row.appendChild(title);
          const makeLabel = text => {
            const label = document.createElement("label");
            label.style.cssText = "flex:1;min-width:130px;margin:0";
            const caption = document.createElement("span"); caption.textContent = text;
            label.appendChild(caption); row.appendChild(label); return label;
          };
          if (!isSealed) {
            const fraction = document.createElement("select");
            fraction.dataset.fieldType = "fraction";
            fraction.dataset.spoolId = spool.id;
            const values = [...new Set([1, .9, .75, .5, .25, .1, 0, spool.fraction])].sort((a, b) => b - a);
            values.forEach(value => {
              const option = document.createElement("option"); option.value = String(value);
              option.textContent = value === 0 ? "Finita (0%)" : `${Math.round(value * 10000) / 100}%`;
              fraction.appendChild(option);
            });
            fraction.value = String(spool.fraction);
            fraction.addEventListener("change", () => {
              const value = Number(fraction.value);
              if (value === 0) {
                session.spools = session.spools.filter(item => item.id !== spool.id);
                if (originalIds.has(spool.id)) session.explicitFinished++;
                renderSpools();
              } else { spool.fraction = value; syncBuffer(); }
            });
            makeLabel("Residuo").appendChild(fraction);
          }
          const location = document.createElement("select");
          location.dataset.fieldType = "location";
          [...new Set(["", ...locationList, spool.location])].forEach(value => {
            const option = document.createElement("option"); option.value = value;
            option.textContent = value || "Nessuna posizione"; location.appendChild(option);
          });
          location.value = spool.location;
          location.addEventListener("change", () => { spool.location = location.value; syncBuffer(); });
          makeLabel("Posizione").appendChild(location);
          const colorContainer = document.createElement("div");
          colorContainer.id = `edit-spool-color-${spool.id}`;
          makeLabel("Colore").appendChild(colorContainer);
          container.appendChild(row);
          let colorControl;
          colorControl = createColorDropdown(colorContainer.id, { initialValue: spool.variant, brandHint: draft.brand,
            onSelect(value) {
              const previous = spool.variant;
              let color = value;
              if (value === "__custom__") color = prompt("Colore della bobina:", previous);
              if (color === null || !String(color || "").trim() || color === "__custom__") {
                colorControl?.setValue(previous);
                return;
              }
              spool.variant = String(color).trim();
              colorControl?.setValue(spool.variant);
              syncBuffer();
            } });
        });
      });
    };

    const syncCounts = () => {
      const sealedCount = requireSpoolNumber(input("editSpoolsSealed").value, "Bobine sigillate", true);
      const openCount = requireSpoolNumber(input("editSpoolsOpen").value, "Bobine aperte", true);
      if (sealedCount + openCount > 10000) throw new Error("Quantità troppo elevata per la modifica individuale.");
      const sealed = session.spools.filter(spool => spool.sealed).slice(0, sealedCount);
      const open = session.spools.filter(spool => !spool.sealed).slice(0, openCount);
      const reserved = new Set([...sealed, ...open].map(spool => spool.id));
      const pool = [...session.spools.filter(spool => !reserved.has(spool.id)), ...session.removed];
      const take = (list, count, isSealed) => {
        while (list.length < count) {
          let index = pool.findIndex(spool => spool.sealed === isSealed);
          if (index < 0) index = pool.length ? 0 : -1;
          const spool = index < 0 ? { id: createSpoolId(), fraction: 1, location: "", variant: draft.variant || "" } : pool.splice(index, 1)[0];
          spool.sealed = isSealed;
          if (isSealed) spool.fraction = 1;
          list.push(spool);
        }
      };
      take(sealed, sealedCount, true); take(open, openCount, false);
      session.spools = [...sealed, ...open]; session.removed = pool;
      renderSpools();
    };
    refreshSpoolRows = renderSpools;
    session.syncCounts = syncCounts;
    ["editSpoolsSealed", "editSpoolsOpen"].forEach(id => {
      const element = input(id);
      if (element) element.onchange = () => {
        try { syncCounts(); } catch (error) { showToast(error.message, "error"); }
      };
    });
    renderSpools();
    updateEditColorPreview();
    openModalCentered("editFilamentModal");
  }

  function updateEditRemainingGrams() {
    const unit = Number(document.getElementById("editUnitWeightInput")?.value);
    const session = window.filamentEditSession;
    const remainingEl = document.getElementById("editRemainingGrams");
    if (!remainingEl || !session) return;
    const remaining = session.spools.reduce((sum, spool) => sum + (spool.sealed ? 1 : spool.fraction), 0) * unit;
    remainingEl.textContent = Number.isFinite(remaining) && remaining >= 0 ? formatNumber(remaining) : "—";
  }

  // Funzione rimossa - ora usiamo dropdown personalizzato
  function renderEditColorOptions(brandHint) {
    // Non più necessaria con il nuovo dropdown
  }

  function updateEditColorPreview() {
    const customInput = document.getElementById("editColorCustom");
    const dot = document.getElementById("editColorPreviewDot");
    const label = document.getElementById("editColorPreviewLabel");

    let colorName = "";
    // Leggi dal dropdown personalizzato edit
    const dropdownValue = window.editColorDropdown ? window.editColorDropdown.getValue() : "";
    if (dropdownValue && dropdownValue !== "__custom__") {
      colorName = dropdownValue;
    } else if (customInput && customInput.value.trim()) {
      colorName = customInput.value.trim();
    }

    const hex = getColorHex(colorName);
    if (dot) dot.style.background = hex;
    if (label) label.textContent = colorName || "Nessun colore selezionato";
  }

  function closeEditFilamentModal() {
    window.filamentEditSession = null;
    window.currentOpenSpoolsFractions = null;
    window.currentSpoolsLocations = null;
    window.currentSpoolsVariants = null;
    closeModalCentered("editFilamentModal");
  }

  function applyEditFilament() {
    try {
      const session = window.filamentEditSession;
      if (!session) throw new Error("Riapri la finestra di modifica.");
      const index = filaments.findIndex(f => f.id === session.id);
      if (index < 0) throw new Error("Filamento non trovato.");
      const value = id => document.getElementById(id)?.value ?? "";
      const unit = requireSpoolNumber(value("editUnitWeightInput"), "Peso per bobina");
      if (unit <= 0) throw new Error("Il peso per bobina deve essere maggiore di zero.");
      const priceText = String(value("editPriceInput")).trim();
      const price = priceText === "" ? null : requireSpoolNumber(priceText, "Prezzo");
      session.syncCounts();
      const draft = JSON.parse(JSON.stringify(session.draft));
      const custom = document.getElementById("editColorCustom");
      if (custom && custom.style.display !== "none") {
        const color = custom.value.trim();
        if (!color || color === "__custom__") throw new Error("Inserisci il colore personalizzato.");
        if (session.customGlobalApplied !== color) {
          session.spools.forEach(spool => { spool.variant = color; });
          session.customGlobalApplied = color;
        }
      }
      draft.variant = session.spools[0]?.variant || session.globalVariant || draft.variant;
      if (!draft.variant || !draft.variant.trim()) throw new Error("Il colore è obbligatorio.");
      draft.color_code = value("editColorCodeInput").trim();
      draft.unit_weight_g = unit;
      draft.unit_price = price;
      draft.packaging_type = value("editPackagingType") || "spool";
      draft.supplier = value("editSupplierInput").trim();
      draft.notes = value("editNotesInput").trim();
      const originalIds = new Set(session.original.spools_ids);
      const removedOriginalCount = session.removed.filter(spool => originalIds.has(spool.id)).length;
      const addedCount = session.spools.filter(spool => !originalIds.has(spool.id)).length;
      draft.finished_spools = session.initialFinished + session.explicitFinished + removedOriginalCount;
      setActiveFilamentSpools(draft, session.spools);
      draft.total_weight_g = unit === session.original.unit_weight_g
        ? session.original.total_weight_g + addedCount * unit
        : session.original.total_weight_g * unit / session.original.unit_weight_g + addedCount * unit;
      recalcWeightsForFilament(draft);
      const currentById = new Map(session.spools.map(spool => [spool.id, spool]));
      const consumptions = new Map();
      if (unit === session.original.unit_weight_g) getActiveFilamentSpools(session.original).forEach(previous => {
        const current = currentById.get(previous.id);
        const consumed = Math.max(0, previous.fraction - (current?.fraction ?? 0)) * unit;
        if (consumed > 0) consumptions.set(previous.variant, (consumptions.get(previous.variant) || 0) + consumed);
      });
      const previousState = captureDomainState();
      saveStateForUndo(`Modificato filamento: ${draft.brand} – ${draft.material} – ${draft.variant}`);
      filaments[index] = draft;
      draft.spools_variants.forEach(variant => { if (variant && !colorList.includes(variant)) colorList.push(variant); });
      consumptions.forEach((grams, variant) => addConsumptionEntry({ ...draft, variant }, grams, { persist: false }));
      if (!commitDomainState(previousState)) return;
      renderAll();
      closeEditFilamentModal();
      showToast("Filamento modificato con successo.", "success");
    } catch (error) { showToast(error.message || "Modifica non valida.", "error"); }
  }

  // --- Add Purchased Filament Manually ---
  function handleAddPurchasedFilament() {
    try {
      const value = id => document.getElementById(id)?.value ?? "";
      const brand = canonicalizeBrand(value("addPurchasedBrand") === "__custom__" ? value("addPurchasedBrandCustom").trim() : value("addPurchasedBrand"));
      const material = canonicalizeMaterial(value("addPurchasedMaterial").trim());
      if (!brand || !material) throw new Error("Marca e materiale sono obbligatori.");
      const qty = requireSpoolNumber(value("addPurchasedQty"), "Quantità", true);
      const unit = requireSpoolNumber(value("addPurchasedWeight"), "Peso per bobina");
      if (!qty || !unit) throw new Error("Quantità e peso devono essere maggiori di zero.");
      const priceText = value("addPurchasedPrice").trim();
      const unitPrice = priceText === "" ? null : requireSpoolNumber(priceText, "Prezzo");
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const entry = { id: createSpoolId(), order_number: "Manuale", order_date: value("addPurchasedDate") || localDate,
        brand, material, variant: value("addPurchasedVariant").trim(), color_code: value("addPurchasedColorCode").trim(),
        packaging_type: value("addPurchasedPackaging") || "spool", quantity_spools: qty, quantity_purchased_original: qty,
        unit_weight_g: unit, unit_price: unitPrice };
      const previous = captureDomainState();
      saveStateForUndo(`Aggiunto acquisto: ${brand} – ${material}`);
      purchasedFilaments.push(entry);
      if (!brandList.includes(brand)) brandList.push(brand);
      if (!materialList.includes(material)) materialList.push(material);
      if (entry.variant && !colorList.includes(entry.variant)) colorList.push(entry.variant);
      if (!commitDomainState(previous)) return;
      renderBrandOptions(); renderMaterialOptions(); renderColorOptions(); renderAll();
      ["addPurchasedDate", "addPurchasedBrand", "addPurchasedBrandCustom", "addPurchasedMaterial", "addPurchasedVariant",
        "addPurchasedColorCode", "addPurchasedPrice"].forEach(id => { const input = document.getElementById(id); if (input) input.value = ""; });
      document.getElementById("addPurchasedQty").value = "1";
      document.getElementById("addPurchasedWeight").value = "1000";
      document.getElementById("addPurchasedPackaging").value = "spool";
      document.getElementById("addPurchasedBrandCustom").style.display = "none";
      showToast("Acquisto aggiunto.", "success");
    } catch (error) { showToast(error.message, "error"); }
  }

  function readSelectedSpoolIds(element) {
    try {
      const ids = JSON.parse(element.dataset.spoolIds || "[]");
      return Array.isArray(ids) ? ids.filter(id => typeof id === "string") : [];
    } catch (_) { return []; }
  }

  function removeSelectedSpools(selections) {
    const byFilament = new Map();
    selections.forEach(({ filamentId, spoolIds }) => {
      if (!byFilament.has(filamentId)) byFilament.set(filamentId, new Set());
      spoolIds.forEach(id => byFilament.get(filamentId).add(id));
    });
    const affected = filaments.filter(f => byFilament.has(f.id)).map(f => ({
      f, active: getActiveFilamentSpools(f), selected: byFilament.get(f.id)
    }));
    const count = affected.reduce((sum, item) => sum + item.active.filter(spool => item.selected.has(spool.id)).length, 0);
    if (!count) { showToast("Nessuna bobina attiva selezionata.", "info"); return; }
    if (!confirm(`Eliminare ${count} bobina/e selezionate? Il loro residuo verrà rimosso dall'inventario come rettifica; i consumi già registrati resteranno nello storico.`)) return;
    if (!commitMutation(`Eliminate ${count} bobine selezionate`, () => {
      affected.forEach(({ f, active, selected }) => {
        const removedWeight = active.filter(spool => selected.has(spool.id))
          .reduce((sum, spool) => sum + spool.fraction * f.unit_weight_g, 0);
        setActiveFilamentSpools(f, active.filter(spool => !selected.has(spool.id)));
        f.total_weight_g = Math.max(0, f.total_weight_g - removedWeight);
        f.removed_weight_g = (f.removed_weight_g || 0) + removedWeight;
        recalcWeightsForFilament(f);
      });
      // Conserva anche i record senza bobine attive: spiegano consumi e rettifiche passati.
    })) return;
    renderAll();
    const selectAll = document.getElementById("selectAllFilaments");
    if (selectAll) selectAll.checked = false;
    showToast(`${count} bobina/e eliminate.`, "success");
  }

  function deleteFilament(filamentId, spoolIds) {
    const f = filaments.find(item => item.id === filamentId);
    if (!f) return;
    removeSelectedSpools([{ filamentId, spoolIds: spoolIds || getActiveFilamentSpools(f).map(spool => spool.id) }]);
  }

  function deleteSelectedFilaments() {
    const checkboxes = document.querySelectorAll(".filament-select-checkbox:checked");
    removeSelectedSpools(Array.from(checkboxes).map(checkbox => ({
      filamentId: checkbox.dataset.id, spoolIds: readSelectedSpoolIds(checkbox)
    })));
  }

  function downloadJsonContent(content, filename) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const date = new Date().toISOString().slice(0, 10);
    if (!stateReady) {
      const raw = lastKnownStorageRaw;
      if (raw === null) return showToast("Nessun registro recuperabile da esportare.", "error");
      downloadJsonContent(raw, `registro_filamenti_${date}_recupero.json`);
      showToast("Esportata la copia originale da recuperare; i dati non sono stati alterati.", "info");
      return;
    }
    try {
      const data = validateStateCandidate(captureStateSnapshot(), false);
      const exportData = {
        ...data, file_type: "database_backup", export_version: INITIAL_VERSION,
        export_date: new Date().toISOString(),
        description: "Backup completo: inventario, acquisti, consumi, cataloghi, posizioni e impostazioni. Cronologia undo esclusa."
      };
      downloadJsonContent(JSON.stringify(exportData, null, 2), `registro_filamenti_${date}_${INITIAL_VERSION.replace(".", "")}.json`);
      showToast("Backup dello stato corrente esportato, inclusi consumi e posizioni.", "success");
    } catch (error) {
      showToast("Esportazione non riuscita: " + error.message, "error");
    }
  }

  function exportInvoicesJson() {
    if (!purchasedFilaments.length) return showToast("Nessuna fattura importata da esportare.", "info");
    const orders = new Map();
    purchasedFilaments.forEach(p => {
      const orderNumber = p.order_number || "senza-numero-" + p.id;
      if (!orders.has(orderNumber)) orders.set(orderNumber, { orderNumber, orderDate: p.order_date || "", items: [] });
      const quantity = p.quantity_purchased_original ?? p.quantity_spools;
      if (quantity <= 0) return;
      orders.get(orderNumber).items.push({
        id: p.id, brand: p.brand, material: p.material, variant: p.variant, color_code: p.color_code,
        sku: p.sku || "", quantity_spools: quantity, unit_price: p.unit_price,
        packaging_type: p.packaging_type || "spool", unit_weight_g: p.unit_weight_g
      });
    });
    const payload = { file_type: "invoices_import", export_version: INITIAL_VERSION, export_date: new Date().toISOString(), orders: [...orders.values()].filter(order => order.items.length) };
    downloadJsonContent(JSON.stringify(payload, null, 2), `fatture_filamenti_${new Date().toISOString().slice(0, 10)}_${INITIAL_VERSION.replace(".", "")}.json`);
    showToast("Fatture esportate con quantità acquistate originali.", "success");
  }

  function refreshStateViews() {
    renderBrandOptions();
    renderMaterialOptions();
    renderColorOptions();
    populateFilterOptions();
    renderAll();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    updateHistoryUI();
  }

  function commitReplacementState(candidate, actionDescription, keepUndo = true) {
    const previous = captureStateSnapshot(true);
    const previousReady = stateReady;
    const previousBlocked = storageWriteBlocked;
    const previousReason = storageBlockReason;
    const previousRaw = lastKnownStorageRaw;
    const previousValid = lastKnownStorageValid;
    const previousPayload = lastSavedPayload;
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      if (storageWriteBlocked || !stateReady) {
        // Il ripristino esplicito conserva anche un eventuale originale danneggiato.
        if (currentRaw !== null) localStorage.setItem(STORAGE_KEY + "_rejected", currentRaw);
        lastKnownStorageRaw = currentRaw;
        lastKnownStorageValid = false;
      }
      applyStateSnapshot(candidate, true);
      undoStack = keepUndo && previousReady && !previousBlocked
        ? [...previous.undoStack, { ...previous, undoStack: undefined, redoStack: undefined, actionDescription, timestamp: new Date().toISOString() }].slice(-MAX_UNDO_HISTORY)
        : [];
      redoStack = [];
      stateReady = true;
      storageWriteBlocked = false;
      storageBlockReason = "";
      lastSavedPayload = "";
      if (!saveState()) throw new Error("Il nuovo stato non è stato salvato");
      return true;
    } catch (error) {
      const conflict = storageWriteBlocked;
      const conflictReason = storageBlockReason;
      applyStateSnapshot(previous, true);
      stateReady = previousReady;
      storageWriteBlocked = previousBlocked || conflict;
      storageBlockReason = conflictReason || previousReason;
      lastKnownStorageRaw = previousRaw;
      lastKnownStorageValid = previousValid;
      lastSavedPayload = previousPayload;
      reportStorageError("Ripristino non applicato: " + error.message, error);
      return false;
    }
  }

  function buildInvoiceImportCandidate(data) {
    requireRecord(data, "File fatture");
    const orders = data.orders ?? data.invoices;
    if (!Array.isArray(orders)) throw new Error("Elenco ordini mancante");
    const candidate = captureStateSnapshot();
    const existingOrders = new Set(candidate.purchasedFilaments.map(p => p.order_number).filter(Boolean));
    const existingIds = new Set(candidate.purchasedFilaments.map(p => p.id));
    let skipped = 0;
    let added = 0;
    for (const rawOrder of orders) {
      const order = requireRecord(rawOrder, "Ordine");
      const orderNumber = validateText(order.orderNumber ?? order.invoiceNumber ?? order.number, "Numero ordine");
      if (orderNumber && existingOrders.has(orderNumber)) { skipped++; continue; }
      const orderDate = validateText(order.orderDate ?? order.invoiceDate ?? order.date, "Data ordine");
      const items = order.items ?? order.lines ?? order.products;
      if (!Array.isArray(items)) throw new Error("Righe ordine mancanti o non valide");
      for (const rawItem of items) {
        const item = requireRecord(rawItem, "Riga fattura");
        const qty = parseImportNumber(item.quantity_spools ?? item.quantitySpools ?? item.qty_spools ?? item.qty ?? item.quantity ?? 1, "Quantità fattura", { integer: true, min: 1 });
        const sku = validateText(item.sku, "SKU");
        const id = validateText(item.id, "ID fattura") || makeStableId("inv");
        if (existingIds.has(id)) throw new Error("ID riga fattura già presente: " + id);
        existingIds.add(id);
        const variant = validateText(item.variant ?? item.color ?? item.bambuColorName, "Colore fattura");
        let unitPrice = null;
        const unitValue = item.unit_price ?? item.price_per_unit ?? item.price_eur ?? item.price;
        const totalValue = item.total_price ?? item.subtotal ?? item.total;
        // Compatibilità: price e price_eur sono sempre unitari; per un totale usare total_price/subtotal/total.
        if (unitValue !== undefined && unitValue !== null) unitPrice = parseImportNumber(unitValue, "Prezzo unitario fattura");
        else if (totalValue !== undefined && totalValue !== null) unitPrice = parseImportNumber(totalValue, "Totale riga fattura") / qty;
        let packaging = validateText(item.packaging_type ?? item.form, "Formato bobina").toLowerCase();
        if (!packaging) packaging = /SPLFREE|refill/i.test(sku + " " + variant) ? "refill" : "spool";
        packaging = /refill|ricarica|senza bobina/.test(packaging) ? "refill" : "spool";
        const skuWeight = sku.match(/-(\d+)-(?:SPL|SPLFREE)/i);
        const unitWeight = parseImportNumber(item.unit_weight_g ?? item.weight_g_per_spool ?? item.weight_g ?? (skuWeight ? skuWeight[1] : null), "Peso fattura", { optional: true, min: Number.MIN_VALUE });
        candidate.purchasedFilaments.push({
          id, order_number: orderNumber, order_date: orderDate,
          brand: canonicalizeBrand(validateText(item.brand ?? order.brand, "Marca fattura")),
          material: canonicalizeMaterial(validateText(item.material, "Materiale fattura")),
          variant, color_code: validateText(item.color_code ?? item.colorCode ?? item.bambuColorCode, "Codice colore"),
          sku, packaging_type: packaging, quantity_spools: qty, quantity_purchased_original: qty,
          unit_weight_g: unitWeight, unit_price: unitPrice
        });
        added++;
      }
      if (orderNumber) existingOrders.add(orderNumber);
    }
    return { candidate: validateStateCandidate(candidate), added, skipped };
  }

  function importJsonData(data) {
    requireRecord(data, "JSON");
    const isBackup = data.file_type === "database_backup" || (Array.isArray(data.filaments) && data.file_type !== "invoices_import");
    if (isBackup) {
      const candidate = validateStateCandidate(data);
      const warning = storageWriteBlocked ? " Il registro locale è bloccato: verrà conservata una copia dell'originale." : "";
      if (!window.confirm("Ripristinare questo backup sostituendo inventario, acquisti, consumi e impostazioni correnti?" + warning)) return false;
      if (!commitReplacementState(candidate, "Ripristino backup")) return false;
      pendingPurchasedTransfer = null;
      currentSearch = "";
      const search = document.getElementById("stockSearchInput");
      if (search) search.value = "";
      refreshStateViews();
      const legacyInfo = data.schemaVersion === undefined ? " Il formato precedente non include eventuali consumi o impostazioni mancanti." : "";
      showToast("Backup ripristinato: " + candidate.filaments.length + " filamenti e " + candidate.purchasedFilaments.length + " acquisti." + legacyInfo, "success");
      return true;
    }
    if (data.file_type === "invoices_import" || Array.isArray(data.orders) || Array.isArray(data.invoices)) {
      if (!stateReady || storageWriteBlocked) throw new Error("Prima di aggiungere fatture è necessario recuperare o ricaricare il registro");
      const result = buildInvoiceImportCandidate(data);
      if (!result.added) { showToast("Nessuna nuova riga fattura. Ordini già presenti: " + result.skipped, "info"); return true; }
      if (!commitReplacementState(result.candidate, "Importazione fatture")) return false;
      refreshStateViews();
      showToast("Importate " + result.added + " righe fattura. Ordini già presenti saltati: " + result.skipped, "success");
      return true;
    }
    throw new Error("JSON non riconosciuto: mancano filaments oppure orders/invoices");
  }

  function setupImportJson() {
    const input = document.getElementById("importJsonInput");
    const button = document.getElementById("importJsonButton");
    if (!input) return;
    if (button) button.addEventListener("click", () => input.click());
    input.addEventListener("change", event => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { showToast("Il JSON supera 20 MB. Riduci il file prima di importarlo.", "error"); input.value = ""; return; }
      const reader = new FileReader();
      reader.onerror = () => { showToast("Impossibile leggere il file JSON.", "error"); input.value = ""; };
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result, (key, value) => {
            if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Chiave non ammessa nel JSON");
            return value;
          });
          importJsonData(data);
        } catch (error) {
          console.error(error);
          showToast("Importazione non applicata: " + error.message, "error");
        } finally { input.value = ""; }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  function clearPurchasedData() {
    if (!window.confirm("Cancellare il registro acquisti? I filamenti disponibili restano invariati.")) return;
    const candidate = validateStateCandidate(captureStateSnapshot());
    candidate.purchasedFilaments = [];
    if (!commitReplacementState(candidate, "Cancellazione registro acquisti")) return;
    refreshStateViews();
    closeSettingsModal();
    showToast("Registro acquisti cancellato.", "success");
  }

  function clearAvailableData() {
    if (!window.confirm("Cancellare il magazzino disponibile? Acquisti e storico consumi restano invariati.")) return;
    const candidate = validateStateCandidate(captureStateSnapshot());
    candidate.filaments = [];
    if (!commitReplacementState(candidate, "Cancellazione magazzino")) return;
    refreshStateViews();
    closeSettingsModal();
    showToast("Magazzino disponibile cancellato.", "success");
  }

  function clearAllData() {
    if (!window.confirm("Azzerare inventario, acquisti, consumi, cronologia e preferenze? Una copia precedente resta disponibile per recupero.")) return;
    const candidate = validateStateCandidate({ filaments: [], purchasedFilaments: [], consumptionHistory: [], locations: [], settings: { theme: "dark", lowStockThreshold: 25 } });
    if (!commitReplacementState(candidate, "Azzeramento registro", false)) return;
    // Il v4 vuoto è un tombstone: i dati legacy non vengono più ricaricati.
    const legacyKeys = ["registroFilamentiState_v2", "registroFilamentiState_v1", "registroFilamentiState", BRAND_LIST_KEY, MATERIAL_LIST_KEY, COLOR_LIST_KEY, LOCATION_LIST_KEY, CONSUMPTION_HISTORY_KEY, UNDO_STACK_KEY, REDO_STACK_KEY, THEME_KEY, LOW_STOCK_THRESHOLD_KEY, VERSION_KEY];
    try { legacyKeys.forEach(key => localStorage.removeItem(key)); }
    catch (error) { console.warn("Chiavi legacy non rimosse; restano escluse dal registro v4:", error); }
    pendingPurchasedTransfer = null;
    refreshStateViews();
    closeSettingsModal();
    showToast("Registro azzerato. La copia precedente di sicurezza è conservata.", "success");
  }

  function setupUnitWeightPreset() {
    const preset = document.getElementById("addUnitWeightPreset");
    const input = document.getElementById("addUnitWeightInput");
    if (!preset || !input) return;

    const syncUnitInputs = () => {
      const value = preset.value;
      if (value && value !== "__custom__") {
        input.value = value;
        input.readOnly = true;
        input.placeholder = "Altro valore in grammi";
      } else {
        input.readOnly = false;
        if (!input.value) {
          input.value = "";
        }
        input.placeholder = "Es. 1000";
      }
    };

    preset.addEventListener("change", syncUnitInputs);
    syncUnitInputs();
  }

  function setupSpoolsTotalAuto() {
    const totalInput = document.getElementById("addSpoolsTotalInput");
    const sealedInput = document.getElementById("addSealedSpoolsInput");
    const openInput = document.getElementById("addOpenSpoolsInput");
    const fractionSelect = document.getElementById("addFractionSelect");
    const locationsContainer = document.getElementById("addSpoolsLocationsContainer");
    const locationsList = document.getElementById("addSpoolsLocationsList");
    if (!totalInput || !sealedInput || !openInput) return;

    totalInput.readOnly = true;

    const updateLocationsList = () => {
      if (!locationsContainer || !locationsList) return;
      
      const sealed = parseInt(sealedInput.value || "0", 10);
      const open = parseInt(openInput.value || "0", 10);
      const sealedSafe = isNaN(sealed) ? 0 : sealed;
      const openSafe = isNaN(open) ? 0 : open;
      const total = sealedSafe + openSafe;

      if (total > 0) {
        locationsContainer.style.display = "block";
        locationsList.innerHTML = "";

        for (let i = 0; i < total; i++) {
          const spoolDiv = document.createElement("div");
          spoolDiv.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--surface); border-radius: 0.375rem;";

          const label = document.createElement("label");
          label.style.cssText = "display: flex; align-items: center; gap: 0.5rem; flex: 1; margin: 0;";
          
          const labelText = document.createElement("span");
          labelText.style.cssText = "font-size: 0.85rem; font-weight: 600; min-width: 80px;";
          const spoolType = i < sealedSafe ? "Nuova" : "Aperta";
          const spoolNumber = i < sealedSafe ? i + 1 : (i - sealedSafe + 1);
          labelText.textContent = `Bobina ${spoolNumber} (${spoolType}):`;

          const locationSelect = document.createElement("select");
          locationSelect.id = `addSpoolLocation_${i}`;
          locationSelect.dataset.spoolIndex = i;
          locationSelect.style.cssText = "flex: 1; padding: 0.4rem; border-radius: 0.375rem; border: 1px solid var(--border-subtle); background: var(--surface-soft); color: var(--text-main);";
          locationSelect.innerHTML = generateLocationOptions("");

          label.appendChild(labelText);
          label.appendChild(locationSelect);
          spoolDiv.appendChild(label);
          locationsList.appendChild(spoolDiv);
        }
      } else {
        locationsContainer.style.display = "none";
        locationsList.innerHTML = "";
      }
    };

    const sync = () => {
      const sealed = parseInt(sealedInput.value || "0", 10);
      const open = parseInt(openInput.value || "0", 10);
      const sealedSafe = isNaN(sealed) ? 0 : sealed;
      const openSafe = isNaN(open) ? 0 : open;
      const sum = sealedSafe + openSafe;
      totalInput.value = sum > 0 ? String(sum) : "";

      // Disable fraction select if no open spools (only sealed/new spools)
      if (fractionSelect) {
        if (openSafe === 0) {
          fractionSelect.disabled = true;
          fractionSelect.value = "1"; // Reset to full
          fractionSelect.title = "Non applicabile con solo bobine nuove";
        } else {
          fractionSelect.disabled = false;
          fractionSelect.title = "";
        }
      }

      // Aggiorna la lista delle posizioni
      updateLocationsList();
    };

    sealedInput.addEventListener("input", sync);
    openInput.addEventListener("input", sync);
    sync();
  }

  function setupBrandSelectForColors() {
    const brandSel = document.getElementById("addBrandSelect");
    const brandCustom = document.getElementById("addBrandCustom");
    if (!brandSel) return;

    brandSel.addEventListener("change", () => {
      if (brandSel.value === "__custom__" && brandCustom) {
        brandCustom.focus();
      }
      renderColorOptions();
      updateColorPreviewFromSelection();
    });
  }

  // Funzione per scrollare alla sezione aggiungi filamenti
  function scrollToAddSection() {
    const addSection = document.getElementById("addSection");
    if (addSection) {
      addSection.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Scorri giù per aggiungere il filamento.", "info");
    }
  }

  // Funzione per aprire modal di trasferimento con scelta quantità
  function openTransferModal(purchasedId) {
    const p = purchasedFilaments.find(x => x.id === purchasedId);
    if (!p) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    const qty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools || 1);
    if (qty < 1) {
      showToast("Non ci sono bobine disponibili.", "error");
      return;
    }

    // Chiedi la quantità da trasferire
    const qtyToTransfer = prompt(
      `Quante bobine vuoi trasferire al magazzino?\n` +
      `Filamento: ${p.brand} ${p.material} ${p.variant}\n` +
      `Disponibili: ${qty}`,
      "1"
    );

    if (qtyToTransfer === null) return; // Annullato

    const numQty = parseInt(qtyToTransfer, 10);
    if (isNaN(numQty) || numQty < 1) {
      showToast("Inserisci un numero valido maggiore di 0.", "error");
      return;
    }
    if (numQty > qty) {
      showToast(`Non puoi trasferire più di ${qty} bobine.`, "error");
      return;
    }

    // Prefill e scroll
    prefillAddFormFromPurchased(p, numQty);
    scrollToAddSection();
  }

  function prefillAddFormFromPurchased(entry, quantity) {
    if (!entry) return;

    const qty = quantity && quantity > 0 ? quantity : 1;
    pendingPurchasedTransfer = {
      entryIndex: purchasedFilaments.indexOf(entry),
      maxQuantity: qty
    };

    const brand = canonicalizeBrand(entry.brand || "");
    const material = canonicalizeMaterial(entry.material || "");
    const variant = entry.variant || "";
    const colorCode = entry.color_code || entry.colorCode || "";

    if (brand && !brandList.includes(brand)) {
      brandList.push(brand);
      brandList = cleanBrandList(brandList);
      /* Catalogo incluso nello snapshot del registro. */
    }
    if (material && !materialList.includes(material)) {
      materialList.push(material);
      materialList = cleanMaterialList(materialList);
      /* Catalogo incluso nello snapshot del registro. */
    }
    if (variant && !colorList.includes(variant)) {
      colorList.push(variant);
      colorList = Array.from(new Set(colorList));
      /* Catalogo incluso nello snapshot del registro. */
    }

    renderBrandOptions();
    renderMaterialOptions();
    renderColorOptions();

    const brandSel = document.getElementById("addBrandSelect");
    const brandCustom = document.getElementById("addBrandCustom");
    const matSel = document.getElementById("addMaterialSelect");
    const matCustom = document.getElementById("addMaterialCustom");
    const colorCustom = document.getElementById("addColorCustom");
    const colorCodeInput = document.getElementById("addColorCodeInput");
    const spoolsTotalInput = document.getElementById("addSpoolsTotalInput");
    const sealedInput = document.getElementById("addSealedSpoolsInput");
    const openInput = document.getElementById("addOpenSpoolsInput");
    const fractionSelect = document.getElementById("addFractionSelect");

    // Forza aggiornamento delle opzioni del select prima di impostare il valore
    setTimeout(() => {
      if (brandSel) {
        if (brand) {
          brandSel.value = brand;
          if (brandSel.value !== brand && brandCustom) {
            brandSel.value = "__custom__";
            brandCustom.value = brand;
            brandCustom.style.display = "block";
          } else if (brandCustom) {
            brandCustom.value = "";
            brandCustom.style.display = "none";
          }
        } else {
          brandSel.value = "";
          if (brandCustom) brandCustom.value = "";
        }
      }

      if (matSel) {
        if (material) {
          matSel.value = material;
          if (matSel.value !== material && matCustom) {
            matSel.value = "__custom__";
            matCustom.value = material;
            matCustom.style.display = "block";
          } else if (matCustom) {
            matCustom.value = "";
            matCustom.style.display = "none";
          }
        } else {
          matSel.value = "";
          if (matCustom) matCustom.value = "";
        }
      }

      // Imposta colore nel nuovo dropdown personalizzato
      if (window.addColorDropdown && variant) {
        // Verifica se il colore è nella lista
        if (colorList.includes(variant)) {
          window.addColorDropdown.setValue(variant);
          if (colorCustom) {
            colorCustom.value = "";
            colorCustom.style.display = "none";
          }
        } else {
          // Colore non in lista, usa input personalizzato
          window.addColorDropdown.setValue("__custom__");
          if (colorCustom) {
            colorCustom.value = variant;
            colorCustom.style.display = "block";
          }
        }
      } else if (window.addColorDropdown) {
        window.addColorDropdown.setValue("");
        if (colorCustom) {
          colorCustom.value = "";
          colorCustom.style.display = "none";
        }
      }

      if (colorCodeInput) {
        colorCodeInput.value = colorCode;
      }

      if (spoolsTotalInput) spoolsTotalInput.value = String(qty);
      if (sealedInput) sealedInput.value = String(qty);
      if (openInput) openInput.value = "0";

      if (fractionSelect) {
        fractionSelect.value = "1";
        fractionSelect.disabled = true; // Disable since all spools are sealed
      }

      // Prefill packaging type
      const packagingSelect = document.getElementById("addPackagingType");
      if (packagingSelect && entry.packaging_type) {
        packagingSelect.value = entry.packaging_type;
      }

      // Prefill price
      const priceInput = document.getElementById("addPriceInput");
      if (priceInput) {
        priceInput.value = entry.unit_price != null ? entry.unit_price : "";
      }

      // Prefill unit weight
      const unitWeightPreset = document.getElementById("addUnitWeightPreset");
      const unitWeightInput = document.getElementById("addUnitWeightInput");
      if (entry.unit_weight_g && unitWeightPreset) {
        const standardWeights = ["1000", "750", "500", "250"];
        const weightStr = String(entry.unit_weight_g);
        if (standardWeights.includes(weightStr)) {
          unitWeightPreset.value = weightStr;
          if (unitWeightInput) unitWeightInput.style.display = "none";
        } else {
          unitWeightPreset.value = "__custom__";
          if (unitWeightInput) {
            unitWeightInput.value = entry.unit_weight_g;
            unitWeightInput.style.display = "block";
          }
        }
      }

      updateColorPreviewFromSelection();
    }, 50);

    const addSection = document.getElementById("addSection");
    if (addSection && typeof addSection.scrollIntoView === "function") {
      addSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    showToast(
      "Campi precompilati dal magazzino filamenti comprati. Verifica i dati e premi 'Aggiungi filamento'.",
      "success"
    );
  }

  // Funzioni per gestire la soglia di allarme
  function getLowStockThreshold() {
    return appSettings.lowStockThreshold;
  }

  function saveLowStockThreshold(threshold) {
    try {
      const value = parseImportNumber(threshold, "Soglia scorte", { max: 100 });
      if (value === appSettings.lowStockThreshold) return true;
      return commitMutation("Modificata soglia scorte", () => { appSettings.lowStockThreshold = value; });
    } catch (error) {
      showToast("Soglia non salvata: " + error.message, "error");
      return false;
    }
  }

  function openSettingsModal() {
    openModalCentered("settingsModal");
    renderLocationsList();
    
    // Carica e mostra la soglia corrente
    const thresholdInput = document.getElementById("lowStockThresholdInput");
    if (thresholdInput) {
      thresholdInput.value = getLowStockThreshold();
    }
  }

  function closeSettingsModal() {
    closeModalCentered("settingsModal");
  }

  // Funzione per trovare le bobine sotto la soglia
  function getLowStockFilaments(threshold) {
    const ratio = f => {
      const capacity = ((f.sealed_spools || 0) + (f.open_spools || 0)) * (f.unit_weight_g || 0);
      return capacity > 0 ? (f.remaining_weight_g || 0) / capacity : Infinity;
    };
    return filaments.filter(f => ratio(f) <= threshold / 100).sort((a, b) => ratio(a) - ratio(b));
  }

  // Funzione per mostrare il resoconto delle bobine in esaurimento
  function showLowStockReport() {
    const threshold = getLowStockThreshold();
    const lowStockFilaments = getLowStockFilaments(threshold);
    
    if (lowStockFilaments.length === 0) {
      return; // Nessuna bobina sotto la soglia, non mostrare nulla
    }

    const modal = document.getElementById("lowStockReportModal");
    const thresholdSpan = document.getElementById("lowStockReportThreshold");
    const listContainer = document.getElementById("lowStockReportList");
    
    if (!modal || !thresholdSpan || !listContainer) return;

    thresholdSpan.textContent = threshold;

    listContainer.innerHTML = "";
    
    lowStockFilaments.forEach(f => {
      const activeCapacity = ((f.sealed_spools || 0) + (f.open_spools || 0)) * f.unit_weight_g;
      const ratio = activeCapacity > 0 ? f.remaining_weight_g / activeCapacity : 0;
      const percentage = Math.round(ratio * 100);
      
      const item = document.createElement("div");
      item.style.cssText = "display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--surface-soft); border-radius: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid #ef4444;";
      
      const colorHex = getColorHex(f.variant);
      const pillHtml = getColoredPillHtml(f.variant);
      
      // Barra di progresso
      const barHtml = `
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span style="font-weight: 600;">${escapeHtml(canonicalizeBrand(f.brand) || "-")} – ${escapeHtml(f.material || "-")}</span>
            <span style="color: var(--text-muted);">${percentage}% residuo</span>
          </div>
          <div style="background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 8px; position: relative;">
            <div style="width: ${percentage}%; height: 100%; background: ${percentage <= threshold ? '#ef4444' : '#f59e0b'}; transition: width 0.3s ease; border-radius: 999px;"></div>
          </div>
          <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-muted);">
            <span>${(f.sealed_spools || 0) + (f.open_spools || 0)} bobine attive</span>
            <span>${formatNumber(f.remaining_weight_g || 0, 0)}g / ${formatNumber(activeCapacity, 0)}g</span>
          </div>
        </div>
      `;
      
      item.innerHTML = `
        <div style="min-width: 180px;">
          ${pillHtml}
        </div>
        ${barHtml}
      `;
      
      listContainer.appendChild(item);
    });

    // Event listeners per chiudere il modal
    const closeBtn = document.getElementById("lowStockReportCloseBtn");
    const closeButton = document.getElementById("lowStockReportCloseButton");
    
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeModalCentered("lowStockReportModal");
      });
    }
    
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        closeModalCentered("lowStockReportModal");
      });
    }

    // Mostra il modal
    openModalCentered("lowStockReportModal");
  }

  function runSelfTests() {
    try {
      const testFilament = {
        unit_weight_g: 1000,
        spools_total: 2,
        sealed_spools: 1,
        open_spools: 1,
        main_fraction: 0.5,
        total_weight_g: 2000
      };
      recalcWeightsForFilament(testFilament);
      console.assert(
        testFilament.remaining_weight_g === 1500,
        "Test recalcWeightsForFilament (caso base): expected 1500 g residui"
      );
      console.assert(
        testFilament.used_weight_g === 500,
        "Test recalcWeightsForFilament (caso base): expected 500 g usati"
      );

      const emptyFilament = {
        unit_weight_g: 1000,
        spools_total: 1,
        sealed_spools: 0,
        open_spools: 0,
        main_fraction: 0,
        total_weight_g: 1000
      };
      recalcWeightsForFilament(emptyFilament);
      console.assert(
        emptyFilament.remaining_weight_g === 0,
        "Test recalcWeightsForFilament (tutto consumato): expected 0 g residui"
      );
      console.assert(
        emptyFilament.used_weight_g === 1000,
        "Test recalcWeightsForFilament (tutto consumato): expected 1000 g usati"
      );

      const dups = deduplicateFilamentsByIdentity([
        {
          id: "a1",
          brand: "Bambu Lab",
          material: "PLA",
          variant: "Nero",
          color_code: "BA-01",
          unit_weight_g: 1000,
          spools_total: 1,
          sealed_spools: 1,
          open_spools: 0,
          total_weight_g: 1000,
          remaining_weight_g: 1000,
          used_weight_g: 0,
          main_fraction: 1
        },
        {
          id: "a2",
          brand: "Bambu Lab",
          material: "PLA",
          variant: "Nero",
          color_code: "BA-01",
          unit_weight_g: 1000,
          spools_total: 1,
          sealed_spools: 0,
          open_spools: 1,
          total_weight_g: 1000,
          remaining_weight_g: 500,
          used_weight_g: 500,
          main_fraction: 0.5
        }
      ]);
      console.assert(
        dups.length === 1 && dups[0].spools_total === 2,
        "Test deduplicateFilamentsByIdentity: attesa una sola riga con 2 bobine"
      );
    } catch (e) {
      console.error("Self tests failed:", e);
    }
  }

  // Inizializza il contesto audio al primo click/interazione utente
  function initAudioContext() {
    if (!window.successAudioContext) {
      try {
        window.successAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.debug("Audio non supportato:", e);
      }
    }
  }
  
  // Inizializza audio al primo click sulla pagina
  document.addEventListener("click", () => {
    initAudioContext();
  }, { once: true });

  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded eseguito");
    
    // Inizializza floating layer per i dropdown
    initFloatingLayer();
    
    try {
      // Carica la versione da localStorage e aggiorna l'UI
      loadVersion();

      initTheme();
      
      try {
        loadState();
      } catch (e) {
        console.error("Errore critico nel caricamento dello stato:", e);
        alert("Errore critico nel caricamento dei dati. Controlla la console per dettagli.");
      }
    loadUndoRedoStacks(); // Carica gli stack undo/redo
    updateHistoryUI(); // Aggiorna la UI con gli stack caricati
    renderBrandOptions();
    renderMaterialOptions();
    renderColorOptions();
    
    // Inizializza dropdown colore personalizzato per form aggiungi
    window.addColorDropdown = createColorDropdown("addColorDropdownContainer", {
      placeholder: "Seleziona colore...",
      allowCustom: true,
      customLabel: "Altro colore...",
      onSelect: (value) => {
        const customInput = document.getElementById("addColorCustom");
        if (value === "__custom__") {
          customInput.style.display = "block";
          customInput.focus();
        } else {
          customInput.style.display = "none";
          customInput.value = "";
        }
        updateColorPreviewFromSelection();
      }
      });

      updateColorPreviewFromSelection();
      setupUnitWeightPreset();
      setupSpoolsTotalAuto();
      setupBrandSelectForColors();
      setupFilterListeners();
      populateFilterOptions();
      renderAll();
      renderConsumptionChart();
      renderConsumptionHistory();
      renderConsumptionStats();
      
      // Inizializza modal trascinabili
      initDraggableModals();

      const refreshBtn = document.getElementById("refreshAppButton");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        // Forza un salvataggio immediato prima di ricaricare
        if (!saveState()) return;
        loadState();
        renderBrandOptions();
        renderMaterialOptions();
        renderColorOptions();
        updateColorPreviewFromSelection();
        populateFilterOptions();
        renderAll();
        renderConsumptionChart();
        renderConsumptionHistory();
        renderConsumptionStats();
        renderConsumptionByDifference();
        showToast("Dati ricaricati dal browser (JSON salvato).", "success");
      });
    }

      // Undo/Redo buttons con dropdown
      const undoBtn = document.getElementById("undoButton");
    const undoDropdown = document.getElementById("undoDropdown");
    if (undoBtn) {
      undoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (undoStack.length === 0) return;
        
        // Se clicchi sulla freccia o sul pulsante quando il dropdown è chiuso, mostra dropdown
        // Se clicchi quando è aperto, esegui l'azione normale
        if (undoDropdown) {
          const isVisible = undoDropdown.style.display !== "none";
          // Chiudi tutti i dropdown
          const allDropdowns = document.querySelectorAll(".undo-redo-dropdown");
          allDropdowns.forEach(d => d.style.display = "none");
          
          // Se il dropdown era chiuso, aprilo
          if (!isVisible) {
            undoDropdown.style.display = "block";
            updateHistoryUI(); // Aggiorna il contenuto
          } else {
            // Se era aperto, esegui l'azione normale
            undoAction();
          }
        } else {
          undoAction();
        }
      });
    }
    
    const redoBtn = document.getElementById("redoButton");
    const redoDropdown = document.getElementById("redoDropdown");
    if (redoBtn) {
      redoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (redoStack.length === 0) return;
        
        // Se clicchi sulla freccia o sul pulsante quando il dropdown è chiuso, mostra dropdown
        // Se clicchi quando è aperto, esegui l'azione normale
        if (redoDropdown) {
          const isVisible = redoDropdown.style.display !== "none";
          // Chiudi tutti i dropdown
          const allDropdowns = document.querySelectorAll(".undo-redo-dropdown");
          allDropdowns.forEach(d => d.style.display = "none");
          
          // Se il dropdown era chiuso, aprilo
          if (!isVisible) {
            redoDropdown.style.display = "block";
            updateHistoryUI(); // Aggiorna il contenuto
          } else {
            // Se era aperto, esegui l'azione normale
            redoAction();
          }
        } else {
          redoAction();
        }
      });
    }

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".undo-redo-dropdown") && !e.target.closest("#undoButton") && !e.target.closest("#redoButton")) {
        const allDropdowns = document.querySelectorAll(".undo-redo-dropdown");
        allDropdowns.forEach(d => d.style.display = "none");
      }
    });

      // Scorciatoie da tastiera per undo/redo
      document.addEventListener("keydown", (e) => {
      // Gli editor mantengono il proprio annulla/ripristina del testo.
      if (e.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      // Ctrl+Z o Cmd+Z per undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoAction();
      }
      // Ctrl+Y o Ctrl+Shift+Z per redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoAction();
      }
    });

      const settingsBtn = document.getElementById("settingsButton");
      if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
          try {
            openSettingsModal();
            updateHistoryUI(); // Aggiorna la cronologia quando si apre il modal
          } catch (e) {
            console.error("Errore nell'apertura delle impostazioni:", e);
            alert("Errore nell'apertura delle impostazioni. Controlla la console.");
          }
        });
      }

    const settingsCloseBtn = document.getElementById("settingsCloseButton");
    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener("click", closeSettingsModal);
    }

    const settingsCancelBtn = document.getElementById("settingsCancelButton");
    if (settingsCancelBtn) {
      settingsCancelBtn.addEventListener("click", closeSettingsModal);
    }

    // Add to stock modal event listeners
    const addToStockCloseBtn = document.getElementById("addToStockModalCloseButton");
    const addToStockCancelBtn = document.getElementById("addToStockModalCancelButton");
    const addToStockConfirmBtn = document.getElementById("addToStockModalConfirmButton");
    
    if (addToStockCloseBtn) {
      addToStockCloseBtn.addEventListener("click", closeAddToStockModal);
    }
    if (addToStockCancelBtn) {
      addToStockCancelBtn.addEventListener("click", closeAddToStockModal);
    }
    if (addToStockConfirmBtn) {
      addToStockConfirmBtn.addEventListener("click", applyAddToStock);
    }

    const btnClearPurchasedOnly = document.getElementById("btnClearPurchasedOnly");
    if (btnClearPurchasedOnly) {
      btnClearPurchasedOnly.addEventListener("click", clearPurchasedData);
    }

    const btnClearAvailableOnly = document.getElementById("btnClearAvailableOnly");
    if (btnClearAvailableOnly) {
      btnClearAvailableOnly.addEventListener("click", clearAvailableData);
    }

    const btnClearAllData = document.getElementById("btnClearAllData");
    if (btnClearAllData) {
      btnClearAllData.addEventListener("click", clearAllData);
    }
    
    // Gestione posizioni nelle impostazioni
    const addLocationBtn = document.getElementById("addLocationButton");
    const newLocationInput = document.getElementById("newLocationInput");
    if (addLocationBtn && newLocationInput) {
      addLocationBtn.addEventListener("click", () => {
        const newLocation = newLocationInput.value.trim();
        if (!newLocation) {
          showToast("Inserisci un nome per la posizione.", "error");
          return;
        }
        if (locationList.some(name => name.toLocaleLowerCase("it-IT") === newLocation.toLocaleLowerCase("it-IT"))) {
          showToast("Una posizione con questo nome esiste già.", "error");
          return;
        }
        if (!commitMutation(`Aggiunta posizione: ${newLocation}`, () => { locationList.push(newLocation); })) return;
        newLocationInput.value = "";
        renderLocationsList();
        renderAll(); // Aggiorna tutti i dropdown
        showToast(`Posizione "${newLocation}" aggiunta.`, "success");
      });
      
      newLocationInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          addLocationBtn.click();
        }
      });
    }

      // Pulsante verifica database
      const btnCheckDatabase = document.getElementById("btnCheckDatabase");
      const databaseStatus = document.getElementById("databaseStatus");
      if (btnCheckDatabase && databaseStatus) {
        btnCheckDatabase.addEventListener("click", () => {
          const possibleKeys = [
            STORAGE_KEY,
            "registroFilamentiState_v2",
            "registroFilamentiState_v1",
            "registroFilamentiState"
          ];
          
          let foundData = false;
          let statusHtml = "<div style='display: flex; flex-direction: column; gap: 0.5rem;'>";
          
          possibleKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
              foundData = true;
              try {
                const state = JSON.parse(data);
                const filamentCount = state.filaments?.length || 0;
                const purchasedCount = state.purchasedFilaments?.length || 0;
                const sizeKB = (data.length / 1024).toFixed(2);
                
                statusHtml += `
                  <div style="padding: 0.5rem; background: var(--success-soft); border-radius: 0.375rem; border-left: 3px solid var(--success);">
                    <strong style="color: var(--success);">✓ Dati trovati in: ${key}</strong>
                    <div style="font-size: 0.85rem; margin-top: 0.25rem; color: var(--text-muted);">
                      Filamenti: ${filamentCount} | Comprati: ${purchasedCount} | Dimensione: ${sizeKB} KB
                    </div>
                  </div>
                `;
              } catch (e) {
                statusHtml += `
                  <div style="padding: 0.5rem; background: rgba(239, 68, 68, 0.15); border-radius: 0.375rem; border-left: 3px solid var(--danger);">
                    <strong style="color: var(--danger);">✗ Errore in: ${key}</strong>
                    <div style="font-size: 0.85rem; margin-top: 0.25rem; color: var(--text-muted);">
                      ${escapeHtml(e.message)}
                    </div>
                  </div>
                `;
              }
            }
          });
          
          if (!foundData) {
            statusHtml += `
              <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.15); border-radius: 0.375rem; border-left: 3px solid var(--danger);">
                <strong style="color: var(--danger);">⚠ Nessun dato trovato</strong>
                <div style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
                  Non sono stati trovati dati salvati nelle chiavi: ${possibleKeys.join(", ")}
                </div>
                <div style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
                  <strong>Suggerimenti:</strong>
                  <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
                    <li>Verifica se hai esportato un backup JSON</li>
                    <li>Controlla se hai cancellato i dati del browser</li>
                    <li>Prova a importare un file JSON se ne hai uno</li>
                  </ul>
                </div>
              </div>
            `;
          }
          
          statusHtml += `
            <div style="padding: 0.5rem; background: var(--surface); border-radius: 0.375rem; border: 1px solid var(--border-subtle); margin-top: 0.5rem;">
              <strong style="font-size: 0.85rem;">Stato attuale in memoria:</strong>
              <div style="font-size: 0.85rem; margin-top: 0.25rem; color: var(--text-muted);">
                Filamenti caricati: ${filaments.length} | Comprati: ${purchasedFilaments.length}
              </div>
            </div>
          `;
          
          statusHtml += "</div>";
          databaseStatus.innerHTML = statusHtml;
          databaseStatus.style.display = "block";
        });
      }

      // Pulsante debug info
      const btnDebugInfo = document.getElementById("btnDebugInfo");
    const debugInfoContainer = document.getElementById("debugInfoContainer");
    const debugInfoText = document.getElementById("debugInfoText");
    const btnCopyDebugInfo = document.getElementById("btnCopyDebugInfo");
    
    if (btnDebugInfo && debugInfoContainer && debugInfoText) {
      btnDebugInfo.addEventListener("click", () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const state = raw ? JSON.parse(raw) : null;
        
        const debugInfo = {
          "Versione app": APP_VERSION,
          "Filamenti in memoria": filaments.length,
          "Filamenti comprati in memoria": purchasedFilaments.length,
          "Filamenti in localStorage": state?.filaments?.length || 0,
          "Filamenti comprati in localStorage": state?.purchasedFilaments?.length || 0,
          "Filtri attivi (magazzino)": stockFilters,
          "Ricerca attiva": currentSearch || "(nessuna)",
          "Storico consumi": consumptionHistory.length + " voci",
          "Dimensione localStorage (STORAGE_KEY)": raw ? (raw.length / 1024).toFixed(2) + " KB" : "0 KB",
          "Esempio filamento (primo)": filaments.length > 0 ? {
            id: filaments[0].id,
            brand: filaments[0].brand,
            material: filaments[0].material,
            variant: filaments[0].variant,
            spools_total: filaments[0].spools_total,
            open_spools: filaments[0].open_spools,
            has_open_spools_fractions: Array.isArray(filaments[0].open_spools_fractions)
          } : "Nessun filamento"
        };
        
        debugInfoText.textContent = JSON.stringify(debugInfo, null, 2);
        debugInfoContainer.style.display = debugInfoContainer.style.display === "none" ? "block" : "none";
      });
    }
    
    if (btnCopyDebugInfo && debugInfoText) {
      btnCopyDebugInfo.addEventListener("click", async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(debugInfoText.textContent);
          else {
            const text = document.createElement("textarea");
            text.value = debugInfoText.textContent;
            text.style.cssText = "position:fixed;opacity:0;";
            debugInfoContainer.appendChild(text);
            text.select();
            const copied = document.execCommand("copy");
            text.remove();
            if (!copied) throw new Error("Copia non disponibile");
          }
          showToast("Informazioni copiate negli appunti!", "success");
        } catch (error) { showToast("Copia non riuscita: seleziona e copia il testo della diagnostica.", "error"); }
      });
    }

    document
      .getElementById("addFilamentButton")
      .addEventListener("click", handleAddFilament);

    // Event listener per input colore personalizzato
    const addColorCustomInput = document.getElementById("addColorCustom");
    if (addColorCustomInput) {
      addColorCustomInput.addEventListener("input", updateColorPreviewFromSelection);
    }

    document
      const stockSearchInput = document.getElementById("stockSearchInput");
      const stockSearchClear = document.getElementById("stockSearchClear");
      
      if (stockSearchInput) {
        // Mostra/nascondi pulsante X all'inizializzazione
        if (stockSearchClear) {
          stockSearchClear.style.display = currentSearch.trim() ? "flex" : "none";
        }
        
        let searchRenderTimer;
        stockSearchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value || "";
        clearTimeout(searchRenderTimer);
        searchRenderTimer = setTimeout(renderFilamentTable, 120);
          // Mostra/nascondi pulsante X
          if (stockSearchClear) {
            stockSearchClear.style.display = currentSearch.trim() ? "flex" : "none";
          }
        });
      }
      
      if (stockSearchClear) {
        stockSearchClear.addEventListener("click", () => {
          if (stockSearchInput) {
            stockSearchInput.value = "";
            currentSearch = "";
            renderFilamentTable();
            stockSearchClear.style.display = "none";
            stockSearchInput.focus();
          }
        });
      }

    document
      .querySelectorAll("#filamentTable thead th[data-sort-field]")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort-field");
          if (sortState.field === field) {
            sortState.direction =
              sortState.direction === "asc" ? "desc" : "asc";
          } else {
            sortState.field = field;
            sortState.direction = "asc";
          }
          renderFilamentTable();
        });
      });

    // Sorting for purchased table (3b)
    document
      .querySelectorAll("#purchasedTable thead th[data-sort-field]")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort-field");
          if (purchasedSortState.field === field) {
            purchasedSortState.direction =
              purchasedSortState.direction === "asc" ? "desc" : "asc";
          } else {
            purchasedSortState.field = field;
            purchasedSortState.direction = "asc";
          }
          renderPurchasedTable();
        });
      });



    // Chiudi qualsiasi modal aperto quando si clicca sull'overlay
    const overlay = document.getElementById("modalOverlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        // Chiudi solo se si clicca direttamente sull'overlay (non sui suoi figli)
        if (e.target === overlay) {
          const openModal = document.querySelector(".modal.is-open");
          if (openModal) {
            const modalId = openModal.id;
            if (modalId) {
              closeModalCentered(modalId);
            }
          }
        }
      });
    }
    document
      .getElementById("modalCloseButton")
      .addEventListener("click", closeConsumptionModal);
    document
      .getElementById("modalCancelButton")
      .addEventListener("click", closeConsumptionModal);
    document
      .getElementById("modalConfirmButton")
      .addEventListener("click", applyConsumptionUpdate);

    // Edit filament modal event listeners
    document
      .getElementById("editModalCloseButton")
      .addEventListener("click", closeEditFilamentModal);
    document
      .getElementById("editModalCancelButton")
      .addEventListener("click", closeEditFilamentModal);
    document
      .getElementById("editModalConfirmButton")
      .addEventListener("click", applyEditFilament);

    // Edit color custom event listener
    const editColorCustom = document.getElementById("editColorCustom");
    if (editColorCustom) {
      editColorCustom.addEventListener("input", updateEditColorPreview);
    }
    
    // Event listeners per campi bobine nel modal edit
    const editSpoolsSealed = document.getElementById("editSpoolsSealed");
    const editSpoolsOpen = document.getElementById("editSpoolsOpen");
    const editSpoolFraction = document.getElementById("editSpoolFraction");
    const editUnitWeight = document.getElementById("editUnitWeightInput");
    
    if (editSpoolsSealed) editSpoolsSealed.addEventListener("input", updateEditRemainingGrams);
    if (editSpoolsOpen) editSpoolsOpen.addEventListener("input", updateEditRemainingGrams);
    if (editSpoolFraction) editSpoolFraction.addEventListener("change", updateEditRemainingGrams);
    if (editUnitWeight) editUnitWeight.addEventListener("input", updateEditRemainingGrams);

    // Add purchased filament manually
    const addPurchasedButton = document.getElementById("addPurchasedButton");
    if (addPurchasedButton) {
      addPurchasedButton.addEventListener("click", handleAddPurchasedFilament);
    }

    // Toggle custom brand input for purchased form
    const addPurchasedBrandSelect = document.getElementById("addPurchasedBrand");
    const addPurchasedBrandCustom = document.getElementById("addPurchasedBrandCustom");
    if (addPurchasedBrandSelect && addPurchasedBrandCustom) {
      addPurchasedBrandSelect.addEventListener("change", () => {
        if (addPurchasedBrandSelect.value === "__custom__") {
          addPurchasedBrandCustom.style.display = "block";
          addPurchasedBrandCustom.focus();
        } else {
          addPurchasedBrandCustom.style.display = "none";
        }
      });
    }

    const exportJsonButton = document.getElementById("exportJsonButton");
    if (exportJsonButton) {
      exportJsonButton.addEventListener("click", exportJson);
    }
    
    const exportInvoicesButton = document.getElementById("exportInvoicesButton");
    if (exportInvoicesButton) {
      exportInvoicesButton.addEventListener("click", exportInvoicesJson);
    }
    
    // Verifica che gli elementi esistano
    const importButton = document.getElementById("importJsonButton");
    const importInput = document.getElementById("importJsonInput");
    console.log("Verifica elementi import - Button:", !!importButton, "Input:", !!importInput);
    
    // Aggiungo un log per capire se setupImportJson viene chiamato
    console.log("Chiamata setupImportJson...");
    try {
      setupImportJson();
      console.log("setupImportJson completata senza errori");
    } catch (error) {
      console.error("Errore in setupImportJson:", error);
    }
    
    // Test diretto per verificare che il pulsante funzioni
    setTimeout(() => {
      const testButton = document.getElementById("importJsonButton");
      const testInput = document.getElementById("importJsonInput");
      if (testButton && testInput) {
        console.log("✅ Elementi import trovati correttamente");
        // Test click programmatico
        testButton.addEventListener("click", () => {
          console.log("✅ Pulsante risponde al click!");
        });
      } else {
        console.error("❌ Elementi import NON trovati:", { button: !!testButton, input: !!testInput });
      }
    }, 1000);

    const deleteSelectedButton = document.getElementById("deleteSelectedButton");
    if (deleteSelectedButton) {
      deleteSelectedButton.addEventListener("click", deleteSelectedFilaments);
    }

    const selectAllCheckbox = document.getElementById("selectAllFilaments");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", (e) => {
        const checked = e.target.checked;
        document
          .querySelectorAll(".filament-select-checkbox")
          .forEach((cb) => {
            cb.checked = checked;
          });
      });
    }

    // Event listener per pulsanti nella tabella filamenti (3a)
    const filamentTableBody = document.getElementById("filamentTableBody");
    if (filamentTableBody) {
      filamentTableBody.addEventListener("click", (e) => {
        const btn = e.target.closest("button.btn-action");
        if (!btn || !btn.hasAttribute("data-id")) return;
        
        const filamentId = btn.getAttribute("data-id");
        const btnText = btn.textContent.trim();
        
        if (btnText.includes("Modifica")) {
          openEditFilamentModal(filamentId);
        } else if (btnText.includes("Elimina")) {
          deleteFilament(filamentId, readSelectedSpoolIds(btn));
        }
      });
    }

    // Ricerca e ordinamento per check finale
    // Pulsante minimizza/massimizza sezione 3b
    const togglePurchasedSection = document.getElementById("togglePurchasedSection");
    const purchasedSectionContent = document.getElementById("purchasedSectionContent");
    if (togglePurchasedSection && purchasedSectionContent) {
      let isMinimized = false;
      togglePurchasedSection.addEventListener("click", () => {
        isMinimized = !isMinimized;
        if (isMinimized) {
          purchasedSectionContent.style.display = "none";
          togglePurchasedSection.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px;">
              <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Espandi</span>
          `;
        } else {
          purchasedSectionContent.style.display = "block";
          togglePurchasedSection.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px;">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Minimizza</span>
          `;
        }
      });
    }

    // Sorting for spools state table (visualizzazione aggregata)
    document
      .querySelectorAll("#spoolsStateTableContainer th[data-sort-field]")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort-field");
          if (spoolsStateSortState.field === field) {
            spoolsStateSortState.direction =
              spoolsStateSortState.direction === "asc" ? "desc" : "asc";
          } else {
            spoolsStateSortState.field = field;
            spoolsStateSortState.direction = "asc";
          }
          renderSpoolsStateTable();
        });
      });

    // Sorting for finished filaments table
    document
      .querySelectorAll("#finishedFilamentsTable th[data-sort-field]")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort-field");
          if (finishedFilamentsSortState.field === field) {
            finishedFilamentsSortState.direction =
              finishedFilamentsSortState.direction === "asc" ? "desc" : "asc";
          } else {
            finishedFilamentsSortState.field = field;
            finishedFilamentsSortState.direction = "asc";
          }
          renderFinishedFilamentsTable();
        });
      });

    // Sorting for remaining bar table - DISABILITATO (sezione duplicata)
    // document
    //   .querySelectorAll("#remainingBarTable th[data-sort-field]")
    //   .forEach((th) => {
    //     th.addEventListener("click", () => {
    //       const field = th.getAttribute("data-sort-field");
    //       if (remainingBarSortState.field === field) {
    //         remainingBarSortState.direction =
    //           remainingBarSortState.direction === "asc" ? "desc" : "asc";
    //       } else {
    //         remainingBarSortState.field = field;
    //         remainingBarSortState.direction = "asc";
    //       }
    //       renderRemainingBarTable();
    //     });
    //   });

    const purchasedTableBody = document.getElementById("purchasedTableBody");
    if (purchasedTableBody) {
      purchasedTableBody.addEventListener("click", (e) => {
        const btn = e.target.closest("button.btn-success");
        if (btn && btn.hasAttribute("data-purchased-id")) {
          const purchasedId = btn.getAttribute("data-purchased-id");
          openAddToStockModal(purchasedId);
          return;
        }
        const btnOld = e.target.closest("button.btn-add-from-purchased");
        if (!btnOld) return;
        const idx = parseInt(btnOld.getAttribute("data-index"), 10);
        if (isNaN(idx) || idx < 0 || idx >= purchasedFilaments.length) return;
        const entry = purchasedFilaments[idx];
        const qty =
          entry.quantity_spools != null
            ? entry.quantity_spools
            : entry.quantitySpools != null
            ? entry.quantitySpools
            : 1;
        prefillAddFormFromPurchased(entry, qty);
      });
    }

    document
      .getElementById("importJsonInput")
      .addEventListener("click", () => {
        showToast(
          "Seleziona il file JSON da importare (magazzino o fatture).",
          "info"
        );
      });

    // Escape chiude prima il menu attivo; Tab resta nella finestra in primo piano.
    document.addEventListener("keydown", event => {
      if (event.defaultPrevented) return;
      const entry = modalStack[modalStack.length - 1];
      if (!entry) return;
      if (event.key === "Escape") { event.preventDefault(); closeModalCentered(entry.modal.id); return; }
      if (event.key !== "Tab") return;
      const controls = modalFocusableElements(entry.modal);
      if (!controls.length) { event.preventDefault(); entry.modal.focus(); return; }
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
    });

    window.addEventListener("resize", () => {
      modalStack.forEach(entry => resetModalPosition(entry.modal.id));
    });

      // Inizializza salvataggio automatico
      startPeriodicAutoSave();
      setupBeforeUnloadSave();
      console.log("Salvataggio automatico attivato");

      // opzionale: esegue i test interni in console
      runSelfTests();
    } catch (e) {
      console.error("Errore critico nell'inizializzazione dell'applicazione:", e);
      alert("Errore critico nell'inizializzazione. Controlla la console per dettagli.");
    }
  });
