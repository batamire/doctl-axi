import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decode } from "@toon-format/toon";
import { createRequire } from "node:module";
import { BIN, makeFakeDoctl, makeFakeDoctlWithExit, runCli } from "./helpers.js";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../package.json") as { version: string };


describe("doctl-axi droplet list CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-test-"));
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
    expect(res.stdout.trim()).toBe(PKG_VERSION);
    // ensure no help text
    expect(res.stdout).not.toContain("usage");
  });
});

describe("doctl-axi droplet get/create/delete CLI seam", () => {
  let tmp: string;
  let capture: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "doctl-axi-test-"));
    capture = join(tmp, "args.log");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("get returns mapped detail fields and forwards compute droplet get argv", () => {
    const json = JSON.stringify({
      id: 12345678,
      name: "web-01",
      region: { slug: "nyc1" },
      status: "active",
      size_slug: "s-1vcpu-1gb",
      memory: 1024,
      vcpus: 1,
      disk: 25,
    });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["droplet", "get", "12345678"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const droplet = decoded.droplet as Record<string, unknown>;
    expect(droplet.id).toBe("12345678");
    expect(droplet.name).toBe("web-01");
    expect(droplet.region).toBe("nyc1");
    expect(droplet.size).toBe("s-1vcpu-1gb");
    expect(droplet.status).toBe("active");
    expect(droplet.memory).toBe("1024");
    expect(droplet.vcpus).toBe("1");
    expect(droplet.disk).toBe("25");
    expect(decoded.help).toBeDefined();
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet get 12345678");
  });

  it("get --fields filters to requested fields", () => {
    const json = JSON.stringify({
      id: 12345678,
      name: "web-01",
      region: { slug: "nyc1" },
      status: "active",
      size_slug: "s-1vcpu-1gb",
      memory: 1024,
      vcpus: 1,
      disk: 25,
    });
    makeFakeDoctl(tmp, json);
    const res = runCli(["droplet", "get", "12345678", "--fields", "id,name"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.droplet).toEqual({ id: "12345678", name: "web-01" });
  });

  it("create forwards name and flags verbatim, maps created record", () => {
    const json = JSON.stringify({
      id: 12345678,
      name: "web-01",
      region: { slug: "nyc1" },
      status: "new",
      size_slug: "s-1vcpu-1gb",
    });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(
      [
        "droplet", "create", "web-01",
        "--region", "nyc1",
        "--size", "s-1vcpu-1gb",
        "--image", "ubuntu-24-04-x64",
        "--ssh-keys", "1,2",
        "--tag-names", "prod",
        "--enable-monitoring",
        "--wait",
      ],
      { fakeDir: tmp, env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" } },
    );
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const droplet = decoded.droplet as Record<string, unknown>;
    expect(droplet.id).toBe("12345678");
    expect(droplet.name).toBe("web-01");
    expect(droplet.status).toBe("new");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet create web-01");
    expect(args).toContain("--region nyc1");
    expect(args).toContain("--size s-1vcpu-1gb");
    expect(args).toContain("--image ubuntu-24-04-x64");
    expect(args).toContain("--ssh-keys 1,2");
    expect(args).toContain("--tag-names prod");
    expect(args).toContain("--enable-monitoring");
    expect(args).toContain("--wait");
  });

  it("create rejects unknown flag with VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "{}");
    const res = runCli(["droplet", "create", "web-01", "--bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("--bogus");
  });

  it("create without name exits 2 with usage", () => {
    makeFakeDoctl(tmp, "{}");
    const res = runCli(["droplet", "create"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(String(decoded.error)).toContain("name");
  });

  it("delete forwards --force and reports deleted on success", () => {
    makeFakeDoctl(tmp, "{}", capture);
    const res = runCli(["droplet", "delete", "42"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.deleted).toBe("42");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet delete 42 --force");
  });

  it("delete against upstream 404 exits 0 with already_deleted", () => {
    makeFakeDoctlWithExit(
      tmp,
      JSON.stringify({ errors: [{ detail: "droplet 42 not found" }] }),
      1,
    );
    const res = runCli(["droplet", "delete", "42"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.delete).toBe("already_deleted");
    expect(decoded.droplet).toBe("42");
  });

  it.each(["reboot", "power-cycle"])("forwards %s to compute droplet-action", (action) => {
    const json = JSON.stringify({ id: 999, type: action, status: "in-progress" });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["droplet", action, "42"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.action).toBe(action);
    expect(decoded.droplet).toBe("42");
    expect(decoded.status).toBe("in-progress");
    expect(decoded.action_id).toBe("999");
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain(`compute droplet-action ${action} 42`);
  });

  it("snapshot forwards --snapshot-name", () => {
    const json = JSON.stringify({ id: 999, type: "snapshot", status: "in-progress" });
    makeFakeDoctl(tmp, json, capture);
    const res = runCli(["droplet", "snapshot", "42", "--snapshot-name", "web-backup"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(0);
    const args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet-action snapshot 42 --snapshot-name web-backup");
  });

  it("snapshot without --snapshot-name exits 2 VALIDATION_ERROR before exec", () => {
    makeFakeDoctl(tmp, "{}", capture);
    const res = runCli(["droplet", "snapshot", "42"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    expect(existsSync(capture)).toBe(false);
  });

  it("resize without --size and rebuild without --image exit 2 VALIDATION_ERROR", () => {
    makeFakeDoctl(tmp, "{}");
    for (const [action, flag] of [["resize", "--size"], ["rebuild", "--image"]]) {
      const res = runCli(["droplet", action, "42"], {
        fakeDir: tmp,
        env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
      });
      expect(res.status).toBe(2);
      const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
      expect(decoded.code).toBe("VALIDATION_ERROR");
      expect(String(decoded.error)).toContain(flag);
    }
  });

  it("resize forwards --size and rebuild forwards --image", () => {
    const json = JSON.stringify({ id: 999, status: "in-progress" });
    makeFakeDoctl(tmp, json, capture);
    const resize = runCli(["droplet", "resize", "42", "--size", "s-2vcpu-4gb", "--resize-disk"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(resize.status).toBe(0);
    let args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet-action resize 42 --size s-2vcpu-4gb --resize-disk");

    const rebuild = runCli(["droplet", "rebuild", "42", "--image", "ubuntu-24-04-x64"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(rebuild.status).toBe(0);
    args = readFileSync(capture, "utf-8");
    expect(args).toContain("compute droplet-action rebuild 42 --image ubuntu-24-04-x64");
  });

  it("unknown action exits 2 listing available actions", () => {
    makeFakeDoctl(tmp, "{}");
    const res = runCli(["droplet", "frobnicate", "42"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    expect(decoded.code).toBe("VALIDATION_ERROR");
    const help = (decoded.help as string[] | undefined)?.join(" ") ?? "";
    expect(help).toContain("reboot");
    expect(help).toContain("power-cycle");
  });

  it("unknown subcommand exits 2 listing exactly the implemented verbs", () => {
    const res = runCli(["droplet", "bogus"], {
      fakeDir: tmp,
      env: { DIGITALOCEAN_ACCESS_TOKEN: "tok" },
    });
    expect(res.status).toBe(2);
    const decoded = decode(res.stdout.trim()) as Record<string, unknown>;
    const help = (decoded.help as string[] | undefined)?.join(" ") ?? "";
    for (const verb of ["list", "get", "create", "delete"]) {
      expect(help).toContain(verb);
    }
  });
});
