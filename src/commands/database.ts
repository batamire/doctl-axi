import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson } from "../lib/doctl.js";
import {
  toDatabasePoolToon,
  projectFields,
  toDatabaseTopicToon,
  toDatabaseToon,
  toDatabaseUserToon,
} from "../lib/toon.js";
import type { DatabasePoolRaw, DatabaseRaw, DatabaseTopicRaw, DatabaseUserRaw } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

// Flags forwarded verbatim to `doctl databases create`, in addition to the
// locally consumed --full/--context.
const CREATE_ALLOWED_FLAGS = [
  "--full",
  "--context",
  "--engine",
  "--version",
  "--region",
  "--size",
  "--num-nodes",
  "--private-network-uuid",
  "--tag",
  "--maintenance-window",
  "--wait",
  "--storage-size-mib",
];


export const DATABASE_HELP = encode({
  command: "database",
  description: "Manage Database clusters and related resources",
  usage: "doctl-axi database <subcommand> [flags]",
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
    "doctl-axi database list",
    "doctl-axi database list --fields id,name,engine",
    "doctl-axi database get <id>",
    "doctl-axi database user list <id>",
    "doctl-axi database topic list <id>",
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
  if (sub === "user") return databaseSubResource(args.slice(1), SUBRESOURCES.user);
  if (sub === "topic") return databaseSubResource(args.slice(1), SUBRESOURCES.topic);
  if (sub === "pool") return databaseSubResource(args.slice(1), SUBRESOURCES.pool);
  if (sub === "config") return databaseConfig(args.slice(1));
  if (sub === "firewall") return databaseFirewall(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Available: list, get, create, delete, user, topic, pool, config, firewall",
    "Run `doctl-axi database --help`",
  ]);
}

async function databaseList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return DATABASE_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi database list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi database list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi database list --help`"]);
  }
  const fields = parseFields(fieldsArg, ["id", "name", "engine", "version", "region", "status"]);
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

  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length} total`,
    engine: engineLine,
    databases: filtered,
    help: [`database get ${mapped[0].id} for detail`, "doctl-axi database list --full"],
  };
  return encode(payload);
}

async function databaseGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi database get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi database get --help`"]);
  if (args.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi database get <id>"]);
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
  const filtered = projectFields([mapped as unknown as Record<string, unknown>], fields)[0];
  return encode({ database: filtered, help: ["doctl-axi database list --full"] });
}

async function databaseCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  rejectUnknownFlags(rawArgs, CREATE_ALLOWED_FLAGS, "Run `doctl-axi database create --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  if (args.length === 0) throw new AxiError("Missing database name", "VALIDATION_ERROR", ["Usage: doctl-axi database create <name> [flags]"]);
  const name = args[0];
  const rest = args.slice(1);
  const raw = await doctlJson<unknown>(["databases", "create", name, ...rest], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") return encode({ result: raw, help: ["doctl-axi database list"] });
  const mapped = toDatabaseToon(rec as unknown as DatabaseRaw, full);
  return encode({ database: mapped as unknown as Record<string, unknown>, help: ["doctl-axi database list"] });
}

async function databaseDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi database delete --help` for available flags");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi database delete --help`"]);
  if (args.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database delete <id>"]);
  const id = args[0];
  const raw = await doctlDelete<unknown>(["databases", "delete", id], contextFlag);
  if (raw === null) return encode({ delete: "already_deleted", database: id, help: ["doctl-axi database list"] });
  return encode({ deleted: id, help: ["doctl-axi database list"] });
}

// Generic helpers for sub-resources

