import Image from "next/image";
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
    <nav aria-label="Navegação principal" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <Link href="/dashboard" className="inline-flex w-fit items-center gap-2.5" aria-label="HERO.FamilyOS — Dashboard">
        <Image
          src="/brand/hero-familyos-symbol.png"
          alt=""
          width={193}
          height={234}
          className="h-10 w-10 rounded-lg object-contain"
        />
        <span className="text-base font-bold tracking-tight text-[#061638]">
          HERO.<span className="bg-gradient-to-r from-[#0877e8] to-[#7c31dc] bg-clip-text text-transparent">FamilyOS</span>
        </span>
      </Link>

      <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
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
              aria-current={isCurrent ? "page" : undefined}
              className={
                isCurrent
                  ? "font-semibold text-[#075fc7]"
                  : "text-slate-600 transition-colors hover:text-[#075fc7]"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
