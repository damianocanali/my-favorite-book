import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'

const reset = () => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null })

describe('useCheckInStore', () => {
  beforeEach(reset)

  it('opens at the feeling step', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'feeling', source: 'button' })
  })

  it('advances to the need step, holding the feeling', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('angry')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'need', feeling: 'angry' })
  })

  it('records nothing when dismissed at the feeling step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().dismiss()
    expect(useCheckInStore.getState().entries).toEqual([])
    expect(useCheckInStore.getState().current).toBeNull()
  })

  it('records the feeling alone when dismissed at the need step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().dismiss()
    const { entries } = useCheckInStore.getState()
    expect(entries).toHaveLength(1)
    expect(entries[0].feeling).toBe('sad')
    expect(entries[0].need).toBeUndefined()
  })

  it('records feeling and need when completed', () => {
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('tired')
    useCheckInStore.getState().pickNeed('break')
    const { entries, current } = useCheckInStore.getState()
    expect(entries[0]).toMatchObject({ feeling: 'tired', need: 'break' })
    expect(current).toBeNull()
  })

  it('stamps lastPromptedAt only for an automatic prompt', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().lastPromptedAt).toBeNull()
    reset()
    useCheckInStore.getState().open('breakpoint')
    expect(useCheckInStore.getState().lastPromptedAt).toBeTypeOf('number')
  })

  it('clear() empties entries, for sign-out', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('happy')
    useCheckInStore.getState().pickNeed('keep_going')
    useCheckInStore.getState().clear()
    expect(useCheckInStore.getState().entries).toEqual([])
  })
})
