  const STORAGE_KEY = "registroFilamentiState_v3";
  const VERSION_KEY = "registroFilamentiAppVersion";
  const INITIAL_VERSION = "V.100";
  let APP_VERSION = INITIAL_VERSION;
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
    try {
      localStorage.setItem(UNDO_STACK_KEY, JSON.stringify(undoStack));
      localStorage.setItem(REDO_STACK_KEY, JSON.stringify(redoStack));
    } catch (e) {
      console.error("Errore nel salvataggio degli stack undo/redo:", e);
    }
  }

  // Carica gli stack undo/redo dal localStorage
  function loadUndoRedoStacks() {
    try {
      const undoRaw = localStorage.getItem(UNDO_STACK_KEY);
      const redoRaw = localStorage.getItem(REDO_STACK_KEY);
      
      if (undoRaw) {
        undoStack = JSON.parse(undoRaw);
        // Limita la dimensione
        if (undoStack.length > MAX_UNDO_HISTORY) {
          undoStack = undoStack.slice(-MAX_UNDO_HISTORY);
        }
      } else {
        undoStack = [];
      }
      
      if (redoRaw) {
        redoStack = JSON.parse(redoRaw);
        // Limita la dimensione
        if (redoStack.length > MAX_UNDO_HISTORY) {
          redoStack = redoStack.slice(-MAX_UNDO_HISTORY);
        }
      } else {
        redoStack = [];
      }
    } catch (e) {
      console.error("Errore nel caricamento degli stack undo/redo:", e);
      undoStack = [];
      redoStack = [];
    }
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
  let stockFilters = { brand: "", material: "", packaging: "" };
  // Filtri per tabella comprati
  let purchasedFilters = { brand: "", material: "", packaging: "" };
  // Storico consumi
  let consumptionHistory = [];

  // Helper per aprire modal centrati sullo schermo
  function openModalCentered(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById("modalOverlay");
    
    if (modal) {
      // Reset posizione modal PRIMA di aprirlo
      resetModalPosition(modalId);
      
      // Apri il modal
      modal.classList.add("is-open");
      
      // Forza il reset DOPO che il modal è visibile e scrolla la pagina per centrare il dialog
      requestAnimationFrame(() => {
        resetModalPosition(modalId);
        
        // Scrolla la pagina per centrare il dialog (come fanno gli altri modal)
        const dialog = modal.querySelector(".modal-dialog");
        if (dialog) {
          // Calcola la posizione del dialog rispetto alla pagina
          const dialogRect = dialog.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const windowWidth = window.innerWidth;
          
          // Calcola dove dovrebbe essere il dialog per essere centrato
          const targetTop = window.scrollY + dialogRect.top - (windowHeight / 2) + (dialogRect.height / 2);
          
          // Scrolla la pagina per centrare il dialog
          window.scrollTo({
            top: Math.max(0, targetTop),
            left: window.scrollX,
            behavior: 'smooth'
          });
        }
      });
      
      // NON bloccare lo scroll della pagina - permette di scrollare per trovare il modal
      // document.body.style.overflow = "hidden"; // Rimosso per permettere scroll
    }
    if (overlay) overlay.classList.add("is-open");
  }

  function closeModalCentered(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById("modalOverlay");
    if (modal) modal.classList.remove("is-open");
    
    // Reset posizione modal
    resetModalPosition(modalId);
    
    // Chiudi overlay solo se nessun altro modal è aperto
    setTimeout(() => {
      const allOpenModals = document.querySelectorAll(".modal.is-open");
      if (allOpenModals.length === 0) {
        if (overlay) overlay.classList.remove("is-open");
        document.body.style.overflow = ""; // Ripristina scroll pagina
      }
    }, 10);
  }
  
  // Funzionalità trascinamento modal
  function initDraggableModals() {
    const modals = document.querySelectorAll(".modal-dialog");
    
    modals.forEach(dialog => {
      const header = dialog.querySelector(".modal-header");
      if (!header) return;
      
      let isDragging = false;
      let startX, startY, initialX, initialY;
      
      header.addEventListener("mousedown", (e) => {
        // Non trascinare se si clicca sul pulsante chiudi
        if (e.target.closest(".modal-close-btn")) return;
        
        isDragging = true;
        dialog.classList.add("is-dragging");
        
        const rect = dialog.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialX = rect.left;
        initialY = rect.top;
        
        // Rimuovi margin:auto per permettere posizionamento assoluto
        dialog.style.margin = "0";
        dialog.style.position = "fixed";
        dialog.style.left = initialX + "px";
        dialog.style.top = initialY + "px";
        
        e.preventDefault();
      });
      
      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newX = initialX + dx;
        let newY = initialY + dy;
        
        // Limita ai bordi della finestra
        const dialogRect = dialog.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, window.innerWidth - dialogRect.width));
        newY = Math.max(0, Math.min(newY, window.innerHeight - dialogRect.height));
        
        dialog.style.left = newX + "px";
        dialog.style.top = newY + "px";
      });
      
      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          dialog.classList.remove("is-dragging");
        }
      });
    });
  }
  
  // Reset posizione modal quando si chiude o si apre
  function resetModalPosition(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const dialog = modal.querySelector(".modal-dialog");
    if (!dialog) return;
    
    // Rimuovi TUTTE le proprietà di posizionamento inline per forzare il centraggio
    dialog.removeAttribute("style");
    
    // Re-imposta solo le proprietà necessarie per il centraggio
    dialog.style.margin = "auto";
    dialog.style.position = "";
    
    // Scrolla il modal in cima
    if (modal) {
      modal.scrollTop = 0;
      modal.scrollLeft = 0;
    }
    
    // Forza il reflow per assicurarsi che le modifiche vengano applicate
    void dialog.offsetHeight;
    void modal.offsetHeight;
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
    // === COLORI GENERICI (per tutte le marche) ===
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

  // Unisce più righe identiche di magazzino in una sola (stessa marca/materiale/colore/codice/peso)
  function deduplicateFilamentsByIdentity(list) {
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

  function getColorHex(colorName) {
    if (!colorName) return "#e5e7eb";
    
    // Prima prova match diretto
    const direct = colorHexMap[colorName];
    if (direct) return direct;
    
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
    
    return `<span class="pill-colored ${textClass}" style="background: ${hex};" title="${displayName}">${displayName}</span>`;
  }

  // =============================================
  // CUSTOM COLOR DROPDOWN FUNCTIONS
  // =============================================

  let activeColorDropdown = null;

  function createColorDropdown(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const {
      placeholder = "Seleziona colore...",
      allowCustom = true,
      customLabel = "Altro colore...",
      onSelect = () => {},
      initialValue = ""
    } = options;

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "color-dropdown-wrapper";
    wrapper.setAttribute("data-dropdown-id", containerId);

    // Create trigger button
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

    // Create menu
    const menu = document.createElement("div");
    menu.className = "color-dropdown-menu";

    // Create search
    const searchDiv = document.createElement("div");
    searchDiv.className = "color-dropdown-search";
    searchDiv.innerHTML = `<input type="text" placeholder="Cerca colore..." />`;
    menu.appendChild(searchDiv);

    // Create options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "color-dropdown-options";
    menu.appendChild(optionsContainer);

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);

    // Hidden input for form value
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = containerId + "_value";
    hiddenInput.id = containerId + "_value";
    wrapper.appendChild(hiddenInput);

    // Replace container content
    container.innerHTML = "";
    container.appendChild(wrapper);

    // Render options
    function renderOptions(filter = "") {
      const filterLower = filter.toLowerCase();
      let html = "";

      const filteredColors = colorList.filter(c => 
        c.toLowerCase().includes(filterLower)
      );

      if (filteredColors.length === 0 && !allowCustom) {
        html = '<div class="color-dropdown-empty">Nessun colore trovato</div>';
      } else {
        filteredColors.forEach(color => {
          const hex = getColorHex(color);
          const selected = hiddenInput.value === color ? "selected" : "";
          html += `
            <div class="color-dropdown-option ${selected}" data-value="${color}">
              <span class="color-dot" style="background: ${hex};"></span>
              <span class="color-name">${color}</span>
            </div>
          `;
        });

        if (allowCustom) {
          html += `
            <div class="color-dropdown-option custom-option" data-value="__custom__">
              <span class="color-dot" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);"></span>
              <span class="color-name">${customLabel}</span>
            </div>
          `;
        }
      }

      optionsContainer.innerHTML = html;

      // Add click handlers
      optionsContainer.querySelectorAll(".color-dropdown-option").forEach(opt => {
        opt.addEventListener("click", () => {
          const value = opt.getAttribute("data-value");
          selectColorOption(wrapper, value, onSelect);
        });
      });
    }

    // Event handlers
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleColorDropdown(wrapper);
      renderOptions();
    });

    const searchInput = searchDiv.querySelector("input");
    searchInput.addEventListener("input", (e) => {
      renderOptions(e.target.value);
    });

    searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Set initial value if provided
    if (initialValue) {
      setColorDropdownValue(wrapper, initialValue);
    }

    return {
      wrapper,
      setValue: (val) => setColorDropdownValue(wrapper, val),
      getValue: () => hiddenInput.value,
      refresh: () => renderOptions()
    };
  }

  function toggleColorDropdown(wrapper) {
    const isOpen = wrapper.classList.contains("open");
    
    // Close all dropdowns first
    document.querySelectorAll(".color-dropdown-wrapper.open").forEach(w => {
      w.classList.remove("open");
    });

    if (!isOpen) {
      wrapper.classList.add("open");
      activeColorDropdown = wrapper;
      
      // Focus search
      const searchInput = wrapper.querySelector(".color-dropdown-search input");
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    } else {
      activeColorDropdown = null;
    }
  }

  function selectColorOption(wrapper, value, onSelect) {
    const trigger = wrapper.querySelector(".color-dropdown-trigger");
    const hiddenInput = wrapper.querySelector("input[type='hidden']");
    const colorDot = trigger.querySelector(".color-dot");
    const colorText = trigger.querySelector(".color-text");

    if (value === "__custom__") {
      // Close dropdown and trigger custom input flow
      wrapper.classList.remove("open");
      activeColorDropdown = null;
      onSelect("__custom__");
      return;
    }

    hiddenInput.value = value;
    const hex = getColorHex(value);
    colorDot.style.background = hex;
    colorText.textContent = value;

    wrapper.classList.remove("open");
    activeColorDropdown = null;

    onSelect(value);
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

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (activeColorDropdown && !activeColorDropdown.contains(e.target)) {
      activeColorDropdown.classList.remove("open");
      activeColorDropdown = null;
    }
  });

  // Close dropdown on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeColorDropdown) {
      activeColorDropdown.classList.remove("open");
      activeColorDropdown = null;
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

    // Chiedi la quantità
    const qtyStr = prompt(
      `Quante bobine vuoi aggiungere al magazzino?\n\n` +
      `Filamento: ${canonicalizeBrand(p.brand)} ${p.material} ${p.variant}\n` +
      `Disponibili: ${maxQty}`,
      "1"
    );

    if (qtyStr === null) return; // Annullato

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      showToast("Inserisci un numero valido maggiore di 0.", "error");
      return;
    }

    if (qty > maxQty) {
      showToast(`Puoi aggiungere al massimo ${maxQty} bobina/e.`, "error");
      return;
    }

    // Crea o aggiorna filamento nel magazzino
    const brand = canonicalizeBrand(p.brand);
    const material = canonicalizeMaterial(p.material);
    const identity = `${brand}|${material}|${p.variant}|${p.color_code || ""}|${p.unit_weight_g || 1000}`;

    let existing = filaments.find(f => {
      const fIdentity = `${canonicalizeBrand(f.brand)}|${canonicalizeMaterial(f.material)}|${f.variant}|${f.color_code || ""}|${f.unit_weight_g || 1000}`;
      return fIdentity === identity;
    });

    if (existing) {
      // Aggiungi alla quantità esistente
      existing.sealed_spools = (existing.sealed_spools || 0) + qty;
      existing.spools_total = (existing.spools_total || 0) + qty;
      existing.total_weight_g = existing.spools_total * (existing.unit_weight_g || 1000);
      recalcWeightsForFilament(existing);
    } else {
      // Crea nuovo filamento
      const newFilament = {
        id: `fil-${Date.now().toString(16)}`,
        brand: brand,
        material: material,
        variant: p.variant || "",
        color_code: p.color_code || "",
        packaging_type: p.packaging_type || "spool",
        unit_weight_g: p.unit_weight_g || 1000,
        unit_price: p.unit_price || null,
        spools_total: qty,
        sealed_spools: qty,
        open_spools: 0,
        main_fraction: 1,
        total_weight_g: qty * (p.unit_weight_g || 1000),
        remaining_weight_g: qty * (p.unit_weight_g || 1000),
        used_weight_g: 0,
        supplier: p.supplier || "",
        notes: ""
      };
      filaments.push(newFilament);
    }

    // Decrementa la quantità nel purchased
    if (p.quantity_spools != null) {
      p.quantity_spools -= qty;
    } else if (p.quantitySpools != null) {
      p.quantitySpools -= qty;
    }

    // Rimuovi se quantità = 0
    const newQty = p.quantity_spools != null ? p.quantity_spools : p.quantitySpools;
    if (newQty <= 0) {
      purchasedFilaments = purchasedFilaments.filter(x => x.id !== purchasedId);
    }

    saveState();
    renderAll();
    
    // Emetti suono e notifica
    playSuccessSound();
    showToast(`${qty} bobina/e aggiunta/e al magazzino!`, "success");
  }

  // Funzione per aggiunta diretta al magazzino
  function quickAddToStock(purchasedId) {
    const p = purchasedFilaments.find(x => x.id === purchasedId);
    if (!p) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    const qty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools || 1);
    if (qty < 1) {
      showToast("Non ci sono bobine disponibili da trasferire.", "error");
      return;
    }

    // Crea o aggiorna filamento nel magazzino
    const brand = canonicalizeBrand(p.brand);
    const material = canonicalizeMaterial(p.material);
    const identity = `${brand}|${material}|${p.variant}|${p.color_code || ""}|${p.unit_weight_g || 1000}`;

    let existing = filaments.find(f => {
      const fIdentity = `${canonicalizeBrand(f.brand)}|${canonicalizeMaterial(f.material)}|${f.variant}|${f.color_code || ""}|${f.unit_weight_g || 1000}`;
      return fIdentity === identity;
    });

    if (existing) {
      // Aggiungi alla quantità esistente
      existing.sealed_spools = (existing.sealed_spools || 0) + 1;
      existing.spools_total = (existing.spools_total || 0) + 1;
      existing.total_weight_g = existing.spools_total * (existing.unit_weight_g || 1000);
      recalcWeightsForFilament(existing);
    } else {
      // Crea nuovo filamento
      const newFilament = {
        id: `fil-${Date.now().toString(16)}`,
        brand: brand,
        material: material,
        variant: p.variant || "",
        color_code: p.color_code || "",
        packaging_type: p.packaging_type || "spool",
        unit_weight_g: p.unit_weight_g || 1000,
        unit_price: p.unit_price || null,
        spools_total: 1,
        sealed_spools: 1,
        open_spools: 0,
        main_fraction: 1,
        total_weight_g: p.unit_weight_g || 1000,
        remaining_weight_g: p.unit_weight_g || 1000,
        used_weight_g: 0,
        supplier: p.supplier || "",
        notes: ""
      };
      filaments.push(newFilament);
    }

    // Decrementa la quantità nel purchased
    if (p.quantity_spools != null) {
      p.quantity_spools -= 1;
    } else if (p.quantitySpools != null) {
      p.quantitySpools -= 1;
    }

    // Rimuovi se quantità = 0
    const newQty = p.quantity_spools != null ? p.quantity_spools : p.quantitySpools;
    if (newQty <= 0) {
      purchasedFilaments = purchasedFilaments.filter(x => x.id !== purchasedId);
    }

    saveState();
    renderAll();
    playSuccessSound();
    showToast("1 bobina aggiunta al magazzino!", "success");
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
      const openCount = parseInt(openInput.value, 10) || 0;
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
    const hiddenId = document.getElementById("addToStockPurchasedId");
    const qtyInput = document.getElementById("addToStockQty");
    const sealedInput = document.getElementById("addToStockSealed");
    const openInput = document.getElementById("addToStockOpen");
    const priceInput = document.getElementById("addToStockPrice");
    const supplierInput = document.getElementById("addToStockSupplier");
    const openSpoolsContainer = document.getElementById("addToStockOpenSpoolsListContainer");

    if (!hiddenId || !qtyInput || !sealedInput || !openInput) {
      showToast("Errore: elementi del modal non trovati.", "error");
      return;
    }

    const purchasedId = hiddenId.value;
    const p = purchasedFilaments.find(x => x.id === purchasedId);
    if (!p) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    // Salva stato per undo
    saveStateForUndo(`Aggiunto al magazzino: ${canonicalizeBrand(p.brand)} – ${p.material} – ${p.variant}`);

    const maxQty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools || 0);
    const qty = parseInt(qtyInput.value, 10);
    const sealed = parseInt(sealedInput.value, 10) || 0;
    const open = parseInt(openInput.value, 10) || 0;

    // Validazione
    if (isNaN(qty) || qty < 1) {
      showToast("Inserisci una quantità valida maggiore di 0.", "error");
      return;
    }

    if (qty > maxQty) {
      showToast(`Puoi aggiungere al massimo ${maxQty} bobina/e.`, "error");
      return;
    }

    if (sealed + open !== qty) {
      showToast(`La somma di sigillate (${sealed}) e aperte (${open}) deve essere uguale alla quantità totale (${qty}).`, "error");
      return;
    }

    if (sealed < 0 || open < 0) {
      showToast("Le quantità non possono essere negative.", "error");
      return;
    }

    // Raccogli frazioni delle bobine aperte
    const openSpoolsFractions = [];
    if (open > 0 && openSpoolsContainer) {
      const fractionSelects = openSpoolsContainer.querySelectorAll(".add-to-stock-fraction-select");
      for (let i = 0; i < Math.min(open, fractionSelects.length); i++) {
        const fraction = parseFloat(fractionSelects[i].value) || 1;
        openSpoolsFractions.push(fraction);
      }
      // Se mancano frazioni, aggiungi 1 per le bobine rimanenti
      while (openSpoolsFractions.length < open) {
        openSpoolsFractions.push(1);
      }
    }

    // Crea o aggiorna filamento nel magazzino
    const brand = canonicalizeBrand(p.brand);
    const material = canonicalizeMaterial(p.material);
    const identity = `${brand}|${material}|${p.variant}|${p.color_code || ""}|${p.unit_weight_g || 1000}`;

    let existing = filaments.find(f => {
      const fIdentity = `${canonicalizeBrand(f.brand)}|${canonicalizeMaterial(f.material)}|${f.variant}|${f.color_code || ""}|${f.unit_weight_g || 1000}`;
      return fIdentity === identity;
    });

    const unitWeight = p.unit_weight_g || 1000;
    const unitPrice = priceInput.value ? parseFloat(priceInput.value) : (p.unit_price || null);
    const supplier = supplierInput.value.trim() || (p.supplier || "");

    if (existing) {
      // Aggiungi alla quantità esistente
      existing.sealed_spools = (existing.sealed_spools || 0) + sealed;
      existing.open_spools = (existing.open_spools || 0) + open;
      existing.spools_total = (existing.spools_total || 0) + qty;
      
      // Aggiorna frazioni bobine aperte
      if (!Array.isArray(existing.open_spools_fractions)) {
        existing.open_spools_fractions = [];
      }
      existing.open_spools_fractions.push(...openSpoolsFractions);
      
      // Aggiorna prezzo se fornito
      if (unitPrice != null && (existing.unit_price == null || existing.unit_price === 0)) {
        existing.unit_price = unitPrice;
      }
      
      // Aggiorna fornitore se fornito
      if (supplier && !existing.supplier) {
        existing.supplier = supplier;
      }
      
      existing.total_weight_g = existing.spools_total * (existing.unit_weight_g || unitWeight);
      recalcWeightsForFilament(existing);
    } else {
      // Crea nuovo filamento
      const newFilament = {
        id: `fil-${Date.now().toString(16)}`,
        brand: brand,
        material: material,
        variant: p.variant || "",
        color_code: p.color_code || "",
        packaging_type: p.packaging_type || "spool",
        unit_weight_g: unitWeight,
        unit_price: unitPrice,
        spools_total: qty,
        sealed_spools: sealed,
        open_spools: open,
        open_spools_fractions: openSpoolsFractions.length > 0 ? openSpoolsFractions : undefined,
        main_fraction: open > 0 && openSpoolsFractions.length > 0 ? openSpoolsFractions[0] : 1,
        total_weight_g: qty * unitWeight,
        remaining_weight_g: 0, // Verrà calcolato da recalcWeightsForFilament
        used_weight_g: 0,
        supplier: supplier,
        notes: ""
      };
      recalcWeightsForFilament(newFilament);
      filaments.push(newFilament);
    }

    // Decrementa la quantità nel purchased
    if (p.quantity_spools != null) {
      p.quantity_spools -= qty;
    } else if (p.quantitySpools != null) {
      p.quantitySpools -= qty;
    }

    // Rimuovi se quantità = 0
    const newQty = p.quantity_spools != null ? p.quantity_spools : p.quantitySpools;
    if (newQty <= 0) {
      purchasedFilaments = purchasedFilaments.filter(x => x.id !== purchasedId);
    }

    saveState();
    renderAll();
    closeAddToStockModal();
    
    // Emetti suono e notifica
    playSuccessSound();
    showToast(`${qty} bobina/e aggiunta/e al magazzino!`, "success");
  }

  // Calcolo centralizzato dei pesi residui/usati per un singolo filamento
  function recalcWeightsForFilament(f) {
    if (!f) return;

    const unit = f.unit_weight_g || 0;
    let remaining = 0;

    // Bobine sigillate = piene
    if (f.sealed_spools > 0) {
      remaining += f.sealed_spools * unit;
    }

    // Bobine aperte: usa l'array delle frazioni se disponibile, altrimenti usa il vecchio sistema
    if (f.open_spools > 0) {
      if (Array.isArray(f.open_spools_fractions) && f.open_spools_fractions.length > 0) {
        // Nuovo sistema: array delle frazioni
        for (let i = 0; i < Math.min(f.open_spools, f.open_spools_fractions.length); i++) {
          const fraction = typeof f.open_spools_fractions[i] === "number" ? f.open_spools_fractions[i] : 1;
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

    // Caso esplicito: nessuna bobina nuova o aperta -> tutto consumato
    if (f.sealed_spools === 0 && f.open_spools === 0) {
      remaining = 0;
    }

    f.remaining_weight_g = remaining;
    f.used_weight_g = Math.max(
      0,
      (f.total_weight_g || 0) - f.remaining_weight_g
    );
  }

  // Funzione per incrementare la versione
  function incrementVersion() {
    // Estrai il numero dalla versione corrente (es. "V.90" -> 90)
    const versionMatch = APP_VERSION.match(/V\.(\d+)/);
    if (versionMatch) {
      const currentNumber = parseInt(versionMatch[1], 10);
      const newNumber = currentNumber + 1;
      APP_VERSION = `V.${newNumber}`;
      // Salva la nuova versione in localStorage
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      // Aggiorna il titolo e il badge
      updateVersionUI();
    }
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
    } catch (e) {
      console.error("Errore nell'aggiornare la versione UI:", e);
    }
  }

  // Funzione per caricare la versione da localStorage
  function loadVersion() {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const initialNum = parseInt(INITIAL_VERSION.replace(/[^0-9]/g, ''), 10);
    
    if (storedVersion && storedVersion.match(/^V\.\d+$/)) {
      // Estrai i numeri di versione per confrontarli
      const storedNum = parseInt(storedVersion.replace(/[^0-9]/g, ''), 10);
      
      // Usa sempre la versione più alta tra quella salvata e quella iniziale
      // Se la versione iniziale è maggiore O UGUALE, aggiorna localStorage
      // Questo forza l'aggiornamento quando modifichiamo il codice
      if (initialNum >= storedNum) {
        APP_VERSION = INITIAL_VERSION;
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        console.log(`Versione aggiornata da V.${storedNum} a ${INITIAL_VERSION}`);
      } else {
        // Se quella salvata è maggiore, usa quella (caso normale di incremento automatico)
        APP_VERSION = storedVersion;
      }
    } else {
      // Se non c'è una versione salvata o non è valida, usa quella iniziale e salvala
      APP_VERSION = INITIAL_VERSION;
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      console.log(`Versione inizializzata a ${INITIAL_VERSION}`);
    }
    
    // Forza l'aggiornamento dell'UI
    updateVersionUI();
    
    // Debug: verifica che sia stata impostata correttamente
    console.log(`Versione corrente: ${APP_VERSION}, Versione iniziale: ${INITIAL_VERSION}`);
  }

  function saveState() {
    // Incrementa la versione ad ogni salvataggio
    incrementVersion();
    
    const state = {
      filaments,
      brands: brandList,
      materials: materialList,
      colors: colorList,
      purchasedFilaments
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Salva anche la lista delle posizioni
    localStorage.setItem(LOCATION_LIST_KEY, JSON.stringify(locationList));
  }
  
  // Funzione per salvare solo le posizioni (usata quando si modificano le posizioni)
  function saveLocationList() {
    localStorage.setItem(LOCATION_LIST_KEY, JSON.stringify(locationList));
  }

  // Salva lo stato per undo/redo
  function saveStateForUndo(actionDescription = "Azione") {
    const state = {
      filaments: JSON.parse(JSON.stringify(filaments)),
      brands: [...brandList],
      materials: [...materialList],
      colors: [...colorList],
      purchasedFilaments: JSON.parse(JSON.stringify(purchasedFilaments)),
      actionDescription,
      timestamp: new Date().toISOString()
    };
    
    // Aggiungi allo stack undo
    undoStack.push(state);
    
    // Limita la dimensione dello stack
    if (undoStack.length > MAX_UNDO_HISTORY) {
      undoStack.shift();
    }
    
    // Quando si fa una nuova azione, cancella lo stack redo
    redoStack = [];
    
    // Salva gli stack
    saveUndoRedoStacks();
    
    // Aggiorna la UI della cronologia
    updateHistoryUI();
  }

  // Funzione per annullare l'ultima azione
  function undoAction() {
    if (undoStack.length === 0) {
      showToast("Nessuna azione da annullare", "info");
      return;
    }
    
    // Salva lo stato corrente nello stack redo
    const currentState = {
      filaments: JSON.parse(JSON.stringify(filaments)),
      brands: [...brandList],
      materials: [...materialList],
      colors: [...colorList],
      purchasedFilaments: JSON.parse(JSON.stringify(purchasedFilaments)),
      actionDescription: "Stato corrente",
      timestamp: new Date().toISOString()
    };
    redoStack.push(currentState);
    
    // Ripristina lo stato precedente
    const previousState = undoStack.pop();
    if (previousState) {
      filaments = previousState.filaments.map(f => ({ ...f }));
      brandList = [...previousState.brands];
      materialList = [...previousState.materials];
      colorList = [...previousState.colors];
      purchasedFilaments = previousState.purchasedFilaments.map(p => ({ ...p }));
      
      // Salva lo stato
      saveState();
      renderAll();
      
      showToast(`Annullato: ${previousState.actionDescription}`, "success");
      
      // Salva gli stack
      saveUndoRedoStacks();
      
      updateHistoryUI();
    }
  }

  // Funzione per ripristinare un'azione annullata
  function redoAction() {
    if (redoStack.length === 0) {
      showToast("Nessuna azione da ripristinare", "info");
      return;
    }
    
    // Salva lo stato corrente nello stack undo
    const currentState = {
      filaments: JSON.parse(JSON.stringify(filaments)),
      brands: [...brandList],
      materials: [...materialList],
      colors: [...colorList],
      purchasedFilaments: JSON.parse(JSON.stringify(purchasedFilaments)),
      actionDescription: "Stato corrente",
      timestamp: new Date().toISOString()
    };
    undoStack.push(currentState);
    
    // Ripristina lo stato successivo
    const nextState = redoStack.pop();
    if (nextState) {
      filaments = nextState.filaments.map(f => ({ ...f }));
      brandList = [...nextState.brands];
      materialList = [...nextState.materials];
      colorList = [...nextState.colors];
      purchasedFilaments = nextState.purchasedFilaments.map(p => ({ ...p }));
      
      // Salva lo stato
      saveState();
      renderAll();
      
      showToast(`Ripristinato: ${nextState.actionDescription}`, "success");
      
      // Salva gli stack
      saveUndoRedoStacks();
      
      updateHistoryUI();
    }
  }

  // Aggiorna la UI della cronologia
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
            <div style="font-weight: 500; color: var(--text-main);">${state.actionDescription}</div>
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
            <div style="font-weight: 500; color: var(--text-main);">${state.actionDescription}</div>
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
    // Trova lo stato target nello stack (contando dalla fine)
    const targetState = undoStack[targetIndex];
    if (!targetState) {
      showToast("Stato non trovato nella cronologia", "error");
      return;
    }

    // Salva lo stato corrente nello stack redo
    const currentState = {
      filaments: JSON.parse(JSON.stringify(filaments)),
      brands: [...brandList],
      materials: [...materialList],
      colors: [...colorList],
      purchasedFilaments: JSON.parse(JSON.stringify(purchasedFilaments)),
      actionDescription: "Stato corrente",
      timestamp: new Date().toISOString()
    };
    redoStack.push(currentState);

    // Rimuovi tutti gli stati dopo quello target dallo stack undo
    undoStack = undoStack.slice(0, targetIndex + 1);

    // Ripristina lo stato target
    filaments = targetState.filaments.map(f => ({ ...f }));
    brandList = [...targetState.brands];
    materialList = [...targetState.materials];
    colorList = [...targetState.colors];
    purchasedFilaments = targetState.purchasedFilaments.map(p => ({ ...p }));

    // Salva lo stato
    saveState();
    renderAll();
    
    showToast(`Ripristinato a: ${targetState.actionDescription}`, "success");
    
    // Salva gli stack
    saveUndoRedoStacks();
    
    updateHistoryUI();
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
    const brandsStored = localStorage.getItem(BRAND_LIST_KEY);
    const materialsStored = localStorage.getItem(MATERIAL_LIST_KEY);
    const colorsStored = localStorage.getItem(COLOR_LIST_KEY);
    const locationsStored = localStorage.getItem(LOCATION_LIST_KEY);

    brandList = brandsStored
      ? JSON.parse(brandsStored)
      : Array.from(new Set(defaultBrands));
    brandList = cleanBrandList(brandList);

    materialList = materialsStored
      ? JSON.parse(materialsStored)
      : Array.from(new Set(defaultMaterialsOrdered));
    colorList = colorsStored
      ? JSON.parse(colorsStored)
      : Array.from(new Set(defaultColors));
    
    // Carica lista posizioni
    if (locationsStored) {
      try {
        locationList = JSON.parse(locationsStored);
        if (!Array.isArray(locationList) || locationList.length === 0) {
          locationList = ["box Ikea", "Box", "scaffale 1", "scaffale 5", "scaffale 6"];
        }
      } catch (e) {
        console.error("Errore nel caricamento delle posizioni:", e);
        locationList = ["box Ikea", "Box", "scaffale 1", "scaffale 5", "scaffale 6"];
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const state = JSON.parse(raw);
        console.log("Caricamento stato da localStorage. Filamenti trovati:", state.filaments?.length || 0);
        
        filaments = (state.filaments || []).map((f) => ({
          ...f,
          brand: canonicalizeBrand(f.brand),
          // Assicura che packaging_type abbia un default
          packaging_type: f.packaging_type || "spool",
          // Assicura che unit_price sia null se non presente
          unit_price: f.unit_price != null ? f.unit_price : null,
          // Assicura che open_spools_fractions sia un array se presente
          open_spools_fractions: Array.isArray(f.open_spools_fractions) ? f.open_spools_fractions : undefined
        }));

        console.log("Filamenti dopo mappatura:", filaments.length);

        // Ricalcola i pesi per tutti i filamenti dopo il caricamento
        filaments.forEach(f => {
          recalcWeightsForFilament(f);
        });

        filaments = deduplicateFilamentsByIdentity(filaments);
        console.log("Filamenti dopo deduplicazione:", filaments.length);

        purchasedFilaments = Array.isArray(state.purchasedFilaments)
          ? state.purchasedFilaments.map((p) => ({
              ...p,
              brand: canonicalizeBrand(p.brand)
            }))
          : [];

        if (state.brands) {
          brandList = cleanBrandList(brandList.concat(state.brands || []));
        }
        if (state.materials) {
          materialList = Array.from(
            new Set(state.materials.concat(materialList))
          );
        }
        if (state.colors) {
          colorList = Array.from(new Set(state.colors.concat(colorList)));
        }

        if (purchasedFilaments && purchasedFilaments.length) {
          const purchasedBrands = purchasedFilaments
            .map((p) => p.brand)
            .filter(Boolean);
          if (purchasedBrands.length) {
            brandList = cleanBrandList(
              brandList.concat(purchasedBrands)
            );
          }
        }
      } catch (e) {
        console.error("Errore nel parse dello stato:", e);
        filaments = [];
        purchasedFilaments = [];
      }
    } else {
      filaments = [];
      purchasedFilaments = [];
    }

    brandList = cleanBrandList(brandList);
    localStorage.setItem(BRAND_LIST_KEY, JSON.stringify(brandList));
    materialList = Array.from(new Set(materialList));
    localStorage.setItem(MATERIAL_LIST_KEY, JSON.stringify(materialList));
    colorList = Array.from(new Set(colorList));
    localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));
    
    // Salva lista posizioni se non esiste
    if (!locationsStored) {
      localStorage.setItem(LOCATION_LIST_KEY, JSON.stringify(locationList));
    }
    
    // Carica storico consumi
    loadConsumptionHistory();
  }
  
  // Funzione helper per generare le opzioni dei dropdown posizione
  function generateLocationOptions(selectedValue = "") {
    return `
      <option value="">Nessuna posizione</option>
      ${locationList.map(loc => 
        `<option value="${loc}" ${loc === selectedValue ? "selected" : ""}>${loc}</option>`
      ).join("")}
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
        if (locationList.includes(newName)) {
          showToast("Una posizione con questo nome esiste già.", "error");
          return;
        }
        
        const oldName = location;
        locationList[index] = newName;
        saveLocationList();
        
        // Aggiorna tutte le posizioni nei filamenti
        filaments.forEach(f => {
          if (f.location === oldName) {
            f.location = newName;
          }
          if (f.spools_locations && Array.isArray(f.spools_locations)) {
            f.spools_locations = f.spools_locations.map(loc => loc === oldName ? newName : loc);
          }
        });
        saveState();
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
          const ok = confirm(
            `La posizione "${location}" è utilizzata da alcuni filamenti. Eliminarla rimuoverà la posizione da tutti i filamenti. Continuare?`
          );
          if (!ok) return;
          
          // Rimuovi la posizione da tutti i filamenti
          filaments.forEach(f => {
            if (f.location === location) {
              f.location = "";
            }
            if (f.spools_locations && Array.isArray(f.spools_locations)) {
              f.spools_locations = f.spools_locations.map(loc => loc === location ? "" : loc);
            }
          });
          saveState();
          renderAll();
        }
        
        locationList.splice(index, 1);
        saveLocationList();
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
    const raw = localStorage.getItem(CONSUMPTION_HISTORY_KEY);
    if (raw) {
      try {
        consumptionHistory = JSON.parse(raw);
      } catch (e) {
        consumptionHistory = [];
      }
    } else {
      consumptionHistory = [];
    }
  }

  function saveConsumptionHistory() {
    localStorage.setItem(CONSUMPTION_HISTORY_KEY, JSON.stringify(consumptionHistory));
  }

  function addConsumptionEntry(filament, gramsConsumed) {
    if (gramsConsumed <= 0) return;
    
    const entry = {
      id: `cons-${Date.now().toString(16)}`,
      timestamp: new Date().toISOString(),
      filamentId: filament.id,
      brand: filament.brand,
      material: filament.material,
      variant: filament.variant,
      gramsConsumed: gramsConsumed
    };
    
    consumptionHistory.push(entry);
    saveConsumptionHistory();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
  }

  function calculateConsumptionByDifference() {
    // Raggruppa filamenti acquistati per identità
    const purchasedMap = new Map();
    
    purchasedFilaments.forEach(p => {
      const brand = canonicalizeBrand(p.brand || "");
      const material = canonicalizeMaterial(p.material || "");
      const variant = (p.variant || "").trim();
      const colorCode = (p.color_code || "").trim();
      const unitWeight = p.unit_weight_g || 1000;
      
      const key = `${brand}|${material}|${variant}|${colorCode}|${unitWeight}`;
      
      if (!purchasedMap.has(key)) {
        purchasedMap.set(key, {
          brand,
          material,
          variant,
          color_code: colorCode,
          unit_weight_g: unitWeight,
          quantity_spools: 0,
          total_weight_g: 0
        });
      }
      
      const entry = purchasedMap.get(key);
      const qty = p.quantity_spools != null ? p.quantity_spools : (p.quantitySpools || 0);
      entry.quantity_spools += qty;
      entry.total_weight_g += qty * unitWeight;
    });
    
    // Raggruppa filamenti presenti per identità
    const stockMap = new Map();
    
    filaments.forEach(f => {
      const brand = canonicalizeBrand(f.brand || "");
      const material = canonicalizeMaterial(f.material || "");
      const variant = (f.variant || "").trim();
      const colorCode = (f.color_code || "").trim();
      const unitWeight = f.unit_weight_g || 1000;
      
      const key = `${brand}|${material}|${variant}|${colorCode}|${unitWeight}`;
      
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          brand,
          material,
          variant,
          color_code: colorCode,
          unit_weight_g: unitWeight,
          total_weight_g: 0,
          remaining_weight_g: 0
        });
      }
      
      const entry = stockMap.get(key);
      entry.total_weight_g += f.total_weight_g || 0;
      entry.remaining_weight_g += f.remaining_weight_g || 0;
    });
    
    // Calcola differenze
    const results = [];
    let totalPurchased = 0;
    let totalPresent = 0;
    let totalConsumed = 0;
    
    // Per ogni filamento acquistato, calcola la differenza
    purchasedMap.forEach((purchased, key) => {
      const stock = stockMap.get(key) || {
        total_weight_g: 0,
        remaining_weight_g: 0
      };
      
      const consumed = purchased.total_weight_g - stock.remaining_weight_g;
      
      totalPurchased += purchased.total_weight_g;
      totalPresent += stock.remaining_weight_g;
      totalConsumed += consumed;
      
      if (consumed > 0 || stock.remaining_weight_g > 0) {
        results.push({
          ...purchased,
          present_weight_g: stock.remaining_weight_g,
          consumed_weight_g: consumed
        });
      }
    });
    
    // Aggiungi filamenti presenti ma non acquistati (potrebbero essere stati aggiunti manualmente)
    stockMap.forEach((stock, key) => {
      if (!purchasedMap.has(key)) {
        totalPresent += stock.remaining_weight_g;
        results.push({
          brand: stock.brand,
          material: stock.material,
          variant: stock.variant,
          color_code: stock.color_code,
          unit_weight_g: stock.unit_weight_g,
          quantity_spools: 0,
          total_weight_g: 0,
          present_weight_g: stock.remaining_weight_g,
          consumed_weight_g: -stock.remaining_weight_g // Negativo perché non era acquistato
        });
      }
    });
    
    // Ordina per consumato (decrescente)
    results.sort((a, b) => b.consumed_weight_g - a.consumed_weight_g);
    
    return {
      results,
      totals: {
        purchased: totalPurchased,
        present: totalPresent,
        consumed: totalConsumed
      }
    };
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
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Acquistato totale</div>
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
              <th style="text-align: right;">Acquistato</th>
              <th style="text-align: right;">Presente</th>
              <th style="text-align: right;">Consumato</th>
            </tr>
          </thead>
          <tbody>
            ${calc.results.map(r => {
              const consumedColor = r.consumed_weight_g > 0 ? "var(--danger)" : r.consumed_weight_g < 0 ? "var(--warning)" : "var(--text-muted)";
              return `
                <tr>
                  <td>${r.brand || "-"}</td>
                  <td>${r.material || "-"}</td>
                  <td>${r.variant || "-"}</td>
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
        <td>${filamentStr}</td>
        <td style="font-weight:600;color:var(--danger);">-${formatNumber(entry.gramsConsumed, 0)} g</td>
        <td>
          <button type="button" class="btn-xs btn-outline" onclick="deleteConsumptionEntry('${entry.id}')" title="Elimina">✕</button>
        </td>
      </tr>`;
    }).join("");
  }

  function deleteConsumptionEntry(entryId) {
    consumptionHistory = consumptionHistory.filter(e => e.id !== entryId);
    saveConsumptionHistory();
    renderConsumptionChart();
    renderConsumptionHistory();
    renderConsumptionStats();
    showToast("Voce eliminata dallo storico.", "success");
  }

  function clearAllConsumptionHistory() {
    if (!confirm("Vuoi davvero cancellare tutto lo storico consumi?")) return;
    consumptionHistory = [];
    saveConsumptionHistory();
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
    const dailyData = {};
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyData[key] = { total: 0, byMaterial: {} };
    }

    filtered.forEach(entry => {
      const key = entry.timestamp.slice(0, 10);
      if (!dailyData[key]) {
        dailyData[key] = { total: 0, byMaterial: {} };
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
          <title>${p.day}: ${formatNumber(p.value, 0)}g</title>
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
        const color = materialColors[mat] || materialColors["Altro"];
        const total = filtered.filter(e => (e.material || "Altro") === mat)
          .reduce((sum, e) => sum + (e.gramsConsumed || 0), 0);
        return `<div class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${color}"></span>
          ${mat}: ${formatNumber(total, 0)}g
        </div>`;
      }).join("");
    }
  }

  // =============================================
  // FUNZIONI FILTRI
  // =============================================

  function populateFilterOptions() {
    // Filtri per magazzino disponibile
    const stockBrandSelect = document.getElementById("stockFilterBrand");
    const stockMaterialSelect = document.getElementById("stockFilterMaterial");
    
    // Filtri per comprati
    const purchasedBrandSelect = document.getElementById("purchasedFilterBrand");
    const purchasedMaterialSelect = document.getElementById("purchasedFilterMaterial");

    // Raccogli marche e materiali unici dai filamenti
    const stockBrands = new Set(filaments.map(f => f.brand).filter(Boolean));
    const stockMaterials = new Set(filaments.map(f => f.material).filter(Boolean));
    
    const purchasedBrands = new Set(purchasedFilaments.map(f => f.brand).filter(Boolean));
    const purchasedMaterials = new Set(purchasedFilaments.map(f => f.material).filter(Boolean));

    // Popola select marche stock
    if (stockBrandSelect) {
      const currentVal = stockBrandSelect.value;
      stockBrandSelect.innerHTML = '<option value="">Tutte le marche</option>';
      Array.from(stockBrands).sort((a, b) => a.localeCompare(b, "it")).forEach(brand => {
        const opt = document.createElement("option");
        opt.value = brand;
        opt.textContent = brand;
        stockBrandSelect.appendChild(opt);
      });
      stockBrandSelect.value = currentVal;
    }

    // Popola select materiali stock
    if (stockMaterialSelect) {
      const currentVal = stockMaterialSelect.value;
      stockMaterialSelect.innerHTML = '<option value="">Tutti i materiali</option>';
      Array.from(stockMaterials).sort((a, b) => a.localeCompare(b, "it")).forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        stockMaterialSelect.appendChild(opt);
      });
      stockMaterialSelect.value = currentVal;
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
    
    if (stockFilters.brand) {
      result = result.filter(f => f.brand === stockFilters.brand);
    }
    if (stockFilters.material) {
      result = result.filter(f => f.material === stockFilters.material);
    }
    if (stockFilters.packaging) {
      result = result.filter(f => f.packaging_type === stockFilters.packaging);
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
    stockFilters = { brand: "", material: "", packaging: "" };
    document.getElementById("stockFilterBrand").value = "";
    document.getElementById("stockFilterMaterial").value = "";
    document.getElementById("stockFilterPackaging").value = "";
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

    if (stockBrand) {
      stockBrand.addEventListener("change", (e) => {
        stockFilters.brand = e.target.value;
        renderFilamentTable();
      });
    }
    if (stockMaterial) {
      stockMaterial.addEventListener("change", (e) => {
        stockFilters.material = e.target.value;
        renderFilamentTable();
      });
    }
    if (stockPackaging) {
      stockPackaging.addEventListener("change", (e) => {
        stockFilters.packaging = e.target.value;
        renderFilamentTable();
      });
    }
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
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const startTheme = saved || "dark";
    applyTheme(startTheme);

    const toggleBtn = document.getElementById("themeToggleButton");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
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
    const brandSel = document.getElementById("addBrandSelect");
    const brandCustom = document.getElementById("addBrandCustom");
    const matSel = document.getElementById("addMaterialSelect");
    const matCustom = document.getElementById("addMaterialCustom");
    const colorCustom = document.getElementById("addColorCustom");
    const colorCodeInput = document.getElementById("addColorCodeInput");
    const spoolsTotalInput = document.getElementById(
      "addSpoolsTotalInput"
    );
    const sealedInput = document.getElementById(
      "addSealedSpoolsInput"
    );
    const openInput = document.getElementById("addOpenSpoolsInput");
    const unitWeightPreset = document.getElementById(
      "addUnitWeightPreset"
    );
    const unitWeightInput = document.getElementById(
      "addUnitWeightInput"
    );
    const packagingTypeSelect = document.getElementById("addPackagingType");
    const priceInput = document.getElementById("addPriceInput");
    const supplierInput = document.getElementById(
      "addSupplierInput"
    );
    const notesInput = document.getElementById("addNotesInput");
    const fractionSelect = document.getElementById("addFractionSelect");

    let brand = "";
    if (brandSel.value === "__custom__") {
      brand = brandCustom.value.trim();
    } else {
      brand = brandSel.value;
    }
    brand = canonicalizeBrand(brand);

    let material = "";
    if (matSel.value === "__custom__") {
      material = matCustom.value.trim();
    } else {
      material = matSel.value;
    }

    // Leggi colore dal nuovo dropdown personalizzato
    let color = "";
    const dropdownColorValue = window.addColorDropdown ? window.addColorDropdown.getValue() : "";
    if (dropdownColorValue && dropdownColorValue !== "__custom__") {
      color = dropdownColorValue;
    } else if (colorCustom && colorCustom.value.trim()) {
      color = colorCustom.value.trim();
    }

    const colorCode =
      colorCodeInput && colorCodeInput.value
        ? colorCodeInput.value.trim()
        : "";

    const packagingType = packagingTypeSelect ? packagingTypeSelect.value : "spool";
    let unitPrice = priceInput && priceInput.value ? parseFloat(priceInput.value) : null;
    
    // Se non c'è prezzo e c'è un trasferimento da purchased, recupera il prezzo dall'entry
    if ((unitPrice == null || unitPrice === 0) && pendingPurchasedTransfer) {
      const idx = pendingPurchasedTransfer.entryIndex;
      if (typeof idx === "number" && idx >= 0 && idx < purchasedFilaments.length) {
        const pEntry = purchasedFilaments[idx];
        if (pEntry.unit_price != null && pEntry.unit_price > 0) {
          unitPrice = pEntry.unit_price;
        }
      }
    }
    
    // Se ancora non c'è prezzo, cerca nelle fatture importate per match
    if ((unitPrice == null || unitPrice === 0) && brand && material && color) {
      const fBrand = canonicalizeBrand(brand);
      const fMaterial = canonicalizeMaterial(material);
      const fVariant = color.trim();
      const fColorCode = colorCode.trim();
      
      const match = purchasedFilaments.find(p => {
        const pBrand = canonicalizeBrand(p.brand || "");
        const pMaterial = canonicalizeMaterial(p.material || "");
        const pVariant = (p.variant || "").trim();
        const pColorCode = (p.color_code || "").trim();
        
        const brandMatch = pBrand === fBrand;
        const materialMatch = pMaterial === fMaterial;
        const variantMatch = pVariant.toLowerCase() === fVariant.toLowerCase();
        const colorCodeMatch = !fColorCode || !pColorCode || pColorCode === fColorCode;
        
        return brandMatch && materialMatch && variantMatch && colorCodeMatch && 
               p.unit_price != null && p.unit_price > 0;
      });
      
      if (match && match.unit_price != null) {
        unitPrice = match.unit_price;
      }
    }

    const sealedSpoolsRaw = parseInt(sealedInput.value || "0", 10);
    const openSpoolsRaw = parseInt(openInput.value || "0", 10);
    const sealedSpools = isNaN(sealedSpoolsRaw) ? 0 : sealedSpoolsRaw;
    const openSpools = isNaN(openSpoolsRaw) ? 0 : openSpoolsRaw;

    let unitWeight = 0;
    if (
      unitWeightPreset &&
      unitWeightPreset.value &&
      unitWeightPreset.value !== "__custom__"
    ) {
      unitWeight = parseFloat(unitWeightPreset.value);
    } else {
      const customWeight = parseFloat(unitWeightInput.value);
      unitWeight = isNaN(customWeight) ? 0 : customWeight;
    }

    const supplier = supplierInput.value.trim();
    const notes = notesInput.value.trim();
    let mainFraction = parseFloat(fractionSelect.value || "1");

    if (!brand) {
      showToast("Seleziona o inserisci una marca.", "error");
      return;
    }
    if (!material) {
      showToast("Seleziona o inserisci un materiale.", "error");
      return;
    }
    if (!color) {
      showToast(
        "Seleziona o inserisci un colore/variante.",
        "error"
      );
      return;
    }
    if (sealedSpools < 0 || openSpools < 0) {
      showToast(
        "I numeri di bobine nuove/aperti devono essere positivi.",
        "error"
      );
      return;
    }

    const spoolsTotal = sealedSpools + openSpools;

    if (!spoolsTotal || spoolsTotal <= 0) {
      showToast(
        "Inserisci almeno una bobina nuova o aperta per questo filamento.",
        "error"
      );
      return;
    }

    if (!unitWeight || unitWeight <= 0 || isNaN(unitWeight)) {
      showToast(
        "Inserisci i grammi per bobina (es. 1000).",
        "error"
      );
      return;
    }

    // Leggi le posizioni per ogni bobina
    const spoolsLocations = [];
    for (let i = 0; i < spoolsTotal; i++) {
      const locationSelect = document.getElementById(`addSpoolLocation_${i}`);
      if (locationSelect) {
        spoolsLocations.push(locationSelect.value.trim() || "");
      } else {
        spoolsLocations.push("");
      }
    }

    if (!brandList.includes(brand)) {
      brandList.push(brand);
      brandList = cleanBrandList(brandList);
      localStorage.setItem(BRAND_LIST_KEY, JSON.stringify(brandList));
      renderBrandOptions();
    }
    if (!materialList.includes(material)) {
      materialList.push(material);
      materialList = Array.from(new Set(materialList));
      localStorage.setItem(
        MATERIAL_LIST_KEY,
        JSON.stringify(materialList)
      );
      renderMaterialOptions();
    }
    if (!colorList.includes(color)) {
      colorList.push(color);
      colorList = Array.from(new Set(colorList));
      localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));
    }

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
      unit_price: unitPrice,
      supplier,
      notes,
      spools_locations: spoolsLocations.length > 0 ? spoolsLocations : undefined
    };

    // Calcolo coerente di residuo / usato.
    recalcWeightsForFilament(filament);

    // Salva stato per undo
    saveStateForUndo(`Aggiunto filamento: ${brand} – ${material} – ${color}`);

    filaments.push(filament);
    filaments = deduplicateFilamentsByIdentity(filaments);

    let transferredSpools = 0;
    if (pendingPurchasedTransfer && typeof filament.spools_total === "number") {
      const idx = pendingPurchasedTransfer.entryIndex;
      if (typeof idx === "number" && idx >= 0 && idx < purchasedFilaments.length) {
        const pEntry = purchasedFilaments[idx];
        const invoiceQtyRaw =
          pEntry.quantity_spools != null
            ? pEntry.quantity_spools
            : pEntry.quantitySpools != null
            ? pEntry.quantitySpools
            : 0;
        const spoolsToAdd = filament.spools_total || 0;
        const maxAllowed =
          pendingPurchasedTransfer.maxQuantity || spoolsToAdd;
        const toDeduct = Math.min(invoiceQtyRaw, maxAllowed, spoolsToAdd);
        if (toDeduct > 0) {
          transferredSpools = toDeduct;
          const newQty = invoiceQtyRaw - toDeduct;
          if ("quantity_spools" in pEntry || !("quantitySpools" in pEntry)) {
            pEntry.quantity_spools = newQty;
          } else {
            pEntry.quantitySpools = newQty;
          }
          if (newQty <= 0) {
            purchasedFilaments.splice(idx, 1);
          }
        }
      }
      pendingPurchasedTransfer = null;
    }

    saveState();
    renderColorOptions();
    renderAll();

    brandSel.value = "";
    brandCustom.value = "";
    matSel.value = "";
    matCustom.value = "";
    colorSel.value = "";
    colorCustom.value = "";
    if (colorCodeInput) colorCodeInput.value = "";
    if (spoolsTotalInput) spoolsTotalInput.value = "";
    sealedInput.value = "";
    openInput.value = "";
    
    // Reset posizioni
    const locationsContainer = document.getElementById("addSpoolsLocationsContainer");
    const locationsList = document.getElementById("addSpoolsLocationsList");
    if (locationsContainer) locationsContainer.style.display = "none";
    if (locationsList) locationsList.innerHTML = "";

    if (unitWeightPreset) {
      unitWeightPreset.value = "1000";
      try {
        unitWeightPreset.dispatchEvent(new Event("change"));
      } catch (e) {
        const evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", true, false);
        unitWeightPreset.dispatchEvent(evt);
      }
    } else if (unitWeightInput) {
      unitWeightInput.value = "";
    }

    supplierInput.value = "";
    notesInput.value = "";
    fractionSelect.value = "1";
    updateColorPreviewFromSelection();

    let toastMsg = "Filamento aggiunto al magazzino disponibile.";
    if (transferredSpools > 0) {
      toastMsg += " Trasferite " + transferredSpools + " bobine dal magazzino filamenti comprati.";
    }
    showToast(toastMsg, "success");
  }

  function isLowStock(f) {
    const ratio =
      f.total_weight_g > 0
        ? f.remaining_weight_g / f.total_weight_g
        : 0;
    const stockSpools = f.sealed_spools + f.open_spools;
    const lastOpen =
      stockSpools === 1 && f.open_spools === 1 && f.main_fraction < 1;

    return ratio <= 0.25 || lastOpen;
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

    let filtered = filaments.slice();
    console.log("Filamenti dopo slice:", filtered.length);
    
    // Applica filtri dropdown
    filtered = applyStockFilters(filtered);
    console.log("Filamenti dopo filtri:", filtered.length);
    
    // Applica ricerca testuale
    if (currentSearch.trim()) {
      const term = currentSearch.toLowerCase();
      filtered = filtered.filter((f) => {
        const hay =
          (f.brand || "") +
          " " +
          (f.material || "") +
          " " +
          (f.variant || "") +
          " " +
          (f.color_code || "") +
          " " +
          (f.packaging_type || "") +
          " " +
          (f.supplier || "") +
          " " +
          (f.location || "") +
          " " +
          (f.notes || "");
        return hay.toLowerCase().includes(term);
      });
    }

    if (sortState.field) {
      const field = sortState.field;
      const dir = sortState.direction === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
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
      const hasFilters = stockFilters.brand || stockFilters.material || stockFilters.packaging || currentSearch.trim();
      td.innerHTML = hasFilters
        ? '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><path d="M3 4h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-state-title">Nessun risultato con i filtri attuali.</div><div class="empty-state-text">Prova a modificare o resettare i filtri.</div></div>'
        : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 9h8M8 12h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6 5V4h12v1" stroke="currentColor" stroke-width="1.4"/></svg><div class="empty-state-title">Il magazzino è vuoto.</div><div class="empty-state-text">Aggiungi il primo filamento oppure importa un JSON esportato in precedenza.</div></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((f) => {
      // Raggruppa le bobine per posizione E colore
      const locationsColorsMap = new Map(); // Map<"location|color", {count, sealed, open, openFractions, color}>
      const totalSpools = (f.sealed_spools || 0) + (f.open_spools || 0);
      
      // Se ha spools_locations, raggruppa per posizione e colore
      if (f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.length > 0) {
        f.spools_locations.forEach((location, index) => {
          const loc = location && location.trim() !== "" ? location : "";
          // Ottieni il colore specifico della bobina, o usa il colore principale
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
        // Se usa il campo location globale, raggruppa per colore
        const defaultLocation = f.location;
        // Se ci sono colori individuali, raggruppa per colore
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
          // Nessun colore individuale, usa il colore principale
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
        // Nessuna posizione, raggruppa per colore
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
          // Nessun colore individuale, usa il colore principale
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
      
      // Crea una riga per ogni combinazione posizione+colore
      locationsColorsMap.forEach((group) => {
      const tr = document.createElement("tr");
      if (isLowStock(f)) {
        tr.classList.add("low-stock-row");
      }

      // Usa il colore specifico del gruppo invece del colore principale
      const pillHtml = getColoredPillHtml(group.color);
      
      const packagingLabel = f.packaging_type === "refill" ? "Ricarica" : "Bobina";
      const priceDisplay = f.unit_price != null ? "€" + formatNumber(f.unit_price, 2) : "-";
        
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
        
        // Determina il colore della barra in base alla percentuale
        let barColor = "#22c55e"; // Verde (alto)
        let barClass = "high-stock";
        if (ratio <= 0.25) {
          barColor = "#ef4444"; // Rosso (basso)
          barClass = "low-stock";
        } else if (ratio <= 0.5) {
          barColor = "#f59e0b"; // Giallo/Arancio (medio)
          barClass = "medium-stock";
        }
        
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
            <button type="button" class="btn-action btn-success" data-id="${
            f.id
          }" title="Modifica filamento">
              <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">
              <path d="M16.474 5.408l2.118 2.118M18 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
              <span>Modifica</span>
          </button>
            <button type="button" class="btn-action btn-success" data-id="${
            f.id
            }" title="Elimina filamento" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: var(--danger);">
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
    });
    
    // Inizializza ridimensionamento colonne dopo il rendering
    initResizableColumns();
  }

  // Funzionalità ridimensionamento colonne (stile Excel)
  function initResizableColumns() {
    const table = document.getElementById("filamentTable");
    if (!table) return;
    
    // Rimuovi handler precedenti se esistono
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
        
        // Aggiorna anche tutte le celle della colonna
        const colIndex = Array.from(header.parentElement.children).indexOf(header);
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach(row => {
          const cell = row.children[colIndex];
          if (cell) {
            cell.style.width = newWidth + "px";
          }
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
    let filtered = applyPurchasedFilters(purchasedFilaments);

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
        pillHtml = `<span class="pill-colored light-text" style="background: linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6);" title="${p.variant || "Multi-colore"}">${p.variant || "Multi-colore"}</span>`;
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
      totalSpools += f.spools_total || 0;
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

  // Stato di ordinamento per la tabella aggregata
  let spoolsStateSortState = { field: "remaining_weight_g", direction: "asc" };

  function renderSpoolsStateTable() {
    const tbody = document.getElementById("spoolsStateTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Raggruppa i filamenti per marca, materiale e variante
    const groupedMap = new Map(); // Map<"brand|material|variant", {brand, material, variant, totalSpools, totalWeight, remainingWeight}>

    filaments.forEach((f) => {
      const brand = canonicalizeBrand(f.brand || "");
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
      
      group.totalSpools += totalSpools;
      group.totalWeight += totalSpools * unitWeight;
      group.remainingWeight += f.remaining_weight_g || 0;
      
      // Calcola la percentuale (ratio) per l'ordinamento
      if (group.totalWeight > 0) {
        group.percentage = group.remainingWeight / group.totalWeight;
      } else {
        group.percentage = 0;
      }
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
      
      // Mappa i nomi dei campi HTML (snake_case) ai nomi delle proprietà degli oggetti raggruppati (camelCase)
      const fieldMap = {
        "remaining_weight_g": "remainingWeight",
        "spools_total": "totalSpools",
        "total_weight_g": "totalWeight",
        "percentage": "percentage",
        "brand": "brand",
        "material": "material",
        "variant": "variant"
      };
      
      const mappedField = fieldMap[field] || field;
      
      grouped.sort((a, b) => {
        let va = a[mappedField];
        let vb = b[mappedField];
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
      "#spoolsStateSection th[data-sort-field]"
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
      
      // Determina il colore della barra
      let barColor = "#22c55e"; // Verde (alto)
      if (ratio <= 0.25) {
        barColor = "#ef4444"; // Rosso (basso)
      } else if (ratio <= 0.5) {
        barColor = "#f59e0b"; // Giallo/Arancio (medio)
      }
      
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
        <td>${group.brand || "-"}</td>
        <td>${group.material || "-"}</td>
        <td>${pillHtml}</td>
        <td style="text-align: center;">${formatNumber(group.remainingWeight, 0)}</td>
        <td style="text-align: center;">${formatNumber(group.totalSpools)}</td>
        <td style="padding: 0.35rem 0.5rem; vertical-align: middle;">${barHtml}</td>
      `;
      tbody.appendChild(tr);
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
        f.total_weight_g > 0
          ? f.remaining_weight_g / f.total_weight_g
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
      header.innerHTML = `<span>${titleBrand} – ${materialText}<span class="pill-colored ${textClass}" style="background:${colorHex};padding:0.15rem 0.5rem;font-size:0.8rem;">${titleVariant}</span></span><span>${detail}</span>`;
      row.appendChild(header);

      const barOuter = document.createElement("div");
      barOuter.className = "bar-outer";

      const barInner = document.createElement("div");
      barInner.className = "bar-inner";

      const pct =
        f.total_weight_g > 0
          ? Math.max(
              5,
              Math.min(
                100,
                (f.remaining_weight_g / f.total_weight_g) * 100
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

  // Stato di ordinamento e ricerca per check finale
  let checkFinaleSortState = { field: "remaining_weight_g", direction: "asc" };
  let checkFinaleSearchTerm = "";
  let checkFinaleShowPlaced = true; // Mostra le bobine posizionate di default

  function renderCheckFinale() {
    const tbody = document.getElementById("checkFinaleTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Se non ci sono filamenti
    if (filaments.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" style="text-align:center;color:var(--text-muted);">Nessun filamento disponibile</td>';
      tbody.appendChild(tr);
      return;
    }

    // Filtra i filamenti in base alla ricerca e al filtro posizionate
    let filtered = filaments.slice();
    
    // Filtra per bobine posizionate/non posizionate
    if (!checkFinaleShowPlaced) {
      filtered = filtered.filter((f) => {
        // Controlla se ha posizioni individuali
        if (f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.length > 0) {
          const hasLocation = f.spools_locations.some(loc => loc && loc.trim() !== "");
          return !hasLocation;
        }
        // Controlla posizione globale
        return !(f.location && f.location.trim() !== "");
      });
    }
    
    // Filtra per ricerca testuale
    if (checkFinaleSearchTerm.trim()) {
      const term = checkFinaleSearchTerm.toLowerCase();
      filtered = filtered.filter((f) => {
        const searchText = (
          (f.brand || "") + " " +
          (f.material || "") + " " +
          (f.variant || "") + " " +
          (f.color_code || "") + " " +
          (f.location || "")
        ).toLowerCase();
        return searchText.includes(term);
      });
    }

    // Ordina i filamenti per residuo (dal meno al più) di default
    if (checkFinaleSortState.field) {
      const field = checkFinaleSortState.field;
      const dir = checkFinaleSortState.direction === "asc" ? 1 : -1;
      
      filtered.sort((a, b) => {
        // Gestione speciale per has_location (checkbox/selezione)
        if (field === "has_location") {
          const aHasLocation = (a.location && a.location.trim() !== "") ? 1 : 0;
          const bHasLocation = (b.location && b.location.trim() !== "") ? 1 : 0;
          return (aHasLocation - bHasLocation) * dir;
        }
        
        let va = a[field];
        let vb = b[field];
        
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * dir;
        }
        
        return String(va || "").localeCompare(String(vb || ""), "it", {
          sensitivity: "base"
        }) * dir;
      });
    } else {
      // Default: ordina per residuo crescente (dal meno al più)
      filtered.sort((a, b) => {
        const aRemaining = a.remaining_weight_g || 0;
        const bRemaining = b.remaining_weight_g || 0;
        return aRemaining - bRemaining;
      });
    }

    // Aggiorna gli indicatori di ordinamento
    const ths = document.querySelectorAll("#checkFinaleSection th.sortable");
    ths.forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const field = th.getAttribute("data-sort-field");
      if (field === checkFinaleSortState.field) {
        th.classList.add(
          checkFinaleSortState.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
        );
      }
    });

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" style="text-align:center;color:var(--text-muted);">Nessun filamento trovato</td>';
      tbody.appendChild(tr);
      return;
    }

    // Mostra tutti i filamenti in ordine, con possibilità di selezionarli
    filtered.forEach((f) => {
      const tr = document.createElement("tr");
      const checkLocations = f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.length > 0
        ? f.spools_locations.filter(loc => loc && loc.trim() !== "")
        : (f.location && f.location.trim() !== "" ? [f.location] : []);
      const hasLocation = checkLocations.length > 0;
      const isPlaced = hasLocation;
      
      // Se ha già una posizione, evidenzia la riga
      if (isPlaced) {
        tr.style.background = "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))";
        tr.style.borderLeft = "3px solid #22c55e";
      }

      // Colonna checkbox
      const tdCheckbox = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `check-checkbox-${f.id}`;
      checkbox.checked = isPlaced;
      checkbox.disabled = isPlaced;
      checkbox.style.cssText = "width: 18px; height: 18px; cursor: pointer;";
      checkbox.addEventListener("change", () => {
        const locationSelect = document.getElementById(`check-location-${f.id}`);
        if (checkbox.checked && locationSelect) {
          locationSelect.style.display = "inline-block";
          locationSelect.focus();
        } else if (locationSelect) {
          locationSelect.style.display = "none";
        }
      });
      tdCheckbox.appendChild(checkbox);
      tr.appendChild(tdCheckbox);

      // Colonna Marca
      const tdBrand = document.createElement("td");
      tdBrand.textContent = canonicalizeBrand(f.brand) || "-";
      tr.appendChild(tdBrand);

      // Colonna Materiale
      const tdMaterial = document.createElement("td");
      tdMaterial.textContent = f.material || "-";
      tr.appendChild(tdMaterial);

      // Colonna Colore
      const tdColor = document.createElement("td");
      const colorHex = getColorHex(f.variant);
      const isDark = isColorDark(colorHex);
      const textClass = isDark ? "light-text" : "dark-text";
      const colorSpan = document.createElement("span");
      colorSpan.className = `pill-colored ${textClass}`;
      colorSpan.style.cssText = `background:${colorHex};`;
      colorSpan.textContent = f.variant || "-";
      tdColor.appendChild(colorSpan);
      tr.appendChild(tdColor);

      // Colonna Bobine
      const tdSpools = document.createElement("td");
      tdSpools.textContent = f.spools_total || 0;
      tr.appendChild(tdSpools);

      // Colonna Residuo
      const tdRemaining = document.createElement("td");
      tdRemaining.textContent = formatNumber(f.remaining_weight_g || 0, 0) + " g";
      tr.appendChild(tdRemaining);

      // Colonna Posizione
      const tdLocation = document.createElement("td");
      const locations = f.spools_locations && Array.isArray(f.spools_locations) && f.spools_locations.length > 0
        ? f.spools_locations.filter(loc => loc && loc.trim() !== "")
        : (f.location && f.location.trim() !== "" ? [f.location] : []);
      
      if (locations.length > 0) {
        tdLocation.style.cssText = "color: #22c55e; font-weight: 600;";
        tdLocation.textContent = locations.join(", ");
      } else {
        tdLocation.textContent = "-";
      }
      tr.appendChild(tdLocation);

      // Colonna Azioni (dropdown posizione)
      const tdActions = document.createElement("td");
      const locationSelect = document.createElement("select");
      locationSelect.id = `check-location-${f.id}`;
      locationSelect.style.cssText = `display: ${checkbox.checked && !isPlaced ? "inline-block" : "none"}; padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 1px solid var(--border-subtle); background: var(--surface-soft); width: 100%; max-width: 180px;`;
      locationSelect.innerHTML = generateLocationOptions(f.location || "");
      
      // Salva automaticamente la posizione quando viene selezionata
      locationSelect.addEventListener("change", () => {
        const selectedLocation = locationSelect.value.trim();
        if (selectedLocation) {
          // Aggiorna il filamento
          f.location = selectedLocation;
          saveState();
          
          // Aggiorna solo la tabella 3a e il check finale (non tutto)
          renderFilamentTable();
          renderCheckFinale();
          
          showToast(`Posizione aggiornata: ${selectedLocation}`, "success");
        }
      });
      
      tdActions.appendChild(locationSelect);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function renderStorageVisualization() {
    const container = document.getElementById("storageVisualizationContainer");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Raggruppa i filamenti per posizione
    const locationsMap = new Map();
    
    filaments.forEach(f => {
      const totalSpools = (f.sealed_spools || 0) + (f.open_spools || 0);
      
      // Se ha spools_locations, usa quello
      if (f.spools_locations && Array.isArray(f.spools_locations)) {
        f.spools_locations.forEach((location, index) => {
          if (location && location.trim() !== "") {
            if (!locationsMap.has(location)) {
              locationsMap.set(location, []);
            }
            locationsMap.get(location).push({
              filament: f,
              spoolIndex: index,
              isSealed: index < (f.sealed_spools || 0)
            });
          }
        });
      } 
      // Altrimenti usa il campo location globale
      else if (f.location && f.location.trim() !== "") {
        if (!locationsMap.has(f.location)) {
          locationsMap.set(f.location, []);
        }
        // Aggiungi tutte le bobine a questa posizione
        for (let i = 0; i < totalSpools; i++) {
          locationsMap.get(f.location).push({
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
    
    // Ordina le posizioni
    const sortedLocations = Array.from(locationsMap.keys()).sort();
    
    // Crea un contenitore per ogni posizione
    sortedLocations.forEach(location => {
      const spools = locationsMap.get(location);
      
      const locationCard = document.createElement("div");
      locationCard.style.cssText = "background: var(--surface-soft); border-radius: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-subtle);";
      
      const locationHeader = document.createElement("div");
      locationHeader.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border-subtle);";
      
      const locationTitle = document.createElement("h3");
      locationTitle.style.cssText = "margin: 0; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.3rem;";
      locationTitle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" style="width: 12px; height: 12px;">
          <path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
        </svg>
        <span>${location}</span>
      `;
      
      const spoolsCount = document.createElement("span");
      spoolsCount.style.cssText = "font-size: 0.65rem; color: var(--text-muted); font-weight: 600;";
      spoolsCount.textContent = `${spools.length} bobina${spools.length !== 1 ? 'e' : 'a'}`;
      
      locationHeader.appendChild(locationTitle);
      locationHeader.appendChild(spoolsCount);
      locationCard.appendChild(locationHeader);
      
      // Container per le bobine
      const spoolsGrid = document.createElement("div");
      spoolsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 0.4rem;";
      
      spools.forEach(({ filament, spoolIndex, isSealed }) => {
        const spoolCard = document.createElement("div");
        spoolCard.style.cssText = "background: var(--surface); border-radius: 0.375rem; padding: 0.4rem; border: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s;";
        spoolCard.title = `Clicca per modificare: ${canonicalizeBrand(filament.brand)} – ${filament.material} – ${filament.variant}`;
        
        spoolCard.addEventListener("click", () => {
          openEditFilamentModal(filament.id);
        });
        
        spoolCard.addEventListener("mouseenter", () => {
          spoolCard.style.transform = "translateY(-1px)";
          spoolCard.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
          spoolCard.style.borderColor = "var(--accent)";
        });
        
        spoolCard.addEventListener("mouseleave", () => {
          spoolCard.style.transform = "translateY(0)";
          spoolCard.style.boxShadow = "none";
          spoolCard.style.borderColor = "var(--border-subtle)";
        });
        
        // Indicatore sigillata/aperta
        const statusBadge = document.createElement("div");
        statusBadge.style.cssText = `display: inline-block; padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.55rem; font-weight: 600; margin-bottom: 0.3rem; ${
          isSealed 
            ? "background: rgba(34, 197, 94, 0.15); color: #22c55e;"
            : "background: rgba(59, 130, 246, 0.15); color: #3b82f6;"
        }`;
        statusBadge.textContent = isSealed ? "S" : "A";
        
        // Colore del filamento - usa il colore specifico della bobina se disponibile
        const spoolVariant = (filament.spools_variants && Array.isArray(filament.spools_variants) && filament.spools_variants[spoolIndex]) 
          ? filament.spools_variants[spoolIndex] 
          : filament.variant;
        const colorHex = getColorHex(spoolVariant);
        const colorDot = document.createElement("div");
        colorDot.style.cssText = `width: 100%; height: 28px; border-radius: 0.25rem; background: ${colorHex}; margin-bottom: 0.3rem; border: 1px solid var(--border-subtle); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);`;
        
        // Info filamento
        const brandText = document.createElement("div");
        brandText.style.cssText = "font-size: 0.6rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        brandText.textContent = canonicalizeBrand(filament.brand) || "-";
        
        const materialText = document.createElement("div");
        materialText.style.cssText = "font-size: 0.55rem; color: var(--text-muted); margin-bottom: 0.1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        materialText.textContent = filament.material || "-";
        
        const variantText = document.createElement("div");
        variantText.style.cssText = "font-size: 0.5rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        variantText.textContent = spoolVariant || "-";
        
        // Residuo se aperta
        if (!isSealed && filament.open_spools_fractions && Array.isArray(filament.open_spools_fractions)) {
          const fraction = filament.open_spools_fractions[spoolIndex - (filament.sealed_spools || 0)] || 1;
          const percentage = Math.round(fraction * 100);
          const remainingGrams = Math.round((filament.unit_weight_g || 1000) * fraction);
          
          const remainingText = document.createElement("div");
          remainingText.style.cssText = "font-size: 0.5rem; color: var(--text-muted); margin-top: 0.3rem; padding-top: 0.3rem; border-top: 1px solid var(--border-subtle);";
          remainingText.textContent = `${percentage}%`;
          spoolCard.appendChild(remainingText);
        }
        
        spoolCard.appendChild(statusBadge);
        spoolCard.appendChild(colorDot);
        spoolCard.appendChild(brandText);
        spoolCard.appendChild(materialText);
        spoolCard.appendChild(variantText);
        
        spoolsGrid.appendChild(spoolCard);
      });
      
      locationCard.appendChild(spoolsGrid);
      container.appendChild(locationCard);
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
    renderCheckFinale();
    renderConsumptionStats();
    renderConsumptionByDifference();
    renderStorageVisualization();
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
    const hiddenId = document.getElementById("consumptionFilamentId");
    const sealedInput = document.getElementById(
      "consumptionSealedInput"
    );
    const openInput = document.getElementById("consumptionOpenInput");
    const fractionSelect = document.getElementById(
      "consumptionFractionSelect"
    );

    const filamentId = hiddenId.value;
    const f = filaments.find((x) => x.id === filamentId);
    if (!f) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    const newSealed = parseInt(sealedInput.value || "0", 10);
    const newOpen = parseInt(openInput.value || "0", 10);
    let fraction = parseFloat(fractionSelect.value || "1");
    if (isNaN(fraction)) fraction = 1;

    if (newSealed < 0 || newOpen < 0) {
      showToast(
        "I numeri di bobine nuove/aperti devono essere positivi.",
        "error"
      );
      return;
    }
    if (newSealed + newOpen > f.spools_total) {
      showToast(
        "Nuove + aperte non possono superare le bobine totali.",
        "error"
      );
      return;
    }

    // Gestione eliminazione bobine selezionate
    const spoolsToDelete = f.spools_total - (newSealed + newOpen);
    if (spoolsToDelete > 0) {
      const selectedCheckboxes = document.querySelectorAll('input[name="spoolToDelete"]:checked');
      if (selectedCheckboxes.length !== spoolsToDelete) {
        showToast(
          `Devi selezionare esattamente ${spoolsToDelete} bobina/e da eliminare.`,
          "error"
        );
        return;
      }

      // Salva stato per undo
      saveStateForUndo(`Eliminata/e ${spoolsToDelete} bobina/e: ${canonicalizeBrand(f.brand)} – ${f.material} – ${f.variant}`);

      // Gestisci l'eliminazione delle bobine selezionate
      const openSpoolsFractions = f.open_spools_fractions || [];
      const newOpenSpoolsFractions = [];
      
      // Ordina le checkbox selezionate per tipo e indice
      const selectedSpools = Array.from(selectedCheckboxes).map(cb => ({
        type: cb.dataset.spoolType,
        index: parseInt(cb.dataset.spoolIndex, 10)
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === "sealed" ? -1 : 1;
        return a.index - b.index;
      });

      let sealedToKeep = f.sealed_spools || 0;
      let openToKeep = f.open_spools || 0;
      
      // Conta quante bobine sigillate e aperte vengono eliminate
      selectedSpools.forEach(spool => {
        if (spool.type === "sealed") {
          sealedToKeep--;
        } else {
          openToKeep--;
        }
      });

      // Ricostruisci l'array delle frazioni delle bobine aperte rimanenti
      if (f.open_spools > 0) {
        for (let i = 0; i < f.open_spools; i++) {
          const shouldDelete = selectedSpools.some(s => s.type === "open" && s.index === i);
          if (!shouldDelete) {
            newOpenSpoolsFractions.push(openSpoolsFractions[i] !== undefined ? openSpoolsFractions[i] : 1);
          }
        }
      }

      f.sealed_spools = sealedToKeep;
      f.open_spools = openToKeep;
      f.open_spools_fractions = newOpenSpoolsFractions;
      f.spools_total = sealedToKeep + openToKeep;
      f.main_fraction = openToKeep > 0 ? fraction : 1;
    } else {
      // Salva stato per undo se non c'è eliminazione
      saveStateForUndo(`Aggiornato stato: ${canonicalizeBrand(f.brand)} – ${f.material} – ${f.variant}`);
      
      // Aggiorna normalmente
    f.sealed_spools = newSealed;
    f.open_spools = newOpen;
      f.spools_total = newSealed + newOpen;
    f.main_fraction = newOpen > 0 ? fraction : 1;
    }

    // Calcola grammi residui PRIMA dell'aggiornamento
    const oldRemaining = f.remaining_weight_g || 0;

    recalcWeightsForFilament(f);

    // Calcola grammi residui DOPO l'aggiornamento
    const newRemaining = f.remaining_weight_g || 0;
    
    // Se c'è stato un consumo (residuo diminuito), registralo
    // MA SOLO se non stiamo eliminando bobine (l'eliminazione non è un consumo)
    const consumed = oldRemaining - newRemaining;
    if (consumed > 0 && spoolsToDelete === 0) {
      // Solo se non ci sono bobine da eliminare, registra come consumo
      addConsumptionEntry(f, consumed);
    }

    saveState();
    renderAll();
    closeConsumptionModal();
    showToast("Stato del filamento aggiornato.", "success");
  }

  // --- Edit Filament Modal Functions ---
  function openEditFilamentModal(filamentId) {
    const f = filaments.find((x) => x.id === filamentId);
    if (!f) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    const modal = document.getElementById("editFilamentModal");
    const overlay = document.getElementById("modalOverlay");
    const infoEl = document.getElementById("editFilamentInfo");
    const colorCustom = document.getElementById("editColorCustom");
    const colorCodeInput = document.getElementById("editColorCodeInput");
    const unitWeightInput = document.getElementById("editUnitWeightInput");
    const packagingSelect = document.getElementById("editPackagingType");
    const priceInput = document.getElementById("editPriceInput");
    const supplierInput = document.getElementById("editSupplierInput");
    const locationInput = document.getElementById("editLocationInput");
    const hiddenId = document.getElementById("editFilamentId");
    
    // Nuovi campi bobine
    const spoolsTotalInput = document.getElementById("editSpoolsTotal");
    const spoolsSealedInput = document.getElementById("editSpoolsSealed");
    const spoolsOpenInput = document.getElementById("editSpoolsOpen");
    const spoolFractionSelect = document.getElementById("editSpoolFraction");
    const finishedSpoolsInput = document.getElementById("editFinishedSpools");
    const finishedSpoolsLabel = document.getElementById("editFinishedSpoolsLabel");
    const spoolFractionLabel = document.getElementById("editSpoolFractionLabel");

    if (infoEl) {
      infoEl.textContent = `${canonicalizeBrand(f.brand)} – ${f.material}`;
    }

    // Crea o aggiorna dropdown colore per edit modal
    window.editColorDropdown = createColorDropdown("editColorDropdownContainer", {
      placeholder: "Seleziona colore...",
      allowCustom: true,
      customLabel: "Altro colore...",
      initialValue: f.variant || "",
      onSelect: (value) => {
        const customInput = document.getElementById("editColorCustom");
        if (value === "__custom__") {
          customInput.style.display = "block";
          customInput.focus();
        } else {
          customInput.style.display = "none";
          customInput.value = "";
        }
        updateEditColorPreview();
      }
    });

    // Se il colore attuale non è nella lista, mostra input custom e imposta il valore nel dropdown
    const currentVariant = f.variant || "";
    if (currentVariant && !colorList.includes(currentVariant)) {
      if (colorCustom) {
        colorCustom.value = currentVariant;
        colorCustom.style.display = "block";
      }
      // Imposta anche il valore nel dropdown come custom per mantenere la coerenza
      if (window.editColorDropdown) {
        window.editColorDropdown.setValue("__custom__");
      }
    } else if (colorCustom) {
      colorCustom.value = "";
      colorCustom.style.display = "none";
    }
    
    updateEditColorPreview();

    // Mostra codice colore solo se non è già incluso nel nome variante
    if (colorCodeInput) {
      const variantHasCode = currentVariant && /\(\d{5}\)/.test(currentVariant);
      colorCodeInput.value = variantHasCode ? "" : (f.color_code || "");
    }
    if (unitWeightInput) unitWeightInput.value = f.unit_weight_g || 1000;
    if (packagingSelect) packagingSelect.value = f.packaging_type || "spool";
    if (priceInput) priceInput.value = f.unit_price != null ? f.unit_price : "";
    if (supplierInput) supplierInput.value = f.supplier || "";
    // Mostra/nascondi il campo posizione globale in base al numero di bobine
    const locationLabel = document.querySelector('label[for="editLocationInput"]') || 
                          document.querySelector('label:has(#editLocationInput)') ||
                          (locationInput ? locationInput.closest('label') : null);
    
    const notesInput = document.getElementById("editNotesInput");
    if (notesInput) notesInput.value = f.notes || "";
    if (hiddenId) hiddenId.value = filamentId;
    
    // Popola campi bobine
    if (spoolsTotalInput) spoolsTotalInput.value = f.spools_total || 0;
    if (spoolsSealedInput) spoolsSealedInput.value = f.sealed_spools || 0;
    if (spoolsOpenInput) spoolsOpenInput.value = f.open_spools || 0;
    
    const sealedSpools = f.sealed_spools || 0;
    const openSpools = f.open_spools || 0;
    const totalSpools = sealedSpools + openSpools;
    
    // Nascondi sempre il campo posizione globale (si usa solo per bobina)
    if (locationInput && locationLabel) {
      locationLabel.style.display = "none";
    }
    
    // Carica posizioni esistenti o crea array di default
    // spools_locations è un array: [posizione_bobina_1, posizione_bobina_2, ...]
    // Prima le sigillate, poi le aperte
    let spoolsLocations = f.spools_locations || [];
    
    // Se non esiste o ha lunghezza diversa, crea array di default
    if (!Array.isArray(spoolsLocations) || spoolsLocations.length !== totalSpools) {
      // Se c'è una posizione globale, usala come default per tutte le bobine
      const defaultLocation = f.location || "";
      spoolsLocations = Array(totalSpools).fill(defaultLocation);
    }
    
    // Carica varianti/colori esistenti o crea array di default
    // spools_variants è un array: [colore_bobina_1, colore_bobina_2, ...]
    // Prima le sigillate, poi le aperte
    let spoolsVariants = f.spools_variants || [];
    
    // Se non esiste o ha lunghezza diversa, crea array di default
    if (!Array.isArray(spoolsVariants) || spoolsVariants.length !== totalSpools) {
      // Usa il colore principale come default per tutte le bobine
      const defaultVariant = f.variant || "";
      spoolsVariants = Array(totalSpools).fill(defaultVariant);
    } else {
      // Assicurati che tutte le bobine abbiano un colore (riempi con il colore principale se vuoto)
      for (let i = 0; i < spoolsVariants.length; i++) {
        if (!spoolsVariants[i] || spoolsVariants[i].trim() === "") {
          spoolsVariants[i] = f.variant || "";
        }
      }
    }
    
    // Gestione lista bobine sigillate individuali
    const sealedSpoolsList = document.getElementById("editSealedSpoolsList");
    const sealedSpoolsListContainer = document.getElementById("editSealedSpoolsListContainer");
    
    // Gestione lista bobine aperte individuali
    const openSpoolsList = document.getElementById("editOpenSpoolsList");
    const openSpoolsListContainer = document.getElementById("editOpenSpoolsListContainer");
    
    // Carica frazioni esistenti o crea array di default
    // IMPORTANTE: crea una copia dell'array per non modificare l'originale
    let openSpoolsFractions = Array.isArray(f.open_spools_fractions) 
      ? [...f.open_spools_fractions] 
      : [];
    
    // Se l'array esiste ma ha lunghezza diversa, aggiungi o usa solo i valori necessari
    if (openSpoolsFractions.length !== openSpools) {
      if (openSpoolsFractions.length === 0 && openSpools > 0) {
        // Se non esiste l'array, prova la migrazione da vecchio sistema
        if (f.main_fraction != null && f.finished_spools != null) {
          const finished = f.finished_spools || 0;
          const nonFinished = openSpools - finished;
          // Aggiungi bobine finite (frazione 0)
          for (let i = 0; i < finished; i++) {
            openSpoolsFractions.push(0);
          }
          // Aggiungi bobine non finite: una con main_fraction, le altre piene
          if (nonFinished > 0) {
            openSpoolsFractions.push(f.main_fraction || 1);
            for (let i = 1; i < nonFinished; i++) {
              openSpoolsFractions.push(1);
            }
          }
        } else {
          // Array di default: tutte piene
          openSpoolsFractions = Array(openSpools).fill(1);
        }
      } else if (openSpoolsFractions.length < openSpools) {
        // Se l'array è più corto, aggiungi valori di default solo per le nuove bobine
        while (openSpoolsFractions.length < openSpools) {
          openSpoolsFractions.push(1);
        }
      }
      // Se l'array è più lungo, useremo solo i primi openSpools elementi (non rimuoviamo)
    }
    
    // Funzione per renderizzare la lista delle bobine sigillate
    function renderSealedSpoolsList() {
      if (!sealedSpoolsListContainer) return;
      
      const currentSealed = parseInt(spoolsSealedInput?.value || "0", 10);
      
      if (currentSealed === 0) {
        if (sealedSpoolsList) sealedSpoolsList.style.display = "none";
        return;
      }
      
      if (sealedSpoolsList) sealedSpoolsList.style.display = "block";
      
      // Assicurati che l'array delle posizioni abbia la lunghezza corretta
      const currentTotal = currentSealed + parseInt(spoolsOpenInput?.value || "0", 10);
      while (spoolsLocations.length < currentTotal) {
        spoolsLocations.push("");
      }
      while (spoolsLocations.length > currentTotal) {
        spoolsLocations.pop();
      }
      
      sealedSpoolsListContainer.innerHTML = "";
      
      for (let i = 0; i < currentSealed; i++) {
        const spoolDiv = document.createElement("div");
        spoolDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; background: var(--surface-soft); border-radius: 0.25rem;";
        
        const labelText = document.createElement("span");
        labelText.style.cssText = "font-size: 0.8rem; font-weight: 500;";
        labelText.textContent = `Bobina sigillata ${i + 1}`;
        spoolDiv.appendChild(labelText);
        
        const controlsDiv = document.createElement("div");
        controlsDiv.style.cssText = "display: flex; gap: 0.5rem;";
        
        // Select per posizione
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
          spoolsLocations[index] = locationSelect.value.trim();
        });
        
        locationLabel.appendChild(locationLabelText);
        locationLabel.appendChild(locationSelect);
        controlsDiv.appendChild(locationLabel);
        
        // Select per colore
        const colorLabel = document.createElement("label");
        colorLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        const colorLabelText = document.createElement("span");
        colorLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        colorLabelText.textContent = "Colore:";
        
        const colorSelectContainer = document.createElement("div");
        colorSelectContainer.id = `spool-color-${i}`;
        colorSelectContainer.style.cssText = "width: 100%;";
        colorSelectContainer.dataset.spoolIndex = i;
        colorSelectContainer.dataset.spoolType = "sealed";
        
        // Crea dropdown colore per questa bobina
        createColorDropdown(`spool-color-${i}`, {
          initialValue: spoolsVariants[i] || f.variant || "",
          brandHint: f.brand,
          onSelect: (newColor) => {
            const index = parseInt(colorSelectContainer.dataset.spoolIndex, 10);
            spoolsVariants[index] = newColor || f.variant || "";
          }
        });
        
        colorLabel.appendChild(colorLabelText);
        colorLabel.appendChild(colorSelectContainer);
        controlsDiv.appendChild(colorLabel);
        
        spoolDiv.appendChild(controlsDiv);
        sealedSpoolsListContainer.appendChild(spoolDiv);
      }
    }
    
    // Funzione per renderizzare la lista delle bobine aperte
    function renderOpenSpoolsList() {
      if (!openSpoolsListContainer) return;
      
      const currentSealed = parseInt(spoolsSealedInput?.value || "0", 10);
      const currentOpen = parseInt(spoolsOpenInput?.value || "0", 10);
      
      if (currentOpen === 0) {
        if (openSpoolsList) openSpoolsList.style.display = "none";
        return;
      }
      
      if (openSpoolsList) openSpoolsList.style.display = "block";
      
      // Assicurati che l'array abbia la lunghezza corretta
      // IMPORTANTE: mantieni i valori esistenti, aggiungi solo se necessario
      while (openSpoolsFractions.length < currentOpen) {
        openSpoolsFractions.push(1);
      }
      // Non rimuovere elementi se l'array è più lungo - potrebbe contenere dati importanti
      // Invece, usa solo i primi currentOpen elementi
      
      // Assicurati che l'array delle posizioni abbia la lunghezza corretta
      const currentTotal = currentSealed + currentOpen;
      while (spoolsLocations.length < currentTotal) {
        spoolsLocations.push("");
      }
      while (spoolsLocations.length > currentTotal) {
        spoolsLocations.pop();
      }
      
      openSpoolsListContainer.innerHTML = "";
      
      for (let i = 0; i < currentOpen; i++) {
        const spoolDiv = document.createElement("div");
        spoolDiv.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; background: var(--surface-soft); border-radius: 0.25rem;";
        
        const labelText = document.createElement("span");
        labelText.style.cssText = "font-size: 0.8rem; font-weight: 500;";
        labelText.textContent = `Bobina aperta ${i + 1}`;
        spoolDiv.appendChild(labelText);
        
        const controlsDiv = document.createElement("div");
        controlsDiv.style.cssText = "display: flex; gap: 0.5rem;";
        
        // Select per frazione
        const fractionLabel = document.createElement("label");
        fractionLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        const fractionLabelText = document.createElement("span");
        fractionLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        fractionLabelText.textContent = "Frazione:";
        
        const fractionSelect = document.createElement("select");
        fractionSelect.style.cssText = "width: 100%;";
        fractionSelect.dataset.spoolIndex = i;
        fractionSelect.dataset.fieldType = "fraction";
        
        const fractionOptions = [
          { value: "1", text: "Piena (100%)" },
          { value: "0.9", text: "Quasi piena (~90%)" },
          { value: "0.75", text: "Tre quarti (~75%)" },
          { value: "0.5", text: "Metà (~50%)" },
          { value: "0.25", text: "Un quarto (~25%)" },
          { value: "0.1", text: "Quasi vuota (~10%)" },
          { value: "0", text: "Finita (0%)" }
        ];
        
        fractionOptions.forEach(opt => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.text;
          fractionSelect.appendChild(option);
        });
        
        // Imposta il valore della frazione esistente
        // Usa il valore dall'array se disponibile, altrimenti default a 1
        const currentFraction = (i < openSpoolsFractions.length && openSpoolsFractions[i] !== undefined && openSpoolsFractions[i] !== null) 
          ? openSpoolsFractions[i] 
          : 1;
        
        // Converti in stringa e trova l'opzione corrispondente
        const fractionStr = String(currentFraction);
        const exactMatch = fractionSelect.querySelector(`option[value="${fractionStr}"]`);
        
        if (exactMatch) {
          // Valore esatto trovato, impostalo
          fractionSelect.value = fractionStr;
        } else {
          // Se non c'è corrispondenza esatta, trova l'opzione più vicina
          const fractionNum = parseFloat(currentFraction);
          let closestValue = "1";
          let closestDiff = Math.abs(fractionNum - 1);
          
          fractionOptions.forEach(opt => {
            const optValue = parseFloat(opt.value);
            const diff = Math.abs(fractionNum - optValue);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestValue = opt.value;
            }
          });
          
          fractionSelect.value = closestValue;
          // Aggiorna anche l'array con il valore selezionato per coerenza
          if (i < openSpoolsFractions.length) {
            openSpoolsFractions[i] = parseFloat(closestValue);
          } else {
            openSpoolsFractions.push(parseFloat(closestValue));
          }
        }
        
        fractionSelect.addEventListener("change", () => {
          const index = parseInt(fractionSelect.dataset.spoolIndex, 10);
          openSpoolsFractions[index] = parseFloat(fractionSelect.value);
          updateEditRemainingGrams();
        });
        
        fractionLabel.appendChild(fractionLabelText);
        fractionLabel.appendChild(fractionSelect);
        controlsDiv.appendChild(fractionLabel);
        
        // Select per posizione
        const locationLabel = document.createElement("label");
        locationLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        const locationLabelText = document.createElement("span");
        locationLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        locationLabelText.textContent = "Posizione:";
        
        const locationSelect = document.createElement("select");
        locationSelect.style.cssText = "width: 100%;";
        locationSelect.dataset.spoolIndex = i;
        locationSelect.dataset.spoolType = "open";
        locationSelect.dataset.fieldType = "location";
        
        // L'indice nella lista delle posizioni è currentSealed + i (prima le sigillate, poi le aperte)
        locationSelect.innerHTML = generateLocationOptions(spoolsLocations[currentSealed + i] || "");
        
        locationSelect.addEventListener("change", () => {
          const index = parseInt(locationSelect.dataset.spoolIndex, 10);
          spoolsLocations[currentSealed + index] = locationSelect.value.trim();
        });
        
        locationLabel.appendChild(locationLabelText);
        locationLabel.appendChild(locationSelect);
        controlsDiv.appendChild(locationLabel);
        
        // Select per colore
        const colorLabel = document.createElement("label");
        colorLabel.style.cssText = "margin: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem;";
        const colorLabelText = document.createElement("span");
        colorLabelText.style.cssText = "font-size: 0.75rem; color: var(--text-muted);";
        colorLabelText.textContent = "Colore:";
        
        const colorSelectContainer = document.createElement("div");
        colorSelectContainer.id = `spool-color-open-${i}`;
        colorSelectContainer.style.cssText = "width: 100%;";
        colorSelectContainer.dataset.spoolIndex = i;
        colorSelectContainer.dataset.spoolType = "open";
        
        // L'indice nella lista delle varianti è currentSealed + i (prima le sigillate, poi le aperte)
        const spoolVariantIndex = currentSealed + i;
        const currentSpoolVariant = spoolsVariants[spoolVariantIndex] || f.variant || "";
        
        // Crea dropdown colore per questa bobina
        createColorDropdown(`spool-color-open-${i}`, {
          initialValue: currentSpoolVariant,
          brandHint: f.brand,
          onSelect: (newColor) => {
            const index = parseInt(colorSelectContainer.dataset.spoolIndex, 10);
            spoolsVariants[currentSealed + index] = newColor || f.variant || "";
          }
        });
        
        colorLabel.appendChild(colorLabelText);
        colorLabel.appendChild(colorSelectContainer);
        controlsDiv.appendChild(colorLabel);
        
        spoolDiv.appendChild(controlsDiv);
        openSpoolsListContainer.appendChild(spoolDiv);
      }
    }
    
    // Renderizza le liste iniziali
    // Mostra/nascondi la sezione posizioni individuali in base al numero di bobine
    const spoolsLocationsList = document.getElementById("editSpoolsLocationsList");
    if (spoolsLocationsList) {
      if (totalSpools > 1) {
        spoolsLocationsList.style.display = "block";
      } else {
        spoolsLocationsList.style.display = "none";
      }
    }
    
    renderSealedSpoolsList();
    renderOpenSpoolsList();
    
    // Listener per aggiornare le liste quando cambiano i numeri di bobine
    const updateSpoolsLists = () => {
      renderSealedSpoolsList();
      renderOpenSpoolsList();
      updateEditRemainingGrams();
    };
    
    if (spoolsSealedInput) {
      spoolsSealedInput.removeEventListener("input", updateSpoolsLists);
      spoolsSealedInput.removeEventListener("change", updateSpoolsLists);
      spoolsSealedInput.addEventListener("input", updateSpoolsLists);
      spoolsSealedInput.addEventListener("change", updateSpoolsLists);
    }
    
    if (spoolsOpenInput) {
      spoolsOpenInput.removeEventListener("input", updateSpoolsLists);
      spoolsOpenInput.removeEventListener("change", updateSpoolsLists);
      spoolsOpenInput.addEventListener("input", updateSpoolsLists);
      spoolsOpenInput.addEventListener("change", updateSpoolsLists);
    }
    
    // Nascondi i vecchi campi (finished_spools e main_fraction)
    if (finishedSpoolsLabel) finishedSpoolsLabel.style.display = "none";
    if (spoolFractionLabel) spoolFractionLabel.style.display = "none";
    
    // Salva gli array in variabili globali per poterli usare in applyEditFilament
    window.currentOpenSpoolsFractions = openSpoolsFractions;
    window.currentSpoolsLocations = spoolsLocations;
    window.currentSpoolsVariants = spoolsVariants;
    
    updateEditRemainingGrams();

    openModalCentered("editFilamentModal");
  }
  
  function updateEditRemainingGrams() {
    const unitWeightInput = document.getElementById("editUnitWeightInput");
    const spoolsSealedInput = document.getElementById("editSpoolsSealed");
    const spoolsOpenInput = document.getElementById("editSpoolsOpen");
    const spoolFractionSelect = document.getElementById("editSpoolFraction");
    const finishedSpoolsInput = document.getElementById("editFinishedSpools");
    const spoolsTotalInput = document.getElementById("editSpoolsTotal");
    const remainingEl = document.getElementById("editRemainingGrams");
    
    const unitWeight = parseInt(unitWeightInput?.value) || 1000;
    const sealed = parseInt(spoolsSealedInput?.value) || 0;
    const open = parseInt(spoolsOpenInput?.value) || 0;
    const finished = parseInt(finishedSpoolsInput?.value || "0", 10);
    const fraction = parseFloat(spoolFractionSelect?.value || "1");
    
    // Se non ci sono bobine aperte, disabilita e resetta la frazione
    if (spoolFractionSelect) {
      if (open === 0) {
        spoolFractionSelect.disabled = true;
        spoolFractionSelect.value = "1"; // Resetta a 1 (piena) quando non ci sono bobine aperte
      } else {
        spoolFractionSelect.disabled = false;
      }
    }
    
    // Aggiorna totale
    if (spoolsTotalInput) spoolsTotalInput.value = sealed + open;
    
    // Calcola grammi residui usando l'array delle frazioni
    let remaining = 0;
    
    // Bobine sigillate = piene
    if (sealed > 0) {
      remaining += sealed * unitWeight;
    }
    
    // Bobine aperte: usa l'array delle frazioni
    if (open > 0 && window.currentOpenSpoolsFractions) {
      const fractions = window.currentOpenSpoolsFractions;
      for (let i = 0; i < Math.min(open, fractions.length); i++) {
        const fraction = typeof fractions[i] === "number" ? fractions[i] : 1;
        remaining += fraction * unitWeight;
      }
    }
    
    if (remainingEl) {
      remainingEl.textContent = remaining.toLocaleString("it-IT", {
        maximumFractionDigits: 0
      });
    }
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
    closeModalCentered("editFilamentModal");
  }

  function applyEditFilament() {
    try {
    const hiddenId = document.getElementById("editFilamentId");
    const colorCustom = document.getElementById("editColorCustom");
    const colorCodeInput = document.getElementById("editColorCodeInput");
    const unitWeightInput = document.getElementById("editUnitWeightInput");
    const packagingSelect = document.getElementById("editPackagingType");
    const priceInput = document.getElementById("editPriceInput");
    const supplierInput = document.getElementById("editSupplierInput");
    const locationInput = document.getElementById("editLocationInput");
    const notesInput = document.getElementById("editNotesInput");
    
    // Campi bobine
    const spoolsSealedInput = document.getElementById("editSpoolsSealed");
    const spoolsOpenInput = document.getElementById("editSpoolsOpen");
    const spoolFractionSelect = document.getElementById("editSpoolFraction");
    const finishedSpoolsInput = document.getElementById("editFinishedSpools");

    const filamentId = hiddenId.value;
    const f = filaments.find((x) => x.id === filamentId);
    if (!f) {
      showToast("Filamento non trovato.", "error");
      return;
    }

    // Salva stato per undo
    saveStateForUndo(`Modificato filamento: ${canonicalizeBrand(f.brand)} – ${f.material} – ${f.variant}`);

    // Get color from dropdown personalizzato o custom input
    let newVariant = "";
    const dropdownValue = window.editColorDropdown ? window.editColorDropdown.getValue() : "";
    
    // Se l'input custom è visibile e ha un valore, usa quello (ha priorità)
    if (colorCustom && colorCustom.style.display !== "none" && colorCustom.value.trim()) {
      newVariant = colorCustom.value.trim();
    }
    // Altrimenti, se c'è un valore nel dropdown (e non è __custom__)
    else if (dropdownValue && dropdownValue !== "__custom__" && dropdownValue.trim() !== "") {
      newVariant = dropdownValue.trim();
    }
    // Se ancora non c'è un valore, mantieni il valore originale
    else {
      newVariant = f.variant || "";
    }
    
    // Verifica che il colore non sia vuoto
    if (!newVariant || newVariant.trim() === "") {
      showToast("Il colore/variante è obbligatorio.", "error");
      return;
    }

    const newColorCode = colorCodeInput ? colorCodeInput.value.trim() : "";
    const newUnitWeight = parseInt(unitWeightInput ? unitWeightInput.value || "1000" : "1000", 10);
    const newPackaging = packagingSelect ? packagingSelect.value || "spool" : "spool";
    const newPrice = priceInput && priceInput.value ? parseFloat(priceInput.value) : null;
    const newSupplier = supplierInput ? supplierInput.value.trim() : "";
    // Non usare più il campo posizione globale, usa solo le posizioni individuali
    const newNotes = notesInput ? notesInput.value.trim() : "";
    
    // Valori bobine
    const newSealed = parseInt(spoolsSealedInput?.value || "0", 10);
    const newOpen = parseInt(spoolsOpenInput?.value || "0", 10);

    if (newUnitWeight <= 0) {
      showToast("I grammi per bobina devono essere maggiori di 0.", "error");
      return;
    }

    // Update filament properties
    f.variant = newVariant;
    f.color_code = newColorCode;
    f.unit_weight_g = newUnitWeight;
    f.packaging_type = newPackaging;
    f.unit_price = newPrice;
    f.supplier = newSupplier;
    // f.location viene aggiornato automaticamente dalle posizioni individuali (vedi sotto)
    f.notes = newNotes;
    
    // Update spool counts
    f.sealed_spools = newSealed;
    f.open_spools = newOpen;
    f.spools_total = newSealed + newOpen;
    
    // Salva l'array delle frazioni delle bobine aperte
    if (window.currentOpenSpoolsFractions && newOpen > 0) {
      f.open_spools_fractions = window.currentOpenSpoolsFractions.slice(0, newOpen);
      // Calcola main_fraction come la frazione più bassa (per retrocompatibilità)
      f.main_fraction = Math.min(...f.open_spools_fractions);
    } else {
      f.open_spools_fractions = [];
      f.main_fraction = 1;
    }
    
    // Salva l'array delle posizioni per ogni bobina
    if (window.currentSpoolsLocations) {
      const totalSpools = newSealed + newOpen;
      f.spools_locations = window.currentSpoolsLocations.slice(0, totalSpools);
      
      // Mantieni anche il campo location per retrocompatibilità (prima posizione non vuota o vuota)
      const firstLocation = f.spools_locations.find(loc => loc && loc.trim() !== "") || "";
      f.location = firstLocation;
    } else {
      // Se non ci sono posizioni individuali, mantieni quelle esistenti o crea array vuoto
      if (!f.spools_locations || !Array.isArray(f.spools_locations)) {
        f.spools_locations = Array(newSealed + newOpen).fill("");
      }
      // Mantieni la posizione esistente per retrocompatibilità
      f.location = f.location || "";
    }
    
    // Salva l'array delle varianti/colori per ogni bobina
    if (window.currentSpoolsVariants) {
      const totalSpools = newSealed + newOpen;
      f.spools_variants = window.currentSpoolsVariants.slice(0, totalSpools);
      
      // Mantieni anche il campo variant principale per retrocompatibilità (prima variante o quella principale)
      // Se tutte le bobine hanno lo stesso colore, usa quello, altrimenti usa il primo
      const uniqueVariants = [...new Set(f.spools_variants.filter(v => v && v.trim() !== ""))];
      if (uniqueVariants.length === 1) {
        f.variant = uniqueVariants[0];
      } else if (f.spools_variants.length > 0 && f.spools_variants[0]) {
        f.variant = f.spools_variants[0];
      }
    } else {
      // Se non ci sono varianti individuali, mantieni quelle esistenti o crea array con il colore principale
      if (!f.spools_variants || !Array.isArray(f.spools_variants)) {
        f.spools_variants = Array(newSealed + newOpen).fill(newVariant || f.variant || "");
      }
    }
    
    // Rimuovi i vecchi campi se esistono (migrazione)
    if (f.finished_spools !== undefined) delete f.finished_spools;

    // Recalculate weights
    f.total_weight_g = f.spools_total * f.unit_weight_g;
    recalcWeightsForFilament(f);

    // Add new color to list if not present
    if (newVariant && !colorList.includes(newVariant)) {
      colorList.push(newVariant);
      colorList = Array.from(new Set(colorList));
      localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));
    }

    saveState();
    renderAll();
    closeEditFilamentModal();
    showToast("Filamento modificato con successo.", "success");
    } catch (error) {
      console.error("Errore nel salvataggio del filamento:", error);
      showToast("Errore nel salvataggio: " + (error.message || "Errore sconosciuto"), "error");
    }
  }

  // --- Add Purchased Filament Manually ---
  function handleAddPurchasedFilament() {
    const dateInput = document.getElementById("addPurchasedDate");
    const brandSelect = document.getElementById("addPurchasedBrand");
    const brandCustomInput = document.getElementById("addPurchasedBrandCustom");
    const materialInput = document.getElementById("addPurchasedMaterial");
    const variantInput = document.getElementById("addPurchasedVariant");
    const colorCodeInput = document.getElementById("addPurchasedColorCode");
    const packagingSelect = document.getElementById("addPurchasedPackaging");
    const qtyInput = document.getElementById("addPurchasedQty");
    const weightInput = document.getElementById("addPurchasedWeight");
    const priceInput = document.getElementById("addPurchasedPrice");

    let brand = brandSelect.value;
    if (brand === "__custom__") {
      brand = brandCustomInput.value.trim();
    }
    brand = canonicalizeBrand(brand);

    const orderDate = dateInput.value || new Date().toISOString().slice(0, 10);
    const material = materialInput.value.trim();
    const variant = variantInput.value.trim();
    const colorCode = colorCodeInput.value.trim();
    const packaging = packagingSelect.value || "spool";
    const qty = parseInt(qtyInput.value || "1", 10);
    const unitWeight = parseInt(weightInput.value || "1000", 10);
    const unitPrice = priceInput.value ? parseFloat(priceInput.value) : null;

    if (!brand) {
      showToast("Seleziona o inserisci una marca.", "error");
      return;
    }
    if (!material) {
      showToast("Inserisci un materiale.", "error");
      return;
    }
    if (qty <= 0) {
      showToast("La quantità deve essere almeno 1.", "error");
      return;
    }

    const entry = {
      id: `manual-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
      order_number: "Manuale",
      order_date: orderDate,
      brand,
      material,
      variant,
      color_code: colorCode,
      packaging_type: packaging,
      quantity_spools: qty,
      unit_weight_g: unitWeight,
      unit_price: unitPrice
    };

    purchasedFilaments.push(entry);

    // Add to lists if new
    if (brand && !brandList.includes(brand)) {
      brandList.push(brand);
      brandList = cleanBrandList(brandList);
      localStorage.setItem(BRAND_LIST_KEY, JSON.stringify(brandList));
      renderBrandOptions();
    }
    if (material && !materialList.includes(material)) {
      materialList.push(material);
      materialList = Array.from(new Set(materialList));
      localStorage.setItem(MATERIAL_LIST_KEY, JSON.stringify(materialList));
      renderMaterialOptions();
    }
    if (variant && !colorList.includes(variant)) {
      colorList.push(variant);
      colorList = Array.from(new Set(colorList));
      localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));
    }

    saveState();
    renderPurchasedTable();
    
    // Reset form
    dateInput.value = "";
    brandSelect.value = "";
    brandCustomInput.value = "";
    brandCustomInput.style.display = "none";
    materialInput.value = "";
    variantInput.value = "";
    colorCodeInput.value = "";
    packagingSelect.value = "spool";
    qtyInput.value = "1";
    weightInput.value = "1000";
    priceInput.value = "";

    showToast("Filamento aggiunto ai comprati.", "success");
  }

  function deleteFilament(filamentId) {
    const f = filaments.find((x) => x.id === filamentId);
    if (!f) return;
    const ok = confirm(
      `Vuoi davvero eliminare il filamento ${canonicalizeBrand(
        f.brand
      )} – ${f.material} – ${f.variant}?`
    );
    if (!ok) return;

    // Salva stato per undo
    saveStateForUndo(`Eliminato filamento: ${canonicalizeBrand(f.brand)} – ${f.material} – ${f.variant}`);

    filaments = filaments.filter((x) => x.id !== filamentId);
    saveState();
    renderAll();
    showToast("Filamento eliminato.", "success");
  }

  function deleteSelectedFilaments() {
    const checkboxes = document.querySelectorAll(
      ".filament-select-checkbox:checked"
    );
    if (!checkboxes.length) {
      showToast("Nessun filamento selezionato.", "error");
      return;
    }

    const ids = Array.from(checkboxes).map((cb) =>
      cb.getAttribute("data-id")
    );

    const count = ids.length;
    const ok = confirm(
      `Vuoi davvero eliminare ${count} filamento/i selezionati?`
    );
    if (!ok) return;

    // Salva stato per undo
    saveStateForUndo(`Eliminati ${count} filamento/i selezionati`);

    filaments = filaments.filter((f) => !ids.includes(f.id));
    saveState();
    renderAll();

    const selectAll = document.getElementById("selectAllFilaments");
    if (selectAll) selectAll.checked = false;

    showToast("Filamenti selezionati eliminati.", "success");
  }

  function exportJson() {
    saveState();
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const data = JSON.parse(raw);
    
    // Recupera prezzi mancanti dalle fatture importate (solo per l'export, non modifica i dati in memoria)
    const filamentsWithPrices = (data.filaments || []).map(f => {
      // Se ha già un prezzo, lascialo così
      if (f.unit_price != null && f.unit_price > 0) {
        return f;
      }
      
      // Cerca un match nelle fatture importate
      const fBrand = canonicalizeBrand(f.brand || "");
      const fMaterial = canonicalizeMaterial(f.material || "");
      const fVariant = (f.variant || "").trim();
      const fColorCode = (f.color_code || "").trim();
      
      // Cerca in purchasedFilaments un match
      const match = purchasedFilaments.find(p => {
        const pBrand = canonicalizeBrand(p.brand || "");
        const pMaterial = canonicalizeMaterial(p.material || "");
        const pVariant = (p.variant || "").trim();
        const pColorCode = (p.color_code || "").trim();
        
        // Match per brand, material, variant e color_code
        const brandMatch = pBrand === fBrand;
        const materialMatch = pMaterial === fMaterial;
        const variantMatch = pVariant.toLowerCase() === fVariant.toLowerCase();
        const colorCodeMatch = !fColorCode || !pColorCode || pColorCode === fColorCode;
        
        return brandMatch && materialMatch && variantMatch && colorCodeMatch && 
               p.unit_price != null && p.unit_price > 0;
      });
      
      // Se trovo un match con prezzo, aggiungilo al filamento nell'export
      if (match && match.unit_price != null) {
        return {
          ...f,
          unit_price: match.unit_price
        };
      }
      
      return f;
    });
    
    // Aggiungi metadati export con identificatore tipo file
    const exportData = {
      ...data,
      filaments: filamentsWithPrices, // Usa i filamenti con prezzi recuperati
      file_type: "database_backup", // Identificatore per database completo
      export_version: APP_VERSION,
      export_date: new Date().toISOString(),
      description: "Backup completo: magazzino disponibili + filamenti comprati"
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    // Estrai il numero di versione (es. "V.36" -> "36")
    const versionNumber = APP_VERSION.replace(/[^0-9]/g, '');
    // Nome file nel formato: registro_filamenti_YYYY-MM-DD_V[numero].json
    a.download = `registro_filamenti_${date}_V${versionNumber}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(
      "Database completo esportato (magazzino disponibili + comprati).",
      "success"
    );
  }

  // Funzione per esportare solo le fatture importate
  function exportInvoicesJson() {
    if (!purchasedFilaments || purchasedFilaments.length === 0) {
      showToast("Nessuna fattura importata da esportare.", "info");
      return;
    }

    // Raggruppa per ordine
    const ordersMap = new Map();
    purchasedFilaments.forEach(p => {
      const orderNum = p.order_number || "unknown";
      if (!ordersMap.has(orderNum)) {
        ordersMap.set(orderNum, {
          orderNumber: orderNum,
          orderDate: p.order_date || "",
          invoiceNumber: p.order_number || "",
          invoiceDate: p.order_date || "",
          items: []
        });
      }
      const order = ordersMap.get(orderNum);
      order.items.push({
        brand: p.brand,
        material: p.material,
        variant: p.variant,
        color_code: p.color_code,
        sku: p.sku || "",
        quantity: p.quantity_spools || 1,
        qty: p.quantity_spools || 1,
        quantity_spools: p.quantity_spools || 1,
        unit_price: p.unit_price,
        subtotal: (p.unit_price || 0) * (p.quantity_spools || 1),
        packaging_type: p.packaging_type || "spool",
        unit_weight_g: p.unit_weight_g
      });
    });

    const orders = Array.from(ordersMap.values());

    const exportData = {
      file_type: "invoices_import", // Identificatore per file fatture
      export_version: APP_VERSION,
      export_date: new Date().toISOString(),
      description: "File fatture per importazione - contiene solo ordini/fatture",
      orders: orders
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    // Estrai il numero di versione (es. "V.35" -> "35")
    const versionNumber = APP_VERSION.replace(/[^0-9]/g, '');
    // Nome file nel formato: fatture_filamenti_YYYY-MM-DD_V[numero].json
    a.download = `fatture_filamenti_${date}_V${versionNumber}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(
      `File fatture esportato (${orders.length} ordini).`,
      "success"
    );
  }

  function setupImportJson() {
    const input = document.getElementById("importJsonInput");
    if (!input) return;
    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);
          pendingPurchasedTransfer = null;

          // Riconoscimento tipo file basato su file_type o struttura
          const fileType = data.file_type;
          const hasFilamentsArray = Array.isArray(data.filaments);
          const hasOrdersArray =
            Array.isArray(data.orders) || Array.isArray(data.invoices);

          // Se ha file_type, usa quello per identificare il tipo
          const isDatabaseBackup = fileType === "database_backup" || 
            (hasFilamentsArray && fileType !== "invoices_import");
          const isInvoicesFile = fileType === "invoices_import" || 
            (hasOrdersArray && !hasFilamentsArray && fileType !== "database_backup");

          if (isDatabaseBackup || (hasFilamentsArray && !isInvoicesFile)) {
            // Import di un file database completo (backup/app)
            console.log("Importazione database backup. Filamenti nel file:", data.filaments?.length || 0);
            
            if (!Array.isArray(data.filaments) || data.filaments.length === 0) {
              showToast("Il file JSON non contiene filamenti validi. Verifica che il file sia corretto.", "error");
              input.value = ""; // Reset input
              return;
            }
            
            const importedFilaments = (data.filaments || []).map((f) => ({
              ...f,
              brand: canonicalizeBrand(f.brand),
              // Assicura che packaging_type e unit_price siano preservati
              packaging_type: f.packaging_type || "spool",
              unit_price: f.unit_price != null ? f.unit_price : null,
              // Assicura che open_spools_fractions sia un array se presente
              open_spools_fractions: Array.isArray(f.open_spools_fractions) ? f.open_spools_fractions : undefined
            }));

            // Recupera prezzi dai filamenti importati per aggiornare quelli esistenti
            const existingFilamentsMap = new Map();
            filaments.forEach(f => {
              const key = `${canonicalizeBrand(f.brand || "")}||${canonicalizeMaterial(f.material || "")}||${(f.variant || "").trim().toLowerCase()}||${(f.color_code || "").trim()}`;
              existingFilamentsMap.set(key, f);
            });

            // Aggiorna i prezzi dei filamenti esistenti con quelli importati
            importedFilaments.forEach(imported => {
              if (imported.unit_price != null && imported.unit_price > 0) {
                const key = `${canonicalizeBrand(imported.brand || "")}||${canonicalizeMaterial(imported.material || "")}||${(imported.variant || "").trim().toLowerCase()}||${(imported.color_code || "").trim()}`;
                const existing = existingFilamentsMap.get(key);
                if (existing && (existing.unit_price == null || existing.unit_price === 0)) {
                  existing.unit_price = imported.unit_price;
                }
              }
            });

            filaments = deduplicateFilamentsByIdentity(importedFilaments);
            console.log("Filamenti dopo deduplicazione:", filaments.length);
            
            // Ricalcola i pesi per tutti i filamenti importati
            filaments.forEach(f => {
              recalcWeightsForFilament(f);
            });
            
            console.log("Filamenti finali prima del salvataggio:", filaments.length);

            if (data.brands) {
              brandList = cleanBrandList(brandList.concat(data.brands || []));
            }
            if (data.materials) {
              materialList = Array.from(
                new Set(data.materials.concat(materialList))
              );
            }
            if (data.colors) {
              colorList = Array.from(new Set(data.colors.concat(colorList)));
            }
            // Preserva i purchasedFilaments esistenti e aggiungi quelli nuovi dal file
            // Solo se il file ha purchasedFilaments con dati, altrimenti mantieni quelli esistenti
            if (Array.isArray(data.purchasedFilaments) && data.purchasedFilaments.length > 0) {
              // Merge: aggiungi i nuovi purchasFilaments a quelli esistenti, evitando duplicati per ID
              const existingIds = new Set(purchasedFilaments.map(p => p.id).filter(Boolean));
              const newPurchasedFromFile = data.purchasedFilaments
                .map((p) => ({
                ...p,
                brand: canonicalizeBrand(p.brand)
                }))
                .filter(p => !p.id || !existingIds.has(p.id)); // Evita duplicati per ID
              
              purchasedFilaments = purchasedFilaments.concat(newPurchasedFromFile);
            }
            // Se il file non ha purchasedFilaments o è vuoto, mantieni quelli esistenti

            localStorage.setItem(
              BRAND_LIST_KEY,
              JSON.stringify(brandList)
            );
            localStorage.setItem(
              MATERIAL_LIST_KEY,
              JSON.stringify(materialList)
            );
            localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));

            saveState();
            
            // Verifica che i filamenti siano stati salvati correttamente
            const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
            console.log("Filamenti salvati in localStorage:", savedState?.filaments?.length || 0);
            console.log("Filamenti in memoria (filaments array):", filaments.length);
            
            // Resetta i filtri per assicurarsi che i filamenti importati siano visibili
            stockFilters = { brand: "", material: "", packaging: "" };
            currentSearch = "";
            const stockBrandFilter = document.getElementById("stockFilterBrand");
            const stockMaterialFilter = document.getElementById("stockFilterMaterial");
            const stockPackagingFilter = document.getElementById("stockFilterPackaging");
            const searchInput = document.getElementById("stockSearchInput");
            if (stockBrandFilter) stockBrandFilter.value = "";
            if (stockMaterialFilter) stockMaterialFilter.value = "";
            if (stockPackagingFilter) stockPackagingFilter.value = "";
            if (searchInput) searchInput.value = "";
            
            renderBrandOptions();
            renderMaterialOptions();
            renderColorOptions();
            renderAll();
            
            // Forza il rendering della tabella
            console.log("Chiamata renderAll completata. Filamenti in memoria:", filaments.length);
            
            const importedFilamentsCount = Array.isArray(data.filaments) ? data.filaments.length : 0;
            const importedPurchasedCount = Array.isArray(data.purchasedFilaments) ? data.purchasedFilaments.length : 0;
            const parts = [];
            if (importedFilamentsCount > 0) {
              parts.push(importedFilamentsCount + " filamenti disponibili");
            }
            if (importedPurchasedCount > 0) {
              parts.push(importedPurchasedCount + " filamenti comprati");
            }
            const summaryText = parts.length
              ? "Importati " + parts.join(" e ") + " dal JSON."
              : "JSON importato: nessun filamento trovato.";
            showToast(summaryText, "success");
          } else if (isInvoicesFile || hasOrdersArray) {
            // Import di un file fatture (ordini)
            const orders = Array.isArray(data.orders)
              ? data.orders
              : data.invoices;

            // Raccogli tutti gli orderNumber già presenti per evitare duplicati
            const existingOrderNumbers = new Set(
              purchasedFilaments
                .map(p => p.order_number)
                .filter(Boolean)
            );

            const newPurchased = [];
            const skippedOrders = [];
            const addedOrders = [];

            orders.forEach((order, orderIndex) => {
              const orderNumber =
                order.orderNumber || order.invoiceNumber || order.number || "";
              const orderDate =
                order.orderDate || order.invoiceDate || order.date || "";
              
              // Controlla se questo ordine è già stato importato
              if (orderNumber && existingOrderNumbers.has(orderNumber)) {
                skippedOrders.push(orderNumber);
                return; // Salta questo ordine
              }
              
              // Aggiungi questo orderNumber ai già importati per evitare duplicati nello stesso file
              if (orderNumber) {
                existingOrderNumbers.add(orderNumber);
                addedOrders.push(orderNumber);
              }
              
              const items = order.items || order.lines || order.products || [];

              items.forEach((item, itemIndex) => {
                let qty =
                  item.quantity_spools != null
                    ? item.quantity_spools
                    : item.quantitySpools != null
                    ? item.quantitySpools
                    : item.qty != null
                    ? item.qty
                    : item.quantity != null
                    ? item.quantity
                    : 1;

                if (typeof qty === "string") {
                  const parsed = parseFloat(qty.replace(",", "."));
                  if (!isNaN(parsed)) qty = parsed;
                }
                if (!qty || qty < 0) qty = 1;

                const brand = canonicalizeBrand(item.brand || order.brand || "");
                const material = canonicalizeMaterial(item.material);
                const variant = item.variant || item.color || "";
                const colorCode = item.color_code || item.colorCode || "";
                
                // Extract price (unit_price or price_per_unit or subtotal/qty or total/qty)
                let unitPrice = null;
                if (item.unit_price != null) {
                  unitPrice = parseFloat(item.unit_price);
                } else if (item.price_per_unit != null) {
                  unitPrice = parseFloat(item.price_per_unit);
                } else if (item.subtotal != null && qty > 0) {
                  // Se c'è subtotal e quantità > 1, divide per la quantità
                  unitPrice = parseFloat(item.subtotal) / qty;
                } else if (item.total != null && qty > 0) {
                  // Se c'è total (prezzo totale) e quantità > 1, divide per la quantità
                  unitPrice = parseFloat(item.total) / qty;
                } else if (item.price != null) {
                  // Se c'è solo price, controlla se è totale o unitario
                  const priceValue = parseFloat(item.price);
                  // Se la quantità è > 1 e il prezzo sembra essere totale (es. > 20€ per più unità), divide
                  if (qty > 1 && priceValue > 20) {
                    unitPrice = priceValue / qty;
                  } else {
                    unitPrice = priceValue;
                  }
                }
                if (isNaN(unitPrice)) unitPrice = null;

                // Extract packaging type (refill or spool)
                let packagingType = item.packaging_type || item.form || null;
                if (!packagingType && item.sku) {
                  // Detect from SKU: SPLFREE = refill, SPL = spool
                  if (item.sku.includes("SPLFREE") || item.sku.toLowerCase().includes("refill")) {
                    packagingType = "refill";
                  } else if (item.sku.includes("SPL")) {
                    packagingType = "spool";
                  }
                }
                if (!packagingType && variant) {
                  // Detect from variant name
                  const varLower = variant.toLowerCase();
                  if (varLower.includes("ricarica") || varLower.includes("refill")) {
                    packagingType = "refill";
                  }
                }

                // Extract unit weight
                let unitWeight = item.unit_weight_g || item.weight_g_per_spool || item.weight_g || null;
                if (!unitWeight && item.sku) {
                  // Try to extract from SKU pattern like 1.75-1000-SPL
                  const weightMatch = item.sku.match(/-(\d+)-(SPL|SPLFREE)/i);
                  if (weightMatch) {
                    unitWeight = parseInt(weightMatch[1], 10);
                  }
                }
                
                // Se non c'è prezzo nel JSON, prova a prenderlo dalla mappa prezzi Bambu Lab
                if (unitPrice == null && item.sku) {
                  const autoPrice = getAutoPrice(item.sku);
                  if (autoPrice != null) {
                    unitPrice = autoPrice;
                  }
                }
                
                // Per pack 10 colori, dividi il prezzo per 10
                if (item.sku && item.sku.includes("PALLET") && qty === 10 && unitPrice != null) {
                  // Il prezzo nel JSON potrebbe essere il totale, quindi assicuriamoci sia per singola bobina
                  if (unitPrice > 50) { // Se è > 50 probabilmente è il totale
                    unitPrice = unitPrice / 10;
                  }
                }

                const entry = {
                  id:
                    item.id ||
                    `inv-${Date.now().toString(16)}-${orderIndex}-${itemIndex}`,
                  order_number: orderNumber,
                  order_date: orderDate,
                  brand,
                  material,
                  variant,
                  color_code: colorCode,
                  packaging_type: packagingType,
                  quantity_spools: qty,
                  unit_weight_g: unitWeight,
                  unit_price: unitPrice
                };

                newPurchased.push(entry);

                if (brand && !brandList.includes(brand)) brandList.push(brand);
                if (material && !materialList.includes(material))
                  materialList.push(material);
                if (variant && !colorList.includes(variant)) colorList.push(variant);
              });
            });

            brandList = cleanBrandList(brandList);
            materialList = cleanMaterialList(materialList);
            colorList = Array.from(new Set(colorList));

            localStorage.setItem(
              BRAND_LIST_KEY,
              JSON.stringify(brandList)
            );
            localStorage.setItem(
              MATERIAL_LIST_KEY,
              JSON.stringify(materialList)
            );
            localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));

            // Aggiungi i nuovi filamenti a quelli esistenti invece di sostituirli
            purchasedFilaments = purchasedFilaments.concat(newPurchased);

            saveState();
            renderPurchasedTable();
            const ordersCount = Array.isArray(orders) ? orders.length : 0;
            let totalSpools = 0;
            newPurchased.forEach((entry) => {
              const q =
                entry.quantity_spools != null
                  ? entry.quantity_spools
                  : entry.quantitySpools != null
                  ? entry.quantitySpools
                  : 0;
              totalSpools += q;
            });
            
            // Messaggio con informazioni sui duplicati saltati
            let msg = "Importati " +
              newPurchased.length +
              " filamenti comprati da " +
              addedOrders.length +
              " ordine/i (" +
              formatNumber(totalSpools, 0) +
              " bobine totali).";
            
            if (skippedOrders.length > 0) {
              msg += " Saltati " + skippedOrders.length + " ordine/i già presenti: " + 
                skippedOrders.slice(0, 3).join(", ") + 
                (skippedOrders.length > 3 ? "..." : "");
            }
            
            showToast(msg, skippedOrders.length > 0 ? "info" : "success");
          } else {
            showToast(
              "JSON non riconosciuto: manca sia 'filaments' che 'orders'.",
              "error"
            );
          }
        } catch (err) {
          console.error(err);
          showToast("Errore nell'importazione del JSON.", "error");
        } finally {
          input.value = "";
        }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  function clearPurchasedData() {
    const ok = window.confirm(
      "Vuoi davvero cancellare SOLO il magazzino filamenti comprati (dati fatture)?"
    );
    if (!ok) {
      showToast(
        "Operazione annullata: nessun dato è stato cancellato.",
        "info"
      );
      return;
    }

    purchasedFilaments = [];
    saveState();
    renderPurchasedTable();
    renderDashboard();
    closeSettingsModal();
    showToast(
      "Magazzino filamenti comprati cancellato. I filamenti disponibili restano invariati.",
      "success"
    );
  }

  function clearAvailableData() {
    const ok = window.confirm(
      "Vuoi davvero cancellare SOLO il magazzino filamenti disponibili?"
    );
    if (!ok) {
      showToast(
        "Operazione annullata: nessun dato è stato cancellato.",
        "info"
      );
      return;
    }

    filaments = [];
    saveState();
    renderAll();
    closeSettingsModal();
    showToast(
      "Magazzino filamenti disponibili cancellato. I dati delle fatture restano memorizzati.",
      "success"
    );
  }

  function clearAllData() {
    const ok = window.confirm(
      "Vuoi davvero cancellare TUTTI i dati (magazzino disponibile, magazzino comprato e preferenze)?"
    );
    if (!ok) {
      showToast(
        "Operazione annullata: nessun dato è stato cancellato.",
        "info"
      );
      return;
    }

    filaments = [];
    purchasedFilaments = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(BRAND_LIST_KEY);
      localStorage.removeItem(MATERIAL_LIST_KEY);
      localStorage.removeItem(COLOR_LIST_KEY);
    } catch (e) {
      console.error("Errore nella pulizia del localStorage:", e);
    }

    loadState();
    renderBrandOptions();
    renderMaterialOptions();
    renderColorOptions();
    updateColorPreviewFromSelection();
    renderAll();
    closeSettingsModal();

    showToast(
      "Tutti i dati locali dell'app sono stati cancellati. Hai ora un registro vuoto.",
      "success"
    );
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
      localStorage.setItem(BRAND_LIST_KEY, JSON.stringify(brandList));
    }
    if (material && !materialList.includes(material)) {
      materialList.push(material);
      materialList = cleanMaterialList(materialList);
      localStorage.setItem(MATERIAL_LIST_KEY, JSON.stringify(materialList));
    }
    if (variant && !colorList.includes(variant)) {
      colorList.push(variant);
      colorList = Array.from(new Set(colorList));
      localStorage.setItem(COLOR_LIST_KEY, JSON.stringify(colorList));
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
    const saved = localStorage.getItem(LOW_STOCK_THRESHOLD_KEY);
    return saved ? parseFloat(saved) : 25; // Default 25%
  }

  function saveLowStockThreshold(threshold) {
    localStorage.setItem(LOW_STOCK_THRESHOLD_KEY, String(threshold));
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
    return filaments.filter(f => {
      if (!f.total_weight_g || f.total_weight_g === 0) return false;
      const ratio = f.remaining_weight_g / f.total_weight_g;
      return ratio <= (threshold / 100);
    }).sort((a, b) => {
      // Ordina per percentuale residua (dal più basso al più alto)
      const ratioA = a.total_weight_g > 0 ? a.remaining_weight_g / a.total_weight_g : 0;
      const ratioB = b.total_weight_g > 0 ? b.remaining_weight_g / b.total_weight_g : 0;
      return ratioA - ratioB;
    });
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
      const ratio = f.total_weight_g > 0 ? f.remaining_weight_g / f.total_weight_g : 0;
      const percentage = Math.round(ratio * 100);
      
      const item = document.createElement("div");
      item.style.cssText = "display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--surface-soft); border-radius: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid #ef4444;";
      
      const colorHex = getColorHex(f.variant);
      const pillHtml = getColoredPillHtml(f.variant);
      
      // Barra di progresso
      const barHtml = `
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span style="font-weight: 600;">${canonicalizeBrand(f.brand) || "-"} – ${f.material || "-"}</span>
            <span style="color: var(--text-muted);">${percentage}% residuo</span>
          </div>
          <div style="background: rgba(15, 23, 42, 0.7); border-radius: 999px; overflow: hidden; height: 8px; position: relative;">
            <div style="width: ${percentage}%; height: 100%; background: ${percentage <= 25 ? '#ef4444' : percentage <= 50 ? '#f59e0b' : '#22c55e'}; transition: width 0.3s ease; border-radius: 999px;"></div>
          </div>
          <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-muted);">
            <span>${f.spools_total || 0} bobina${f.spools_total !== 1 ? 'e' : 'a'}</span>
            <span>${formatNumber(f.remaining_weight_g || 0, 0)}g / ${formatNumber(f.total_weight_g || 0, 0)}g</span>
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
    // Carica la versione da localStorage e aggiorna l'UI
    loadVersion();

    initTheme();
    loadState();
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
        openSettingsModal();
        updateHistoryUI(); // Aggiorna la cronologia quando si apre il modal
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
        if (locationList.includes(newLocation)) {
          showToast("Una posizione con questo nome esiste già.", "error");
          return;
        }
        locationList.push(newLocation);
        saveLocationList();
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
      btnCopyDebugInfo.addEventListener("click", () => {
        debugInfoText.select();
        document.execCommand("copy");
        showToast("Informazioni copiate negli appunti!", "success");
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
        
        stockSearchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value || "";
        renderFilamentTable();
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

    document
      .getElementById("filamentTableBody")
      .addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (btn.classList.contains("btn-edit")) {
          openEditFilamentModal(id);
        } else if (btn.classList.contains("btn-delete")) {
          deleteFilament(id);
        }
      });

    document
      .getElementById("modalOverlay")
      .addEventListener("click", () => {
        const settingsModal = document.getElementById("settingsModal");
        const consumptionModal = document.getElementById("consumptionModal");
        if (settingsModal && settingsModal.classList.contains("is-open")) {
          closeSettingsModal();
        } else if (consumptionModal && consumptionModal.classList.contains("is-open")) {
          closeConsumptionModal();
        }
      });
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

    document
      .getElementById("exportJsonButton")
      .addEventListener("click", exportJson);
    
    const exportInvoicesButton = document.getElementById("exportInvoicesButton");
    if (exportInvoicesButton) {
      exportInvoicesButton.addEventListener("click", exportInvoicesJson);
    }
    setupImportJson();

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
          deleteFilament(filamentId);
        }
      });
    }

    // Ricerca e ordinamento per check finale
    const checkFinaleSearchInput = document.getElementById("checkFinaleSearch");
    const checkFinaleSearchClear = document.getElementById("checkFinaleSearchClear");
    
    if (checkFinaleSearchInput) {
      checkFinaleSearchInput.addEventListener("input", (e) => {
        checkFinaleSearchTerm = e.target.value;
        renderCheckFinale();
        // Mostra/nascondi pulsante X
        if (checkFinaleSearchClear) {
          checkFinaleSearchClear.style.display = checkFinaleSearchTerm.trim() ? "flex" : "none";
        }
      });
    }
    
    if (checkFinaleSearchClear) {
      checkFinaleSearchClear.addEventListener("click", () => {
        if (checkFinaleSearchInput) {
          checkFinaleSearchInput.value = "";
          checkFinaleSearchTerm = "";
          renderCheckFinale();
          checkFinaleSearchClear.style.display = "none";
          checkFinaleSearchInput.focus();
        }
      });
    }
    
    // Pulsante toggle per mostrare/nascondere bobine posizionate
    const checkFinaleTogglePlaced = document.getElementById("checkFinaleTogglePlaced");
    if (checkFinaleTogglePlaced) {
      const updateToggleButton = () => {
        const span = checkFinaleTogglePlaced.querySelector("span");
        if (checkFinaleShowPlaced) {
          checkFinaleTogglePlaced.title = "Nascondi bobine già posizionate";
          if (span) span.textContent = "Nascondi posizionate";
        } else {
          checkFinaleTogglePlaced.title = "Mostra bobine già posizionate";
          if (span) span.textContent = "Mostra posizionate";
        }
      };
      
      updateToggleButton();
      
      checkFinaleTogglePlaced.addEventListener("click", () => {
        checkFinaleShowPlaced = !checkFinaleShowPlaced;
        updateToggleButton();
        renderCheckFinale();
      });
    }

    // Sorting for check finale table
    document
      .querySelectorAll("#checkFinaleSection th[data-sort-field]")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const field = th.getAttribute("data-sort-field");
          if (checkFinaleSortState.field === field) {
            checkFinaleSortState.direction =
              checkFinaleSortState.direction === "asc" ? "desc" : "asc";
          } else {
            checkFinaleSortState.field = field;
            checkFinaleSortState.direction = "asc";
          }
          renderCheckFinale();
        });
      });

    // Sorting for spools state table (aggregated)
    document
      .querySelectorAll("#spoolsStateSection th[data-sort-field]")
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

    // Chiudi le modali con ESC per una UX più fluida
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const settingsModal = document.getElementById("settingsModal");
        const consumptionModal = document.getElementById("consumptionModal");
        if (settingsModal && settingsModal.classList.contains("is-open")) {
          closeSettingsModal();
        } else if (consumptionModal && consumptionModal.classList.contains("is-open")) {
          closeConsumptionModal();
        }
      }
    });

    // opzionale: esegue i test interni in console
    runSelfTests();
  });
