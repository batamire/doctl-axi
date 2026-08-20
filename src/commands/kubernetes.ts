import { AxiError } from "axi-sdk-js";
import { doctlJson, doctlRaw, mapDoctlError } from "../lib/doctl.js";
import { toKubernetesToon, toNodePoolToon, truncateField } from "../lib/toon.js";
import type { KubernetesRaw, NodePoolRaw } from "../lib/toon.js";
import { encode } from "@toon-format/toon";

const KNOWN_FLAGS = new Set(["--full", "--fields", "--context", "--help", "-h"]);
const KNOWN_FLAGS_WITH_VALUE = new Set(["--fields", "--context"]);

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (!arg.startsWith("-")) continue;
    if (arg === "--help" || arg === "-h") continue;
    if (KNOWN_FLAGS.has(arg)) {
      if (KNOWN_FLAGS_WITH_VALUE.has(arg)) i++;
      continue;
    }
    if (arg.startsWith("--fields=") || arg.startsWith("--context=")) continue;
    throw new AxiError(`Unknown flag: ${arg}`, "VALIDATION_ERROR", [
      `Run \`do-axi ${command} ${sub} --help\` for available flags`,
    ]);
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
    if (val === undefined || val.startsWith("-")) {
      throw new AxiError(`flag ${flag} requires a value`, "VALIDATION_ERROR", [
        `Run \`do-axi kubernetes --help\` for available flags`,
      ]);
    }
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const val = args[foundIndex].slice(prefix.length);
    args.splice(foundIndex, 1);
    return val;
  }
  return undefined;
}

export const KUBERNETES_HELP = encode({
  command: "kubernetes",
  description: "Manage Kubernetes clusters and node pools",
  usage: "do-axi kubernetes <subcommand> [flags]",
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
    "do-axi kubernetes cluster list",
    "do-axi kubernetes cluster list --fields id,name",
    "do-axi kubernetes cluster get <id>",
    "do-axi kubernetes cluster kubeconfig <id>",
    "do-axi kubernetes node-pool list <cluster-id>",
  ],
});

export async function kubernetesCommand(args: string[], _context: unknown): Promise<string> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return KUBERNETES_HELP;
  }
  const noun = args[0];
  if (noun === "cluster") {
    const sub = args[1];
    if (!sub || sub.startsWith("-")) {
      throw new AxiError("Missing subcommand for kubernetes cluster", "VALIDATION_ERROR", [
        "Available: list, get, create, delete, kubeconfig",
        "Run `do-axi kubernetes --help`",
      ]);
    }
    if (sub === "list") return kubernetesClusterList(args.slice(2));
    if (sub === "get") return kubernetesClusterGet(args.slice(2));
    if (sub === "create") return kubernetesClusterCreate(args.slice(2));
    if (sub === "delete") return kubernetesClusterDelete(args.slice(2));
    if (sub === "kubeconfig") return kubernetesClusterKubeconfig(args.slice(2));
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: list, get, create, delete, kubeconfig",
      "Run `do-axi kubernetes --help`",
    ]);
  }
  if (noun === "node-pool" || noun === "node_pool" || noun === "nodepool") {
    const sub = args[1];
    if (!sub || sub.startsWith("-")) {
      throw new AxiError("Missing subcommand for kubernetes node-pool", "VALIDATION_ERROR", [
        "Available: list, get, create, delete",
        "Run `do-axi kubernetes --help`",
      ]);
    }
    if (sub === "list") return nodePoolList(args.slice(2));
    if (sub === "get") return nodePoolGet(args.slice(2));
    if (sub === "create") return nodePoolCreate(args.slice(2));
    if (sub === "delete") return nodePoolDelete(args.slice(2));
    throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
      "Available: list, get, create, delete",
      "Run `do-axi kubernetes --help`",
    ]);
  }
  throw new AxiError(`Unknown subcommand: ${noun}`, "VALIDATION_ERROR", [
    "Available: cluster, node-pool",
    "Run `do-axi kubernetes --help`",
  ]);
}

async function kubernetesClusterList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "cluster list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes cluster list --help` for available flags",
    ]);
  }
  if (args.length > 0) {
    throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes cluster list --help`",
    ]);
  }
  const allowed = new Set(["id", "name", "region", "status"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) {
      throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,region,status"]);
    }
    for (const f of requested) {
      if (!allowed.has(f)) {
        throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
      }
    }
    fields = requested;
  }
  const raw = await doctlJson<unknown>("kubernetes cluster list".split(" "), contextFlag);
  const rawArray = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) {
    return "0 kubernetes clusters";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    const rawK = rec as unknown as KubernetesRaw;
    return toKubernetesToon(rawK, full);
  });
  let filtered: Record<string, unknown>[];
  if (fields) {
    filtered = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else {
    filtered = mapped as unknown as Record<string, unknown>[];
  }
  const totalCount = rawArray.length;
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${totalCount} total`,
    clusters: filtered,
    help: [`kubernetes cluster get ${mapped[0].id} for detail`, "do-axi kubernetes cluster list --full"],
  };
  return encode(payload);
}

