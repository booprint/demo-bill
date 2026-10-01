export interface OrderItem {
  id: string
  menu_item_id: string
  name: string
  quantity: number
  /** Unit price in minor units (cents). */
  price_minor: number
  notes?: string
}

export type MenuCategory = 'starter' | 'main' | 'side' | 'dessert' | 'kids'

export interface MenuItem {
  id: string
  name: string
  category: MenuCategory
  price_minor: number
  currency: 'USD'
  available: boolean
}

export interface FoodTicketServed {
  type: 'food.ticket.served'
  event_id: string
  order_id: string
  ticket_id: string
  table: number
  items: OrderItem[]
  served_at: string
}

export declare function orderTotalMinor(items: OrderItem[]): number
