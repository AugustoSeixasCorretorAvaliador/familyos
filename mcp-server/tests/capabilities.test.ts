import { describe, expect, it } from "vitest";
import { parseCapabilityHeader } from "../src/tools/authorization";

describe("parseCapabilityHeader", () => {
  it("parses comma separated values", () => {
    const set = parseCapabilityHeader("dashboard.read, people.read");

    expect(set.has("dashboard.read")).toBe(true);
    expect(set.has("people.read")).toBe(true);
  });

  it("returns empty set for missing header", () => {
    const set = parseCapabilityHeader(undefined);
    expect(set.size).toBe(0);
  });
});
