import type { Bill } from '../domain/bill'
import { lineTax, roundHalfEven } from '../domain/tax'

/** The daily audit export finance downloads: one CSV row per bill line, tax rounded per line. */
const HEADER = ['bill_id', 'table', 'line', 'category', 'quantity', 'amount_minor', 'tax_minor', 'voided']

const csv = (v: string | number | boolean) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function auditCsv(bills: Bill[]): string {
  const rows = [HEADER.join(',')]
  for (const bill of bills) {
    for (const l of bill.lines) {
      const amount = l.unit_minor * l.quantity
      const tax = l.voided ? 0 : roundHalfEven(lineTax(amount, l.category))
      rows.push([bill.row.id, bill.row.table_no, l.name, l.category, l.quantity, amount, tax, l.voided].map(csv).join(','))
    }
  }
  return rows.join('\n') + '\n'
}
