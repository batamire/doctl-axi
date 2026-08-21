import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson } from "../lib/doctl.js";
import { projectFields, toDropletDetailToon, toDropletToon, type DropletDetailRaw, type DropletRaw } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];

// Flags forwarded verbatim to `doctl compute droplet create`, in addition to
// the locally consumed --full/--context.
const CREATE_ALLOWED_FLAGS = [
  "--full",
  "--context",
  "--region",
  "--size",
  "--image",
  "--ssh-keys",
  "--tag-names",
  "--enable-monitoring",
  "--wait",
];

// Action verbs forwarded to `doctl compute droplet-action <action> <id>`.
// `required` is validated before exec; `allowed` flags are forwarded verbatim.
const DROPLET_ACTIONS: Record<string, { required?: string; allowed: string[] }> = {
  reboot: { allowed: [] },
  "power-cycle": { allowed: [] },
  resize: { required: "--size", allowed: ["--size", "--resize-disk"] },
  snapshot: { required: "--snapshot-name", allowed: ["--snapshot-name"] },
  rebuild: { required: "--image", allowed: ["--image"] },
};

// Registered subcommand table: the help disclosure and every "Available:"
// list are derived from it so advertised commands can never drift from
// implemented ones.
const SUBCOMMANDS: Record<string, string> = {
  list: "List Droplets",
  get: "Get a Droplet by id",
  create: "Create a Droplet",
  delete: "Delete a Droplet",
};

const AVAILABLE = Object.keys(SUBCOMMANDS).join(", ");


export const DROPLET_HELP = encode({
  command: "droplet",
  description: "Manage Droplets (virtual machines)",
  usage: "doctl-axi droplet <subcommand> [flags]",
  subcommands: { ...SUBCOMMANDS },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,status,size)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi droplet list",
    "doctl-axi droplet list --full",
    "doctl-axi droplet get <id>",
    "doctl-axi droplet create <name> --region nyc1 --size s-1vcpu-1gb --image ubuntu-24-04-x64",
    "doctl-axi droplet delete <id>",
    "doctl-axi droplet reboot <id>",
    "doctl-axi droplet snapshot <id> --snapshot-name web-backup",
  ],
});

export async function dropletCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    throw new AxiError("Missing subcommand for droplet", "VALIDATION_ERROR", [
      `Available: ${AVAILABLE}`,
      "Run `doctl-axi droplet --help`",
    ]);
  }
  if (sub === "list") return dropletList(args.slice(1));
  if (sub === "get") return dropletGet(args.slice(1));
  if (sub === "create") return dropletCreate(args.slice(1));
  if (sub === "delete") return dropletDelete(args.slice(1));
  if (sub in DROPLET_ACTIONS) return dropletAction(args);
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    `Available: ${AVAILABLE}`,
    `Available actions: ${Object.keys(DROPLET_ACTIONS).join(", ")}`,
    "Run `doctl-axi droplet --help`",
  ]);
}

async function dropletList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return DROPLET_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi droplet list --help` for available flags");
  // copy mutable
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");

  // after extracting known flags, any remaining flags are unknown (already checked), but leftover positional args are invalid
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi droplet list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi droplet list --help`",
    ]);
  }

  // Validate --fields values
  const allowed = new Set(["id", "name", "region", "status", "size"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requested.length === 0) {
      throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", [
        "Available: id,name,region,status,size",
      ]);
    }
    for (const f of requested) {
      if (!allowed.has(f)) {
        throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", [
          "Available: id,name,region,status,size",
        ]);
      }
    }
    fields = requested;
  }

  // Call doctl
  const raw = await doctlJson<unknown[]>("compute droplet list".split(" "), contextFlag);

  // doctl list returns array
  const rawArray = Array.isArray(raw) ? raw : [];

  if (rawArray.length === 0) {
    return "0 droplets";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    return toDropletToon(rec as never, full);
  });

  const filteredForEncode = projectFields(mapped as unknown as Record<string, unknown>[], fields);

  const totalCount = rawArray.length;
  const active = mapped.filter((d) => d.status === "active").length;

  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${totalCount} total`,
    status: `active ${active}/${mapped.length}`,
    droplets: filteredForEncode,
    help: [`droplet get ${mapped[0].id} for detail`, "doctl-axi droplet list --full for complete fields"],
  };

  return encode(payload);
}

const GET_FIELDS = ["id", "name", "region", "size", "status", "memory", "vcpus", "disk"];

async function dropletGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DROPLET_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi droplet get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi droplet get --help`"]);
  if (args.length === 0) throw new AxiError("Missing droplet id", "VALIDATION_ERROR", ["Usage: doctl-axi droplet get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi droplet get <id>"]);
  const id = args[0];
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of requested) if (!GET_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", [`Available: ${GET_FIELDS.join(",")}`]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["compute", "droplet", "get", id], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  const mapped = toDropletDetailToon(rec as unknown as DropletDetailRaw, full);
  const filtered = projectFields([mapped as unknown as Record<string, unknown>], fields)[0];
  return encode({ droplet: filtered, help: ["doctl-axi droplet list"] });
}

