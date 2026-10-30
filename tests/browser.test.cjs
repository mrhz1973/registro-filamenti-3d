// Test facoltativi nel browser: usa Playwright già installato, senza dipendenze dell'app.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const key = "registroFilamentiState_v3";
const backupPath = path.join(root, "dati/registro_filamenti_2026-03-12_V318.json");
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8").replace(/^\uFEFF/, ""));
const spool = (extra = {}) => ({
  id: "test1", brand: "Bambu Lab", material: "PLA", variant: "Nero",
  color_code: "", spools_total: 1, sealed_spools: 0, open_spools: 1,
  unit_weight_g: 1000, total_weight_g: 1000, remaining_weight_g: 1000,
  used_weight_g: 0, main_fraction: 1, unit_price: 20, packaging_type: "spool",
  open_spools_fractions: [1], spools_locations: ["Box"], spools_variants: ["Nero"],
  location: "Box", ...extra,
});
const seed = (filaments = [spool()], purchasedFilaments = []) => ({
  filaments, purchasedFilaments, brands: ["Bambu Lab"], materials: ["PLA"], colors: ["Nero", "Rosso"],
});
const locatedSpool = (id, location, extra = {}) => spool({ id, spools_ids: [id + "-bobina"],
  spools_locations: [location], location, ...extra });
const fullAms = () => seed([
  locatedSpool("ht", "AMS HT"),
  ...Array.from({ length: 4 }, (_, i) => locatedSpool("pro" + i, "AMS/H2D")),
  locatedSpool("scorta", "Scaffale Top"),
]);
let server, browser, origin;

