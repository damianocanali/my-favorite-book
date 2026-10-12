// The printed feelings check-in shows FEELINGS in a fixed grid of
// circleRows x 3 circles (sheets.jsx FeelingsCheckinBody). A feeling added
// to src/lib/checkIn.js beyond that would silently fall off the sheet.
import { describe, it, expect } from 'vitest'
import { FEELINGS } from '../src/lib/checkIn.js'
import { BESPOKE_IN } from '../src/lib/worksheets/printLayout.js'

describe('feelings check-in print grid', () => {
  it('has a circle for every feeling', () => {
    expect(FEELINGS.length).toBeLessThanOrEqual(BESPOKE_IN.feelings_checkin.circleRows * 3)
  })
})
