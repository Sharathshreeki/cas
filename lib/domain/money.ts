// Money is handled in integer paise inside calculations to avoid floating-point
// drift; Decimal(10,2) in the database (NFR-41).

export function toPaise(value: number | string | { toString(): string }): number {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export type PricedLine = { unitPrice: number; quantity: number };

export function lineTotalPaise(line: PricedLine): number {
  return toPaise(line.unitPrice) * line.quantity;
}

export function orderTotalPaise(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalPaise(line), 0);
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(rupees: number): string {
  return inr.format(rupees);
}
