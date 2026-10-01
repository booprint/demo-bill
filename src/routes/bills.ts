import { Router } from 'express'
import { query, tx } from '../db'
import { auditCsv } from '../export/audit'
import { publishReceipt, toReceipt } from '../publish/receipts'
import { priceAt } from '../repo/prices'
import { billsForDay, loadBill } from '../store'

export const billsRouter = Router()

billsRouter.get('/bills', async (req, res) => {
  const table = Number(req.query.table)
  const rows = Number.isInteger(table)
    ? await query('SELECT id, source, table_no, status, created_at FROM bills WHERE table_no = $1 ORDER BY created_at DESC LIMIT 50', [table])
    : await query('SELECT id, source, table_no, status, created_at FROM bills ORDER BY created_at DESC LIMIT 50')
  res.json({ bills: rows })
})

billsRouter.get('/bills/:id', async (req, res) => {
  const bill = await loadBill(req.params.id)
  if (!bill) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  res.json({ ...bill.row, lines: bill.lines, ...bill.total(), suggested_tips: [15, 18, 20].map((p) => ({ percent: p, tip_minor: bill.suggestTip(p) })) })
})

billsRouter.post('/bills/:id/tip', async (req, res) => {
  const tip = Number(req.body?.tip_minor)
  if (!Number.isInteger(tip) || tip < 0) {
    res.status(422).json({ error: 'invalid', message: 'tip_minor must be a whole number of cents' })
    return
  }
  const updated = await query("UPDATE bills SET tip_minor = $2, updated_at = now() WHERE id = $1 AND status <> 'paid' RETURNING id", [req.params.id, tip])
  if (updated.length === 0) {
    res.status(409).json({ error: 'not_tippable', message: 'No unpaid bill with that id' })
    return
  }
  await publishReceipt(req.params.id)
  res.json(toReceipt((await loadBill(req.params.id))!))
})

/** Voids one line. Food lines are credited at the menu price when they were ordered. */
billsRouter.post('/bills/:id/lines/:lineId/void', async (req, res) => {
  const bill = await loadBill(req.params.id)
  const line = bill?.lines.find((l) => l.id === req.params.lineId)
  if (!bill || !line || line.voided) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  let credit = line.unit_minor
  if (line.menu_item_id) {
    const then = await priceAt(line.menu_item_id, new Date(line.ordered_at))
    if (then !== null) credit = then
  }
  await tx(async (c) => {
    await c.query('UPDATE bill_lines SET voided = true WHERE id = $1', [line.id])
    await c.query('INSERT INTO bill_adjustments (bill_id, line_id, credit_minor, reason) VALUES ($1, $2, $3, $4)', [
      bill.row.id,
      line.id,
      credit * line.quantity,
      String(req.body?.reason ?? 'void'),
    ])
  })
  await publishReceipt(bill.row.id)
  res.json({ voided: line.id, credit_minor: credit * line.quantity })
})

billsRouter.post('/bills/:id/pay', async (req, res) => {
  const { method, card_last4, processor_ref } = req.body ?? {}
  if (method !== 'card' && method !== 'cash') {
    res.status(422).json({ error: 'invalid', message: 'method is card or cash' })
    return
  }
  const payment = { method, card_last4, processor_ref, paid_at: new Date().toISOString() }
  const updated = await query("UPDATE bills SET status = 'paid', payment = $2, updated_at = now() WHERE id = $1 AND status = 'settled' RETURNING id", [
    req.params.id,
    JSON.stringify(payment),
  ])
  if (updated.length === 0) {
    res.status(409).json({ error: 'not_payable', message: 'Only a settled, unpaid bill can be paid' })
    return
  }
  await publishReceipt(req.params.id)
  res.json({ id: req.params.id, status: 'paid' })
})

/** Finance's daily audit export, as CSV (?date=2026-09-30). */
billsRouter.get('/exports/audit', async (req, res) => {
  const day = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    res.status(422).json({ error: 'invalid', message: 'date is YYYY-MM-DD' })
    return
  }
  res.type('text/csv').attachment(`audit-${day}.csv`).send(auditCsv(await billsForDay(day)))
})
