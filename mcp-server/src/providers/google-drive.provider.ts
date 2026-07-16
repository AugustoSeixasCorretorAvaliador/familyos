export class GoogleDriveProvider {
  async health() {
    return { ok: true, provider: "google_drive", message: "stub" };
  }
}
