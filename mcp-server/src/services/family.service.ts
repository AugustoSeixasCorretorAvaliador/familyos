import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class FamilyService extends BaseService {
  async getFamilyContext() {
    const { data, error } = await this.db()
      .from("families")
      .select("*")
      .eq("id", this.auth.familyId)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError("Family not found", 404);

    const { data: members, error: membersError } = await this.db()
      .from("family_members")
      .select("id, user_id, role, status")
      .eq("family_id", this.auth.familyId);

    if (membersError) throw new AppError(membersError.message, 500);

    return {
      family: data,
      members: members ?? [],
    };
  }
}
