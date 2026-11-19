const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist-out");
const deployDir = "E:\\TickNote";
const product = "TickNote";
const version = require(path.join(root, "package.json")).version;

function findPortable() {
  const preferred = path.join(
    outDir,
    `${product}-${version}-Windows-x64.exe`
  );
  if (fs.existsSync(preferred)) return preferred;
  if (!fs.existsSync(outDir)) return null;
  const match = fs
    .readdirSync(outDir)
    .filter((name) => /^TickNote-.*-Windows-x64\.exe$/i.test(name))
    .map((name) => path.join(outDir, name))
    .sort(
      (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
    )[0];
  return match || null;
}

const src = findPortable();
if (!src) {
  console.error(`No portable build found under ${outDir}`);
  process.exit(1);
}

fs.mkdirSync(deployDir, { recursive: true });
const versioned = path.join(deployDir, path.basename(src));
const latest = path.join(deployDir, `${product}.exe`);
fs.copyFileSync(src, versioned);
fs.copyFileSync(src, latest);
console.log(`Deployed:\n  ${versioned}\n  ${latest}`);
