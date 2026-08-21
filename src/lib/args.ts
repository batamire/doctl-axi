import { AxiError } from "axi-sdk-js";

/**
 * Reject flags in `args` that are not listed in `allowed`, after the
 * subcommand has parsed the flags it recognizes. Positionals and
 * `--help`/`-h` always pass; `--` ends flag scanning; `--flag=value` is
 * matched by flag name. Throws VALIDATION_ERROR naming the offending flag
 * plus a one-turn usage hint: never silently drop an unknown flag, and
 * never silently accept a repeated flag (`Duplicate flag: <name>`).
 */
export function rejectUnknownFlags(
  args: string[],
  allowed: string[],
  usageHint: string,
): void {
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (!arg.startsWith("-")) continue;
    const name = arg.split("=", 1)[0];
    if (name === "-h" || name === "--help") continue;
    if (seen.has(name)) throw new AxiError(`Duplicate flag: ${name}`, "VALIDATION_ERROR", [usageHint]);
    seen.add(name);
    if (allowed.includes(name)) continue;
    throw new AxiError(`Unknown flag: ${arg}`, "VALIDATION_ERROR", [usageHint]);
  }
}

/** Check if a boolean flag is present and remove it from args. */
export function takeBoolFlag(args: string[], flag: string): boolean {
  const idx = args.indexOf(flag);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

/**
 * Get a flag's value from `--flag value` or `--flag=value` and remove it
 * from args. Returns undefined when the flag is absent; throws
 * VALIDATION_ERROR when the flag is present without a usable value.
 */
export function takeFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1) {
    const val = args[idx + 1];
    if (val === undefined || val.startsWith("-")) {
      throw new AxiError(`Missing value for ${flag}`, "VALIDATION_ERROR", []);
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

/**
 * Parse and validate a `--fields` value against the allowed field names.
 * Returns null when no value was given; throws VALIDATION_ERROR on an
 * empty list or an unknown field, naming the available fields.
 */
export function parseFields(fieldsArg: string | undefined, allowed: string[]): string[] | null {
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
