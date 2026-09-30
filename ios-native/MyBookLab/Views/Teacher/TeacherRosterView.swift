// A class's roster, natively: add one child or several at once, rename,
// unlock, sign out everywhere, make new pictures, remove / restore — the
// web's AddStudents + RosterTable over the same api/school/students.js.
//
// Adding a child or giving them new pictures returns their one-time picture
// password. It is shown at once, big, with "Print sign-in cards" (AirPrint),
// and never stored: the server only keeps a hash, so once this screen goes
// the pictures are gone (a teacher can always make new ones).
import SwiftUI
import UIKit

/// One batch of freshly made picture passwords, shown as sign-in cards.
struct SignInCardsBatch: Identifiable {
    let id = UUID()
    let students: [TeacherNewPictures]
}

struct TeacherRosterView: View {
    let classId: String

    @Environment(AuthStore.self) private var auth

    @State private var cls: TeacherClass?
    @State private var students: [TeacherRosterStudent]?
    @State private var loadError: String??
    @State private var banner: LocalizedStringResource?
    @State private var bannerIsError = false
    @State private var skipped: [TeacherAddStudentsResponse.Skipped] = []
    @State private var busyId: String?

    @State private var addingOne = false
    @State private var oneName = ""
    @State private var addingMany = false
    @State private var renameTarget: TeacherRosterStudent?
    @State private var renameText = ""
    @State private var removeTarget: TeacherRosterStudent?
    @State private var resetTarget: TeacherRosterStudent?
    @State private var cards: SignInCardsBatch?

    private var licenceUsable: Bool {
        guard let cls else { return true } // unknown yet: let the server decide
        return LicenseBadgeState(cls.license).isGood
    }

    var body: some View {
        ZStack {
            CosmicBackground()
            content
        }
        .navigationTitle(Text(TeacherCopy.rosterTitle))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { oneName = ""; addingOne = true } label: {
                        Label { Text(TeacherCopy.addOne) } icon: { Image(systemName: "person.badge.plus") }
                    }
                    Button { addingMany = true } label: {
                        Label { Text(TeacherCopy.addMany) } icon: { Image(systemName: "person.3.fill") }
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .tint(.cyan)
                .disabled(!licenceUsable)
                .accessibilityLabel(Text(TeacherCopy.rosterAdd))
            }
        }
        .task { await load() }
        .refreshable { await load() }
        // Add one child: a name is all it takes.
        .alert(Text(TeacherCopy.addOne), isPresented: $addingOne) {
            TextField(text: $oneName) { Text(TeacherCopy.addName) }
                .textInputAutocapitalization(.words)
            Button { Task { await add([oneName]) } } label: { Text(TeacherCopy.addCount(1)) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        }
        .alert(Text(TeacherCopy.renameTitle), isPresented: Binding(
            get: { renameTarget != nil }, set: { if !$0 { renameTarget = nil } }
        ), presenting: renameTarget) { s in
            TextField(text: $renameText) { Text(TeacherCopy.addName) }
                .textInputAutocapitalization(.words)
            Button { Task { await rename(s, to: renameText) } } label: { Text(TeacherCopy.save) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        }
        .confirmationDialog(
            Text(TeacherCopy.removeConfirm(removeTarget?.display_name ?? "")),
            isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }),
            titleVisibility: .visible, presenting: removeTarget
        ) { s in
            Button(role: .destructive) { Task { await act(s, "remove") } } label: { Text(TeacherCopy.remove) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        }
        .confirmationDialog(
            Text(TeacherCopy.newPicturesConfirm(resetTarget?.display_name ?? "")),
            isPresented: Binding(get: { resetTarget != nil }, set: { if !$0 { resetTarget = nil } }),
            titleVisibility: .visible, presenting: resetTarget
        ) { s in
            Button { Task { await resetPictures(s) } } label: { Text(TeacherCopy.newPictures) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        }
        .sheet(isPresented: $addingMany) {
            TeacherAddStudentsSheet { names in
                addingMany = false
                Task { await add(names) }
            }
        }
        .fullScreenCover(item: $cards) { batch in
            TeacherSignInCardsView(
                className: cls?.name ?? "",
                classCode: cls?.code ?? "",
                students: batch.students
            ) { cards = nil }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let loadError, students == nil {
            TeacherErrorBlock(message: TeacherCopy.error(loadError)) { Task { await load() } }
                .contentColumn()
        } else if let students {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if !licenceUsable {
                        noticeCard(TeacherCopy.licenceEnded, systemImage: "info.circle.fill", tint: .yellow)
                    }
                    if let banner {
                        noticeCard(banner, systemImage: bannerIsError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill",
                                   tint: bannerIsError ? TeacherTheme.urgent : Color(red: 0.43, green: 0.91, blue: 0.72))
                    }
                    if !skipped.isEmpty { skippedCard }

                    let active = students.filter(\.isActive)
                    let removed = students.filter { !$0.isActive }
                    if active.isEmpty {
                        Text(TeacherCopy.rosterEmpty)
                            .font(.body)
                            .foregroundStyle(.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                    } else {
                        rows(active)
                    }
                    if !removed.isEmpty {
                        TeacherSectionHeading(text: TeacherCopy.removedHeading).padding(.top, 8)
                        rows(removed)
                    }
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
        } else {
            TeacherLoading()
        }
    }

    private func noticeCard(_ text: LocalizedStringResource, systemImage: String, tint: Color) -> some View {
        Label {
            Text(text).font(.body).foregroundStyle(.white)
        } icon: {
            Image(systemName: systemImage).foregroundStyle(tint)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(tint.opacity(0.4)))
    }

    private var skippedCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(TeacherCopy.skippedHeading).font(.headline).foregroundStyle(.white)
            ForEach(Array(skipped.enumerated()), id: \.offset) { _, s in
                Text(verbatim: "\(s.name) — \(String(appLocalized: TeacherCopy.skippedReason(s.code)))")
                    .font(.subheadline)
                    .foregroundStyle(TeacherTheme.secondaryText)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
    }

    private func rows(_ list: [TeacherRosterStudent]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(list.enumerated()), id: \.element.id) { i, s in
                if i > 0 { Divider().overlay(TeacherTheme.cardStroke) }
                row(s)
            }
        }
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(TeacherTheme.cardStroke))
    }

