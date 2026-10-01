/** bill configuration, read once at boot. */

function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required (see .env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 8082),
  dbUrl: need('BILL_DB_URL', process.env.BILL_DB_URL),
  foodDbUrl: need('FOOD_DB_URL', process.env.FOOD_DB_URL),
  kafkaBrokers: need('KAFKA_BROKERS', process.env.KAFKA_BROKERS).split(',').map((b) => b.trim()),
  /** customer-experience base URL. */
  receiptEndpoint: need('RECEIPT_ENDPOINT', process.env.RECEIPT_ENDPOINT).replace(/\/$/, ''),
  /** Shared with customer-experience (its INGEST_SIGNING_KEY) to sign receipts. */
  signingKey: need('WORKSPACE_SIGNING_KEY', process.env.WORKSPACE_SIGNING_KEY),
  retryMax: Number(process.env.RETRY_MAX ?? 5),
  venueName: process.env.VENUE_NAME ?? "Boo's Restaurant",
}
