// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateAmountForm } from "@/app/financas/duplicate-amount-form";

const mocks = vi.hoisted(() => ({ checkDuplicateFinancialAmount: vi.fn<(rawValue: string, currentAmount: number | null) => Promise<boolean>>() }));

vi.mock("@/app/financas/actions", () => ({
  checkDuplicateFinancialAmount: mocks.checkDuplicateFinancialAmount,
}));

const submitAction = "/" as unknown as (formData: FormData) => void | Promise<void>;

beforeEach(() => {
  mocks.checkDuplicateFinancialAmount.mockReset();
  vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DuplicateAmountForm", () => {
  it("alerta e cancela a inclusão quando o valor já existe e o usuário não confirma", async () => {
    mocks.checkDuplicateFinancialAmount.mockResolvedValue(true);
    const confirm = vi.fn<(message: string) => boolean>(() => false);
    vi.stubGlobal("confirm", confirm);
    render(<DuplicateAmountForm action={submitAction} amountField="expected_amount"><input name="expected_amount" defaultValue="648,65"/><button type="submit">Salvar</button></DuplicateAmountForm>);

    fireEvent.submit(screen.getByRole("button", { name: "Salvar" }).closest("form")!);

    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(mocks.checkDuplicateFinancialAmount).toHaveBeenCalledWith("648,65", null);
    expect(confirm.mock.calls[0][0]).toContain("A comparação considera somente o valor");
  });

  it("não pede confirmação quando o valor ainda não existe", async () => {
    mocks.checkDuplicateFinancialAmount.mockResolvedValue(false);
    const confirm = vi.fn();
    vi.stubGlobal("confirm", confirm);
    render(<DuplicateAmountForm action={submitAction} amountField="expected_amount"><input name="expected_amount" defaultValue="999,99"/><button type="submit">Salvar</button></DuplicateAmountForm>);

    fireEvent.submit(screen.getByRole("button", { name: "Salvar" }).closest("form")!);

    await waitFor(() => expect(mocks.checkDuplicateFinancialAmount).toHaveBeenCalledOnce());
    expect(confirm).not.toHaveBeenCalled();
  });
});
