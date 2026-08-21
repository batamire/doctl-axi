import { suggest } from "../lib/suggestions.js";
import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson, doctlRaw, mapDoctlError } from "../lib/doctl.js";
import { projectFields, truncateField } from "../lib/mappers/common.js";
import { toKubernetesToon, toNodePoolToon } from "../lib/mappers/kubernetes.js";
import type { KubernetesRaw, NodePoolRaw } from "../lib/mappers/kubernetes.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue, type DoctlContext } from "../lib/args.js";

const ALLOWED_FLAGS = ["--full", "--fields"];

// Flags forwarded verbatim to `doctl kubernetes cluster create`, in addition
// to the locally consumed --full/--fields.
const K8S_CREATE_ALLOWED_FLAGS = [
  "--full",
  "--fields",
  "--name",
  "--region",
  "--version",
  "--vpc-uuid",
  "--node-pool",
  "--tag",
  "--wait",
  "--surge-upgrade",
  "--ha",
  "--maintenance-window",
];


export const KUBERNETES_HELP = encode({
  command: "kubernetes",
  description: "Manage Kubernetes clusters and node pools",
  usage: "doctl-axi kubernetes <subcommand> [flags]",
  subcommands: {
    "cluster list": "List Kubernetes clusters",
    "cluster get": "Get a Kubernetes cluster by id",
    "cluster create": "Create a Kubernetes cluster",
    "cluster delete": "Delete a Kubernetes cluster",
    "cluster kubeconfig": "Get kubeconfig for a cluster",
    "node-pool list": "List node pools for a cluster",
    "node-pool get": "Get a node pool",
    "node-pool create": "Create a node pool",
    "node-pool delete": "Delete a node pool",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (id,name,region,status)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi kubernetes cluster list",
    "doctl-axi kubernetes cluster list --fields id,name",
    "doctl-axi kubernetes cluster get <id>",
    "doctl-axi kubernetes cluster kubeconfig <id>",
    "doctl-axi kubernetes node-pool list <cluster-id>",
  ],
});

export async function kubernetesCommand(args: string[], ctx?: DoctlContext): Promise<string> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return KUBERNETES_HELP;
  }
  const noun = args[0];
  if (noun === "cluster") {
    const sub = args[1];
    if (!sub || sub.startsWith("-")) {
      throw new AxiError("Missing subcommand for kubernetes cluster", "VALIDATION_ERROR", [
        "Available: list, get, create, delete, kubeconfig",
        "Run `doctl-axi kubernetes --help`",
      ]);
    }
    if (sub === "list") return kubernetesClusterList(args.slice(2), ctx);
    if (sub === "get") return kubernetesClusterGet(args.slice(2), ctx);
    if (sub === "create") return kubernetesClusterCreate(args.slice(2), ctx);
    if (sub === "delete") return kubernetesClusterDelete(args.slice(2), ctx);
    if (sub === "kubeconfig") return kubernetesClusterKubeconfig(args.slice(2), ctx);
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: list, get, create, delete, kubeconfig",
      "Run `doctl-axi kubernetes --help`",
    ]);
  }
  if (noun === "node-pool" || noun === "node_pool" || noun === "nodepool") {
    const sub = args[1];
    if (!sub || sub.startsWith("-")) {
      throw new AxiError("Missing subcommand for kubernetes node-pool", "VALIDATION_ERROR", [
        "Available: list, get, create, delete",
        "Run `doctl-axi kubernetes --help`",
      ]);
    }
    if (sub === "list") return nodePoolList(args.slice(2), ctx);
    if (sub === "get") return nodePoolGet(args.slice(2), ctx);
    if (sub === "create") return nodePoolCreate(args.slice(2), ctx);
    if (sub === "delete") return nodePoolDelete(args.slice(2), ctx);
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: list, get, create, delete",
      "Run `doctl-axi kubernetes --help`",
    ]);
  }
  throw new AxiError(`Unknown subcommand: ${noun}`, "VALIDATION_ERROR", [
    "Available: cluster, node-pool",
    "Run `doctl-axi kubernetes --help`",
  ]);
}

async function kubernetesClusterList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes cluster list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `doctl-axi kubernetes cluster list --help`",
    ]);
  }
  const fields = parseFields(fieldsArg, ["id", "name", "region", "status"]);
  const raw = await doctlJson<unknown>("kubernetes cluster list".split(" "), ctx?.context);
  const rawArray = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) {
    return "0 kubernetes clusters";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    const rawK = rec as unknown as KubernetesRaw;
    return toKubernetesToon(rawK, full);
  });
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    clusters: filtered,
    help: [suggest(ctx, `kubernetes cluster get ${mapped[0].id}`, "for detail"), suggest(ctx, "kubernetes cluster list --full")],
  };
  return encode(payload);
}

async function kubernetesClusterGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes cluster get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster get <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster get <id>"]);
  }
  const id = args[0];
  const allowed = new Set(["id", "name", "region", "status"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "get", id], ctx?.context);
  // doctl get returns object, maybe wrapped? handle both array with 1 or object
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") {
    throw new AxiError(`Cluster ${id} not found`, "NOT_FOUND", []);
  }
  const mapped = toKubernetesToon(rec as unknown as KubernetesRaw, full);
  const filtered = projectFields([mapped as unknown as Record<string, unknown>], fields)[0];
  const payload: Record<string, unknown> = {
    cluster: filtered,
    help: [suggest(ctx, "doctl-axi kubernetes cluster list --full")],
  };
  return encode(payload);
}

