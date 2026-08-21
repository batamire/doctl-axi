import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { searchDocs, getDoc, truncateExcerpt, clearDocsCache } from "../lib/docs.js";

const KNOWN_FLAGS = new Set(["--full", "--fields", "--help", "-h"]);
const KNOWN_FLAGS_WITH_VALUE = new Set(["--fields"]);

function rejectUnknownFlags(args: string[], command: string, sub: string): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) continue;
    if (a.includes("=")) {
      const key = a.split("=")[0]!;
      if (!KNOWN_FLAGS.has(key)) {
        throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [
          `Run \`doctl-axi ${command} ${sub} --help\` for available flags`,
        ]);
      }
      continue;
    }
    if (KNOWN_FLAGS_WITH_VALUE.has(a)) {
      // value is next arg, not a flag check
      continue;
    }
    if (!KNOWN_FLAGS.has(a)) {
      throw new AxiError(`Unknown flag: ${a}`, "VALIDATION_ERROR", [
        `Run \`doctl-axi ${command} ${sub} --help\` for available flags`,
      ]);
    }
    // if flag with value, skip next
    if (KNOWN_FLAGS_WITH_VALUE.has(a)) {
      i++; // consume value
    }
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
      throw new AxiError(`Flag ${flag} requires a value`, "VALIDATION_ERROR", [
        `Run \`doctl-axi docs --help\` for available flags`,
      ]);
    }
    args.splice(idx, 2);
    return val;
  }
  const prefix = `${flag}=`;
  const foundIndex = args.findIndex((a) => a.startsWith(prefix));
  if (foundIndex !== -1) {
    const raw = args[foundIndex]!;
    const val = raw.slice(prefix.length);
    args.splice(foundIndex, 1);
    return val;
  }
  return undefined;
}

function applyFieldsFilter<T extends Record<string, unknown>>(items: T[], fields: string[] | null): Record<string, unknown>[] {
  if (!fields || fields.length === 0) return items as unknown as Record<string, unknown>[];
  const allowed = new Set(fields.map((f) => f.trim()).filter(Boolean));
  return items.map((item) => {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(item)) {
      if (allowed.has(key)) obj[key] = (item as Record<string, unknown>)[key];
    }
    return obj;
  });
}

function validateFields(fieldsArg: string | undefined, allowed: string[]): string[] | null {
  if (fieldsArg === undefined) return null;
  const requested = fieldsArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    throw new AxiError("Invalid --fields: empty", "VALIDATION_ERROR", ["Available: " + allowed.join(",")]);
  }
  for (const f of requested) {
    if (!allowed.includes(f)) {
      throw new AxiError(`Unknown field: ${f}`, "VALIDATION_ERROR", ["Available: " + allowed.join(",")]);
    }
  }
  return requested;
}

export const DOCS_HELP = encode({
  command: "docs",
  description: "Search and fetch DigitalOcean documentation (no token required)",
  usage: "doctl-axi docs <subcommand> [args] [flags]",
  subcommands: {
    search: "Search docs via llms.txt — doctl-axi docs search <query>",
    get: "Fetch a docs page — doctl-axi docs get <path>",
    "find-for-service": "Find docs for a service — doctl-axi docs find-for-service <service>",
    "get-quickstart": "Fetch quickstart guide — doctl-axi docs get-quickstart <path>",
    troubleshoot: "Fetch troubleshooting guide — doctl-axi docs troubleshoot <path>",
    "get-related": "Find related docs — doctl-axi docs get-related <path>",
  },
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--fields": "Comma-separated fields to display (path,title,excerpt)",
    "--help": "Show help for a command",
  },
  examples: [
    "doctl-axi docs search \"droplet resize\"",
    "doctl-axi docs get /products/droplets/how-to/resize/",
    "doctl-axi docs search droplets --full",
    "doctl-axi docs find-for-service app-platform",
  ],
});

const SUBCOMMANDS = new Set([
  "search",
  "get",
  "find-for-service",
  "get-quickstart",
  "troubleshoot",
  "get-related",
]);

