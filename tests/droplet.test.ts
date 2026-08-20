import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";

const BIN = "./dist/bin/do-axi.js";

function makeFakeDoctl(dir: string, json: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  writeFileSync(
    script,
    `#!/usr/bin/env bash\n${cap}cat <<'JSON'\n${json}\nJSON\n`,
  );
  chmodSync(script, 0o755);
  return script;
}

function makeFakeDoctlWithExit(dir: string, json: string, exitCode: number) {
  const script = join(dir, "doctl");
  writeFileSync(
    script,
    `#!/usr/bin/env bash\ncat <<'JSON'\n${json}\nJSON\nexit ${exitCode}\n`,
  );
  chmodSync(script, 0o755);
}

function runCli(
  args: string[],
  opts: { env?: Record<string, string | undefined>; fakeDir?: string; stdin?: string } = {},
) {
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
  const result = spawnSync("node", [BIN, ...args], {
    env,
    input: opts.stdin,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

describe("do-axi droplet list CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "do-axi-test-"));
    capture = join(tmp, "args.log");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("prints TOON count + 4 fields + help for 2 droplets, exit 0", () => {
    const json = JSON.stringify([
      { id: 12345678, name: "web-01", region: { slug: "nyc1" }, status: "active", size_slug: "s-1vcpu-1gb" },
      { id: 12345679, name: "db-01", region: { slug: "ams3" }, status: "active", size_slug: "s-2vcpu-4gb" },
    ]);
    makeFakeDoctl(tmp, json, capture);

    const res = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: undefined },
    });

    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    expect(decoded.status).toBe("active 2/2");
    const droplets = decoded.droplets as Array<Record<string, unknown>>;
    expect(droplets).toHaveLength(2);
    expect(droplets[0].id).toBe("12345678");
    expect(droplets[0].name).toBe("web-01");
    expect(droplets[0].region).toBe("nyc1");
    expect(droplets[0].size).toBe("s-1vcpu-1gb");
    expect(droplets[0].status).toBe("active");
    expect(decoded.help).toBeDefined();
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("droplet get");
    expect(help.join(" ")).toContain("--full");

    // verify -t injection
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("-t tok");
    expect(args).toContain("compute droplet list");
  });

  it("prints 0 droplets definitive empty, exit 0", () => {
    makeFakeDoctl(tmp, "[]", capture);
    const res = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 droplets");
  });

  it("--full disables truncation", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ id: 1, name: long, region: { slug: "nyc1" }, status: "active", size_slug: "s-1vcpu-1gb" }]);
    makeFakeDoctl(tmp, json);

    const truncated = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    expect(truncated.stdout).toContain("use --full");

    const full = runCli(["droplet", "list", "--full"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
    expect(full.stdout).toContain(long.slice(0, 100));
  });

  it("--fields filters TOON to only those fields", () => {
    const json = JSON.stringify([
      { id: 12345678, name: "web-01", region: { slug: "nyc1" }, status: "active", size_slug: "s-1vcpu-1gb" },
      { id: 12345679, name: "db-01", region: { slug: "ams3" }, status: "active", size_slug: "s-2vcpu-4gb" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["droplet", "list", "--fields", "id,name"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const droplets = decoded.droplets as Array<Record<string, unknown>>;
    expect(droplets[0]).toEqual({ id: "12345678", name: "web-01" });
    expect(droplets[1]).toEqual({ id: "12345679", name: "db-01" });
    // ensure other fields not present
    expect(droplets[0].region).toBeUndefined();
    expect(droplets[0].size).toBeUndefined();
  });

  it("unknown flag exits 2 with VALIDATION_ERROR code", () => {
    const json = JSON.stringify([]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["droplet", "list", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(decoded.error).toBeDefined();
    expect(String(decoded.error)).toContain("Unknown flag");
    const help = decoded.help as string[] | undefined;
    expect(help?.join(" ")).toContain("--help");
  });

  it("AUTH_MISSING when no token, no context, no stdin", () => {
    makeFakeDoctlWithExit(
      tmp,
      JSON.stringify({ errors: [{ detail: "access token is required" }] }),
      1,
    );
    const res = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("AUTH_MISSING");
    const help = (decoded.help as string[] | undefined)?.join(" ") ?? "";
    expect(help).toContain("export");
    expect(help).toMatch(/DIGITALOCEAN_ACCESS_TOKEN/);
  });

  it("injects -t from DIGITALOCEAN_API_TOKEN when ACCESS_TOKEN absent", () => {
    const json = JSON.stringify([]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: "labs123" },
    });
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("-t labs123");
    expect(args).not.toContain("-t tok");
  });

  it("--context flag takes precedence over env tokens", () => {
    const json = JSON.stringify([]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["droplet", "list", "--context", "myctx"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: "labs123" },
    });
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("--context myctx");
    expect(args).not.toContain("-t tok");
    expect(args).not.toContain("-t labs123");
  });

  it("maps doctl {errors} to AxiError codes", () => {
    makeFakeDoctlWithExit(
      tmp,
      JSON.stringify({ errors: [{ detail: "Unable to initialize DigitalOcean API client: access token is required. (hint: run 'doctl auth init')" }] }),
      1,
    );
    const res = runCli(["droplet", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("AUTH_MISSING");
  });

  it("fast-path --version prints version without SDK init", () => {
    const res = spawnSync("node", [BIN, "--version"], { encoding: "utf-8" });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0.1.0");
    // ensure no help text
    expect(res.stdout).not.toContain("usage");
  });
});
