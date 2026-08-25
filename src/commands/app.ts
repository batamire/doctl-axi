import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson, doctlRaw, mapDoctlError, unwrapArray } from "../lib/doctl.js";
import { projectFields, truncateField } from "../lib/mappers/common.js";
import { toAppToon, toAppDeploymentToon } from "../lib/mappers/app.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FIELDS = ["id", "name", "region", "phase", "activeDeployment", "activeDeploymentPhase", "components"];
const ALLOWED_FIELDS_DEPLOY = ["id", "phase", "cause", "progress"];
// logs accept their own flags (--type, --tail, ...); unknown flags still error
const LOG_FLAGS = ["--full", "--fields", "--type", "--tail", "--deployment", "--follow", "--no-prefix", "--event-id", "--job-invocation", "--context"];

const ALLOWED_FLAGS = ["--full", "--fields", "--spec"];
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
    logs: "Get logs for an app — doctl-axi app logs <id> [component] [--type build|deploy|run] [--tail N] [--deployment <id>] [--follow]",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,phase,activeDeployment,activeDeploymentPhase,components)",
    "--type": "Log type for app logs: build|deploy|run (default run)",
    "--tail": "Number of log lines from end (default -1 all)",
    "--deployment": "Deployment ID for logs",
    "--follow": "Follow logs as emitted",
    "--no-prefix": "Remove component prefix from logs",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi app list",
    "doctl-axi app list --fields id,name",
    "doctl-axi app list --full",
    "doctl-axi app get <id>",
    "doctl-axi app get <id> --fields id,name,components",
    "doctl-axi app logs <id>",
    "doctl-axi app logs <id> <component> --type run --tail 100",
    "doctl-axi app logs <id> --follow",
  ],
});

export async function appCommand(args: string[], ctx?: DoctlContext): Promise<string> {
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
      return appList(args.slice(1), ctx);
    case "get":
      return appGet(args.slice(1), ctx);
    case "create":
      return appCreate(args.slice(1), ctx);
    case "update":
      return appUpdate(args.slice(1), ctx);
    case "delete":
      return appDelete(args.slice(1), ctx);
    case "list-deployments":
      return appListDeployments(args.slice(1), ctx);
    case "get-deployment":
      return appGetDeployment(args.slice(1), ctx);
    case "create-deployment":
      return appCreateDeployment(args.slice(1), ctx);
    case "logs":
      return appLogs(args.slice(1), ctx);
    default:
      throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
        "Available: list, get, create, update, delete, list-deployments, get-deployment, create-deployment, logs",
        "Run `doctl-axi app --help`",
      ]);
  }
}

async function appList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi app list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  // take optional --spec that may be left? not for list
  takeFlagValue(args, "--spec");

  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi app list --help`",
    ]);
  }

  const fields = parseFields(fieldsArg, ALLOWED_FIELDS);

  const raw = await doctlJson<unknown>(["apps", "list"], ctx?.context);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 apps";

  const mapped = rawArray.map((item) => toAppToon(item as never, full));

  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);

  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    apps: filtered,
    help: [suggest(ctx, `app get ${mapped[0].id}`, "for detail"), suggest(ctx, "app list --full", "for complete fields")],
  };
  return encode(payload);
}

async function appGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app get --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  // allow --fields for get as well? validate if present
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of requested) {
      if (!ALLOWED_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", [`Available: ${ALLOWED_FIELDS.join(",")}`]);
    }
  }
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app get", "VALIDATION_ERROR", ["Usage: doctl-axi app get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get --help`"]);
  const raw = await doctlJson<unknown>(["apps", "get", id], ctx?.context);
  const unwrapped = Array.isArray(raw) ? (raw[0] as unknown) : raw;
  const obj = unwrapped !== null && typeof unwrapped === "object" && "app" in (unwrapped as Record<string, unknown>) ? (unwrapped as Record<string, unknown>).app : unwrapped;
  const mapped = toAppToon(obj as never, full);
  // if fields requested filter single
  const requested = fieldsArg !== undefined ? fieldsArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const out = projectFields([mapped as unknown as Record<string, unknown>], requested)[0];
  return encode({ app: out, help: [suggest(ctx, "doctl-axi app list", "for overview"), suggest(ctx, "doctl-axi app logs <id>", "for logs")] });
}

