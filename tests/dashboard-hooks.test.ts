import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";

const BIN = "./dist/bin/do-axi.js";

function runCli(args: string[], opts: { env?: Record<string, string | undefined>; fakeDir?: string; homeDir?: string } = {}) {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  if (opts.fakeDir) env.PATH = `${opts.fakeDir}:${env.PATH}`;
  if (opts.homeDir) {
    env.HOME = opts.homeDir;
    // also override USERPROFILE for windows compat, but HOME is what homedir() uses via os
  }
  const result = spawnSync("node", [BIN, ...args], {
    env,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

function makeDashboardFakeDoctl(dir: string, opts: { failDroplet?: boolean } = {}) {
  const script = join(dir, "doctl");
  // bash script that inspects args to return appropriate JSON
  const content = `#!/usr/bin/env bash
set -e
args="$*"
if [[ "$args" == *"account get"* ]]; then
  cat <<'JSON'
{"account": {"email": "test@example.com", "uuid": "abc-123", "team": "my-team"}}
JSON
  exit 0
fi
if [[ "$args" == *"balance get"* ]]; then
  cat <<'JSON'
{"balance": {"account_balance": "12.34", "month_to_date_balance": "5.00"}}
JSON
  exit 0
fi
if [[ "$args" == *"droplet list"* ]]; then
  ${opts.failDroplet ? `echo '{"errors":[{"detail":"boom"}]}' ; exit 1` : `cat <<'JSON'
[{"id":1,"name":"d1","region":{"slug":"nyc1"},"status":"active","size_slug":"s-1vcpu-1gb"},{"id":2,"name":"d2","region":{"slug":"nyc1"},"status":"active","size_slug":"s-1vcpu-1gb"}]
JSON
`}
  exit 0
fi
if [[ "$args" == *"apps list"* ]]; then
  cat <<'JSON'
[{"id":"app1","spec":{"name":"my-app"},"region":"nyc","phase":"ACTIVE"}]
JSON
  exit 0
fi
if [[ "$args" == *"databases list"* ]]; then
  cat <<'JSON'
[{"id":"db1","name":"pg1","engine":"pg","version":"15","region":"nyc1","status":"online"},{"id":"db2","name":"mysql1","engine":"mysql","version":"8","region":"nyc1","status":"online"}]
JSON
  exit 0
fi
if [[ "$args" == *"kubernetes cluster list"* ]]; then
  cat <<'JSON'
[{"id":"k8s1","name":"cluster1","region":"nyc1","status":"running"}]
JSON
  exit 0
fi
if [[ "$args" == *"registry repository list"* ]]; then
  cat <<'JSON'
[{"name":"repo1","registry":"my-reg","tag_count":2,"manifest_count":2}]
JSON
  exit 0
fi
if [[ "$args" == *"domain list"* ]]; then
  cat <<'JSON'
[{"name":"example.com","ttl":3600}]
JSON
  exit 0
fi
# fallback
echo "[]"
`;
  writeFileSync(script, content);
  chmodSync(script, 0o755);
}

describe("dashboard + hooks + packaging", () => {
  let tmp: string;
  let homeTmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "do-axi-dash-"));
    homeTmp = mkdtempSync(join(tmpdir(), "do-axi-home-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(homeTmp, { recursive: true, force: true });
  });

  it("bare do-axi prints TOON dashboard account/balance + 6 aggregates + help, exit 0", () => {
    makeDashboardFakeDoctl(tmp);
    const res = runCli([], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "fake" } });
    expect(res.status).toBe(0);
    const out = res.stdout.trim();
    expect(out.length).toBeGreaterThan(0);
    const data = decode(out) as Record<string, unknown>;
    // account
    expect(data.account).toBeDefined();
    const account = data.account as Record<string, unknown>;
    expect(account.email).toBe("test@example.com");
    // balance may be string or placeholder, but should contain 12.34
    const bal = data.balance;
    expect(typeof bal === "string" ? bal : JSON.stringify(bal)).toContain("12.34");
    // 6 aggregates
    expect((data.droplet as Record<string, unknown>).count).toBe(2);
    expect((data.app as Record<string, unknown>).count).toBe(1);
    const db = data.database as Record<string, unknown>;
    expect(db.count).toBe(2);
    // engine buckets contains pg and mysql
    expect(String(db.engine)).toContain("pg=1");
    expect(String(db.engine)).toContain("mysql=1");
    expect((data.kubernetes as Record<string, unknown>).count).toBe(1);
    expect((data.registry as Record<string, unknown>).count).toBe(1);
    expect((data.domain as Record<string, unknown>).count).toBe(1);
    expect(data.help).toEqual(["do-axi droplet list"]);
  });

  it("partial failure degrades to — not crash", () => {
    makeDashboardFakeDoctl(tmp, { failDroplet: true });
    const res = runCli([], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "fake" } });
    expect(res.status).toBe(0);
    const data = decode(res.stdout.trim()) as Record<string, unknown>;
    // droplet should be —
    expect((data.droplet as Record<string, unknown>).count).toBe("—");
    // others still succeed
    expect((data.app as Record<string, unknown>).count).toBe(1);
    expect(data.help).toEqual(["do-axi droplet list"]);
  });

  it("all fetches fail still returns dashboard with — placeholders and help", () => {
    const script = join(tmp, "doctl");
    writeFileSync(script, `#!/usr/bin/env bash\necho '{"errors":[{"detail":"boom"}]}'\nexit 1\n`);
    chmodSync(script, 0o755);
    const res = runCli([], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "fake" } });
    expect(res.status).toBe(0);
    const data = decode(res.stdout.trim()) as Record<string, unknown>;
    expect((data.droplet as Record<string, unknown>).count).toBe("—");
    expect((data.database as Record<string, unknown>).count).toBe("—");
    expect(data.help).toEqual(["do-axi droplet list"]);
    const acc = data.account as Record<string, unknown>;
    expect(acc.email).toBe("—");
    expect(data.balance).toBe("—");
  });

  it("setup hooks writes hooks idempotent and --check reports OK vs DRIFT", () => {
    // first install
    const res1 = runCli(["setup", "hooks"], { homeDir: homeTmp });
    expect(res1.status).toBe(0);
    const out1 = decode(res1.stdout.trim()) as Record<string, unknown>;
    expect(out1.code).toBe("OK");
    expect(existsSync(join(homeTmp, ".claude", "settings.json"))).toBe(true);
    expect(existsSync(join(homeTmp, ".codex", "hooks.json"))).toBe(true);
    const opencodePlugin = join(homeTmp, ".config", "opencode", "plugins", "axi-do-axi.js");
    expect(existsSync(opencodePlugin)).toBe(true);
    const claudeBefore = readFileSync(join(homeTmp, ".claude", "settings.json"), "utf-8");
    const codexBefore = readFileSync(join(homeTmp, ".codex", "hooks.json"), "utf-8");
    const pluginBefore = readFileSync(opencodePlugin, "utf-8");

    // idempotent second install
    const res2 = runCli(["setup", "hooks"], { homeDir: homeTmp });
    expect(res2.status).toBe(0);
    const claudeAfter = readFileSync(join(homeTmp, ".claude", "settings.json"), "utf-8");
    expect(claudeAfter).toBe(claudeBefore);
    expect(readFileSync(join(homeTmp, ".codex", "hooks.json"), "utf-8")).toBe(codexBefore);
    expect(readFileSync(opencodePlugin, "utf-8")).toBe(pluginBefore);

    // --check OK
    const checkOk = runCli(["setup", "hooks", "--check"], { homeDir: homeTmp });
    expect(checkOk.status).toBe(0);
    const okData = decode(checkOk.stdout.trim()) as Record<string, unknown>;
    expect(okData.code).toBe("OK");

    // corrupt to cause drift
    writeFileSync(join(homeTmp, ".claude", "settings.json"), JSON.stringify({ hooks: {} }));
    const checkDrift = runCli(["setup", "hooks", "--check"], { homeDir: homeTmp });
    expect(checkDrift.status).toBe(0);
    const driftData = decode(checkDrift.stdout.trim()) as Record<string, unknown>;
    expect(driftData.code).toBe("DRIFT");
  });

  it("--version and -v fast-path print version without token", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const ver = pkg.version as string;
    const resV = runCli(["--version"], { env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: undefined } });
    expect(resV.status).toBe(0);
    expect(resV.stdout.trim()).toBe(ver);
    const resShort = runCli(["-v"], { env: { DIGITALOCEAN_ACCESS_TOKEN: undefined } });
    expect(resShort.status).toBe(0);
    expect(resShort.stdout.trim()).toBe(ver);
  });

  it("package.json fields correct", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as Record<string, unknown>;
    expect(pkg.name).toBe("do-axi");
    expect((pkg.bin as Record<string, string>)["do-axi"]).toBe("dist/bin/do-axi.js");
    expect((pkg.engines as Record<string, string>).node).toMatch(/>=20/);
    expect(pkg.packageManager).toMatch(/^pnpm@/);
    expect((pkg.dependencies as Record<string, string>)["@toon-format/toon"]).toBeDefined();
    expect((pkg.dependencies as Record<string, string>)["axi-sdk-js"]).toBeDefined();
    const files = pkg.files as string[];
    expect(files).toContain("dist");
    expect(files).toContain("skills/do-axi");
    expect(files).toContain("LICENSE");
    expect(files).toContain("README.md");
  });

  it("skills and packaging files exist", () => {
    expect(existsSync("skills/do-axi/SKILL.md")).toBe(true);
    const skill = readFileSync("skills/do-axi/SKILL.md", "utf-8");
    expect(skill).toContain("name: do-axi");
    expect(skill).toContain("user-invocable: false");
    expect(skill).toContain("category: devops");
    expect(existsSync("scripts/build-skill.ts")).toBe(true);
    expect(existsSync("LICENSE")).toBe(true);
    expect(existsSync("README.md")).toBe(true);
    expect(existsSync("CHANGELOG.md")).toBe(true);
    expect(existsSync(".release-please-manifest.json")).toBe(true);
  });
});
