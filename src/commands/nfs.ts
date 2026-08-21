import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields, toNfsToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "status"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

export const NFS_HELP = encode({
  command: "nfs",
  description: "Manage NFS file shares",
  usage: "doctl-axi nfs <subcommand> [flags]",
  subcommands: { list: "List NFS shares", get: "Get an NFS share by id" },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,status)",
    "--context": "doctl context name",
  },
  examples: ["doctl-axi nfs list", "doctl-axi nfs list --fields id,name", "doctl-axi nfs get <id>"],
});


export async function nfsCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return NFS_HELP;
    throw new AxiError("Missing subcommand for nfs", "VALIDATION_ERROR", ["Available: list, get", "Run `doctl-axi nfs --help`"]);
  }
  if (sub === "--help" || sub === "-h") return NFS_HELP;
  if (sub === "list") return nfsList(args.slice(1));
  if (sub === "get") return nfsGet(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", ["Available: list, get", "Run `doctl-axi nfs --help`"]);
}

async function nfsList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return NFS_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi nfs list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  // try primary doctl nfs list, fallback to compute nfs if needed via wrapper? For now use nfs list
  const raw = await doctlJson<unknown>(["nfs", "list"], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "shares", "nfs");
  if (rawArray.length === 0) return "0 nfs shares";
  const mapped = rawArray.map((item) => toNfsToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const totalCount = rawArray.length;
  const available = mapped.filter((d) => d.status === "available").length;
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${totalCount} total`,
    status: `available ${available}/${mapped.length}`,
    nfs: filtered,
    help: [`nfs get ${mapped[0].id} for detail`, "doctl-axi nfs list --full for complete fields"],
  };
  return encode(payload);
}

async function nfsGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return NFS_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi nfs get --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for nfs get", "VALIDATION_ERROR", ["Usage: doctl-axi nfs get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs get --help`"]);
  const raw = await doctlJson<unknown>(["nfs", "get", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "share" in (raw as Record<string, unknown>)
    ? ((raw as Record<string, unknown>).share as unknown)
    : raw;
  const mapped = toNfsToon(obj as never, full);
  return encode({ nfs: mapped as unknown as Record<string, unknown>, help: ["doctl-axi nfs list for overview"] });
}
