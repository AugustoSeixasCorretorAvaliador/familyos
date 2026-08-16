import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { calculateDashboard } from "@/lib/finance/services";
import type { FinanceWorkspace } from "@/lib/finance/types";

describe("calculateDashboard", () => {
  it("consolida investimentos confirmados em BRL até a competência selecionada", () => {
    const workspace = {
      entries: [],
      accounts: [],
      categories: [],
      cards: [],
      recurrences: [],
      installments: [],
      invoices: [],
      properties: [],
      units: [],
      leases: [],
      shares: [],
      alerts: [],
      history: [],
      people: [],
      assets: [
        { id: "brl", active: true, deleted_at: null, currency: "BRL" },
        { id: "usd", active: true, deleted_at: null, currency: "USD" },
        { id: "pending", active: true, deleted_at: null, currency: "EUR" },
      ],
      positions: [
        { asset_id: "brl", position_date: "2026-08-01", market_value: 100, market_value_brl: null },
        { asset_id: "usd", position_date: "2026-08-01", market_value: 200, market_value_brl: 1000 },
        { asset_id: "pending", position_date: "2026-08-01", market_value: 300, market_value_brl: null },
        { asset_id: "usd", position_date: "2026-09-01", market_value: 500, market_value_brl: 2500 },
      ],
    } as FinanceWorkspace;

    expect(calculateDashboard(workspace, "2026-08-01", "2026-08-16").investments).toBe(1100);
  });
});
