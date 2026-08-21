import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";

const BIN = "./dist/bin/doctl-axi.js";

const NOT_FOUND_JSON = JSON.stringify({ errors: [{ detail: "resource not found" }] });

// Fake doctl that always answers with a not-found error envelope on stdout, exit 1
function makeFakeDoctlNotFound(dir: string) {
  const script = join(dir, "doctl");
  writeFileSync(script, `#!/usr/bin/env bash\ncat <<'JSON'\n${NOT_FOUND_JSON}\nJSON\nexit 1\n`);
  chmodSync(script, 0o755);
}

// Fake doctl that succeeds on the first invocation and reports not-found afterwards
function makeFakeDoctlDeleteTwice(dir: string) {
  const script = join(dir, "doctl");
  writeFileSync(
    script,
    [
      "#!/usr/bin/env bash",
      `COUNT_FILE="${join(dir, "calls")}"`,
      'n=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)',
      'n=$((n+1))',
      'echo "$n" > "$COUNT_FILE"',
      'if [ "$n" -eq 1 ]; then',
      '  echo "{}"',
      "  exit 0",
      "else",
      `  cat <<'JSON'`,
      NOT_FOUND_JSON,
      "JSON",
      "  exit 1",
      "fi",
    ].join("\n"),
  );
  chmodSync(script, 0o755);
}

function runCli(args: string[], opts: { env?: Record<string, string | undefined>; fakeDir?: string } = {}) {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  if (opts.fakeDir) {
    env.PATH = `${opts.fakeDir}:${env.PATH}`;
  }
  return spawnSync("node", [BIN, ...args], { encoding: "utf-8", env });
}

describe("doctl-axi idempotent deletes CLI seam", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-idem-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("database delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlNotFound(tmp);
    const res = runCli(["database", "delete", "db-missing"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.database).toBe("db-missing");
  });

  it("kubernetes cluster delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlNotFound(tmp);
    const res = runCli(["kubernetes", "cluster", "delete", "k8s-gone"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.cluster).toBe("k8s-gone");
  });

  it("network domain delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlNotFound(tmp);
    const res = runCli(["network", "domain", "delete", "example.test"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.domain).toBe("example.test");
  });

  it("registry garbage-collection delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlNotFound(tmp);
    const res = runCli(["registry", "garbage-collection", "delete", "gc-gone"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.garbage_collection).toBe("gc-gone");
  });

  it("space key delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlNotFound(tmp);
    const res = runCli(["space", "key", "delete", "key-gone"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.key).toBe("key-gone");
  });

  it("deleting twice is a no-op success on the second call", () => {
    makeFakeDoctlDeleteTwice(tmp);
    const first = runCli(["database", "delete", "db-1"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(first.status).toBe(0);
    const firstDecoded = decode(first.stdout.trim()) as Record<string, unknown>;
    expect(firstDecoded.deleted).toBe("db-1");

    const second = runCli(["database", "delete", "db-1"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(second.status).toBe(0);
    const secondDecoded = decode(second.stdout.trim()) as Record<string, unknown>;
    expect(secondDecoded.delete).toBe("already_deleted");
    expect(secondDecoded.database).toBe("db-1");
  });

  it("non-NOT_FOUND delete errors still fail", () => {
    const script = join(tmp, "doctl");
    const body = JSON.stringify({ errors: [{ detail: "server exploded" }] });
    writeFileSync(script, `#!/usr/bin/env bash\ncat <<'JSON'\n${body}\nJSON\nexit 1\n`);
    chmodSync(script, 0o755);
    const res = runCli(["database", "delete", "db-1"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).not.toBe(0);
    expect(res.stdout).not.toContain("already_deleted");
  });
});
