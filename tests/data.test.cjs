const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = process.env.APP_SOURCE || path.resolve(__dirname, "../app.js");
const source = fs.readFileSync(appPath, "utf8");
const KEY = "registroFilamentiState_v3";

function harness(initial = {}) {
  const storage = new Map(Object.entries(initial));
  const events = {}, timers = [], intervals = [], messages = [], indicators = [], downloads = [];
  let failKey = null;
  let storageBudget = Infinity;
  const element = () => ({ style: {}, value: "", addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return "dark"; }, click() {}, remove() {}, querySelectorAll() { return []; } });
  const ctx = vm.createContext({
    console: { log() {}, error() {}, warn() {}, debug() {}, assert() {} },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) {
        const next = new Map(storage).set(key, String(value));
        const size = [...next.values()].reduce((sum, item) => sum + item.length, 0);
        if (key === failKey || size > storageBudget) { const error = new Error("QuotaExceededError"); error.name = "QuotaExceededError"; throw error; }
        storage.set(key, String(value));
      },
      removeItem: key => storage.delete(key)
    },
    document: { addEventListener(name, cb) { events["document:" + name] = cb; }, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement: element, head: element(), body: element(), documentElement: element() },
    window: { addEventListener(name, cb) { events["window:" + name] = cb; }, confirm() { return true; } },
    setTimeout(cb) { timers.push(cb); return timers.length; }, clearTimeout() {},
    setInterval(cb) { intervals.push(cb); return intervals.length; }, clearInterval() {}, alert() {},
    Blob: class { constructor(parts) { downloads.push(parts.join("")); } },
    URL: { createObjectURL() { return "test:blob"; }, revokeObjectURL() {} },
    FileReader: class {}, messages, indicators
  });
  vm.runInContext(source, ctx, { filename: appPath });
  vm.runInContext(`showToast=(message,type)=>messages.push({message,type});updateAutoSaveIndicator=(...args)=>indicators.push(args);
    updateHistoryUI=()=>{};renderAll=()=>{};renderBrandOptions=()=>{};renderMaterialOptions=()=>{};renderColorOptions=()=>{};
    populateFilterOptions=()=>{};renderConsumptionChart=()=>{};renderConsumptionHistory=()=>{};renderConsumptionStats=()=>{};
    renderPurchasedTable=()=>{};renderDashboard=()=>{};closeSettingsModal=()=>{};updateColorPreviewFromSelection=()=>{};`, ctx);
  const run = code => vm.runInContext(code, ctx);
  const plain = code => JSON.parse(run("JSON.stringify(" + code + ")"));
  return { storage, events, timers, intervals, messages, indicators, downloads, run, plain, failWritesTo(key) { failKey = key; }, setBudget(value) { storageBudget = value; } };
}

function filament(overrides = {}) {
  return { id: "f1", brand: "Bambu Lab", material: "PLA", variant: "Test", color_code: "001", unit_weight_g: 1000, spools_total: 1, sealed_spools: 0, open_spools: 1, open_spools_fractions: [1], main_fraction: 1, total_weight_g: 1000, remaining_weight_g: 1000, used_weight_g: 0, ...overrides };
}

function initialized() {
  const t = harness();
  assert.equal(t.run("loadState()"), true);
  t.run(`filaments=[${JSON.stringify(filament())}];`);
  assert.equal(t.run("saveState()"), true);
  return t;
}

test("il backup esporta lo stato corrente completo senza debounce né undo", () => {
  const t = initialized();
  t.run(`filaments[0].open_spools_fractions=[.7];recalcWeightsForFilament(filaments[0]);locationList=['Ripiano'];consumptionHistory=[{id:'c1',filamentId:'f1',timestamp:'2026-10-14T12:00:00Z',gramsConsumed:300}];appSettings.lowStockThreshold=40;exportJson();`);
  const exported = JSON.parse(t.downloads.at(-1));
  assert.equal(exported.filaments[0].remaining_weight_g, 700);
  assert.deepEqual(exported.locations, ["Ripiano"]);
  assert.equal(exported.consumptionHistory[0].gramsConsumed, 300);
  assert.equal(exported.settings.lowStockThreshold, 40);
  assert.equal(exported.undoStack, undefined);
  assert.equal(exported.schemaVersion, 4);
});

test("restore sostitutivo accetta inventario vuoto e sostituisce acquisti", () => {
  const t = initialized();
  t.run(`purchasedFilaments=[{id:'p1',brand:'Test',quantity_spools:9}];`);
  const backup = { filaments: [], purchasedFilaments: [{ id: "p1", brand: "Test", quantity_spools: 2 }] };
  assert.equal(t.run(`importJsonData(${JSON.stringify(backup)})`), true);
  assert.equal(t.run("filaments.length"), 0);
  assert.equal(t.run("purchasedFilaments[0].quantity_spools"), 2);
});

