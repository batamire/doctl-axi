import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields, toDedicatedInferenceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "status"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

export const DEDICATED_INFERENCE_HELP = encode({
  command: "dedicated-inference",
  description: "Manage dedicated inference resources",
  usage: "doctl-axi dedicated-inference <subcommand> [flags]",
  subcommands: { list: "List dedicated inference deployments" },
  flags: {
    "--full": "Disable truncation",
    "--fields": "Comma-separated fields to display (id,name,region,status)",
    "--context": "doctl context name",
  },
  examples: ["doctl-axi dedicated-inference list", "doctl-axi dedicated-inference list --fields id,name"],
});


export async function dedicatedInferenceCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return DEDICATED_INFERENCE_HELP;
    throw new AxiError("Missing subcommand for dedicated-inference", "VALIDATION_ERROR", [
      "Available: list",
      "Run `doctl-axi dedicated-inference --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return DEDICATED_INFERENCE_HELP;
  if (sub === "list") return list(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list", "Run `doctl-axi dedicated-inference --help`"]);
}

async function list(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DEDICATED_INFERENCE_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi dedicated-inference list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi dedicated-inference list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  const raw = await doctlJson<unknown>(["dedicated-inference", "list"], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "inference", "data");
  if (rawArray.length === 0) return "0 inference";
  const mapped = rawArray.map((item) => toDedicatedInferenceToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${rawArray.length} total`,
    status: `active ${mapped.filter((d) => d.status === "active").length}/${mapped.length}`,
    inference: filtered,
    help: ["doctl-axi dedicated-inference list --full for complete fields"],
  };
  return encode(payload);
}
