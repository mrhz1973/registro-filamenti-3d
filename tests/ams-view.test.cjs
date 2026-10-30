const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = process.env.APP_SOURCE || path.resolve(__dirname, "../app.js");
const source = fs.readFileSync(appPath, "utf8");

function harness() {
  const nodes = new Map();
  function element() {
    const listeners = {}, attrs = {};
    return {
      children: [], style: {}, dataset: {}, value: "", textContent: "",
      classList: { add() {}, remove() {}, contains() { return false; } },
      set innerHTML(value) { this.markup = value; this.children = []; },
      get innerHTML() { return this.markup || ""; },
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, callback) { listeners[name] = callback; },
      click() { listeners.click?.({ preventDefault() {}, stopPropagation() {} }); },
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) { return attrs[name] || null; },
      querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return null; },
      focus() {}, scrollIntoView() {}, remove() {}
    };
  }
  const context = vm.createContext({
    window: { addEventListener() {} },
    document: { addEventListener() {}, getElementById: id => nodes.get(id) || null,
      createElement: element, querySelectorAll() { return []; }, querySelector() { return null; },
      body: element(), head: element(), documentElement: element() },
    console: { log() {}, debug() {}, warn() {}, error() {}, assert() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    getComputedStyle() { return { getPropertyValue() { return ""; } }; },
    requestAnimationFrame(callback) { callback(); }
  });
  vm.runInContext(source, context, { filename: appPath });
  const run = code => vm.runInContext(code, context);
  run("var openedSpools = []; openEditFilamentModal = (...args) => openedSpools.push(args);");
  const container = element(); nodes.set("storageVisualizationContainer", container);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  return {
    run, container,
    seed(items) { run(`filaments=${JSON.stringify(items)};filaments.forEach(recalcWeightsForFilament);`); },
    cards(node = container) { return descendants(node).filter(item => item.dataset.spoolId && item.dataset.filamentId); },
    group(name) {
      const key = run(`normalizeStorageLocation(${JSON.stringify(name)})`);
      const group = container.children.find(item => item.dataset.locationKey === key);
      assert.ok(group, `Posizione visibile: ${name}`);
      return group;
    },
    text(node) { return descendants(node).map(item => item.textContent).join(" "); },
    snapshot(code) { return JSON.parse(JSON.stringify(run(code))); }
  };
}

const multiSpool = {
  id: "pla-nero", brand: "Bambu Lab", material: "PLA", variant: "Nero", unit_weight_g: 1000,
  sealed_spools: 2, open_spools: 1, spools_total: 3, total_weight_g: 3000,
  remaining_weight_g: 2100, open_spools_fractions: [.1],
  spools_ids: ["nero-scaffale", "nero-ams", "nero-aperta"],
  spools_locations: ["Scaffale Top", "AMS/H2D", "Scaffale Medio"],
  spools_variants: ["Nero", "Nero", "Nero (10101)"], location: "Scaffale Top"
};

test("Magazzino: la card AMS apre la bobina selezionata, anche se la prima è sullo scaffale", () => {
  const t = harness(); t.seed([multiSpool]); t.run("renderStorageVisualization()");
  const cards = t.cards(t.group("AMS/H2D"));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].dataset.spoolId, "nero-ams");
  cards[0].click();
  assert.deepEqual(t.snapshot("openedSpools"), [["pla-nero", "nero-ams"]]);
  assert.equal(t.cards().length, 3);
});

test("Magazzino: una posizione residua senza bobina non genera una card fantasma", () => {
  const t = harness(); t.seed([multiSpool]);
  t.run("filaments[0].spools_locations.push('AMS/H2D');renderStorageVisualization()");
  assert.equal(t.cards().length, 3);
  assert.equal(t.cards(t.group("AMS/H2D")).length, 1);
});

test("Magazzino: i residui parziali appartengono alla bobina corretta", () => {
  const t = harness(); t.seed([multiSpool]); t.run("renderStorageVisualization()");
  const open = t.cards().find(card => card.dataset.spoolId === "nero-aperta");
  const sealed = t.cards().find(card => card.dataset.spoolId === "nero-ams");
  assert.match(t.text(open), /10%/); assert.match(t.text(open), /100g/);
  assert.match(t.text(sealed), /100%/); assert.match(t.text(sealed), /1[.\s]?000g/);
});

test("Magazzino: bobina esaurita non riappare come piena", () => {
  const t = harness();
  t.seed([{ ...multiSpool, open_spools_fractions: [0], remaining_weight_g: 2000 }]);
  t.run("renderStorageVisualization()");
  assert.equal(t.cards().length, 2);
  assert.ok(t.cards().every(card => card.dataset.spoolId !== "nero-aperta"));
});

test("Magazzino: alias Pro riuniti e vecchio eccesso segnalato senza nascondere bobine", () => {
  const t = harness();
  t.seed(["AMS/H2D", "AMS Pro", "AMS 2 Pro", "ams h2d", "AMS"].map((location, index) => ({
    ...multiSpool, id: `pro-${index}`, sealed_spools: 1, open_spools: 0, spools_total: 1,
    remaining_weight_g: 1000, total_weight_g: 1000, open_spools_fractions: [],
    spools_ids: [`pro-bobina-${index}`], spools_locations: [location], spools_variants: ["Nero"]
  })));
  const before = t.snapshot("filaments");
  t.run("renderStorageVisualization()");
  const group = t.group("AMS/H2D");
  assert.equal(t.cards(group).length, 5);
  assert.match(t.text(group), /5 \/ 4 posti/);
  assert.match(t.text(group), /sovraccarica/);
  assert.deepEqual(t.snapshot("filaments"), before);
});

test("Magazzino: due bobine HT restano recuperabili e richiedono correzione", () => {
  const t = harness();
  t.seed([{ ...multiSpool, open_spools: 0, spools_total: 2, total_weight_g: 2000,
    remaining_weight_g: 2000, open_spools_fractions: [], spools_ids: ["ht-1", "ht-2"],
    spools_locations: ["AMS HT", "ams ht"], spools_variants: ["Nero", "Bianco"] }]);
  t.run("renderStorageVisualization()");
  const group = t.group("AMS HT");
  assert.equal(t.cards(group).length, 2); assert.match(t.text(group), /2 \/ 1 posti/);
  assert.match(t.text(group), /sovraccarica/);
});

test("Backup V318: AMS Pro 4, HT 1, nessuna PLA Nero sigillata nell'AMS", () => {
  const fixturePath = process.env.APP_FIXTURE || path.join(path.dirname(appPath), "dati/registro_filamenti_2026-03-12_V318.json");
  const backup = JSON.parse(fs.readFileSync(fixturePath, "utf8").replace(/^\uFEFF/, ""));
  const t = harness(); t.seed(backup.filaments); t.run("renderStorageVisualization()");
  const pro = t.cards(t.group("AMS/H2D")), ht = t.cards(t.group("AMS HT"));
  assert.equal(pro.length, 4); assert.equal(ht.length, 1);
  assert.ok(pro.every(card => card.dataset.filamentId !== "1767871364172752075d613dd3"));
  assert.equal(ht[0].dataset.filamentId, "176532858251542485f9e3f1fe");
  assert.equal(t.run("filaments.reduce((sum, f) => sum + getActiveFilamentSpools(f).length, 0)"), 80);
  assert.equal(t.run("filaments.flatMap(getActiveFilamentSpools).filter(spool => !spool.location.trim()).length"), 3);
  assert.equal(t.cards().length, 77);
});
