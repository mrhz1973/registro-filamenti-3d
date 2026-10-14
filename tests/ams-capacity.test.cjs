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

test("una bobina HT e quattro Pro sono ammesse; bobine e posizioni fantasma non contano", () => {
  const items = [spool("ht", "AMS HT"), ...[1, 2, 3, 4].map(id => spool("p" + id, "AMS/H2D"))];
  const t = harness(items);
  assert.doesNotThrow(() => t.run("assertAmsCapacityTransition([],filaments)"));
  t.run("filaments[0].spools_locations.push('AMS HT');filaments[0].spools_ids.push('fantasma')");
  assert.equal(t.run("getAmsCapacityConflicts().length"), 0);
  assert.equal(t.run("getAmsOccupancy().find(unit=>unit.capacity===1).count"), 1);
});

test("una seconda bobina HT viene rifiutata con istruzione di spostare quella già presente", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  assert.throws(() => t.run("var next=cloneStateValue(filaments);next[1].spools_locations[0]='ams_ht';assertAmsCapacityTransition(filaments,next)"), /Sposta prima una bobina/);
});

test("la quinta bobina Pro è bloccata anche se usa un altro alias della stessa unità", () => {
  const t = harness([...[1, 2, 3, 4].map(id => spool("p" + id, "AMS/H2D")), spool("s", "Scaffale")]);
  assert.throws(() => t.run("var next=cloneStateValue(filaments);next[4].spools_locations[0]='AMS 2 Pro';assertAmsCapacityTransition(filaments,next)"), /massimo 4/);
});

test("commitMutation ripristina stato, cronologia e salvataggio quando supera la capacità", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  const before = t.storage.get(KEY);
  assert.equal(t.run("commitMutation('Sposta bobina',()=>{filaments[1].spools_locations[0]='AMS HT';})"), false);
  assert.equal(t.storage.get(KEY), before);
  assert.equal(t.run("filaments[1].spools_locations[0]"), "Scaffale");
  assert.equal(t.run("undoStack.length"), 0);
  assert.match(t.messages.at(-1).message, /Capacità AMS superata/);
});

test("commitDomainState protegge editor e aggiunta manuale con rollback completo", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  const before = t.storage.get(KEY);
  assert.equal(t.run("var before=captureDomainState();saveStateForUndo('Sposta');filaments[1].spools_locations[0]='AMS HT';commitDomainState(before)"), false);
  assert.equal(t.storage.get(KEY), before);
  assert.equal(t.run("filaments[1].spools_locations[0]"), "Scaffale");
  assert.equal(t.run("undoStack.length"), 0);
});

test("i conflitti legacy consentono note e riduzioni, senza spostamenti automatici", () => {
  const t = harness([spool("ht1", "AMS HT"), spool("ht2", "AMS HT"), spool("ht3", "AMS HT")]);
  assert.equal(t.run("loadState()"), true);
  assert.equal(t.run("filaments.filter(f=>f.spools_locations[0]==='AMS HT').length"), 3);
  assert.equal(t.messages.at(-1).type, "warning");
  assert.equal(t.run("commitMutation('Note',()=>{filaments[0].notes='Verificata';})"), true);
  assert.equal(t.run("commitMutation('Sposta',()=>{filaments[2].spools_locations[0]='Scaffale';})"), true);
  assert.equal(t.run("getAmsCapacityConflicts()[0].count"), 2);
  assert.equal(t.run("commitMutation('Sposta',()=>{filaments[1].spools_locations[0]='Scaffale';})"), true);
  assert.equal(t.run("getAmsCapacityConflicts().length"), 0);
  assert.equal(t.run("filaments.length"), 3);
});

test("sostituire un occupante mentre l'unità resta sovraccarica è vietato anche a conteggio invariato", () => {
  const t = harness([spool("ht1", "AMS HT"), spool("ht2", "AMS HT"), spool("s", "Scaffale")]);
  assert.equal(t.run("commitMutation('Sostituisci',()=>{filaments[1].spools_locations[0]='Scaffale';filaments[2].spools_locations[0]='AMS HT';})"), false);
  assert.equal(t.run("filaments[1].spools_locations[0]"), "AMS HT");
  assert.equal(t.run("filaments[2].spools_locations[0]"), "Scaffale");
});

test("il cambio bobina atomico è ammesso quando il risultato rispetta la capacità", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  assert.equal(t.run("commitMutation('Sostituisci',()=>{filaments[0].spools_locations[0]='Scaffale';filaments[1].spools_locations[0]='AMS HT';})"), true);
  assert.equal(t.run("undoAction()"), true);
  assert.equal(t.run("filaments[0].spools_locations[0]"), "AMS HT");
  assert.equal(t.run("redoAction()"), true);
  assert.equal(t.run("filaments[1].spools_locations[0]"), "AMS HT");
});

