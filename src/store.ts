import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool, query } from './db'
import { Bill, type BillLine, type BillRow } from './domain/bill'

export type NewLine = Omit<BillLine, 'id' | 'voided'>

export async function loadBill(id: string): Promise<Bill | null> {
  const [row] = await query<BillRow>('SELECT * FROM bills WHERE id = $1', [id])
  if (!row) return null
  const lines = await query<BillLine>('SELECT * FROM bill_lines WHERE bill_id = $1 ORDER BY ordered_at, id', [id])
  return new Bill(row, lines)
}

/** Records an event as handled; false if it was handled before (at-least-once delivery). */
export async function claimEvent(client: PoolClient, eventId: string): Promise<boolean> {
  const res = await client.query('INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING', [eventId])
  return res.rowCount === 1
}

/** Adds lines to the bill for a source, creating it the first time. Returns the bill id. */
export async function addToBill(
  client: PoolClient,
  source: BillRow['source'],
  sourceId: string,
  table: number,
  lines: NewLine[],
): Promise<string> {
  const id = `bill_${source}_${sourceId}`
  await client.query(
    `INSERT INTO bills (id, source, source_id, table_no, status) VALUES ($1, $2, $3, $4, 'settled')
     ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
    [id, source, sourceId, table],
  )
  for (const l of lines) {
    await client.query(
      `INSERT INTO bill_lines (id, bill_id, name, category, quantity, unit_minor, menu_item_id, sku, ordered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [`ln_${randomUUID().slice(0, 12)}`, id, l.name, l.category, l.quantity, l.unit_minor, l.menu_item_id, l.sku, l.ordered_at],
    )
  }
  return id
}

export async function billsForDay(day: string): Promise<Bill[]> {
  const rows = await query<BillRow>("SELECT * FROM bills WHERE created_at::date = $1::date AND status <> 'open' ORDER BY created_at", [day])
  if (rows.length === 0) return []
  const lines = await query<BillLine & { bill_id: string }>('SELECT * FROM bill_lines WHERE bill_id = ANY($1) ORDER BY ordered_at, id', [rows.map((r) => r.id)])
  return rows.map((r) => new Bill(r, lines.filter((l) => l.bill_id === r.id)))
}

export { pool }
