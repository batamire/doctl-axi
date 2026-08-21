import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toRegionToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS: Record<string, true> = { slug: true, name: true, available: true };

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

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


export async function regionCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return REGION_HELP;
    throw new AxiError("Missing subcommand for region", "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi region --help`"]);
  }
  if (sub === "--help" || sub === "-h") return REGION_HELP;
  if (sub === "list") return regionList(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi region --help`"]);
}

async function regionList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGION_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi region list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi region list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi region list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: slug,name,available"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: slug,name,available"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["compute", "region", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "regions" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).regions)
      ? ((raw as Record<string, unknown>).regions as unknown[])
      : [];
  if (rawArray.length === 0) return "0 regions";
  const mapped = rawArray.map((item) => toRegionToon(item as never, full));
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
    regions: filtered,
    help: ["doctl-axi region list --full for complete fields"],
  };
  return encode(payload);
}
