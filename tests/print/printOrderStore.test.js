import { describe, it, expect, beforeEach } from 'vitest'
import { usePrintOrderStore } from '../../src/stores/usePrintOrderStore.js'

beforeEach(() => {
  usePrintOrderStore.getState().reset()
})

describe('usePrintOrderStore', () => {
  it('starts with sensible defaults', () => {
    const s = usePrintOrderStore.getState()
    expect(s.format).toBe('hardcover')
    expect(s.quantity).toBe(1)
    expect(s.reviewChecked).toBe(false)
    expect(s.finishedChecked).toBe(false)
    expect(s.shipping.country).toBe('US')
    expect(s.orderId).toBe(null)
    expect(s.clientSecret).toBe(null)
    expect(s.submitting).toBe(false)
  })

  it('setFormat changes format', () => {
    usePrintOrderStore.getState().setFormat('softcover')
    expect(usePrintOrderStore.getState().format).toBe('softcover')
  })

  it('setQuantity clamps to 1..10', () => {
    const { setQuantity } = usePrintOrderStore.getState()
    setQuantity(0); expect(usePrintOrderStore.getState().quantity).toBe(1)
    setQuantity(15); expect(usePrintOrderStore.getState().quantity).toBe(10)
    setQuantity(5); expect(usePrintOrderStore.getState().quantity).toBe(5)
  })

  it('setShipping merges fields without dropping others', () => {
    usePrintOrderStore.getState().setShipping({ name: 'A' })
    usePrintOrderStore.getState().setShipping({ city: 'B' })
    const s = usePrintOrderStore.getState().shipping
    expect(s.name).toBe('A')
    expect(s.city).toBe('B')
  })

  it('setChecks updates check fields independently', () => {
    usePrintOrderStore.getState().setChecks({ reviewChecked: true })
    expect(usePrintOrderStore.getState().reviewChecked).toBe(true)
    expect(usePrintOrderStore.getState().finishedChecked).toBe(false)
  })

  it('isFormValid returns false when checks unticked', () => {
    const valid = {
      shipping: { name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: '78701', email: 'a@b.com', phone: '5125551212', country: 'US' },
    }
    usePrintOrderStore.getState().setShipping(valid.shipping)
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
    usePrintOrderStore.getState().setChecks({ reviewChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
    usePrintOrderStore.getState().setChecks({ finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(true)
  })

  it('isFormValid returns false on bad state code', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'texas', postal_code: '78701', email: 'a@b.com', phone: '5125551212', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('isFormValid returns false on bad zip', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: 'abcd', email: 'a@b.com', phone: '5125551212', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('isFormValid returns false on phone shorter than 10 digits', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: '78701', email: 'a@b.com', phone: '555', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('setOrderResult populates ephemeral fields', () => {
    usePrintOrderStore.getState().setOrderResult({ orderId: 'o', clientSecret: 'c', totalCents: 4498 })
    const s = usePrintOrderStore.getState()
    expect(s.orderId).toBe('o')
    expect(s.clientSecret).toBe('c')
    expect(s.totalCents).toBe(4498)
  })

  it('reset clears everything', () => {
    usePrintOrderStore.getState().setFormat('softcover')
    usePrintOrderStore.getState().setOrderResult({ orderId: 'o', clientSecret: 'c', totalCents: 4498 })
    usePrintOrderStore.getState().reset()
    const s = usePrintOrderStore.getState()
    expect(s.format).toBe('hardcover')
    expect(s.orderId).toBe(null)
  })
})
