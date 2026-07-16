import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class PropertyService extends BaseService {
  async listProperties() {
    const { data, error } = await this.db()
      .from("properties")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .order("title", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async getProperty(id: string) {
    const { data, error } = await this.db()
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError("Property not found", 404);
    return data;
  }

  async createProperty(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("properties")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async updateProperty(id: string, input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("properties")
      .update(input)
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
