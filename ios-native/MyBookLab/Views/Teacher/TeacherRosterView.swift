// A class's roster, natively: add one child or several at once, rename,
// unlock, sign out everywhere, make new pictures, remove / restore — the
// web's AddStudents + RosterTable over the same api/school/students.js.
//
// Adding a child or giving them new pictures returns their one-time picture
// password. It is shown at once, big, with "Print sign-in cards" (AirPrint)
// and "Save as PDF". The batch lives in TeacherStore (memory) until the
// teacher closes the cards, so leaving this screen — or a push tap pulling
// the teacher elsewhere — can't lose it. The only thing written to disk is
// the share sheet's PDF: one file per class in tmp/signin-cards (complete
// file protection), removed when the cards close, at launch, and whenever
// the signed-in account changes (SignInCardsFiles.purge()).
//
// Adding and new pictures wait until the class (and its code, printed on
// every card) is known: a card without a class code is useless to a child.
import SwiftUI
import UIKit

struct TeacherRosterView: View {
    let classId: String

    @Environment(AuthStore.self) private var auth
    @Environment(TeacherStore.self) private var teacher

    @State private var cls: TeacherClass?
    @State private var classLoadFailed = false
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
    @State private var showingCards = false

    private var license: LicenseBadgeState? { cls.map { LicenseBadgeState($0.license) } }

    /// Adding (and new pictures) need the class code for the cards and a
    /// usable license; until the class is loaded, neither is known.
    private var canMakePictures: Bool {
        guard let cls, let code = cls.code, !code.isEmpty else { return false }
        return LicenseBadgeState(cls.license).isGood
    }

