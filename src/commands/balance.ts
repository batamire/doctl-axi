import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { encode } from "@toon-format/toon";
import { toBalanceToon } from "../lib/mappers/balance.js";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

export const BALANCE_HELP = encode({
  command: "balance",
  description: "Get account balance",
  usage: "doctl-axi balance <subcommand> [flags]",
  subcommands: { get: "Get balance" },
  flags: { "--context": "doctl context name", "--full": "Disable truncation" },
  examples: ["doctl-axi balance get", "doctl-axi balance get --full"],
});

export async function balanceCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return BALANCE_HELP;
    throw new AxiError("Missing subcommand for balance", "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi balance --help`"]);
  }
  if (sub === "--help" || sub === "-h") return BALANCE_HELP;
  if (sub === "get") return balanceGet(args.slice(1), ctx);
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: get", "Run `doctl-axi balance --help`"]);
}

async function balanceGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return BALANCE_HELP;
  rejectUnknownFlags(rawArgs, ["--full"], "Run `doctl-axi balance get --help`");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi balance get --help`"]);
  const raw = await doctlJson<unknown>(["balance", "get"], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "balance" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).balance as unknown) : raw;
  const mapped = toBalanceToon(obj as never, full);
  return encode({ balance: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi account get", "for account")] });
}
