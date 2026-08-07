import { describe, it, expect, beforeEach } from 'vitest'
import { useMilestoneStore, milestoneForProgress } from '../src/stores/useMilestoneStore'

const pages = (written, total) =>
  Array.from({ length: total }, (_, i) => ({ text: i < written ? 'words here' : '' }))

describe('milestoneForProgress', () => {
  it('stays silent on an untouched book', () => {
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(0, 6) })).toBeNull()
  })

  it('celebrates the first written page', () => {
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(1, 6) })?.id).toBe('first-page:b1')
  })

  it('celebrates the halfway point', () => {
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(3, 6) })?.id).toBe('halfway:b1')
  })

  it('has no halfway point in a book too short to have a middle', () => {
    // 2 of 3 is not a milestone — a 3-page book goes first page, then done.
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(2, 3) })).toBeNull()
  })

  it('celebrates every page being written', () => {
    const beat = milestoneForProgress({ bookId: 'b1', pages: pages(6, 6) })
    expect(beat?.id).toBe('all-pages:b1')
    expect(beat?.mood).toBe('proud')
  })

  it('says nothing for the ordinary edits in between', () => {
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(2, 6) })).toBeNull()
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(4, 6) })).toBeNull()
    expect(milestoneForProgress({ bookId: 'b1', pages: pages(5, 6) })).toBeNull()
  })

  it('treats whitespace-only pages as unwritten', () => {
    expect(milestoneForProgress({ bookId: 'b1', pages: [{ text: '   \n ' }, { text: '' }] })).toBeNull()
  })

  it('handles a missing book or empty page list', () => {
    expect(milestoneForProgress({ bookId: null, pages: pages(1, 3) })).toBeNull()
    expect(milestoneForProgress({ bookId: 'b1', pages: [] })).toBeNull()
    expect(milestoneForProgress({ bookId: 'b1', pages: undefined })).toBeNull()
  })
})

describe('useMilestoneStore', () => {
  beforeEach(() => {
    useMilestoneStore.setState({ current: null, seen: new Set() })
  })

  it('fires a beat once and refuses the repeat', () => {
    const { fire } = useMilestoneStore.getState()
    fire({ id: 'halfway:b1', title: 'Halfway there!' })
    expect(useMilestoneStore.getState().current?.title).toBe('Halfway there!')

    useMilestoneStore.getState().clear()
    fire({ id: 'halfway:b1', title: 'Halfway there!' })
    // Re-editing a page must not congratulate the child a second time.
    expect(useMilestoneStore.getState().current).toBeNull()
  })

  it('keeps beats separate per book', () => {
    const { fire, clear } = useMilestoneStore.getState()
    fire({ id: 'halfway:b1', title: 'one' })
    clear()
    fire({ id: 'halfway:b2', title: 'two' })
    expect(useMilestoneStore.getState().current?.title).toBe('two')
  })

  it('ignores a beat with no id rather than throwing', () => {
    useMilestoneStore.getState().fire({ title: 'nameless' })
    expect(useMilestoneStore.getState().current).toBeNull()
  })

  it('resetForBook clears only that book, leaving others earned', () => {
    const { fire, clear, resetForBook } = useMilestoneStore.getState()
    fire({ id: 'halfway:b1', title: 'one' })
    clear()
    fire({ id: 'halfway:b2', title: 'two' })
    clear()

    resetForBook('b1')
    fire({ id: 'halfway:b1', title: 'one again' })
    expect(useMilestoneStore.getState().current?.title).toBe('one again')

    clear()
    fire({ id: 'halfway:b2', title: 'two again' })
    expect(useMilestoneStore.getState().current).toBeNull()
  })
})
