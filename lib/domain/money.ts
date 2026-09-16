/** All authoritative monetary values are integer cents. */
export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Expected integer cents, got ${value}`);
  return value;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => assertCents(total + assertCents(value)), 0);
}

export function formatMoney(cents: number): string {
  const absolute = Math.abs(assertCents(cents));
  return `${cents < 0 ? "-" : ""}$${(absolute / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
