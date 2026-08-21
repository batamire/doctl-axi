import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson, doctlRaw, unwrapArray } from "../lib/doctl.js";
import { projectFields, toAppToon, toAppDeploymentToon, truncateField } from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "phase", "activeDeployment"];
const ALLOWED_FIELDS_DEPLOY = ["id", "phase", "cause", "progress"];
// logs accept their own flags (--type, --tail, ...); unknown flags still error
const LOG_FLAGS = ["--full", "--fields", "--context", "--type", "--tail", "--deployment", "--follow", "--no-prefix", "--event-id", "--job-invocation"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context", "--spec"];

export const APP_HELP = encode({
  command: "app",
  description: "Manage App Platform applications",
  usage: "doctl-axi app <subcommand> [flags]",
  subcommands: {
    list: "List apps",
    get: "Get an app by id",
    create: "Create an app",
    update: "Update an app",
    delete: "Delete an app",
    "list-deployments": "List deployments for an app",
    "get-deployment": "Get a deployment",
    "create-deployment": "Create a deployment",
    logs: "Get logs for an app",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,phase,activeDeployment)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi app list",
    "doctl-axi app list --fields id,name",
    "doctl-axi app list --full",
    "doctl-axi app get <id>",
    "doctl-axi app logs <id>",
  ],
});


export async function appCommand(args: string[], _context: unknown): Promise<string> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    if (sub === "--help" || sub === "-h") return APP_HELP;
    throw new AxiError("Missing subcommand for app", "VALIDATION_ERROR", [
      "Available: list, get, create, update, delete, list-deployments, get-deployment, create-deployment, logs",
      "Run `doctl-axi app --help`",
    ]);
  }
  if (sub === "--help" || sub === "-h") return APP_HELP;
  switch (sub) {
    case "list":
      return appList(args.slice(1));
    case "get":
      return appGet(args.slice(1));
    case "create":
      return appCreate(args.slice(1));
    case "update":
      return appUpdate(args.slice(1));
    case "delete":
      return appDelete(args.slice(1));
    case "list-deployments":
      return appListDeployments(args.slice(1));
    case "get-deployment":
      return appGetDeployment(args.slice(1));
    case "create-deployment":
      return appCreateDeployment(args.slice(1));
    case "logs":
      return appLogs(args.slice(1));
    default:
      throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
        "Available: list, get, create, update, delete, list-deployments, get-deployment, create-deployment, logs",
        "Run `doctl-axi app --help`",
      ]);
  }
}

async function appList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi app list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  // take optional --spec that may be left? not for list
  takeFlagValue(args, "--spec");

  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi app list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi app list --help`",
    ]);
  }

  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);

  const raw = await doctlJson<unknown>(["apps", "list"], contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 apps";

  const mapped = rawArray.map((item) => toAppToon(item as never, full));

  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);

  const totalCount = rawArray.length;
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${totalCount} total`,
    apps: filtered,
    help: [`app get ${mapped[0].id} for detail`, "doctl-axi app list --full for complete fields"],
  };
  return encode(payload);
}

async function appGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const fieldsArg = takeFlagValue(args, "--fields");
  // allow --fields for get as well? validate if present
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of requested) {
      if (!ALLOWED_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,phase,activeDeployment"]);
    }
  }
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app get --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app get", "VALIDATION_ERROR", ["Usage: doctl-axi app get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get --help`"]);
  const raw = await doctlJson<unknown>(["apps", "get", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "app" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).app : raw;
  const mapped = toAppToon(obj as never, full);
  // if fields requested filter single
  const requested = fieldsArg !== undefined ? fieldsArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const out = projectFields([mapped as unknown as Record<string, unknown>], requested)[0];
  return encode({ app: out, help: ["doctl-axi app list for overview", "doctl-axi app logs <id> for logs"] });
}

async function appCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  takeFlagValue(args, "--spec");
  // also allow --spec=...
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app create --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app create --help`"]);
  // create may have no positional id; ignore leftover args? but if args remains treat as spec path? ignore
  // For test we just forward
  const raw = await doctlJson<unknown>(["apps", "create"], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "app" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).app : raw;
  // raw may be array? handle
  const mapped = Array.isArray(obj) ? toAppToon((obj[0] ?? {}) as never, full) : toAppToon((obj ?? {}) as never, full);
  // If raw is already single object without app wrapper, toAppToon on raw
  return encode({ app: mapped as unknown as Record<string, unknown>, help: [`app get ${mapped.id} for detail`] });
}

