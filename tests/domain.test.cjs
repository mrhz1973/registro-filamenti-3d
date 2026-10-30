const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const nodeTest = require("node:test");
const sourcePath = process.env.APP_SOURCE || path.resolve(__dirname, "../app.js");
const source = fs.readFileSync(sourcePath, "utf8");
function element(value = "") {
  return { value: String(value), style: {}, dataset: {}, children: [], events: {}, innerHTML: "", textContent: "",
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; this.innerHTML = ""; },
    addEventListener(type, listener) { this.events[type] = listener; }, removeEventListener() {},
    querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return null; },
    getAttribute() { return null; }, setAttribute() {}, dispatchEvent() {}, focus() {}, select() {} };
}
function setup() {
  const dom = new Map(), store = new Map(), errors = [];
  const context = vm.createContext({
    window: {}, document: { addEventListener() {}, getElementById(id) { return dom.get(id) || null; },
      querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return element(); },
      body: element(), head: element(), documentElement: element() },
    localStorage: { getItem(key) { return store.get(key) || null; }, setItem(key, value) { store.set(key, String(value)); } },
    console: { log() {}, error(...args) { errors.push(args); }, debug() {}, warn() {}, assert(condition, text) { assert.ok(condition, text); } },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, getComputedStyle() { return { getPropertyValue() { return ""; } }; },
    confirm() { return true; }, prompt() { return "1"; }, Event: function () {} });
  vm.runInContext(source, context, { filename: sourcePath });
  const run = code => vm.runInContext(code, context);
  run(`var messages = [];showToast=(...args)=>messages.push(args);renderAll=()=>{};autoSave=()=>{};saveState=()=>{};
    updateHistoryUI=()=>{};playSuccessSound=()=>{};closeAddToStockModal=()=>{};closeConsumptionModal=()=>{};
    closeModalCentered=()=>{};openModalCentered=()=>{};updateEditColorPreview=()=>{};
    renderBrandOptions=()=>{};renderMaterialOptions=()=>{};renderColorOptions=()=>{};updateColorPreviewFromSelection=()=>{};
    renderConsumptionChart=()=>{};renderConsumptionHistory=()=>{};renderConsumptionStats=()=>{};initResizableColumns=()=>{};
    createColorDropdown=(id,options)=>({getValue(){return options.initialValue;},setValue(){}});`);
  const input = (id, value = "") => { const node = element(value); dom.set(id, node); return node; };
  const snapshot = code => JSON.parse(JSON.stringify(run(code)));
  return { run, input, dom, context, snapshot, errors };
}
const base = { id: "f1", brand: "Bambu Lab", material: "PLA", variant: "Bianco", color_code: "", unit_weight_g: 1000,
  spools_total: 1, sealed_spools: 0, open_spools: 1, main_fraction: 1, total_weight_g: 1000,
  remaining_weight_g: 1000, used_weight_g: 0, packaging_type: "spool", unit_price: 20 };
const purchased = { id: "p1", brand: "Bambu Lab", material: "PLA", variant: "Bianco", unit_weight_g: 1000,
  quantity_spools: 2, packaging_type: "spool", unit_price: 20 };
const openingFixture = () => ({ ...base, id: "f1", sealed_spools: 2, open_spools: 1,
  finished_spools: 1, spools_total: 4, spool_state_version: 1, total_weight_g: 4000,
  remaining_weight_g: 2500, used_weight_g: 1500, main_fraction: .5,
  spools_ids: ["ht-sealed", "shelf-sealed", "old-open"],
  spools_locations: ["AMS HT", "Scaffale Top", "Scaffale Medio"],
  spools_variants: ["Nero", "Rosso", "Bianco"], open_spools_fractions: [.5] });
const results = [];
function test(name, callback) { nodeTest(name, () => { callback(); results.push({ name, passed: true }); }); }
function editFields(e) {
  ["editFilamentId", "editColorCustom", "editColorCodeInput", "editUnitWeightInput", "editPackagingType", "editPriceInput",
    "editSupplierInput", "editLocationInput", "editNotesInput", "editSpoolsSealed", "editSpoolsOpen", "editSpoolsTotal",
    "editSpoolFraction", "editFinishedSpools", "editRemainingGrams", "editSealedSpoolsList", "editOpenSpoolsList",
    "editSealedSpoolsListContainer", "editOpenSpoolsListContainer"].forEach(id => e.input(id));
}

