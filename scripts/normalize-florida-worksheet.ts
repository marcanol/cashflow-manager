import { readFile, writeFile, chmod } from "node:fs/promises";
import * as XLSX from "xlsx";

type Row = {
  name: string; florida: string; amount: unknown; varies: unknown; due: string; lastSafe: string;
  lateFee: unknown; paymentMode: string; bank: string; description: string; notes: string; rowNumber: number;
};

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error("Usage: node --import tsx scripts/normalize-florida-worksheet.ts worksheet.xlsx /tmp/private-config.json");
const workbook = XLSX.read(await readFile(inputPath), { type: "buffer", cellDates: true });
const sheetName = workbook.SheetNames[0];
if (!sheetName) throw new Error("Worksheet has no sheets.");
const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
const headers = (matrix[3] ?? []).map((value) => String(value ?? "").trim());
const expectedHeaders = ["Name", "Florida?", "Amount", "Amount varies?", "Ballpark Due Date", "Last day to pay before late fee", "Late Fee", "AutoPay or Manual Pay", "Bank that pays", "Transaction Description contains '%%'", "Notes"];
if (expectedHeaders.some((header, index) => headers[index] !== header)) throw new Error("Florida worksheet headers do not match the approved template.");

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const cents = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;
const key = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const rows: Row[] = matrix.slice(4).map((values, index) => ({
  name: text(values[0]), florida: text(values[1]), amount: values[2], varies: values[3], due: text(values[4]),
  lastSafe: text(values[5]), lateFee: values[6], paymentMode: text(values[7]), bank: text(values[8]),
  description: text(values[9]), notes: text(values[10]), rowNumber: index + 5,
})).filter((row) => row.name);

function monthNumber(value: string): number {
  const parsed = new Date(`${value} 1, 2000`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Unknown month name in explicit rename note: ${value}`);
  return parsed.getMonth() + 1;
}

function dayBefore(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function rename(row: Row): { canonicalName: string; effectiveFrom: string | null; historicalName: string | null } {
  const dated = /(?:This is now|Replaced by)\s+(.+?)\s+[Ss]tarting\s+([A-Za-z]+)\s+(\d{4})/i.exec(row.notes);
  if (dated) {
    const effectiveFrom = `${dated[3]}-${String(monthNumber(dated[2])).padStart(2, "0")}-01`;
    return { canonicalName: dated[1].trim(), effectiveFrom, historicalName: row.name };
  }
  const current = /New name is just\s+['"]?(.+?)['"]?\.?$/i.exec(row.notes);
  if (current && current[1].trim().toLowerCase() !== row.name.toLowerCase()) return { canonicalName: current[1].trim(), effectiveFrom: null, historicalName: row.name };
  return { canonicalName: row.name, effectiveFrom: null, historicalName: null };
}

function merchantDescriptions(value: string): string[] {
  if (!value) return [];
  const quoted = [...value.matchAll(/'([^']+)'/g)].map((match) => match[1].trim()).filter(Boolean);
  return quoted.length ? quoted : value.split(/\s+or\s+/i).map((part) => part.replace(/^['"]|['"]$/g, "").trim()).filter(Boolean);
}

function parseDue(value: string) {
  const day = /^(?:Around\s+)?(\d{1,2})(?:st|nd|rd|th)$/i.exec(value);
  if (day) return { dueRule: "DAY_OF_MONTH", dueDay: Number(day[1]), dueIsApproximate: /^Around/i.test(value), dueRuleText: value };
  if (/last day of month/i.test(value)) return { dueRule: "MONTH_END", dueRuleText: value };
  if (/no fixed due date/i.test(value)) return { dueRule: "NO_FIXED_DATE", dueRuleText: value };
  return { dueRule: "UNKNOWN", dueRuleText: value || null };
}

function parseLastSafe(value: string, dueDay?: number) {
  if (!value || /^N\/A$/i.test(value)) return { lastSafeRule: "NONE", lastSafeRuleText: value || null };
  const offset = /^(\d+)\s+days?\s+after\s+due\s+date$/i.exec(value);
  if (offset) return { lastSafeRule: "DAYS_AFTER_DUE", lastSafeOffsetDays: Number(offset[1]), lastSafeRuleText: value };
  if (/last day of month/i.test(value)) return { lastSafeRule: "MONTH_END", lastSafeRuleText: value };
  const day = /^(\d{1,2})(?:st|nd|rd|th)$/i.exec(value);
  if (day && (!dueDay || Number(day[1]) >= dueDay)) return { lastSafeRule: "DAY_OF_MONTH", lastSafeDay: Number(day[1]), lastSafeRuleText: value };
  return { lastSafeRule: "UNKNOWN", lastSafeRuleText: value };
}

function parseLateFee(row: Row) {
  if (/autopay/i.test(row.paymentMode)) return { lateFeeType: "NONE" };
  if (typeof row.lateFee === "number") return row.lateFee > 0 ? { lateFeeType: "FIXED", lateFeeFixedCents: Math.round(row.lateFee * 100) } : { lateFeeType: "NONE" };
  const value = text(row.lateFee);
  if (!value) return { lateFeeType: "NONE" };
  const greater = /greater of\s+\$([\d.]+)\s+or\s+([\d.]+)%/i.exec(value);
  if (greater) return { lateFeeType: "GREATER_OF_FIXED_OR_PERCENT", lateFeeFixedCents: Math.round(Number(greater[1]) * 100), lateFeeRate: Number(greater[2]) / 100 };
  const percent = /([\d.]+)%/.exec(value);
  const minimum = /min(?:imum)?\s+of\s+\$([\d.]+)/i.exec(value);
  const maximum = /max(?:imum)?\s+of\s+\$([\d.]+)/i.exec(value);
  if (percent) return { lateFeeType: "PERCENT", lateFeeRate: Number(percent[1]) / 100, lateFeeMinCents: minimum ? Math.round(Number(minimum[1]) * 100) : undefined, lateFeeMaxCents: maximum ? Math.round(Number(maximum[1]) * 100) : undefined };
  return { lateFeeType: "NONE" };
}

function dateForRule(period: string, due: ReturnType<typeof parseDue>): string | null {
  const [year, month] = period.split("-").map(Number);
  if (due.dueRule === "DAY_OF_MONTH" && due.dueDay) return `${period}-${String(due.dueDay).padStart(2, "0")}`;
  if (due.dueRule === "MONTH_END") return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return null;
}

function lastSafeDateForRule(period: string, dueDate: string | null, rule: ReturnType<typeof parseLastSafe>): string | null {
  const [year, month] = period.split("-").map(Number);
  if (rule.lastSafeRule === "DAY_OF_MONTH" && rule.lastSafeDay) return `${period}-${String(rule.lastSafeDay).padStart(2, "0")}`;
  if (rule.lastSafeRule === "MONTH_END") return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  if (rule.lastSafeRule === "DAYS_AFTER_DUE" && dueDate && rule.lastSafeOffsetDays !== undefined) {
    const date = new Date(`${dueDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + rule.lastSafeOffsetDays); return date.toISOString().slice(0, 10);
  }
  return null;
}

