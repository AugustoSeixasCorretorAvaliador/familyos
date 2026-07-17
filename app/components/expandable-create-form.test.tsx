// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpandableCreateForm } from "./expandable-create-form";

const submitAction = "/" as unknown as (
  formData: FormData
) => void | Promise<void>;

function TestForm({
  id = "test-form",
  label = "NOVO CADASTRO",
  outcome = null,
}: {
  id?: string;
  label?: string;
  outcome?: "success" | "error" | null;
}) {
  return (
    <ExpandableCreateForm
      id={id}
      title="Cadastrar item"
      buttonLabel={label}
      submitAction={submitAction}
      outcome={outcome}
      formClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <input name="title" aria-label="Título" />
      <button type="submit">SALVAR</button>
    </ExpandableCreateForm>
  );
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExpandableCreateForm", () => {
  it("começa recolhido e expande por clique com aria-expanded correto", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const toggle = screen.getByRole("button", { name: "NOVO CADASTRO" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "FECHAR" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Título"));
  });

  it("cancela, limpa e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "NOVO CADASTRO" }));
    const input = screen.getByLabelText("Título") as HTMLInputElement;
    await user.type(input, "Rascunho");
    await user.click(screen.getByRole("button", { name: "CANCELAR" }));

    const toggle = screen.getByRole("button", { name: "NOVO CADASTRO" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);

    await user.click(toggle);
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
  });

  it("mantém aberto e restaura os valores depois de erro", async () => {
    const user = userEvent.setup();
    const firstRender = render(<TestForm id="error-form" />);

    await user.click(screen.getByRole("button", { name: "NOVO CADASTRO" }));
    await user.type(screen.getByLabelText("Título"), "Valor preservado");
    fireEvent.submit(screen.getByRole("button", { name: "SALVAR" }).closest("form")!);
    firstRender.unmount();

    render(<TestForm id="error-form" outcome="error" />);

    expect(screen.getByRole("button", { name: "FECHAR" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Valor preservado"
    );
  });

  it("recolhe e limpa depois de sucesso", async () => {
    const user = userEvent.setup();
    const firstRender = render(<TestForm id="success-form" />);

    await user.click(screen.getByRole("button", { name: "NOVO CADASTRO" }));
    await user.type(screen.getByLabelText("Título"), "Valor concluído");
    fireEvent.submit(screen.getByRole("button", { name: "SALVAR" }).closest("form")!);
    firstRender.unmount();

    render(<TestForm id="success-form" outcome="success" />);
    const toggle = screen.getByRole("button", { name: "NOVO CADASTRO" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await user.click(toggle);
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("");
  });

  it("mantém dois formulários independentes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TestForm id="doctor" label="NOVO MÉDICO" />
        <TestForm id="medication" label="NOVO MEDICAMENTO" />
      </>
    );

    await user.click(screen.getByRole("button", { name: "NOVO MÉDICO" }));

    expect(screen.getByRole("button", { name: "FECHAR" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(
      screen.getByRole("button", { name: "NOVO MEDICAMENTO" }).getAttribute(
        "aria-expanded"
      )
    ).toBe("false");
  });

  it("mantém o conteúdo da lista visível ao alternar o formulário", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Lista sempre visível</p>
        <TestForm />
      </>
    );

    expect(screen.getByText("Lista sempre visível")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "NOVO CADASTRO" }));
    expect(screen.getByText("Lista sempre visível")).not.toBeNull();
  });

  it("expande pelo teclado e aplica classes seguras para telas estreitas", async () => {
    const user = userEvent.setup();
    const { container } = render(<TestForm />);
    const toggle = screen.getByRole("button", { name: "NOVO CADASTRO" });

    toggle.focus();
    await user.keyboard("{Enter}");

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.className).toContain("w-full");
    expect(container.querySelector("section")?.className).toContain("overflow-hidden");
    expect(container.querySelector("form")?.className).toContain("min-w-0");
  });
});
