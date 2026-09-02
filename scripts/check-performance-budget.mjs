import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const dist = path.join(root, "dist");
const indexPath = path.join(dist, "index.html");
const initialBudgetBytes = 160 * 1024;
const chunkBudgetBytes = 500 * 1024;

function fail(message) {
  console.error(`PERFORMANCE: REPROVADO — ${message}`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  fail("dist/index.html não existe. Execute npm run build primeiro.");
}

const html = fs.readFileSync(indexPath, "utf8");
const initialAssetPaths = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)]
      .map((match) => match[1]),
  ),
];

if (initialAssetPaths.length === 0) {
  fail("nenhum asset inicial foi encontrado no HTML de produção.");
}

let initialGzipBytes = 0;
for (const assetPath of initialAssetPaths) {
  const absolutePath = path.join(dist, assetPath.replace(/^\//, ""));
  if (!fs.existsSync(absolutePath)) {
    fail(`asset inicial ausente: ${assetPath}`);
  }
  initialGzipBytes += gzipSync(fs.readFileSync(absolutePath)).length;
}

const assetDirectory = path.join(dist, "assets");
const oversizedChunks = fs.readdirSync(assetDirectory)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: fs.statSync(path.join(assetDirectory, name)).size }))
  .filter(({ bytes }) => bytes > chunkBudgetBytes)
  .sort((a, b) => b.bytes - a.bytes);

if (initialGzipBytes > initialBudgetBytes) {
  fail(
    `carregamento inicial de ${(initialGzipBytes / 1024).toFixed(1)} kB gzip excede o limite de ${initialBudgetBytes / 1024} kB.`,
  );
}
if (oversizedChunks.length > 0) {
  fail(
    `chunks acima de ${chunkBudgetBytes / 1024} kB: ${oversizedChunks.map(({ name, bytes }) => `${name} (${(bytes / 1024).toFixed(1)} kB)`).join(", ")}.`,
  );
}

console.log(
  `PERFORMANCE: APROVADO — ${(initialGzipBytes / 1024).toFixed(1)} kB gzip no carregamento inicial; nenhum chunk acima de ${chunkBudgetBytes / 1024} kB.`,
);
