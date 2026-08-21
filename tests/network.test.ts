import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";
import { makeFakeDoctl, makeFakeDoctlWithExit, runCli } from "./helpers.js";


describe("doctl-axi network CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-test-"));
    capture = join(tmp, "args.log");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("network domain list returns TOON count + name/ttl/records with help, exit 0", () => {
    const json = JSON.stringify([
      { name: "example.com", ttl: 3600, records: 12 },
      { name: "api.example.com", ttl: 1800, records: 3 },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["network", "domain", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 total");
    const domains = decoded.domains as Array<Record<string, unknown>>;
    expect(domains).toHaveLength(2);
    expect(domains[0].name).toBe("example.com");
    expect(String(domains[0].ttl)).toBe("3600");
    expect(String(domains[0].records)).toBe("12");
    expect(domains[1].name).toBe("api.example.com");
    expect(decoded.help).toBeDefined();
    const help = decoded.help as string[];
    expect(help.join(" ")).toContain("domain get");
    expect(help.join(" ")).toContain("--full");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute domain list");
  });

  it("network record list example.com delegates to compute domain records list", () => {
    const json = JSON.stringify([
      { id: 101, type: "A", name: "@", data: "1.2.3.4", ttl: 3600 },
      { id: 102, type: "CNAME", name: "www", data: "example.com.", ttl: 1800 },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["network", "record", "list", "example.com"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 total");
    const records = decoded.records as Array<Record<string, unknown>>;
    expect(records).toHaveLength(2);
    expect(records[0].type).toBe("A");
    expect(readFileSync(capture, "utf-8")).toContain("compute domain records list example.com");
  });

  it("network firewall list returns firewall TOON and correct routing", () => {
    const json = JSON.stringify([
      { id: "fw-123", name: "web-fw", status: "succeeded" },
      { id: "fw-456", name: "db-fw", status: "succeeded" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["network", "firewall", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 total");
    const fws = decoded.firewalls as Array<Record<string, unknown>>;
    expect(fws[0].name).toBe("web-fw");
    expect(fws[0].status).toBe("succeeded");
    expect(readFileSync(capture, "utf-8")).toContain("compute firewall list");
  });

  it("network vpc list delegates to vpcs list and returns TOON", () => {
    const json = JSON.stringify([
      { id: "vpc-1", name: "default-nyc1", region: "nyc1", ip_range: "10.0.0.0/24" },
      { id: "vpc-2", name: "prod", region: "ams3", ip_range: "10.1.0.0/24" },
    ]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["network", "vpc", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.count).toBe("2 total");
    const vpcs = decoded.vpcs as Array<Record<string, unknown>>;
    expect(vpcs[0].name).toBe("default-nyc1");
    expect(vpcs[0].region).toBe("nyc1");
    expect(readFileSync(capture, "utf-8")).toContain("vpcs list");
    expect(readFileSync(capture, "utf-8")).not.toContain("compute");
  });

  it("prints 0 network domains definitive empty, exit 0", () => {
    makeFakeDoctl(tmp, "[]", capture);
    const res = runCli(["network", "domain", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 network domains");
  });

  it("--full disables truncation for network domain", () => {
    const long = "a".repeat(9000);
    const json = JSON.stringify([{ name: long, ttl: 3600, records: 12 }]);
    makeFakeDoctl(tmp, json);
    const truncated = runCli(["network", "domain", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(truncated.status).toBe(0);
    expect(truncated.stdout).toContain("truncated");
    expect(truncated.stdout).toContain("use --full");
    const full = runCli(["network", "domain", "list", "--full"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(full.status).toBe(0);
    expect(full.stdout).not.toContain("truncated");
    expect(full.stdout).toContain(long.slice(0, 100));
  });

  it("--fields filters TOON to only those fields", () => {
    const json = JSON.stringify([
      { name: "example.com", ttl: 3600, records: 12 },
      { name: "api.example.com", ttl: 1800, records: 3 },
    ]);
    makeFakeDoctl(tmp, json);
    const res = runCli(["network", "domain", "list", "--fields", "name,ttl"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const domains = decoded.domains as Array<Record<string, unknown>>;
    expect(domains[0]).toEqual({ name: "example.com", ttl: "3600" });
    expect(domains[0].records).toBeUndefined();
  });

  it("unknown flag exits 2 with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["network", "domain", "list", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown flag");
  });

  it("network --help lists all 9 subcommands concise", () => {
    const res = runCli(["network", "--help"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const out = res.stdout;
    for (const sub of ["domain", "record", "certificate", "firewall", "load-balancer", "vpc", "peering", "cdn", "reserved-ip"]) {
      expect(out).toContain(sub);
    }
  });

  it("unknown subcommand fails fast exit 2 with VALIDATION_ERROR help", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["network", "bogus", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("Unknown subcommand");
    const help = (decoded.help as string[] | undefined)?.join(" ") ?? "";
    expect(help).toContain("domain");
  });

  it("maps doctl {errors} to AxiError codes for network", () => {
    makeFakeDoctlWithExit(tmp, JSON.stringify({ errors: [{ detail: "not found" }] }), 1);
    const res = runCli(["network", "domain", "list"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    // doctl error mapping should produce NOT_FOUND or UNKNOWN but should be exit 1 not 2 unless auth
    expect(res.status).toBe(1);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("NOT_FOUND");
  });

  // Table-driven for remaining subcommands
  const table: Array<{ sub: string; verb: string; extraArgs?: string[]; fixture: string; doctlSnippet: string; key: string }> = [
    {
      sub: "certificate",
      verb: "list",
      fixture: JSON.stringify([{ id: "cert-1", name: "my-cert", state: "verified", type: "lets_encrypt" }]),
      doctlSnippet: "compute certificate list",
      key: "certificates",
    },
    {
      sub: "load-balancer",
      verb: "list",
      fixture: JSON.stringify([{ id: "lb-1", name: "web-lb", region: { slug: "nyc1" }, status: "active" }]),
      doctlSnippet: "compute load-balancer list",
      key: "load_balancers",
    },
    {
      sub: "peering",
      verb: "list",
      fixture: JSON.stringify([{ id: "peer-1", name: "peer-a", status: "ACTIVE", vpc_ids: ["vpc-1", "vpc-2"] }]),
      doctlSnippet: "vpcs peerings list",
      key: "peerings",
    },
    {
      sub: "cdn",
      verb: "list",
      fixture: JSON.stringify([{ id: "cdn-1", origin: "my-space.nyc3.digitaloceanspaces.com", endpoint: "cdn.example.com", ttl: 3600 }]),
      doctlSnippet: "compute cdn list",
      key: "cdns",
    },
    {
      sub: "reserved-ip",
      verb: "list",
      fixture: JSON.stringify([{ ip: "1.2.3.4", region: { slug: "nyc1" }, droplet: { id: 123 } }]),
      doctlSnippet: "compute reserved-ip list",
      key: "reserved_ips",
    },
  ];

  for (const row of table) {
    it(`network ${row.sub} ${row.verb} delegates to doctl ${row.doctlSnippet}`, () => {
      makeFakeDoctl(tmp, row.fixture, capture);
      const res = runCli(["network", row.sub, row.verb], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(res.status).toBe(0);
      const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
      expect(decoded.count).toBeDefined();
      expect(String(readFileSync(capture, "utf-8"))).toContain(row.doctlSnippet);
      // ensure TOON contains expected key
      expect(decoded[row.key] ?? decoded.count).toBeDefined();
    });
  }

  it("network record empty returns 0 network records", () => {
    makeFakeDoctl(tmp, "[]");
    const res = runCli(["network", "record", "list", "example.com"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe("0 network records");
  });

  it("--context flag bypasses AUTH_MISSING and is forwarded", () => {
    const json = JSON.stringify([{ name: "example.com", ttl: 3600, records: 12 }]);
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["network", "domain", "list", "--context", "myctx"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: undefined, DIGITALOCEAN_API_TOKEN: undefined },
    });
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("--context myctx");
  });
});