before(async () => {
  server = http.createServer((req, res) => {
    const file = { "/": "index.html", "/app.js": "app.js", "/styles.css": "styles.css" }[req.url];
    if (!file) { res.writeHead(req.url === "/favicon.ico" ? 204 : 404); return res.end(); }
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function withPage(data, callback) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Rome" });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], dialogs = [], consoleErrors = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.addInitScript(({ data, key }) => {
    if (!sessionStorage.getItem("test-seeded")) {
      if (data !== null) localStorage.setItem(key, typeof data === "string" ? data : JSON.stringify(data));
      sessionStorage.setItem("test-seeded", "1");
    }
  }, { data, key });
  try {
    await page.goto(origin, { waitUntil: "load" });
    await callback(page, dialogs, context);
    assert.deepEqual(errors, [], "Nessun errore JavaScript non gestito");
  } catch (error) {
    console.error("Diagnostica browser:", { errors, dialogs, consoleErrors, notices: await page.locator("#toastContainer").innerText().catch(() => "") });
    throw error;
  } finally { await context.close(); }
}

test("Avvio locale file:// e versione del codice distinta dai dati", async () => {
  await withPage(null, async page => {
    await page.goto(`file:///${path.join(root, "index.html").replaceAll("\\", "/")}`);
    assert.equal(await page.evaluate(() => APP_VERSION), "V.108");
  });
});

const openingData = (alreadyOpen = 1) => seed([spool({ id: "opening", variant: "Nero", color_code: "10101",
  spool_state_version: 1, sealed_spools: 2, open_spools: alreadyOpen, finished_spools: 1, spools_total: 3 + alreadyOpen,
  total_weight_g: (3 + alreadyOpen) * 1000, remaining_weight_g: 2000 + alreadyOpen * 500,
  used_weight_g: 1000 + alreadyOpen * 500, open_spools_fractions: alreadyOpen ? [.5] : [],
  spools_ids: ["ht-sealed", "shelf-sealed", "old-open"].slice(0, 2 + alreadyOpen),
  spools_locations: ["AMS HT", "Scaffale Top", "Scaffale Medio"].slice(0, 2 + alreadyOpen),
  spools_variants: ["Nero", "Rosso", "Bianco"].slice(0, 2 + alreadyOpen) })]);

async function assertOpenedInventory(page, alreadyOpen = 1) {
  assert.deepEqual(await page.evaluate(() => {
    const f = filaments[0]; const selected = getActiveFilamentSpools(f).find(spool => spool.id === "ht-sealed");
    return { sealed: f.sealed_spools, open: f.open_spools, active: f.spools_ids.length, total: f.spools_total,
      finished: f.finished_spools, totalGrams: f.total_weight_g, grams: f.remaining_weight_g, variant: f.variant,
      selected: { id: selected.id, sealed: selected.sealed, location: selected.location, variant: selected.variant, fraction: selected.fraction },
      history: consumptionHistory.length };
  }), { sealed: 1, open: 1 + alreadyOpen, active: 2 + alreadyOpen, total: 3 + alreadyOpen, finished: 1,
    totalGrams: (3 + alreadyOpen) * 1000, grams: 2000 + alreadyOpen * 500, variant: "Nero",
    selected: { id: "ht-sealed", sealed: false, location: "AMS HT", variant: "Nero", fraction: 1 }, history: 0 });
  assert.match(await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').innerText(), /APERTA/);
  assert.equal(await page.locator('#storageVisualizationContainer [data-location-key="ams-ht"] [data-spool-id]').count(), 1);
}

test("Da due sigillate a una sigillata e una aperta: il totale resta due", async () => {
  await withPage(openingData(0), async page => {
    await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').click();
    await page.locator("#editSpoolsOpen").fill("1"); await page.locator("#editSpoolsOpen").press("Tab");
    assert.equal(await page.locator("#editSpoolsSealed").inputValue(), "1");
    assert.equal(await page.locator("#editSpoolsTotal").inputValue(), "2");
    await page.locator("#editModalConfirmButton").click(); await assertOpenedInventory(page, 0);
    await page.reload(); await assertOpenedInventory(page, 0);
  });
});

test("Apri bobina HT: meno una sigillata, più una aperta, stessi totali e grammi anche dopo ricarica", async () => {
  await withPage(openingData(), async page => {
    await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').click();
    await page.locator('button[data-action="open-spool"][data-spool-id="ht-sealed"]').click();
    assert.equal(await page.locator("#editSpoolsSealed").inputValue(), "1");
    assert.equal(await page.locator("#editSpoolsOpen").inputValue(), "2");
    assert.equal(await page.locator("#editSpoolsTotal").inputValue(), "3");
    assert.equal(await page.locator('#editOpenSpoolsListContainer [data-spool-id="ht-sealed"] select[data-field-type="location"]').inputValue(), "AMS HT");
    await page.locator("#editModalConfirmButton").click();
    await assertOpenedInventory(page);
    await page.reload(); await assertOpenedInventory(page);
  });
});

test("Contatore Aperte converte la bobina selezionata e Annulla/Ripristina conservano le quantità", async () => {
  await withPage(openingData(), async page => {
    await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').click();
    await page.locator("#editSpoolsOpen").fill("2"); await page.locator("#editSpoolsOpen").press("Tab");
    assert.equal(await page.locator("#editSpoolsSealed").inputValue(), "1");
    assert.equal(await page.locator("#editSpoolsTotal").inputValue(), "3");
    await page.locator("#editModalConfirmButton").click(); await assertOpenedInventory(page);
    assert.equal(await page.evaluate(() => undoAction()), true);
    assert.deepEqual(await page.evaluate(() => ({ sealed: filaments[0].sealed_spools, open: filaments[0].open_spools, total: filaments[0].spools_total })), { sealed: 2, open: 1, total: 4 });
    assert.equal(await page.evaluate(() => redoAction()), true); await assertOpenedInventory(page);
  });
});

test("Aprire e poi Annulla nel modulo non modifica inventario e consumi", async () => {
  await withPage(openingData(), async page => {
    const before = await page.evaluate(() => JSON.stringify(filaments));
    await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').click();
    await page.locator('button[data-action="open-spool"][data-spool-id="ht-sealed"]').click();
    await page.locator("#editModalCancelButton").click();
    assert.equal(await page.evaluate(() => JSON.stringify(filaments)), before);
    assert.equal(await page.evaluate(() => consumptionHistory.length), 0);
  });
});

test("Assegnare all'HT e aprire nella stessa modifica conserva bobina e totale", async () => {
  const data = openingData(); data.filaments[0].spools_locations[0] = "Scaffale Top";
  data.locations = ["AMS HT", "Scaffale Top", "Scaffale Medio"];
  await withPage(data, async page => {
    await page.locator('#storageVisualizationContainer [data-spool-id="ht-sealed"]').click();
    await page.locator('#editSealedSpoolsListContainer [data-spool-id="ht-sealed"] select[data-field-type="location"]').selectOption("AMS HT");
    await page.locator('button[data-action="open-spool"][data-spool-id="ht-sealed"]').click();
    await page.locator("#editModalConfirmButton").click(); await assertOpenedInventory(page);
  });
});

test("Il contatore Aperte non crea bobine quando non ci sono sigillate disponibili", async () => {
  await withPage(seed(), async page => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator("#editSpoolsOpen").fill("2"); await page.locator("#editSpoolsOpen").press("Tab");
    assert.equal(await page.locator("#editSpoolsOpen").inputValue(), "1");
    assert.match(await page.locator("#toastContainer").innerText(), /sigillate da aprire/);
    await page.locator("#editModalConfirmButton").click();
    assert.equal(await page.evaluate(() => filaments[0].spools_ids.length), 1);
    assert.equal(await page.evaluate(() => filaments[0].total_weight_g), 1000);
  });
});

test("Bambu: nome e colore ufficiali in lista, ricerca e vista posizioni senza modificare il backup", async () => {
  const item = spool({ variant: "10102", color_code: "10102", spools_variants: ["10102"] });
  await withPage(seed([item]), async page => {
    const pill = page.locator("#filamentTableBody .pill-colored").first();
    assert.match(await pill.innerText(), /Argento \(10102\)/);
    assert.match(await pill.getAttribute("style"), /#A6A9AAFF/);
    assert.match(await page.locator('#storageVisualizationContainer [data-spool-id]').first().innerText(), /Argento \(10102\)/);
    if (process.env.V107_SHOTS) await page.locator("#filamentTableBody").screenshot({ path: path.join(process.env.V107_SHOTS, "bambu-names.png") });
    await page.locator("#stockSearchInput").fill("Argento");
    assert.equal(await page.locator("#filamentTableBody .filament-select-checkbox").count(), 1);
    assert.equal(await page.evaluate(() => filaments[0].variant), "10102");
    assert.equal(await page.evaluate(() => filaments[0].color_code), "10102");
  });
});

test("Catalogo: cerca nome commerciale inglese e scegli codice con nome italiano", async () => {
  await withPage(seed(), async page => {
    await page.locator("#addBrandSelect").selectOption("Bambu Lab");
    await page.locator("#addMaterialSelect").selectOption("PLA");
    await page.locator("#addColorDropdownContainer .color-dropdown-trigger").click();
    await page.locator('#floating-layer input[aria-label="Cerca colore"]').fill("Maroon");
    const choice = page.locator('#floating-layer .color-dropdown-option[data-value="10205"]');
    assert.match(await choice.innerText(), /Rosso bordeaux/);
    await choice.click();
    assert.match(await page.locator("#addColorDropdownContainer .color-text").innerText(), /Rosso bordeaux \(10205\)/);
  });
});

async function installBackupTestFolder(page) {
  // Cartella privata del profilo temporaneo: nessun file personale del PC.
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("backup-prova", { create: true });
    };
  });
  await page.reload();
}

