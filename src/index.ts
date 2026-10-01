import express, { type ErrorRequestHandler } from 'express'
import { config } from './config'
import { pool } from './db'
import { closePrices } from './repo/prices'
import { billsRouter } from './routes/bills'
import { startSettlement, stopSettlement } from './workers/settle'

const app = express()
app.use(express.json())

app.get('/healthz', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true, service: 'bill' })
})

app.use(billsRouter)

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal', message: 'Something went wrong in bill' })
}
app.use(onError)

async function main() {
  await startSettlement()
  const server = app.listen(config.port, () => console.log(`bill listening on :${config.port}`))
  const shutdown = async () => {
    server.close()
    await stopSettlement()
    await closePrices()
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((e) => {
  console.error('bill failed to start', e)
  process.exit(1)
})
