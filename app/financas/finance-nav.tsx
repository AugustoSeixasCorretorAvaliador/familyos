import Link from "next/link";
import type { FinanceView } from "@/lib/finance/types";

const items: Array<{ view: FinanceView | "import"; label: string; href?: string }> = [
  { view: "overview", label: "Visão geral" }, { view: "movements", label: "Movimentações" },
  { view: "accounts", label: "Contas" }, { view: "cards", label: "Cartões" }, { view: "invoices", label: "Faturas" },
  { view: "installments", label: "Parcelamentos" }, { view: "recurrences", label: "Recorrências" },
  { view: "properties", label: "Imóveis (cadastro)" }, { view: "investments", label: "Investimentos" },
  { view: "categories", label: "Categorias" }, { view: "alerts", label: "Alertas" },
  { view: "import", label: "Importar", href: "/financas/importar" },
];

export function FinanceNav({ current, competence }: { current: FinanceView | "import"; competence?: string }) {
  return <nav aria-label="Navegação financeira" className="flex gap-2 overflow-x-auto pb-2">
    {items.map((item) => <Link key={item.view} prefetch={false} href={item.href ?? `/financas?view=${item.view}${competence ? `&competence=${competence.slice(0, 7)}` : ""}`} aria-current={current === item.view ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${current === item.view ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
      {item.label}
    </Link>)}
  </nav>;
}
