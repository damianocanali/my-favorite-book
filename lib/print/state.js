// DAG of legal status transitions for print_orders.
export const ORDER = [
  'pending', 'paid', 'pdf_ready', 'submitted', 'in_production', 'shipped', 'delivered',
]
const NON_TERMINAL = new Set(['pending','paid','pdf_ready','submitted','in_production'])
const ALL = new Set([...ORDER, 'failed', 'refunded'])

export function canAdvance(from, to) {
  if (!ALL.has(from)) throw new Error(`Unknown from status: ${from}`)
  if (!ALL.has(to)) throw new Error(`Unknown to status: ${to}`)
  if (from === to) return false
  if (to === 'failed') return NON_TERMINAL.has(from)
  if (to === 'refunded') return from === 'failed'
  const fromIdx = ORDER.indexOf(from)
  const toIdx = ORDER.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return false
  return toIdx > fromIdx
}
