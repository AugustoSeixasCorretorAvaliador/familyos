import { describe, expect, it } from "vitest";
import { AppError } from "../src/utils/errors";
import {
  assertCapabilities,
  parseCapabilityHeader,
  resolveEffectiveCapabilities,
} from "../src/tools/authorization";

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

describe("server-derived capabilities", () => {
  it("rejects a client capability claim that the family role does not have", () => {
    const requested = parseCapabilityHeader("documents.write,documents.process");
    const effective = resolveEffectiveCapabilities("viewer", requested);

    expect(effective.has("documents.write")).toBe(false);
    expect(effective.has("documents.process")).toBe(false);
    expect(() => assertCapabilities("upload_document", ["documents.write"], effective)).toThrowError(
      expect.objectContaining<Partial<AppError>>({ code: "CAPABILITY_REQUIRED", statusCode: 403 }),
    );
  });

  it("preserves a valid requested capability for a legitimate family editor", () => {
    const requested = parseCapabilityHeader("documents.write");
    const effective = resolveEffectiveCapabilities("member", requested);

    expect(() => assertCapabilities("upload_document", ["documents.write"], effective)).not.toThrow();
  });

  it("does not let a requested scope grant family-admin capabilities", () => {
    const requested = parseCapabilityHeader("audit.read,admin");
    const effective = resolveEffectiveCapabilities("member", requested);

    expect(effective.size).toBe(0);
  });
});
