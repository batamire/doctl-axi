import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";
import { makeFakeDoctl, makeFakeDoctlWithExit, runCli } from "./helpers.js";


describe("remaining nouns CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-remaining-"));
    capture = join(tmp, "args.log");
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("volume list prints TOON count + 4 fields + help, exit 0", () => {
    const json = JSON.stringify([
      { id: "vol-abc123", name: "my-volume", region: { slug: "nyc1" }, size_gigabytes: 100, status: "available" },
      { id: "vol-def456", name: "data-02", region: { slug: "ams3" }, size_gigabytes: 500, status: "in-use" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["volume", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2");
    const volumes = decoded.volumes as Array<Record<string, unknown>>;
    expect(volumes).toHaveLength(2);
    expect(volumes[0].id).toBe("vol-abc123");
    expect(volumes[0].name).toBe("my-volume");
    expect(volumes[0].region).toBe("nyc1");
    expect(volumes[0].size).toBe("100");
    expect(volumes[0].status).toBe("available");
    expect(decoded.help).toBeDefined();
    const help = (decoded.help as string[]).join(" ");
    expect(help).toContain("volume get");
    expect(help).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute volume list");
    expect(args).toContain("-t tok");
  });

  it("volume list prints 0 volumes definitive empty, exit 0", () => {
    makeFakeDoctl(tmp, "[]", capture);
    const res = runCli(["volume", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 volumes");
  });

  it("volume --full disables truncation", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ id: "vol-1", name: long, region: { slug: "nyc1" }, size_gigabytes: 100, status: "available" }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["volume", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    expect(truncated.stdout).toContain("use --full");
    const full = runCli(["volume", "list", "--full"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
    expect(full.stdout).toContain(long.slice(0, 100));
  });

  it("volume --fields filters TOON to only those fields", () => {
    const json = JSON.stringify([
      { id: "vol-abc123", name: "my-volume", region: { slug: "nyc1" }, size_gigabytes: 100, status: "available" },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["volume", "list", "--fields", "id,name"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const volumes = decoded.volumes as Array<Record<string, unknown>>;
    expect(volumes[0]).toEqual({ id: "vol-abc123", name: "my-volume" });
    expect(volumes[0].region).toBeUndefined();
  });

  it("volume unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["volume", "list", "--bogus"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });

  it("volume get unwraps array and prints TOON, exit 0", () => {
    const json = JSON.stringify([{ id: "vol-abc123", name: "my-volume", region: { slug: "nyc1" }, size_gigabytes: 100, status: "available" }]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["volume", "get", "vol-abc123"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const volume = decoded.volume as Record<string, unknown>;
    expect(volume.id).toBe("vol-abc123");
    expect(volume.name).toBe("my-volume");
    expect(volume.region).toBe("nyc1");
    expect(volume.size).toBe("100");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute volume get");
    expect(args).toContain("vol-abc123");
  });

  it("volume get --fields filters TOON", () => {
    const json = JSON.stringify([{ id: "vol-abc123", name: "my-volume", region: { slug: "nyc1" }, size_gigabytes: 100, status: "available" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["volume", "get", "vol-abc123", "--fields", "id,name"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const volume = decoded.volume as Record<string, unknown>;
    expect(volume).toEqual({ id: "vol-abc123", name: "my-volume" });
    expect(volume.region).toBeUndefined();
  });

  it("volume AUTH_MISSING when no token and error payload", () => {
    makeFakeDoctlWithExit(tmp, JSON.stringify({ errors: [{ detail: "access token is required" }] }), 1);
    const res = runCli(["volume", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: undefined } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("AUTH_MISSING");
  });

  it("space key list prints TOON count + 4 fields + help", () => {
    const json = JSON.stringify([
      { name: "my-key", access_key: "AKIAEXAMPLE123", created_at: "2024-01-01T00:00:00Z" },
      { name: "other-key", access_key: "BBBBEXAMPLE456", created_at: "2024-02-02T00:00:00Z" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["space", "key", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2");
    const spaces = decoded.spaces as Array<Record<string, unknown>>;
    expect(spaces).toHaveLength(2);
    expect(spaces[0].name).toBe("my-key");
    expect(spaces[0].accessKey).toBe("AKIAEXAMPLE123");
    expect(spaces[0].created).toBe("2024-01-01T00:00:00Z");
    expect(decoded.help).toBeDefined();
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("spaces keys list");
  });

  it("space key list prints 0 spaces definitive empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["space", "key", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 spaces");
  });

  it("space --fields filters", () => {
    const json = JSON.stringify([{ name: "my-key", access_key: "AKIAEXAMPLE", created_at: "2024-01-01T00:00:00Z" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["space", "key", "list", "--fields", "name"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const spaces = decoded.spaces as Array<Record<string, unknown>>;
    expect(spaces[0]).toEqual({ name: "my-key" });
  });

  it("space unknown flag exits 2", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["space", "key", "list", "--bogus"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
  });

  it("dedicated-inference list prints TOON count + 4 fields + help", () => {
    const json = JSON.stringify([
      { id: "inf-1", name: "llama-70b", region: "nyc1", status: "active" },
      { id: "inf-2", name: "mistral-7b", region: "nyc1", status: "creating" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["dedicated-inference", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2");
    const inf = decoded.inference as Array<Record<string, unknown>>;
    expect(inf).toHaveLength(2);
    expect(inf[0].id).toBe("inf-1");
    expect(inf[0].name).toBe("llama-70b");
    expect(inf[0].region).toBe("nyc1");
    expect(inf[0].status).toBe("active");
    expect(decoded.help).toBeDefined();
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("dedicated-inference list");
  });

  it("dedicated-inference list prints 0 inference definitive empty", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["dedicated-inference", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 inference");
  });

  it("dedicated-inference --full disables truncation", () => {
    const long = "b".repeat(9000);
    const json = JSON.stringify([{ id: "inf-1", name: long, region: "nyc1", status: "active" }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["dedicated-inference", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(truncated.stdout).toContain("truncated");
    const full = runCli(["dedicated-inference", "list", "--full"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(full.stdout).not.toContain("truncated");
  });

  it("dedicated-inference --fields filters", () => {
    const json = JSON.stringify([{ id: "inf-1", name: "llama", region: "nyc1", status: "active" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["dedicated-inference", "list", "--fields", "id,name"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const inf = decoded.inference as Array<Record<string, unknown>>;
    expect(inf[0]).toEqual({ id: "inf-1", name: "llama" });
  });

  it("dedicated-inference unknown flag exits 2", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["dedicated-inference", "list", "--bogus"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
  });

  it("nfs list prints TOON count + 4 fields", () => {
    const json = JSON.stringify([
      { id: "nfs-1", name: "share-01", region: "nyc1", status: "available" },
      { id: "nfs-2", name: "share-02", region: "ams3", status: "creating" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["nfs", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const nfs = decoded.nfs as Array<Record<string, unknown>>;
    expect(nfs).toHaveLength(2);
    expect(nfs[0].id).toBe("nfs-1");
    expect(nfs[0].name).toBe("share-01");
    expect(decoded.help).toBeDefined();
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("nfs list");
  });

  it("insight uptime list prints TOON", () => {
    const json = JSON.stringify([
      { id: "check-1", name: "api-check", status: "up", target: "https://example.com" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["insight", "uptime", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const checks = decoded.checks as Array<Record<string, unknown>>;
    expect(checks[0].id).toBe("check-1");
    expect(checks[0].target).toBe("https://example.com");
    expect(decoded.count).toBeDefined();
    expect(decoded.help).toBeDefined();
  });

  it("marketplace list prints TOON", () => {
    const json = JSON.stringify([{ slug: "wordpress", name: "WordPress", type: "1-click" }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["marketplace", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const items = decoded.marketplace as Array<Record<string, unknown>>;
    expect(items[0].slug).toBe("wordpress");
    expect(decoded.count).toBeDefined();
    expect(decoded.help).toBeDefined();
  });

  it("region list prints TOON", () => {
    const json = JSON.stringify([{ slug: "nyc1", name: "New York 1", available: true }]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["region", "list"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const regions = decoded.regions as Array<Record<string, unknown>>;
    expect(regions[0].slug).toBe("nyc1");
    expect(decoded.help).toBeDefined();
  });

  it("account get prints TOON", () => {
    const json = JSON.stringify({ email: "test@example.com", uuid: "abc-123", status: "active", droplet_limit: 10 });
    makeFakeDoctl(tmp, json);
    const res = runCli(["account", "get"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const account = decoded.account as Record<string, unknown>;
    expect(account.email).toBe("test@example.com");
    expect(account.uuid).toBe("abc-123");
    expect(decoded.help).toBeDefined();
  });

  it("balance get prints TOON", () => {
    const json = JSON.stringify({ month_to_date_balance: "10.00", account_balance: "100.00" });
    makeFakeDoctl(tmp, json);
    const res = runCli(["balance", "get"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const balance = decoded.balance as Record<string, unknown>;
    expect(balance.monthToDateBalance).toBe("10.00");
    expect(decoded.help).toBeDefined();
  });

  it("help disclosure for volume", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["volume", "list", "--help"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("volume");
    expect(res.stdout).toContain("--full");
  });

  it("help for space key list", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["space", "key", "list", "--help"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("space");
  });

  it("help for dedicated-inference", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["dedicated-inference", "list", "--help"], { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("dedicated-inference");
  });
});
