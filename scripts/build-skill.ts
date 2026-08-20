#!/usr/bin/env tsx
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const src = join(root, "skills/do-axi/SKILL.md");
const outDir = join(root, "dist/skills/do-axi");
const out = join(outDir, "SKILL.md");

if (!existsSync(src)) {
  console.error(`SKILL.md not found at ${src}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, out);

// Generate minimal manifest for release tooling
const manifestPath = join(outDir, "manifest.json");
const skillContent = readFileSync(src, "utf-8");
const nameMatch = skillContent.match(/^name:\s*(.+)$/m);
const descMatch = skillContent.match(/^description:\s*(.+)$/m);
const manifest = {
  name: nameMatch?.[1]?.trim() ?? "do-axi",
  description: descMatch?.[1]?.trim() ?? "Agent-ergonomic CLI for DigitalOcean",
  version: JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version,
  entry: "SKILL.md",
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`built skill: ${out}`);
