export class StorageProvider {
  async health() {
    return { ok: true, provider: "storage", message: "private bucket access via Supabase" };
  }
}
