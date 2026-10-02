// Review §7 item 27 (iPad has no test target; these pin the source).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(`ios-native/${p}`, 'utf8')

describe('PrivacyInfo.xcprivacy', () => {
  const plist = read('MyBookLab/PrivacyInfo.xcprivacy')
  const section = plist.slice(plist.indexOf('<key>NSPrivacyCollectedDataTypes</key>'))
  it('declares what the app collects, none of it for tracking', () => {
    for (const t of ['Name', 'EmailAddress', 'PhysicalAddress', 'OtherUserContent', 'UserID', 'PurchaseHistory', 'PhotosorVideos']) {
      expect(section, t).toContain(`NSPrivacyCollectedDataType${t}<`)
    }
    expect(section).not.toMatch(/NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/)
    expect(section).not.toMatch(/<array\/>\s*<\/dict>\s*<\/plist>/)
    expect(plist).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/)
  })
})

describe('student sign-out on a shared iPad', () => {
  const auth = read('MyBookLab/Stores/AuthStore.swift')
  const signOut = auth.slice(auth.indexOf('func signOut() async'), auth.indexOf('func signInAsStudent'))
  it("clears the child's books, draft, check-ins, coins, rewards and avatar", () => {
    for (const c of ['CheckInStore.shared.clear()', 'BookshelfStore.shared.clear()', 'BookDraftStore.shared.clear()',
      'CoinsStore.shared.clearLocal()', 'RewardsStore.shared.clearLocal()', 'removeObject(forKey: avatarDefaultsKey)']) {
      expect(signOut, c).toContain(c)
    }
  })
  it('KEEPS worksheet drafts and seen-assignment markers (owner ruling: autosave on shared class iPads) and device settings', () => {
    expect(signOut).not.toMatch(/WorksheetDrafts\.(remove|prune)|AssignmentSeen\./)
    expect(signOut).not.toMatch(/ClassDeviceStore|AppLanguage|music_muted/)
    expect(signOut).toContain('Deliberately KEPT across a class account')
  })
})

describe('first-use AI disclosure for family accounts (5.1.2(i))', () => {
  const tabs = read('MyBookLab/Views/MainTabView.swift')
  it('is presented for signed-in non-student accounts until acknowledged', () => {
    expect(tabs).toContain('.fullScreenCover(isPresented: showAIDisclosure)')
    expect(tabs).toMatch(/auth\.user != nil && !auth\.isStudent\s*&& !AIDisclosure\.isAcknowledged/)
  })
  it('has Italian copy for every line', () => {
    const cat = JSON.parse(read('MyBookLab/Localizable.xcstrings')).strings
    const keys = Object.keys(cat).filter((k) => k.startsWith('ai_disclosure.'))
    expect(keys.length).toBe(8)
    for (const k of keys) expect(cat[k].localizations.it.stringUnit.value, k).toBeTruthy()
  })
  it('says accurately what each service receives (review fix I3)', () => {
    const cat = JSON.parse(read('MyBookLab/Localizable.xcstrings')).strings
    const en = (k) => cat[`ai_disclosure.${k}`].localizations.en.stringUnit.value
    expect(en('story_buddy')).toMatch(/Anthropic[\s\S]*story text your child writes[\s\S]*Story Buddy[\s\S]*describe each picture/)
    expect(en('pictures')).toMatch(/Together AI[\s\S]*scene description[\s\S]*photo avatar[\s\S]*photo/)
    expect(en('safety')).toMatch(/OpenAI checks the words and every finished picture/)
    // The source's defaults match the catalog's English.
    const view = read('MyBookLab/Views/AIDisclosureView.swift')
    for (const k of ['story_buddy', 'pictures', 'safety']) expect(view).toContain(en(k).replace(/\\/g, ''))
  })
})
