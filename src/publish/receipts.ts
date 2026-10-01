import { createHmac } from 'node:crypto'
import { config } from '../config'
import type { Bill } from '../domain/bill'
import { loadBill } from '../store'
import { PermanentError, withRetry } from './retry'

/**
 * What customer-experience receives for a bill. Idempotent on receipt_id: pushing the same bill
 * again (a new ticket served, a tip, a payment) replaces the guest's copy.
 */
export interface Receipt {
  receipt_id: string
  venue: string
  table: number
  lines: { name: string; quantity: number; amount_minor: number }[]
  subtotal_minor: number
  tax_minor: number
  tip_minor: number
  total_minor: number
  currency: 'USD'
  status: string
  issued_at: string
  payment: { method: string; card_last4?: string; processor_ref?: string } | null
}

export function toReceipt(bill: Bill): Receipt {
  const totals = bill.total()
  return {
    receipt_id: bill.row.id,
    venue: config.venueName,
    table: bill.row.table_no,
    lines: bill.billable.map((l) => ({ name: l.name, quantity: l.quantity, amount_minor: l.unit_minor * l.quantity })),
    ...totals,
    currency: 'USD',
    status: bill.row.status,
    issued_at: new Date().toISOString(),
    payment: bill.row.payment,
  }
}

/** HMAC-SHA256 over "<timestamp>.<body>", hex, with the workspace signing key. */
export function sign(body: string, timestamp: string): string {
  return createHmac('sha256', config.signingKey).update(`${timestamp}.${body}`).digest('hex')
}

/** Pushes a bill's receipt to customer-experience, retrying with backoff. */
export async function publishReceipt(billId: string) {
  const bill = await loadBill(billId)
  if (!bill) return
  const receipt = toReceipt(bill)
  const body = JSON.stringify(receipt)

  await withRetry(
    `receipt ${receipt.receipt_id}`,
    async () => {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const res = await fetch(`${config.receiptEndpoint}/api/receipts`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-boo-timestamp': timestamp,
          'x-boo-signature': sign(body, timestamp),
          'idempotency-key': receipt.receipt_id,
        },
        body,
        signal: AbortSignal.timeout(5000),
      })
      if (res.status >= 400 && res.status < 500) throw new PermanentError(`customer-experience rejected the receipt: ${res.status}`)
      if (!res.ok) throw new Error(`customer-experience answered ${res.status}`)
    },
    () => receipt,
  )
}
