import XLSX from "xlsx";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractRawRows, importWorkbook, parseMonthYearSheet, proposeNormalization, selectHistoricalSheets } from "../lib/importer/workbook";

function workbookFixture() {
  const workbook = XLSX.utils.book_new();
  for (let month = 1; month <= 25; month++) {
    const year = 2024 + Math.floor((month - 1) / 12);
    const monthIndex = (month - 1) % 12;
    const name = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + ` ${year}`;
    const row = [month === 25 ? "Water & Trash" : "One Main", "15th", "123.45"];
    row[22] = "MUST_NOT_IMPORT"; // W
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([row]), name);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Water", "99"]]), "Florida Template");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ignore"]]), "Info");
  return workbook;
}

describe("historical workbook importer", () => {
  it("recognizes full and abbreviated month/year worksheet names", () => {
    expect(parseMonthYearSheet("September 2026")?.period).toBe("2026-09-01");
    expect(parseMonthYearSheet("Sep 2026")?.period).toBe("2026-09-01");
    expect(parseMonthYearSheet("Jan 24")?.period).toBe("2024-01-01");
    expect(parseMonthYearSheet("Jan  2026")?.period).toBe("2026-01-01");
    expect(parseMonthYearSheet("Florida Template")).toBeNull();
  });
  it("uses the latest 24 eligible sheets and excludes reference tabs", () => {
    const selected = selectHistoricalSheets(workbookFixture().SheetNames);
    expect(selected).toHaveLength(24);
    expect(selected[0]?.period).toBe("2024-02-01");
    expect(selected.at(-1)?.period).toBe("2026-01-01");
    expect(selected.some((sheet) => sheet.name === "Info")).toBe(false);
  });
  it("keeps provenance, excludes W onward, and applies the context break", () => {
    const workbook = workbookFixture();
    const rawRows = extractRawRows(workbook, "synthetic.xlsx", 24);
    expect(rawRows[0]).toMatchObject({ sourceWorkbook: "synthetic.xlsx", sourceRange: "A1:V1", sourceRow: 1, contextKey: "georgia-home" });
    expect(rawRows.every((row) => row.rawValues.length <= 22)).toBe(true);
    expect(rawRows.flatMap((row) => row.rawValues).includes("MUST_NOT_IMPORT")).toBe(false);
  });
  it("skips fully empty formatted rows while retaining their original row coordinates", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Bill", "Date", "Bill"], [], ["Water", "15th", "120"]]), "Sep 2026");
    const rawRows = extractRawRows(workbook, "synthetic.xlsx");
    expect(rawRows.map((row) => row.sourceRow)).toEqual([1, 3]);
  });
  it("tags May onward as Florida context", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Georgia bill"]]), "April 2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Florida bill"]]), "May 2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Florida bill"]]), "June 2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["September bill"]]), "September 2026");
    expect(extractRawRows(workbook, "contexts.xlsx").map((row) => [row.period, row.contextKey])).toEqual([
      ["2026-04-01", "georgia-home"], ["2026-05-01", "florida-home"], ["2026-06-01", "florida-home"], ["2026-09-01", "florida-home"],
    ]);
  });
  it("does not silently merge distinct source labels", () => {
    const proposals = proposeNormalization([
      { sourceWorkbook: "x", sourceSheet: "April 2026", sourceRow: 2, sourceRange: "A2:V2", rawValues: ["Water", "15th", "100"], period: "2026-04-01", contextKey: "georgia-home" },
      { sourceWorkbook: "x", sourceSheet: "September 2026", sourceRow: 2, sourceRange: "A2:V2", rawValues: ["Water & Trash", "18th", "120"], period: "2026-09-01", contextKey: "florida-home" },
    ]);
    expect(proposals).toHaveLength(2);
    expect(proposals.map((proposal) => proposal.proposed.name)).toEqual(["Water", "Water & Trash"]);
    expect(proposals.every((proposal) => proposal.confidence === "REVIEW_REQUIRED")).toBe(true);
    expect(proposals.map((proposal) => proposal.proposed.expectedAmountText)).toEqual(["100", "120"]);
    expect(proposals.map((proposal) => proposal.proposed.dueDateText)).toEqual(["15th", "18th"]);
  });
  it("executes the real file-reading path under Node ESM", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cashflow-import-test-"));
    const path = join(directory, "fixture.xlsx");
    try {
      XLSX.writeFile(workbookFixture(), path);
      expect(importWorkbook(path).selectedSheets).toHaveLength(24);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
