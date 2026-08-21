export const TRUNCATION_LIMIT = 8000;

export function truncateField(value: string, full: boolean): string {
  if (full) return value;
  if (value.length <= TRUNCATION_LIMIT) return value;
  const truncated = value.length - TRUNCATION_LIMIT;
  return `${value.slice(0, TRUNCATION_LIMIT)}... [truncated ${truncated} chars, use --full]`;
}

// Project each row onto the requested fields, preserving the requested order.
// `fields === null` means no --fields was given: rows pass through untouched.
export function projectFields<T extends Record<string, unknown>>(rows: T[], fields: string[] | null): T[] {
  if (!fields) return rows;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const f of fields) obj[f] = row[f];
    return obj as T;
  });
}

// Field coercion for mappers: `str` keeps a value only when it is already a
// string; `val` stringifies anything non-nullish. Both yield "" otherwise.
export function str(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v : "";
}

export function val(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return v === undefined || v === null ? "" : String(v);
}

// Single shared path-extraction helper. Walks `path` through nested objects;
// a string encountered at any level is terminal; an object at the end of the
// path yields its `slug` when that is a string. Replaces the per-noun
// extract*Region family.
export function extractAt(raw: unknown, full: boolean, ...path: string[]): string {
  let cur: unknown = raw;
  for (const key of path) {
    if (typeof cur === "string") return truncateField(cur, full);
    if (!cur || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[key];
  }
  if (typeof cur === "string") return truncateField(cur, full);
  const obj = cur as Record<string, unknown> | null;
  if (obj && typeof obj.slug === "string") return truncateField(obj.slug, full);
  return "";
}
