/**
 * Postbuild: precompress dist model files so the origin can serve them encoded.
 *
 * Cloudflare brotlis text types (js/css/html) at the edge but not
 * model/gltf-binary, and the .glb library is ~84% of a cold boot — measured
 * 0.43-0.56x under gzip, ~3.3 MB saved per new player. Node's zlib does both
 * encodings, so this adds no dependency and runs fine under `npm ci && npm run
 * build` on the FI box. The server (index.ts static handler) serves the .br/.gz
 * sibling when Accept-Encoding allows and falls back to the raw file otherwise.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const DIST = new URL("../dist", import.meta.url).pathname;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let files = 0;
let raw = 0;
let br = 0;
for (const p of walk(DIST)) {
  if (extname(p) !== ".glb") continue;
  const buf = readFileSync(p);
  const b = brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 9,
      [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  });
  const g = gzipSync(buf, { level: 9 });
  writeFileSync(`${p}.br`, b);
  writeFileSync(`${p}.gz`, g);
  files++;
  raw += buf.length;
  br += b.length;
}
console.log(
  `compress-dist: ${files} .glb — ${(raw / 1048576).toFixed(1)} MB raw -> ${(br / 1048576).toFixed(1)} MB br`
);
