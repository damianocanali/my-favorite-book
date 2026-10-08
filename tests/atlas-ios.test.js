// iOS "Have a code from Atlas?" — source checks (no iOS test target).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const card = readFileSync('ios-native/MyBookLab/Views/AtlasCodeCard.swift', 'utf8')
const cardCode = card.replace(/\/\/[^\n]*/g, '') // comments out
const account = readFileSync('ios-native/MyBookLab/Views/AccountView.swift', 'utf8')
const api = readFileSync('ios-native/MyBookLab/Services/APIClient.swift', 'utf8')

describe('AtlasCodeCard', () => {
  it('only for family accounts: never a class account, never a teacher account', () => {
    expect(account).toContain('if !auth.isStudent && !auth.isTeacher { AtlasCodeCard() }')
  })
  it('calls the redeem endpoint with just the code', () => {
    expect(api).toContain('path: "/api/referral/redeem-code"')
    expect(api).toMatch(/struct RedeemAtlasCodeBody: Encodable \{ let code: String \}/)
  })
  it('maps every server error code, uses an alert (no confirmationDialog), shows no prices', () => {
    for (const c of ['invalid_code', 'already_referred', 'rate_limited']) expect(card).toContain(`case "${c}"`)
    expect(card).toContain('.alert(')
    expect(card).not.toContain('confirmationDialog')
    expect(cardCode).not.toMatch(/\$\d+[.,]\d\d|\bprice|€/i) // $0 is a Swift closure arg, not money
  })
  it('formats with the same alphabet as the server', async () => {
    const { CODE_ALPHABET } = await import('../lib/atlas/referral.js')
    expect(card).toContain(`Set("${CODE_ALPHABET}")`)
  })
})
