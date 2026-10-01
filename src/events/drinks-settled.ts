import avro from 'avsc'

/** Schema for drinks.order.settled, as drinks writes it. */
export interface DrinksOrderSettled {
  event_id: string
  tab_id: string
  table: number
  items: { sku: string; name: string; quantity: number; price_minor: number }[]
  total_minor: number
  settled_at: string
}

export const drinksSettledType = avro.Type.forSchema({
  type: 'record',
  name: 'DrinksOrderSettled',
  namespace: 'boos_restaurant.drinks',
  fields: [
    { name: 'event_id', type: 'string' },
    { name: 'tab_id', type: 'string' },
    { name: 'table', type: 'int' },
    {
      name: 'items',
      type: {
        type: 'array',
        items: {
          type: 'record',
          name: 'SettledItem',
          fields: [
            { name: 'sku', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'quantity', type: 'int' },
            { name: 'price_minor', type: 'int' },
          ],
        },
      },
    },
    { name: 'total_minor', type: 'long' },
    { name: 'settled_at', type: 'string' },
  ],
})

export function decodeDrinksSettled(buf: Buffer): DrinksOrderSettled {
  return drinksSettledType.fromBuffer(buf) as DrinksOrderSettled
}