const currentRows = rows.filter((row) => /^Y$/i.test(row.florida) && !/leave this for v2/i.test(row.notes));
const budgetRows = currentRows.filter((row) => /monthly budget not a recurring fee/i.test(row.notes));
const obligationRows = currentRows.filter((row) => !budgetRows.includes(row));
const grouped = new Map<string, Array<{ row: Row; rename: ReturnType<typeof rename> }>>();
for (const row of obligationRows) {
  const renamed = rename(row);
  const groupKey = key(renamed.canonicalName);
  grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), { row, rename: renamed }]);
}

const obligations = [...grouped.entries()].map(([canonicalKey, entries]) => {
  const canonicalName = entries[0].rename.canonicalName;
  const primary = entries.find((entry) => entry.row.name.toLowerCase() === canonicalName.toLowerCase()) ?? entries[entries.length - 1];
  const row = primary.row;
  const incomplete = !row.amount && !row.paymentMode && !row.due;
  const amountBehavior = /^y(?:es)?$/i.test(text(row.varies)) || /varies/i.test(text(row.amount)) ? "VARIABLE" : cents(row.amount) === null ? "UNKNOWN" : "FIXED";
  const paymentMode = /autopay/i.test(row.paymentMode) ? "AUTOPAY" : "MANUAL";
  const due = parseDue(row.due);
  const lastSafe = parseLastSafe(row.lastSafe, due.dueDay);
  const accountKey = row.bank ? key(row.bank) : null;
  const aliases: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    if (entry.rename.historicalName && entry.rename.historicalName.toLowerCase() !== canonicalName.toLowerCase()) aliases.push({ type: "HISTORICAL_NAME", value: entry.rename.historicalName, source: `USER_CONFIRMED_WORKSHEET_ROW_${entry.row.rowNumber}`, effectiveTo: entry.rename.effectiveFrom ? dayBefore(entry.rename.effectiveFrom) : undefined });
    for (const description of merchantDescriptions(entry.row.description)) {
      const alias: Record<string, unknown> = { type: "MERCHANT_CONTAINS", value: description, source: `USER_CONFIRMED_WORKSHEET_ROW_${entry.row.rowNumber}` };
      const under = /internet is always under\s+\$([\d.]+)/i.exec(entry.row.notes);
      const over = /cell is always over\s+\$([\d.]+)/i.exec(entry.row.notes);
      if (/internet/i.test(entry.row.name) && under) alias.amountMaxCents = Math.round(Number(under[1]) * 100) - 1;
      if (/cell/i.test(entry.row.name) && over) alias.amountMinCents = Math.round(Number(over[1]) * 100) + 1;
      aliases.push(alias);
    }
  }
  const dedupedAliases = [...new Map(aliases.map((alias) => [`${alias.type}:${alias.value}`, alias])).values()];
  const oneTime = /one time misc fee/i.test(row.notes);
  const occurrences = incomplete ? [] : (oneTime ? ["2026-09"] : ["2026-09", "2026-10"]).map((period) => {
    const dueDate = dateForRule(period, due);
    const expectedAmountCents = amountBehavior === "FIXED" ? cents(row.amount) : null;
    return { period: `${period}-01`, expectedAmountCents, confirmedAmountCents: oneTime ? expectedAmountCents : null, dueDate, lastSafeDate: lastSafeDateForRule(period, dueDate, lastSafe), dueDateText: row.due || null, status: "CONFIRMED" };
  });
  return {
    key: canonicalKey, name: canonicalName, category: "CURRENT_EXPENSE", obligationType: oneTime ? "ONE_TIME" : incomplete ? "FUTURE_DEBT" : "RECURRING",
    paymentMode, accountKey, amountBehavior, active: !oneTime && !incomplete, configurationStatus: incomplete ? "INCOMPLETE" : "COMPLETE", portableAcrossContexts: false,
    paymentPolicy: incomplete ? undefined : { paymentMode, ...due, ...lastSafe, allowPlannedLate: false, ...parseLateFee(row), optimizerEnabled: paymentMode === "MANUAL" },
    aliases: dedupedAliases, occurrences,
    sourceRows: entries.map((entry) => entry.row.rowNumber), notes: entries.map((entry) => entry.row.notes).filter(Boolean),
  };
});

