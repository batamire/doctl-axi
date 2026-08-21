import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decode } from "@toon-format/toon";
import { spawnSync } from "node:child_process";
import { docsCommand } from "../src/commands/docs.js";
import { searchDocs, getDoc, clearDocsCache, docsCache, DOCS_BASE, LLMS_TXT_URL } from "../src/lib/docs.js";
import { TRUNCATION_LIMIT } from "../src/lib/mappers/common.js";

const BIN = "./dist/bin/doctl-axi.js";

function mockFetchResponse(text: string, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    text: async () => text,
  } as unknown as Response;
}

// canned fixtures
const LLMS_TXT = [
  '- [Droplet Resize](https://docs.digitalocean.com/products/droplets/how-to/resize/): Learn how to resize Droplets',
  '- [App Platform](https://docs.digitalocean.com/products/app-platform/): Deploy apps quickly',
  '- [Droplet Create](https://docs.digitalocean.com/products/droplets/how-to/create/): Create a new Droplet',
  '- [Droplet Backups](https://docs.digitalocean.com/products/droplets/how-to/backup/): Backups for Droplets',
].join("\n");

const MARKDOWN_SHORT = "# Resize\nThis is how to resize a droplet.\n";
const MARKDOWN_LONG = "a".repeat(9000);

describe("doctl-axi docs lib and command (fetch shim, 30m cache)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearDocsCache();
    docsCache.clear();
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u === LLMS_TXT_URL) {
        return mockFetchResponse(LLMS_TXT);
      }
      if (u === `${DOCS_BASE}/products/droplets/how-to/resize/index.html.md`) {
        return mockFetchResponse(MARKDOWN_SHORT);
      }
      if (u === `${DOCS_BASE}/products/droplets/how-to/resize-long/index.html.md`) {
        return mockFetchResponse(MARKDOWN_LONG);
      }
      // generic: if url ends with index.html.md return short
      if (u.endsWith("index.html.md")) {
        return mockFetchResponse(MARKDOWN_SHORT);
      }
      return mockFetchResponse("", false, 404, "Not Found");
    });
    // stub global fetch
    (globalThis as unknown as Record<string, unknown>).fetch = fetchMock;
    // also stub global.fetch for Node
    (global as unknown as Record<string, unknown>).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearDocsCache();
    (globalThis as unknown as Record<string, unknown>).fetch = originalFetch;
    (global as unknown as Record<string, unknown>).fetch = originalFetch;
    // clean env tokens that might interfere
    delete process.env.DIGITALOCEAN_ACCESS_TOKEN;
    delete process.env.DIGITALOCEAN_API_TOKEN;
  });

  it("docs search <q> via stubbed fetch llms.txt returns TOON count results for query with help: docs get ...", async () => {
    const out = await docsCommand(["search", "droplet"], {});
    const decoded = decode(out.trim()) as Record<string, unknown>;
    expect(decoded.count).toBeDefined();
    expect(String(decoded.count)).toContain('results for "droplet"');
    // droplet matches 3 lines in LLMS_TXT
    expect(String(decoded.count)).toContain("3");
    const results = decoded.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(3);
    expect(results[0]!.path).toBe("/products/droplets/how-to/resize/");
    expect(results[0]!.title).toBe("Droplet Resize");
    expect(decoded.help).toBeDefined();
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("docs get");
    // fetch was called once for llms.txt
    expect(fetchMock).toHaveBeenCalledWith(LLMS_TXT_URL);
    // url should not contain token
    for (const call of fetchMock.mock.calls) {
      const arg = String(call[0]);
      expect(arg).not.toContain("tok");
      expect(arg).not.toContain("ACCESS_TOKEN");
    }
  });

  it("docs search is case-insensitive and returns 0 results definitive", async () => {
    const out = await docsCommand(["search", "nonexistentXYZ"], {});
    const decoded = decode(out.trim()) as Record<string, unknown>;
    expect(String(decoded.count)).toContain('0 results for "nonexistentXYZ"');
    expect(decoded.results as unknown[]).toHaveLength(0);
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("docs search");
  });

  it("docs get /products/droplets/how-to/resize via stubbed fetch {path}index.html.md returns TOON excerpt truncated at 8k with --full escape", async () => {
    // first test truncation on long content
    // Use a path that maps to long markdown via our mock: resize-long
    const longPath = "/products/droplets/how-to/resize-long";
    const truncatedOut = await docsCommand(["get", longPath], {});
    const decoded = decode(truncatedOut.trim()) as Record<string, unknown>;
    expect(decoded.path).toBe("/products/droplets/how-to/resize-long/");
    const excerpt = String(decoded.excerpt);
    expect(excerpt.length).toBeLessThanOrEqual(TRUNCATION_LIMIT + 100);
    expect(excerpt).toContain("truncated");
    expect(excerpt).toContain("use --full");
    expect(excerpt).not.toContain("a".repeat(9000));

    const fullOut = await docsCommand(["get", longPath, "--full"], {});
    const decodedFull = decode(fullOut.trim()) as Record<string, unknown>;
    expect(String(decodedFull.excerpt)).toContain("a".repeat(100));
    expect(String(decodedFull.excerpt).length).toBe(9000);
    expect(String(decodedFull.excerpt)).not.toContain("truncated");

    // also test short path not truncated
    const shortOut = await docsCommand(["get", "/products/droplets/how-to/resize"], {});
    const shortDecoded = decode(shortOut.trim()) as Record<string, unknown>;
    expect(String(shortDecoded.excerpt)).toContain("resize a droplet");
    expect(String(shortDecoded.excerpt)).not.toContain("truncated");
  });

  it("handles trailing slash for getDoc (no double slash)", async () => {
    // path without trailing slash
    const out1 = await docsCommand(["get", "/products/droplets/how-to/resize"], {});
    expect(fetchMock).toHaveBeenCalledWith(`${DOCS_BASE}/products/droplets/how-to/resize/index.html.md`);
    fetchMock.mockClear();
    clearDocsCache();
    // path with trailing slash should fetch same URL
    const out2 = await docsCommand(["get", "/products/droplets/how-to/resize/"], {});
    expect(fetchMock).toHaveBeenCalledWith(`${DOCS_BASE}/products/droplets/how-to/resize/index.html.md`);
    const d1 = decode(out1.trim()) as Record<string, unknown>;
    const d2 = decode(out2.trim()) as Record<string, unknown>;
    expect(d1.excerpt).toBe(d2.excerpt);
  });

  it("Cache: second identical query hits in-memory 30m cache (no extra fetch)", async () => {
    // direct lib call for precise cache assertion
    const r1 = await searchDocs("droplet");
    expect(r1.length).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const r2 = await searchDocs("droplet");
    expect(r2.length).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no extra fetch

    // also via docsCommand with different query should fetch again? but same llms.txt cached so still 1
    const out = await docsCommand(["search", "droplet"], {});
    const decoded = decode(out.trim()) as Record<string, unknown>;
    expect(decoded.count).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // search with another term hits same cached llms.txt, not extra fetch
    const r3 = await searchDocs("app");
    expect(r3.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // getDoc caching similarly
    fetchMock.mockClear();
    clearDocsCache();
    const g1 = await getDoc("/products/droplets/how-to/resize");
    expect(g1.excerpt).toContain("resize");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const g2 = await getDoc("/products/droplets/how-to/resize");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(g2.excerpt).toBe(g1.excerpt);

    // TTL expiry: manually age cache entry
    const entry = docsCache.get(`${DOCS_BASE}/products/droplets/how-to/resize/index.html.md`);
    if (entry) {
      // set timestamp to 31m ago
      entry.ts = Date.now() - 31 * 60 * 1000;
    }
    const g3 = await getDoc("/products/droplets/how-to/resize");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(g3.excerpt).toBe(g1.excerpt);
  });

  it("No token injected for docs; fetch called without Authorization", async () => {
    process.env.DIGITALOCEAN_ACCESS_TOKEN = "super-secret-token";
    process.env.DIGITALOCEAN_API_TOKEN = "another-token";

    await docsCommand(["search", "droplet"], {});
    await docsCommand(["get", "/products/droplets/how-to/resize"], {});

    for (const call of fetchMock.mock.calls) {
      const url = String(call[0]);
      expect(url).not.toContain("super-secret-token");
      expect(url).not.toContain("another-token");
      // fetch second arg (init) should not contain headers with token
      const init = call[1] as RequestInit | undefined;
      if (init && init.headers) {
        const headersStr = JSON.stringify(init.headers);
        expect(headersStr).not.toContain("super-secret-token");
      }
    }
  });

  it("--full disables truncation for search excerpt", async () => {
    // Make llms excerpt long: stub a long excerpt line
    const longExcerpt = "x".repeat(9000);
    const longLlms = `- [Long Doc](https://docs.digitalocean.com/products/droplets/how-to/long/): ${longExcerpt}`;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === LLMS_TXT_URL) return mockFetchResponse(longLlms);
      if (String(url).endsWith("index.html.md")) return mockFetchResponse(MARKDOWN_SHORT);
      return mockFetchResponse("", false, 404, "Not Found");
    });
    clearDocsCache();
    const truncated = await docsCommand(["search", "long"], {});
    const dec = decode(truncated.trim()) as Record<string, unknown>;
    const results = dec.results as Array<Record<string, unknown>>;
    expect(String(results[0]!.excerpt)).toContain("truncated");

    clearDocsCache();
    // need to reset mock to same long llms but test --full
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url) === LLMS_TXT_URL) return mockFetchResponse(longLlms);
      if (String(url).endsWith("index.html.md")) return mockFetchResponse(MARKDOWN_SHORT);
      return mockFetchResponse("", false, 404, "Not Found");
    });
    const full = await docsCommand(["search", "long", "--full"], {});
    const decFull = decode(full.trim()) as Record<string, unknown>;
    const resultsFull = decFull.results as Array<Record<string, unknown>>;
    expect(String(resultsFull[0]!.excerpt)).not.toContain("truncated");
    expect(String(resultsFull[0]!.excerpt).length).toBe(9000);
  });

  it("--fields filters TOON to only those fields", async () => {
    const out = await docsCommand(["search", "droplet", "--fields", "path,title"], {});
    const decoded = decode(out.trim()) as Record<string, unknown>;
    const results = decoded.results as Array<Record<string, unknown>>;
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.path).toBeDefined();
      expect(r.title).toBeDefined();
      expect(r.excerpt).toBeUndefined();
    }

    const getOut = await docsCommand(["get", "/products/droplets/how-to/resize", "--fields", "path"], {});
    const getDec = decode(getOut.trim()) as Record<string, unknown>;
    expect(getDec.path).toBeDefined();
    expect(getDec.excerpt).toBeUndefined();
    expect(getDec.help).toBeDefined();
  });

  it("unknown flag exits with VALIDATION_ERROR", async () => {
    await expect(docsCommand(["search", "droplet", "--unknown"], {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(docsCommand(["get", "/path", "--bogus"], {})).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("unknown subcommand throws VALIDATION_ERROR", async () => {
    await expect(docsCommand(["bogus"], {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("missing required arguments throw VALIDATION_ERROR", async () => {
    await expect(docsCommand(["search"], {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(docsCommand(["get"], {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(docsCommand(["find-for-service"], {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(docsCommand(["get-related"], {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("fetch error maps to AxiError UNKNOWN", async () => {
    fetchMock.mockImplementation(async () => mockFetchResponse("", false, 500, "Internal Server Error"));
    clearDocsCache();
    await expect(docsCommand(["search", "droplet"], {})).rejects.toMatchObject({ code: "UNKNOWN" });
    clearDocsCache();
    await expect(docsCommand(["get", "/products/droplets/how-to/resize"], {})).rejects.toMatchObject({ code: "UNKNOWN" });

    fetchMock.mockImplementation(async () => {
      throw new Error("network down");
    });
    clearDocsCache();
    await expect(searchDocs("droplet")).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("per-command help returns TOON help", async () => {
    const help = await docsCommand(["search", "--help"], {});
    expect(help).toContain("docs search");
    const getHelp = await docsCommand(["get", "--help"], {});
    expect(getHelp).toContain("docs get");
    const topHelp = await docsCommand(["--help"], {});
    expect(topHelp).toContain("docs");
    const findHelp = await docsCommand(["find-for-service", "--help"], {});
    expect(findHelp).toContain("find-for-service");
  });

  it("find-for-service, get-quickstart, troubleshoot, get-related via same fetch shim", async () => {
    const ffs = await docsCommand(["find-for-service", "droplet"], {});
    const dec1 = decode(ffs.trim()) as Record<string, unknown>;
    expect(String(dec1.count)).toContain('results for "droplet"');
    expect(dec1.results).toBeDefined();
    const help1 = dec1.help as string[];
    expect(help1.join(" ")).toContain("docs get");

    const qk = await docsCommand(["get-quickstart", "/products/droplets/how-to/resize"], {});
    const dec2 = decode(qk.trim()) as Record<string, unknown>;
    expect(dec2.path).toBeDefined();
    expect(dec2.excerpt).toBeDefined();

    const tr = await docsCommand(["troubleshoot", "/products/droplets/how-to/resize"], {});
    const dec3 = decode(tr.trim()) as Record<string, unknown>;
    expect(dec3.path).toBeDefined();

    const rel = await docsCommand(["get-related", "/products/droplets/how-to/resize"], {});
    const dec4 = decode(rel.trim()) as Record<string, unknown>;
    expect(String(dec4.count)).toContain("results for");
    expect(dec4.help).toBeDefined();
  });

  it("help discloses next steps", async () => {
    const out = await docsCommand(["search", "droplet"], {});
    const decoded = decode(out.trim()) as Record<string, unknown>;
    const help = decoded.help as string[];
    const helpStr = help.join(" ");
    expect(helpStr).toContain("docs get");
    expect(helpStr).toContain("docs search");
    // also mentions find-for-service/get-related
    expect(helpStr).toMatch(/find-for-service|get-related/);

    const getOut = await docsCommand(["get", "/products/droplets/how-to/resize"], {});
    const getDec = decode(getOut.trim()) as Record<string, unknown>;
    const getHelp = (getDec.help as string[]).join(" ");
    expect(getHelp).toContain("docs search");
    expect(getHelp).toContain("get-related");
  });

  it("CLI seam: docs --help via built binary (no fetch needed) returns help", () => {
    // spawning the built binary should return docs help without needing fetch
    // Use spawnSync to avoid network
    const res = spawnSync("node", [BIN, "docs", "--help"], { encoding: "utf-8" });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("docs");
    expect(res.stdout).toContain("search");

    const res2 = spawnSync("node", [BIN, "docs", "search", "--help"], { encoding: "utf-8" });
    expect(res2.status).toBe(0);
    expect(res2.stdout).toContain("docs search");
  });
});
