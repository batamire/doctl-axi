import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields, toInsightToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "status", "target"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

export const INSIGHT_HELP = encode({
  command: "insight",
  description: "Manage insight / uptime checks",
  usage: "doctl-axi insight <subcommand> [flags]",
  subcommands: {
    "uptime list": "List uptime checks",
    "uptime get": "Get an uptime check by id",
  },
  flags: {
    "--full": "Disable truncation",
    "--fields": "Comma-separated fields to display (id,name,status,target)",
    "--context": "doctl context name",
  },
  examples: ["doctl-axi insight uptime list", "doctl-axi insight uptime list --fields id,name"],
});


export async function insightCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  const sub2 = args[1];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return INSIGHT_HELP;
    throw new AxiError("Missing subcommand for insight", "VALIDATION_ERROR", ["Available: uptime list", "Run `doctl-axi insight --help`"]);
  }
  if (sub === "--help" || sub === "-h") return INSIGHT_HELP;
  if (sub !== "uptime") throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: uptime", "Run `doctl-axi insight --help`"]);
  if (!sub2 || sub2.startsWith("-")) {
    if (sub2 === "--help" || sub2 === "-h") return INSIGHT_HELP;
    throw new AxiError("Missing subcommand for insight uptime", "VALIDATION_ERROR", ["Available: list, get", "Run `doctl-axi insight --help`"]);
  }
  if (sub2 === "list") return uptimeList(args.slice(2));
  if (sub2 === "get") return uptimeGet(args.slice(2));
  throw new AxiError(`Unknown subcommand: ${sub2}`, "VALIDATION_ERROR", ["Available: list, get", "Run `doctl-axi insight --help`"]);
}

async function uptimeList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return INSIGHT_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi insight uptime list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi insight uptime list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  const raw = await doctlJson<unknown>(["monitoring", "uptime", "list"], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "checks", "uptime_checks");
  if (rawArray.length === 0) return "0 uptime checks";
  const mapped = rawArray.map((item) => toInsightToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${rawArray.length} total`,
    checks: filtered,
    help: ["doctl-axi insight uptime list --full for complete fields"],
  };
  return encode(payload);
}

async function uptimeGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return INSIGHT_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi insight uptime get --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for insight uptime get", "VALIDATION_ERROR", ["Usage: doctl-axi insight uptime get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi insight uptime get --help`"]);
  const raw = await doctlJson<unknown>(["monitoring", "uptime", "get", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "check" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).check as unknown) : raw;
  const mapped = toInsightToon(obj as never, full);
  return encode({ check: mapped as unknown as Record<string, unknown>, help: ["doctl-axi insight uptime list for overview"] });
}
