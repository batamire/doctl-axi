import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toDedicatedInferenceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS: Record<string, true> = { id: true, name: true, region: true, status: true };

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
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi dedicated-inference list --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi dedicated-inference list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["dedicated-inference", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "inference" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).inference)
      ? ((raw as Record<string, unknown>).inference as unknown[])
      : raw !== null && typeof raw === "object" && "data" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).data)
        ? ((raw as Record<string, unknown>).data as unknown[])
        : [];
  if (rawArray.length === 0) return "0 inference";
  const mapped = rawArray.map((item) => toDedicatedInferenceToon(item as never, full));
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
    status: `active ${mapped.filter((d) => d.status === "active").length}/${mapped.length}`,
    inference: filtered,
    help: ["doctl-axi dedicated-inference list --full for complete fields"],
  };
  return encode(payload);
}
