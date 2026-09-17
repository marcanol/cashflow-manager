import { describe, expect, it } from "vitest";
import { parseDueDateText, parseMoneyTextToCents, reviewProposalToItem } from "../lib/domain/historical-proposals";

describe("review-required historical proposal parsing", () => {
  it("parses supported money text with integer arithmetic", () => {
    expect(parseMoneyTextToCents("$1,234.56")).toBe(123_456);
    expect(parseMoneyTextToCents("1234.5")).toBe(123_450);
    expect(parseMoneyTextToCents("0.09")).toBe(9);
    expect(parseMoneyTextToCents("($42.10)")).toBe(-4_210);
    expect(parseMoneyTextToCents("-$42.10")).toBe(-4_210);
  });

  it("leaves ambiguous or malformed money text unknown", () => {
    expect(parseMoneyTextToCents("-")).toBeNull();
    expect(parseMoneyTextToCents("???")).toBeNull();
    expect(parseMoneyTextToCents("1,23.45")).toBeNull();
    expect(parseMoneyTextToCents("1.234")).toBeNull();
    expect(parseMoneyTextToCents(123.45)).toBeNull();
  });

  it("resolves supported due-date text against the source period", () => {
    expect(parseDueDateText("2026-09-01", "15th")).toBe("2026-09-15");
    expect(parseDueDateText("2026-09-01", "9/5")).toBe("2026-09-05");
    expect(parseDueDateText("2026-09-01", "10/1/26")).toBe("2026-10-01");
    expect(parseDueDateText("2026-02-01", "30th")).toBeNull();
    expect(parseDueDateText("2026-09-01", "Auto pay")).toBeNull();
  });

  it("keeps repeated labels as separate review items and rejects negative obligation amounts", () => {
    const first = reviewProposalToItem({ id: "row-a", period: "2026-09-01", proposedValues: { name: "Water", expectedAmountText: "100", dueDateText: "15" } });
    const second = reviewProposalToItem({ id: "row-b", period: "2026-09-01", proposedValues: { name: "Water", expectedAmountText: "(20)", dueDateText: "???" } });
    expect([first.id, second.id]).toEqual(["row-a", "row-b"]);
    expect([first.name, second.name]).toEqual(["Water", "Water"]);
    expect(first).toMatchObject({ amountCents: 10_000, dueDate: "2026-09-15", source: "REVIEW_REQUIRED_PROPOSAL" });
    expect(second).toMatchObject({ amountCents: null, dueDate: null, source: "REVIEW_REQUIRED_PROPOSAL" });
  });
});
