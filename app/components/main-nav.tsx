import Link from "next/link";

type MainNavProps = {
  current:
    | "dashboard"
    | "pessoas"
    | "imoveis"
    | "documentos"
    | "financas"
    | "saude"
    | "agenda"
    | "tarefas"
    | "processos"
    | "timeline"
    | "relacionamentos";
};

const items: Array<{ key: MainNavProps["current"]; label: string; href?: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "pessoas", label: "Pessoas", href: "/pessoas" },
  { key: "imoveis", label: "Imoveis", href: "/imoveis" },
  { key: "documentos", label: "Documentos", href: "/documentos" },
  { key: "financas", label: "Financas", href: "/financas" },
  { key: "saude", label: "Saude", href: "/saude" },
  { key: "agenda", label: "Agenda", href: "/agenda" },
  { key: "tarefas", label: "Tarefas", href: "/tarefas" },
  { key: "processos", label: "Processos", href: "/processos" },
  { key: "timeline", label: "Timeline", href: "/timeline" },
  { key: "relacionamentos", label: "Relacionamentos", href: "/relacionamentos" },
];

export function MainNav({ current }: MainNavProps) {
  return (
    <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
      {items.map((item) => {
        const isCurrent = current === item.key;
        if (!item.href) {
          return (
            <span key={item.key} className="text-slate-400">
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            className={isCurrent ? "text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
