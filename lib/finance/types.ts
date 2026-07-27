import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

export type Account = Tables<"accounts">;
export type Category = Tables<"financial_categories">;
export type CreditCard = Tables<"credit_cards">;
export type FinancialEntryRow = Tables<"financial_entries">;
export type FinancialEntryInsert = TablesInsert<"financial_entries">;
export type FinancialEntryUpdate = TablesUpdate<"financial_entries">;
export type Recurrence = Tables<"recurrences">;
export type InstallmentPurchase = Tables<"installment_purchases">;
export type CardInvoice = Tables<"card_invoices">;
export type Property = Tables<"properties">;
export type PropertyUnit = Tables<"property_units">;
export type LeaseContract = Tables<"lease_contracts">;
export type LeaseOwnerShare = Tables<"lease_owner_shares">;
export type InvestmentAsset = Tables<"investment_assets">;
export type InvestmentPosition = Tables<"investment_positions">;
export type FinancialEntryHistory = Tables<"financial_entry_history">;
export type FinancialAlertRule = Tables<"financial_alert_rules">;
export type Person = Pick<Tables<"people">, "id" | "first_name" | "last_name">;

export type FinanceView =
  | "overview" | "movements" | "accounts" | "cards" | "invoices"
  | "installments" | "recurrences" | "properties" | "investments"
  | "categories" | "alerts";

export type FinanceFilters = {
  competence?: string;
  periodStart?: string;
  periodEnd?: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  personId?: string;
  propertyId?: string;
  status?: string;
  entryType?: string;
  realization?: "expected" | "actual";
  query?: string;
};

export type FinancialEntryCursor = { createdAt: string; id: string };
export type FinancialEntryPage = {
  entries: FinancialEntryRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type FinanceWorkspace = {
  accounts: Account[];
  categories: Category[];
  cards: CreditCard[];
  entries: FinancialEntryRow[];
  recurrences: Recurrence[];
  installments: InstallmentPurchase[];
  invoices: CardInvoice[];
  properties: Property[];
  units: PropertyUnit[];
  leases: LeaseContract[];
  shares: LeaseOwnerShare[];
  assets: InvestmentAsset[];
  positions: InvestmentPosition[];
  alerts: FinancialAlertRule[];
  history: FinancialEntryHistory[];
  people: Person[];
};

export type DashboardMetrics = {
  available: number;
  projected: number;
  expectedIncome: number;
  actualIncome: number;
  expectedExpense: number;
  actualExpense: number;
  monthlyResult: number;
  dueSoon: number;
  overdue: number;
  invoices: number;
  cardLimit: number;
  cardUsed: number;
  futureCommitments: number;
  investments: number;
  rentalIncome: number;
  propertyExpenses: number;
  propertyNet: number;
};