test("Backup JSON reale nel profilo temporaneo: scrittura, riapertura e disattivazione", async () => {
  await withPage(seed(), async page => {
    await installBackupTestFolder(page);
    await page.locator("#chooseBackupDirectory").click();
    await page.waitForFunction(() => document.getElementById("fileBackupStatus").textContent.includes("Ultimo JSON:"));
    const readLatest = () => page.evaluate(async () => {
      const root = await navigator.storage.getDirectory(); const folder = await root.getDirectoryHandle("backup-prova");
      const file = await (await folder.getFileHandle("registro_filamenti_ultimo_backup.json")).getFile();
      return JSON.parse(await file.text());
    });
    const data = await readLatest();
    if (process.env.V107_SHOTS) await page.locator(".file-backup-panel").screenshot({ path: path.join(process.env.V107_SHOTS, "backup-status.png") });
    assert.equal(data.filaments[0].remaining_weight_g, 1000); assert.equal(data.file_type, "database_backup");
    await page.reload();
    await page.waitForFunction(() => document.getElementById("fileBackupStatus").textContent.includes("Ultimo JSON:"));
    await page.locator("#disableFileBackup").click();
    await page.waitForFunction(() => document.getElementById("fileBackupStatus").textContent.includes("disattivati"));
    assert.equal((await readLatest()).filaments[0].remaining_weight_g, 1000);
    await page.reload();
    assert.match(await page.locator("#fileBackupStatus").innerText(), /Non configurati/);
  });
});

