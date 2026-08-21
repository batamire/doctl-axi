// Shared CLI-seam harness: spawn the built binary against a fake `doctl`
// placed on PATH. Used identically by every *.test.ts in this directory.
import { spawnSync } from "node:child_process";
import { writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

export const BIN = "./dist/bin/doctl-axi.js";

/** Fake doctl that prints `json` regardless of arguments, optionally capturing argv. */
export function makeFakeDoctl(dir: string, json: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  writeFileSync(script, `#!/usr/bin/env bash\n${cap}cat <<'JSON'\n${json}\nJSON\n`);
  chmodSync(script, 0o755);
}

/** Fake doctl that prints `json` and exits with `exitCode`. */
export function makeFakeDoctlWithExit(dir: string, json: string, exitCode: number) {
  const script = join(dir, "doctl");
  writeFileSync(script, `#!/usr/bin/env bash\ncat <<'JSON'\n${json}\nJSON\nexit ${exitCode}\n`);
  chmodSync(script, 0o755);
}

export type RunCliOpts = {
  env?: Record<string, string | undefined>;
  fakeDir?: string;
  stdin?: string;
  homeDir?: string;
};

/** Run the built CLI with optional env overrides and a fake-doctl PATH prefix. */
export function runCli(args: string[], opts: RunCliOpts = {}) {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  if (opts.fakeDir) env.PATH = `${opts.fakeDir}:${env.PATH}`;
  if (opts.homeDir) env.HOME = opts.homeDir;
  return spawnSync("node", [BIN, ...args], {
    env,
    input: opts.stdin,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 10000,
  });
}
