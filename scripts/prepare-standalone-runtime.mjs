import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  copyRecursive(src, dest);
}

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("Standalone output not found at .next/standalone/server.js");
  process.exit(1);
}

copyIfExists(path.join(rootDir, "public"), path.join(standaloneDir, "public"));
copyIfExists(path.join(rootDir, ".next", "static"), path.join(standaloneNextDir, "static"));
copyIfExists(path.join(rootDir, "custom-server.js"), path.join(standaloneDir, "custom-server.js"));

console.log("Prepared standalone runtime assets.");
