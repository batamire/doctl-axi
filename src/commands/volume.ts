import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields } from "../lib/mappers/common.js";
import { toVolumeToon } from "../lib/mappers/volume.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "size", "status"];

const ALLOWED_FLAGS = ["--full", "--fields"];

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


export async function volumeCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return VOLUME_HELP;
    throw new AxiError("Missing subcommand for volume", "VALIDATION_ERROR", [
      "Available: list, get",
      "Run `doctl-axi volume --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return VOLUME_HELP;
  if (sub === "list") return volumeList(args.slice(1), ctx);
  if (sub === "get") return volumeGet(args.slice(1), ctx);
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Available: list, get",
    "Run `doctl-axi volume --help`",
  ]);
}

async function volumeList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return VOLUME_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi volume list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");

  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi volume list --help`",
    ]);
  }

  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);

  const raw = await doctlJson<unknown>(["compute", "volume", "list"], ctx?.context);
  const rawArray: unknown[] = unwrapArray(raw, "volumes");

  if (rawArray.length === 0) return "0 volumes";

  const mapped = rawArray.map((item) => toVolumeToon(item as never, full));

  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);

  const available = mapped.filter((d) => d.status === "available").length;
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    status: `available ${available}/${mapped.length}`,
    volumes: filtered,
    help: [suggest(ctx, `volume get ${mapped[0].id}`, "for detail"), suggest(ctx, "volume list --full", "for complete fields")],
  };
  return encode(payload);
}

async function volumeGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return VOLUME_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi volume get --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  const id = args[0];
  if (!id) {
    throw new AxiError("Missing id for volume get", "VALIDATION_ERROR", ["Usage: doctl-axi volume get <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi volume get --help`"]);
  }
  const raw = await doctlJson<unknown>(["compute", "volume", "get", id], ctx?.context);
  const unwrapped = Array.isArray(raw) ? (raw[0] as unknown) : raw;
  const obj = unwrapped !== null && typeof unwrapped === "object" && "volume" in (unwrapped as Record<string, unknown>)
    ? ((unwrapped as Record<string, unknown>).volume as unknown)
    : unwrapped;
  const mapped = toVolumeToon(obj as never, full);
  const filtered = projectFields([mapped as unknown as Record<string, unknown>], fields)[0];
  return encode({ volume: filtered as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi volume list", "for overview")] });
}
