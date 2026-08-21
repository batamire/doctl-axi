import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields, toVolumeToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "size", "status"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

export const VOLUME_HELP = encode({
  command: "volume",
  description: "Manage block storage volumes",
  usage: "doctl-axi volume <subcommand> [flags]",
  subcommands: {
    list: "List volumes",
    get: "Get a volume by id",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,size,status)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi volume list",
    "doctl-axi volume list --fields id,name",
    "doctl-axi volume list --full",
    "doctl-axi volume get <id>",
  ],
});


export async function volumeCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return VOLUME_HELP;
    throw new AxiError("Missing subcommand for volume", "VALIDATION_ERROR", [
      "Available: list, get",
      "Run `doctl-axi volume --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return VOLUME_HELP;
  if (sub === "list") return volumeList(args.slice(1));
  if (sub === "get") return volumeGet(args.slice(1));
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Available: list, get",
    "Run `doctl-axi volume --help`",
  ]);
}

async function volumeList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return VOLUME_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi volume list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");

  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi volume list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi volume list --help`",
    ]);
  }

  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);

  const raw = await doctlJson<unknown>(["compute", "volume", "list"], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "volumes");

  if (rawArray.length === 0) return "0 volumes";

  const mapped = rawArray.map((item) => toVolumeToon(item as never, full));

  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);

  const totalCount = rawArray.length;
  const available = mapped.filter((d) => d.status === "available").length;
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${totalCount} total`,
    status: `available ${available}/${mapped.length}`,
    volumes: filtered,
    help: [`volume get ${mapped[0].id} for detail`, "doctl-axi volume list --full for complete fields"],
  };
  return encode(payload);
}

async function volumeGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return VOLUME_HELP;
  // get expects id positional, flags allowed
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  // check unknown flags
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi volume get --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi volume get --help` for available flags",
    ]);
  }
  const id = args[0];
  if (!id) {
    throw new AxiError("Missing id for volume get", "VALIDATION_ERROR", ["Usage: doctl-axi volume get <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi volume get --help`"]);
  }
  const raw = await doctlJson<unknown>(["compute", "volume", "get", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "volume" in (raw as Record<string, unknown>)
    ? ((raw as Record<string, unknown>).volume as unknown)
    : raw;
  const mapped = toVolumeToon(obj as never, full);
  return encode({ volume: mapped as unknown as Record<string, unknown>, help: ["doctl-axi volume list for overview"] });
}