test("Backup: il timer di cinque minuti salva l'ultima modifica e il file si ripristina", async () => {
  await withPage(seed(), async page => {
    await page.clock.install();
    await installBackupTestFolder(page);
    await page.locator("#chooseBackupDirectory").click();
    await page.waitForFunction(() => document.getElementById("fileBackupStatus").textContent.includes("Ultimo JSON:"));
    await page.evaluate(() => commitMutation("Modifica prova", () => { filaments[0].notes = "modifica prima del backup"; }));
    await page.clock.fastForward(300000);
    await page.waitForFunction(async () => {
      const root = await navigator.storage.getDirectory(); const folder = await root.getDirectoryHandle("backup-prova");
      const file = await (await folder.getFileHandle("registro_filamenti_ultimo_backup.json")).getFile();
      return JSON.parse(await file.text()).filaments[0].notes === "modifica prima del backup";
    });
    assert.equal(await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory(); const folder = await root.getDirectoryHandle("backup-prova");
      const file = await (await folder.getFileHandle("registro_filamenti_ultimo_backup.json")).getFile();
      return validateStateCandidate(JSON.parse(await file.text())).filaments[0].notes;
    }), "modifica prima del backup");
  });
});

test("Backup: permesso negato segnalato e salvataggio browser ancora funzionante", async () => {
  await withPage(seed(), async page => {
    await page.evaluate(() => { fileBackupDirectory = { name: "revocata", queryPermission: async () => "denied" }; });
    await page.locator("#backupNowButton").click();
    await page.waitForFunction(() => document.getElementById("fileBackupStatus").textContent.includes("non riuscito"));
    assert.match(await page.locator("#fileBackupStatus").innerText(), /Autorizza/);
    assert.equal(await page.evaluate(() => commitMutation("nota", () => { filaments[0].notes = "salvata"; })), true);
    await page.reload();
    assert.equal(await page.evaluate(() => filaments[0].notes), "salvata");
  });
});

async function dragSpoolWithMouse(page, spoolId, locationKey) {
  const source = page.locator(`#storageVisualizationContainer [data-spool-id="${spoolId}"]`);
  const target = page.locator(`#storageVisualizationContainer [data-location-key="${locationKey}"]`);
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 50, from.y + 30);
  await page.mouse.down();
  await page.mouse.move(to.x + 100, to.y + 100, { steps: 20 });
  await page.mouse.up();
}

test("Sovraccarico non bloccante, persistente e risoluzione con drag and drop", async () => {
  await withPage(fullAms(), async page => {
    await page.setViewportSize({ width: 1440, height: 2500 });
    await dragSpoolWithMouse(page, "scorta-bobina", "ams-ht");
    assert.match(await page.locator("#capacityAlerts").innerText(), /AMS HT.*2 bobine presenti.*massima 1/);
    assert.equal(await page.locator('#storageVisualizationContainer [data-location-key="ams-ht"].location-over-capacity').count(), 1);
    await page.reload();
    assert.match(await page.locator("#capacityAlerts").innerText(), /AMS HT.*2 bobine presenti/);
    await dragSpoolWithMouse(page, "ht-bobina", "scaffale top");
    await page.waitForFunction(() => filaments.find(f => f.id === "ht").spools_locations[0] === "Scaffale Top");
    assert.equal(await page.locator("#capacityAlerts").isHidden(), true);
    assert.equal(await page.locator('.location-over-capacity').count(), 0);
    assert.equal(await page.evaluate(() => filaments.find(f => f.id === "ht").spools_locations[0]), "Scaffale Top");
    assert.equal(await page.evaluate(() => undoAction()), true);
    assert.match(await page.locator("#capacityAlerts").innerText(), /AMS HT.*2 bobine presenti/);
  });
});

test("Più locazioni sovraccariche e salvataggio editor", async () => {
  const data = fullAms(); data.filaments.push(locatedSpool("extra", "Scaffale Top"));
  await withPage(data, async page => {
    await page.locator('#storageVisualizationContainer [data-spool-id="scorta-bobina"]').click();
    await page.locator('#editOpenSpoolsListContainer select[data-field-type="location"]').selectOption("AMS HT");
    await page.locator("#editModalConfirmButton").click();
    await page.locator('#editFilamentModal').waitFor({ state: 'hidden' });
    await page.locator('#storageVisualizationContainer [data-spool-id="extra-bobina"]').click();
    await page.locator('#editOpenSpoolsListContainer select[data-field-type="location"]').selectOption('AMS/H2D');
    await page.locator('#editModalConfirmButton').click();
    await page.waitForFunction(() => getAmsCapacityConflicts().length === 2);
    const alert = await page.locator("#capacityAlerts").innerText();
    assert.match(alert, /AMS HT.*2 bobine presenti/);
    assert.match(alert, /AMS 2 Pro.*5 bobine presenti/);
    assert.equal(await page.locator('.location-over-capacity').count(), 2);
  });
});

