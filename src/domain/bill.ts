import { lineTax, roundHalfEven, type LineCategory } from './tax'

export interface BillLine {
  id: string
  name: string
  category: LineCategory
  quantity: number
  /** Unit price in minor units (cents). */
  unit_minor: number
  /** food lines carry the menu item, so voids can be re-priced. */
  menu_item_id: string | null
  sku: string | null
  voided: boolean
  ordered_at: string
}

export interface Payment {
  method: 'card' | 'cash'
  card_last4?: string
  processor_ref?: string
  paid_at: string
}

export type BillStatus = 'open' | 'settled' | 'paid'

export interface BillRow {
  id: string
  source: 'drinks' | 'food'
  source_id: string
  table_no: number
  status: BillStatus
  tip_minor: number
  payment: Payment | null
  created_at: string
}

export interface Totals {
  subtotal_minor: number
  tax_minor: number
  tip_minor: number
  total_minor: number
}

/**
 * A Bill is what a table owes for one source (a drinks tab or a food order). It settles when the
 * source does, and can be tipped and paid afterwards.
 */
export class Bill {
  constructor(
    readonly row: BillRow,
    readonly lines: BillLine[],
  ) {}

  get billable(): BillLine[] {
    return this.lines.filter((l) => !l.voided)
  }

  subtotal(): number {
    return this.billable.reduce((sum, l) => sum + l.unit_minor * l.quantity, 0)
  }

  /**
   * Subtotal plus tax plus tip. Tax is summed unrounded across lines and rounded once here, so
   * the bill is never more than half a cent off the exact amount.
   */
  total(): Totals {
    const lines = this.billable
    const subtotal = this.subtotal()
    const tax = lines.reduce((sum, l) => sum + lineTax(l.unit_minor * l.quantity, l.category), 0)
    const taxed = roundHalfEven(subtotal + tax)
    return {
      subtotal_minor: subtotal,
      tax_minor: taxed - subtotal,
      tip_minor: this.row.tip_minor,
      total_minor: taxed + this.row.tip_minor,
    }
  }

  /** A suggested tip on the pre-tax subtotal, rounded to the cent. */
  suggestTip(percent: number): number {
    return Math.round((this.subtotal() * percent) / 100)
  }
}