    private func row(_ s: TeacherRosterStudent) -> some View {
        HStack(spacing: 12) {
            TeacherStudentAvatar(emoji: s.avatar_emoji, url: s.avatar_url, size: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: s.display_name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                Group {
                    if let when = TeacherDates.relative(s.last_sign_in_at) {
                        Text(TeacherCopy.lastSignedIn(when))
                    } else {
                        Text(TeacherCopy.neverSignedIn)
                    }
                }
                .font(.footnote)
                .foregroundStyle(TeacherTheme.secondaryText)
            }
            Spacer(minLength: 8)
            if s.isActive && s.needsUnlock { TeacherChip(text: TeacherCopy.lockedChip, tone: .warn) }
            if busyId == s.id {
                ProgressView().tint(.white).frame(width: 44, height: 44)
            } else {
                menu(s)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(minHeight: 64)
        .accessibilityElement(children: .contain)
    }

    private func menu(_ s: TeacherRosterStudent) -> some View {
        Menu {
            if s.isActive {
                Button { renameText = s.display_name; renameTarget = s } label: {
                    Label { Text(TeacherCopy.rename) } icon: { Image(systemName: "pencil") }
                }
                Button { resetTarget = s } label: {
                    Label { Text(TeacherCopy.newPictures) } icon: { Image(systemName: "photo.on.rectangle.angled") }
                }
                if s.needsUnlock {
                    Button { Task { await act(s, "unlock") } } label: {
                        Label { Text(TeacherCopy.unlock) } icon: { Image(systemName: "lock.open.fill") }
                    }
                }
                Button { Task { await act(s, "sign_out") } } label: {
                    Label { Text(TeacherCopy.signOutEverywhere) } icon: { Image(systemName: "rectangle.portrait.and.arrow.right") }
                }
                Button(role: .destructive) { removeTarget = s } label: {
                    Label { Text(TeacherCopy.remove) } icon: { Image(systemName: "person.fill.xmark") }
                }
            } else {
                Button { Task { await act(s, "restore") } } label: {
                    Label { Text(TeacherCopy.restore) } icon: { Image(systemName: "arrow.uturn.backward") }
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text(TeacherCopy.optionsFor(s.display_name)))
    }

    // MARK: Network

    private func load() async {
        guard let token = auth.accessToken else { return }
        async let classes = try? APIClient.shared.teacherClasses(bearerToken: token)
        do {
            let list = try await APIClient.shared.teacherRoster(classId: classId, bearerToken: token)
            students = list
            loadError = nil
        } catch {
            if students == nil { loadError = .some((error as? APIClient.TeacherError)?.code) }
        }
        if let found = await classes?.first(where: { $0.id == classId }) { cls = found }
    }

    private func show(_ message: LocalizedStringResource, error: Bool) {
        banner = message
        bannerIsError = error
    }

    private func add(_ raw: [String]) async {
        let names = TeacherRosterRules.parse(raw.joined(separator: "\n"))
        guard !names.isEmpty else { show(TeacherCopy.studentNameRequired, error: true); return }
        guard let token = auth.accessToken else { return }
        busyId = "add"
        skipped = []
        banner = nil
        defer { busyId = nil }
        do {
            let res = try await APIClient.shared.teacherAddStudents(classId: classId, names: names, bearerToken: token)
            let created = res.created ?? []
            skipped = res.skipped ?? []
            if !created.isEmpty {
                show(TeacherCopy.addedCount(created.count), error: false)
                // Straight to the cards: this is the only time they exist.
                cards = SignInCardsBatch(students: created)
            }
            await load()
        } catch {
            show(TeacherCopy.error(error), error: true)
        }
    }

    private func rename(_ s: TeacherRosterStudent, to raw: String) async {
        let name = TeacherRosterRules.cleanName(raw)
        guard !name.isEmpty else { show(TeacherCopy.studentNameRequired, error: true); return }
        guard name != s.display_name else { return }
        await act(s, "rename", name: name)
    }

    private func act(_ s: TeacherRosterStudent, _ action: String, name: String? = nil) async {
        guard let token = auth.accessToken else { return }
        busyId = s.id
        banner = nil
        defer { busyId = nil }
        do {
            let res = try await APIClient.shared.teacherStudentAction(
                classId: classId, studentId: s.id, action: action, name: name, bearerToken: token)
            if let updated = res.student, let i = students?.firstIndex(where: { $0.id == updated.id }) {
                students?[i] = updated
            } else {
                await load()
            }
            if action == "sign_out" { show(TeacherCopy.signedOut(s.display_name), error: false) }
        } catch {
            show(TeacherCopy.error(error), error: true)
        }
    }

    private func resetPictures(_ s: TeacherRosterStudent) async {
        guard let token = auth.accessToken else { return }
        busyId = s.id
        banner = nil
        defer { busyId = nil }
        do {
            let res = try await APIClient.shared.teacherStudentAction(
                classId: classId, studentId: s.id, action: "reset_secret", bearerToken: token)
            if let updated = res.student, let i = students?.firstIndex(where: { $0.id == updated.id }) {
                students?[i] = updated
            }
            if let pictures = res.pictures, pictures.count == 3 {
                cards = SignInCardsBatch(students: [
                    TeacherNewPictures(id: s.id, display_name: res.student?.display_name ?? s.display_name,
                                       avatar_emoji: res.student?.avatar_emoji ?? s.avatar_emoji, pictures: pictures),
                ])
            }
        } catch {
            show(TeacherCopy.error(error), error: true)
        }
    }
}

// MARK: - Add several

struct TeacherAddStudentsSheet: View {
    let onSubmit: ([String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""

    private var names: [String] { TeacherRosterRules.parse(text) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $text)
                        .font(.body)
                        .frame(minHeight: 220)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .accessibilityLabel(Text(TeacherCopy.addMany))
                } footer: {
                    Text(TeacherCopy.addManyHint)
                }
                if !names.isEmpty {
                    Section {
                        ForEach(names, id: \.self) { Text(verbatim: $0) }
                    }
                }
                Section {
                    Button {
                        onSubmit(names)
                    } label: {
                        Text(TeacherCopy.addCount(names.count)).bold().frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .disabled(names.isEmpty || names.count > TeacherRosterRules.maxStudents)
                    if names.count > TeacherRosterRules.maxStudents {
                        Text(TeacherCopy.error("seats_full")).foregroundStyle(TeacherTheme.urgent)
                    }
                }
            }
            .navigationTitle(Text(TeacherCopy.addMany))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(TeacherCopy.cancel) }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Sign-in cards

struct TeacherSignInCardsView: View {
    let className: String
    let classCode: String
    let students: [TeacherNewPictures]
    let onClose: () -> Void

    @State private var printed = false
    @State private var confirmClose = false
    @Environment(\.horizontalSizeClass) private var hSize

    var body: some View {
        NavigationStack {
            ZStack {
                TeacherTheme.sheetBackground.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Label {
                            Text(TeacherCopy.cardsSafety).font(.body).foregroundStyle(.white)
                        } icon: {
                            Image(systemName: "lock.shield.fill").foregroundStyle(.yellow)
                        }
                        Button(action: printCards) {
                            Label { Text(TeacherCopy.cardsPrint) } icon: { Image(systemName: "printer.fill") }
                                .font(.headline)
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .background(Color.purple, in: RoundedRectangle(cornerRadius: 14))
                                .foregroundStyle(.white)
                        }
                        .buttonStyle(.plain)

                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14),
                                                 count: hSize == .regular ? 2 : 1), spacing: 14) {
                            ForEach(students) { card($0) }
                        }
                    }
                    .padding()
                    .contentColumn(maxWidth: ContentWidth.wide)
                }
            }
            .navigationTitle(Text(TeacherCopy.cardsHeading))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(TeacherTheme.sheetBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        if printed { onClose() } else { confirmClose = true }
                    } label: { Text(TeacherCopy.done).bold() }
                    .tint(.white)
                }
            }
            .confirmationDialog(Text(TeacherCopy.cardsCloseTitle), isPresented: $confirmClose, titleVisibility: .visible) {
                Button(role: .destructive, action: onClose) { Text(TeacherCopy.cardsClose) }
                Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
            }
        }
        .preferredColorScheme(.dark)
    }

    /// Big on screen: the child, and their three pictures in order, as large
    /// as the sign-in pad draws them.
    private func card(_ s: TeacherNewPictures) -> some View {
        VStack(spacing: 10) {
            Text(verbatim: s.avatar_emoji ?? "🙂").font(.system(size: 44)).accessibilityHidden(true)
            Text(verbatim: s.display_name)
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
            HStack(spacing: 14) {
                ForEach(Array(s.pictures.enumerated()), id: \.offset) { i, id in
                    VStack(spacing: 4) {
                        Circle()
                            .fill(Color.purple.opacity(0.3))
                            .overlay(Circle().strokeBorder(Color.purple, lineWidth: 2.5))
                            .overlay(Text(verbatim: SchoolPicture.byId(id)?.emoji ?? "❓").font(.system(size: 40)))
                            .frame(width: 76, height: 76)
                        Text(verbatim: String(i + 1)).font(.headline).foregroundStyle(TeacherTheme.secondaryText)
                    }
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(TeacherCopy.cardsPicturesAria(
                s.pictures.map { id in SchoolPicture.byId(id).map { String(appLocalized: $0.name) } ?? id }
                    .formatted(.list(type: .and).locale(AppLanguage.locale))
            )))
            Text(TeacherCopy.cardsOrder).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(TeacherTheme.cardStroke))
    }

    private func printCards() {
        let data = SignInCardsPDF.make(
            className: className, classCode: classCode, students: students,
            orderHint: String(appLocalized: TeacherCopy.cardsOrder))
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = String(appLocalized: TeacherCopy.cardsHeading)
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = data
        controller.present(animated: true) { _, completed, _ in
            if completed { printed = true }
        }
    }
}

