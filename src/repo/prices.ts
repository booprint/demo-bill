import { Pool } from 'pg'
import { config } from '../config'

/** Voids are credited at the menu price in effect when the item was ordered. */
const foodDb = new Pool({ connectionString: config.foodDbUrl, max: 2 })

export async function priceAt(menuItemId: string, at: Date): Promise<number | null> {
  const { rows } = await foodDb.query<{ price_minor: number }>(
    `SELECT price_minor
       FROM menu_prices
      WHERE menu_item_id = $1 AND effective_from <= $2
      ORDER BY effective_from DESC
      LIMIT 1`,
    [menuItemId, at],
  )
  return rows[0]?.price_minor ?? null
}

export async function closePrices() {
  await foodDb.end()
}