async function dropletCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DROPLET_HELP;
  rejectUnknownFlags(rawArgs, CREATE_ALLOWED_FLAGS, "Run `doctl-axi droplet create --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  if (args.length === 0) throw new AxiError("Missing droplet name", "VALIDATION_ERROR", ["Usage: doctl-axi droplet create <name> [flags]"]);
  const name = args[0];
  const rest = args.slice(1);
  const raw = await doctlJson<unknown>(["compute", "droplet", "create", name, ...rest], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") return encode({ result: raw, help: ["doctl-axi droplet list"] });
  const mapped = toDropletToon(rec as unknown as DropletRaw, full);
  return encode({ droplet: mapped as unknown as Record<string, unknown>, help: ["doctl-axi droplet list"] });
}

async function dropletDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return DROPLET_HELP;
  rejectUnknownFlags(rawArgs, ["--context", "--force"], "Run `doctl-axi droplet delete --help` for available flags");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const hasForce = takeBoolFlag(args, "--force");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi droplet delete --help`"]);
  if (args.length === 0) throw new AxiError("Missing droplet id", "VALIDATION_ERROR", ["Usage: doctl-axi droplet delete <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi droplet delete <id>"]);
  const id = args[0];
  const base = ["compute", "droplet", "delete", id];
  // doctl prompts for confirmation unless --force is passed; never hang.
  if (!hasForce) base.push("--force");
  const raw = await doctlDelete<unknown>(base, contextFlag);
  if (raw === null) return encode({ delete: "already_deleted", droplet: id, help: ["doctl-axi droplet list"] });
  return encode({ deleted: id, help: ["doctl-axi droplet list"] });
}

async function dropletAction(rawArgs: string[]): Promise<string> {
  const action = rawArgs[0];
  const spec = action !== undefined ? DROPLET_ACTIONS[action] : undefined;
  if (!spec) {
    throw new AxiError(`Unknown droplet action: ${action ?? "(missing)"}`, "VALIDATION_ERROR", [
      `Available actions: ${Object.keys(DROPLET_ACTIONS).join(", ")}`,
      "Usage: doctl-axi droplet <action> <id> [flags]",
    ]);
  }
  const rest = rawArgs.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) return DROPLET_HELP;
  const allowed = ["--context", ...(spec.required ? [spec.required] : []), ...spec.allowed];
  rejectUnknownFlags(rest, allowed, `Run \`doctl-axi droplet ${action} --help\` for available flags`);
  const args = [...rest];
  const contextFlag = takeFlagValue(args, "--context");
  // Consume every flag the action spec declares so they don't trip the
  // positional checks below, collecting them verbatim for doctl.
  const forwardedFlags: string[] = [];
  let hasRequired = false;
  for (const flag of spec.allowed) {
    if (flag === "--resize-disk") {
      if (takeBoolFlag(args, flag)) forwardedFlags.push(flag);
      continue;
    }
    const value = takeFlagValue(args, flag);
    if (value !== undefined) {
      forwardedFlags.push(flag, value);
      if (flag === spec.required) hasRequired = true;
    }
  }
  if (args.length === 0) throw new AxiError("Missing droplet id", "VALIDATION_ERROR", [`Usage: doctl-axi droplet ${action} <id>${spec.required ? ` ${spec.required} <value>` : ""}`]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", [`Usage: doctl-axi droplet ${action} <id>${spec.required ? ` ${spec.required} <value>` : ""}`]);
  const id = args[0];
  if (spec.required && !hasRequired) {
    throw new AxiError(`Missing required flag: ${spec.required}`, "VALIDATION_ERROR", [
      `Usage: doctl-axi droplet ${action} <id> ${spec.required} <value>`,
    ]);
  }
  const raw = await doctlJson<unknown>(["compute", "droplet-action", action, id, ...forwardedFlags], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  const payload: Record<string, unknown> = {
    action: rec && typeof rec === "object" && typeof rec.type === "string" ? rec.type : action,
    droplet: id,
  };
  if (rec && typeof rec === "object") {
    if (typeof rec.status === "string") payload.status = rec.status;
    if (rec.id !== undefined && rec.id !== null) payload.action_id = String(rec.id);
  }
  payload.help = [`doctl-axi droplet get ${id}`];
  return encode(payload);
}
