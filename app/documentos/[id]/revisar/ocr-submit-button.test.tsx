// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-dom")>();
  return {
    ...original,
    useFormStatus: () => ({ pending: false }),
  };
});

import { OcrSubmitButton } from "@/app/documentos/[id]/revisar/ocr-submit-button";

describe("OcrSubmitButton", () => {
  it("prevents a second OCR submission while the document is processing", () => {
    render(<OcrSubmitButton processing />);
    const button = screen.getByRole("button", { name: "OCR em processamento..." });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