/// US Letter, six cards a page (2 × 3), the same content as the web's
/// SignInCards: class name, class code, the child's emoji and name, their
/// three pictures numbered in order, and where to sign in. Dashed borders
/// are the cut lines.
enum SignInCardsPDF {
    static let perPage = 6
    static let footer = "mybooklab.app/class"

    static func make(className: String, classCode: String, students: [TeacherNewPictures], orderHint: String) -> Data {
        let page = CGRect(x: 0, y: 0, width: 612, height: 792)
        let margin: CGFloat = 36, gap: CGFloat = 18
        let cardW = (page.width - margin * 2 - gap) / 2
        let cardH = (page.height - margin * 2 - gap * 2) / 3
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        return renderer.pdfData { ctx in
            for start in stride(from: 0, to: students.count, by: perPage) {
                ctx.beginPage()
                for (i, s) in students[start..<min(start + perPage, students.count)].enumerated() {
                    let col = CGFloat(i % 2), row = CGFloat(i / 2)
                    let rect = CGRect(x: margin + col * (cardW + gap), y: margin + row * (cardH + gap), width: cardW, height: cardH)
                    drawCard(s, in: rect, className: className, classCode: classCode, orderHint: orderHint)
                }
            }
        }
    }

    private static func drawCard(_ s: TeacherNewPictures, in rect: CGRect, className: String, classCode: String, orderHint: String) {
        let border = UIBezierPath(roundedRect: rect, cornerRadius: 14)
        border.lineWidth = 1
        border.setLineDash([6, 4], count: 2, phase: 0)
        UIColor.gray.setStroke()
        border.stroke()

        var y = rect.minY + 14
        func line(_ text: String, font: UIFont, color: UIColor = .black, spacing: CGFloat = 4) {
            let p = NSMutableParagraphStyle()
            p.alignment = .center
            p.lineBreakMode = .byTruncatingTail
            let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: p]
            let h = ceil((text as NSString).size(withAttributes: attrs).height)
            (text as NSString).draw(in: CGRect(x: rect.minX + 10, y: y, width: rect.width - 20, height: h), withAttributes: attrs)
            y += h + spacing
        }

