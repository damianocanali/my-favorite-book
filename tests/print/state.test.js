import { describe, it, expect } from 'vitest'
import { canAdvance, ORDER } from '../../lib/print/state.js'

describe('order status DAG', () => {
  it('forward transitions are allowed', () => {
    expect(canAdvance('pending', 'paid')).toBe(true)
    expect(canAdvance('paid', 'pdf_ready')).toBe(true)
    expect(canAdvance('pdf_ready', 'submitted')).toBe(true)
    expect(canAdvance('submitted', 'in_production')).toBe(true)
    expect(canAdvance('in_production', 'shipped')).toBe(true)
    expect(canAdvance('shipped', 'delivered')).toBe(true)
  })
  it('cannot move backward', () => {
    expect(canAdvance('shipped', 'in_production')).toBe(false)
    expect(canAdvance('paid', 'pending')).toBe(false)
  })
  it('failed is reachable from any non-terminal state', () => {
    for (const s of ['pending','paid','pdf_ready','submitted','in_production']) {
      expect(canAdvance(s, 'failed')).toBe(true)
    }
  })
  it('refunded only follows failed', () => {
    expect(canAdvance('failed', 'refunded')).toBe(true)
    expect(canAdvance('paid', 'refunded')).toBe(false)
  })
  it('rejects unknown statuses', () => {
    expect(() => canAdvance('paid', 'galaxy')).toThrow()
  })
  it('ORDER lists all statuses in order', () => {
    expect(ORDER).toContain('pending')
    expect(ORDER).toContain('delivered')
  })
})
