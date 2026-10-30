const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
function setup() {
  const files = new Map(), stored = new Map(), statuses = [], intervals = [], events = {};
  let failWrites = false, allowed = true, quota = false, closes = 0, preference = null;
  const directory = { name: "Backup prova", async queryPermission() { return allowed ? "granted" : "prompt"; },
    async requestPermission() { return allowed ? "granted" : "denied"; },
    async getFileHandle(name) { return { async createWritable() { let pending;
      return { async write(content) { if (failWrites) throw new Error("Disco pieno"); pending = content; },
        async close() { files.set(name, pending); closes++; }, async abort() {} };
    } }; } };
  const element = () => ({ style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return "dark"; }, querySelectorAll() { return []; } });
  const context = vm.createContext({ directory, statuses, console: { log() {}, error() {}, warn() {}, debug() {}, assert() {} },
    document: { addEventListener(type, callback) { events[type] = callback; }, getElementById() { return null; }, createElement: element,
      querySelectorAll() { return []; }, head: element(), body: element(), documentElement: element() },
    window: { addEventListener() {}, showDirectoryPicker: async () => directory },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem(key, value) { if (quota) throw new Error("QuotaExceededError"); stored.set(key, value); }, removeItem(key) { stored.delete(key); } },
    setTimeout() {}, clearTimeout() {}, setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {},
  });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  context.preferenceIO = async (value, remove) => { if (remove) preference = null; else if (value !== undefined) preference = value; return preference; };
  run(`setFileBackupStatus=(message,failed)=>statuses.push({message,failed});backupFolderPreference=preferenceIO;
    showToast=()=>{};updateAutoSaveIndicator=()=>{};updateHistoryUI=()=>{};loadState();
    filaments=validateStateCandidate({filaments:[{id:'f1',brand:'Bambu Lab',material:'PLA',variant:'10103',unit_weight_g:1000,total_weight_g:1000,sealed_spools:0,open_spools:1,spools_total:1,open_spools_fractions:[1]}]}).filaments;
    saveState();fileBackupDirectory=directory;`);
  return { run, files, statuses, intervals, context, setWriteFailure(value) { failWrites = value; },
    setAllowed(value) { allowed = value; }, setQuota() { quota = true; }, closes: () => closes };
}
test("Backup: snapshot completo, copia datata e ultimo JSON ripristinabile", async () => {
  const t = setup();
  assert.equal(await t.run("runFileBackup(true)"), true);
  assert.equal(t.files.size, 2);
  const data = JSON.parse(t.files.get("registro_filamenti_ultimo_backup.json"));
  assert.equal(data.export_version, "V.107"); assert.equal(data.file_type, "database_backup");
  assert.equal(data.filaments[0].remaining_weight_g, 1000); assert.equal(data.undoStack, undefined);
  assert.equal(t.run(`validateStateCandidate(${JSON.stringify(data)}).filaments[0].remaining_weight_g`), 1000);
});
test("Il timer è di 5 minuti; modifiche nuove incluse e nessuna copia duplicata senza cambiamenti", async () => {
  const t = setup(); await t.run("initFileBackup()");
  assert.equal(t.intervals[0].ms, 300000);
  await t.run("runFileBackup()"); const before = t.closes();
  await t.run("runFileBackup()"); assert.equal(t.closes(), before);
  t.run("filaments[0].open_spools_fractions=[.5];recalcWeightsForFilament(filaments[0]);saveState()");
  t.intervals[0].fn(); await new Promise(setImmediate);
  assert.equal(JSON.parse(t.files.get("registro_filamenti_ultimo_backup.json")).filaments[0].remaining_weight_g, 500);
});
test("Disco pieno: il precedente ultimo backup resta integro, errore persistente e nuovo tentativo possibile", async () => {
  const t = setup(); await t.run("runFileBackup(true)"); const before = t.files.get("registro_filamenti_ultimo_backup.json");
  t.setWriteFailure(true); assert.equal(await t.run("runFileBackup(true)"), false);
  assert.equal(t.files.get("registro_filamenti_ultimo_backup.json"), before);
  assert.match(t.statuses.at(-1).message, /Disco pieno/); assert.equal(t.statuses.at(-1).failed, true);
  t.setWriteFailure(false); assert.equal(await t.run("runFileBackup(true)"), true);
});
test("Permesso revocato, registro corrotto e conflitto fra schede non scrivono file", async () => {
  const t = setup(); t.setAllowed(false); assert.equal(await t.run("runFileBackup(true)"), false); assert.equal(t.files.size, 0);
  t.setAllowed(true); t.run("stateReady=false"); assert.equal(await t.run("runFileBackup(true)"), false);
  t.run("stateReady=true;storageWriteBlocked=true"); assert.equal(await t.run("runFileBackup(true)"), false); assert.equal(t.files.size, 0);
});
test("Quota del browser piena non genera un backup presentato come riuscito", async () => {
  const t = setup(); t.setQuota(); t.run("filaments[0].notes='nuova modifica'");
  assert.equal(await t.run("runFileBackup(true)"), false); assert.equal(t.files.size, 0);
});
test("Disattivare conserva i file e impedisce altri backup; browser non supportato segnalato", async () => {
  const t = setup(); await t.run("chooseBackupDirectory()"); await t.run("disableFileBackup()"); const before = t.closes();
  assert.equal(await t.run("runFileBackup()"), false); assert.equal(t.closes(), before); assert.equal(t.files.size, 2);
  t.run("window.showDirectoryPicker=undefined"); await t.run("chooseBackupDirectory()");
  assert.match(t.statuses.at(-1).message, /non disponibile/);
});
test("Due richieste contemporanee non avviano due scritture", async () => {
  const t = setup(); const first = t.run("runFileBackup(true)");
  assert.equal(await t.run("runFileBackup(true)"), false); assert.equal(await first, true); assert.equal(t.closes(), 2);
});
