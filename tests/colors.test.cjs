const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const element = () => ({ style: {}, addEventListener() {}, appendChild() {}, setAttribute() {}, querySelectorAll() { return []; } });
const ctx = vm.createContext({ document: { addEventListener() {}, getElementById() { return null; },
  createElement: element, head: element(), body: element(), documentElement: element() },
  window: { addEventListener() {} }, console: { log() {}, error() {}, warn() {}, debug() {}, assert() {} },
  setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, localStorage: { getItem() { return null; } } });
vm.runInContext(source, ctx);
const run = code => vm.runInContext(code, ctx);

test("Catalogo ufficiale: 318 codici univoci, 46 famiglie e colori RGBA validi", () => {
  assert.equal(run("bambuOfficialColors.length"), 318);
  assert.equal(run("new Set(bambuOfficialColors.map(x=>x.code)).size"), 318);
  assert.equal(run("new Set(bambuOfficialColors.map(x=>x.material)).size"), 46);
  assert.equal(run("bambuOfficialColors.every(x=>/^\\d{5}$/.test(x.code)&&x.name&&x.en&&x.colors.length&&x.colors.every(c=>/^#[0-9A-F]{8}$/i.test(c)))"), true);
});
test("Codici prima errati: Argento, Beige, Verde bambù e Blu", () => {
  for (const [code, name, hex] of [["10102", "Argento", "#A6A9AA"], ["10201", "Beige", "#F7E6DE"],
    ["10501", "Verde bambù", "#00AE42"], ["10601", "Blu", "#0A2989"]]) {
    assert.ok(run(`getColorNameFromCode('${code}')`).includes(name));
    assert.equal(run(`getColorHex('${code}')`), hex);
    assert.match(run(`getColorDisplayName('${code}')`), new RegExp(name));
  }
});
test("Nome completato usando il codice separato senza mutare i dati", () => {
  const data = { brand: "Bambu Lab", material: "PLA", variant: "", color_code: "10102" };
  run(`var entry=${JSON.stringify(data)}`);
  assert.equal(run("getColorDisplayName('',entry)"), "Argento (10102)");
  assert.deepEqual(JSON.parse(run("JSON.stringify(entry)")), data);
});
test("Colori individuali prevalgono sul codice generale; altre marche e nomi personali preservati", () => {
  assert.equal(run("getColorHex('Nero (10101)',{brand:'Bambu Lab',variant:'Rosso',color_code:'10200'})"), "#000000");
  assert.equal(run("getColorDisplayName('10102',{brand:'eSUN'})"), "10102");
  assert.match(run("getColorDisplayName('Regalo speciale (10102)',{brand:'Bambu Lab'})"), /Regalo speciale.*Argento/);
});
test("Codice sconosciuto segnalato senza inventare nome o colore", () => {
  assert.equal(run("getColorNameFromCode('99999')"), "");
  assert.equal(run("getColorHex('99999')"), "#e5e7eb");
  assert.match(run("getColorDisplayName('99999')"), /nome non verificato/);
});
test("Multicolore e trasparente conservano i campioni della fonte ufficiale", () => {
  assert.match(run("getColorBackground('10900')"), /#9CDBD9FF.*#FFFFFFFF/);
  const transparent = run("bambuOfficialColors.find(x=>x.colors.some(c=>c.endsWith('00'))).code");
  assert.match(run(`getColorBackground('${transparent}')`), /repeating-conic-gradient/);
});