const PER_SUB_HELP: Record<string, string> = {
  search: encode({
    command: "docs search",
    usage: "doctl-axi docs search <query> [--full] [--fields path,title,excerpt]",
    description: "Search DigitalOcean docs via llms.txt",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ['doctl-axi docs search "droplet resize"', "doctl-axi docs search droplets --full"],
  }),
  get: encode({
    command: "docs get",
    usage: "doctl-axi docs get <path> [--full] [--fields path,excerpt]",
    description: "Fetch a docs page as markdown excerpt",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ["doctl-axi docs get /products/droplets/how-to/resize/", "doctl-axi docs get /products/droplets/how-to/resize --full"],
  }),
  "find-for-service": encode({
    command: "docs find-for-service",
    usage: "doctl-axi docs find-for-service <service> [--full] [--fields path,title,excerpt]",
    description: "Find docs for a DigitalOcean service",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ["doctl-axi docs find-for-service app-platform"],
  }),
  "get-quickstart": encode({
    command: "docs get-quickstart",
    usage: "doctl-axi docs get-quickstart <path> [--full] [--fields path,excerpt]",
    description: "Fetch quickstart guide for a docs path",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ["doctl-axi docs get-quickstart /products/droplets/"],
  }),
  troubleshoot: encode({
    command: "docs troubleshoot",
    usage: "doctl-axi docs troubleshoot <path> [--full] [--fields path,excerpt]",
    description: "Fetch troubleshooting guide for a docs path",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ["doctl-axi docs troubleshoot /products/droplets/how-to/resize/"],
  }),
  "get-related": encode({
    command: "docs get-related",
    usage: "doctl-axi docs get-related <path> [--full] [--fields path,title,excerpt]",
    description: "Find related docs for a path",
    flags: {
      "--full": "Disable truncation",
      "--fields": "Comma-separated fields to display",
      "--help": "Show help",
    },
    examples: ["doctl-axi docs get-related /products/droplets/how-to/resize/"],
  }),
};

export async function docsCommand(args: string[], _context: unknown): Promise<string> {
  if (args.length === 0 || args.includes("--help") && args.length === 1 || args[0] === "-h" && args.length === 1) {
    return DOCS_HELP;
  }
  // check for docs <sub> --help
  if (args.length === 2 && (args[1] === "--help" || args[1] === "-h") && SUBCOMMANDS.has(args[0]!)) {
    return PER_SUB_HELP[args[0]!] ?? DOCS_HELP;
  }
  if (args.includes("--help") || args.includes("-h")) {
    // if any --help, return help for sub if present
    const sub = args[0];
    if (sub && SUBCOMMANDS.has(sub) && PER_SUB_HELP[sub]) return PER_SUB_HELP[sub]!;
    return DOCS_HELP;
  }

  const sub = args[0];
  if (!sub || !SUBCOMMANDS.has(sub)) {
    if (sub) {
      throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", [
        "Available: search, get, find-for-service, get-quickstart, troubleshoot, get-related",
        "Run `doctl-axi docs --help` for usage",
      ]);
    }
    return DOCS_HELP;
  }

  const rawArgs = args.slice(1);
  rejectUnknownFlags(rawArgs, "docs", sub);

  const mutable = [...rawArgs];
  const full = takeBoolFlag(mutable, "--full");
  const fieldsArg = takeFlagValue(mutable, "--fields");

  // after extracting, check leftover flags are not stray
  const leftoverFlags = mutable.filter((a) => a.startsWith("-"));
  if (leftoverFlags.length > 0) {
    throw new AxiError(`Unknown flag: ${leftoverFlags[0]}`, "VALIDATION_ERROR", [
      `Run \`doctl-axi docs ${sub} --help\` for available flags`,
    ]);
  }

  switch (sub) {
    case "search":
      return handleSearch(mutable, full, fieldsArg);
    case "get":
      return handleGet(mutable, full, fieldsArg);
    case "find-for-service":
      return handleFindForService(mutable, full, fieldsArg);
    case "get-quickstart":
      return handleGetQuickstart(mutable, full, fieldsArg);
    case "troubleshoot":
      return handleTroubleshoot(mutable, full, fieldsArg);
    case "get-related":
      return handleGetRelated(mutable, full, fieldsArg);
    default:
      throw new AxiError(`Unknown subcommand: ${sub}`, "VALIDATION_ERROR", []);
  }
}