async function kubernetesClusterCreate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, K8S_CREATE_ALLOWED_FLAGS, "Run `doctl-axi kubernetes cluster create --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = new Set(["id", "name", "region", "status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "create", ...args], ctx?.context);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") {
    return encode({ result: raw, help: [suggest(ctx, "doctl-axi kubernetes cluster list")] });
  }
  const mapped = toKubernetesToon(rec as unknown as KubernetesRaw, full);
  const filtered = projectFields([mapped as unknown as Record<string, unknown>], fields)[0];
  return encode({ cluster: filtered, help: [suggest(ctx, "doctl-axi kubernetes cluster list")] });
}

async function kubernetesClusterDelete(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes cluster delete --help` for available flags");
  const args = [...rawArgs];
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster delete <id>"]);
  }
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster delete <id>"]);
  const id = args[0];
  const raw = await doctlDelete<unknown>(["kubernetes", "cluster", "delete", id], ctx?.context);
  if (raw === null) return encode({ delete: "already_deleted", cluster: id, help: [suggest(ctx, "doctl-axi kubernetes cluster list")] });
  return encode({ deleted: id, help: [suggest(ctx, "doctl-axi kubernetes cluster list")] });
}

async function kubernetesClusterKubeconfig(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  const args = [...rawArgs];
  rejectUnknownFlags(args, ["--full"], "Run `doctl-axi kubernetes cluster kubeconfig --help` for available flags");
  const full = takeBoolFlag(args, "--full");
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster kubeconfig <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes cluster kubeconfig <id>"]);
  }
  const id = args[0];
  // Try doctl kubeconfig show path: kubernetes cluster kubeconfig show <id>
  // Use doctlRaw to capture raw output (may be yaml or json)
  const result = await doctlRaw(["kubernetes", "cluster", "kubeconfig", "show", id], ctx?.context);
  const combined = (result.stdout + result.stderr).trim();
  if (result.exitCode !== 0) {
    // try parsing errors
    try {
      const parsed = JSON.parse(result.stdout.trim());
      const maybeErrors = (parsed as Record<string, unknown>)["errors"];
      if (maybeErrors) {
        const detail = JSON.stringify(maybeErrors);
        throw new AxiError(detail, "UNKNOWN", []);
      }
    } catch {}
    throw mapDoctlError(combined || `doctl exited with code ${result.exitCode}`);
  }
  // Try JSON parse
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    // not JSON, treat as yaml/path
  }
  if (parsed !== null && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // If parsed contains kubeconfig string or path
    if ("kubeconfig" in obj && typeof obj["kubeconfig"] === "string") {
      const content = truncateField(obj["kubeconfig"] as string, full);
      return encode({ kubeconfig: content, help: [`kubectl --kubeconfig ${obj["kubeconfig"]} get nodes`] });
    }
    if ("path" in obj && typeof obj["path"] === "string") {
      return encode({ kubeconfig: obj["path"], help: ["kubectl get nodes"] });
    }
    // generic encode parsed
    return encode({ kubeconfig: parsed, help: ["kubectl get nodes"] });
  }
  // treat combined as file path or content
  const truncated = truncateField(combined, full);
  return encode({ kubeconfig: truncated, help: ["kubectl get nodes"] });
}

async function nodePoolList(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes node-pool list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool list <cluster-id>"]);
  }
  const clusterId = args[0];
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool list <cluster-id>"]);
  }
  const fields = parseFields(fieldsArg, ["id", "name", "size", "count", "status"]);
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "list", clusterId], ctx?.context);
  const rawArray = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) {
    return "0 node pools";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    return toNodePoolToon(rec as unknown as NodePoolRaw, full);
  });
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  const payload: Record<string, unknown> = {
    count: `${mapped.length}`,
    pools: filtered,
    help: [suggest(ctx, "doctl-axi kubernetes node-pool list --full")],
  };
  return encode(payload);
}

async function nodePoolGet(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes node-pool get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  if (args.length < 2) {
    throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool get <cluster-id> <pool-id>"]);
  }
  const clusterId = args[0];
  const poolId = args[1];
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool get <cluster-id> <pool-id>"]);
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "get", clusterId, poolId], ctx?.context);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") throw new AxiError(`Node pool ${poolId} not found`, "NOT_FOUND", []);
  const mapped = toNodePoolToon(rec as unknown as NodePoolRaw, full);
  return encode({ pool: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi kubernetes node-pool list")] });
}

async function nodePoolCreate(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  // remaining includes clusterId + flags
  if (args.length === 0) throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool create <cluster-id> [flags]"]);
  const clusterId = args[0];
  const rest = args.slice(1);
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "create", clusterId, ...rest], ctx?.context);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") return encode({ result: raw, help: [suggest(ctx, "doctl-axi kubernetes node-pool list")] });
  const mapped = toNodePoolToon(rec as unknown as NodePoolRaw, full);
  return encode({ pool: mapped as unknown as Record<string, unknown>, help: [suggest(ctx, "doctl-axi kubernetes node-pool list")] });
}

async function nodePoolDelete(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi kubernetes node-pool delete --help` for available flags");
  const args = [...rawArgs];
  if (args.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool delete <cluster-id> <pool-id>"]);
  const clusterId = args[0];
  const poolId = args[1];
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Usage: doctl-axi kubernetes node-pool delete <cluster-id> <pool-id>"]);
  const raw = await doctlDelete<unknown>(["kubernetes", "cluster", "node-pool", "delete", clusterId, poolId], ctx?.context);
  if (raw === null) return encode({ delete: "already_deleted", pool: poolId, cluster: clusterId, help: [suggest(ctx, "doctl-axi kubernetes node-pool list")] });
  return encode({ deleted: poolId, help: [suggest(ctx, "doctl-axi kubernetes node-pool list")] });
}