    private var pending: PendingSignInCards? { teacher.pendingCards[classId] }

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
                .disabled(!canMakePictures || busyId != nil)
                .accessibilityLabel(Text(TeacherCopy.rosterAdd))
            }
        }
        .task { await load() }
        .refreshable { await load() }
        // Add one child: a name is all it takes.
        .alert(Text(TeacherCopy.addOne), isPresented: $addingOne) {
            TextField(text: $oneName) { Text(TeacherCopy.addName) }
                .textInputAutocapitalization(.words)
            // One child, one name: cleaned like the server's cleanName, never
            // split on commas.
            Button { Task { await add([TeacherRosterRules.cleanName(oneName)]) } } label: { Text(TeacherCopy.addCount(1)) }
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
                Task { await add(TeacherRosterRules.parse(names.joined(separator: "\n"))) }
            }
        }
        .fullScreenCover(isPresented: $showingCards) {
            if let pending, !pending.classCode.isEmpty {
                TeacherSignInCardsView(batch: pending) {
                    teacher.dismissPendingCards(classId: classId)
                    showingCards = false
                }
            }
        }
        // Coming back to a class whose cards were never closed: show them.
        .onAppear { if pending != nil { showingCards = true } }
    }

    @ViewBuilder
    private var content: some View {
        if let loadError, students == nil {
            TeacherErrorBlock(message: TeacherCopy.error(loadError)) { Task { await load() } }
                .contentColumn()
        } else if let students {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if classLoadFailed && cls == nil {
                        VStack(alignment: .leading, spacing: 10) {
                            noticeCard(TeacherCopy.classLoadFailed, systemImage: "exclamationmark.triangle.fill", tint: .yellow)
                            Button { Task { await load() } } label: {
                                Text(TeacherCopy.retry).font(.callout.bold())
                                    .padding(.horizontal, 18).frame(minHeight: 44)
                                    .background(.purple.opacity(0.7), in: Capsule())
                                    .foregroundStyle(.white)
                            }
                            .buttonStyle(.plain)
                        }
                    } else if let license, license == .none {
                        noticeCard(TeacherCopy.classNotActive, systemImage: "info.circle.fill", tint: .yellow)
                    } else if let license, license.isWarning {
                        noticeCard(TeacherCopy.licenseEnded, systemImage: "info.circle.fill", tint: .yellow)
                    }
                    if pending != nil {
                        PendingCardsBanner { showingCards = true }
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
                .disabled(!canMakePictures)
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
        guard let token = await auth.validAccessToken() else { return }
        async let classes = try? APIClient.shared.teacherClasses(bearerToken: token)
        do {
            let list = try await APIClient.shared.teacherRoster(classId: classId, bearerToken: token)
            students = list
            loadError = nil
        } catch {
            if students == nil { loadError = .some((error as? APIClient.TeacherError)?.code) }
        }
        if let found = await classes?.first(where: { $0.id == classId }) {
            cls = found
            classLoadFailed = false
        } else if cls == nil {
            classLoadFailed = true
        }
    }

    private func show(_ message: LocalizedStringResource, error: Bool) {
        banner = message
        bannerIsError = error
    }

    /// `names` are already cleaned (cleanName for one child, parse for a list).
    private func add(_ names: [String]) async {
        let names = names.filter { !$0.isEmpty }
        guard !names.isEmpty else { show(TeacherCopy.studentNameRequired, error: true); return }
        guard canMakePictures, let cls, let code = cls.code else { return }
        busyId = "add"
        skipped = []
        banner = nil
        defer { busyId = nil }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherAddStudents(classId: classId, names: names, bearerToken: token)
            let created = res.created ?? []
            skipped = res.skipped ?? []
            if !created.isEmpty {
                show(TeacherCopy.addedCount(created.count), error: false)
                // Straight to the cards: this is the only time they exist.
                teacher.addPendingCards(classId: classId, className: cls.name ?? "", classCode: code, students: created)
                showingCards = true
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
        busyId = s.id
        banner = nil
        defer { busyId = nil }
        guard let token = await auth.validAccessToken() else { return }
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
        guard canMakePictures, let cls, let code = cls.code else { return }
        busyId = s.id
        banner = nil
        defer { busyId = nil }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherStudentAction(
                classId: classId, studentId: s.id, action: "reset_secret", bearerToken: token)
            if let updated = res.student, let i = students?.firstIndex(where: { $0.id == updated.id }) {
                students?[i] = updated
            }
            if let pictures = res.pictures, pictures.count == 3 {
                teacher.addPendingCards(classId: classId, className: cls.name ?? "", classCode: code, students: [
                    TeacherNewPictures(id: s.id, display_name: res.student?.display_name ?? s.display_name,
                                       avatar_emoji: res.student?.avatar_emoji ?? s.avatar_emoji, pictures: pictures),
                ])
                showingCards = true
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

/// "Sign-in cards not printed yet — Show cards", wherever the class shows.
struct PendingCardsBanner: View {
    let show: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "printer.fill").foregroundStyle(.yellow).accessibilityHidden(true)
            Text(TeacherCopy.cardsPending).font(.body.weight(.semibold)).foregroundStyle(.white)
            Spacer(minLength: 8)
            Button(action: show) {
                Text(TeacherCopy.cardsShow).font(.callout.bold())
                    .padding(.horizontal, 16).frame(minHeight: 44)
                    .background(Color.purple, in: Capsule())
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.yellow.opacity(0.5)))
    }
}

struct TeacherSignInCardsView: View {
    let batch: PendingSignInCards
    /// Only called when the teacher closes the cards on purpose.
    let onClose: () -> Void

    /// Only a completed print counts: a share sheet that merely opened
    /// proves nothing was kept, so closing still asks.
    @State private var kept = false
    @State private var confirmClose = false
    @State private var pdfURL: URL?
    /// The Print button's frame in window coordinates (the iPad popover anchor).
    @State private var printAnchor: CGRect = .zero
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
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 12) { printButton; saveButton }
                            VStack(spacing: 10) { printButton; saveButton }
                        }

                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14),
                                                 count: hSize == .regular ? 2 : 1), spacing: 14) {
                            ForEach(batch.students) { card($0) }
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
                        if kept { close() } else { confirmClose = true }
                    } label: { Text(TeacherCopy.done).bold() }
                    .tint(.white)
                }
            }
            .confirmationDialog(Text(TeacherCopy.cardsCloseTitle), isPresented: $confirmClose, titleVisibility: .visible) {
                Button(role: .destructive, action: close) { Text(TeacherCopy.cardsClose) }
                Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
            }
        }
        .preferredColorScheme(.dark)
        .task { pdfURL = writePDF() }
        .onChange(of: batch) { _, _ in pdfURL = writePDF() }
    }

    private var printButton: some View {
        Button(action: printCards) {
            Label { Text(TeacherCopy.cardsPrint) } icon: { Image(systemName: "printer.fill") }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Color.purple, in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .background(GeometryReader { geo in
            Color.clear
                .onAppear { printAnchor = geo.frame(in: .global) }
                .onChange(of: geo.frame(in: .global)) { _, f in printAnchor = f }
        })
    }

    /// The same PDF, to Files / AirDrop / Mail: the passwords can always be
    /// kept, even with no printer in reach.
    @ViewBuilder
    private var saveButton: some View {
        if let pdfURL {
            ShareLink(item: pdfURL, preview: SharePreview(Text(TeacherCopy.cardsHeading))) {
                Label { Text(TeacherCopy.cardsSavePDF) } icon: { Image(systemName: "square.and.arrow.down") }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.white.opacity(0.5)))
                    .foregroundStyle(.white)
            }
        }
    }

    /// Big on screen: the child, and their three pictures in order, as large
    /// as the sign-in pad draws them.
    private func card(_ s: TeacherNewPictures) -> some View {
        VStack(spacing: 10) {
            Text(verbatim: batch.classCode)
                .font(.system(.subheadline, design: .monospaced).bold())
                .foregroundStyle(TeacherTheme.secondaryText)
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

    private var pdfData: Data {
        SignInCardsPDF.make(
            className: batch.className, classCode: batch.classCode, students: batch.students,
            orderHint: String(appLocalized: TeacherCopy.cardsOrder))
    }

    /// A temporary file for the share sheet, removed when the cards close.
    private func writePDF() -> URL? {
        let dir = SignInCardsFiles.directory
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // Named by class id (a UUID), so two classes can never share a file.
        let safeId = batch.classId.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        let url = dir.appendingPathComponent("sign-in-cards-\(safeId.isEmpty ? "class" : safeId)").appendingPathExtension("pdf")
        do {
            try pdfData.write(to: url, options: [.atomic, .completeFileProtection])
            return url
        } catch {
            return nil
        }
    }

    private func close() {
        if let pdfURL { try? FileManager.default.removeItem(at: pdfURL) }
        onClose()
    }

    private func printCards() {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = String(appLocalized: TeacherCopy.cardsHeading)
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = pdfData
        let done: UIPrintInteractionController.CompletionHandler = { _, completed, _ in
            if completed { kept = true }
        }
        // iPad (any width, Split View included): a popover anchored to the
        // Print button, shown from the top-most presented controller (this
        // full-screen cover). iPhone: the standard sheet.
        if UIDevice.current.userInterfaceIdiom == .pad || hSize == .regular, let host = TopViewController.find() {
            let rect = host.view.convert(printAnchor, from: nil)
            controller.present(from: rect.isEmpty ? CGRect(x: host.view.bounds.midX, y: 80, width: 1, height: 1) : rect,
                               in: host.view, animated: true, completionHandler: done)
        } else {
            controller.present(animated: true, completionHandler: done)
        }
    }
}

/// The share sheet's temporary PDFs.
enum SignInCardsFiles {
    static var directory: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("signin-cards", isDirectory: true)
    }

    /// Removes every sign-in card PDF (they hold children's picture passwords).
    static func purge() {
        try? FileManager.default.removeItem(at: directory)
    }
}

enum TopViewController {
    @MainActor
    static func find() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ?? UIApplication.shared.connectedScenes.first as? UIWindowScene
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let next = top?.presentedViewController, !next.isBeingDismissed { top = next }
        return top
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