        line(className.uppercased(), font: .systemFont(ofSize: 10, weight: .semibold), color: .darkGray)
        line(classCode, font: .monospacedSystemFont(ofSize: 13, weight: .bold), color: .darkGray, spacing: 6)
        line(s.avatar_emoji ?? "🙂", font: .systemFont(ofSize: 30), spacing: 2)
        line(s.display_name, font: .systemFont(ofSize: 18, weight: .bold), spacing: 8)

        // The three pictures, evenly spaced, each numbered underneath.
        let emojiFont = UIFont.systemFont(ofSize: 34)
        let numFont = UIFont.systemFont(ofSize: 11, weight: .semibold)
        let slot = (rect.width - 40) / 3
        let center = NSMutableParagraphStyle()
        center.alignment = .center
        for (i, id) in s.pictures.prefix(3).enumerated() {
            let x = rect.minX + 20 + CGFloat(i) * slot
            let emoji = SchoolPicture.byId(id)?.emoji ?? "?"
            (emoji as NSString).draw(in: CGRect(x: x, y: y, width: slot, height: 42),
                                     withAttributes: [.font: emojiFont, .paragraphStyle: center])
            (String(i + 1) as NSString).draw(in: CGRect(x: x, y: y + 44, width: slot, height: 14),
                                             withAttributes: [.font: numFont, .foregroundColor: UIColor.darkGray, .paragraphStyle: center])
        }
        y += 64
        line(orderHint, font: .systemFont(ofSize: 9), color: .darkGray, spacing: 2)
        line(footer, font: .systemFont(ofSize: 9), color: .gray)
    }
}
