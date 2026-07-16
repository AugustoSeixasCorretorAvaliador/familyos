"use client";

import { useState } from "react";

type SaldoCellProps = {
  amount: number | null;
};

function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function SaldoCell({ amount }: SaldoCellProps) {
  const [hidden, setHidden] = useState(true);

  if (amount === null) {
    return <span className="text-slate-500">-</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-slate-900">{hidden ? "R$ ******" : toCurrency(amount)}</span>
      <button
        type="button"
        className="text-xs text-slate-600 underline"
        onClick={() => setHidden((prev) => !prev)}
      >
        {hidden ? "Mostrar" : "Ocultar"}
      </button>
    </div>
  );
}
