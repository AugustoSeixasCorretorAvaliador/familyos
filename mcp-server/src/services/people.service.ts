import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class PeopleService extends BaseService {
  async listPeople() {
    const { data, error } = await this.db()
      .from("people")
      .select("id, first_name, last_name, family_role, email, phone, status")
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .order("first_name", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async getPerson(id: string) {
    const { data, error } = await this.db()
      .from("people")
      .select("*")
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError("Person not found", 404);
    return data;
  }

  async createPerson(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("people")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async updatePerson(id: string, input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("people")
      .update(input)
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async deletePerson(id: string) {
    const { error } = await this.db()
      .from("people")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("family_id", this.auth.familyId);

    if (error) throw new AppError(error.message, 400);
    return { id, deleted: true };
  }
}
