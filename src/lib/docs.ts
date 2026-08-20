import { AxiError } from "axi-sdk-js";
import { TRUNCATION_LIMIT, truncateField } from "./toon.js";

export const DOCS_BASE = "https://docs.digitalocean.com";
export const LLMS_TXT_URL = `${DOCS_BASE}/llms.txt`;
export const DOCS_CACHE_TTL = 30 * 60 * 1000;

type CacheEntry = { data: string; ts: number };

/** Process-local cache, TTL 30m */
export const docsCache = new Map<string, CacheEntry>();

export function clearDocsCache(): void {
  docsCache.clear();
}

async function fetchWithCache(url: string): Promise<string> {
  const now = Date.now();
  const cached = docsCache.get(url);
  if (cached && now - cached.ts < DOCS_CACHE_TTL) {
    return cached.data;
  }
  let res: Response;
  try {
    // No token injection for docs
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AxiError(`Failed to fetch docs: ${url}: ${msg}`, "UNKNOWN", [
      "Check network connectivity and try again",
      "Verify the docs path is valid",
    ]);
  }
  if (!res.ok) {
    throw new AxiError(`Failed to fetch docs: ${url}: ${res.status} ${res.statusText}`, "UNKNOWN", [
      "Check docs path is valid",
      `Try docs search for related pages`,
    ]);
  }
  const text = await res.text();
  docsCache.set(url, { data: text, ts: now });
  return text;
}

export type DocSearchResult = {
  path: string;
  title: string;
  excerpt: string;
};

function parseLlmsLine(line: string): { path: string; title: string; excerpt: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Try to extract markdown link [title](url)
  const m = trimmed.match(/\[(.+?)\]\((.+?)\)/);
  let title = "";
  let path = "";
  if (m) {
    title = m[1].trim();
    const rawUrl = m[2].trim();
    try {
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        const u = new URL(rawUrl);
        path = u.pathname;
      } else {
        path = rawUrl;
      }
    } catch {
      path = rawUrl;
    }
  } else {
    // fallback: use line as title
    title = trimmed.slice(0, 120);
    path = "";
  }

  // excerpt: text after "):" or ": "
  let excerpt = trimmed;
  const linkCloseIdx = trimmed.indexOf("):");
  if (linkCloseIdx !== -1) {
    excerpt = trimmed.slice(linkCloseIdx + 2).trim();
    // remove leading : or - if present
    if (excerpt.startsWith(":")) excerpt = excerpt.slice(1).trim();
    if (excerpt.startsWith("-")) excerpt = excerpt.slice(1).trim();
  } else {
    // fallback: split on ": " after link
    const colonIdx = trimmed.indexOf(": ");
    if (colonIdx !== -1 && m && trimmed.indexOf(m[0]) < colonIdx) {
      excerpt = trimmed.slice(colonIdx + 2).trim();
    } else if (colonIdx !== -1) {
      excerpt = trimmed.slice(colonIdx + 2).trim();
    } else {
      // no colon, use remaining line without link
      if (m) {
        excerpt = trimmed.replace(m[0], "").trim();
        if (excerpt.startsWith(":") || excerpt.startsWith("-")) excerpt = excerpt.slice(1).trim();
      }
    }
  }
  if (!excerpt) excerpt = trimmed;
  return { path, title, excerpt };
}

export async function searchDocs(query: string, _full = false): Promise<DocSearchResult[]> {
  const llms = await fetchWithCache(LLMS_TXT_URL);
  const lower = query.toLowerCase();
  const lines = llms.split("\n");
  const results: DocSearchResult[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!line.toLowerCase().includes(lower)) continue;
    const parsed = parseLlmsLine(line);
    if (!parsed) continue;
    results.push(parsed);
  }
  return results;
}

export async function getDoc(path: string, _full = false): Promise<{ path: string; excerpt: string }> {
  let p = path.trim();
  if (!p) p = "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/")) p = p + "/";
  const url = `${DOCS_BASE}${p}index.html.md`;
  const md = await fetchWithCache(url);
  return { path: p, excerpt: md };
}

export function truncateExcerpt(excerpt: string, full: boolean): string {
  return truncateField(excerpt, full);
}

// expose for tests
export { TRUNCATION_LIMIT };
