import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findPackageJson(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "package.json");
    try {
      readFileSync(candidate);
      return candidate;
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadVersion(): string {
  const pkgPath = findPackageJson(__dirname) ?? join(__dirname, "../package.json");
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const data = JSON.parse(raw) as { version?: string };
    return data.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = loadVersion();
