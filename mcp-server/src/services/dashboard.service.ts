import { BaseService } from "./base.service";

export class DashboardService extends BaseService {
  async getDashboard() {
    const db = this.db();
    const familyId = this.auth.familyId;

    const [
      people,
      properties,
      documents,
      accounts,
      tasks,
      legalCases,
      doctors,
      medications,
      exams,
      events,
    ] = await Promise.all([
      db.from("people").select("id", { count: "exact", head: true }).eq("family_id", familyId).is("deleted_at", null),
      db.from("properties").select("id", { count: "exact", head: true }).eq("family_id", familyId).is("deleted_at", null),
      db.from("documents").select("id", { count: "exact", head: true }).eq("family_id", familyId).is("deleted_at", null),
      db.from("accounts").select("id", { count: "exact", head: true }).eq("family_id", familyId).is("deleted_at", null),
      db.from("family_tasks").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      db.from("legal_cases").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      db.from("doctors").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      db.from("medications").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      db.from("health_exams").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      db.from("events").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    ]);

    return {
      family_id: familyId,
      people: people.count ?? 0,
      properties: properties.count ?? 0,
      documents: documents.count ?? 0,
      finances: accounts.count ?? 0,
      tasks: tasks.count ?? 0,
      legal_cases: legalCases.count ?? 0,
      health: {
        doctors: doctors.count ?? 0,
        medications: medications.count ?? 0,
        exams: exams.count ?? 0,
      },
      timeline: events.count ?? 0,
    };
  }
}
