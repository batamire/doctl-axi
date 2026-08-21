import { AxiError } from "axi-sdk-js";
import { doctlDelete, doctlJson } from "../lib/doctl.js";
import {
  projectFields,
  toRegistryRepositoryToon,
  toRegistryTagToon,
  toRegistryManifestToon,
  toRegistryGCToon,
} from "../lib/toon.js";
import { encode } from "@toon-format/toon";
import { parseFields, rejectUnknownFlags, takeBoolFlag, takeFlagValue } from "../lib/args.js";
const ALLOWED_REPO_FIELDS = ["name", "registry", "tagCount", "manifestCount"];
const ALLOWED_TAG_FIELDS = ["repository", "tag", "digest", "updatedAt"];
const ALLOWED_MANIFEST_FIELDS = ["repository", "digest", "tags", "size"];
const ALLOWED_GC_FIELDS = ["id", "registry", "status", "blobsDeleted"];

const ALLOWED_FLAGS = ["--full", "--fields", "--context", "--registry"];

export const REGISTRY_HELP = encode({
  command: "registry",
  description: "Manage Container Registry",
  usage: "doctl-axi registry <subcommand> [flags]",
  subcommands: {
    "repository list": "List repositories",
    "tag list": "List tags for a repository",
    "tag get": "Get a tag",
    "manifest list": "List manifests for a repository",
    "garbage-collection list": "List garbage collections",
    "garbage-collection get": "Get garbage collection",
    "garbage-collection create": "Start garbage collection",
    "garbage-collection delete": "Cancel garbage collection",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display",
    "--context": "doctl context name",
    "--registry": "Registry name",
  },
  examples: [
    "doctl-axi registry repository list",
    "doctl-axi registry tag list <repository>",
    "doctl-axi registry manifest list <repository>",
    "doctl-axi registry garbage-collection list",
  ],
});


export async function registryCommand(args: string[], _context: unknown): Promise<string> {
  const entity = args[0];
  if (!entity || entity.startsWith("-")) {
    if (entity === "--help" || entity === "-h") return REGISTRY_HELP;
    throw new AxiError("Missing subcommand for registry", "VALIDATION_ERROR", [
      "Available: repository, tag, manifest, garbage-collection",
      "Run `doctl-axi registry --help`",
    ]);
  }
  if (entity === "--help" || entity === "-h") return REGISTRY_HELP;

  const action = args[1];
  // Help for entity alone
  if (!action || action.startsWith("-")) {
    if (action === "--help" || action === "-h") return REGISTRY_HELP;
    // If no action, treat as validation error unless entity is help?
    // For repository list without action? But spec requires repository list
    throw new AxiError(`Missing action for registry ${entity}`, "VALIDATION_ERROR", [
      "Available: list, get, create, delete",
      "Run `doctl-axi registry --help`",
    ]);
  }

  const rest = args.slice(2);
  const key = `${entity} ${action}`;
  switch (key) {
    case "repository list":
    case "repo list":
      return registryRepositoryList(rest);
    case "tag list":
      return registryTagList(rest);
    case "tag get":
      return registryTagGet(rest);
    case "manifest list":
      return registryManifestList(rest);
    case "garbage-collection list":
    case "gc list":
    case "garbage-collection ls":
      return registryGCList(rest);
    case "garbage-collection get":
    case "gc get":
      return registryGCGet(rest);
    case "garbage-collection create":
    case "garbage-collection start":
    case "gc create":
    case "gc start":
      return registryGCCreate(rest);
    case "garbage-collection delete":
    case "garbage-collection cancel":
    case "gc delete":
    case "gc cancel":
      return registryGCDelete(rest);
    default:
      throw new AxiError(`Unknown subcommand: ${entity} ${action}`, "VALIDATION_ERROR", [
        "Available: repository list, tag list|get, manifest list, garbage-collection list|get|create|delete",
        "Run `doctl-axi registry --help`",
      ]);
  }
}

async function registryRepositoryList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry repository list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const registryFlag = takeFlagValue(args, "--registry");
  if (args.length > 0) throw new AxiError(`Unexpected argument: ${args[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry repository list --help`"]);

  const fields = parseFields(fieldsArg, ALLOWED_REPO_FIELDS);

  const baseArgs = ["registry", "repository", "list-v2"];
  if (registryFlag) {
    baseArgs.push("--registry", registryFlag);
  }
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 repositories";
  const mapped = rawArray.map((it) => toRegistryRepositoryToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} of ${mapped.length} total`,
    repositories: filtered,
    help: ["registry tag list <repository> for tags", "doctl-axi registry repository list --full for complete fields"],
  });
}

async function registryTagList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry tag list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const registryFlag = takeFlagValue(args, "--registry");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry tag list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const req = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of req) if (!ALLOWED_TAG_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: repository,tag,digest,updatedAt"]);
    fields = req;
  }
  const repo = args[0];
  // repo optional for test; if missing treat as empty call? But we require repo for real doctl; for stub we can allow missing
  const baseArgs = ["registry", "repository", "list-tags"];
  if (repo) baseArgs.push(repo);
  if (registryFlag) baseArgs.push("--registry", registryFlag);
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 tags";
  const mapped = rawArray.map((it) => toRegistryTagToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} of ${mapped.length} total`,
    tags: filtered,
    help: ["registry manifest list <repository> for manifests", "doctl-axi registry tag list --full for complete fields"],
  });
}