test("restore malformato non modifica memoria, storage o cronologia", () => {
  const t = initialized();
  const before = t.storage.get(KEY);
  const backup = { filaments: [filament({ id: "other" })], materials: 123 };
  assert.throws(() => t.run(`importJsonData(${JSON.stringify(backup)})`));
  assert.equal(t.run("filaments[0].id"), "f1");
  assert.equal(t.storage.get(KEY), before);
  assert.equal(t.run("undoStack.length"), 0);
});

test("errore caricamento blocca autosave e preserva il contenuto originale", () => {
  const raw = JSON.stringify({ filaments: [filament({ variant: 42 })] });
  const t = harness({ [KEY]: raw });
  assert.equal(t.run("loadState()"), false);
  t.run("startPeriodicAutoSave();autoSave();");
  t.intervals.forEach(fn => fn());
  assert.equal(t.run("saveState()"), false);
  assert.equal(t.storage.get(KEY), raw);
  t.run("exportJson()");
  assert.equal(t.downloads.at(-1), raw);
});

test("ripristino esplicito conserva raw invalido e non sovrascrive lastGood", () => {
  const raw = '{"filaments":';
  const t = harness({ [KEY]: raw, [KEY + "_lastGood"]: "precedente" });
  assert.equal(t.run("loadState()"), false);
  assert.equal(t.run(`importJsonData({filaments:[]})`), true);
  assert.equal(t.storage.get(KEY + "_rejected"), raw);
  assert.equal(t.storage.get(KEY + "_lastGood"), "precedente");
  assert.equal(JSON.parse(t.storage.get(KEY)).filaments.length, 0);
});

test("undo e redo includono consumi, posizioni e impostazioni", () => {
  const t = initialized();
  t.run(`saveStateForUndo('Consumo');filaments[0].open_spools_fractions=[.7];recalcWeightsForFilament(filaments[0]);consumptionHistory=[{id:'c1',timestamp:'2026-10-14T12:00:00Z',gramsConsumed:300}];locationList=['Nuovo'];appSettings.lowStockThreshold=42;saveState();undoAction();`);
  assert.equal(t.run("filaments[0].remaining_weight_g"), 1000);
  assert.equal(t.run("consumptionHistory.length"), 0);
  assert.equal(t.run("appSettings.lowStockThreshold"), 25);
  t.run("redoAction()");
  assert.equal(t.run("filaments[0].remaining_weight_g"), 700);
  assert.equal(t.run("consumptionHistory.length"), 1);
  assert.deepEqual(t.plain("locationList"), ["Nuovo"]);
  const persisted = t.storage.get(KEY);
  const reloaded = harness({ [KEY]: persisted, registroFilamentiConsumptionHistory: "[]", registroFilamentiLocations: '["Vecchio"]' });
  assert.equal(reloaded.run("loadState()"), true);
  assert.equal(reloaded.run("consumptionHistory.length"), 1);
  assert.deepEqual(reloaded.plain("locationList"), ["Nuovo"]);
});

test("quota: transazione ripristina memoria e non comunica successo", () => {
  const t = initialized();
  const before = t.storage.get(KEY);
  t.failWritesTo(KEY);
  assert.equal(t.run(`commitMutation('Test',()=>{filaments=[]})`), false);
  assert.equal(t.run("filaments.length"), 1);
  assert.equal(t.run("undoStack.length"), 0);
  assert.equal(t.storage.get(KEY), before);
  assert.ok(t.messages.every(message => message.type !== "success"));
});

test("quota: import resta interamente invariato e beforeunload avvisa", () => {
  const t = initialized();
  const before = t.storage.get(KEY);
  t.failWritesTo(KEY);
  assert.equal(t.run("importJsonData({filaments:[]})"), false);
  assert.equal(t.run("filaments.length"), 1);
  assert.equal(t.storage.get(KEY), before);
  t.run("filaments=[];setupBeforeUnloadSave();");
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  t.events["window:beforeunload"](event);
  assert.equal(prevented, true);
});

test("copia secondaria piena non impedisce salvataggio principale", () => {
  const t = initialized();
  t.failWritesTo(KEY + "_lastGood");
  assert.equal(t.run("commitMutation('Test',()=>{locationList=['Test']})"), true);
  assert.deepEqual(JSON.parse(t.storage.get(KEY)).locations, ["Test"]);
  assert.ok(t.messages.some(message => message.type === "warning"));
});

test("quota complessiva: libera solo lastGood e riprova una volta il registro", () => {
  const t = initialized();
  const before = t.storage.get(KEY);
  t.setBudget(before.length * 2 + 30);
  t.run("filaments[0].notes='x'.repeat(1000)");
  assert.equal(t.run("saveState()"), true);
  assert.equal(JSON.parse(t.storage.get(KEY)).filaments[0].notes.length, 1000);
  assert.equal(t.storage.has(KEY + "_lastGood"), false);
  assert.ok(t.messages.some(message => message.type === "warning"));
});

test("altra scheda: rifiuta sovrascrittura anche senza evento storage", () => {
  const t = initialized();
  const external = JSON.parse(t.storage.get(KEY));
  external.data_revision += 1;
  external.locations = ["Modifica altra scheda"];
  const raw = JSON.stringify(external);
  t.storage.set(KEY, raw);
  assert.equal(t.run("commitMutation('Test',()=>{filaments=[]})"), false);
  assert.equal(t.storage.get(KEY), raw);
  assert.equal(t.run("filaments.length"), 1);
});

