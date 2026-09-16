import * as XLSX from "xlsx";
import { contextForPeriod } from "../domain/contexts";

export const LAST_INCLUDED_COLUMN_INDEX = 21; // V, deliberately excludes W and beyond.
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export type MonthSheet = { name: string; period: string };
export type RawImportRow = { sourceWorkbook: string; sourceSheet: string; sourceRow: number; sourceRange: string; rawValues: unknown[]; period: string; contextKey: "georgia-home" | "florida-home" };
export type NormalizationProposal = { rawRowKey: string; proposalKind: "OBLIGATION_OCCURRENCE"; rawName: string; period: string; contextKey: string; proposed: { name: string; expectedAmountText?: string; dueDateText?: string }; confidence: "REVIEW_REQUIRED"; reason: string };

export function parseMonthYearSheet(name: string): MonthSheet | null {
  const match = name.trim().match(/^([A-Za-z]+)\s*[- ]?\s*(20\d{2})$/);
  if (!match) return null;
  const monthIndex = MONTH_NAMES.indexOf(match[1].toLowerCase());
  if (monthIndex < 0) return null;
  return { name, period: `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}-01` };
}

export function selectHistoricalSheets(sheetNames: string[], windowMonths = 24): MonthSheet[] {
  return sheetNames.map(parseMonthYearSheet).filter((sheet): sheet is MonthSheet => sheet !== null).sort((a, b) => a.period.localeCompare(b.period)).slice(-windowMonths);
}

export function extractRawRows(workbook: XLSX.WorkBook, sourceWorkbook: string, windowMonths = 24): RawImportRow[] {
  return selectHistoricalSheets(workbook.SheetNames, windowMonths).flatMap((sheet) => {
    const page = workbook.Sheets[sheet.name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(page, { header: 1, raw: false, defval: null, range: 0 });
    return rows.map((row, index) => ({ sourceWorkbook, sourceSheet: sheet.name, sourceRow: index + 1, sourceRange: `A${index + 1}:V${index + 1}`, rawValues: row.slice(0, LAST_INCLUDED_COLUMN_INDEX + 1), period: sheet.period, contextKey: contextForPeriod(sheet.period) }));
  });
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim(); }

/** Conservative extraction: each source row remains independent until a user approves identity. */
export function proposeNormalization(rows: RawImportRow[]): NormalizationProposal[] {
  return rows.flatMap((row) => {
    const rawName = text(row.rawValues[0]);
    if (!rawName || /^(total|notes?|paycheck|income)$/i.test(rawName)) return [];
    const expectedAmountText = text(row.rawValues[1]) || undefined;
    const dueDateText = text(row.rawValues[2]) || undefined;
    return [{ rawRowKey: `${row.sourceSheet}:${row.sourceRow}`, proposalKind: "OBLIGATION_OCCURRENCE" as const, rawName, period: row.period, contextKey: row.contextKey, proposed: { name: rawName, expectedAmountText, dueDateText }, confidence: "REVIEW_REQUIRED" as const, reason: "Imported label is retained as an independent proposed identity; no fuzzy merge was attempted." }];
  });
}

export function importWorkbook(path: string, windowMonths = 24) {
  const workbook = XLSX.readFile(path, { cellDates: false });
  const rawRows = extractRawRows(workbook, path.split(/[\\/]/).pop() ?? path, windowMonths);
  return { selectedSheets: selectHistoricalSheets(workbook.SheetNames, windowMonths), rawRows, proposals: proposeNormalization(rawRows) };
}
