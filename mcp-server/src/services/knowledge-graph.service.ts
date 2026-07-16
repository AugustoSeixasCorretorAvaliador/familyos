import { BaseService } from "./base.service";

export class KnowledgeGraphService extends BaseService {
  async buildKnowledgeGraph() {
    const db = this.db();
    const familyId = this.auth.familyId;

    const [people, properties, docs, tasks] = await Promise.all([
      db.from("people").select("id, first_name, last_name").eq("family_id", familyId).is("deleted_at", null),
      db.from("properties").select("id, title").eq("family_id", familyId).is("deleted_at", null),
      db.from("documents").select("id, title").eq("family_id", familyId).is("deleted_at", null),
      db.from("family_tasks").select("id, title, person_id").eq("family_id", familyId),
    ]);

    const nodes = [
      ...(people.data ?? []).map((p) => ({ id: p.id, type: "person", label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() })),
      ...(properties.data ?? []).map((p) => ({ id: p.id, type: "property", label: p.title })),
      ...(docs.data ?? []).map((d) => ({ id: d.id, type: "document", label: d.title })),
      ...(tasks.data ?? []).map((t) => ({ id: t.id, type: "task", label: t.title })),
    ];

    const edges = (tasks.data ?? [])
      .filter((t) => !!t.person_id)
      .map((t) => ({ source: t.person_id as string, target: t.id, relation: "assigned_to" }));

    return { nodes, edges };
  }
}
