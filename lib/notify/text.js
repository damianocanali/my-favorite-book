// Every word a notification says, in one place, so a test can prove none of
// them ever carries a feeling or a need (spec §12.4): push and email only
// ever say WHO asked and in WHICH class. The dashboard shows the rest.
export const APP_URL = 'https://mybooklab.app'

export const DISCLAIMER = {
  en: 'My Book Lab passes this message on. It is not monitored and is not an emergency service.',
  it: 'My Book Lab inoltra questo messaggio. Non è monitorato e non è un servizio di emergenza.',
}

const T = {
  en: {
    grownup: (s, c) => `${s} in ${c} asked for a grown-up.`,
    allIn: (c, a) => `Everyone in ${c} has handed in "${a}".`,
    allInSubject: (c) => `Everyone in ${c} has handed in`,
    open: 'Open your dashboard',
  },
  it: {
    grownup: (s, c) => `${s} (${c}) ha chiesto un adulto.`,
    allIn: (c, a) => `Tutta la classe ${c} ha consegnato "${a}".`,
    allInSubject: (c) => `Tutta la classe ${c} ha consegnato`,
    open: 'Apri la tua dashboard',
  },
}

export const lang = (locale) => (locale === 'it' ? 'it' : 'en')

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

// Plain, table-free HTML: every mail client renders it, and the text part
// carries the same words for the ones that don't.
export function emailHtml(paragraphs, { link, linkText, locale }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join('')
  const button = link
    ? `<p style="margin:16px 0"><a href="${escapeHtml(link)}" style="color:#6d28d9;font-weight:bold">${escapeHtml(linkText)}</a></p>`
    : ''
  return (
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#1f2937">` +
    `${body}${button}<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(DISCLAIMER[lang(locale)])}</p></div>`
  )
}

export function emailText(lines, { link, locale }) {
  return [...lines, '', link ? link : null, '', '—', DISCLAIMER[lang(locale)]].filter((l) => l !== null).join('\n')
}

/**
 * The words for one urgent notification. Takes names only — there is no
 * parameter a feeling could arrive through.
 */
export function urgentMessage(kind, { studentName, className, assignmentTitle, classroomId, assignmentId, locale }) {
  const l = lang(locale)
  const t = T[l]
  const cls = className || 'your class'
  let body, subject, url
  if (kind === 'all_handed_in') {
    body = t.allIn(cls, assignmentTitle || '')
    subject = t.allInSubject(cls)
    url = classroomId && assignmentId ? `/teacher/class/${classroomId}?review=${assignmentId}` : '/teacher'
  } else {
    body = t.grownup(studentName || '', cls)
    subject = body
    url = '/teacher'
  }
  const link = `${APP_URL}${url}`
  return {
    title: 'My Book Lab',
    body,
    subject,
    url,
    emailText: emailText([body], { link, locale: l }),
    emailHtml: emailHtml([body], { link, linkText: t.open, locale: l }),
  }
}

const S = {
  en: {
    subject: (weekly) => (weekly ? 'This week in your classes — My Book Lab' : 'Today in your classes — My Book Lab'),
    intro: (weekly) => (weekly ? 'Here is what happened in your classes this week.' : 'Here is what happened in your classes today.'),
    handIns: (n) => `${n} hand-in${n === 1 ? '' : 's'}`,
    late: (n) => ` (${n} late)`,
    notYet: (n, title) => `${n} not handed in yet for "${title}"`,
    help: (n) => `${n} help ask${n === 1 ? '' : 's'}`,
    open: 'Open your dashboard',
  },
  it: {
    subject: (weekly) => (weekly ? 'Questa settimana nelle tue classi — My Book Lab' : 'Oggi nelle tue classi — My Book Lab'),
    intro: (weekly) => (weekly ? 'Ecco cosa è successo nelle tue classi questa settimana.' : 'Ecco cosa è successo oggi nelle tue classi.'),
    handIns: (n) => `${n} ${n === 1 ? 'consegna' : 'consegne'}`,
    late: (n) => ` (${n} in ritardo)`,
    notYet: (n, title) => `${n} ancora da consegnare per "${title}"`,
    help: (n) => `${n} ${n === 1 ? 'richiesta' : 'richieste'} di aiuto`,
    open: 'Apri la tua dashboard',
  },
}

/**
 * The daily/weekly summary email. Counts only: hand-ins, late ones, who
 * hasn't handed in the open assignment, and how many help asks. Never a
 * feeling, never what a child asked for.
 * classes: [{ name, handIns, late, helpAsks, open: { title, notYet } | null }]
 */
export function summaryMessage({ classes, weekly = false, locale }) {
  const l = lang(locale)
  const t = S[l]
  const lines = classes.map((c) => {
    const parts = []
    if (c.handIns) parts.push(t.handIns(c.handIns) + (c.late ? t.late(c.late) : ''))
    if (c.open && c.open.notYet > 0) parts.push(t.notYet(c.open.notYet, c.open.title))
    if (c.helpAsks) parts.push(t.help(c.helpAsks))
    return `${c.name}: ${parts.join(' · ')}`
  })
  const link = `${APP_URL}/teacher`
  return {
    subject: t.subject(weekly),
    text: emailText([t.intro(weekly), '', ...lines], { link, locale: l }),
    html: emailHtml([t.intro(weekly), ...lines], { link, linkText: t.open, locale: l }),
  }
}
