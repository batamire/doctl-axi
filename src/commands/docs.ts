import { AxiError } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { searchDocs, getDoc, clearDocsCache } from "../lib/docs.js";
import { projectFields, truncateField } from "../lib/mappers/common.js";
import { rejectUnknownFlags, takeBoolFlag, takeFlagValue, parseFields } from "../lib/args.js";
import { suggest } from "../lib/suggestions.js";

const ALLOWED_FLAGS = ["--full", "--fields"];


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

// Per-subcommand help, generated from a {usage, description, examples} table
// so every sub help block documents the same flags.
const PER_SUB_TABLE: Record<string, { usage: string; description: string; examples: string[] }> = {
  search: {
    usage: "doctl-axi docs search <query> [--full] [--fields path,title,excerpt]",
    description: "Search DigitalOcean docs via llms.txt",
    examples: ['doctl-axi docs search "droplet resize"', "doctl-axi docs search droplets --full"],
  },
  get: {
    usage: "doctl-axi docs get <path> [--full] [--fields path,excerpt]",
    description: "Fetch a docs page as markdown excerpt",
    examples: ["doctl-axi docs get /products/droplets/how-to/resize/", "doctl-axi docs get /products/droplets/how-to/resize --full"],
  },
  "find-for-service": {
    usage: "doctl-axi docs find-for-service <service> [--full] [--fields path,title,excerpt]",
    description: "Find docs for a DigitalOcean service",
    examples: ["doctl-axi docs find-for-service app-platform"],
  },
  "get-quickstart": {
    usage: "doctl-axi docs get-quickstart <path> [--full] [--fields path,excerpt]",
    description: "Fetch quickstart guide for a docs path",
    examples: ["doctl-axi docs get-quickstart /products/droplets/"],
  },
  troubleshoot: {
    usage: "doctl-axi docs troubleshoot <path> [--full] [--fields path,excerpt]",
    description: "Fetch troubleshooting guide for a docs path",
    examples: ["doctl-axi docs troubleshoot /products/droplets/how-to/resize/"],
  },
  "get-related": {
    usage: "doctl-axi docs get-related <path> [--full] [--fields path,title,excerpt]",
    description: "Find related docs for a path",
    examples: ["doctl-axi docs get-related /products/droplets/how-to/resize/"],
  },
};

const PER_SUB_HELP: Record<string, string> = Object.fromEntries(
  Object.entries(PER_SUB_TABLE).map(([sub, t]) => [
    sub,
    encode({
      command: `docs ${sub}`,
      usage: t.usage,
      description: t.description,
      flags: {
        "--full": "Disable truncation",
        "--fields": "Comma-separated fields to display",
        "--help": "Show help",
      },
      examples: t.examples,
    }),
  ]),
);

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
  rejectUnknownFlags(rawArgs, ALLOWED_FLAGS, `Run \`doctl-axi docs ${sub} --help\` for available flags`);

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

// Shared implementation of the three search-like doc handlers (search,
// find-for-service, get-related): parse --fields, derive a query from the
// positional args, run the llms.txt search, truncate, project onto the
// requested fields, and append handler-specific help hints.
type SearchLikeOpts = {
  /** Name of the required positional argument in error messages. */
  argName: string;
  /** Usage hint attached to the missing-argument error. */
  missingUsage: string;
  /** Search query derived from the positional args. */
  queryOf: (args: string[]) => string;
  /** `docs search` additionally rejects a whitespace-only query. */
  rejectEmptyQuery?: boolean;
  /** Handler-specific help hints; `firstPath` is undefined on zero results. */
  help: (ctx: { query: string; args: string[]; firstPath: string | undefined; firstFilteredPath: unknown }) => string[];
};

async function searchLikeDocs(args: string[], full: boolean, fieldsArg: string | undefined, opts: SearchLikeOpts): Promise<string> {
  const fields = parseFields(fieldsArg, ["path", "title", "excerpt"]);
  if (args.length === 0) {
    throw new AxiError(`Missing required argument: <${opts.argName}>`, "VALIDATION_ERROR", [opts.missingUsage]);
  }
  const query = opts.queryOf(args);
  if (opts.rejectEmptyQuery && !query) {
    throw new AxiError(`Missing required argument: <${opts.argName}>`, "VALIDATION_ERROR", []);
  }
  const results = await searchDocs(query, full);
  // apply truncation uniformly with the 8k policy
  const mapped = results.map((r) => ({
    path: truncateField(r.path, full),
    title: truncateField(r.title, full),
    excerpt: truncateField(r.excerpt, full),
  }));
  if (mapped.length === 0) {
    return encode({
      count: `0 results for "${query}"`,
      results: [],
      help: opts.help({ query, args, firstPath: undefined, firstFilteredPath: undefined }),
    });
  }
  const filtered = projectFields(mapped as unknown as Record<string, unknown>[], fields);
  return encode({
    count: `${mapped.length} results for "${query}"`,
    results: filtered,
    help: opts.help({
      query,
      args,
      firstPath: mapped[0]!.path,
      firstFilteredPath: (filtered[0] as Record<string, unknown> | undefined)?.path,
    }),
  });
}

