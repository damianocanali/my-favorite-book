// Stage 4 web wiring: source-level checks (the repo's web tests run in node).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')

describe('Stage 4 web', () => {
  it('unverified teachers see the confirming notice instead of the create form', () => {
    const src = read('src/pages/TeacherPage.jsx')
    expect(src).toMatch(/\{!verified && <TeacherVerificationNotice/)
    expect(src).toMatch(/\{verified && \(\s*<motion\.div/)
    expect(src).toMatch(/res\.data\?\.verification/)
  })

  it('every purchase form needs the school name and the NDPA confirmation, and links the NDPA page', () => {
    for (const p of ['src/components/school/PlanBillingSection.jsx', 'src/pages/TeacherSchoolPlanPage.jsx']) {
      const src = read(p)
      expect(src).toMatch(/disabled=\{[^}]*!schoolName\.trim\(\)[^}]*!dpa/)
      expect(src).toMatch(/to=\{NDPA_PATH\}/)
    }
    const page = read('src/pages/SchoolsPricingPage.jsx')
    expect(page).toMatch(/id=\{k === 'ndpa' \? 'ndpa' : undefined\}/)
  })

  it('routes: public /schools, protected /teacher/school', () => {
    const app = read('src/App.jsx')
    expect(app).toMatch(/<Route path="\/schools" element=\{<SchoolsPricingPage \/>\} \/>/)
    expect(app).toMatch(/path="\/teacher\/school"[\s\S]{0,120}<ProtectedRoute>[\s\S]{0,80}<TeacherSchoolPlanPage \/>/)
  })

  it('the class page shows Plan & billing; the admin page has the verification queue', () => {
    expect(read('src/pages/TeacherClassPage.jsx')).toMatch(/<PlanBillingSection classId=\{classItem\.id\}/)
    expect(read('src/pages/AdminPage.jsx')).toMatch(/<TeacherVerifications \/>/)
  })

  it('the owner queue shows the email domain and user id, never an address', () => {
    const src = read('src/components/admin/TeacherVerifications.jsx')
    expect(src).toMatch(/r\.email_domain/)
    expect(src).not.toMatch(/r\.email\b/)
  })
})

describe('Stage 4 review N2: seat forms send a stable request id', () => {
  it('generated once per change, reused on retry, renewed after success', () => {
    for (const p of ['src/components/school/PlanBillingSection.jsx', 'src/pages/TeacherSchoolPlanPage.jsx']) {
      const src = read(p)
      expect(src).toMatch(/useState\(\(\) => crypto\.randomUUID\(\)\)/)
      expect(src).toMatch(/action: 'seats', seats: [^}]*request_id: seatRequestId/)
      expect(src).toMatch(/setSeatRequestId\(crypto\.randomUUID\(\)\)/)
    }
  })
})
