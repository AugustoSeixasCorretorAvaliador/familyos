"use client";

import React, { useRef, useState, type FormEvent, type ReactNode } from "react";
import { checkDuplicateFinancialAmount } from "@/app/financas/actions";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

export function DuplicateAmountForm({ action, amountField, currentAmount, className, children }: { action: ServerFormAction; amountField: string; currentAmount?: number | null; className?: string; children: ReactNode }) {
  const confirmedValue = useRef<string | null>(null);
  const checking = useRef(false);
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const rawValue = String(formData.get(amountField) ?? "").trim();

    if (confirmedValue.current === rawValue) {
      confirmedValue.current = null;
      return;
    }

    event.preventDefault();
    if (!rawValue || checking.current) return;

    checking.current = true;
    setIsChecking(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    try {
      const duplicate = await checkDuplicateFinancialAmount(rawValue, currentAmount ?? null);
      const parsedValue = Number(rawValue.includes(",") ? rawValue.replace(/\./g, "").replace(",", ".") : rawValue);
      const formattedValue = Number.isFinite(parsedValue) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsedValue) : rawValue;
      if (duplicate && !window.confirm(`Lançamento com valor já registrado: ${formattedValue}. A comparação considera somente o valor, independentemente de descrição, categoria, tipo, competência ou pessoa. Deseja incluir mesmo assim?`)) return;
      confirmedValue.current = rawValue;
      checking.current = false;
      setIsChecking(false);
      form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
    } catch {
      window.alert("Não foi possível verificar valores já registrados. Tente novamente antes de incluir o lançamento.");
    } finally {
      checking.current = false;
      setIsChecking(false);
    }
  }

  return <form action={action} onSubmit={handleSubmit} aria-busy={isChecking} className={className}>{children}</form>;
}
