import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";

const BIN = "./dist/bin/doctl-axi.js";

function makeFakeDoctl(dir: string, json: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  writeFileSync(script, `#!/usr/bin/env bash\n${cap}cat <<'JSON'\n${json}\nJSON\n`);
  chmodSync(script, 0o755);
}

function makeFakeDoctlWithExit(dir: string, json: string, exitCode: number) {
  const script = join(dir, "doctl");
  writeFileSync(script, `#!/usr/bin/env bash\ncat <<'JSON'\n${json}\nJSON\nexit ${exitCode}\n`);
  chmodSync(script, 0o755);
}

function makeFakeDoctlDispatch(dir: string, dispatch: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  writeFileSync(
    script,
    `#!/usr/bin/env bash\n${cap}${dispatch}\n`,
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
    encoding: "utf-8",
    env,
    input: opts.stdin,
  });
  return result;
}

describe("doctl-axi kubernetes cluster list CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-test-"));
    capture = join(tmp, "args.log");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("prints TOON count + 4 fields + help, exit 0", () => {
    const json = JSON.stringify([
      { id: "k8s-abc", name: "prod-k8s", region: "nyc1", status: "running" },
      { id: "k8s-def", name: "staging-k8s", region: { slug: "ams3" }, status: "running" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["kubernetes", "cluster", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const clusters = decoded.clusters as Array<Record<string, unknown>>;
    expect(clusters).toHaveLength(2);
    expect(clusters[0].id).toBe("k8s-abc");
    expect(clusters[0].name).toBe("prod-k8s");
    expect(clusters[0].region).toBe("nyc1");
    expect(clusters[0].status).toBe("running");
    expect(clusters[1].region).toBe("ams3");
    expect(decoded.help).toBeDefined();
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("kubernetes cluster get");
    expect(help.join(" ")).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("-t tok");
    expect(args).toContain("kubernetes cluster list");
  });

  it("k8s alias works", () => {
    const json = JSON.stringify([{ id: "k8s-abc", name: "prod-k8s", region: "nyc1", status: "running" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["k8s", "cluster", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBeDefined();
  });

  it("doks alias works", () => {
    const json = JSON.stringify([{ id: "k8s-abc", name: "prod-k8s", region: "nyc1", status: "running" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["doks", "cluster", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
  });

  it("prints 0 kubernetes clusters definitive empty, exit 0", () => {
    makeFakeDoctl(tmp, "[]", capture);
    const res = runCli(["kubernetes", "cluster", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 kubernetes clusters");
  });

  it("--full disables truncation for kubernetes", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ id: "k8s-1", name: long, region: "nyc1", status: "running" }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["kubernetes", "cluster", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    expect(truncated.stdout).toContain("use --full");

    const full = runCli(["kubernetes", "cluster", "list", "--full"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
    expect(full.stdout).toContain(long.slice(0, 100));
  });

  it("--fields filters TOON to only those fields", () => {
    const json = JSON.stringify([
      { id: "k8s-abc", name: "prod-k8s", region: "nyc1", status: "running" },
      { id: "k8s-def", name: "staging-k8s", region: "ams3", status: "running" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["kubernetes", "cluster", "list", "--fields", "id,name"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const clusters = decoded.clusters as Array<Record<string, unknown>>;
    expect(clusters[0]).toEqual({ id: "k8s-abc", name: "prod-k8s" });
    expect(clusters[0].region).toBeUndefined();
  });

  it("kubernetes cluster get returns single cluster, exit 0", () => {
    const json = JSON.stringify({ id: "k8s-abc", name: "prod-k8s", region: "nyc1", status: "running" });
    makeFakeDoctl(tmp, json);
    const res = runCli(["kubernetes", "cluster", "get", "k8s-abc"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const cluster = decoded.cluster as Record<string, unknown>;
    expect(cluster.id).toBe("k8s-abc");
    expect(cluster.name).toBe("prod-k8s");
    expect(cluster.region).toBe("nyc1");
    expect(cluster.status).toBe("running");
  });

  it("kubernetes cluster create works", () => {
    const json = JSON.stringify({ id: "k8s-new", name: "new-k8s", region: "nyc1", status: "provisioning" });
    makeFakeDoctl(tmp, json);
    const res = runCli(["kubernetes", "cluster", "create", "--name", "new-k8s", "--region", "nyc1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const cluster = decoded.cluster as Record<string, unknown>;
    expect(cluster.id).toBe("k8s-new");
  });

  it("kubernetes cluster delete works", () => {
    const json = JSON.stringify({});
    makeFakeDoctl(tmp, json);
    const res = runCli(["kubernetes", "cluster", "delete", "k8s-abc"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.deleted).toBe("k8s-abc");
  });

  it("kubernetes cluster kubeconfig works via doctl path", () => {
    // fake doctl that handles kubeconfig show
    const dispatch = `
if [[ "$*" == *"kubeconfig"* ]]; then
cat <<'JSON'
{"kubeconfig": "apiVersion: v1\\nclusters: []"}
JSON
else
cat <<'JSON'
[]
JSON
fi
`;
    makeFakeDoctlDispatch(tmp, dispatch);
    const res = runCli(["kubernetes", "cluster", "kubeconfig", "k8s-abc"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.kubeconfig).toBeDefined();
    expect(String(decoded.kubeconfig)).toContain("apiVersion");
  });

  it("kubernetes node-pool list works", () => {
    const json = JSON.stringify([
      { id: "pool-1", name: "pool-1", size: "s-2vcpu-4gb", count: 3, status: "active" },
      { id: "pool-2", name: "pool-2", size: "s-4vcpu-8gb", count: 2, status: "active" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["kubernetes", "node-pool", "list", "k8s-abc"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBeDefined();
    const pools = decoded.pools as Array<Record<string, unknown>>;
    expect(pools).toHaveLength(2);
    expect(pools[0].name).toBe("pool-1");
  });

  it("kubernetes node-pool get/create/delete work", () => {
    const jsonGet = JSON.stringify({ id: "pool-1", name: "pool-1", size: "s-2vcpu-4gb", count: 3, status: "active" });
    makeFakeDoctl(tmp, jsonGet);
    const resGet = runCli(["kubernetes", "node-pool", "get", "k8s-abc", "pool-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resGet.status).toBe(0);
    const decodedGet = decode(resGet.stdout.trim()) as Record<string, unknown>;
    expect((decodedGet.pool as Record<string, unknown>).name).toBe("pool-1");

    const jsonCreate = JSON.stringify({ id: "pool-new", name: "new-pool", size: "s-2vcpu-2gb", count: 1, status: "provisioning" });
    makeFakeDoctl(tmp, jsonCreate);
    const resCreate = runCli(["kubernetes", "node-pool", "create", "k8s-abc", "--name", "new-pool", "--size", "s-2vcpu-2gb", "--count", "1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resCreate.status).toBe(0);

    const jsonDel = JSON.stringify({});
    makeFakeDoctl(tmp, jsonDel);
    const resDel = runCli(["kubernetes", "node-pool", "delete", "k8s-abc", "pool-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resDel.status).toBe(0);
    const decodedDel = decode(resDel.stdout.trim()) as Record<string, unknown>;
    expect(decodedDel.deleted).toBe("pool-1");
  });

  it("unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["kubernetes", "cluster", "list", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });
});

describe("doctl-axi database list CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-test-"));
    capture = join(tmp, "args.log");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("prints TOON count + engine aggregate + 5 fields + help, exit 0", () => {
    const json = JSON.stringify([
      { id: "db-1", name: "prod-pg", engine: "pg", version: "15", region: "nyc1", status: "online" },
      { id: "db-2", name: "prod-pg-2", engine: "pg", version: "14", region: "nyc1", status: "online" },
      { id: "db-3", name: "prod-mysql", engine: "mysql", version: "8", region: "nyc1", status: "online" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["database", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("3 total");
    expect(String(decoded.engine)).toContain("pg=2");
    expect(String(decoded.engine)).toContain("mysql=1");
    const databases = decoded.databases as Array<Record<string, unknown>>;
    expect(databases).toHaveLength(3);
    expect(databases[0].id).toBe("db-1");
    expect(databases[0].name).toBe("prod-pg");
    expect(databases[0].engine).toBe("pg");
    expect(databases[0].version).toBe("15");
    expect(databases[0].region).toBe("nyc1");
    expect(databases[0].status).toBe("online");
    expect(decoded.help).toBeDefined();
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("database get");
    expect(help.join(" ")).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("-t tok");
    expect(args).toContain("databases list");
  });

  it("prints 0 databases definitive empty, exit 0", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["database", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 databases");
  });

  it("--full disables truncation for database", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ id: "db-1", name: long, engine: "pg", version: "15", region: "nyc1", status: "online" }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["database", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    const full = runCli(["database", "list", "--full"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
  });

  it("--fields filters database TOON", () => {
    const json = JSON.stringify([
      { id: "db-1", name: "prod-pg", engine: "pg", version: "15", region: "nyc1", status: "online" },
      { id: "db-2", name: "prod-pg-2", engine: "pg", version: "14", region: "nyc1", status: "online" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "list", "--fields", "id,name"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const databases = decoded.databases as Array<Record<string, unknown>>;
    expect(databases[0]).toEqual({ id: "db-1", name: "prod-pg" });
    expect(databases[0].engine).toBeUndefined();
  });

  it("database get/create/delete work", () => {
    const jsonGet = JSON.stringify({ id: "db-1", name: "prod-pg", engine: "pg", version: "15", region: "nyc1", status: "online" });
    makeFakeDoctl(tmp, jsonGet);
    const resGet = runCli(["database", "get", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resGet.status).toBe(0);
    const decodedGet = decode(resGet.stdout.trim()) as Record<string, unknown>;
    expect((decodedGet.database as Record<string, unknown>).id).toBe("db-1");

    const jsonCreate = JSON.stringify({ id: "db-new", name: "new-db", engine: "pg", version: "15", region: "nyc1", status: "creating" });
    makeFakeDoctl(tmp, jsonCreate);
    const resCreate = runCli(["database", "create", "new-db", "--engine", "pg", "--region", "nyc1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resCreate.status).toBe(0);
    const decodedCreate = decode(resCreate.stdout.trim()) as Record<string, unknown>;
    expect((decodedCreate.database as Record<string, unknown>).id).toBe("db-new");

    const jsonDel = JSON.stringify({});
    makeFakeDoctl(tmp, jsonDel);
    const resDel = runCli(["database", "delete", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resDel.status).toBe(0);
    const decodedDel = decode(resDel.stdout.trim()) as Record<string, unknown>;
    expect(decodedDel.deleted).toBe("db-1");
  });

  it("database user list works", () => {
    const json = JSON.stringify([
      { name: "doadmin", role: "primary", type: "normal" },
      { name: "appuser", role: "custom", type: "normal" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "user", "list", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 total");
    const users = decoded.users as Array<Record<string, unknown>>;
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("doadmin");
  });

  it("database topic list works", () => {
    const json = JSON.stringify([
      { name: "topic-a", state: "active", partitions: 3 },
      { name: "topic-b", state: "active", partitions: 1 },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "topic", "list", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const topics = decoded.topics as Array<Record<string, unknown>>;
    expect(topics).toHaveLength(2);
    expect(topics[0].name).toBe("topic-a");
  });

  it("database pool list works", () => {
    const json = JSON.stringify([{ name: "pool-1", mode: "transaction", size: 10 }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "pool", "list", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const pools = decoded.pools as Array<Record<string, unknown>>;
    expect(pools).toHaveLength(1);
    expect(pools[0].name).toBe("pool-1");
  });

  it("database config get works", () => {
    const json = JSON.stringify({ config: { autovacuum: "on" } });
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "config", "get", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.config).toBeDefined();
  });

  it("database firewall list works", () => {
    const json = JSON.stringify({ rules: [{ type: "ip_addr", value: "1.2.3.4" }] });
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "firewall", "list", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBeDefined();
  });

  it("unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["database", "list", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
  });

  it("AUTH_MISSING maps via doctl errors", () => {
    makeFakeDoctlWithExit(tmp, JSON.stringify({ errors: [{ detail: "access token is required" }] }), 1);
    const res = runCli(["database", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("AUTH_MISSING");
  });

  it("--context takes precedence over env tokens for database", () => {
    const json = JSON.stringify([]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["database", "list", "--context", "myctx"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok", DIGITALOCEAN_API_TOKEN: "labs123" },
    });
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("--context myctx");
    expect(args).not.toContain("-t tok");
  });

  it("database create unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "{}");
    const res = runCli(["database", "create", "mydb", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });

  it("database create forwards legitimate doctl flags verbatim", () => {
    const json = JSON.stringify({ id: "db-new", name: "mydb", engine: "pg", version: "15", region: "nyc1", status: "creating" });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(
      ["database", "create", "mydb", "--region", "nyc1", "--size", "db-s-1vcpu-2gb", "--engine", "pg", "--num-nodes", "3"],
      { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } },
    );
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("databases create mydb");
    expect(args).toContain("--region nyc1");
    expect(args).toContain("--size db-s-1vcpu-2gb");
    expect(args).toContain("--engine pg");
    expect(args).toContain("--num-nodes 3");
  });

  it("database user list unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["database", "user", "list", "db-1", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });

  it("database user list honors --fields", () => {
    const json = JSON.stringify([{ name: "doadmin", role: "primary", type: "normal" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "user", "list", "db-1", "--fields", "name"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const users = decoded.users as Array<Record<string, unknown>>;
    expect(users[0].name).toBe("doadmin");
    expect("role" in users[0]).toBe(false);
  });

  it("kubernetes cluster kubeconfig rejects --fields with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "{}");
    const res = runCli(["kubernetes", "cluster", "kubeconfig", "k8s-abc", "--fields", "id"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });

  it("database user get never leaks password, even with --full", () => {
    const json = JSON.stringify({ name: "doadmin", role: "primary", type: "normal", password: "s3cret-pw-value" });
    makeFakeDoctl(tmp, json);
    for (const extra of [[], ["--full"]]) {
      const res = runCli(["database", "user", "get", "db-1", "doadmin", ...extra], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(res.status).toBe(0);
      expect(res.stdout).not.toContain("password");
      expect(res.stdout).not.toContain("s3cret-pw-value");
      const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
      const user = decoded.user as Record<string, unknown>;
      expect(user.name).toBe("doadmin");
      expect("password" in user).toBe(false);
    }
  });

  it("database user create never leaks password, even with --full", () => {
    const json = JSON.stringify({ name: "appuser", role: "custom", type: "normal", password: "s3cret-create-pw" });
    makeFakeDoctl(tmp, json);
    for (const extra of [[], ["--full"]]) {
      const res = runCli(["database", "user", "create", "db-1", "appuser", ...extra], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(res.status).toBe(0);
      expect(res.stdout).not.toContain("password");
      expect(res.stdout).not.toContain("s3cret-create-pw");
      const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
      const user = decoded.user as Record<string, unknown>;
      expect(user.name).toBe("appuser");
      expect("password" in user).toBe(false);
    }
  });

  it("database get/create never leak connection.uri, even with --full", () => {
    const secretUri = "postgresql://doadmin:s3cret-uri@db-1.b.db.ondigitalocean.com:25060/defaultdb";
    const record = { id: "db-1", name: "prod-pg", engine: "pg", version: "15", region: "nyc1", status: "online", connection: { uri: secretUri } };
    for (const extra of [[], ["--full"]]) {
      makeFakeDoctl(tmp, JSON.stringify(record));
      const resGet = runCli(["database", "get", "db-1", ...extra], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(resGet.status).toBe(0);
      expect(resGet.stdout).not.toContain("uri");
      expect(resGet.stdout).not.toContain("s3cret-uri");

      const resCreate = runCli(["database", "create", "prod-pg", ...extra], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(resCreate.status).toBe(0);
      expect(resCreate.stdout).not.toContain("uri");
      expect(resCreate.stdout).not.toContain("s3cret-uri");
    }
  });

  it("database delete does not echo raw doctl result", () => {
    const json = JSON.stringify({ some: "upstream noise" });
    makeFakeDoctl(tmp, json);
    const res = runCli(["database", "delete", "db-1"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.deleted).toBe("db-1");
    expect(decoded.result).toBeUndefined();
  });
});