function takeSubActionArgs(
  rawArgs: string[],
  allowedFields?: string[],
): { action: string; remaining: string[]; full: boolean; contextFlag?: string; fields?: string[] } | null {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return null;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  // Verbs whose output is a mapped record pass `allowedFields` and get
  // --fields honored; every other verb rejects --fields outright.
  let fields: string[] | undefined;
  const fieldsArg = takeFlagValue(args, "--fields");
  if (fieldsArg !== undefined) {
    if (!allowedFields) {
      throw new AxiError("Unknown flag: --fields", "VALIDATION_ERROR", [
        "Run `doctl-axi database --help` for available flags",
      ]);
    }
    fields = parseFields(fieldsArg, allowedFields) ?? undefined;
  }
  if (args.length === 0) throw new AxiError("Missing action", "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
  const action = args[0];
  const remaining = args.slice(1);
  return { action, remaining, full, contextFlag, fields };
}

// user/topic/pool share one verb surface (list|get|create|delete); they differ
// only in the doctl subpath, the row mapper, the allowed --fields, and the
// nouns used in envelopes and error messages.
type SubResourceConfig = {
  verb: string;
  plural: string;
  fields: string[];
  toToon: (raw: unknown, full: boolean) => Record<string, unknown>;
};

const SUBRESOURCES: Record<string, SubResourceConfig> = {
  user: {
    verb: "user",
    plural: "users",
    fields: ["name", "role", "type"],
    toToon: (raw, full) => toDatabaseUserToon(raw as unknown as DatabaseUserRaw, full),
  },
  topic: {
    verb: "topic",
    plural: "topics",
    fields: ["name", "state", "partitions"],
    toToon: (raw, full) => toDatabaseTopicToon(raw as unknown as DatabaseTopicRaw, full),
  },
  pool: {
    verb: "pool",
    plural: "pools",
    fields: ["name", "mode", "size"],
    toToon: (raw, full) => toDatabasePoolToon(raw as unknown as DatabasePoolRaw, full),
  },
};

async function databaseSubResource(rawArgs: string[], cfg: SubResourceConfig): Promise<string> {
  const { verb, plural, fields: allowedFields, toToon } = cfg;
  const Noun = verb[0].toUpperCase() + verb.slice(1);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  const parsed = takeSubActionArgs(rawArgs, allowedFields);
  if (parsed === null) return DATABASE_HELP;
  const { action, remaining, full, contextFlag, fields } = parsed;
  if (action === "list") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", [`Usage: doctl-axi database ${verb} list <db-id>`]);
    rejectUnknownFlags(remaining.slice(1), [], `Run \`doctl-axi database ${verb} list --help\` for available flags`);
    const raw = await doctlJson<unknown>(["databases", verb, "list", remaining[0]], contextFlag);
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length === 0) return `0 ${plural}`;
    const mapped = arr.map((item) => toToon(item, full));
    const rows = projectFields(mapped, fields ?? null);
    return encode({ count: `${mapped.length} total`, [plural]: rows, help: [`doctl-axi database ${verb} list --full`] });
  }
  if (action === "get") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", [`Usage: doctl-axi database ${verb} get <db-id> <${verb}>`]);
    rejectUnknownFlags(remaining.slice(2), [], `Run \`doctl-axi database ${verb} get --help\` for available flags`);
    const raw = await doctlJson<unknown>(["databases", verb, "get", remaining[0], remaining[1]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    if (!rec || typeof rec !== "object") throw new AxiError(`${Noun} ${remaining[1]} not found`, "NOT_FOUND", []);
    return encode({ [verb]: toToon(rec, full), help: [`doctl-axi database ${verb} list`] });
  }
  if (action === "create") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", [`Usage: doctl-axi database ${verb} create <db-id> <${verb}>`]);
    rejectUnknownFlags(remaining.slice(2), [], `Run \`doctl-axi database ${verb} create --help\` for available flags`);
    const raw = await doctlJson<unknown>(["databases", verb, "create", remaining[0], remaining[1]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
    if (!rec || typeof rec !== "object") throw new AxiError(`${Noun} create failed: unexpected doctl output`, "VALIDATION_ERROR", [`doctl-axi database ${verb} list`]);
    return encode({ [verb]: toToon(rec, full), help: [`doctl-axi database ${verb} list`] });
  }
  if (action === "delete") {
    if (remaining.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", [`Usage: doctl-axi database ${verb} delete <db-id> <${verb}>`]);
    rejectUnknownFlags(remaining.slice(2), [], `Run \`doctl-axi database ${verb} delete --help\` for available flags`);
    const raw = await doctlDelete<unknown>(["databases", verb, "delete", remaining[0], remaining[1]], contextFlag);
    if (raw === null) return encode({ delete: "already_deleted", [verb]: remaining[1], database: remaining[0], help: [`doctl-axi database ${verb} list`] });
    return encode({ deleted: remaining[1], help: [`doctl-axi database ${verb} list`] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, create, delete"]);
}

async function databaseConfig(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  const parsed = takeSubActionArgs(rawArgs);
  if (parsed === null) return DATABASE_HELP;
  const { action, remaining, contextFlag } = parsed;
  if (action === "get" || action === "list" || action === "show") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database config get <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "configuration", "list", remaining[0]], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as unknown;
    return encode({ config: rec, help: ["doctl-axi database config get <id>"] });
  }
  if (action === "update" || action === "set") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database config update <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "configuration", "update", ...remaining], contextFlag);
    return encode({ config: raw, help: ["doctl-axi database config get"] });
  }
  // allow "list" implied if no action but id provided? handle direct id case
  if (remaining.length === 0 && action && !["list", "get", "show", "update", "set"].includes(action)) {
    // treat action as id for get
    const raw = await doctlJson<unknown>(["databases", "configuration", "list", action], contextFlag);
    const rec = (Array.isArray(raw) ? raw[0] : raw) as unknown;
    return encode({ config: rec, help: ["doctl-axi database config get <id>"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: get, update"]);
}

async function databaseFirewall(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DATABASE_HELP;
  const parsed = takeSubActionArgs(rawArgs);
  if (parsed === null) return DATABASE_HELP;
  const { action, remaining, contextFlag } = parsed;
  if (action === "list" || action === "get") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database firewall list <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "list", remaining[0]], contextFlag);
    const arr = Array.isArray(raw) ? raw : [raw];
    if (arr.length === 0 || (arr.length === 1 && Object.keys(arr[0] as object).length === 0)) return "0 firewalls";
    // firewall may be object with rules field
    const rec = arr[0] as Record<string, unknown>;
    if ("rules" in rec && Array.isArray(rec["rules"])) {
      const rules = rec["rules"] as unknown[];
      if (rules.length === 0) return "0 firewalls";
      return encode({ count: `${rules.length} total`, firewalls: rules, help: ["doctl-axi database firewall list --full"] });
    }
    return encode({ count: `${arr.length} total`, firewalls: arr, help: ["doctl-axi database firewall list --full"] });
  }
  if (action === "update" || action === "append" || action === "set") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database firewall update <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "update", ...remaining], contextFlag);
    return encode({ firewall: raw, help: ["doctl-axi database firewall list"] });
  }
  if (action === "create" || action === "add") {
    if (remaining.length === 0) throw new AxiError("Missing database id", "VALIDATION_ERROR", ["Usage: doctl-axi database firewall create <db-id>"]);
    const raw = await doctlJson<unknown>(["databases", "firewall", "append", remaining[0], ...remaining.slice(1)], contextFlag);
    return encode({ firewall: raw, help: ["doctl-axi database firewall list"] });
  }
  throw new AxiError(`Unknown subcommand: ${action}`, "VALIDATION_ERROR", ["Available: list, get, update"]);
}
