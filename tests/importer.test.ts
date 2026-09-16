import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { extractRawRows, parseMonthYearSheet, proposeNormalization, selectHistoricalSheets } from "../lib/importer/workbook";

function workbookFixture() {
  const workbook = XLSX.utils.book_new();
  for (let month = 1; month <= 25; month++) {
    const year = 2024 + Math.floor((month - 1) / 12);
    const monthIndex = (month - 1) % 12;
    const name = new Date(Date.UTC(year, monthIndex, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + ` ${year}`;
    const row = [month === 25 ? "Water & Trash" : "One Main", "123.45", "15"];
    row[22] = "MUST_NOT_IMPORT"; // W
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([row]), name);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Water", "99"]]), "Florida Template");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ignore"]]), "Info");
  return workbook;
}

describe("historical workbook importer", () => {
  it("recognizes only strict month-year worksheet names", () => {
    expect(parseMonthYearSheet("September 2026")?.period).toBe("2026-09-01");
    expect(parseMonthYearSheet("Florida Template")).toBeNull();
    expect(parseMonthYearSheet("Sep 2026")).toBeNull();
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
  it("tags July and September source periods as Florida context", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Georgia bill"]]), "June 2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Florida bill"]]), "July 2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["September bill"]]), "September 2026");
    expect(extractRawRows(workbook, "contexts.xlsx").map((row) => [row.period, row.contextKey])).toEqual([
      ["2026-06-01", "georgia-home"], ["2026-07-01", "florida-home"], ["2026-09-01", "florida-home"],
    ]);
  });
  it("does not silently merge distinct source labels", () => {
    const proposals = proposeNormalization([
      { sourceWorkbook: "x", sourceSheet: "June 2026", sourceRow: 2, sourceRange: "A2:V2", rawValues: ["Water", "100"], period: "2026-06-01", contextKey: "georgia-home" },
      { sourceWorkbook: "x", sourceSheet: "September 2026", sourceRow: 2, sourceRange: "A2:V2", rawValues: ["Water & Trash", "120"], period: "2026-09-01", contextKey: "florida-home" },
    ]);
    expect(proposals).toHaveLength(2);
    expect(proposals.map((proposal) => proposal.proposed.name)).toEqual(["Water", "Water & Trash"]);
    expect(proposals.every((proposal) => proposal.confidence === "REVIEW_REQUIRED")).toBe(true);
  });
});
