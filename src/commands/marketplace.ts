import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toMarketplaceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const ALLOWED_FIELDS: Record<string, true> = { slug: true, name: true, type: true };

export const MARKETPLACE_HELP = encode({
  command: "marketplace",
  description: "List DigitalOcean marketplace (1-click) offerings",
  usage: "doctl-axi marketplace <subcommand> [flags]",
  subcommands: { list: "List marketplace offerings" },
  flags: {
    "--full": "Disable truncation",
    "--fields": "Comma-separated fields to display (slug,name,type)",
    "--context": "doctl context name",
  },
  examples: ["doctl-axi marketplace list", "doctl-axi marketplace list --fields slug,name"],
});

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (const a of args) {
    if (!a.startsWith("-")) continue;
    if (a === "--full" || a === "--help" || a === "-h") continue;
    if (a === "--fields" || a === "--context") continue;
    if (a.startsWith("--fields=") || a.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [`Run \`doctl-axi ${command} ${sub} --help\` for available flags`]);
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

export async function marketplaceCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return MARKETPLACE_HELP;
    throw new AxiError("Missing subcommand for marketplace", "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi marketplace --help`"]);
  }
  if (sub === "--help" || sub === "-h") return MARKETPLACE_HELP;
  if (sub === "list") return list(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi marketplace --help`"]);
}

async function list(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return MARKETPLACE_HELP;
  rejectUnknownFlags(rawArgs, "marketplace", "list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi marketplace list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi marketplace list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: slug,name,type"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: slug,name,type"]);
    fields = requested;
  }
  // doctl 1-click list may be hyphenated; try primary, fallback wrapper inside doctlJson will error if not found, but we attempt 1-click
  const raw = await doctlJson<unknown>(["1-click", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "addons" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).addons)
      ? ((raw as Record<string, unknown>).addons as unknown[])
      : raw !== null && typeof raw === "object" && "marketplace" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).marketplace)
        ? ((raw as Record<string, unknown>).marketplace as unknown[])
        : [];
  if (rawArray.length === 0) return "0 marketplace items";
  const mapped = rawArray.map((item) => toMarketplaceToon(item as never, full));
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
    marketplace: filtered,
    help: ["doctl-axi marketplace list --full for complete fields"],
  };
  return encode(payload);
}
