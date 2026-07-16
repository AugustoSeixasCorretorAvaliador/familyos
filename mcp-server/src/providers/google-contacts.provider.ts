export class GoogleContactsProvider {
  async health() {
    return { ok: true, provider: "google_contacts", message: "stub" };
  }
}