const poolBudget = budgetRows[0];
const poolAmount = poolBudget ? cents(poolBudget.amount) : null;
const budgets = [
  { key: "home-food", name: "Home Food", cadence: "MONTHLY", configuredAllocationCents: null, accountKey: null, active: true, periods: [] },
  { key: "spending-allowance", name: "Spending Allowance", cadence: "MONTHLY", configuredAllocationCents: null, accountKey: null, active: true, periods: [] },
  { key: poolBudget ? key(poolBudget.name) : "pool", name: poolBudget?.name ?? "Pool", cadence: "MONTHLY", configuredAllocationCents: poolAmount, active: true,
    accountKey: poolBudget?.bank ? key(poolBudget.bank) : null,
    periods: poolAmount === null ? [] : [
      { startsOn: "2026-09-01", endsOn: "2026-09-30", allocationAmountCents: poolAmount },
      { startsOn: "2026-10-01", endsOn: "2026-10-31", allocationAmountCents: poolAmount },
    ] },
];

const config = {
  source: { workbook: inputPath.split(/[\\/]/).pop(), sheet: sheetName, normalizedAt: new Date().toISOString(), private: true },
  accounts: [
    { key: "pnc", institution: "PNC", name: "PNC checking", accountType: "CHECKING", purpose: "Primary household payments", active: true },
    { key: "chase", institution: "Chase", name: "Chase checking", accountType: "CHECKING", purpose: "Household payments", active: true },
  ],
  incomeSources: [
    { personLabel: "Luis", legacyCadence: "BIWEEKLY_FRIDAY", recurrenceType: "INTERVAL_DAYS", intervalDays: 14, anchorDate: "2026-09-25", destinationAccountKey: "pnc", expectedNetAmountCents: null, toleranceCents: 0, active: true },
    { personLabel: "Anamary", legacyCadence: "SEMI_MONTHLY_15_30", recurrenceType: "MONTH_DAYS", daysOfMonth: [15, 30], dateAdjustmentPolicy: null, destinationAccountKey: "chase", expectedNetAmountCents: null, toleranceCents: 0, active: true },
  ],
  settings: { safetyBufferCents: null },
  obligations,
  budgets,
  deferredDebtItems: rows.filter((row) => /leave this for v2/i.test(row.notes)).map((row) => ({ name: row.name, sourceRow: row.rowNumber })),
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
await chmod(outputPath, 0o600);
console.log(JSON.stringify({ sourceRows: rows.length, currentFloridaRows: currentRows.length, canonicalObligations: obligations.length, budgets: budgets.length, deferredDebtItems: config.deferredDebtItems.length, outputPath }));
