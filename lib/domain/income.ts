import { assertCents } from "./money";

export type DateAdjustmentPolicy = "LAST_DAY_OF_MONTH" | "PREVIOUS_WEEKDAY" | "NEXT_WEEKDAY" | null;

export type IncomeSchedule = {
  recurrenceType: "INTERVAL_DAYS" | "MONTH_DAYS";
  intervalDays?: number | null;
  anchorDate?: string | null;
  daysOfMonth?: number[] | null;
  dateAdjustmentPolicy?: DateAdjustmentPolicy;
  expectedNetAmountCents?: number | null;
};

export type GeneratedPaycheck = { expectedDate: string; expectedAmountCents: number | null };
export type PaycheckGeneration = { occurrences: GeneratedPaycheck[]; unresolvedDates: string[] };

const DAY_MS = 86_400_000;

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function adjustWeekday(date: Date, direction: -1 | 1): Date {
  const adjusted = new Date(date);
  while (adjusted.getUTCDay() === 0 || adjusted.getUTCDay() === 6) {
    adjusted.setUTCDate(adjusted.getUTCDate() + direction);
  }
  return adjusted;
}

function amount(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : assertCents(value);
}

export function generateExpectedPaychecks(schedule: IncomeSchedule, from: string, through: string): PaycheckGeneration {
  const start = parseIsoDate(from);
  const end = parseIsoDate(through);
  if (start > end) throw new Error("Paycheck generation start must not be after end.");
  const occurrences: GeneratedPaycheck[] = [];
  const unresolvedDates: string[] = [];

  if (schedule.recurrenceType === "INTERVAL_DAYS") {
    if (!schedule.anchorDate || !Number.isInteger(schedule.intervalDays) || (schedule.intervalDays ?? 0) <= 0) {
      throw new Error("Interval schedules require an anchor date and a positive whole-day interval.");
    }
    const anchor = parseIsoDate(schedule.anchorDate);
    const intervalDays = schedule.intervalDays as number;
    const elapsedDays = Math.floor((start.getTime() - anchor.getTime()) / DAY_MS);
    const firstStep = Math.max(0, Math.ceil(elapsedDays / intervalDays));
    for (let step = firstStep; ; step += 1) {
      const date = new Date(anchor.getTime() + step * intervalDays * DAY_MS);
      if (date > end) break;
      if (date >= start) occurrences.push({ expectedDate: iso(date), expectedAmountCents: amount(schedule.expectedNetAmountCents) });
    }
  } else {
    const requestedDays = [...new Set(schedule.daysOfMonth ?? [])].sort((a, b) => a - b);
    if (!requestedDays.length || requestedDays.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
      throw new Error("Monthly schedules require valid days of month.");
    }
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= lastMonth) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const lastDay = daysInMonth(year, month);
      for (const requestedDay of requestedDays) {
        let candidate: Date;
        if (requestedDay > lastDay) {
          if (schedule.dateAdjustmentPolicy === "LAST_DAY_OF_MONTH") candidate = new Date(Date.UTC(year, month, lastDay));
          else {
            unresolvedDates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(requestedDay).padStart(2, "0")}`);
            continue;
          }
        } else candidate = new Date(Date.UTC(year, month, requestedDay));
        if (schedule.dateAdjustmentPolicy === "PREVIOUS_WEEKDAY") candidate = adjustWeekday(candidate, -1);
        if (schedule.dateAdjustmentPolicy === "NEXT_WEEKDAY") candidate = adjustWeekday(candidate, 1);
        if (candidate >= start && candidate <= end) occurrences.push({ expectedDate: iso(candidate), expectedAmountCents: amount(schedule.expectedNetAmountCents) });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const unique = new Map(occurrences.map((occurrence) => [occurrence.expectedDate, occurrence]));
  return { occurrences: [...unique.values()].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)), unresolvedDates };
}
