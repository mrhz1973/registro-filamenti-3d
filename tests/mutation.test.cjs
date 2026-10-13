const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = process.env.APP_SOURCE || path.resolve(__dirname, "../app.js");
const source = fs.readFileSync(appPath, "utf8");
const KEY = "registroFilamentiState_v3";

function harness() {
  const storage = new Map(), nodes = new Map(), messages = [];
  let fail = false;
  function element() {
    const listeners = {}, attrs = {};
    return {
      style: {}, dataset: {}, value: "", children: [],
      set innerHTML(value) { this.markup = value; this.children = []; }, get innerHTML() { return this.markup; },
      addEventListener(name, callback) { listeners[name] = callback; },
      appendChild(child) { this.children.push(child); },
      click() { if (listeners.click) listeners.click({ preventDefault() {}, stopPropagation() {} }); },
      remove() {}, querySelectorAll() { return []; }, setAttribute(name, value) { attrs[name] = value; }, getAttribute(name) { return attrs[name] || null; }
    };
  }
  const documentElement = element();
  const ctx = vm.createContext({
    console: { log() {}, error() {}, warn() {}, debug() {}, assert() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { if (fail && key === KEY) throw new Error("QuotaExceededError"); storage.set(key, String(value)); }, removeItem: key => storage.delete(key) },
    document: { addEventListener() {}, getElementById: id => nodes.get(id) || null, createElement: element, querySelector() { return null; }, querySelectorAll() { return []; }, body: element(), head: element(), documentElement },
    window: { addEventListener() {}, confirm() { return true; } },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {}, alert() {}, messages
  });
  vm.runInContext(source, ctx, { filename: appPath });
  const run = code => vm.runInContext(code, ctx);
  run(`showToast=(message,type)=>messages.push({message,type});updateAutoSaveIndicator=()=>{};updateHistoryUI=()=>{};
    renderAll=()=>{};renderBrandOptions=()=>{};renderMaterialOptions=()=>{};renderColorOptions=()=>{};populateFilterOptions=()=>{};
    renderConsumptionChart=()=>{};renderConsumptionHistory=()=>{};renderConsumptionStats=()=>{};loadState();
    filaments=[{id:'f1',brand:'Test',material:'PLA',variant:'Test',unit_weight_g:1000,sealed_spools:1,open_spools:0,spools_total:1,total_weight_g:1000,location:'Ripiano',spools_locations:['Ripiano']}];
    recalcWeightsForFilament(filaments[0]);locationList=['Ripiano'];consumptionHistory=[{id:'c1',timestamp:'2026-10-14T12:00:00Z',gramsConsumed:100}];saveState();`);
  return { run, storage, messages, documentElement, node(id) { const node = element(); nodes.set(id, node); return node; }, fail() { fail = true; } };
}

test("rinomina posizione aggiorna elenco e bobine in una transazione reversibile", () => {
  const t = harness(), list = t.node("locationsListContainer");
  t.run("renderLocationsList()");
  const [input, rename] = list.children[0].children;
  input.value = "Nuovo ripiano";
  rename.click();
  const saved = JSON.parse(t.storage.get(KEY));
  assert.deepEqual(saved.locations, ["Nuovo ripiano"]);
  assert.deepEqual(saved.filaments[0].spools_locations, ["Nuovo ripiano"]);
  t.run("undoAction()");
  assert.equal(t.run("locationList[0]"), "Ripiano");
  assert.equal(t.run("filaments[0].spools_locations[0]"), "Ripiano");
});

test("rinomina posizione fallita conserva dati e testo del modulo", () => {
  const t = harness(), list = t.node("locationsListContainer"), before = t.storage.get(KEY);
  t.run("renderLocationsList()");
  const [input, rename] = list.children[0].children;
  input.value = "Nuovo ripiano";
  t.fail(); rename.click();
  assert.equal(t.run("locationList[0]"), "Ripiano");
  assert.equal(t.run("filaments[0].spools_locations[0]"), "Ripiano");
  assert.equal(input.value, "Nuovo ripiano");
  assert.equal(t.storage.get(KEY), before);
  assert.ok(t.messages.every(message => message.type !== "success"));
});

test("eliminazione posizione è atomica e annullabile", () => {
  const t = harness(), list = t.node("locationsListContainer");
  t.run("renderLocationsList()");
  list.children[0].children[2].click();
  assert.equal(t.run("locationList.length"), 0);
  assert.equal(t.run("filaments[0].spools_locations[0]"), "");
  t.run("undoAction()");
  assert.equal(t.run("locationList[0]"), "Ripiano");
  assert.equal(t.run("filaments[0].spools_locations[0]"), "Ripiano");
});

test("aggiunta posizione fallita non svuota input né comunica successo", () => {
  const t = harness(), button = t.node("addLocationButton"), input = t.node("newLocationInput");
  const begin = source.indexOf('    const addLocationBtn = document.getElementById("addLocationButton")');
  const end = source.indexOf("// Pulsante verifica database", begin);
  assert.ok(begin >= 0 && end > begin);
  t.run(source.slice(begin, end));
  input.value = "Nuova";
  t.fail(); button.click();
  assert.equal(input.value, "Nuova");
  assert.equal(t.run("locationList.length"), 1);
  assert.ok(t.messages.every(message => message.type !== "success"));
});

test("tema e soglia tornano allo stato precedente su quota", () => {
  const t = harness(), toggle = t.node("themeToggleButton");
  t.run("initTheme()");
  t.fail(); toggle.click();
  assert.equal(t.run("appSettings.theme"), "dark");
  assert.equal(t.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(t.run("saveLowStockThreshold(40)"), false);
  assert.equal(t.run("appSettings.lowStockThreshold"), 25);
  assert.equal(t.run("undoStack.length"), 0);
});

test("soglia valida è annullabile; valore fuori intervallo non altera dati", () => {
  const t = harness();
  assert.equal(t.run("saveLowStockThreshold('40,5')"), true);
  assert.equal(t.run("appSettings.lowStockThreshold"), 40.5);
  t.run("undoAction()");
  assert.equal(t.run("appSettings.lowStockThreshold"), 25);
  assert.equal(t.run("saveLowStockThreshold(101)"), false);
  assert.equal(t.run("appSettings.lowStockThreshold"), 25);
});

test("cancellazione storico fallita conserva voci, successo è annullabile", () => {
  const t = harness();
  t.run("deleteConsumptionEntry('c1');undoAction()");
  assert.equal(t.run("consumptionHistory.length"), 1);
  t.messages.length = 0;
  t.fail();
  t.run("clearAllConsumptionHistory()");
  assert.equal(t.run("consumptionHistory.length"), 1);
  assert.ok(t.messages.every(message => message.type !== "success"));
});
