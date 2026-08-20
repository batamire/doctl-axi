import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toSpaceKeyToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const ALLOWED_FIELDS: Record<string, true> = { name: true, accessKey: true, created: true };

export const SPACE_HELP = encode({
  command: "space",
  description: "Manage Spaces access keys",
  usage: "do-axi space <subcommand> [flags]",
  subcommands: {
    "key list": "List Spaces keys",
    "key get": "Get a Spaces key by name",
    "key create": "Create a Spaces key",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (name,accessKey,created)",
    "--context": "doctl context name",
  },
  examples: [
    "do-axi space key list",
    "do-axi space key list --fields name,created",
    "do-axi space key get <name>",
  ],
});

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (const a of args) {
    if (!a.startsWith("-")) continue;
    if (a === "--full" || a === "--help" || a === "-h") continue;
    if (a === "--fields" || a === "--context") continue;
    if (a.startsWith("--fields=") || a.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [`Run \`do-axi ${command} ${sub} --help\` for available flags`]);
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
    if (val === undefined || val.startsWith("-")) throw new AxiError(`Missing value for ${flag}`, "VALIDATION_ERROR", ["Run `do-axi space key list --help`"]);
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const v = args[foundIndex].slice(prefix.length);
    args.splice(foundIndex, 1);
    return v;
  }
  return undefined;
}

export async function spaceCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  const sub2 = args[1];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return SPACE_HELP;
    throw new AxiError("Missing subcommand for space", "VALIDATION_ERROR", [
      "Available: key list, key get",
      "Run `do-axi space --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return SPACE_HELP;
  // normalize: allow "key" or "keys"
  const normalized = sub === "keys" ? "key" : sub;
  if (normalized !== "key" && normalized !== "keys") {
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: key list, key get",
      "Run `do-axi space --help`",
    ]);
  }
  const keySub = sub2;
  if (!keySub || keySub.startsWith("-")) {
    if (keySub === "--help" || keySub === "-h") return SPACE_HELP;
    throw new AxiError("Missing subcommand for space key", "VALIDATION_ERROR", [
      "Available: list, get, create, update, delete",
      "Run `do-axi space --help`",
    ]);
  }
  if (keySub === "list") return spaceKeyList(args.slice(2));
  if (keySub === "get") return spaceKeyGet(args.slice(2));
  if (keySub === "create") return spaceKeyCreate(args.slice(2));
  if (keySub === "update") return spaceKeyUpdate(args.slice(2));
  if (keySub === "delete") return spaceKeyDelete(args.slice(2));
  throw new AxiError(`Unknown subcommand: ${keySub}`, "VALIDATION_ERROR", [
    "Available: list, get, create, update, delete",
    "Run `do-axi space --help`",
  ]);
}

async function spaceKeyList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  rejectUnknownFlags(rawArgs, "space", "key list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi space key list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `do-axi space key list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: name,accessKey,created"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: name,accessKey,created"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["spaces", "keys", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "keys" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).keys)
      ? ((raw as Record<string, unknown>).keys as unknown[])
      : [];
  if (rawArray.length === 0) return "0 spaces";
  const mapped = rawArray.map((item) => toSpaceKeyToon(item as never, full));
  let filtered: Record<string, unknown>[];
  if (fields) {
    filtered = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else filtered = mapped as unknown as Record<string, unknown>[];
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${rawArray.length} total`,
    spaces: filtered,
    help: [`space key get ${mapped[0].name} for detail`, "do-axi space key list --full for complete fields"],
  };
  return encode(payload);
}

async function spaceKeyGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "space", "key get");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi space key get --help`"]);
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key get", "VALIDATION_ERROR", ["Usage: do-axi space key get <name>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `do-axi space key get --help`"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "get", name], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, full);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: ["do-axi space key list for overview"] });
}

async function spaceKeyCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "space", "key create");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi space key create --help`"]);
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key create", "VALIDATION_ERROR", ["Usage: do-axi space key create <name>"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "create", name], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, full);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: ["do-axi space key list for overview"] });
}

async function spaceKeyUpdate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "space", "key update");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key update", "VALIDATION_ERROR", ["Usage: do-axi space key update <name>"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "update", name], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, false);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: ["do-axi space key list for overview"] });
}

async function spaceKeyDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "space", "key delete");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key delete", "VALIDATION_ERROR", ["Usage: do-axi space key delete <name>"]);
  await doctlJson<unknown>(["spaces", "keys", "delete", name], contextFlag);
  return encode({ deleted: name, help: ["do-axi space key list for overview"] });
}
