import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toBalanceToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

export const BALANCE_HELP = encode({
  command: "balance",
  description: "Get account balance",
  usage: "doctl-axi balance <subcommand> [flags]",
  subcommands: { get: "Get balance" },
  flags: { "--context": "doctl context name", "--full": "Disable truncation" },
  examples: ["doctl-axi balance get", "doctl-axi balance get --full"],
});

export async function balanceCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return BALANCE_HELP;
    throw new AxiError("Missing subcommand for balance", "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi balance --help`"]);
  }
  if (sub === "--help" || sub === "-h") return BALANCE_HELP;
  if (sub === "get") return balanceGet(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi balance --help`"]);
}

async function balanceGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return BALANCE_HELP;
  for (const a of rawArgs) {
    if (!a.startsWith("-")) continue;
    if (a === "--context" || a === "--full" || a === "--help" || a === "-h") continue;
    if (a.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", ["Run `doctl-axi balance get --help`"]);
  }
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
  if (leftover.length > 0) throw new AxiError(`Unknown flag: ${leftover[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi balance get --help`"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi balance get --help`"]);
  const raw = await doctlJson<unknown>(["balance", "get"], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "balance" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).balance as unknown) : raw;
  const mapped = toBalanceToon(obj as never, full);
  return encode({ balance: mapped as unknown as Record<string, unknown>, help: ["doctl-axi account get for account"] });
}
