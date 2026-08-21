import { describe, it, expect } from "vitest";
import { toExecResult } from "../src/lib/doctl.js";

describe("toExecResult exit-code resolution", () => {
  it("maps ENOENT (missing binary) to 127", () => {
    const r = toExecResult({ code: "ENOENT" }, "", "");
    expect(r).toEqual({ stdout: "", stderr: "ENOENT", exitCode: 127 });
  });

  it("uses numeric error.code as the exit code", () => {
    expect(toExecResult({ code: 7 }, "out", "err").exitCode).toBe(7);
  });

  it("resolves non-numeric error.code like EACCES to generic failure (1)", () => {
    const r = toExecResult({ code: "EACCES" }, "out", "err");
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe("out");
    expect(r.stderr).toBe("err");
  });

  it("resolves non-numeric errno like ETIMEDOUT to generic failure (1)", () => {
    expect(toExecResult({ errno: "ETIMEDOUT" }, "", "").exitCode).toBe(1);
  });

  it("reports success status 0 as exit code 0", () => {
    const r = toExecResult(null, "payload", "");
    expect(r).toEqual({ stdout: "payload", stderr: "", exitCode: 0 });
  });

  it("defaults a missing status on success to exit code 0", () => {
    expect(toExecResult(null, "", "").exitCode).toBe(0);
  });
});