test("Trascinamento verso AMS Pro dopo modifica da finestra", async () => {
  const data = fullAms(); data.filaments.push(locatedSpool("extra", "Scaffale Top"));
  await withPage(data, async page => {
    await page.setViewportSize({ width: 1440, height: 2500 });
    await page.locator('#storageVisualizationContainer [data-spool-id="scorta-bobina"]').click();
    await page.locator('#editOpenSpoolsListContainer select[data-field-type="location"]').selectOption("AMS HT");
    await page.locator('#editModalConfirmButton').click();
    await page.locator('#editFilamentModal').waitFor({ state: 'hidden' });
    const from = await page.locator('#storageVisualizationContainer [data-spool-id="extra-bobina"]').boundingBox();
    const to = await page.locator('#storageVisualizationContainer [data-location-key="ams-pro"]').boundingBox();
    await page.mouse.move(from.x + 50, from.y + 30);
    await page.mouse.down();
    await page.mouse.move(to.x + 100, to.y + 100, { steps: 20 });
    await page.mouse.up();
    await page.waitForFunction(() => getAmsCapacityConflicts().length === 2);
  });
});

test("Backup V318: importa, esporta lo snapshot corrente e ricarica", async () => {
  await withPage(null, async page => {
    page.removeAllListeners("dialog"); page.on("dialog", dialog => dialog.accept());
    await page.locator("#importJsonInput").setInputFiles(backupPath);
    await page.waitForFunction(() => filaments.length > 0);
    const before = await page.evaluate(() => ({ count: filaments.length, grams: filaments.reduce((s, f) => s + f.remaining_weight_g, 0) }));
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportJsonButton").click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(exported.schemaVersion, 4);
    assert.equal(exported.filaments.length, before.count);
    assert.equal(exported.filaments.reduce((s, f) => s + f.remaining_weight_g, 0), before.grams);
    assert.ok(Array.isArray(exported.consumptionHistory));
    assert.ok(Array.isArray(exported.locations));
    assert.ok(exported.settings);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({ count: filaments.length, grams: filaments.reduce((s, f) => s + f.remaining_weight_g, 0) })), before);
  });
});

test("Aggiunta manuale parziale: stato e tabella concordano", async () => {
  await withPage(null, async page => {
    await page.locator("#addBrandSelect").selectOption("Bambu Lab");
    await page.locator("#addMaterialSelect").selectOption("PLA");
    await page.evaluate(() => window.addColorDropdown.setValue("Nero"));
    await page.locator("#addOpenSpoolsInput").fill("1");
    await page.locator("#addFractionSelect").selectOption("0.5");
    await page.locator("#addFilamentButton").click();
    assert.equal(await page.evaluate(() => filaments[0].remaining_weight_g), 500);
    assert.match(await page.locator("#filamentTableBody").innerText(), /500/);
    assert.equal(await page.evaluate(() => window.addColorDropdown.getValue()), "");
  });
});

test("Modifica registra consumo; annulla e ripristina includono lo storico", async () => {
  await withPage(seed(), async page => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator('#editOpenSpoolsListContainer select[data-field-type="fraction"]').first().selectOption("0.5");
    await page.locator("#editModalConfirmButton").click();
    assert.deepEqual(await page.evaluate(() => ({ grams: filaments[0].remaining_weight_g, consumed: consumptionHistory.reduce((s, e) => s + e.gramsConsumed, 0) })), { grams: 500, consumed: 500 });
    await page.evaluate(() => undoAction());
    assert.deepEqual(await page.evaluate(() => ({ grams: filaments[0].remaining_weight_g, history: consumptionHistory.length })), { grams: 1000, history: 0 });
    await page.evaluate(() => redoAction());
    assert.deepEqual(await page.evaluate(() => ({ grams: filaments[0].remaining_weight_g, history: consumptionHistory.length })), { grams: 500, history: 1 });
  });
});

