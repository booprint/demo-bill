/** Sales tax. Rates are per line category; amounts are in minor units (cents). */
export type LineCategory = 'food' | 'drink'

export const RATES: Record<LineCategory, number> = {
  food: 0.08875,
  drink: 0.10875,
}

export function lineTax(amountMinor: number, category: LineCategory): number {
  return amountMinor * RATES[category]
}

/** Banker's rounding: halves go to the nearest even cent, so rounding errors don't drift one way. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const diff = value - floor
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1
  return Math.round(value)
}
