import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson, unwrapArray } from "../lib/doctl.js";
import { projectFields } from "../lib/mappers/common.js";
import { toSpaceKeyToon } from "../lib/mappers/space.js";import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FIELDS = ["name", "accessKey", "created"];

const ALLOWED_FLAGS = ["--full", "--fields"];

export const SPACE_HELP = encode({
  command: "space",
  description: "Manage Spaces access keys",
  usage: "doctl-axi space <subcommand> [flags]",
  subcommands: {
    "key list": "List Spaces keys",
    "key get": "Get a Spaces key by name",
    "key create": "Create a Spaces key",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (name,accessKey,created)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi space key list",
    "doctl-axi space key list --fields name,created",
    "doctl-axi space key get <name>",
  ],
});


export async function spaceCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  const sub = args[0];
  const sub2 = args[1];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return SPACE_HELP;
    throw new AxiError("Missing subcommand for space", "VALIDATION_ERROR", [
      "Available: key list, key get",
      "Run `doctl-axi space --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return SPACE_HELP;
  // accept "key" or "keys"
  if (sub !== "key" && sub !== "keys") {
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: key list, key get",
      "Run `doctl-axi space --help`",
    ]);
  }
  const keySub = sub2;
  if (!keySub || keySub.startsWith("-")) {
    if (keySub === "--help" || keySub === "-h") return SPACE_HELP;
    throw new AxiError("Missing subcommand for space key", "VALIDATION_ERROR", [
      "Available: list, get, create, update, delete",
      "Run `doctl-axi space --help`",
    ]);
  }
  if (keySub === "list") return spaceKeyList(args.slice(2), ctx);
  if (keySub === "get") return spaceKeyGet(args.slice(2), ctx);
  if (keySub === "create") return spaceKeyCreate(args.slice(2), ctx);
  if (keySub === "update") return spaceKeyUpdate(args.slice(2), ctx);
  if (keySub === "delete") return spaceKeyDelete(args.slice(2), ctx);
  throw new AxiError(`Unknown subcommand: ${keySub}`, "VALIDATION_ERROR", [
    "Available: list, get, create, update, delete",
    "Run `doctl-axi space --help`",
  ]);
}

async function spaceKeyList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi space key list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi space key list --help`"]);
  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);
  const raw = await doctlJson<unknown>(["spaces", "keys", "list"], ctx?.context);
  const rawArray: unknown[] = unwrapArray(raw, "keys");
  if (rawArray.length === 0) return "0 spaces";
  const mapped = rawArray.map((item) => toSpaceKeyToon(item as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    spaces: filtered,
    help: [suggest(ctx, `space key get ${mapped[0].name}`, "for detail"), suggest(ctx, "space key list --full", "for complete fields")],
  };
  return encode(payload);
}

async function spaceKeyGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi space key get --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key get", "VALIDATION_ERROR", ["Usage: doctl-axi space key get <name>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi space key get --help`"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "get", name], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, full);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi space key list", "for overview")] });
}

async function spaceKeyCreate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi space key create --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key create", "VALIDATION_ERROR", ["Usage: doctl-axi space key create <name>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi space key create --help`"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "create", name], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, full);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi space key list", "for overview")] });
}

async function spaceKeyUpdate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi space key update --help` for available flags");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key update", "VALIDATION_ERROR", ["Usage: doctl-axi space key update <name>"]);
  const raw = await doctlJson<unknown>(["spaces", "keys", "update", name], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "key" in (raw as Record<string, unknown>) ? ((raw as Record<string, unknown>).key as unknown) : raw;
  const mapped = toSpaceKeyToon(obj as never, false);
  return encode({ space: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi space key list", "for overview")] });
}

async function spaceKeyDelete(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return SPACE_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi space key delete --help` for available flags");
  const name = args[0];
  if (!name) throw new AxiError("Missing name for space key delete", "VALIDATION_ERROR", ["Usage: doctl-axi space key delete <name>"]);
  const raw = await doctlDelete<unknown>(["spaces", "keys", "delete", name], ctx?.context);
  if (raw === null) return encode({ delete: "already_deleted", key: name, help: [suggest(ctx, "doctl-axi space key list", "for overview")] });
  return encode({ deleted: name, help: [suggest(ctx, "doctl-axi space key list", "for overview")] });
}
