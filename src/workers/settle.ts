import type { FoodTicketServed, OrderItem } from '@boos-restaurant/food-types'
import { Kafka, type Consumer, type KafkaMessage } from 'kafkajs'
import { config } from '../config'
import { tx } from '../db'
import { decodeDrinksSettled } from '../events/drinks-settled'
import { publishReceipt } from '../publish/receipts'
import { addToBill, claimEvent, type NewLine } from '../store'

/**
 * Settlement: turns what drinks and the kitchen report into bills.
 *
 * Consumes the `orders` topic as consumer group bill-settle:
 *   - drinks.order.settled (Avro, from drinks) when a bar tab closes
 *   - food.ticket.served (JSON, from food) as each kitchen ticket is served
 *
 * Both are at-least-once, so each event_id is claimed in processed_events in the same
 * transaction that writes the bill. The receipt is pushed after the commit.
 */
const kafka = new Kafka({ clientId: 'bill', brokers: config.kafkaBrokers })
let consumer: Consumer | null = null

export async function startSettlement() {
  consumer = kafka.consumer({ groupId: 'bill-settle' })
  await consumer.connect()
  await consumer.subscribe({ topic: 'orders', fromBeginning: false })
  await consumer.run({
    eachMessage: async ({ message }) => {
      const billId = await settle(message)
      if (billId) await publishReceipt(billId)
    },
  })
}

export async function stopSettlement() {
  await consumer?.disconnect()
}

function header(message: KafkaMessage, name: string): string | undefined {
  const v = message.headers?.[name]
  return v === undefined ? undefined : String(v)
}

async function settle(message: KafkaMessage): Promise<string | null> {
  if (!message.value) return null
  const type = header(message, 'event-type')

  if (type === 'drinks.order.settled') {
    const event = decodeDrinksSettled(message.value)
    const lines: NewLine[] = event.items.map((i) => ({
      name: i.name,
      category: 'drink',
      quantity: i.quantity,
      unit_minor: i.price_minor,
      menu_item_id: null,
      sku: i.sku,
      ordered_at: event.settled_at,
    }))
    const sum = lines.reduce((s, l) => s + l.unit_minor * l.quantity, 0)
    if (sum !== event.total_minor) console.warn(`[settle] ${event.tab_id}: items sum to ${sum}, drinks says ${event.total_minor}`)
    return tx(async (c) => ((await claimEvent(c, event.event_id)) ? addToBill(c, 'drinks', event.tab_id, event.table, lines) : null))
  }

  if (type === 'food.ticket.served') {
    const event = JSON.parse(message.value.toString('utf8')) as FoodTicketServed
    const lines: NewLine[] = event.items.map((item: OrderItem) => ({
      name: item.name,
      category: 'food',
      quantity: item.quantity,
      unit_minor: item.price_minor,
      menu_item_id: item.menu_item_id,
      sku: null,
      ordered_at: event.served_at,
    }))
    return tx(async (c) => ((await claimEvent(c, event.event_id)) ? addToBill(c, 'food', event.order_id, event.table, lines) : null))
  }

  console.warn(`[settle] skipping unknown event type ${type ?? '(none)'}`)
  return null
}
