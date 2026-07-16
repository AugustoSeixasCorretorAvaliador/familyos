export class GmailProvider {
  async health() {
    return { ok: true, provider: "gmail", message: "stub" };
  }
}
