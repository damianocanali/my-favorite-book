import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// On iPad a SwiftUI confirmationDialog is a popover that needs a source
// anchor; attached to a screen or a NavigationStack it silently never
// presents, and the button that asked for it looks dead (the owner got stuck
// in the sign-in cards this way). Every yes/no prompt in the app is an
// .alert instead. This guards against one creeping back in.
const ROOT = join(__dirname, '..', 'ios-native', 'MyBookLab')

function swiftFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? swiftFiles(path) : name.endsWith('.swift') ? [path] : []
  })
}

describe('iOS prompts', () => {
  it('uses no .confirmationDialog (it never presents on iPad without an anchor)', () => {
    const offenders = swiftFiles(ROOT).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /\.confirmationDialog\s*\(/.test(line) && !line.trim().startsWith('//'))
        .map(({ n }) => `${file.slice(ROOT.length + 1)}:${n}`),
    )
    expect(offenders).toEqual([])
  })
})
