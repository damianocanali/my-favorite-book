// The teacher's Dashboard tab — SwiftUI counterpart of
// src/pages/TeacherDashboardPage.jsx with NeedsYouNow, ClassGlance and
// StudentsTable.
//
// Two loads, kept apart like the web: the cross-class one (every class plus
// unseen help asks — "Needs you now"), polled every 30 s while this screen is
// on screen and the app is active, and the selected class's own summary and
// roster, which only reloads when the class changes or on pull-to-refresh.
//
// No scores, rankings or feeling totals anywhere: a check-in is a small icon
// with a spoken "what and when", nothing more.
import SwiftUI

struct TeacherDashboardView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(TeacherStore.self) private var teacher
    @Environment(\.scenePhase) private var scenePhase

    @State private var classes: [TeacherClassRef]?
    @State private var help: [TeacherHelpItem] = []
    @State private var dashError: String??
    @State private var selectedClassId: String?
    @State private var classData: TeacherClassDashboard?
    @State private var classLoading = false
    @State private var classError: String??
    @State private var helpActionError: String??
    /// id -> when its post-Seen suppression ends (web: filterRecentlySeen).
    @State private var recentlySeenUntil: [String: Date] = [:]
    @State private var creatingClass = false
    /// Latest nudge per student id, for the selected class.
    @State private var nudges: [String: TeacherNudge] = [:]
    @State private var nudging = false
    @State private var nudgeResult: String?
    @Environment(\.horizontalSizeClass) private var hSize
    // Scaled with Dynamic Type, so larger text grows every card equally.
    @ScaledMetric(relativeTo: .body) private var studentCardHeight: CGFloat = 176
    @ScaledMetric(relativeTo: .caption) private var badgeRowHeight: CGFloat = 22
    @ScaledMetric(relativeTo: .caption) private var checkinRowHeight: CGFloat = 20

    private static let pollInterval: Duration = .seconds(30)

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                content
            }
            .navigationTitle(Text(TeacherCopy.dashboardTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let classes, classes.count > 1 { classSwitcher(classes) }
                    TeacherBellButton()
                }
            }
        }
        // Polls while this tab is on screen and the app is active: the task
        // restarts on every scene-phase change (loading at once on coming
        // back) and is cancelled when the tab goes away or the app leaves
        // the foreground.
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await loadOverview()
                try? await Task.sleep(for: Self.pollInterval)
            }
        }
        .onChange(of: selectedClassId) { _, id in
            if let id { Task { await loadClass(id) } }
        }
        .onAppear { consumeRoute() }
        .onChange(of: teacher.pendingRoute) { _, _ in consumeRoute() }
        .sheet(isPresented: $nudging) {
            if let classData {
                TeacherNudgeSheet(classId: classData.class.id, students: classData.students,
                                  assignments: classData.assignments ?? []) { res in
                    nudgeResult = NudgeResultText.make(res)
                    Task { await loadNudges(classData.class.id) }
                }
            }
        }
        .sheet(isPresented: $creatingClass) {
            TeacherCreateClassSheet { created in
                if let created { teacher.rememberedClassId = created.id }
                Task { await loadOverview() }
            }
        }
    }

    // MARK: - Layout

    @ViewBuilder
    private var content: some View {
        if classes == nil {
            if let dashError {
                TeacherErrorBlock(message: TeacherCopy.error(dashError)) { Task { await loadOverview() } }
                    .contentColumn()
            } else {
                TeacherLoading()
            }
        } else if classes?.isEmpty == true {
            emptyState
        } else {
            ScrollView {
                VStack(spacing: 20) {
                    if let helpActionError {
                        Text(TeacherCopy.error(helpActionError))
                            .font(.footnote).foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    PushAlertsCard()
                    needsYouNow
                    classSection
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.wide)
            }
            .scrollContentBackground(.hidden)
            .refreshable {
                await loadOverview()
                if let selectedClassId { await loadClass(selectedClassId) }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "graduationcap.fill")
                .font(.system(size: 44))
                .foregroundStyle(.cyan)
            Text(TeacherCopy.emptyHeading)
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
            Text(TeacherCopy.emptyBody)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
            SparkleButton(action: { creatingClass = true }) {
                Text(TeacherCopy.emptyCta)
            }
            .frame(maxWidth: 360)
        }
        .padding(32)
        .contentColumn()
    }

    private func classSwitcher(_ classes: [TeacherClassRef]) -> some View {
        Menu {
            Picker(selection: Binding(
                get: { selectedClassId ?? "" },
                set: { selectClass($0) }
            )) {
                ForEach(classes) { c in
                    Text(verbatim: c.name ?? "—").tag(c.id)
                }
            } label: {
                Text(TeacherCopy.classSwitcher)
            }
        } label: {
            HStack(spacing: 4) {
                Text(verbatim: classes.first { $0.id == selectedClassId }?.name ?? "—")
                    .lineLimit(1)
                Image(systemName: "chevron.down").font(.caption)
            }
            .foregroundStyle(.white)
        }
        .accessibilityLabel(Text(TeacherCopy.classSwitcher))
    }

    // MARK: - Needs you now

    private var needsYouNow: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 12) {
                TeacherSectionHeading(text: TeacherCopy.needsHeading)
                Text(TeacherCopy.needsDisclaimer)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
                if help.isEmpty {
                    Text(TeacherCopy.needsEmpty)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                } else {
                    let grownup = help.filter(\.isGrownup)
                    let book = help.filter { !$0.isGrownup }
                    if !grownup.isEmpty {
                        helpGroup(TeacherCopy.needsGrownup, grownup, urgent: true)
                    }
                    if !book.isEmpty {
                        helpGroup(TeacherCopy.needsBook, book, urgent: false)
                    }
                }
            }
        }
    }

    private func helpGroup(_ title: LocalizedStringResource, _ rows: [TeacherHelpItem], urgent: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(urgent ? Color(red: 1, green: 0.45, blue: 0.45) : .white.opacity(0.6))
            ForEach(rows) { item in helpRow(item, urgent: urgent) }
        }
    }

    private func helpRow(_ item: TeacherHelpItem, urgent: Bool) -> some View {
        let name = item.display_name ?? String(appLocalized: TeacherCopy.unknownStudent)
        let detail = [
            item.class_name,
            TeacherDates.relative(item.created_at),
            (item.asks ?? 1) > 1 ? String(appLocalized: TeacherCopy.asks(item.asks ?? 1)) : nil,
        ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return HStack(spacing: 12) {
            if urgent {
                Image(systemName: "exclamationmark.bubble.fill")
                    .foregroundStyle(Color(red: 1, green: 0.45, blue: 0.45))
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: name).font(.headline).foregroundStyle(.white)
                Text(verbatim: detail).font(.caption).foregroundStyle(.white.opacity(0.65))
            }
            Spacer(minLength: 8)
            Button {
                Task { await markSeen(item) }
            } label: {
                Text(TeacherCopy.seen)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .overlay(Capsule().strokeBorder(.white.opacity(0.4)))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(TeacherCopy.seenAria(name)))
        }
        .padding(12)
        .background(
            urgent ? Color.red.opacity(0.18) : Color.white.opacity(0.06),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(urgent ? Color.red.opacity(0.45) : .clear))
    }

    // MARK: - Selected class

    @ViewBuilder
    private var classSection: some View {
        if classLoading && classData == nil {
            TeacherLoading()
        } else if let classError {
            TeacherCard {
                TeacherErrorBlock(message: TeacherCopy.error(classError)) {
                    if let selectedClassId { Task { await loadClass(selectedClassId) } }
                }
            }
        } else if let classData {
            glance(classData)
            students(classData)
        }
    }

    /// Four pills, all the same size: equal flexible columns (4 across on
    /// a regular-width iPad, 2×2 on a phone or a narrow split view), a fixed
    /// minimum height, and every line's space reserved — so a label that
    /// wraps to two lines, or the one pill with a sub-line, never makes its
    /// pill bigger than its neighbours.
    private func glance(_ data: TeacherClassDashboard) -> some View {
        let s = data.summary
        let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: hSize == .regular ? 4 : 2)
        return VStack(alignment: .leading, spacing: 12) {
            TeacherSectionHeading(text: TeacherCopy.glanceHeading)
            LazyVGrid(columns: columns, spacing: 12) {
                GlancePill(label: TeacherCopy.glanceActive) {
                    Text(TeacherCopy.fraction(s.active_this_week ?? 0, s.total_students ?? 0))
                }
                GlancePill(label: TeacherCopy.glanceBooks, sub: TeacherCopy.booksEdited(s.books_edited_this_week ?? 0)) {
                    Text(verbatim: String(s.books_total ?? 0))
                }
                GlancePill(label: TeacherCopy.glancePictures) {
                    Text(TeacherCopy.fraction(s.images_used ?? 0, s.image_allowance ?? 0))
                }
                GlancePill(label: TeacherCopy.glanceLicense) {
                    LicenseBadge(license: data.class.license)
                }
            }
        }
    }

    private func students(_ data: TeacherClassDashboard) -> some View {
        let latest = data.latestOpenAssignment
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                TeacherSectionHeading(text: TeacherCopy.studentsHeading)
                Spacer()
                if !data.students.isEmpty {
                    Button {
                        nudgeResult = nil
                        nudging = true
                    } label: {
                        Label { Text(NudgeCopy.nudgeButton) } icon: { Image(systemName: "hand.wave.fill") }
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .background(Color.cyan.opacity(0.15), in: Capsule())
                            .foregroundStyle(.cyan)
                    }
                    .buttonStyle(.plain)
                }
                // The column the roster's chips track: the newest open
                // assignment, linking to its review — or a nudge to make one.
                Button {
                    if let latest {
                        teacher.open(.review(classId: data.class.id, assignmentId: latest.id))
                    } else {
                        teacher.open(.classDetail(classId: data.class.id))
                    }
                } label: {
                    Group {
                        if let latest { Text(verbatim: latest.title) } else { Text(TeacherCopy.assignmentHint) }
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.cyan)
                    .lineLimit(1)
                }
            }
            if let nudgeResult {
                Text(verbatim: nudgeResult)
                    .font(.footnote)
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if data.students.isEmpty {
                Text(TeacherCopy.studentsEmpty)
                    .font(.subheadline).foregroundStyle(.white.opacity(0.7))
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
            } else {
                // Equal flexible columns and one fixed card height, so a
                // check-in, a chip or a long name never makes one card bigger.
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top),
                                         count: hSize == .regular ? 2 : 1), spacing: 12) {
                    ForEach(data.students) { student in
                        NavigationLink {
                            TeacherStudentDetailView(classId: data.class.id, student: student,
                                                     assignments: data.assignments ?? [],
                                                     nudge: nudges[student.id]) {
                                Task { await loadNudges(data.class.id) }
                            }
                        } label: {
                            studentCard(student, latest: latest)
                        }
                        .buttonStyle(.plain)
                        // One element that reads the card, with the action as a hint.
                        .accessibilityElement(children: .combine)
                        .accessibilityHint(Text(TeacherCopy.openStudentAria(student.display_name)))
                    }
                }
            }
        }
    }

    private func studentCard(_ s: TeacherDashboardStudent, latest: TeacherDashboardAssignment?) -> some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 12) {
                    TeacherStudentAvatar(emoji: s.avatar_emoji, url: s.avatar_url)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: s.display_name)
                            .font(.headline).foregroundStyle(.white).lineLimit(1).truncationMode(.tail)
                        Group {
                            if let when = TeacherDates.relative(s.last_sign_in_at) {
                                Text(TeacherCopy.lastSignedIn(when))
                            } else {
                                Text(TeacherCopy.neverSignedIn)
                            }
                        }
                        .lineLimit(1)
                        .font(.caption).foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer(minLength: 4)
                    if let latest {
                        HandInChip(state: HandInState(dashboardValue: s.assignments?[latest.id]))
                    }
                }
                // Badge row: always there, so its space is reserved even empty.
                HStack(spacing: 6) {
                    if s.inactive_7d == true {
                        TeacherChip(text: TeacherCopy.inactiveChip, tone: .muted)
                    }
                    NudgeStatusChip(nudge: nudges[s.id])
                    Spacer(minLength: 0)
                }
                .frame(height: badgeRowHeight)
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(TeacherCopy.booksCount(s.books_count ?? 0))
                        // Always a second line (blank when never edited) so
                        // every card keeps the same layout.
                        if let when = TeacherDates.relative(s.last_book_edited_at) {
                            Text(TeacherCopy.lastEdited(when)).opacity(0.7)
                        } else {
                            Text(verbatim: " ").accessibilityHidden(true)
                        }
                    }
                    Spacer()
                    Text(TeacherCopy.picturesToday(s.images_today ?? 0))
                }
                .font(.caption)
                .foregroundStyle(.white.opacity(0.75))
                .lineLimit(1)
                checkinIcons(s.checkins_7d ?? [])
                    .fixedSize(horizontal: true, vertical: false)
                    .frame(maxWidth: .infinity, maxHeight: checkinRowHeight, alignment: .leading)
                    .frame(height: checkinRowHeight)
                    .clipped()
            }
            .frame(height: studentCardHeight, alignment: .top)
            // At accessibility sizes, content is cut at the card's edge
            // rather than spilling into the neighbouring card.
            .clipped()
        }
    }

    private func checkinIcons(_ checkins: [TeacherCheckin]) -> some View {
        Group {
            if checkins.isEmpty {
                Text(TeacherCopy.noCheckins).font(.caption).foregroundStyle(.white.opacity(0.5))
            } else {
                HStack(spacing: 4) {
                    ForEach(Array(checkins.enumerated()), id: \.offset) { _, c in
                        TeacherFeelingIcon(id: c.feeling, size: 18)
                            .accessibilityElement()
                            .accessibilityLabel(Text(verbatim: c.spokenLabel))
                    }
                }
            }
        }
    }

    // MARK: - Loading

    private func loadOverview() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherOverview(bearerToken: token)
            let nextClasses = res.classes ?? []
            let now = Date()
            recentlySeenUntil = recentlySeenUntil.filter { $0.value > now }
            classes = nextClasses
            help = (res.help ?? []).filter { recentlySeenUntil[$0.id] == nil }
            dashError = nil
            // Keep whatever is open if it is still valid; only the first load
            // falls back to the remembered class, so a poll never yanks the
            // switcher away from the class the teacher chose.
            if let current = selectedClassId, nextClasses.contains(where: { $0.id == current }) { return }
            selectedClassId = TeacherHelpRules.pickClassId(nextClasses, remembered: teacher.rememberedClassId)
        } catch {
            // A failed poll keeps what is on screen; only a first load shows it.
            if classes == nil { dashError = .some((error as? APIClient.TeacherError)?.code) }
        }
    }

    private func loadClass(_ id: String) async {
        classLoading = true
        classError = nil
        defer { classLoading = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let data = try await APIClient.shared.teacherClassDashboard(classId: id, bearerToken: token)
            guard id == selectedClassId else { return }
            classData = data
            await loadNudges(id)
        } catch {
            guard id == selectedClassId else { return }
            classError = .some((error as? APIClient.TeacherError)?.code)
        }
    }

    /// Best-effort: a failed read just shows no "Sent" / "Seen ✓" chips.
    private func loadNudges(_ classId: String) async {
        guard let token = await auth.validAccessToken() else { return }
        guard let list = try? await APIClient.shared.teacherNudges(classId: classId, bearerToken: token),
              classId == selectedClassId else { return }
        nudges = Dictionary(list.map { ($0.student_id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    private func selectClass(_ id: String) {
        guard id != selectedClassId else { return }
        teacher.rememberedClassId = id
        // The old class's roster must not sit under the new name while the
        // new one loads.
        classData = nil
        nudges = [:]
        nudgeResult = nil
        selectedClassId = id
    }

    /// Optimistic, with the row put back in its place if the server says no.
    private func markSeen(_ item: TeacherHelpItem) async {
        guard let token = await auth.validAccessToken() else { return }
        helpActionError = nil
        help.removeAll { $0.id == item.id }
        do {
            try await APIClient.shared.teacherMarkHelpSeen(id: item.id, bearerToken: token)
            recentlySeenUntil[item.id] = Date().addingTimeInterval(TeacherHelpRules.seenSuppress)
        } catch {
            // A poll may have brought it back meanwhile: never twice.
            help = TeacherHelpRules.sort(help.filter { $0.id != item.id } + [item])
            helpActionError = .some((error as? APIClient.TeacherError)?.code)
        }
    }

    private func consumeRoute() {
        if teacher.pendingRoute == .dashboard {
            teacher.pendingRoute = nil
            Task { await loadOverview() }
        }
    }
}

/// One "Class at a glance" pill: the value big and centred, the label under
/// it (up to two lines, space always reserved), and an optional sub-line
/// (space reserved too, so every pill in the grid is the same height).
private struct GlancePill<Value: View>: View {
    let label: LocalizedStringResource
    var sub: LocalizedStringResource? = nil
    @ViewBuilder var value: () -> Value

    var body: some View {
        VStack(spacing: 4) {
            value()
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))
                .multilineTextAlignment(.center)
                .lineLimit(2, reservesSpace: true)
            Group {
                if let sub { Text(sub) } else { Text(verbatim: " ") }
            }
            .font(.caption2)
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1, reservesSpace: true)
            .minimumScaleFactor(0.8)
            .accessibilityHidden(sub == nil)
        }
        .frame(maxWidth: .infinity, minHeight: 118)
        .padding(.horizontal, 10)
        .padding(.vertical, 12)
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(TeacherTheme.cardStroke))
        .accessibilityElement(children: .combine)
    }
}
