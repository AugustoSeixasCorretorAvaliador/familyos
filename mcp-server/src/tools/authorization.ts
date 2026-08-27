import { AppError } from "../utils/errors";
import type { AuthContext } from "../models/context";
import type { Capability } from "./capabilities";

const readCapabilities: Capability[] = [
  "dashboard.read",
  "people.read",
  "documents.read",
  "health.read",
  "property.read",
  "finance.read",
  "agenda.read",
  "calendar.read",
  "timeline.read",
  "alerts.read",
  "tasks.read",
  "legal.read",
  "knowledge.read",
  "family.read",
  "ai.summary",
];

const writeCapabilities: Capability[] = [
  "people.write",
  "documents.write",
  "documents.process",
  "health.write",
  "property.write",
  "finance.write",
  "agenda.write",
  "calendar.write",
  "timeline.write",
  "alerts.write",
  "tasks.write",
  "legal.write",
];

const capabilitiesByRole: Record<AuthContext["role"], readonly Capability[]> = {
  viewer: readCapabilities,
  member: [...readCapabilities, ...writeCapabilities],
  admin: [...readCapabilities, ...writeCapabilities, "audit.read", "admin"],
  owner: [...readCapabilities, ...writeCapabilities, "audit.read", "admin"],
};

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

export function resolveEffectiveCapabilities(
  role: AuthContext["role"],
  requested: Set<Capability>,
): Set<Capability> {
  const authorized = new Set(capabilitiesByRole[role]);
  return new Set([...requested].filter((capability) => authorized.has(capability)));
}
