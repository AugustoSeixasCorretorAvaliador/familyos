import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type RelationshipLine = {
  id: string;
  from: string;
  relation: string;
  to: string;
  source: "membership" | "property_owner" | "document_owner" | "entity_relationships";
};

type FamilyMemberRow = {
  id: string;
  people: { first_name: string; last_name: string }[] | null;
};

type PropertyWithOwnersRow = {
  id: string;
  title: string;
  property_owners: Array<{
    person_id: string;
    people: { first_name: string; last_name: string }[] | null;
  }> | null;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  people: { first_name: string; last_name: string }[] | null;
};

type EntityRelationshipRow = {
  id: string;
  source_type: string;
  source_id: string;
  relationship_type: string;
  target_type: string;
  target_id: string;
};

function normalizePerson(
  person:
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null
) {
  if (!person) return null;
  return Array.isArray(person) ? person[0] ?? null : person;
}

function fullName(person: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null) {
  const resolved = normalizePerson(person);
  if (!resolved) return "Pessoa nao identificada";
  return `${resolved.first_name} ${resolved.last_name}`.trim();
}

function safeLabel(value: string | null | undefined, fallback: string) {
  if (!value || value.trim().length === 0) return fallback;
  return value;
}

export default async function RelacionamentosPage() {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: membersData }, { data: propertiesData }, { data: docsData }, { data: graphData }] =
    await Promise.all([
      supabase
        .from("family_members")
        .select("id, people(first_name, last_name)")
        .eq("family_id", family.id)
        .eq("status", "active"),
      supabase
        .from("properties")
        .select("id, title, property_owners(person_id, people(first_name, last_name))")
        .eq("family_id", family.id)
        .is("deleted_at", null)
        .limit(50),
      supabase
        .from("documents")
        .select("id, title, document_type, people:owner_person_id(first_name, last_name)")
        .eq("family_id", family.id)
        .eq("status", "active")
        .limit(50),
      supabase
        .from("entity_relationships")
        .select("id, source_type, source_id, relationship_type, target_type, target_id")
        .eq("family_id", family.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const lines: RelationshipLine[] = [];

  for (const member of (membersData ?? []) as FamilyMemberRow[]) {
    lines.push({
      id: `member-${member.id}`,
      from: fullName(member.people),
      relation: "membro de",
      to: family.name,
      source: "membership",
    });
  }

  for (const property of (propertiesData ?? []) as PropertyWithOwnersRow[]) {
    for (const owner of property.property_owners ?? []) {
      lines.push({
        id: `owner-${property.id}-${owner.person_id}`,
        from: fullName(owner.people),
        relation: "proprietario de",
        to: property.title,
        source: "property_owner",
      });
    }
  }

  for (const doc of (docsData ?? []) as DocumentRow[]) {
    lines.push({
      id: `doc-${doc.id}`,
      from: fullName(doc.people),
      relation: "possui",
      to: safeLabel(doc.title, safeLabel(doc.document_type, "Documento")),
      source: "document_owner",
    });
  }

  for (const rel of (graphData ?? []) as EntityRelationshipRow[]) {
    lines.push({
      id: `graph-${rel.id}`,
      from: `${rel.source_type}:${rel.source_id}`,
      relation: rel.relationship_type,
      to: `${rel.target_type}:${rel.target_id}`,
      source: "entity_relationships",
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="relacionamentos" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Relacionamentos</h1>
            <p className="mt-1 text-slate-600">Mapa simples das relacoes reais da familia no banco.</p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {lines.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-600">
              Nenhum relacionamento encontrado ainda. Cadastre pessoas, documentos e imoveis para formar o mapa.
            </p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-slate-900">
                    <span className="font-medium">{line.from}</span> {' -> '}
                    <span className="text-slate-600">{line.relation}</span> {' -> '}
                    <span className="font-medium">{line.to}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
