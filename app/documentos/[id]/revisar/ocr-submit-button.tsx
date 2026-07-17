"use client";

import React from "react";
import { useFormStatus } from "react-dom";

export function OcrSubmitButton({ processing }: { processing: boolean }) {
  const { pending } = useFormStatus();
  const disabled = processing || pending;

  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {processing ? "OCR em processamento..." : pending ? "Iniciando OCR..." : "Reprocessar OCR"}
    </button>
  );
}
