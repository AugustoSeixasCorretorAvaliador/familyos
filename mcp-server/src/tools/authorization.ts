import { AppError } from "../utils/errors";
import type { Capability } from "./capabilities";

export function assertCapabilities(toolName: string, required: Capability[], grants: Set<Capability>): void {
  const missing = required.filter((capability) => !grants.has(capability));

  if (missing.length > 0) {
    throw new AppError(
      `Missing capability for ${toolName}: ${missing.join(", ")}`,
      403,
      "CAPABILITY_REQUIRED",
      false,
      { required: missing },
    );
  }
}

export function parseCapabilityHeader(headerValue: string | undefined): Set<Capability> {
  if (!headerValue) return new Set();

  const values = headerValue
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean) as Capability[];

  return new Set(values);
}
