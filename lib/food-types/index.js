'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.orderTotalMinor = function orderTotalMinor(items) {
  return items.reduce(function (sum, i) {
    return sum + i.price_minor * i.quantity
  }, 0)
}
