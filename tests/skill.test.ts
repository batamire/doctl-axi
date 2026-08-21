import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { COMMANDS, COMMAND_SUMMARY } from "../src/cli.js";
import { createSkillMarkdown } from "../src/skill.js";

// Aliases share a help entry with their canonical noun and are not listed.
const ALIASES = ["k8s", "doks"];

describe("skill generation (single source of truth)", () => {
  it("COMMAND_SUMMARY lists every registered command", () => {
    const listed = COMMAND_SUMMARY.match(/commands\[\d+\]: (.*)/)![1].split(",").map((s) => s.trim().split(" ")[0]);
    const registered = Object.keys(COMMANDS).filter((c) => !ALIASES.includes(c)).sort();
    expect(listed.sort()).toEqual(registered);
    expect(COMMAND_SUMMARY).toMatch(`commands[${registered.length}]:`);
  });

  it("generated SKILL.md matches the committed file byte-for-byte", () => {
    const committed = readFileSync("skills/doctl-axi/SKILL.md", "utf-8");
    expect(createSkillMarkdown()).toBe(committed);
  });

  it("frontmatter keeps trigger-shaped metadata", () => {
    const skill = createSkillMarkdown();
    expect(skill).toContain("name: doctl-axi");
    expect(skill).toContain("user-invocable: false");
    expect(skill).toContain("category: devops");
  });
});
