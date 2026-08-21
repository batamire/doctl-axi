import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields } from "../lib/mappers/common.js";
import { toMarketplaceToon } from "../lib/mappers/marketplace.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FIELDS = ["slug", "name", "type"];

const ALLOWED_FLAGS = ["--full", "--fields"];

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


export async function marketplaceCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return MARKETPLACE_HELP;
    throw new AxiError("Missing subcommand for marketplace", "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi marketplace --help`"]);
  }
  if (sub === "--help" || sub === "-h") return MARKETPLACE_HELP;
  if (sub === "list") return list(args.slice(1), ctx);
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi marketplace --help`"]);
}

async function list(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return MARKETPLACE_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi marketplace list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi marketplace list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  // doctl 1-click list may be hyphenated; try primary, fallback wrapper inside doctlJson will error if not found, but we attempt 1-click
  const raw = await doctlJson<unknown>(["1-click", "list"], ctx?.context);
  const rawArray: unknown[] = unwrapArray(raw, "addons", "marketplace");
  if (rawArray.length === 0) return "0 marketplace items";
  const mapped = rawArray.map((item) => toMarketplaceToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    marketplace: filtered,
    help: [suggest(ctx, "doctl-axi marketplace list --full", "for complete fields")],
  };
  return encode(payload);
}
