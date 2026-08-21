import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toNfsToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const ALLOWED_FIELDS: Record<string, true> = { id: true, name: true, region: true, status: true };

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

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (const a of args) {
    if (!a.startsWith("-")) continue;
    if (a === "--full" || a === "--help" || a === "-h") continue;
    if (a === "--fields" || a === "--context") continue;
    if (a.startsWith("--fields=") || a.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [`Run \`doctl-axi ${command} ${sub} --help\` for available flags`]);
  }
}
function takeBoolFlag(args: string[], flag: string): boolean {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}
function takeFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1) {
    const val = args[idx + 1];
    if (val === undefined || val.startsWith("-")) throw new AxiError(`Missing value for ${flag}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs list --help`"]);
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const v = args[foundIndex].slice(prefix.length);
    args.splice(foundIndex, 1);
    return v;
  }
  return undefined;
}

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
  rejectUnknownFlags(rawArgs, "nfs", "list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs list --help` for available flags"]);
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    for (const f of requested) if (!(f in ALLOWED_FIELDS)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    fields = requested;
  }
  // try primary doctl nfs list, fallback to compute nfs if needed via wrapper? For now use nfs list
  const raw = await doctlJson<unknown>(["nfs", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === "object" && "shares" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).shares)
      ? ((raw as Record<string, unknown>).shares as unknown[])
      : raw !== null && typeof raw === "object" && "nfs" in (raw as Record<string, unknown>) && Array.isArray((raw as Record<string, unknown>).nfs)
        ? ((raw as Record<string, unknown>).nfs as unknown[])
        : [];
  if (rawArray.length === 0) return "0 nfs shares";
  const mapped = rawArray.map((item) => toNfsToon(item as never, full));
  let filtered: Record<string, unknown>[];
  if (fields) {
    filtered = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else filtered = mapped as unknown as Record<string, unknown>[];
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
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, "nfs", "get");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi nfs get --help`"]);
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