test("Bobina esaurita conserva massa iniziale e storico", async () => {
  await withPage(seed(), async page => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator('#editOpenSpoolsListContainer select[data-field-type="fraction"]').first().selectOption("0");
    await page.locator("#editModalConfirmButton").click();
    const state = await page.evaluate(() => ({ finished: filaments[0].finished_spools, total: filaments[0].total_weight_g, grams: filaments[0].remaining_weight_g, used: filaments[0].used_weight_g }));
    assert.deepEqual(state, { finished: 1, total: 1000, grams: 0, used: 1000 });
    assert.match(await page.locator("#finishedFilamentsSection").innerText(), /1[.\s]?000/);
  });
});

test("Annulla modifica colore individuale non altera l'inventario", async () => {
  await withPage(seed(), async page => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator("#editOpenSpoolsListContainer .color-dropdown-trigger").click();
    await page.locator("#floating-layer .color-dropdown-option").filter({ hasText: /^Rosso$/ }).first().click();
    await page.locator("#editModalCancelButton").click();
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Nero"]);
  });
});

test("Trasferimento bobina aperta mostra il selettore della frazione", async () => {
  await withPage(seed([], [{ id: "buy1", brand: "Bambu Lab", material: "PLA", variant: "Nero", quantity_spools: 2, unit_weight_g: 1000, unit_price: 20, packaging_type: "spool" }]), async page => {
    await page.evaluate(() => openAddToStockModal("buy1"));
    await page.locator("#addToStockSealed").fill("0");
    await page.locator("#addToStockOpen").fill("1");
    assert.equal(await page.locator(".add-to-stock-fraction-select").count(), 1);
    assert.equal(await page.locator("#addToStockOpenSpoolsSection").isVisible(), true);
  });
});

test("Una sola conferma di eliminazione per click", async () => {
  await withPage(seed(), async (page, dialogs) => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Elimina" }).first().click();
    assert.equal(dialogs.length, 1);
    assert.equal(await page.evaluate(() => filaments.length), 1);
  });
});

const splitSpool = () => spool({ spools_total: 2, sealed_spools: 2, open_spools: 0, total_weight_g: 2000, remaining_weight_g: 2000, open_spools_fractions: [], spools_locations: ["Box", "Scaffale"], spools_variants: ["Nero", "Rosso"] });
test("Eliminare una riga preserva le bobine delle altre posizioni", async () => {
  await withPage(seed([splitSpool()]), async page => {
    assert.equal(await page.locator("#filamentTableBody tr").count(), 2);
    page.removeAllListeners("dialog"); page.on("dialog", dialog => dialog.accept());
    await page.locator(".filament-select-checkbox").first().check();
    await page.locator("#deleteSelectedButton").click();
    assert.equal(await page.evaluate(() => filaments.reduce((s, f) => s + f.remaining_weight_g, 0)), 1000);
    assert.equal(await page.locator("#filamentTableBody tr").count(), 1);
  });
});

test("Ricerca considera colore e posizione individuali", async () => {
  await withPage(seed([splitSpool()]), async page => {
    await page.locator("#stockSearchInput").fill("Rosso");
    await page.waitForTimeout(250);
    assert.match(await page.locator("#filamentTableBody").innerText(), /Rosso/);
    await page.locator("#stockSearchInput").fill("Scaffale");
    await page.waitForTimeout(250);
    assert.match(await page.locator("#filamentTableBody").innerText(), /Scaffale/);
  });
});

test("Ordinamento grammi usa il peso, non la percentuale", async () => {
  await withPage(seed([spool({ id: "small", unit_weight_g: 100, total_weight_g: 100, remaining_weight_g: 100 }), spool({ id: "large", open_spools_fractions: [.5], remaining_weight_g: 500 })]), async page => {
    await page.locator('#filamentTable th[data-sort-field="remaining_weight_g"]').first().click();
    assert.equal(await page.locator("#filamentTableBody [data-id]").first().getAttribute("data-id"), "small");
  });
});

test("Dropdown portal: apertura ripetuta e un solo filtro visibile", async () => {
  await withPage(backup, async page => {
    const trigger = page.locator("#addColorContainer .color-dropdown-trigger");
    // Il controllo principale mantiene il proprio riferimento anche fuori dal contenitore.
    const colorTrigger = await trigger.count() ? trigger : page.locator(".color-dropdown-trigger").first();
    await colorTrigger.click(); await colorTrigger.click(); await colorTrigger.click();
    await page.locator("h1").click();
    await page.locator("#stockFilterBrandContainer button").click();
    await page.locator("#stockFilterMaterialContainer button").click();
    assert.equal(await page.locator(".multi-select-menu.is-portal-active").count(), 1);
    await page.locator('#floating-layer input[value="ASA-CF"]').check();
    assert.match(await page.locator("#filamentTableBody").innerText(), /ASA-CF/);
    await page.locator("#resetStockFilters").click();
    assert.ok(await page.locator("#filamentTableBody tr").count() > 1);
  });
});

