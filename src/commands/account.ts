import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toAccountToon, toBalanceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

export const ACCOUNT_HELP = encode({
  command: "account",
  description: "Get DigitalOcean account information",
  usage: "doctl-axi account <subcommand> [flags]",
  subcommands: { get: "Get account details" },
  flags: { "--context": "doctl context name", "--full": "Disable truncation" },
  examples: ["doctl-axi account get", "doctl-axi account get --context my-team"],
});

export async function accountCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return ACCOUNT_HELP;
    throw new AxiError("Missing subcommand for account", "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi account --help`"]);
  }
  if (sub === "--help" || sub === "-h") return ACCOUNT_HELP;
  if (sub === "get") return accountGet(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi account --help`"]);
}

async function accountGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return ACCOUNT_HELP;
  // allow --context,--full
  function reject() {
    for (const a of rawArgs) {
      if (!a.startsWith("-")) continue;
      if (a === "--context" || a === "--full" || a === "--help" || a === "-h") continue;
      if (a.startsWith("--context=")) continue;
      throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", ["Run `doctl-axi account get --help`"]);
    }
  }
  reject();
  const args = [...rawArgs];
  let contextFlag: string | undefined;
  const cIdx = args.indexOf("--context");
  if (cIdx !== -1) {
    const val = args[cIdx + 1];
    if (!val || val.startsWith("-")) throw new AxiError("Missing value for --context", "VALIDATION_ERROR", []);
    contextFlag = val;
    args.splice(cIdx, 2);
  } else {
    const fIdx = args.findIndex((a) => a.startsWith("--context="));
    if (fIdx !== -1) {
      contextFlag = args[fIdx].slice("--context=".length);
      args.splice(fIdx, 1);
    }
  }
  const full = (() => {
    const idx = args.indexOf("--full");
    if (idx !== -1) {
      args.splice(idx, 1);
      return true;
    }
    return false;
  })();
  const leftover = args.filter((a) => a.startsWith("-"));
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi account get --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi account get --help`"]);
  const raw = await doctlJson<unknown>(["account", "get"], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "account" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).account as unknown) : raw;
  const mapped = toAccountToon(obj as never, full);
  return encode({ account: mapped as unknown as Record<string, unknown>, help: ["doctl-axi balance get for billing"] });
}
