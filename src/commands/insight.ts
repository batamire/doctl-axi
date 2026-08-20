import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toInsightToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const ALLOWED_FIELDS: Record<string, true> = { id: true, name: true, status: true, target: true };

export const INSIGHT_HELP = encode({
  command: "insight",
  description: "Manage insight / uptime checks",
  usage: "do-axi insight <subcommand> [flags]",
  subcommands: {
    "uptime list": "List uptime checks",
    "uptime get": "Get an uptime check by id",
  },
  flags: {
    "--full": "Disable truncation",
    "--fields": "Comma-separated fields to display (id,name,status,target)",
    "--context": "doctl context name",
  },
  examples: ["do-axi insight uptime list", "do-axi insight uptime list --fields id,name"],
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
    if (val === undefined || val.startsWith("-")) throw new AxiError(`Missing value for ${flag}`, "VALIDATION_ERROR", []);
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

export async function insightCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  const sub2 = args[1];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return INSIGHT_HELP;
    throw new AxiError("Missing subcommand for insight", "VALIDATION_ERROR", ["Available: uptime list", "Run `do-axi insight --help`"]);
  }
  if (sub === "--help" || sub === "-h") return INSIGHT_HELP;
  if (sub !== "uptime") throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: uptime", "Run `do-axi insight --help`"]);
  if (!sub2 || sub2.startsWith("-")) {
    if (sub2 === "--help" || sub2 === "-h") return INSIGHT_HELP;
    throw new AxiError("Missing subcommand for insight uptime", "VALIDATION_ERROR", ["Available: list, get", "Run `do-axi insight --help`"]);
  }
  if (sub2 === "list") return uptimeList(args.slice(2));
  if (sub2 === "get") return uptimeGet(args.slice(2));
  throw new AxiError(`Unknown subcommand: ${sub2}`, "VALIDATION_ERROR", ["Available: list, get", "Run `do-axi insight --help`"]);
}

async function uptimeList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return INSIGHT_HELP;
  rejectUnknownFlags(rawArgs, "insight", "uptime list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `do-axi insight uptime list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `do-axi insight uptime list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,status,target"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,status,target"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["monitoring", "uptime", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "checks" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).checks)
      ? ((raw as Record<string, unknown>).checks as unknown[])
      : raw !== null && typeof raw === "object" && "uptime_checks" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).uptime_checks)
        ? ((raw as Record<string, unknown>).uptime_checks as unknown[])
        : [];
  if (rawArray.length === 0) return "0 uptime checks";
  const mapped = rawArray.map((item) => toInsightToon(item as never, full));
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
    checks: filtered,
    help: ["do-axi insight uptime list --full for complete fields"],
  };
  return encode(payload);
}

async function uptimeGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return INSIGHT_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "insight", "uptime get");
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `do-axi insight uptime get --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for insight uptime get", "VALIDATION_ERROR", ["Usage: do-axi insight uptime get <id>"]);
  const raw = await doctlJson<unknown>(["monitoring", "uptime", "get", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "check" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).check as unknown) : raw;
  const mapped = toInsightToon(obj as never, full);
  return encode({ check: mapped as unknown as Record<string, unknown>, help: ["do-axi insight uptime list for overview"] });
}