// used by tests to clear cache
export function __clearDocsCacheForTest(): void {
  clearDocsCache();
}

async function handleSearch(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  const allowed = ["path", "title", "excerpt"];
  const fields = validateFields(fieldsArg, allowed);
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <query>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs search <query> [--full] [--fields path,title,excerpt]",
    ]);
  }
  if (args.length > 1) {
    // join with space to allow multi-word queries passed as separate args
  }
  const query = args.join(" ").trim();
  if (!query) {
    throw new AxiError("Missing required argument: <query>", "VALIDATION_ERROR", []);
  }
  const results = await searchDocs(query, full);
  // apply truncation uniformly with 8k policy via truncateExcerpt
  const mapped = results.map((r) => ({
    path: truncateExcerpt(r.path, full),
    title: truncateExcerpt(r.title, full),
    excerpt: truncateExcerpt(r.excerpt, full),
  }));
  if (mapped.length === 0) {
    return encode({
      count: `0 results for "${query}"`,
      results: [],
      help: [`docs search "${query}" --full for complete excerpts`, `docs get /path for full page`],
    });
  }
  const filtered = applyFieldsFilter(mapped as unknown as Record<string, unknown>[], fields);
  const countLine = `${mapped.length} results for "${query}"`;
  const help = [`docs get ${mapped[0]!.path} for full page`, `docs search "${query}" --full`];
  // add generic next steps
  help.push("docs find-for-service <service> for service docs");
  help.push("docs get-related /path for related pages");
  const payload: Record<string, unknown> = {
    count: countLine,
    results: filtered,
    help,
  };
  return encode(payload);
}

async function handleGet(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  const allowed = ["path", "excerpt", "title"];
  const fields = validateFields(fieldsArg, allowed);
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <path>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs get <path> [--full]",
    ]);
  }
  const docPath = args[0]!.trim();
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", ["Run `doctl-axi docs get --help`"]);
  }
  const { path, excerpt } = await getDoc(docPath, full);
  // truncate excerpt if needed
  const truncated = truncateExcerpt(excerpt, full);
  // Derive title from markdown # heading as fallback; basename of path if no heading found
  const titleFromMd = (() => {
    const m = excerpt.match(/^#\s+(.+)$/m);
    if (m && m[1]) return m[1].trim();
    const last = path.split("/").filter(Boolean).pop();
    return last ? last : path;
  })();
  const title = truncateExcerpt(titleFromMd, full);
  const help = [`docs search "${path.split("/").filter(Boolean).pop() ?? "droplets"}" --full`, "docs get-related " + path + " for related pages", "docs find-for-service <service> for service docs"];
  // Build payload respects fields
  let payload: Record<string, unknown>;
  if (fields) {
    const obj: Record<string, unknown> = {};
    const fullObj: Record<string, unknown> = { path, excerpt: truncated, title };
    for (const f of fields) obj[f] = fullObj[f];
    // still include help outside fields? Help always included
    payload = { ...obj, help };
    // if path not in fields but help needs path, still payload has help
  } else {
    payload = { path, excerpt: truncated, title, help };
  }
  return encode(payload);
}

