import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Every supported layout places this file one level below the package root:
// src/version.ts under tsx-dev, dist/version.js in the built and published tree.
function loadVersion(): string {
  const pkgPath = join(__dirname, "../package.json");
  if (!existsSync(pkgPath)) return "0.0.0";
  try {
    const data = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return data.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = loadVersion();
