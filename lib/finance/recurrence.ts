import { deterministicImportUuid } from "@/lib/finance/importer";
import type { Recurrence } from "@/lib/finance/types";

export type MonthlyRecurrenceWindow = {
  startDate: string;
  endDate?: string | null;
  intervalMonths?: number;
  dayOfMonth?: number | null;
};

function recurrenceTypeOrder(recurrence: Recurrence) {
  return recurrence.entry_type === "income" ? 0 : 1;
}

export function sortRecurrencesForEditing(recurrences: Recurrence[]) {
  return [...recurrences].sort((left, right) => {
    const activeDifference = Number(right.active) - Number(left.active);
    if (activeDifference) return activeDifference;

    const typeDifference = recurrenceTypeOrder(left) - recurrenceTypeOrder(right);
    if (typeDifference) return typeDifference;

    return (left.description ?? "").localeCompare(right.description ?? "", "pt-BR", { sensitivity: "base" });
  });
}

export function recurrenceActivationPatch(active: boolean, startDate: string) {
  return active
    ? { active: true, end_date: null, next_occurrence: startDate }
    : { active: false };
}

export function recurrenceOccurrenceId(familyId: string, recurrenceId: string, date: string) {
  return deterministicImportUuid(familyId, "recurrence_occurrences", `${recurrenceId}:${date}`);
}

function dateForMonth(year: number, monthIndex: number, dayOfMonth: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(dayOfMonth, lastDay)));
}

export function addCompetenceMonths(competence: string, months: number) {
  const date = new Date(`${competence.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 7) + "-01";
}

export function dayBeforeCompetence(competence: string) {
  const date = new Date(`${competence.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function monthlyOccurrenceDates(window: MonthlyRecurrenceWindow, throughCompetence: string) {
  const interval = Math.max(1, window.intervalMonths ?? 1);
  const start = new Date(`${window.startDate.slice(0, 10)}T00:00:00Z`);
  const throughMonth = new Date(`${throughCompetence.slice(0, 7)}-01T00:00:00Z`);
  const through = new Date(Date.UTC(throughMonth.getUTCFullYear(), throughMonth.getUTCMonth() + 1, 0, 23, 59, 59));
  const end = window.endDate ? new Date(`${window.endDate.slice(0, 10)}T00:00:00Z`) : null;
  const day = window.dayOfMonth ?? start.getUTCDate();
  const dates: string[] = [];
  const monthDistance = (throughMonth.getUTCFullYear() - start.getUTCFullYear()) * 12
    + throughMonth.getUTCMonth() - start.getUTCMonth();

  for (let offset = 0; offset <= monthDistance; offset += interval) {
    const occurrence = dateForMonth(start.getUTCFullYear(), start.getUTCMonth() + offset, day);
    if (occurrence > through || (end && occurrence > end)) break;
    if (occurrence >= start) dates.push(occurrence.toISOString().slice(0, 10));
  }

  return dates;
}