test("Aprire una sigillata selezionata conserva identità e proprietà senza mutare la lista originale", () => {
  const e = setup(); e.run(`var originalSpools=[{id:'a',sealed:true,fraction:1,location:'Scaffale',variant:'Rosso'},
    {id:'b',sealed:true,fraction:1,location:'AMS HT',variant:'Nero'}];var openedSpools=openSealedSpools(originalSpools,1,'b');`);
  assert.equal(e.run("openedSpools.length"), 2);
  assert.equal(e.run("originalSpools[1].sealed"), true);
  assert.deepEqual(e.snapshot("openedSpools[1]"), { id: "b", sealed: false, fraction: 1, location: "AMS HT", variant: "Nero" });
  assert.equal(e.run("openedSpools[0].sealed"), true);
  assert.throws(() => e.run("openSealedSpools(originalSpools,3)"), /sigillate/);
});

test("Aumentare Aperte converte la bobina HT e preserva totali, grammi e consumi", () => {
  const e = setup(); editFields(e);
  e.run(`filaments=${JSON.stringify([openingFixture()])};openEditFilamentModal('f1','ht-sealed')`);
  e.dom.get("editSpoolsOpen").value = "2";
  e.dom.get("editSpoolsOpen").onchange();
  assert.equal(e.dom.get("editSpoolsSealed").value, 1);
  assert.equal(e.dom.get("editSpoolsTotal").value, 3);
  e.run("applyEditFilament()");
  const f = e.snapshot("filaments[0]");
  assert.equal(f.sealed_spools, 1); assert.equal(f.open_spools, 2);
  assert.equal(f.spools_total, 4); assert.equal(f.finished_spools, 1);
  assert.equal(f.total_weight_g, 4000); assert.equal(f.remaining_weight_g, 2500); assert.equal(f.used_weight_g, 1500);
  assert.equal(f.variant, openingFixture().variant);
  assert.equal(e.run("consumptionHistory.length"), 0);
  assert.deepEqual(f.spools_ids.slice().sort(), ["ht-sealed", "old-open", "shelf-sealed"]);
  const selected = e.snapshot("getActiveFilamentSpools(filaments[0]).find(spool=>spool.id==='ht-sealed')");
  assert.equal(selected.sealed, false); assert.equal(selected.location, "AMS HT"); assert.equal(selected.variant, "Nero");
});

test("Caso due sigillate e zero aperte: apertura HT mantiene due attive e una già terminata", () => {
  const e = setup(); editFields(e);
  const item = { ...openingFixture(), open_spools: 0, spools_total: 3, total_weight_g: 3000,
    remaining_weight_g: 2000, used_weight_g: 1000, main_fraction: 1, open_spools_fractions: [],
    spools_ids: ["ht-sealed", "shelf-sealed"], spools_locations: ["AMS HT", "Scaffale Top"], spools_variants: ["Nero", "Rosso"] };
  e.run(`filaments=${JSON.stringify([item])};openEditFilamentModal('f1','ht-sealed')`);
  e.dom.get("editSpoolsOpen").value = "1"; e.dom.get("editSpoolsOpen").onchange();
  assert.equal(e.dom.get("editSpoolsTotal").value, 2);
  e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].sealed_spools"), 1); assert.equal(e.run("filaments[0].open_spools"), 1);
  assert.equal(e.run("filaments[0].spools_total"), 3); assert.equal(e.run("filaments[0].finished_spools"), 1);
  assert.equal(e.run("filaments[0].remaining_weight_g"), 2000); assert.equal(e.run("filaments[0].total_weight_g"), 3000);
  assert.equal(e.run("consumptionHistory.length"), 0);
});

test("Salva senza evento onchange applica comunque l'apertura senza creare bobine", () => {
  const e = setup(); editFields(e);
  e.run(`filaments=${JSON.stringify([openingFixture()])};openEditFilamentModal('f1','ht-sealed')`);
  e.dom.get("editSpoolsOpen").value = "2"; e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].spools_total"), 4); assert.equal(e.run("filaments[0].sealed_spools"), 1);
  assert.equal(e.run("filaments[0].total_weight_g"), 4000);
});

