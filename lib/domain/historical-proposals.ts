export type ReviewProposalValues = {
  name?: unknown;
  expectedAmountText?: unknown;
  dueDateText?: unknown;
};

export type ReviewProposalItem = {
  id: string;
  name: string;
  dueDate: string | null;
  amountCents: number | null;
  source: "REVIEW_REQUIRED_PROPOSAL";
};

/** Parse display-formatted money without floating-point arithmetic. */
export function parseMoneyTextToCents(value: unknown): number | null {
  if (typeof value !== "string") return null;
  let input = value.trim();
  if (!input || /^(?:-|--|\?+|n\/a)$/i.test(input)) return null;

  let negative = false;
  if (input.startsWith("(") && input.endsWith(")")) {
    negative = true;
    input = input.slice(1, -1).trim();
  }
  if (input.startsWith("+")) input = input.slice(1).trim();
  else if (input.startsWith("-")) {
    if (negative) return null;
    negative = true;
    input = input.slice(1);
  }
  input = input.replace(/^\$\s*/, "");

  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(input)) return null;
  const [wholeText, fractionText = ""] = input.replaceAll(",", "").split(".");
  const cents = BigInt(wholeText) * 100n + BigInt(fractionText.padEnd(2, "0") || "0");
  const signed = negative ? -cents : cents;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(signed);
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Resolve only unambiguous day/US-calendar text; unclear source text remains unknown. */
export function parseDueDateText(period: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  const periodMatch = period.match(/^(\d{4})-(\d{2})-(?:\d{2})$/);
  if (!periodMatch || !input || /^\?+$/.test(input)) return null;
  const periodYear = Number(periodMatch[1]);
  const periodMonth = Number(periodMatch[2]);

  const dayOnly = input.match(/^([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?$/i);
  if (dayOnly) return validDate(periodYear, periodMonth, Number(dayOnly[1]));

  const calendar = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (!calendar) return null;
  const yearText = calendar[3];
  const year = yearText ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)) : periodYear;
  return validDate(year, Number(calendar[1]), Number(calendar[2]));
}

export function reviewProposalToItem(input: {
  id: string;
  period: string;
  proposedValues: ReviewProposalValues;
}): ReviewProposalItem {
  const name = typeof input.proposedValues.name === "string" && input.proposedValues.name.trim()
    ? input.proposedValues.name.trim()
    : "Unresolved import row";
  const parsedAmount = parseMoneyTextToCents(input.proposedValues.expectedAmountText);
  return {
    id: input.id,
    name,
    dueDate: parseDueDateText(input.period, input.proposedValues.dueDateText),
    amountCents: parsedAmount !== null && parsedAmount >= 0 ? parsedAmount : null,
    source: "REVIEW_REQUIRED_PROPOSAL",
  };
}
