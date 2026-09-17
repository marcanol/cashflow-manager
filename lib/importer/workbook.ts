import XLSX from "xlsx";
import { contextForPeriod } from "../domain/contexts";

export const LAST_INCLUDED_COLUMN_INDEX = 21; // V, deliberately excludes W and beyond.
const MONTH_PREFIXES: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export type MonthSheet = { name: string; period: string };
export type RawImportRow = { sourceWorkbook: string; sourceSheet: string; sourceRow: number; sourceRange: string; rawValues: unknown[]; period: string; contextKey: "georgia-home" | "florida-home" };
export type NormalizationProposal = { rawRowKey: string; proposalKind: "OBLIGATION_OCCURRENCE"; rawName: string; period: string; contextKey: string; proposed: { name: string; expectedAmountText?: string; dueDateText?: string; paycheckAllocations?: { label: string; valueText: string }[]; statusMarker?: string }; confidence: "REVIEW_REQUIRED"; reason: string };

export function parseMonthYearSheet(name: string): MonthSheet | null {
  const match = name.trim().match(/^([A-Za-z]+)\s*[- ]?\s*(20\d{2}|\d{2})$/);
  if (!match) return null;
  const month = MONTH_PREFIXES[match[1].toLowerCase().slice(0, 3)];
  if (!month) return null;
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return { name, period: `${year}-${String(month).padStart(2, "0")}-01` };
}

export function selectHistoricalSheets(sheetNames: string[], windowMonths = 24): MonthSheet[] {
  return sheetNames.map(parseMonthYearSheet).filter((sheet): sheet is MonthSheet => sheet !== null).sort((a, b) => a.period.localeCompare(b.period)).slice(-windowMonths);
}

export function extractRawRows(workbook: XLSX.WorkBook, sourceWorkbook: string, windowMonths = 24): RawImportRow[] {
  return selectHistoricalSheets(workbook.SheetNames, windowMonths).flatMap((sheet) => {
    const page = workbook.Sheets[sheet.name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(page, { header: 1, raw: false, defval: null, range: 0 });
    return rows.flatMap((row, index) => {
      const rawValues = row.slice(0, LAST_INCLUDED_COLUMN_INDEX + 1);
      if (!rawValues.some((value) => text(value))) return [];
      return [{ sourceWorkbook, sourceSheet: sheet.name, sourceRow: index + 1, sourceRange: `A${index + 1}:V${index + 1}`, rawValues, period: sheet.period, contextKey: contextForPeriod(sheet.period) }];
    });
  });
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim(); }
function looksLikeDueDate(value: string): boolean { return /^(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?$/i.test(value) || value === "???"; }
function looksLikeMoney(value: string): boolean { return /\d/.test(value.replace(/[$,()\s]/g, "")) || /^-+$/.test(value.replace(/\s/g, "")); }

/** Conservative extraction: each source row remains independent until a user approves identity. */
export function proposeNormalization(rows: RawImportRow[]): NormalizationProposal[] {
  const headers = new Map(rows.filter((row) => row.sourceRow === 1).map((row) => [row.sourceSheet, row.rawValues]));
  return rows.flatMap((row) => {
    const rawName = text(row.rawValues[0]);
    if (!rawName || /^(bill|totals?|notes?|paycheck|income|balance)$/i.test(rawName)) return [];
    const dueDateText = text(row.rawValues[1]);
    const expectedAmountText = text(row.rawValues[2]);
    const header = headers.get(row.sourceSheet) ?? [];
    const paycheckAllocations: { label: string; valueText: string }[] = [];
    for (let index = 3; index <= 7; index += 1) {
      const label = text(header[index]);
      if (!label || /^(income|updated bank acct\??)$/i.test(label)) break;
      const valueText = text(row.rawValues[index]);
      if (valueText && looksLikeMoney(valueText)) paycheckAllocations.push({ label, valueText });
    }
    const statusCandidate = text(row.rawValues[7]);
    const statusMarker = /^(x|y|n|yes|no|paid)$/i.test(statusCandidate) ? statusCandidate : undefined;
    if (!looksLikeDueDate(dueDateText) && !looksLikeMoney(expectedAmountText) && paycheckAllocations.length === 0) return [];
    return [{ rawRowKey: `${row.sourceSheet}:${row.sourceRow}`, proposalKind: "OBLIGATION_OCCURRENCE" as const, rawName, period: row.period, contextKey: row.contextKey, proposed: { name: rawName, expectedAmountText: expectedAmountText || undefined, dueDateText: dueDateText || undefined, paycheckAllocations: paycheckAllocations.length ? paycheckAllocations : undefined, statusMarker }, confidence: "REVIEW_REQUIRED" as const, reason: "Imported label is retained as an independent proposed identity; no fuzzy merge was attempted." }];
  });
}

export function importWorkbook(path: string, windowMonths = 24) {
  const workbook = XLSX.readFile(path, { cellDates: false });
  const rawRows = extractRawRows(workbook, path.split(/[\\/]/).pop() ?? path, windowMonths);
  return { selectedSheets: selectHistoricalSheets(workbook.SheetNames, windowMonths), rawRows, proposals: proposeNormalization(rawRows) };
}