async function handleSearch(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return searchLikeDocs(args, full, fieldsArg, {
    argName: "query",
    missingUsage: "Usage: doctl-axi docs search <query> [--full] [--fields path,title,excerpt]",
    rejectEmptyQuery: true,
    // join with space to allow multi-word queries passed as separate args
    queryOf: (a) => a.join(" ").trim(),
    help: ({ query, firstPath }) =>
      firstPath === undefined
        ? [suggest(undefined, `docs search "${query}" --full`, "for complete excerpts"), suggest(undefined, "docs get /path", "for full page")]
        : [
            suggest(undefined, `docs get ${firstPath}`, "for full page"),
            suggest(undefined, `docs search "${query}" --full`),
            suggest(undefined, "docs find-for-service <service>", "for service docs"),
            suggest(undefined, "docs get-related /path", "for related pages"),
          ],
  });
}

function docBasename(path: string): string | undefined {
  return path.split("/").filter(Boolean).pop();
}

// Shared implementation of the three get-like doc handlers (get, get-quickstart,
// troubleshoot): validate args, fetch the page, derive the title from markdown,
// project onto requested fields, append handler-specific help hints.
type FetchDocPageOpts = {
  /** Usage hint attached to the missing-argument error. */
  missingUsage: string;
  /** Hints attached to the unexpected-argument error. */
  unexpectedHint: string[];
  /** Handler-specific help hints appended to the payload. */
  help: (path: string) => string[];
  /** `docs get` parses --fields before validating positional args; others after. */
  parseFieldsBeforeArgs?: boolean;
};

async function fetchDocPage(args: string[], full: boolean, fieldsArg: string | undefined, opts: FetchDocPageOpts): Promise<string> {
  let fields = opts.parseFieldsBeforeArgs ? parseFields(fieldsArg, ["path", "excerpt", "title"]) : undefined;
  if (args.length === 0) {
    throw new AxiError("Missing required argument: <path>", "VALIDATION_ERROR", [opts.missingUsage]);
  }
  const docPath = args[0]!.trim();
  if (args.length > 1) {
    throw new AxiError(`Unexpected argument: ${args[1]}`, "VALIDATION_ERROR", opts.unexpectedHint);
  }
  fields ??= parseFields(fieldsArg, ["path", "excerpt", "title"]);
  const { path, excerpt } = await getDoc(docPath, full);
  const truncated = truncateField(excerpt, full);
  // Derive title from markdown # heading as fallback; basename of path if no heading found
  const titleFromMd = (() => {
    const m = excerpt.match(/^#\s+(.+)$/m);
    return m && m[1] ? m[1].trim() : docBasename(path) ?? path;
  })();
  const title = truncateField(titleFromMd, full);
  const payload = { ...projectFields([{ path, excerpt: truncated, title }], fields)[0], help: opts.help(path) };
  return encode(payload);
}

async function handleGet(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return fetchDocPage(args, full, fieldsArg, {
    parseFieldsBeforeArgs: true,
    missingUsage: "Usage: doctl-axi docs get <path> [--full]",
    unexpectedHint: ["Run `doctl-axi docs get --help`"],
    help: (path) => [suggest(undefined, `docs search "${docBasename(path) ?? "droplets"}" --full`), suggest(undefined, "docs get-related " + path, "for related pages"), suggest(undefined, "docs find-for-service <service>", "for service docs")],
  });
}

async function handleFindForService(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return searchLikeDocs(args, full, fieldsArg, {
    argName: "service",
    missingUsage: "Usage: doctl-axi docs find-for-service <service>",
    queryOf: (a) => a.join(" ").trim(),
    help: ({ query, firstPath }) =>
      firstPath === undefined
        ? [suggest(undefined, `docs search "${query}" --full`), suggest(undefined, "docs get /path", "for full page")]
        : [suggest(undefined, `docs get ${firstPath}`, "for full page"), suggest(undefined, `docs search "${query}" --full`)],
  });
}

async function handleGetQuickstart(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return fetchDocPage(args, full, fieldsArg, {
    missingUsage: "Usage: doctl-axi docs get-quickstart <path>",
    unexpectedHint: [],
    help: (path) => [suggest(undefined, "docs get " + path, "for full page"), suggest(undefined, `docs search "${docBasename(path) ?? "droplets"}" --full`)],
  });
}
async function handleTroubleshoot(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return fetchDocPage(args, full, fieldsArg, {
    missingUsage: "Usage: doctl-axi docs troubleshoot <path>",
    unexpectedHint: [],
    help: (path) => [suggest(undefined, "docs get " + path, "for full page"), suggest(undefined, `docs search "troubleshoot ${docBasename(path) ?? ""}" --full`)],
  });
}

async function handleGetRelated(args: string[], full: boolean, fieldsArg: string | undefined): Promise<string> {
  return searchLikeDocs(args, full, fieldsArg, {
    argName: "path",
    missingUsage: "Usage: doctl-axi docs get-related <path>",
    // Use last segment as query to find related
    queryOf: (a) => {
      const docPath = a.join(" ").trim();
      return docPath.split("/").filter(Boolean).pop() ?? docPath;
    },
    help: ({ args, firstPath, firstFilteredPath }) => {
      const docPath = args.join(" ").trim();
      const segment = docPath.split("/").filter(Boolean).pop() ?? docPath;
      return firstPath === undefined
        ? [suggest(undefined, `docs search "${segment}" --full`), suggest(undefined, `docs get ${docPath}`, "for full page")]
        : [suggest(undefined, `docs get ${firstFilteredPath}`, "for full page"), suggest(undefined, `docs search "${segment}" --full`)];
    },
  });
}
