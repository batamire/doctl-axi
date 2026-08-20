import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toDatabaseToon, truncateField } from "../lib/toon.js";
import type { DatabaseRaw } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const KNOWN_FLAGS = new Set(["--full", "--fields", "--context", "--help", "-h"]);
const KNOWN_FLAGS_WITH_VALUE = new Set(["--fields", "--context"]);

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (!arg.startsWith("-")) continue;
    if (arg === "--help" || arg === "-h") continue;
    if (KNOWN_FLAGS.has(arg)) {
      if (KNOWN_FLAGS_WITH_VALUE.has(arg)) i++;
      continue;
    }
    if (arg.startsWith("--fields=") || arg.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${arg}`, "VALIDATION_ERROR", [
      `Run \`do-axi ${command} ${sub} --help\` for available flags`,
    ]);
  }
}

function takeBoolFlag(args: string[], flag: string): boolean {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

function takeFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1) {
    const val = args[idx + 1];
    if (val === undefined || val.startsWith("-")) {
      throw new AxiError(`flag ${flag} requires a value`, "VALIDATION_ERROR", [
        `Run \`do-axi database --help\` for available flags`,
      ]);
    }
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const val = args[foundIndex].slice(prefix.length);
    args.splice(foundIndex, 1);
    return val;
  }
  return undefined;
}

export const DATABASE_HELP = encode({
  command: "database",
  description: "Manage Database clusters and related resources",
  usage: "do-axi database <subcommand> [flags]",
  subcommands: {
    list: "List Database clusters",
    get: "Get a Database by id",
    create: "Create a Database",
    delete: "Delete a Database",
    user: "Manage database users (list|get|create|delete)",
    topic: "Manage Kafka topics (list|get|create|delete)",
    pool: "Manage connection pools (list|get|create|delete)",
    config: "Manage database configuration",
    firewall: "Manage database firewalls",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,engine,version,region,status)",
    "--context": "doctl context name",
  },
  examples: [
    "do-axi database list",
    "do-axi database list --fields id,name,engine",
    "do-axi database get <id>",
    "do-axi database user list <id>",
    "do-axi database topic list <id>",
  ],
});

export async function databaseCommand(args: string[], _context: unknown): Promise<string> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return DATABASE_HELP;
  }
  const sub = args[0];
  if (sub === "list") return databaseList(args.slice(1));
  if (sub === "get") return databaseGet(args.slice(1));
  if (sub === "create") return databaseCreate(args.slice(1));
  if (sub === "delete") return databaseDelete(args.slice(1));
  if (sub === "user") return databaseUser(args.slice(1));
  if (sub === "topic") return databaseTopic(args.slice(1));
  if (sub === "pool") return databasePool(args.slice(1));
  if (sub === "config") return databaseConfig(args.slice(1));
  if (sub === "firewall") return databaseFirewall(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Available: list, get, create, delete, user, topic, pool, config, firewall",
    "Run `do-axi database --help`",
  ]);
}

async function databaseList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return DATABASE_HELP;
  }
  rejectUnknownFlags(rawArgs, "database", "list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi database list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `do-axi database list --help`"]);
  }
  const allowed = new Set(["id", "name", "engine", "version", "region", "status"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,engine,version,region,status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,engine,version,region,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["databases", "list"], contextFlag);
  const rawArray = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) {
    return "0 databases";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    return toDatabaseToon(rec as unknown as DatabaseRaw, full);
  });
  // engine bucket aggregate
  const engineCounts: Record<string, number> = {};
  for (const d of mapped) {
    const e = d.engine || "unknown";
    engineCounts[e] = (engineCounts[e] ?? 0) + 1;
  }
  const engineSorted = Object.keys(engineCounts).sort();
  const engineLine = engineSorted.map((k) => `${k}=${engineCounts[k]}`).join(", ");

  let filtered: Record<string, unknown>[];
  if (fields) {
    filtered = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else {
    filtered = mapped as unknown as Record<string, unknown>[];
  }
  const payload: Record<string, unknown> = {
    count: `${mapped.length} total`,
    engine: engineLine,
    databases: filtered,
    help: [`database get ${mapped[0].id} for detail`, "do-axi database list --full"],
  };
  return encode(payload);
}

