// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyDocumentUploadForm } from "@/app/imoveis/property-document-upload-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("react-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-dom")>();
  return {
    ...original,
    useFormStatus: () => ({ pending: false }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/app/imoveis/actions", () => ({
  createPropertyDocument: "/",
  finalizeArchivedPropertyDocuments: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("PropertyDocumentUploadForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("mostra erro visível quando o arquivamento é enviado sem arquivo", async () => {
    const user = userEvent.setup();
    render(
      <PropertyDocumentUploadForm
        familyId="family-1"
        propertyId="property-1"
        documentTypes={["Outro"]}
      />
    );

    await user.click(
      screen.getByRole("checkbox", { name: /somente arquivar/i })
    );
    fireEvent.submit(
      screen.getByRole("button", { name: /enviar e guardar/i }).closest("form")!
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Selecione um arquivo valido."
    );
    expect(push).not.toHaveBeenCalled();
  });
});
