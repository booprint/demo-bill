import { Pool, type PoolClient, type QueryResultRow } from 'pg'
import { config } from './config'

export const pool = new Pool({ connectionString: config.dbUrl, max: 10 })

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query<T>(sql, params)).rows
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