async function databaseGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  rejectUnknownFlags(rawArgs, "database", "get");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi database get --help`"]);
  if (args.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: do-axi database get <id>"]);
  const id = args[0];
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = new Set(["id", "name", "engine", "version", "region", "status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,engine,version,region,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["databases", "get", id], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") throw new AxiError(`Database ${id} not found`, "NOT_FOUND", []);
  const mapped = toDatabaseToon(rec as unknown as DatabaseRaw, full);
  let filtered: Record<string, unknown> = mapped as unknown as Record<string, unknown>;
  if (fields) {
    const obj: Record<string, unknown> = {};
    for (const f of fields) obj[f] = (mapped as Record<string, unknown>)[f];
    filtered = obj;
  }
  return encode({ database: filtered, help: ["do-axi database list --full"] });
}

async function databaseCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  // allow pass-through flags like --engine, --region, etc.
  // do not reject unknown flags for create
  if (args.length === 0) throw new AxiError("Missing database name", "VALIDATION_ERROR", ["Usage: do-axi database create <name> [flags]"]);
  const name = args[0];
  const rest = args.slice(1);
  const raw = await doctlJson<unknown>(["databases", "create", name, ...rest], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") return encode({ result: raw, help: ["do-axi database list"] });
  const mapped = toDatabaseToon(rec as unknown as DatabaseRaw, full);
  return encode({ database: mapped as unknown as Record<string, unknown>, help: ["do-axi database list"] });
}

async function databaseDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  rejectUnknownFlags(rawArgs, "database", "delete");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi database delete --help`"]);
  if (args.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database delete <id>"]);
  const id = args[0];
  const raw = await doctlJson<unknown>(["databases", "delete", id], contextFlag);
  if (Array.isArray(raw) && raw.length === 0) return encode({ deleted: id, help: ["do-axi database list"] });
  return encode({ deleted: id, result: raw, help: ["do-axi database list"] });
}

// Generic helpers for sub-resources

function takeSubActionArgs(rawArgs: string[]): { action: string; remaining: string[]; full: boolean; contextFlag?: string } {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    throw new AxiError("__HELP__", "VALIDATION_ERROR", []);
  }
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  // --fields not typical for users but allow
  const fieldsArg = takeFlagValue(args, "--fields");
  if (fieldsArg !== undefined) {
    // just ignore for generic, but validate not needed
  }
  if (args.length === 0) throw new AxiError("Missing action", "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
  const action = args[0];
  const remaining = args.slice(1);
  return { action, remaining, full, contextFlag };
}