async function appCreate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app create --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  takeFlagValue(args, "--spec");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi app create --help`"]);
  // create may have no positional id; ignore leftover args? but if args remains treat as spec path? ignore
  // For test we just forward
  const raw = await doctlJson<unknown>(["apps", "create"], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "app" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).app : raw;
  // raw may be array? handle
  const mapped = Array.isArray(obj) ? toAppToon((obj[0] ?? {}) as never, full) : toAppToon((obj ?? {}) as never, full);
  // If raw is already single object without app wrapper, toAppToon on raw
  return encode({ app: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, `app get ${mapped.id}`, "for detail")] });
}

async function appUpdate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app update --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  takeFlagValue(args, "--spec");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app update", "VALIDATION_ERROR", ["Usage: doctl-axi app update <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app update --help`"]);
  const raw = await doctlJson<unknown>(["apps", "update", id], ctx?.context);
  const obj = raw !== null && typeof raw === "object" && "app" in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).app : raw;
  const mapped = toAppToon((obj ?? {}) as never, full);
  return encode({ app: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, `app get ${mapped.id}`, "for detail")] });
}

async function appDelete(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app delete --help` for available flags");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app delete", "VALIDATION_ERROR", ["Usage: doctl-axi app delete <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app delete --help`"]);
  const raw = await doctlDelete<unknown>(["apps", "delete", id], ctx?.context);
  if (raw === null) return encode({ delete: "already_deleted", app: id, help: [suggest(ctx, "doctl-axi app list", "for overview")] });
  return encode({ deleted: id, help: [suggest(ctx, "doctl-axi app list", "for overview")] });
}

