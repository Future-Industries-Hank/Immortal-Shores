/** FULL-OVERHAUL gallery: board TOD, all hero close-ups, every UI surface, mobile. */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const OUT = "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/gallery";
mkdirSync(OUT, { recursive: true });
const TOKEN = readFileSync(
  "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/token.env",
  "utf8").trim().split("=")[1];

const KINDS = ["great_house", "market", "emmer_field", "mudbrick_yard", "harbor",
  "river_clay_pit", "marsh_reed_bed", "ration_house", "vessel_shop",
  "reed_basket_shop", "luxury_workshop", "luxury_material", "warehouse",
  "shrine", "training_grounds"];

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const hideChrome = (page) => page.evaluate(() => {
  for (const id of ["goals", "tutorial", "toast", "hint", "prod-overlay",
    "ration-warn", "standard-view-label"]) {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.style.display = "none"; }
  }
});
const dismissTutorial = async (page) => {
  try {
    const skip = page.getByRole("button", { name: /skip tutorial/i });
    if (await skip.isVisible({ timeout: 1800 })) await skip.click();
  } catch { /* none */ }
};

async function withPage(opts, fn) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  if (!opts.anon) {
    await ctx.addInitScript(([t]) => localStorage.setItem("immortal_token", t), [TOKEN]);
  }
  const page = await ctx.newPage();
  try {
    await page.goto(opts.url ?? "http://127.0.0.1:5173/", { waitUntil: "networkidle" });
    await fn(page);
  } catch (e) {
    console.log("FAIL", opts.name ?? opts.url, String(e).slice(0, 140));
  }
  await ctx.close();
}

// 1. Login (anonymous)
await withPage({ anon: true, name: "ui-login" }, async (p) => {
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/ui-login.png` });
  console.log("captured ui-login");
});

// 2. Board day / dusk / night
for (const tod of ["day", "dusk", "night"]) {
  await withPage({ name: `board-${tod}` }, async (p) => {
    await dismissTutorial(p);
    await hideChrome(p);
    try { await p.selectOption("#tod", tod); } catch { /* keep */ }
    await p.waitForTimeout(5200);
    await hideChrome(p);
    await p.screenshot({ path: `${OUT}/board-${tod}.png` });
    console.log("captured board-" + tod);
  });
}

// 3. Hero close-ups (all kinds)
for (const kind of KINDS) {
  await withPage({ url: `http://127.0.0.1:5173/?closeup=${kind}`, name: kind }, async (p) => {
    await dismissTutorial(p);
    await hideChrome(p);
    await p.waitForTimeout(5000);
    await hideChrome(p);
    await p.screenshot({ path: `${OUT}/kind-${kind}.png` });
    console.log("captured kind-" + kind);
  });
}

// 4. UI panels via nav buttons
const PANELS = [
  ["ui-shore", "#btn-shore, #nav button:has-text('Shore')"],
  ["ui-harbor", "#btn-harbor, #nav button:has-text('Harbor')"],
  ["ui-tablets", "#btn-tablets, #nav button:has-text('Tablets')"],
  ["ui-allies", "#btn-allies, #nav button:has-text('Allies')"],
  ["ui-wall", "#btn-wall, #nav button:has-text('Wall')"],
  ["ui-build", "#btn-build, #nav button:has-text('Build')"],
  ["ui-military", "#btn-military, #nav button:has-text('Military')"],
];
for (const [name, sel] of PANELS) {
  await withPage({ name }, async (p) => {
    await dismissTutorial(p);
    await hideChrome(p);
    await p.waitForTimeout(2500);
    const btn = p.locator(sel).first();
    await btn.click({ timeout: 4000 });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    console.log("captured " + name);
  });
}

// 5. World map
await withPage({ name: "ui-map" }, async (p) => {
  await dismissTutorial(p);
  await hideChrome(p);
  await p.waitForTimeout(2500);
  await p.locator("#btn-map, button:has-text('Map')").first().click({ timeout: 4000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/ui-map.png` });
  console.log("captured ui-map");
});

// 6. Inspect popup (open shore, click first building row Open)
await withPage({ name: "ui-inspect" }, async (p) => {
  await dismissTutorial(p);
  await hideChrome(p);
  await p.waitForTimeout(2500);
  await p.locator("#nav button").first().click({ timeout: 4000 });
  await p.waitForTimeout(800);
  await p.locator("button:has-text('Open')").first().click({ timeout: 4000 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/ui-inspect.png` });
  console.log("captured ui-inspect");
});

// 7. Tutorial + goals (fresh eyes: don't dismiss)
await withPage({ name: "ui-tutorial" }, async (p) => {
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}/ui-tutorial.png` });
  console.log("captured ui-tutorial");
});

// 8. Mobile board + a panel
await withPage({ name: "mobile-board", viewport: { width: 390, height: 844 } }, async (p) => {
  await dismissTutorial(p);
  await hideChrome(p);
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `${OUT}/mobile-board.png` });
  console.log("captured mobile-board");
});
await withPage({ name: "mobile-panel", viewport: { width: 390, height: 844 } }, async (p) => {
  await dismissTutorial(p);
  await hideChrome(p);
  await p.waitForTimeout(3000);
  await p.locator("#nav button").first().click({ timeout: 4000 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/mobile-panel.png` });
  console.log("captured mobile-panel");
});

await browser.close();
console.log("GALLERY DONE");
