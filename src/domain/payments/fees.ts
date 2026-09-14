/** Published platform fee: 2.5% of merchandise (tickets + add-ons − discount). Shown on every quote. */
export const DEFAULT_PLATFORM_FEE_BPS = 250;

export function platformFeeCents(merchandiseCents: number, feeBps = DEFAULT_PLATFORM_FEE_BPS): number {
  if (merchandiseCents <= 0 || feeBps <= 0) return 0;
  return Math.floor((merchandiseCents * feeBps) / 10_000);
}
