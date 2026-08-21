import { AxiError } from "axi-sdk-js";

/**
 * Reject flags in `args` that are not listed in `allowed`, after the
 * subcommand has parsed the flags it recognizes. Positionals and
 * `--help`/`-h` always pass; `--` ends flag scanning; `--flag=value` is
 * matched by flag name. Throws VALIDATION_ERROR naming the offending flag
 * plus a one-turn usage hint: never silently drop an unknown flag.
 */
export function rejectUnknownFlags(
  args: string[],
  allowed: string[],
  usageHint: string,
): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (!arg.startsWith("-")) continue;
    if (allowed.includes(arg.split("=", 1)[0])) continue;
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
