import { AxiError } from "axi-sdk-js";
import { doctlJson } from "../lib/doctl.js";
import { toDropletToon } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FLAGS = ["--full", "--fields", "--context"];


export const DROPLET_HELP = encode({
  command: "droplet",
  description: "Manage Droplets (virtual machines)",
  usage: "doctl-axi droplet <subcommand> [flags]",
  subcommands: {
    list: "List Droplets",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,status,size)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi droplet list",
    "doctl-axi droplet list --full",
    "doctl-axi droplet list --fields id,name",
    "doctl-axi droplet list --context my-team",
  ],
});

export async function dropletCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    throw new AxiError("Missing subcommand for droplet", "VALIDATION_ERROR", [
      "Available: list",
      "Run `doctl-axi droplet --help`",
    ]);
  }
  if (sub === "list") {
    return dropletList(args.slice(1));
  }
  throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
    "Available: list",
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

  // Filter fields if requested
  let filteredForEncode: Record<string, unknown>[];
  if (fields) {
    filteredForEncode = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else {
    filteredForEncode = mapped as unknown as Record<string, unknown>[];
  }

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
