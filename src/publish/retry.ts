import { Kafka, type Producer } from 'kafkajs'
import { config } from '../config'

/**
 * Retries with exponential backoff (250ms, 500ms, 1s, 2s...) plus jitter, up to RETRY_MAX
 * attempts. When every attempt fails the payload is dead-lettered to bill.receipts.dlq.
 */
const kafka = new Kafka({ clientId: 'bill-dlq', brokers: config.kafkaBrokers })
let dlq: Producer | null = null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class PermanentError extends Error {}

export async function withRetry<T>(what: string, fn: (attempt: number) => Promise<T>, deadLetter: () => unknown): Promise<T | null> {
  let lastError: unknown
  for (let attempt = 1; attempt <= config.retryMax; attempt++) {
    try {
      return await fn(attempt)
    } catch (e) {
      lastError = e
      if (e instanceof PermanentError) break
      if (attempt < config.retryMax) await sleep(250 * 2 ** (attempt - 1) + Math.random() * 100)
    }
  }
  console.error(`[retry] ${what} failed after ${config.retryMax} attempts`, lastError)
  await sendToDeadLetter(what, deadLetter(), lastError)
  return null
}

async function sendToDeadLetter(what: string, payload: unknown, error: unknown) {
  try {
    if (!dlq) {
      dlq = kafka.producer()
      await dlq.connect()
    }
    await dlq.send({
      topic: 'bill.receipts.dlq',
      messages: [{ key: what, value: JSON.stringify({ payload, error: String(error), failed_at: new Date().toISOString() }) }],
    })
  } catch (e) {
    console.error('[retry] could not dead-letter either; the receipt is lost', e)
  }
}
