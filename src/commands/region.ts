import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields } from "../lib/mappers/common.js";
import { toRegionToon } from "../lib/mappers/region.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FIELDS = ["slug", "name", "available"];

const ALLOWED_FLAGS = ["--full", "--fields"];

export const REGION_HELP = encode({
  command: "region",
  description: "List available DigitalOcean regions",
  usage: "doctl-axi region <subcommand> [flags]",
  subcommands: { list: "List regions" },
  flags: {
    "--full": "Disable truncation",
    "--fields": "Comma-separated fields to display (slug,name,available)",
    "--context": "doctl context name",
  },
  examples: ["doctl-axi region list", "doctl-axi region list --fields slug,name"],
});


export async function regionCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return REGION_HELP;
    throw new AxiError("Missing subcommand for region", "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi region --help`"]);
  }
  if (sub === "--help" || sub === "-h") return REGION_HELP;
  if (sub === "list") return regionList(args.slice(1), ctx);
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi region --help`"]);
}

async function regionList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGION_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi region list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi region list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  const raw = await doctlJson<unknown>(["compute", "region", "list"], ctx?.context);
  const rawArray: unknown[] = unwrapArray(raw, "regions");
  if (rawArray.length === 0) return "0 regions";
  const mapped = rawArray.map((item) => toRegionToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    regions: filtered,
    help: [suggest(ctx, "doctl-axi region list --full", "for complete fields")],
  };
  return encode(payload);
}
