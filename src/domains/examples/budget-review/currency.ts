export function currencyFractionDigits(currency: string): number {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / (10 ** currencyFractionDigits(currency));
}

export function formatMinorAmount(amountMinor: number, currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  const amount = minorToMajor(amountMinor, currency);
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount)} ${currency}`;
}