test("Ridurre prima Sigillate e poi aumentare Aperte non produce una bobina finita aggiuntiva", () => {
  const e = setup(); editFields(e);
  e.run(`filaments=${JSON.stringify([openingFixture()])};openEditFilamentModal('f1','ht-sealed')`);
  e.dom.get("editSpoolsSealed").value = "1"; e.dom.get("editSpoolsSealed").onchange();
  e.dom.get("editSpoolsOpen").value = "2"; e.dom.get("editSpoolsOpen").onchange();
  e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].spools_total"), 4); assert.equal(e.run("filaments[0].finished_spools"), 1);
  assert.equal(e.run("filaments[0].remaining_weight_g"), 2500); assert.equal(e.run("consumptionHistory.length"), 0);
  assert.equal(e.run("getActiveFilamentSpools(filaments[0]).find(x=>x.id==='ht-sealed').sealed"), false);
});

test("Senza sigillate disponibili il contatore non inventa nuove bobine aperte", () => {
  const e = setup(); editFields(e);
  e.run(`filaments=${JSON.stringify([base])};openEditFilamentModal('f1')`);
  e.dom.get("editSpoolsOpen").value = "2"; e.dom.get("editSpoolsOpen").onchange();
  assert.equal(e.dom.get("editSpoolsOpen").value, 1);
  e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].spools_total"), 1); assert.equal(e.run("filaments[0].open_spools"), 1);
  assert.equal(e.run("filaments[0].total_weight_g"), 1000); assert.equal(e.run("consumptionHistory.length"), 0);
});
test("Backup V318: 61 righe, 80 bobine, 64025 g dopo normalizzazione e secondo passaggio", () => {
  const fixturePath = process.env.APP_FIXTURE || path.join(path.dirname(sourcePath), "dati", "registro_filamenti_2026-03-12_V318.json");
  const data = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const e = setup(); e.run(`filaments=${JSON.stringify(data.filaments)};filaments.forEach(recalcWeightsForFilament);`);
  const first = e.snapshot("filaments");
  assert.equal(first.length, 61); assert.equal(first.reduce((sum, f) => sum + f.sealed_spools + f.open_spools, 0), 80);
  assert.equal(first.reduce((sum, f) => sum + f.remaining_weight_g, 0), 64025);
  e.run("filaments.forEach(recalcWeightsForFilament)"); assert.deepEqual(e.snapshot("filaments"), first);
});
test("Dedup preserva 750 g, frazioni, posizioni, colori e identificatori", () => {
  const e = setup();
  const items = [.5, .25].map((fraction, i) => ({ ...base, id: "f" + i, open_spools_fractions: [fraction], remaining_weight_g: fraction * 1000,
    spools_locations: ["Box " + i], spools_variants: [i ? "Rosso" : "Bianco"] }));
  e.run(`filaments=deduplicateFilamentsByIdentity(${JSON.stringify(items)});filaments.forEach(recalcWeightsForFilament)`);
  const [f] = e.snapshot("filaments"); assert.equal(f.remaining_weight_g, 750); assert.equal(f.open_spools, 2);
  assert.deepEqual(f.spools_locations, ["Box 0", "Box 1"]); assert.deepEqual(f.open_spools_fractions, [.5, .25]);
  assert.equal(new Set(f.spools_ids).size, 2);
});
test("Confezioni e prezzi diversi restano distinti", () => {
  const e = setup(); e.run(`filaments=deduplicateFilamentsByIdentity(${JSON.stringify([base, { ...base, id: "f2", packaging_type: "refill", unit_price: 10 }])})`);
  assert.equal(e.run("filaments.length"), 2);
});
test("Migrazione e Apri/Salva senza modifiche mantengono 1500 g", () => {
  const e = setup(); editFields(e);
  e.run(`filaments=${JSON.stringify([{ ...base, sealed_spools: 1, open_spools: 1, spools_total: 2, total_weight_g: 2000, remaining_weight_g: 1500, main_fraction: .5 }])};openEditFilamentModal('f1');applyEditFilament()`);
  assert.equal(e.run("filaments[0].remaining_weight_g"), 1500); assert.equal(e.run("consumptionHistory.length"), 0);
});
test("Modifica residuo e bobina finita conservano massa iniziale e storico", () => {
  const e = setup(); editFields(e);e.run(`filaments=${JSON.stringify([base])};openEditFilamentModal('f1');window.filamentEditSession.spools[0].fraction=.5;applyEditFilament()`);
  assert.equal(e.run("filaments[0].remaining_weight_g"), 500); assert.equal(e.run("consumptionHistory[0].gramsConsumed"), 500);
  e.run("openEditFilamentModal('f1')");
  const container = e.dom.get("editOpenSpoolsListContainer");
  const fraction = container.children[0].children.flatMap(child => child.children || []).find(node => node.dataset.fieldType === "fraction");
  assert.ok(fraction); fraction.value = "0"; fraction.events.change(); e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].finished_spools"), 1); assert.equal(e.run("filaments[0].total_weight_g"), 1000);
  assert.equal(e.run("filaments[0].used_weight_g"), 1000); assert.equal(e.run("filaments[0].open_spools"), 0);
  assert.equal(e.run("consumptionHistory.reduce((sum,item)=>sum+item.gramsConsumed,0)"), 1000);
});
test("Annulla colore non cambia lo stato originale", () => {
  const e = setup(); editFields(e);e.run(`filaments=${JSON.stringify([{ ...base, spools_variants: ["Bianco"] }])};openEditFilamentModal('f1');window.filamentEditSession.spools[0].variant='Rosso';closeEditFilamentModal()`);
  assert.deepEqual(e.snapshot("filaments[0].spools_variants"), ["Bianco"]);
});
test("Quantità negativa rifiutata prima della mutazione", () => {
  const e = setup(); editFields(e);e.run(`filaments=${JSON.stringify([base])};openEditFilamentModal('f1')`);
  const before = e.snapshot("filaments"); e.dom.get("editSpoolsSealed").value = "-1"; e.run("applyEditFilament()");
  assert.deepEqual(e.snapshot("filaments"), before); assert.equal(e.run("messages.at(-1)[1]"), "error");
});
test("Trasferimenti preservano acquisto originale e consumo zero", () => {
  const e = setup();e.run(`purchasedFilaments=${JSON.stringify([purchased])};`);
  assert.equal(e.run("calculateConsumptionByDifference().totals.consumed"), 0);
  e.run("transferPurchasedSpools('p1',1,1,[],20,'')");
  assert.equal(e.run("calculateConsumptionByDifference().totals.consumed"), 0);
  e.run("transferPurchasedSpools('p1',1,1,[],20,'')");
  assert.equal(e.run("purchasedFilaments[0].quantity_spools"), 0);assert.equal(e.run("purchasedFilaments[0].quantity_purchased_original"), 2);
  assert.equal(e.run("calculateConsumptionByDifference().totals.purchased"), 2000);assert.equal(e.run("calculateConsumptionByDifference().totals.consumed"), 0);
  assert.equal(e.run("filaments[0].spools_ids.length"), 2);
});
test("Nuova sigillata non perde la posizione della bobina aperta", () => {
  const e = setup(); const existing={...base, remaining_weight_g:500,open_spools_fractions:[.5],spools_locations:["Box A"],source_purchase_id:"p1"};
  e.run(`filaments=${JSON.stringify([existing])};purchasedFilaments=${JSON.stringify([{...purchased,quantity_spools:1,quantity_purchased_original:2}])};filaments.forEach(recalcWeightsForFilament);transferPurchasedSpools('p1',1,1,[],20,'')`);
  assert.equal(e.run("filaments.length"), 1);const f=e.snapshot("filaments[0]");
  assert.deepEqual(f.spools_locations,["","Box A"]);assert.equal(f.remaining_weight_g,1500);assert.equal(f.spools_total,2);
});
test("Frazioni storiche non standard restano esatte", () => {
  const e=setup(); editFields(e);e.run(`filaments=${JSON.stringify([{...base,remaining_weight_g:377,open_spools_fractions:[.377]}])};openEditFilamentModal('f1');applyEditFilament()`);
  assert.equal(e.run("filaments[0].remaining_weight_g"),377);
});
test("Frazioni mancanti ricostruite dai grammi, zero convertito in finita", () => {
  const e=setup();e.run(`var sample=${JSON.stringify({...base,open_spools:2,spools_total:2,total_weight_g:2000,remaining_weight_g:750,open_spools_fractions:[.5]})};recalcWeightsForFilament(sample)`);
  assert.deepEqual(e.snapshot("sample.open_spools_fractions"),[.5,.25]);
  e.run("sample.open_spools_fractions=[0,.25];recalcWeightsForFilament(sample);recalcWeightsForFilament(sample)");
  assert.equal(e.run("sample.finished_spools"),1);assert.equal(e.run("sample.open_spools"),1);assert.equal(e.run("sample.used_weight_g"),1750);
});
test("Validazione frazioni NaN/negative e prezzo zero", () => {
  const e=setup();e.run(`var sample=${JSON.stringify(base)};sample.open_spools_fractions=[NaN]`);
  assert.throws(()=>e.run("recalcWeightsForFilament(sample)"),/Frazione/);
  e.run(`purchasedFilaments=${JSON.stringify([purchased])};transferPurchasedSpools('p1',1,1,[],0,'')`);assert.equal(e.run("filaments[0].unit_price"),0);
});
test("Errore salvataggio ripristina inventario, acquisto, storico e undo", () => {
  const e=setup(); editFields(e);e.run(`filaments=${JSON.stringify([base])};purchasedFilaments=${JSON.stringify([purchased])};saveState=()=>false;`);
  const before=e.snapshot("({filaments,purchasedFilaments,consumptionHistory,undoStack})");
  assert.equal(e.run("transferPurchasedSpools('p1',1,1,[],20,'')"),false);
  assert.deepEqual(e.snapshot("({filaments,purchasedFilaments,consumptionHistory,undoStack})"),before);
  e.run("openEditFilamentModal('f1');window.filamentEditSession.spools[0].fraction=.5;applyEditFilament()");
  assert.deepEqual(e.snapshot("({filaments,purchasedFilaments,consumptionHistory,undoStack})"),before);
  assert.ok(e.run("window.filamentEditSession"));
  assert.equal(e.run("messages.some(message=>message[1]==='success')"),false);
});
test("Aggiunta manuale a metà senza ReferenceError, totale e tabella coerenti", () => {
  const e=setup();
  e.run("window.addColorDropdown={getValue(){return 'Bianco';},setValue(){}};");
  for(const [id,value] of Object.entries({addBrandSelect:"Bambu Lab",addBrandCustom:"",addMaterialSelect:"PLA",addMaterialCustom:"",
    addColorCustom:"",addColorCodeInput:"",addSpoolsTotalInput:"1",addSealedSpoolsInput:"0",addOpenSpoolsInput:"1",
    addUnitWeightPreset:"1000",addUnitWeightInput:"1000",addPackagingType:"spool",addPriceInput:"0",addSupplierInput:"",addNotesInput:"",addFractionSelect:".5"}))e.input(id,value);
  e.run("handleAddFilament()"); assert.equal(e.run("filaments[0].remaining_weight_g"),500);
  assert.equal(e.run("filaments[0].unit_price"),0);assert.equal(e.dom.get("addOpenSpoolsInput").value,"");
  const table=e.input("filamentTableBody");e.run("renderFilamentTable()");
  assert.ok(table.children[0].innerHTML.includes('>500</td>')); assert.ok(table.children[0].innerHTML.includes("data-spool-ids"));
});
test("Rettifica eliminazione associata ad acquisto non viene conteggiata come consumo",()=>{
  const e=setup();e.run(`purchasedFilaments=${JSON.stringify([{...purchased,quantity_spools:0,quantity_purchased_original:2}])};filaments=${JSON.stringify([{...base,source_purchase_id:"p1",sealed_spools:1,open_spools:0,spools_total:1,total_weight_g:1000,remaining_weight_g:1000,removed_weight_g:1000}])};`);
  assert.equal(e.run("calculateConsumptionByDifference().totals.consumed"),0);
});
test("Consumo attribuito al colore della bobina modificata",()=>{
  const e=setup();editFields(e);e.run(`filaments=${JSON.stringify([{...base,spools_total:2,open_spools:2,total_weight_g:2000,remaining_weight_g:2000,open_spools_fractions:[1,1],spools_variants:["Bianco","Rosso"]}])};openEditFilamentModal('f1');window.filamentEditSession.spools[1].fraction=.5;applyEditFilament()`);
  assert.equal(e.run("consumptionHistory[0].variant"),"Rosso");assert.equal(e.run("consumptionHistory[0].gramsConsumed"),500);
});
test("Bilancio coerente dopo aumento quantità, correzione peso e colore di una bobina acquistata",()=>{
  for(const change of ["quantity","weight","color"]){
    const e=setup();editFields(e);
    e.run(`purchasedFilaments=${JSON.stringify([{...purchased,quantity_spools:1}])};transferPurchasedSpools('p1',1,1,[],20,'');filaments[0].id='f1';openEditFilamentModal('f1')`);
    if(change==="quantity")e.dom.get("editSpoolsSealed").value="2";
    if(change==="weight")e.dom.get("editUnitWeightInput").value="500";
    if(change==="color")e.run("window.filamentEditSession.spools[0].variant='Rosso'");
    e.run("applyEditFilament()");
    assert.equal(e.run("calculateConsumptionByDifference().totals.consumed"),0,change);
    assert.equal(e.run("calculateConsumptionByDifference().results.some(item=>item.consumed_weight_g<0)"),false,change);
    assert.equal(e.run("purchasedFilaments[0].quantity_purchased_original"),1);
  }
});
test("Rifornimento dopo rettifica conserva i consumi pregressi",()=>{
  const e=setup();editFields(e);
  e.run(`filaments=${JSON.stringify([{...base,total_weight_g:1500,remaining_weight_g:500,used_weight_g:1000,removed_weight_g:500,open_spools_fractions:[.5]}])};openEditFilamentModal('f1')`);
  e.dom.get("editSpoolsSealed").value="1";e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].total_weight_g"),2500);assert.equal(e.run("filaments[0].remaining_weight_g"),1500);
  assert.equal(e.run("filaments[0].used_weight_g"),1000);
});
test("Quantità temporanee annullate non creano bobine finite o consumi",()=>{
  const e=setup();editFields(e);e.run(`filaments=${JSON.stringify([base])};openEditFilamentModal('f1')`);
  e.dom.get("editSpoolsSealed").value="1";e.run("window.filamentEditSession.syncCounts()");
  e.dom.get("editSpoolsSealed").value="0";e.run("applyEditFilament()");
  assert.equal(e.run("filaments[0].finished_spools"),0);assert.equal(e.run("filaments[0].spools_total"),1);
  assert.equal(e.run("filaments[0].total_weight_g"),1000);assert.equal(e.run("consumptionHistory.length"),0);
});
test("Colore globale applicato subito; scelta individuale successiva preservata",()=>{
  const e=setup();editFields(e);
  e.run(`window.colorCallbacks={};createColorDropdown=(id,options)=>{window.colorCallbacks[id]=options.onSelect;return {setValue(){},getValue(){return options.initialValue;}};};filaments=${JSON.stringify([{...base,spools_total:2,open_spools:2,total_weight_g:2000,remaining_weight_g:2000,open_spools_fractions:[1,1]}])};openEditFilamentModal('f1');window.colorCallbacks.editColorDropdownContainer('Rosso');window.colorCallbacks['edit-spool-color-'+window.filamentEditSession.spools[1].id]('Blu');applyEditFilament()`);
  assert.deepEqual(e.snapshot("filaments[0].spools_variants"),["Rosso","Blu"]);
});
test("Colore personalizzato individuale: testo valido, annulla e vuoto",()=>{
  for(const response of ["  Magenta custom  ",null," "]){
    const e=setup();editFields(e);e.context.prompt=()=>response;
    e.run(`window.colorCallbacks={};createColorDropdown=(id,options)=>{window.colorCallbacks[id]=options.onSelect;return {setValue(){},getValue(){return options.initialValue;}};};filaments=${JSON.stringify([base])};openEditFilamentModal('f1');window.colorCallbacks['edit-spool-color-'+window.filamentEditSession.spools[0].id]('__custom__');applyEditFilament()`);
    assert.deepEqual(e.snapshot("filaments[0].spools_variants"),[response?.trim() || "Bianco"]);
    assert.equal(e.run("colorList.includes('__custom__')"),false);
  }
});