test("rinominare uno scaffale in AMS non permette di superare il limite", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  assert.equal(t.run("commitMutation('Rinomina posizione',()=>{filaments[1].spools_locations[0]='AMS-HT';locationList.push('AMS-HT');})"), false);
  assert.equal(t.run("filaments[1].spools_locations[0]"), "Scaffale");
});

test("Annulla non reintroduce il conflitto legacy appena corretto e conserva entrambi gli stack", () => {
  const t = harness([spool("ht1", "AMS HT"), spool("ht2", "AMS HT")]);
  assert.equal(t.run("commitMutation('Correggi HT',()=>{filaments[1].spools_locations[0]='Scaffale';})"), true);
  const before = t.plain("captureStateSnapshot(true)");
  assert.equal(t.run("undoAction()"), false);
  assert.deepEqual(t.plain("captureStateSnapshot(true)"), before);
  assert.match(t.messages.at(-1).message, /Annullamento non applicato/);
});

test("Ripristina e cronologia non reintroducono un conflitto né consumano snapshot", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  t.run("var invalid=captureStateSnapshot();invalid.filaments[1].spools_locations[0]='AMS HT';invalid.actionDescription='Vecchia assegnazione';undoStack=[invalid];redoStack=[invalid]");
  const before = t.plain("captureStateSnapshot(true)");
  assert.equal(t.run("redoAction()"), false);
  assert.deepEqual(t.plain("captureStateSnapshot(true)"), before);
  assert.equal(t.run("restoreToHistoryState(0)"), false);
  assert.deepEqual(t.plain("captureStateSnapshot(true)"), before);
});

test("importazione backup avverte del conflitto prima di sostituire il registro e preserva tutte le bobine", () => {
  const t = harness([spool("existing", "Scaffale")]);
  const backup = { filaments: [spool("ht1", "AMS HT"), spool("ht2", "AMS HT")] };
  assert.equal(t.run(`importJsonData(${JSON.stringify(backup)})`), true);
  assert.match(t.confirmations.at(-1), /ATTENZIONE: Capacità AMS superata/);
  assert.match(t.confirmations.at(-1), /nessuna bobina verrà spostata automaticamente/);
  assert.deepEqual(t.plain("filaments.map(f=>f.spools_locations[0])"), ["AMS HT", "AMS HT"]);
  assert.equal(t.messages.at(-1).type, "warning");
  assert.equal(t.run("commitMutation('Note',()=>{filaments[0].notes='Da spostare';})"), true);
});

test("annullare la conferma del backup in conflitto conserva il registro originale", () => {
  const t = harness([spool("existing", "Scaffale")]);
  const before = t.storage.get(KEY);
  t.rejectConfirmation();
  assert.equal(t.run(`importJsonData(${JSON.stringify({ filaments: [spool("ht1", "AMS HT"), spool("ht2", "AMS HT")] })})`), false);
  assert.equal(t.storage.get(KEY), before);
  assert.equal(t.run("filaments[0].id"), "fil-existing");
});

test("un ripristino generico non aggira il controllo di capacità", () => {
  const t = harness([spool("ht", "AMS HT"), spool("s", "Scaffale")]);
  const before = t.storage.get(KEY);
  assert.equal(t.run("var candidate=captureStateSnapshot();candidate.filaments[1].spools_locations[0]='AMS HT';commitReplacementState(candidate,'Sposta')"), false);
  assert.equal(t.storage.get(KEY), before);
});

test("identità condivise tra record vengono rifiutate anche nei formati precedenti", () => {
  const t = harness();
  const records = [spool("duplicata", "AMS HT"), spool("duplicata", "Scaffale", { id: "altro-filamento" })];
  assert.throws(() => t.run(`validateStateCandidate({filaments:${JSON.stringify(records)}})`), /Identità bobina condivisa/);
  records.forEach(f => delete f.spool_state_version);
  assert.throws(() => t.run(`validateStateCandidate({filaments:${JSON.stringify(records)}})`), /Identità bobina condivisa/);
});

test("backup V318 resta compatibile e mantiene record, bobine e grammi", () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(appPath), "dati/registro_filamenti_2026-03-12_V318.json"), "utf8"));
  const t = harness();
  assert.equal(t.run(`importJsonData(${JSON.stringify(fixture)})`), true);
  assert.equal(t.run("filaments.length"), 61);
  assert.equal(t.run("filaments.reduce((sum,f)=>sum+f.sealed_spools+f.open_spools,0)"), 80);
  assert.equal(t.run("filaments.reduce((sum,f)=>sum+f.remaining_weight_g,0)"), 64025);
  assert.equal(t.run("getAmsCapacityConflicts().length"), 0);
  assert.equal(t.run("getAmsOccupancy().find(unit=>unit.capacity===1).count"), 1);
  assert.equal(t.run("getAmsOccupancy().find(unit=>unit.capacity===4).count"), 4);
});
