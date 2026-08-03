/** Dump mesh names near a world position to identify mystery geometry. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const TOKEN = readFileSync(
  "/tmp/claude-1000/-home-eric/f840123e-860a-4c45-add6-0b16a98ff524/scratchpad/token.env",
  "utf8").trim().split("=")[1];
const [cx, cz, r] = process.argv.slice(2).map(Number);

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
await ctx.addInitScript(([t]) => localStorage.setItem("immortal_token", t), [TOKEN]);
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
const out = await page.evaluate(([cx, cz, r]) => {
  // @ts-ignore
  const scene = window.__scene ?? null;
  const engine = (window).BABYLON?.EngineStore?.LastCreatedScene;
  const sc = scene || engine;
  if (!sc) return ["no scene handle"];
  const res = [];
  for (const m of sc.meshes) {
    const p = m.getAbsolutePosition ? m.getAbsolutePosition() : m.position;
    const dx = p.x - cx, dz = p.z - cz;
    if (Math.hypot(dx, dz) < r) {
      res.push(`${m.name} @(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})` +
        ` vis=${m.visibility} alpha=${m.material?.alpha ?? "-"}`);
    }
  }
  return res;
}, [cx, cz, r]);
console.log(out.join("\n"));
await browser.close();