async function kubernetesClusterGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "cluster get");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes cluster get --help` for available flags",
    ]);
  }
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: do-axi kubernetes cluster get <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: do-axi kubernetes cluster get <id>"]);
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
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "get", id], contextFlag);
  // doctl get returns object, maybe wrapped? handle both array with 1 or object
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") {
    throw new AxiError(`Cluster ${id} not found`, "NOT_FOUND", []);
  }
  const mapped = toKubernetesToon(rec as unknown as KubernetesRaw, full);
  let filtered: Record<string, unknown> = mapped as unknown as Record<string, unknown>;
  if (fields) {
    const obj: Record<string, unknown> = {};
    for (const f of fields) obj[f] = (mapped as Record<string, unknown>)[f];
    filtered = obj;
  }
  const payload: Record<string, unknown> = {
    cluster: filtered,
    help: ["do-axi kubernetes cluster list --full"],
  };
  return encode(payload);
}

async function kubernetesClusterCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  // For create, allow pass-through flags (like --name, --region, --version, etc)
  // Only extract known global flags, leave rest for doctl
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields"); // might be unused but allow
  const contextFlag = takeFlagValue(args, "--context");
  // remaining args are doctl create flags/positional
  // Do not reject unknown flags for create (pass-through)
  // Validate fields if provided
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = new Set(["id", "name", "region", "status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,region,status"]);
  }
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "create", ...args], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") {
    return encode({ result: raw, help: ["do-axi kubernetes cluster list"] });
  }
  const mapped = toKubernetesToon(rec as unknown as KubernetesRaw, full);
  return encode({ cluster: mapped as unknown as Record<string, unknown>, help: ["do-axi kubernetes cluster list"] });
}

async function kubernetesClusterDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "cluster delete");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes cluster delete --help` for available flags",
    ]);
  }
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: do-axi kubernetes cluster delete <id>"]);
  }
  const id = args[0];
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "delete", id], contextFlag);
  // delete may return empty or object
  if (Array.isArray(raw) && raw.length === 0) {
    return encode({ deleted: id, help: ["do-axi kubernetes cluster list"] });
  }
  // if raw is object with maybe id, encode
  return encode({ deleted: id, result: raw, help: ["do-axi kubernetes cluster list"] });
}

async function kubernetesClusterKubeconfig(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const fieldsVal = takeFlagValue(args, "--fields");
  if (fieldsVal !== undefined) {
    // ignore --fields for kubeconfig (no field filtering)
  }
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes cluster kubeconfig --help` for available flags",
    ]);
  }
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: do-axi kubernetes cluster kubeconfig <id>"]);
  }
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: do-axi kubernetes cluster kubeconfig <id>"]);
  }
  const id = args[0];
  // Try doctl kubeconfig show path: kubernetes cluster kubeconfig show <id>
  // Use doctlRaw to capture raw output (may be yaml or json)
  const result = await doctlRaw(["kubernetes", "cluster", "kubeconfig", "show", id], contextFlag);
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
    throw mapDoctlError(combined || `doctl exited with code ${result.exitCode}`, result.exitCode);
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

async function nodePoolList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "node-pool list");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes node-pool list --help` for available flags",
    ]);
  }
  if (args.length === 0) {
    throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: do-axi kubernetes node-pool list <cluster-id>"]);
  }
  const clusterId = args[0];
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Usage: do-axi kubernetes node-pool list <cluster-id>"]);
  }
  const allowed = new Set(["id", "name", "size", "count", "status"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const requested = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: id,name,size,count,status"]);
    for (const f of requested) if (!allowed.has(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,name,size,count,status"]);
    fields = requested;
  }
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "list", clusterId], contextFlag);
  const rawArray = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) {
    return "0 node pools";
  }
  const mapped = rawArray.map((item) => {
    const rec = item as Record<string, unknown>;
    return toNodePoolToon(rec as unknown as NodePoolRaw, full);
  });
  let filtered: Record<string, unknown>[];
  if (fields) {
    filtered = mapped.map((d) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields!) obj[f] = (d as Record<string, unknown>)[f];
      return obj;
    });
  } else {
    filtered = mapped as unknown as Record<string, unknown>[];
  }
  const payload: Record<string, unknown> = {
    count: `${mapped.length} of ${rawArray.length} total`,
    pools: filtered,
    help: ["do-axi kubernetes node-pool list --full"],
  };
  return encode(payload);
}

async function nodePoolGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "node-pool get");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      "Run `do-axi kubernetes node-pool get --help` for available flags",
    ]);
  }
  if (args.length < 2) {
    throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi kubernetes node-pool get <cluster-id> <pool-id>"]);
  }
  const clusterId = args[0];
  const poolId = args[1];
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "get", clusterId, poolId], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") throw new AxiError(`Node pool ${poolId} not found`, "NOT_FOUND", []);
  const mapped = toNodePoolToon(rec as unknown as NodePoolRaw, full);
  return encode({ pool: mapped as unknown as Record<string, unknown>, help: ["do-axi kubernetes node-pool list"] });
}

async function nodePoolCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  // remaining includes clusterId + flags
  if (args.length === 0) throw new AxiError("Missing cluster id", "VALIDATION_ERROR", ["Usage: do-axi kubernetes node-pool create <cluster-id> [flags]"]);
  const clusterId = args[0];
  const rest = args.slice(1);
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "create", clusterId, ...rest], contextFlag);
  const rec = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;
  if (!rec || typeof rec !== "object") return encode({ result: raw, help: ["do-axi kubernetes node-pool list"] });
  const mapped = toNodePoolToon(rec as unknown as NodePoolRaw, full);
  return encode({ pool: mapped as unknown as Record<string, unknown>, help: ["do-axi kubernetes node-pool list"] });
}

async function nodePoolDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    return KUBERNETES_HELP;
  }
  rejectUnknownFlags(rawArgs, "kubernetes", "node-pool delete");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `do-axi kubernetes node-pool delete --help`"]);
  }
  if (args.length < 2) throw new AxiError("Missing arguments", "VALIDATION_ERROR", ["Usage: do-axi kubernetes node-pool delete <cluster-id> <pool-id>"]);
  const clusterId = args[0];
  const poolId = args[1];
  const raw = await doctlJson<unknown>(["kubernetes", "cluster", "node-pool", "delete", clusterId, poolId], contextFlag);
  return encode({ deleted: poolId, result: raw, help: ["do-axi kubernetes node-pool list"] });
}