test("HTML importato rimane testo, anche nello storico e nelle posizioni", async () => {
  const attack = '<img src=x onerror="window.__testXss=1">';
  const data = seed([spool({ brand: attack, material: attack, variant: attack, color_code: attack, location: attack, spools_locations: [attack], spools_variants: [attack] })]);
  data.consumptionHistory = [{ id: "');window.__testXss=1;//", filamentId: "test1", brand: attack, material: attack, variant: attack, timestamp: new Date().toISOString(), gramsConsumed: 10 }];
  await withPage(null, async page => {
    page.removeAllListeners("dialog"); page.on("dialog", dialog => dialog.accept());
    await page.locator("#importJsonInput").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__testXss), undefined);
    assert.equal(await page.locator('img[src="x"]').count(), 0);
    assert.equal(await page.evaluate(() => filaments.length), 1, "I caratteri speciali sono accettati come testo");
    await page.locator("summary").filter({ hasText: "Storico dettagliato consumi" }).click();
    await page.locator("#consumptionHistoryBody button").click();
    assert.equal(await page.evaluate(() => consumptionHistory.length), 0);
    assert.equal(await page.evaluate(() => window.__testXss), undefined);
  });
});

test("Modale chiusa esclusa dal focus, dialog aperto trascinabile", async () => {
  await withPage(backup, async page => {
    assert.equal(await page.evaluate(() => { const e = document.querySelector("#editNotesInput"); e.focus(); return document.activeElement === e; }), false);
    await page.locator("#settingsButton").click(); await page.waitForTimeout(300);
    const dialog = page.locator("#settingsModal .modal-dialog"), header = page.locator("#settingsModal .modal-header");
    const beforeBox = await dialog.boundingBox(), hb = await header.boundingBox();
    await page.mouse.move(hb.x + 80, hb.y + 15); await page.mouse.down();
    await page.mouse.move(hb.x + 180, hb.y + 65, { steps: 10 }); await page.mouse.up();
    const afterBox = await dialog.boundingBox();
    assert.ok(afterBox.x > beforeBox.x + 20, "Il trascinamento cambia la posizione");
    await page.locator("#settingsCloseButton").click();
  });
});

test("Responsive: nessuno scorrimento orizzontale dell'intera pagina", async () => {
  await withPage(backup, async page => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const size = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
      assert.ok(size.body <= size.viewport + 1, JSON.stringify(size));
    }
  });
});

test("Salvataggio indisponibile conserva lo snapshot precedente", async () => {
  await withPage(seed(), async page => {
    assert.equal(await page.evaluate(() => saveState()), true);
    const beforeRaw = await page.evaluate(key => localStorage.getItem(key), key);
    await page.evaluate(key => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("Test quota", "QuotaExceededError"); return set.call(this, name, value); };
      filaments[0].notes = "Modifica non salvata";
    }, key);
    assert.equal(await page.evaluate(() => saveState()), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), beforeRaw);
  });
});

test("JSON corrotto non viene sovrascritto da autosalvataggio", async () => {
  const bad = '{"filaments":';
  await withPage(bad, async page => {
    assert.equal(await page.evaluate(() => saveState()), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), bad);
  });
});

test("Importazione non valida non cambia inventario o salvataggio", async () => {
  await withPage(seed(), async page => {
    await page.evaluate(() => saveState());
    const before = await page.evaluate(key => localStorage.getItem(key), key);
    const broken = { ...seed([spool({ id: "replacement" })]), materials: 123 };
    await page.locator("#importJsonInput").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(broken)) });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => filaments[0].id), "test1");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before);
  });
});

test("Una seconda scheda non sovrascrive modifiche più recenti", async () => {
  await withPage(seed(), async (page, dialogs, context) => {
    await page.evaluate(() => saveState());
    const second = await context.newPage();
    await second.goto(origin);
    assert.equal(await second.evaluate(() => { filaments[0].notes = "Seconda scheda"; return saveState(); }), true);
    await page.waitForFunction(() => storageWriteBlocked);
    assert.equal(await page.evaluate(() => { filaments[0].notes = "Copia precedente"; return saveState(); }), false);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).filaments[0].notes, key), "Seconda scheda");
  });
});