async function databaseUser(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  let parsed: { action: string; remaining: string[]; full: boolean; contextFlag?: string };
  try {
    parsed = takeSubActionArgs(rawArgs);
  } catch (e) {
    if (e instanceof AxiError && e.message === "__HELP__") return DATABASE_HELP;
    throw e;
  }
  const { action, remaining, full, contextFlag } = parsed;
  if (action === "list") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database user list <db-id>"]);
    const dbId = remaining[0];
    const raw = await doctlJson<unknown>(["databases", "user", "list", dbId], contextFlag);
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return "0 users";
    const mapped = arr.map((item) => {
      const rec = item as Record<string, unknown>;
      // user fields: name, role, type, state
      const name = typeof rec["name"] === "string" ? truncateField(rec["name"] as string, full) : "";
      const role = typeof rec["role"] === "string" ? truncateField(rec["role"] as string, full) : "";
      const type = typeof rec["type"] === "string" ? truncateField(rec["type"] as string, full) : "";
      return { name, role, type };
    });
    return encode({ count: `${mapped.length} total`, users: mapped, help: ["do-axi database user list --full"] });
  }
  if (action === "get") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database user get <db-id> <user>"]);
    const raw = await doctlJson<unknown>(["databases", "user", "get", remaining[0], remaining[1]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ user: rec, help: ["do-axi database user list"] });
  }
  if (action === "create") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database user create <db-id> <user>"]);
    const raw = await doctlJson<unknown>(["databases", "user", "create", ...remaining], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ user: rec, help: ["do-axi database user list"] });
  }
  if (action === "delete") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database user delete <db-id> <user>"]);
    const raw = await doctlJson<unknown>(["databases", "user", "delete", ...remaining], contextFlag);
    return encode({ deleted: remaining[1], result: raw, help: ["do-axi database user list"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
}

async function databaseTopic(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  let parsed: { action: string; remaining: string[]; full: boolean; contextFlag?: string };
  try {
    parsed = takeSubActionArgs(rawArgs);
  } catch (e) {
    if (e instanceof AxiError && e.message === "__HELP__") return DATABASE_HELP;
    throw e;
  }
  const { action, remaining, full, contextFlag } = parsed;
  if (action === "list") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database topic list <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "topic", "list", remaining[0]], contextFlag);
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return "0 topics";
    const mapped = arr.map((item) => {
      const rec = item as Record<string, unknown>;
      const name = typeof rec["name"] === "string" ? truncateField(rec["name"] as string, full) : "";
      const state = typeof rec["state"] === "string" ? truncateField(rec["state"] as string, full) : "";
      const partitions = rec["partitions"] !== undefined ? String(rec["partitions"]) : "";
      return { name, state, partitions };
    });
    return encode({ count: `${mapped.length} total`, topics: mapped, help: ["do-axi database topic list --full"] });
  }
  if (action === "get") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database topic get <db-id> <topic>"]);
    const raw = await doctlJson<unknown>(["databases", "topic", "get", remaining[0], remaining[1]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ topic: rec, help: ["do-axi database topic list"] });
  }
  if (action === "create") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database topic create <db-id> <topic>"]);
    const raw = await doctlJson<unknown>(["databases", "topic", "create", ...remaining], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ topic: rec, help: ["do-axi database topic list"] });
  }
  if (action === "delete") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database topic delete <db-id> <topic>"]);
    const raw = await doctlJson<unknown>(["databases", "topic", "delete", ...remaining], contextFlag);
    return encode({ deleted: remaining[1], result: raw, help: ["do-axi database topic list"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
}
async function databasePool(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  let parsed: { action: string; remaining: string[]; full: boolean; contextFlag?: string };
  try {
    parsed = takeSubActionArgs(rawArgs);
  } catch (e) {
    if (e instanceof AxiError && e.message === "__HELP__") return DATABASE_HELP;
    throw e;
  }
  const { action, remaining, full, contextFlag } = parsed;
  if (action === "list") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database pool list <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "pool", "list", remaining[0]], contextFlag);
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return "0 pools";
    const mapped = arr.map((item) => {
      const rec = item as Record<string, unknown>;
      const name = typeof rec["name"] === "string" ? truncateField(rec["name"] as string, full) : "";
      const mode = typeof rec["mode"] === "string" ? truncateField(rec["mode"] as string, full) : "";
      const size = rec["size"] !== undefined ? String(rec["size"]) : "";
      return { name, mode, size };
    });
    return encode({ count: `${mapped.length} total`, pools: mapped, help: ["do-axi database pool list --full"] });
  }
  if (action === "get") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database pool get <db-id> <pool>"]);
    const raw = await doctlJson<unknown>(["databases", "pool", "get", remaining[0], remaining[1]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ pool: rec, help: ["do-axi database pool list"] });
  }
  if (action === "create") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database pool create <db-id> <pool>"]);
    const raw = await doctlJson<unknown>(["databases", "pool", "create", ...remaining], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    return encode({ pool: rec, help: ["do-axi database pool list"] });
  }
  if (action === "delete") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi database pool delete <db-id> <pool>"]);
    const raw = await doctlJson<unknown>(["databases", "pool", "delete", ...remaining], contextFlag);
    return encode({ deleted: remaining[1], result: raw, help: ["do-axi database pool list"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
}

async function databaseConfig(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  let parsed: { action: string; remaining: string[]; full: boolean; contextFlag?: string };
  try {
    parsed = takeSubActionArgs(rawArgs);
  } catch (e) {
    if (e instanceof AxiError && e.message === "__HELP__") return DATABASE_HELP;
    throw e;
  }
  const { action, remaining, contextFlag } = parsed;
  if (action === "get" || action === "list" || action === "show") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database config get <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "configuration", "list", remaining[0]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as unknown;
    return encode({ config: rec, help: ["do-axi database config get <id>"] });
  }
  if (action === "update" || action === "set") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database config update <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "configuration", "update", ...remaining], contextFlag);
    return encode({ config: raw, help: ["do-axi database config get"] });
  }
  // allow "list" implied if no action but id provided? handle direct id case
  if (remaining.length === 0 && action && !["list", "get", "show", "update", "set"].includes(action)) {
    // treat action as id for get
    const raw = await doctlJson<unknown>(["databases", "configuration", "list", action], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as unknown;
    return encode({ config: rec, help: ["do-axi database config get <id>"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: get, update"]);
}

async function databaseFirewall(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  let parsed: { action: string; remaining: string[]; full: boolean; contextFlag?: string };
  try {
    parsed = takeSubActionArgs(rawArgs);
  } catch (e) {
    if (e instanceof AxiError && e.message === "__HELP__") return DATABASE_HELP;
    throw e;
  }
  const { action, remaining, contextFlag } = parsed;
  if (action === "list" || action === "get") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database firewall list <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "list", remaining[0]], contextFlag);
    const arr = Array.isArray(raw) ? raw : [raw];
    if (arr.length === 0 || (arr.length === 1 && Object.keys(arr[0] as object).length === 0)) return "0 firewalls";
    // firewall may be object with rules field
    const rec = arr[0] as Record<string, unknown>;
    if ("rules" in rec && Array.isArray(rec["rules"])) {
      const rules = rec["rules"] as unknown[];
      if (rules.length === 0) return "0 firewalls";
      return encode({ count: `${rules.length} total`, firewalls: rules, help: ["do-axi database firewall list --full"] });
    }
    return encode({ count: `${arr.length} total`, firewalls: arr, help: ["do-axi database firewall list --full"] });
  }
  if (action === "update" || action === "append" || action === "set") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database firewall update <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "update", ...remaining], contextFlag);
    return encode({ firewall: raw, help: ["do-axi database firewall list"] });
  }
  if (action === "create" || action === "add") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: do-axi database firewall create <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "append", remaining[0], ...remaining.slice(1)], contextFlag);
    return encode({ firewall: raw, help: ["do-axi database firewall list"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, update"]);
}
