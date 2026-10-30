const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = process.env.APP_SOURCE || path.resolve(__dirname, "../app.js");
const source = fs.readFileSync(appPath, "utf8");
const KEY = "registroFilamentiState_v3";

function spool(id, location, overrides = {}) {
  return { id: "fil-" + id, brand: "Test", material: "PLA", variant: "Nero", unit_weight_g: 1000,
    sealed_spools: 0, open_spools: 1, finished_spools: 0, spools_total: 1, total_weight_g: 1000,
    spool_state_version: 1, open_spools_fractions: [1], spools_ids: [id], spools_locations: [location],
    spools_variants: ["Nero"], ...overrides };
}

function harness(items = []) {
  const storage = new Map(), messages = [], confirmations = [];
  let confirmAnswer = true;
  const element = () => ({ style: {}, value: "", dataset: {}, addEventListener() {}, appendChild() {},
    setAttribute() {}, getAttribute() { return "dark"; }, querySelectorAll() { return []; } });
  const ctx = vm.createContext({
    console: { log() {}, error() {}, warn() {}, debug() {}, assert() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; },
      querySelectorAll() { return []; }, createElement: element, head: element(), body: element(), documentElement: element() },
    window: { addEventListener() {}, confirm(message) { confirmations.push(message); return confirmAnswer; } },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {}, messages
  });
  vm.runInContext(source, ctx, { filename: appPath });
  const run = code => vm.runInContext(code, ctx);
  const plain = code => JSON.parse(run("JSON.stringify(" + code + ")"));
  run(`showToast=(message,type)=>messages.push({message,type});updateAutoSaveIndicator=()=>{};updateHistoryUI=()=>{};
    renderAll=()=>{};renderBrandOptions=()=>{};renderMaterialOptions=()=>{};renderColorOptions=()=>{};
    populateFilterOptions=()=>{};renderConsumptionChart=()=>{};renderConsumptionHistory=()=>{};renderConsumptionStats=()=>{};
    loadState();filaments=validateStateCandidate({filaments:${JSON.stringify(items)}}).filaments;saveState();`);
  return { run, plain, storage, messages, confirmations, rejectConfirmation() { confirmAnswer = false; } };
}

test("le posizioni AMS equivalenti condividono il limite; unità numerate restano distinte", () => {
  const t = harness();
  for (const name of ["AMS", "AMS/H2D", "AMS Pro", "AMS 2 Pro", "ams2pro", " H2D / AMS "]) {
    assert.equal(t.run(`getAmsLocationInfo(${JSON.stringify(name)}).capacity`), 4);
    assert.equal(t.run(`normalizeStorageLocation(${JSON.stringify(name)})`), "ams-pro");
  }
  assert.equal(t.run("getAmsLocationInfo(' AMS-HT ').capacity"), 1);
  assert.equal(t.run("normalizeStorageLocation('AMS Pro #2')"), t.run("normalizeStorageLocation('AMS 2 Pro 2')"));
  assert.notEqual(t.run("normalizeStorageLocation('AMS HT 1')"), t.run("normalizeStorageLocation('AMS HT 2')"));
  for (const name of ["AMS/H2D", "AMS HT", "AMS Pro #2", "AMS HT 2"]) {
    assert.equal(t.run(`normalizeStorageLocation(getAmsLocationInfo(${JSON.stringify(name)}).label)`), t.run(`normalizeStorageLocation(${JSON.stringify(name)})`));
  }
  for (const name of ["scaffale AMS", "AMS ricambi", "Box 1", ""]) assert.equal(t.run(`getAmsLocationInfo(${JSON.stringify(name)})`), null);
});


test("una seconda bobina viene salvata e il conflitto resta dopo il caricamento", () => {
  const t = harness([spool("a", "AMS HT"), spool("b", "Scaffale")]);
  assert.equal(t.run(`commitMutation("sposta",()=>{filaments[1].spools_locations[0]="AMS HT"})`), true);
  assert.equal(t.run("getAmsCapacityConflicts()[0].count"), 2);
  t.run("loadState()");
  assert.equal(t.run("getAmsCapacityConflicts()[0].count"), 2);
  assert.equal(t.run(`commitMutation("libera",()=>{filaments[0].spools_locations[0]="Scaffale"})`), true);
  assert.equal(t.run("getAmsCapacityConflicts().length"), 0);
});
