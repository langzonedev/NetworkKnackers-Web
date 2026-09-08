import { readFile, access } from "node:fs/promises";

const required = ["index.html", "styles.css", "app.js", "capabilities.js", "manifest.webmanifest", "sw.js", "icons/icon.svg"];
await Promise.all(required.map((path) => access(new URL(`../${path}`, import.meta.url))));

const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
if (manifest.start_url !== "./" || manifest.scope !== "./" || manifest.display !== "standalone") {
  throw new Error("Manifest is not GitHub Pages-compatible/installable");
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
for (const ref of ["manifest.webmanifest", "styles.css", "app.js"]) {
  if (!html.includes(ref)) throw new Error(`Missing HTML reference: ${ref}`);
}

const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
for (const asset of required.filter((path) => path !== "sw.js")) {
  if (!sw.includes(`./${asset}`) && asset !== "index.html") throw new Error(`Service worker shell misses: ${asset}`);
}

console.log(`Static PWA check passed (${required.length} required assets).`);
