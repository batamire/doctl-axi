import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";

const BIN = "./dist/bin/doctl-axi.js";

function makeFakeDoctl(dir: string, content: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  writeFileSync(
    script,
    `#!/usr/bin/env bash\n${cap}cat <<'JSON'\n${content}\nJSON\n`,
  );
  chmodSync(script, 0o755);
}

function makeFakeDoctlText(dir: string, text: string, captureFile?: string) {
  const script = join(dir, "doctl");
  const cap = captureFile ? `echo "$@" > "${captureFile}"\n` : "";
  // For logs, output plain text not JSON
  writeFileSync(
    script,
    `#!/usr/bin/env bash\n${cap}cat <<'TEXT'\n${text}\nTEXT\n`,
  );
  chmodSync(script, 0o755);
}

function runCli(
  args: string[],
  opts: { env?: Record<string, string | undefined>; fakeDir?: string } = {},
) {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  if (opts.fakeDir) env.PATH = `${opts.fakeDir}:${env.PATH}`;
  const result = spawnSync("node", [BIN, ...args], {
    env,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

describe("doctl-axi app CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-app-test-"));
    capture = join(tmp, "args.log");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("app list prints TOON count + 5 fields + help, exit 0", () => {
    const json = JSON.stringify([
      { id: "app-111", spec: { name: "my-app" }, region: { slug: "nyc" }, active_deployment: { id: "dep-aaa", phase: "ACTIVE" } },
      { id: "app-222", spec: { name: "other-app" }, region: "ams", active_deployment: { id: "dep-bbb", phase: "BUILDING" } },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const apps = decoded.apps as Array<Record<string, unknown>>;
    expect(apps).toHaveLength(2);
    expect(apps[0].id).toBe("app-111");
    expect(apps[0].name).toBe("my-app");
    expect(apps[0].region).toBe("nyc");
    expect(apps[0].phase).toBe("ACTIVE");
    expect(apps[0].activeDeployment).toBe("dep-aaa");
    expect(apps[1].region).toBe("ams");
    expect(decoded.help).toBeDefined();
    const help = (decoded.help as string[]).join(" ");
    expect(help).toContain("app get");
    expect(help).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps list");
  });

  it("app list 0 apps definitive empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["app", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 apps");
  });

  it("app list --full disables truncation", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ id: "app-1", spec: { name: long }, region: { slug: "nyc" }, active_deployment: { id: "dep-1", phase: "ACTIVE" } }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["app", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    expect(truncated.stdout).toContain("use --full");
    const full = runCli(["app", "list", "--full"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
    expect(full.stdout).toContain(long.slice(0, 100));
  });

  it("app list --fields filters TOON", () => {
    const json = JSON.stringify([
      { id: "app-111", spec: { name: "my-app" }, region: { slug: "nyc" }, active_deployment: { id: "dep-aaa", phase: "ACTIVE" } },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["app", "list", "--fields", "id,name"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const apps = decoded.apps as Array<Record<string, unknown>>;
    expect(apps[0]).toEqual({ id: "app-111", name: "my-app" });
    expect(apps[0].region).toBeUndefined();
  });

  it("app get works", () => {
    const json = JSON.stringify({ id: "app-111", spec: { name: "my-app" }, region: { slug: "nyc" }, active_deployment: { id: "dep-aaa", phase: "ACTIVE" } });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "get", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const app = decoded.app as Record<string, unknown>;
    expect(app.id).toBe("app-111");
    expect(app.name).toBe("my-app");
    expect(app.region).toBe("nyc");
    expect(app.phase).toBe("ACTIVE");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps get");
    expect(args).toContain("app-111");
  });

  it("app create works", () => {
    const json = JSON.stringify({ id: "new-app", spec: { name: "new-app" }, region: { slug: "nyc" }, active_deployment: { id: "dep-new", phase: "ACTIVE" } });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "create"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const app = decoded.app as Record<string, unknown>;
    expect(app.id).toBe("new-app");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps create");
  });

  it("app update works", () => {
    const json = JSON.stringify({ id: "app-111", spec: { name: "my-app" }, region: { slug: "nyc" }, active_deployment: { id: "dep-aaa", phase: "ACTIVE" } });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "update", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect((decoded.app as Record<string, unknown>).id).toBe("app-111");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps update");
  });

  it("app delete works", () => {
    const json = JSON.stringify({});
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "delete", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.deleted).toBe("app-111");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps delete");
  });

  it("app list-deployments works", () => {
    const json = JSON.stringify([
      { id: "dep-aaa", phase: "ACTIVE", cause: "manual", progress: "done" },
      { id: "dep-bbb", phase: "BUILDING", cause: "push", progress: "running" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "list-deployments", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const deps = decoded.deployments as Array<Record<string, unknown>>;
    expect(deps).toHaveLength(2);
    expect(deps[0].id).toBe("dep-aaa");
    expect(deps[0].phase).toBe("ACTIVE");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("list-deployments");
  });

  it("app get-deployment works", () => {
    const json = JSON.stringify({ id: "dep-aaa", phase: "ACTIVE", cause: "manual", progress: "done" });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "get-deployment", "app-111", "dep-aaa"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const dep = decoded.deployment as Record<string, unknown>;
    expect(dep.id).toBe("dep-aaa");
    expect(dep.phase).toBe("ACTIVE");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("get-deployment");
  });

  it("app create-deployment works", () => {
    const json = JSON.stringify({ id: "dep-new", phase: "BUILDING", cause: "manual", progress: "running" });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["app", "create-deployment", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const dep = decoded.deployment as Record<string, unknown>;
    expect(dep.id).toBe("dep-new");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("create-deployment");
  });

  it("app logs works", () => {
    makeFakeDoctlText(tmp, "build log line 1\nbuild log line 2", capture);
    const res = runCli(["app", "logs", "app-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(String(decoded.logs)).toContain("build log line 1");
    expect(decoded.app).toBe("app-111");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("apps logs");
  });

  it("app unknown flag exits 2", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["app", "list", "--bogus"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
  });

  it("app --help returns help", () => {
    const res = runCli(["app", "--help"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("app");
  });
});

describe("doctl-axi registry CLI seam", () => {
  let tmp: string;
  let capture: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-reg-test-"));
    capture = join(tmp, "args.log");
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("registry repository list prints TOON count + 4 fields + help", () => {
    const json = JSON.stringify([
      { name: "repo-one", registry_name: "myreg", tag_count: 3, manifest_count: 5 },
      { name: "repo-two", registry_name: "myreg", tag_count: 1, manifest_count: 2 },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "repository", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const repos = decoded.repositories as Array<Record<string, unknown>>;
    expect(repos).toHaveLength(2);
    expect(repos[0].name).toBe("repo-one");
    expect(repos[0].registry).toBe("myreg");
    expect(repos[0].tagCount).toBe("3");
    expect(repos[0].manifestCount).toBe("5");
    expect((decoded.help as string[]).join(" ")).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("registry");
    expect(args).toContain("list-v2");
  });

  it("registry repository list 0 repositories empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["registry", "repository", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 repositories");
  });

  it("registry repository list --fields filters", () => {
    const json = JSON.stringify([{ name: "repo-one", registry_name: "myreg", tag_count: 3, manifest_count: 5 }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["registry", "repository", "list", "--fields", "name,registry"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const repos = decoded.repositories as Array<Record<string, unknown>>;
    expect(repos[0]).toEqual({ name: "repo-one", registry: "myreg" });
  });

  it("registry repository list --full disables truncation", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ name: long, registry_name: "myreg", tag_count: 1, manifest_count: 1 }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["registry", "repository", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(truncated.stdout).toContain("truncated");
    const full = runCli(["registry", "repository", "list", "--full"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(full.stdout).toContain(long.slice(0, 50));
    expect(full.stdout).not.toContain("truncated");
  });

  it("registry tag list works", () => {
    const json = JSON.stringify([
      { repository: "repo-one", tag: "latest", manifest_digest: "sha256:abc", updated_at: "2026-01-01T00:00:00Z" },
      { repository: "repo-one", tag: "v1", manifest_digest: "sha256:def", updated_at: "2026-01-02T00:00:00Z" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "tag", "list", "repo-one"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const tags = decoded.tags as Array<Record<string, unknown>>;
    expect(tags[0].repository).toBe("repo-one");
    expect(tags[0].tag).toBe("latest");
    expect(tags[0].digest).toBe("sha256:abc");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("list-tags");
  });

  it("registry tag list 0 tags empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["registry", "tag", "list", "repo-one"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 tags");
  });

  it("registry tag get works", () => {
    const json = JSON.stringify([
      { repository: "repo-one", tag: "latest", manifest_digest: "sha256:abc", updated_at: "2026-01-01T00:00:00Z" },
      { repository: "repo-one", tag: "v1", manifest_digest: "sha256:def", updated_at: "2026-01-02T00:00:00Z" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "tag", "get", "repo-one", "latest"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const tag = decoded.tag as Record<string, unknown>;
    expect(tag.tag).toBe("latest");
    expect(tag.digest).toBe("sha256:abc");
  });

  it("registry manifest list works", () => {
    const json = JSON.stringify([
      { repository: "repo-one", digest: "sha256:aaa", tags: ["latest"], size_bytes: 12345 },
      { repository: "repo-one", digest: "sha256:bbb", tags: ["v1"], size_bytes: 67890 },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "manifest", "list", "repo-one"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const manifests = decoded.manifests as Array<Record<string, unknown>>;
    expect(manifests[0].digest).toBe("sha256:aaa");
    expect(manifests[0].tags).toBe("latest");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("list-manifests");
  });

  it("registry manifest list 0 manifests empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["registry", "manifest", "list", "repo-one"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 manifests");
  });

  it("registry garbage-collection list works", () => {
    const json = JSON.stringify([
      { uuid: "gc-111", registry_name: "myreg", status: "succeeded", blobs_deleted: 10 },
      { uuid: "gc-222", registry_name: "myreg", status: "failed", blobs_deleted: 0 },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "garbage-collection", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 of 2 total");
    const gcs = decoded.garbageCollections as Array<Record<string, unknown>>;
    expect(gcs[0].id).toBe("gc-111");
    expect(gcs[0].registry).toBe("myreg");
    expect(gcs[0].status).toBe("succeeded");
    expect(gcs[0].blobsDeleted).toBe("10");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("garbage-collection");
  });

  it("registry garbage-collection list 0 empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["registry", "garbage-collection", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 garbage-collections");
  });

  it("registry garbage-collection get works", () => {
    const json = JSON.stringify([{ uuid: "gc-111", registry_name: "myreg", status: "succeeded", blobs_deleted: 10 }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["registry", "garbage-collection", "get", "gc-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const gc = decoded.garbageCollection as Record<string, unknown>;
    expect(gc.id).toBe("gc-111");
  });

  it("registry garbage-collection create works", () => {
    const json = JSON.stringify({ uuid: "gc-new", registry_name: "myreg", status: "requested", blobs_deleted: 0 });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "garbage-collection", "create", "myreg"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const gc = decoded.garbageCollection as Record<string, unknown>;
    expect(gc.id).toBe("gc-new");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("start");
  });

  it("registry garbage-collection delete works", () => {
    const json = JSON.stringify({});
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["registry", "garbage-collection", "delete", "gc-111"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.cancelled).toBe("gc-111");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("cancel");
  });

  it("registry unknown flag exits 2", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["registry", "repository", "list", "--bogus"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
  });

  it("registry --help returns help", () => {
    const res = runCli(["registry", "--help"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("registry");
  });
});
