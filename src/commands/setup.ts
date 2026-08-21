import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { encode } from "@toon-format/toon";
import { AxiError, installSessionStartHooks } from "axi-sdk-js";

export const SETUP_HELP = encode({
  command: "setup",
  description: "Manage doctl-axi setup including ambient hooks",
  usage: "doctl-axi setup <subcommand> [flags]",
  subcommands: {
    hooks: "Install ambient SessionStart hooks for Claude/Codex/OpenCode",
  },
  flags: {
    "--check": "Verify installed hooks vs expected (report OK or DRIFT)",
    "--help": "Show help",
  },
  examples: ["doctl-axi setup hooks", "doctl-axi setup hooks --check"],
});

function hasMarkerInFile(path: string, marker: string): boolean {
  try {
    if (!existsSync(path)) return false;
    const content = readFileSync(path, "utf-8");
    return content.includes(marker);
  } catch {
    return false;
  }
}

function checkHooksDrift(marker = "doctl-axi"): { drift: boolean; details: Record<string, unknown> } {
  const home = homedir();
  const claudeSettings = join(home, ".claude", "settings.json");
  const codexHooks = join(home, ".codex", "hooks.json");
  const opencodePlugin = join(home, ".config", "opencode", "plugins", `axi-${marker}.js`);
  const codexConfig = join(home, ".codex", "config.toml");

  const claudeOk = hasMarkerInFile(claudeSettings, marker);
  const codexOk = hasMarkerInFile(codexHooks, marker);
  const opencodeOk = hasMarkerInFile(opencodePlugin, marker);
  // codex config should contain hooks = true when hooks installed
  let codexConfigOk = true;
  try {
    if (existsSync(codexConfig)) {
      const c = readFileSync(codexConfig, "utf-8");
      // if file exists, it should contain hooks = true
      if (claudeOk || codexOk) {
        codexConfigOk = c.includes("hooks");
      }
    } else {
      // if hooks are expected but config missing, consider drift if any hook missing?
      // config is auto-created by installer, so missing when hooks expected is drift
      if (claudeOk || codexOk || opencodeOk) {
        // if any hook file exists, config should exist
        // but if none exist, missing config is also drift when we expect install
        codexConfigOk = false;
      } else {
        codexConfigOk = false;
      }
    }
  } catch {
    codexConfigOk = false;
  }

  // For check, drift if any of the required files missing marker
  // Require at least claude and codex hooks, opencode and codex config are also required
  const drift = !(claudeOk && codexOk && opencodeOk && codexConfigOk);
  const details: Record<string, unknown> = {
    claude: claudeOk ? "ok" : "missing",
    codex: codexOk ? "ok" : "missing",
    opencode: opencodeOk ? "ok" : "missing",
    codexConfig: codexConfigOk ? "ok" : "missing",
  };
  return { drift, details };
}

export async function setupCommand(args: string[], _context: unknown): Promise<string> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return SETUP_HELP;
  }
  const sub = args[0];
  if (sub !== "hooks") {
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: hooks", "Run `doctl-axi setup --help`"]);
  }
  const rest = args.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) {
    return SETUP_HELP;
  }
  // validate flags
  for (const a of rest) {
    if (a.startsWith("-") && a !== "--check") {
      throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", ["Run `doctl-axi setup hooks --help`"]);
    }
  }
  const check = rest.includes("--check");
  if (check) {
    const { drift, details } = checkHooksDrift("doctl-axi");
    if (drift) {
      return encode({
        code: "DRIFT",
        status: "drift detected",
        hooks: details,
        help: ["doctl-axi setup hooks to reinstall"],
      });
    }
    return encode({
      code: "OK",
      status: "hooks installed",
      hooks: details,
      help: ["doctl-axi setup hooks --check to verify"],
    });
  }

  // install hooks idempotent
  try {
    // axi-sdk-js installSessionStartHooks handles marker inference from execPath
    // It writes to homedir() which respects HOME env override
    installSessionStartHooks();
  } catch (e) {
    // if SDK not available, fallback manual already done via SDK, but handle error
    const msg = e instanceof Error ? e.message : String(e);
    throw new AxiError(`Failed to install hooks: ${msg}`, "UNKNOWN", []);
  }

  // after install, verify — if still drift (e.g., execPath ends with .ts via tsx), report DRIFT not OK
  const { drift: driftAfter, details: detailsAfter } = checkHooksDrift("doctl-axi");
  if (driftAfter) {
    return encode({
      code: "DRIFT",
      status: "drift detected",
      hooks: detailsAfter,
      help: ["doctl-axi setup hooks to reinstall"],
    });
  }
  return encode({
    code: "OK",
    status: "hooks installed",
    hooks: detailsAfter,
    help: ["doctl-axi setup hooks --check to verify"],
  });
}