test("reset non ricarica dati legacy e cancella consumi/undo", () => {
  const t = initialized();
  t.storage.set("registroFilamentiState_v2", JSON.stringify({ filaments: [filament()] }));
  t.run("saveStateForUndo('Test');clearAllData();loadState();");
  assert.equal(t.run("filaments.length"), 0);
  assert.equal(t.run("undoStack.length"), 0);
  assert.equal(t.run("consumptionHistory.length"), 0);
  assert.equal(t.storage.has("registroFilamentiState_v2"), false);
  assert.equal(JSON.parse(t.storage.get(KEY)).schemaVersion, 4);
});

test("fatture: decimali italiani, totali espliciti e prezzo legacy unitario", () => {
  const t = initialized();
  const data = { orders: [{ orderNumber: "TEST", items: [
    { id: "p1", brand: "Test", quantity: 1, unit_price: "10,14" },
    { id: "p2", brand: "Test", quantity: 2, price: 30 },
    { id: "p3", brand: "Test", quantity: 2, total_price: "30,50" }
  ] }] };
  assert.equal(t.run(`importJsonData(${JSON.stringify(data)})`), true);
  assert.deepEqual(t.plain("purchasedFilaments.map(p=>p.unit_price)"), [10.14, 30, 15.25]);
  assert.deepEqual(t.plain("purchasedFilaments.map(p=>p.quantity_purchased_original)"), [1, 2, 2]);
  assert.equal(t.run(`importJsonData(${JSON.stringify(data)})`), true);
  assert.equal(t.run("purchasedFilaments.length"), 3);
});

test("fatture: quantità zero, frazionaria e negativa rifiutate senza effetti", () => {
  const t = initialized();
  const before = t.storage.get(KEY);
  for (const quantity of [0, -1, 1.5, "non-numero"]) {
    const data = { orders: [{ items: [{ quantity, unit_price: 5 }] }] };
    assert.throws(() => t.run(`importJsonData(${JSON.stringify(data)})`));
    assert.equal(t.storage.get(KEY), before);
    assert.equal(t.run("purchasedFilaments.length"), 0);
  }
});

test("V105 identifica il codice e data_revision cambia solo con i dati", () => {
  const t = harness({ registroFilamentiAppVersion: "V.999" });
  t.run("loadVersion();loadState();saveState(true)");
  assert.equal(t.run("APP_VERSION"), "V.108");
  const revision = t.run("dataRevision");
  assert.equal(t.run("saveState(true)"), true);
  assert.equal(t.run("dataRevision"), revision);
  t.run("locationList=['Test'];saveState(true)");
  assert.equal(t.run("dataRevision"), revision + 1);
  assert.equal(t.run("APP_VERSION"), "V.108");
});

test("backup v4: esportazione e ripristino conservano esattamente i dati", () => {
  const t = initialized();
  t.run(`locationList=['Ripiano'];appSettings.theme='light';consumptionHistory=[{id:'c1',timestamp:'2026-10-14T12:00:00Z',gramsConsumed:23}];exportJson()`);
  const exported = JSON.parse(t.downloads.at(-1));
  const second = initialized();
  assert.equal(second.run(`importJsonData(${JSON.stringify(exported)})`), true);
  const restored = second.plain("captureStateSnapshot()");
  for (const field of ["filaments", "purchasedFilaments", "brands", "materials", "colors", "locations", "settings", "consumptionHistory"]) assert.deepEqual(restored[field], exported[field]);
});

test("schema e identità non validi rifiutati prima del commit", () => {
  const t = initialized();
  assert.throws(() => t.run("validateStateCandidate({schemaVersion:4,filaments:[]})"));
  assert.throws(() => t.run(`validateStateCandidate({filaments:[${JSON.stringify(filament())},${JSON.stringify(filament())}]})`));
  assert.throws(() => t.run(`validateStateCandidate({filaments:[${JSON.stringify(filament({ spool_state_version: 1, open_spools_fractions: [] }))}]})`));
  assert.throws(() => t.run("validateStateCandidate({filaments:[],purchasedFilaments:[{quantity_spools:3,quantity_purchased_original:2}]})"));
});

test("compatibilità backup V318 reale, quando la fixture è presente", { skip: !fs.existsSync(path.resolve(path.dirname(appPath), "dati/registro_filamenti_2026-03-12_V318.json")) }, () => {
  const fixture = fs.readFileSync(path.resolve(path.dirname(appPath), "dati/registro_filamenti_2026-03-12_V318.json"), "utf8");
  const parsed = JSON.parse(fixture);
  const t = harness({ [KEY]: fixture });
  assert.equal(t.run("loadState()"), true);
  assert.equal(t.run("filaments.length"), parsed.filaments.length);
  assert.equal(t.run("saveState()"), true);
  assert.equal(JSON.parse(t.storage.get(KEY)).schemaVersion, 4);
});
