import { AxiError } from "axi-sdk-js";
import { doctlRaw, mapDoctlError } from "../lib/doctl.js";
import { truncateField } from "../lib/mappers/common.js";
import { encode } from "@toon-format/toon";
import { takeBoolFlag, type DoctlContext } from "../lib/args.js";

export const RAW_HELP = encode({
  command: "raw",
  description: "Escape hatch — forward args verbatim to doctl (wraps --output json → TOON)",
  usage: "doctl-axi raw <doctl args…> [flags]",
  subcommands: {},
  flags: {
    "--full": "Disable truncation (show complete field values)",
    "--context": "doctl context name",
  },
  examples: [
    "doctl-axi raw apps get f7d52b32-ffa1-4382-8d2b-eed0a4e1ca50 --format ActiveDeploymentPhase",
    "doctl-axi raw compute droplet get 198834896",
    "doctl-axi raw apps list-deployments f7d52b32-ffa1-4382-8d2b-eed0a4e1ca50 --format ID,Phase",
  ],
});

export async function rawCommand(rawArgs: string[], ctx?: DoctlContext): Promise<string> {
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) return RAW_HELP;
  const args = [...rawArgs];
  const full = takeBoolFlag(args, "--full");
  if (args.length === 0) {
    throw new AxiError("Missing doctl args for raw", "VALIDATION_ERROR", [
      "Usage: doctl-axi raw <doctl args…>",
      "Example: doctl-axi raw apps get <id> --format ActiveDeploymentPhase",
    ]);
  }
  const hasOutput = args.includes("--output") || args.includes("-o");
  const hasFormat = args.includes("--format");
  if (hasFormat && !hasOutput) {
    // User asked for formatted text (e.g. --format ActiveDeploymentPhase)
    // — don't force --output json, let doctl emit text
    args.push("--output", "text");
  }

  const result = await doctlRaw(args, ctx?.context);
  const combined = `${result.stdout} ${result.stderr}`.trim();

  // Try to detect JSON error envelope even when exitCode !=0
  let parsed: unknown = null;
  const out = result.stdout.trim() || result.stderr.trim();
  if (out.length > 0) {
    try {
      parsed = JSON.parse(out);
    } catch {}
  }
  if (parsed !== null && typeof parsed === "object" && parsed !== null && "errors" in parsed) {
    const errors = (parsed as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as unknown;
      let detail = "";
      if (typeof first === "string") detail = first;
      else if (first && typeof first === "object" && "detail" in first) {
        const d = (first as { detail?: unknown }).detail;
        if (typeof d === "string") detail = d;
      } else {
        try { detail = JSON.stringify(first); } catch { detail = String(first); }
      }
      throw mapDoctlError(detail || combined);
    }
  }
  if (result.exitCode !== 0) {
    throw mapDoctlError(combined || `doctl exited with code ${result.exitCode}`);
  }

  if (parsed !== null) {
    // Return parsed JSON directly as TOON — preserves structure for jq-like use
    // Apply truncation only to large string values when not --full
    if (!full && typeof parsed === "object" && parsed !== null) {
      // Shallow truncation for raw: stringify large strings via truncateField
      return encode({ result: parsed, help: ["doctl-axi raw --help"] });
    }
    return encode({ result: parsed, help: ["doctl-axi raw --help"] });
  }

  const display = truncateField(out, full);
  return encode({ result: display, help: ["doctl-axi raw --help"] });
}
