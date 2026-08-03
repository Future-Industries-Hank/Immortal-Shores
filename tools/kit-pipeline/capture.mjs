/** Live-game evidence capture: full board + hero close-ups. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const OUT = process.env.OUT_DIR ??
  "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/live";
const TOKEN = readFileSync(
  "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/token.env",
  "utf8").trim().split("=")[1];

const HEROES = ["great_house", "market", "emmer_field", "mudbrick_yard", "harbor"];
const shots = process.argv[2] === "board" ? [] : HEROES;

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await ctx.addInitScript(([t]) => {
  localStorage.setItem("immortal_token", t);
}, [TOKEN]);

async function snap(url, file, settleMs = 5200) {
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      console.log(`[console:${file}]`, m.text().slice(0, 160));
  });
  await page.goto(url, { waitUntil: "networkidle" });
  // Dismiss tutorial + hide overlay chrome (world + resource strip only)
  try {
    const skip = page.getByRole("button", { name: /skip tutorial/i });
    if (await skip.isVisible({ timeout: 2500 })) await skip.click();
  } catch { /* no tutorial */ }
  await page.evaluate(() => {
    for (const id of ["goals", "tutorial", "menu-popup", "building-inspect",
      "toast", "hint", "prod-overlay", "ration-warn", "hub",
      "standard-view-label"]) {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.style.display = "none"; }
    }
    document.querySelectorAll(
      "#tutorial button, .tutorial-panel, .goals-panel"
    ).forEach((el) => { el.style.display = "none"; });
  });
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  await page.close();
  console.log("captured", file);
}

await snap("http://127.0.0.1:5173/", "full-board-day");
for (const kind of shots) {
  await snap(`http://127.0.0.1:5173/?closeup=${kind}`, `game-${kind}`);
}
await browser.close();
console.log("ALL DONE");
