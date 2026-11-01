/** Display helper for Fable demo units. 100 minor = 1.00 FBU. Not a ledger. */
export function formatFbu(minor: bigint | string): string {
  const value = typeof minor === 'bigint' ? minor : BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction} FBU`;
}

/** Parse a major-unit field ("10" or "10.50") into minor units. */
export function majorToMinor(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (whole === undefined) return null;
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}
