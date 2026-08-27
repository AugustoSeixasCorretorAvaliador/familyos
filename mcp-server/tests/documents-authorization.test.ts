import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../src/models/context";

const { createSupabaseAdminClient } = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("../src/providers/supabase.provider", () => ({
  createSupabaseAdminClient,
  createSupabaseUserClient: vi.fn(),
}));

vi.mock("../src/services/document-processing.service", () => ({
  buildStoragePath: vi.fn(),
  createDocumentAlerts: vi.fn(),
  decodeUpload: vi.fn(),
  DOCUMENT_STATUS: { rejected: "rejected" },
  assertAllowedMime: vi.fn(),
  interpretOcrText: vi.fn(),
  logTimeline: vi.fn(),
  runOcr: vi.fn(),
  sha256: vi.fn(),
}));

import { DocumentsService } from "../src/services/documents.service";

function auth(role: AuthContext["role"], familyId = "family-a"): AuthContext {
  return {
    userId: "user-a",
    token: "test-token",
    familyId,
    role,
    googleScopes: [],
  };
}

describe("privileged document authorization", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
  });

  it("blocks a viewer before a service-role client can be reached", async () => {
    const service = new DocumentsService(auth("viewer"));

    await expect(service.rejectDocument({ documentId: "document-a" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("keeps privileged document mutations scoped to the authenticated family", async () => {
    const eq = vi.fn();
    const query = {
      update: vi.fn(() => query),
      insert: vi.fn(() => query),
      eq,
    };
    eq.mockImplementation(() => query);
    createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const service = new DocumentsService(auth("member", "family-a"));
    await service.rejectDocument({ documentId: "document-from-another-family" });

    expect(eq).toHaveBeenCalledWith("family_id", "family-a");
  });
});
