import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pool } from './db'

/** Applies migrations/*.sql in name order. Each file runs once; applied names are kept in schema_migrations. */
async function main() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const dir = join(__dirname, '..', 'migrations')
  const done = new Set((await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(readFileSync(join(dir, name), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
      await client.query('COMMIT')
      console.log(`applied ${name}`)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