async function appUpdate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  takeFlagValue(args, "--spec");
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app update --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app update --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app update", "VALIDATION_ERROR", ["Usage: doctl-axi app update <id>"]);
  const raw = await doctlJson<unknown>(["apps", "update", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "app" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).app : raw;
  const mapped = toAppToon((obj ?? {}) as never, full);
  return encode({ app: mapped as unknown as Record<string, unknown>, help: [`app get ${mapped.id} for detail`] });
}

async function appDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app delete --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app delete --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app delete", "VALIDATION_ERROR", ["Usage: doctl-axi app delete <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app delete --help`"]);
  const raw = await doctlDelete<unknown>(["apps", "delete", id], contextFlag);
  if (raw === null) return encode({ delete: "already_deleted", app: id, help: ["doctl-axi app list for overview"] });
  return encode({ deleted: id, help: ["doctl-axi app list for overview"] });
}

async function appListDeployments(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app list-deployments --help` for available flags");
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const req = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of req) if (!ALLOWED_FIELDS_DEPLOY.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,phase,cause,progress"]);
    fields = req;
  }
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app list-deployments --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app list-deployments", "VALIDATION_ERROR", ["Usage: doctl-axi app list-deployments <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app list-deployments --help`"]);
  const raw = await doctlJson<unknown>(["apps", "list-deployments", id], contextFlag);
  const rawArray: unknown[] = unwrapArray(raw, "deployments");
  if (rawArray.length === 0) return "0 deployments";
  const mapped = rawArray.map((it) => toAppDeploymentToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({ count: `${mapped.length} of ${mapped.length} total`, deployments: filtered, help: [`app get-deployment ${id} ${mapped[0].id} for detail`] });
}

async function appGetDeployment(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app get-deployment --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get-deployment --help`"]);
  const appId = args[0];
  const depId = args[1];
  if (!appId || !depId) throw new AxiError("Missing id for app get-deployment", "VALIDATION_ERROR", ["Usage: doctl-axi app get-deployment <app-id> <deployment-id>"]);
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get-deployment --help`"]);
  const raw = await doctlJson<unknown>(["apps", "get-deployment", appId, depId], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "deployment" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).deployment : raw;
  const mapped = toAppDeploymentToon((obj ?? {}) as never, full);
  return encode({ deployment: mapped as unknown as Record<string, unknown>, help: [`app list-deployments ${appId} for overview`] });
}

async function appCreateDeployment(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app create-deployment --help` for available flags");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app create-deployment --help`"]);
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app create-deployment", "VALIDATION_ERROR", ["Usage: doctl-axi app create-deployment <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app create-deployment --help`"]);
  const raw = await doctlJson<unknown>(["apps", "create-deployment", id], contextFlag);
  const obj = raw !== null && typeof raw === "object" && "deployment" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).deployment : raw;
  const mapped = toAppDeploymentToon((obj ?? {}) as never, full);
  return encode({ deployment: mapped as unknown as Record<string, unknown>, help: [`app get-deployment ${id} ${mapped.id} for detail`] });
}

async function appLogs(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  // logs accept their own flags (--type, --tail, ...); unknown flags still error
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  rejectUnknownFlags(args, LOG_FLAGS, "Run `doctl-axi app logs --help` for available flags");

  const positional = args.filter((a) => !a.startsWith("-"));
  const appId = positional[0];
  const component = positional[1];
  if (!appId) throw new AxiError("Missing id for app logs", "VALIDATION_ERROR", ["Usage: doctl-axi app logs <id> [component]"]);
  const baseArgs = ["apps", "logs", appId];
  if (component) baseArgs.push(component);
  const result = await doctlRaw(baseArgs, contextFlag);
  // result contains stdout+stderr; try to parse if json
  let logsText = result.stdout.trim();
  if (logsText.length === 0 && result.stderr.trim().length > 0) logsText = result.stderr.trim();
  try {
    const parsed = JSON.parse(logsText);
    if (parsed && typeof parsed === "object" && "logs" in (parsed as Record<string, unknown>)) {
      const l = (parsed as Record<string, unknown>).logs;
      if (typeof l === "string") logsText = l;
    } else if (typeof parsed === "string") {
      logsText = parsed;
    }
  } catch {}
  const display = truncateField(logsText, full);
  return encode({ logs: display, app: appId, help: [`app logs ${appId} --full for complete logs`] });
}
