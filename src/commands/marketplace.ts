import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { toMarketplaceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["slug", "name", "type"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

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
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi marketplace list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi marketplace list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi marketplace list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  // doctl 1-click list may be hyphenated; try primary, fallback wrapper inside doctlJson will error if not found, but we attempt 1-click
  const raw = await doctlJson<unknown>(["1-click", "list"], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "addons", "marketplace");
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