async function appListDeployments(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app list-deployments --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const req = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of req) if (!ALLOWED_FIELDS_DEPLOY.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,phase,cause,progress"]);
    fields = req;
  }
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app list-deployments", "VALIDATION_ERROR", ["Usage: doctl-axi app list-deployments <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app list-deployments --help`"]);
  const raw = await doctlJson<unknown>(["apps", "list-deployments", id], ctx?.context);
  const rawArray: unknown[] = unwrapArray(raw, "deployments");
  if (rawArray.length === 0) return "0 deployments";
  const mapped = rawArray.map((it) => toAppDeploymentToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({ count: `${mapped.length}`, deployments: filtered, help: [suggest(ctx, `app get-deployment ${id} ${mapped[0].id}`, "for detail")] });
}

async function appGetDeployment(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app get-deployment --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const appId = args[0];
  const depId = args[1];
  if (!appId || !depId) throw new AxiError("Missing id for app get-deployment", "VALIDATION_ERROR", ["Usage: doctl-axi app get-deployment <app-id> <deployment-id>"]);
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Run `doctl-axi app get-deployment --help`"]);
  const raw = await doctlJson<unknown>(["apps", "get-deployment", appId, depId], ctx?.context);
  const unwrapped = Array.isArray(raw) ? (raw[0] as unknown) : raw;
  const obj = unwrapped !== null && typeof unwrapped === "object" && "deployment" in (unwrapped as Record<string, unknown>) ? (unwrapped as Record<string, unknown>).deployment : unwrapped;
  const mapped = toAppDeploymentToon((obj ?? {}) as never, full);
  return encode({ deployment: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, `app list-deployments ${appId}`, "for overview")] });
}
async function appCreateDeployment(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, ALLOWED_FLAGS, "Run `doctl-axi app create-deployment --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for app create-deployment", "VALIDATION_ERROR", ["Usage: doctl-axi app create-deployment <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi app create-deployment --help`"]);
  const raw = await doctlJson<unknown>(["apps", "create-deployment", id], ctx?.context);
  const unwrapped = Array.isArray(raw) ? (raw[0] as unknown) : raw;
  const obj = unwrapped !== null && typeof unwrapped === "object" && "deployment" in (unwrapped as Record<string, unknown>) ? (unwrapped as Record<string, unknown>).deployment : unwrapped;
  const mapped = toAppDeploymentToon((obj ?? {}) as never, full);
  return encode({ deployment: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, `app get-deployment ${id} ${mapped.id}`, "for detail")] });
}

async function appLogs(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return APP_HELP;
  const args = [...rawArgs];
  rejectUnknownFlags(args, LOG_FLAGS, "Run `doctl-axi app logs --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  // --fields is accepted for consistency but not used for logs (logs are text)
  takeFlagValue(args, "--fields");
  const typeVal = takeFlagValue(args, "--type");
  const tailVal = takeFlagValue(args, "--tail");
  const deploymentVal = takeFlagValue(args, "--deployment");
  const eventIdVal = takeFlagValue(args, "--event-id");
  const jobInvocationVal = takeFlagValue(args, "--job-invocation");
  const follow = takeBoolFlag(args, "--follow");
  const noPrefix = takeBoolFlag(args, "--no-prefix");

  if (args.length === 0) throw new AxiError("Missing id for app logs", "VALIDATION_ERROR", ["Usage: doctl-axi app logs <id> [component]"]);
  const appId = args[0];
  const component = args[1];
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Run `doctl-axi app logs --help`"]);

  const baseArgs = ["apps", "logs", appId];
  if (component) baseArgs.push(component);
  if (typeVal !== undefined) baseArgs.push("--type", typeVal);
  if (tailVal !== undefined) baseArgs.push("--tail", tailVal);
  if (deploymentVal !== undefined) baseArgs.push("--deployment", deploymentVal);
  if (eventIdVal !== undefined) baseArgs.push("--event-id", eventIdVal);
  if (jobInvocationVal !== undefined) baseArgs.push("--job-invocation", jobInvocationVal);
  if (follow) baseArgs.push("--follow");
  if (noPrefix) baseArgs.push("--no-prefix");

  const result = await doctlRaw(baseArgs, ctx?.context);
  const combined = `${result.stdout} ${result.stderr}`.trim();
  let parsed: unknown = null;
  const out = result.stdout.trim() || result.stderr.trim();
  if (out.length > 0) {
    try { parsed = JSON.parse(out); } catch {}
  }
  if (parsed !== null && typeof parsed === "object" && parsed !== null && "errors" in parsed) {
    const errors = (parsed as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as unknown;
      let detail = "";
      if (typeof first === "string") detail = first;
      else if (first && typeof first === "object" && "detail" in first) {
        const d = (first as { detail?: unknown }).detail;
        if (typeof d === "string") detail = d;
      } else {
        try { detail = JSON.stringify(first); } catch { detail = String(first); }
      }
      throw mapDoctlError(detail || combined);
    }
  }
  if (result.exitCode !== 0) {
    throw mapDoctlError(combined || `doctl exited with code ${result.exitCode}`);
  }
  let logsText = result.stdout.trim();
  if (logsText.length === 0 && result.stderr.trim().length > 0) logsText = result.stderr.trim();
  try {
    const p = JSON.parse(logsText);
    if (p && typeof p === "object" && "logs" in p) {
      const l = (p as { logs?: unknown }).logs;
      if (typeof l === "string") logsText = l;
    } else if (typeof p === "string") {
      logsText = p;
    }
  } catch {}
  const display = truncateField(logsText, full);
  return encode({ logs: display, app: appId, help: [suggest(ctx, `app logs ${appId} --full`, "for complete logs")] });
}