test("Render ripetuti non accumulano listener globali attivi", async () => {
  await withPage(backup, async page => {
    const result = await page.evaluate(() => {
      const records = [];
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, handler, options) {
        if (this === document || this === window) {
          const record = { target: this, type, handler, active: true }; records.push(record);
          options?.signal?.addEventListener("abort", () => { record.active = false; }, { once: true });
        }
        return add.call(this, type, handler, options);
      };
      EventTarget.prototype.removeEventListener = function (type, handler, options) {
        for (const record of records) if (record.target === this && record.type === type && record.handler === handler) record.active = false;
        return remove.call(this, type, handler, options);
      };
      renderAll();
      const before = records.filter(r => r.active).length;
      const start = performance.now();
      for (let i = 0; i < 10; i++) renderAll();
      return { before, after: records.filter(r => r.active).length, elapsedMs: performance.now() - start };
    });
    assert.equal(result.after, result.before);
  });
});

test("Colore personalizzato individuale salva il nome, senza valori di controllo", async () => {
  await withPage(seed(), async (page, dialogs) => {
    page.removeAllListeners("dialog");
    page.on("dialog", async dialog => {
      dialogs.push(dialog.message());
      if (dialog.type() === "prompt") await dialog.accept("Viola personalizzato audit");
      else await dialog.dismiss();
    });
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator("#editOpenSpoolsListContainer .color-dropdown-trigger").click();
    await page.locator('#floating-layer button[data-value="__custom__"]').click();
    assert.match(await page.locator("#editOpenSpoolsListContainer .color-text").innerText(), /Viola personalizzato audit/);
    await page.locator("#editModalConfirmButton").click();
    assert.equal(dialogs.length, 1);
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Viola personalizzato audit"]);
    assert.equal(await page.evaluate(() => colorList.includes("__custom__")), false);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).filaments[0].spools_variants, key), ["Viola personalizzato audit"]);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Viola personalizzato audit"]);
  });
});

test("Colore globale seguito da una scelta individuale conserva entrambe le scelte", async () => {
  const data = seed([spool({
    spools_total: 2, sealed_spools: 1, open_spools: 1,
    total_weight_g: 2000, remaining_weight_g: 2000,
    spools_locations: ["Box", "Box"], spools_variants: ["Nero", "Nero"],
  })]);
  data.colors.push("Blu");
  await withPage(data, async page => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator("#editColorDropdownContainer .color-dropdown-trigger").click();
    await page.locator('#floating-layer button[data-value="Rosso"]').click();
    assert.match(await page.locator("#editSealedSpoolsListContainer .color-text").innerText(), /Rosso/);
    assert.match(await page.locator("#editOpenSpoolsListContainer .color-text").innerText(), /Rosso/);
    await page.locator("#editOpenSpoolsListContainer .color-dropdown-trigger").click();
    await page.locator('#floating-layer button[data-value="Blu"]').click();
    assert.match(await page.locator("#editOpenSpoolsListContainer .color-text").innerText(), /Blu/);
    await page.locator("#editModalConfirmButton").click();
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Rosso", "Blu"]);
    assert.equal(await page.evaluate(() => filaments[0].remaining_weight_g), 2000);
    assert.equal(await page.evaluate(() => consumptionHistory.length), 0);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Rosso", "Blu"]);
  });
});

test("Annullare il colore personalizzato individuale conserva la selezione precedente", async () => {
  await withPage(seed(), async (page, dialogs) => {
    await page.locator("#filamentTableBody button").filter({ hasText: "Modifica" }).first().click();
    await page.locator("#editOpenSpoolsListContainer .color-dropdown-trigger").click();
    await page.locator('#floating-layer button[data-value="__custom__"]').click();
    assert.equal(dialogs.length, 1);
    assert.equal(await page.locator("#editOpenSpoolsListContainer .color-text").innerText(), "Nero");
    await page.locator("#editModalConfirmButton").click();
    assert.deepEqual(await page.evaluate(() => filaments[0].spools_variants), ["Nero"]);
    assert.equal(await page.evaluate(() => colorList.includes("__custom__")), false);
  });
});
