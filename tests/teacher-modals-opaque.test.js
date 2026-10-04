// Owner feedback round 5: teacher-area modals, drawers and popovers read as
// "transparent" — `.glass` is a deliberately translucent white/8% fill, so
// the page (and the still teacher backdrop) showed through dense panels
// like the bell and a child's My Writing Year. Every overlay in the teacher
// area must be an opaque panel (bg-galaxy-bg-light, index.css/tailwind's
// pre-blended opaque surface — the app is dark-only) over a dimmed
// backdrop, stacked above the header (z-50) and the tab bar (z-40).
// Grep-style, like tests/ios-no-confirmation-dialog.test.js.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const TRANSLUCENT = /(^|\s)(glass(-[a-z]+)?|ios-card|backdrop-blur(-\w+)?|bg-white\/[\d.[\]]+|bg-galaxy-bg(-light)?\/\d+)(?=\s|$)/

const files = [
  ...readdirSync('src/components/school').filter((f) => f.endsWith('.jsx')).map((f) => join('src/components/school', f)),
  ...readdirSync('src/pages').filter((f) => /^Teacher.*\.jsx$/.test(f)).map((f) => join('src/pages', f)),
  'src/components/worksheets/CustomizePanel.jsx',
]

// Every className: a plain string, or an expression (template literal,
// ternary, …) — for an expression, every string literal in it, joined, so
// a translucent class on EITHER branch of a ternary is caught too.
export function classNames(src) {
  const out = []
  const re = /className=/g
  let m
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length
    if (src[start] === '"') {
      const end = src.indexOf('"', start + 1)
      out.push({ value: src.slice(start + 1, end), index: m.index })
    } else if (src[start] === '{') {
      let depth = 0
      let i = start
      for (; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}' && --depth === 0) break
      }
      const expr = src.slice(start + 1, i)
      const parts = [...expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map((x) => (x[1] ?? x[2] ?? x[3]).replace(/\$\{[^}]*\}/g, ' '))
      out.push({ value: parts.join(' '), index: m.index })
    }
  }
  return out
}

function overlays() {
  const found = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const names = classNames(src)
    names.forEach((n, i) => {
      if (!/(^|\s)fixed(\s|$)/.test(n.value) || !/(^|\s)inset-0(\s|$)/.test(n.value)) return
      // The bell's own click-away backdrop has no panel of its own.
      if (/data-testid="bell-backdrop"/.test(src.slice(Math.max(0, n.index - 200), n.index))) return
      const panel = names.slice(i + 1).find((x) => /rounded-2xl/.test(x.value))
      found.push({ file, overlay: n.value, panel: panel?.value ?? null })
    })
  }
  return found
}

describe('teacher-area modals are opaque', () => {
  const list = overlays()

  it('finds the teacher modals (scanner sanity)', () => {
    const names = list.map((o) => o.file)
    for (const f of ['NudgeSheet', 'StudentDetailDrawer', 'WritingYearChild', 'TypedConfirmDialog', 'RosterTable', 'AssignmentForm', 'AssignmentReview', 'StudentBooks']) {
      expect(names.some((n) => n.endsWith(`/${f}.jsx`)), f).toBe(true)
    }
  })

  it.each(list.map((o) => [`${o.file}`, o]))('%s: opaque panel over a dimmed backdrop, above the chrome', (_, o) => {
    const z = Number(o.overlay.match(/(?:^|\s)z-\[(\d+)\]/)?.[1] ?? o.overlay.match(/(?:^|\s)z-(\d+)/)?.[1] ?? 0)
    expect(z, 'overlay must stack above the teacher header (z-50)').toBeGreaterThan(50)
    expect(o.overlay).not.toMatch(TRANSLUCENT)
    const fullScreen = /(^|\s)bg-galaxy-bg(\s|$)/.test(o.overlay)
    if (fullScreen) return // an opaque full-screen sheet is its own panel
    expect(o.overlay).toMatch(/(^|\s)bg-black\/\d+/)
    expect(o.panel, 'panel next to the backdrop').toBeTruthy()
    expect(o.panel).not.toMatch(TRANSLUCENT)
    expect(o.panel).toMatch(/(^|\s)bg-galaxy-bg(-light)?(\s|$)/)
  })

  it('the bell panel is opaque and has a dimmed backdrop', () => {
    const src = readFileSync('src/components/school/NotificationBell.jsx', 'utf8')
    const panel = classNames(src).find((n) => /absolute right-0 top-full/.test(n.value))
    expect(panel).toBeTruthy()
    expect(panel.value).not.toMatch(TRANSLUCENT)
    expect(panel.value).toMatch(/(^|\s)bg-galaxy-bg-light(\s|$)/)
    expect(src).toMatch(/data-testid="bell-backdrop"[\s\S]{0,120}className="fixed inset-0 z-40 bg-black\/\d+"/)
  })

  it('reads both branches of a ternary className', () => {
    const [n] = classNames("<div className={open ? 'fixed inset-0 z-[70] bg-black/60' : 'glass rounded-2xl'} />")
    expect(n.value).toMatch(/fixed inset-0/)
    expect(n.value).toMatch(TRANSLUCENT)
  })

  it('the roster row menu popover is opaque', () => {
    const src = readFileSync('src/components/school/RosterTable.jsx', 'utf8')
    const menu = classNames(src).find((n) => /absolute right-0 top-full/.test(n.value))
    expect(menu.value).not.toMatch(TRANSLUCENT)
  })

  it("the teacher <main> makes no stacking context that would trap modals under the header and tab bar", () => {
    const src = readFileSync('src/components/layout/AppShell.jsx', 'utf8')
    const teacher = src.slice(src.indexOf('if (teacherMode) {'), src.indexOf('<TabBar teacherMode />'))
    const main = teacher.match(/<main id="main-content" className="([^"]*)"/)[1]
    expect(main).not.toMatch(/(^|\s)z-/)
    expect(teacher).toMatch(/<header className="relative z-50 /)
  })
})
