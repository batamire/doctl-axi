import { execFile } from "node:child_process";
import { fstatSync, readFileSync } from "node:fs";
import { AxiError } from "axi-sdk-js";

export const MAX_BUFFER = 10 * 1024 * 1024;

type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function toExecResult(error: unknown, stdout: string, stderr: string): ExecResult {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { stdout: "", stderr: "ENOENT", exitCode: 127 };
    }
  }
  const exitCode =
    error && typeof error === "object" && "code" in error
      ? Number((error as { code?: number }).code ?? 1)
      : error
        ? 1
        : 0;
  // Node execFile error may have code property as number or string, fallback
  const e = error as { code?: unknown; status?: unknown } | null;
  const status = e?.status ?? e?.code;
  const numeric = typeof status === "number" ? status : exitCode;
  return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: numeric };
}

function execDoctl(args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile("doctl", args, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      resolve(toExecResult(error, stdout as string, stderr as string));
    });
  });
}

function resolveTokenFromStdin(): string | undefined {
  if (process.stdin.isTTY) return undefined;
  try {
    const stdin = process.stdin as unknown as { readableLength?: number };
    if (typeof stdin.readableLength === "number" && stdin.readableLength > 0) {
      const data = readFileSync(0, "utf-8").trim();
      if (data.length > 0) return data;
      return undefined;
    }
    try {
      const stat = fstatSync(0);
      if (stat.size > 0) {
        const data = readFileSync(0, "utf-8").trim();
        if (data.length > 0) return data;
      }
    } catch {}
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveToken(contextFlag: string | undefined): string | undefined {
  if (contextFlag) return undefined;
  const access = process.env.DIGITALOCEAN_ACCESS_TOKEN;
  if (access && access.trim().length > 0) return access.trim();
  const labs = process.env.DIGITALOCEAN_API_TOKEN;
  if (labs && labs.trim().length > 0) return labs.trim();
  const stdinToken = resolveTokenFromStdin();
  if (stdinToken) return stdinToken;
  return undefined;
}

export function mapDoctlError(detail: string, _exitCode: number): AxiError {
  const lower = detail.toLowerCase();
  if (lower.includes("access token is required") || lower.includes("unable to initialize digitalocean api client")) {
    return new AxiError(detail, "AUTH_MISSING", [
      "export DIGITALOCEAN_ACCESS_TOKEN=... or run: doctl auth init",
    ]);
  }
  if (lower.includes("unable to authenticate") || lower.includes("401")) {
    return new AxiError(detail, "AUTH_MISSING", [
      "export DIGITALOCEAN_ACCESS_TOKEN=... or run: doctl auth init",
    ]);
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return new AxiError(detail, "NOT_FOUND", []);
  }
  if (lower.includes("not authorized") || lower.includes("403") || lower.includes("forbidden")) {
    return new AxiError(detail, "FORBIDDEN", []);
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return new AxiError(detail, "RATE_LIMITED", []);
  }
  return new AxiError(detail, "UNKNOWN", []);
}

function parseDetailFromErrors(json: unknown): string | null {
  if (typeof json === "object" && json !== null && "errors" in json) {
    const errors = (json as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as unknown;
      if (typeof first === "string") return first;
      if (typeof first === "object" && first !== null && "detail" in first) {
        const d = (first as { detail?: unknown }).detail;
        if (typeof d === "string") return d;
      }
      try {
        return JSON.stringify(first);
      } catch {
        return String(first);
      }
    }
  }
  return null;
}

export async function doctlJson<T>(baseArgs: string[], contextFlag?: string): Promise<T> {
  const token = resolveToken(contextFlag);

  const args: string[] = [];
  if (token) {
    args.push("-t", token);
  }
  if (contextFlag) {
    args.push("--context", contextFlag);
  }
  args.push(...baseArgs);
  if (!args.includes("--output")) {
    args.push("--output", "json");
  }

  const result = await execDoctl(args);

  if (result.stderr === "ENOENT" || result.exitCode === 127) {
    throw new AxiError("doctl is not installed or not on PATH", "UNKNOWN", [
      "Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/",
    ]);
  }

  const combined = (result.stdout + result.stderr).trim();
  // Try to parse stdout as JSON even when exitCode !=0, because errors are JSON on stdout
  let parsed: unknown = null;
  let parsedText = result.stdout.trim();
  if (parsedText.length > 0) {
    try {
      parsed = JSON.parse(parsedText);
    } catch {
      // not JSON, maybe text error
    }
  }
  if (parsed === null && combined.length > 0) {
    try {
      parsed = JSON.parse(combined);
    } catch {}
  }

  const detail = parsed !== null ? parseDetailFromErrors(parsed) : null;
  if (detail !== null) {
    throw mapDoctlError(detail, result.exitCode);
  }

  // If exitCode !=0 but no errors field, treat as error
  if (result.exitCode !== 0) {
    const msg = combined.length > 0 ? combined : `doctl exited with code ${result.exitCode}`;
    throw mapDoctlError(msg, result.exitCode);
  }

  if (parsed === null) {
    // empty or not JSON: try stdout
    if (parsedText.length === 0) {
      return [] as unknown as T;
    }
    throw new AxiError(`Failed to parse doctl output: ${parsedText.slice(0, 200)}`, "UNKNOWN", []);
  }

  return parsed as T;
}

export async function doctlRaw(baseArgs: string[], contextFlag?: string): Promise<ExecResult> {
  const token = resolveToken(contextFlag);
  const args: string[] = [];
  if (token) args.push("-t", token);
  if (contextFlag) args.push("--context", contextFlag);
  args.push(...baseArgs);
  if (!args.includes("--output")) args.push("--output", "json");
  return execDoctl(args);
}

// Delete seam: upstream 404 on a delete resolves to null so callers can report
// an idempotent no-op success instead of an error. Other errors rethrow.
export async function doctlDelete<T>(baseArgs: string[], contextFlag?: string): Promise<T | null> {
  try {
    return await doctlJson<T>(baseArgs, contextFlag);
  } catch (err) {
    if (err instanceof AxiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}
