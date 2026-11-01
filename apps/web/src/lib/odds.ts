/**
 * Same half-up rule as packages/domain/src/sportsbook/demo-bet.ts.
 * The API ignores this number and prices the bet from the fixture.
 */
export function estimatedPayoutMinor(stakeMinor: bigint, decimalOdds: string): bigint | null {
  const match = /^([1-9]\d{0,2})\.(\d{2})$/.exec(decimalOdds);
  if (!match?.[1] || !match[2] || stakeMinor <= 0n) return null;
  const scaled = BigInt(match[1]) * 100n + BigInt(match[2]);
  if (scaled <= 100n || scaled > 10_000n) return null;
  return (stakeMinor * scaled + 50n) / 100n;
}