async function handleFindForService(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  const allowed = ["path", "title", "excerpt"];
  const fields = validateFields(fieldsArg, allowed);
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <service>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs find-for-service <service>",
    ]);
  }
  const service = args.join(" ").trim();
  const results = await searchDocs(service, full);
  const mapped = results.map((r) => ({
    path: truncateExcerpt(r.path, full),
    title: truncateExcerpt(r.title, full),
    excerpt: truncateExcerpt(r.excerpt, full),
  }));
  if (mapped.length === 0) {
    return encode({
      count: `0 results for "${service}"`,
      results: [],
      help: [`docs search "${service}" --full`, `docs get /path for full page`],
    });
  }
  const filtered = applyFieldsFilter(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} results for "${service}"`,
    results: filtered,
    help: [`docs get ${mapped[0]!.path} for full page`, `docs search "${service}" --full`],
  });
}

async function handleGetQuickstart(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  // same as get, but help hints quickstart
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <path>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs get-quickstart <path>",
    ]);
  }
  const docPath = args[0]!.trim();
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", []);
  }
  const allowed = ["path", "excerpt", "title"];
  const fields = validateFields(fieldsArg, allowed);
  const { path, excerpt } = await getDoc(docPath, full);
  const truncated = truncateExcerpt(excerpt, full);
  const titleFromMd = (() => {
    const m = excerpt.match(/^#\s+(.+)$/m);
    if (m && m[1]) return m[1].trim();
    const last = path.split("/").filter(Boolean).pop();
    return last ? last : path;
  })();
  const title = truncateExcerpt(titleFromMd, full);
  const help = ["docs get " + path + " for full page", `docs search "${path.split("/").filter(Boolean).pop() ?? "droplets"}" --full`];
  let payload: Record<string, unknown>;
  if (fields) {
    const obj: Record<string, unknown> = {};
    const fullObj: Record<string, unknown> = { path, excerpt: truncated, title };
    for (const f of fields) obj[f] = fullObj[f];
    payload = { ...obj, help };
  } else {
    payload = { path, excerpt: truncated, title, help };
  }
  return encode(payload);
}
async function handleTroubleshoot(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <path>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs troubleshoot <path>",
    ]);
  }
  const docPath = args[0]!.trim();
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", []);
  }
  const allowed = ["path", "excerpt", "title"];
  const fields = validateFields(fieldsArg, allowed);
  const { path, excerpt } = await getDoc(docPath, full);
  const truncated = truncateExcerpt(excerpt, full);
  const titleFromMd = (() => {
    const m = excerpt.match(/^#\s+(.+)$/m);
    if (m && m[1]) return m[1].trim();
    const last = path.split("/").filter(Boolean).pop();
    return last ? last : path;
  })();
  const title = truncateExcerpt(titleFromMd, full);
  const help = ["docs get " + path + " for full page", `docs search "troubleshoot ${path.split("/").filter(Boolean).pop() ?? ""}" --full`];
  let payload: Record<string, unknown>;
  if (fields) {
    const obj: Record<string, unknown> = {};
    const fullObj: Record<string, unknown> = { path, excerpt: truncated, title };
    for (const f of fields) obj[f] = fullObj[f];
    payload = { ...obj, help };
  } else {
    payload = { path, excerpt: truncated, title, help };
  }
  return encode(payload);
}

async function handleGetRelated(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  const allowed = ["path", "title", "excerpt"];
  const fields = validateFields(fieldsArg, allowed);
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <path>", "VALIDATION_ERROR", [
      "Usage: doctl-axi docs get-related <path>",
    ]);
  }
  const docPath = args.join(" ").trim();
  // Use last segment as query to find related
  const segment = docPath.split("/").filter(Boolean).pop() ?? docPath;
  const results = await searchDocs(segment, full);
  // Filter to not include exact path? keep all
  const mapped = results.map((r) => ({
    path: truncateExcerpt(r.path, full),
    title: truncateExcerpt(r.title, full),
    excerpt: truncateExcerpt(r.excerpt, full),
  }));
  if (mapped.length === 0) {
    return encode({
      count: `0 results for "${segment}"`,
      results: [],
      help: [`docs search "${segment}" --full`, `docs get ${docPath} for full page`],
    });
  }
  const filtered = applyFieldsFilter(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} results for "${segment}"`,
    results: filtered,
    help: [`docs get ${filtered[0] ? (filtered[0] as Record<string, unknown>).path : docPath} for full page`, `docs search "${segment}" --full`],
  });
}
