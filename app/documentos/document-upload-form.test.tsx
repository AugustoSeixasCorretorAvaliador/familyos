// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadForm } from "@/app/documentos/document-upload-form";

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

vi.mock("@/app/documentos/actions", () => ({
  createDocument: "/",
  finalizeArchivedPersonDocument: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const people = [
  {
    id: "person-1",
    first_name: "Bella",
    last_name: "Spitz",
    family_role: "Pet",
  },
];

describe("DocumentUploadForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("torna titulo, tipo, titular e arquivo obrigatorios no arquivamento sem OCR", async () => {
    const user = userEvent.setup();
    render(
      <DocumentUploadForm
        familyId="family-1"
        people={people}
        documentTypes={["Documento Generico"]}
        outcome={null}
      />
    );

    await user.click(screen.getByRole("button", { name: "NOVO DOCUMENTO" }));
    await user.click(
      screen.getByRole("checkbox", { name: /somente arquivar/i })
    );

    expect(
      screen
        .getByPlaceholderText(/título \(obrigatório/i)
        .hasAttribute("required")
    ).toBe(true);
    expect(
      screen.getByLabelText("Tipo do documento").hasAttribute("required")
    ).toBe(true);
    expect(
      screen.getByLabelText("Titular pessoa ou pet").hasAttribute("required")
    ).toBe(true);
    expect(
      document
        .querySelector<HTMLInputElement>('input[name="file"]')
        ?.hasAttribute("required")
    ).toBe(true);
    expect(screen.getByText(/vinculado à pessoa ou ao pet/i)).toBeTruthy();
  });

  it("mostra erro visivel e libera o envio quando o arquivo nao foi selecionado", async () => {
    const user = userEvent.setup();
    render(
      <DocumentUploadForm
        familyId="family-1"
        people={people}
        documentTypes={["Documento Generico"]}
        outcome={null}
      />
    );

    await user.click(screen.getByRole("button", { name: "NOVO DOCUMENTO" }));
    await user.click(
      screen.getByRole("checkbox", { name: /somente arquivar/i })
    );
    await user.type(
      screen.getByPlaceholderText(/título \(obrigatório/i),
      "Certificado Bella"
    );
    await user.selectOptions(
      screen.getByLabelText("Tipo do documento"),
      "Documento Generico"
    );
    await user.selectOptions(
      screen.getByLabelText("Titular pessoa ou pet"),
      "person-1"
    );

    const submit = screen.getByRole("button", {
      name: /enviar e guardar/i,
    });
    fireEvent.submit(submit.closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Selecione um arquivo valido."
    );
    expect(submit.hasAttribute("disabled")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