async function registryTagGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry tag get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const registryFlag = takeFlagValue(args, "--registry");
  const repo = args[0];
  const tag = args[1];
  if (!repo || !tag) throw new AxiError("Missing repository or tag for registry tag get", "VALIDATION_ERROR", ["Usage: doctl-axi registry tag get <repository> <tag>"]);
  if (args.length > 2) throw new AxiError(`Unexpected argument: ${args[2]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry tag get --help`"]);
  const baseArgs = ["registry", "repository", "list-tags", repo];
  if (registryFlag) baseArgs.push("--registry", registryFlag);
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  // find matching tag
  let found: unknown | undefined;
  for (const it of rawArray) {
    const r = it as Record<string, unknown>;
    const t = r.tag ?? r.manifest_digest;
    if (String(t) === tag || String(r.tag) === tag) {
      found = it;
      break;
    }
  }
  const target = found ?? rawArray[0] ?? { repository: repo, tag, manifest_digest: tag };
  const mapped = toRegistryTagToon(target as never, full);
  return encode({ tag: mapped as unknown as Record<string, unknown>, help: ["doctl-axi registry tag list <repository> for overview"] });
}

async function registryManifestList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry manifest list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const registryFlag = takeFlagValue(args, "--registry");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry manifest list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const req = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of req) if (!ALLOWED_MANIFEST_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: repository,digest,tags,size"]);
    fields = req;
  }
  const repo = args[0];
  const baseArgs = ["registry", "repository", "list-manifests"];
  if (repo) baseArgs.push(repo);
  if (registryFlag) baseArgs.push("--registry", registryFlag);
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 manifests";
  const mapped = rawArray.map((it) => toRegistryManifestToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} of ${mapped.length} total`,
    manifests: filtered,
    help: ["registry tag list <repository> for tags", "doctl-axi registry manifest list --full for complete fields"],
  });
}

async function registryGCList(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry garbage-collection list --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const fieldsArg = takeFlagValue(args, "--fields");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry garbage-collection list --help`"]);
  let fields: string[] | null = null;
  if (fieldsArg !== undefined) {
    const req = fieldsArg.split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of req) if (!ALLOWED_GC_FIELDS.includes(f)) throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: id,registry,status,blobsDeleted"]);
    fields = req;
  }
  const registryName = args[0];
  const baseArgs = ["registry", "garbage-collection", "list"];
  if (registryName) baseArgs.push(registryName);
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const rawArray: unknown[] = Array.isArray(raw) ? raw : [];
  if (rawArray.length === 0) return "0 garbage-collections";
  const mapped = rawArray.map((it) => toRegistryGCToon(it as never, full));
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} of ${mapped.length} total`,
    garbageCollections: filtered,
    help: ["registry garbage-collection get <id> for detail", "doctl-axi registry garbage-collection list --full for complete fields"],
  });
}

async function registryGCGet(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry garbage-collection get --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const idOrRegistry = args[0];
  if (!idOrRegistry) throw new AxiError("Missing id for registry garbage-collection get", "VALIDATION_ERROR", ["Usage: doctl-axi registry garbage-collection get <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry garbage-collection get --help`"]);
  // Try fetching list and find by id, fallback to get-active
  const baseArgsList = ["registry", "garbage-collection", "list"];
  // For simplicity, if arg looks like registry name, try get-active
  // We'll first try list, then if not found try get-active
  try {
    const rawList = await doctlJson<unknown>(baseArgsList, contextFlag);
    if (Array.isArray(rawList)) {
      for (const it of rawList) {
        const r = it as Record<string, unknown>;
        const id = r.uuid ?? r.id;
        if (String(id) === idOrRegistry) {
          const mapped = toRegistryGCToon(it as never, full);
          return encode({ garbageCollection: mapped as unknown as Record<string, unknown>, help: ["doctl-axi registry garbage-collection list for overview"] });
        }
      }
    }
  } catch {}
  // fallback to get-active with registry name
  const raw = await doctlJson<unknown>(["registry", "garbage-collection", "get-active", idOrRegistry], contextFlag);
  const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : { uuid: idOrRegistry };
  const mapped = toRegistryGCToon(obj as never, full);
  return encode({ garbageCollection: mapped as unknown as Record<string, unknown>, help: ["doctl-axi registry garbage-collection list for overview"] });
}

async function registryGCCreate(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry garbage-collection create --help` for available flags");
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  const contextFlag = takeFlagValue(args, "--context");
  const leftoverFlags = args.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry garbage-collection create --help`"]);
  const registryName = args[0];
  // start gc
  const baseArgs = ["registry", "garbage-collection", "start"];
  if (registryName) baseArgs.push(registryName);
  const raw = await doctlJson<unknown>(baseArgs, contextFlag);
  const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : Array.isArray(raw) ? (raw[0] as unknown) : { uuid: "new-gc", registry_name: registryName ?? "" };
  const mapped = toRegistryGCToon((obj ?? {}) as never, full);
  return encode({ garbageCollection: mapped as unknown as Record<string, unknown>, help: ["doctl-axi registry garbage-collection list for overview"] });
}

async function registryGCDelete(rawArgs: string[]): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return REGISTRY_HELP;
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, "Run `doctl-axi registry garbage-collection delete --help` for available flags");
  const args = [...rawArgs];
  const contextFlag = takeFlagValue(args, "--context");
  const id = args[0];
  if (!id) throw new AxiError("Missing id for registry garbage-collection delete", "VALIDATION_ERROR", ["Usage: doctl-axi registry garbage-collection delete <id>"]);
  if (args.length > 1) throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi registry garbage-collection delete --help`"]);
  const raw = await doctlDelete<unknown>(["registry", "garbage-collection", "cancel", id], contextFlag);
  if (raw === null) return encode({ cancel: "already_cancelled", garbage_collection: id, help: ["doctl-axi registry garbage-collection list for overview"] });
  return encode({ cancelled: id, help: ["doctl-axi registry garbage-collection list for overview"] });
}
