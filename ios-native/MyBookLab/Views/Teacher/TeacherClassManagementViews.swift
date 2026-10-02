// Creating a class and its settings, natively — no web round trip.
// Counterparts of the web's TeacherPage "Create a class" form and
// TeacherClassPage's rename / sign-in toggle / SchoolHoursEditor, over the
// same api/school/classes.js.
//
// App Store 3.1.3: a new class gets its free trial from the server. If the
// server won't make one (trial cap) or a class's licence has lapsed, the
// app says so neutrally — never a price, never a link to buy.
import SwiftUI

// MARK: - Time zones

enum TeacherTimeZones {
    /// The web's US list (SchoolHoursEditor), plus the two European zones an
    /// Italian class would need.
    static let common = [
        "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
        "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
        "Europe/Rome", "Europe/London",
    ]

    /// The device's zone first (the likely answer), then the class's current
    /// one (kept selectable even if unusual), then the common list.
    static func options(including current: String? = nil) -> [String] {
        var out: [String] = []
        for id in [TimeZone.current.identifier, current].compactMap({ $0 }) + common
        where !out.contains(id) && TimeZone(identifier: id) != nil {
            out.append(id)
        }
        return out
    }

    /// "Eastern Time — New York", in the app's language.
    static func label(_ id: String) -> String {
        let city = (id.split(separator: "/").last.map(String.init) ?? id).replacingOccurrences(of: "_", with: " ")
        guard let name = TimeZone(identifier: id)?.localizedName(for: .generic, locale: AppLanguage.locale) else { return city }
        return "\(name) — \(city)"
    }
}

// MARK: - Create a class

struct TeacherCreateClassSheet: View {
    /// Called with the new class (nil if the server didn't return one) once
    /// the teacher is done here.
    let onCreated: (TeacherClass?) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var timezone = TimeZone.current.identifier
    @State private var locale = AppLanguage.uiLanguage
    @State private var saving = false
    @State private var error: LocalizedStringResource?
    /// The class was made but has no license (trial cap, or the license write
    /// failed): it exists, but can't add children yet.
    @State private var refused: TeacherClass??
    /// This teacher already has a class that never got a license: another
    /// one would only be another inactive class.
    @State private var hasInactiveClass = false

    var body: some View {
        NavigationStack {
            Form {
                if let refused {
                    Section {
                        Label {
                            Text(TeacherCopy.classReadyNoLicense).font(.body)
                        } icon: {
                            Image(systemName: "info.circle.fill").foregroundStyle(.yellow)
                        }
                        Button {
                            onCreated(refused)
                            dismiss()
                        } label: {
                            Text(TeacherCopy.done).bold().frame(maxWidth: .infinity, minHeight: 44)
                        }
                    }
                } else {
                    Section {
                        TextField(text: $name) { Text(TeacherCopy.createNamePlaceholder) }
                            .font(.body)
                            .textInputAutocapitalization(.words)
                            .submitLabel(.done)
                            .onChange(of: name) { _, v in
                                let cut = TeacherStickers.truncated(v, max: TeacherRosterRules.classNameMax)
                                if cut != v { name = cut }
                            }
                    } header: {
                        Text(TeacherCopy.createName)
                    }

                    Section {
                        Picker(selection: $timezone) {
                            ForEach(TeacherTimeZones.options(), id: \.self) { id in
                                Text(verbatim: TeacherTimeZones.label(id)).tag(id)
                            }
                        } label: {
                            Text(TeacherCopy.createTimezone)
                        }
                        Picker(selection: $locale) {
                            ForEach(AppLanguage.supported, id: \.code) { lang in
                                Text(verbatim: lang.name).tag(lang.code)
                            }
                        } label: {
                            Text(TeacherCopy.createLanguage)
                        }
                    } footer: {
                        Text(TeacherCopy.createLanguageHint)
                    }

                    if let error {
                        Section { Text(error).foregroundStyle(TeacherTheme.urgent) }
                    }
                    if hasInactiveClass {
                        Section {
                            Label {
                                Text(TeacherCopy.alreadyInactiveClass).font(.body)
                            } icon: {
                                Image(systemName: "info.circle.fill").foregroundStyle(.yellow)
                            }
                        }
                    }

                    Section {
                        Button {
                            Task { await create() }
                        } label: {
                            HStack(spacing: 8) {
                                if saving { ProgressView() }
                                Text(saving ? TeacherCopy.createSubmitting : TeacherCopy.createSubmit).bold()
                            }
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .disabled(saving || hasInactiveClass || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    } footer: {
                        Text(TeacherCopy.createTrialNote)
                    }
                }
            }
            .navigationTitle(Text(TeacherCopy.createClass))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if refused == nil {
                        Button { dismiss() } label: { Text(TeacherCopy.cancel) }
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(saving)
        .task { await checkInactive() }
    }

    /// Best effort: if the list can't be read, the server still decides.
    private func checkInactive() async {
        guard let token = await auth.validAccessToken(),
              let classes = try? await APIClient.shared.teacherClasses(bearerToken: token) else { return }
        hasInactiveClass = classes.contains { LicenseBadgeState($0.license) == LicenseBadgeState.none }
    }

    private func create() async {
        let trimmed = TeacherStickers.truncated(
            name.trimmingCharacters(in: .whitespacesAndNewlines), max: TeacherRosterRules.classNameMax)
        guard !trimmed.isEmpty else { error = TeacherCopy.error("name_required"); return }
        // One request at a time: a double tap must never make two classes.
        // The flag is set before the token await, so a second tap can't
        // pass this guard while the first is still fetching the token.
        guard !saving, !hasInactiveClass else { return }
        saving = true
        error = nil
        defer { saving = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherCreateClass(
                name: trimmed, timezone: timezone, locale: locale, bearerToken: token)
            if res.trial_used_up == true || res.class.map({ LicenseBadgeState($0.license) == LicenseBadgeState.none }) == true {
                refused = .some(res.class)
            } else {
                onCreated(res.class)
                dismiss()
            }
        } catch {
            self.error = TeacherCopy.error(error)
        }
    }
}

// MARK: - Class settings

struct TeacherClassSettingsView: View {
    let classId: String
    /// Called after the class was permanently deleted.
    var onDeleted: () -> Void = {}

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    /// The server's copy; every "unsaved" check compares against it.
    @State private var cls: TeacherClass?
    @State private var loadError: String??
    @State private var name = ""
    @State private var signInOpen = true
    @State private var checkinsOn = true
    @State private var savingCheckins = false
    @State private var checkinsError: LocalizedStringResource?
    @State private var locale = "en"
    @State private var timezone = TimeZone.current.identifier
    @State private var hours: [SchoolDayHours] = SchoolDayHours.rows(from: nil)
    @State private var savingName = false
    @State private var savingHours = false
    /// The sign-in / language switches save one at a time.
    @State private var savingToggle = false
    @State private var nameStatus: Status?
    @State private var toggleError: LocalizedStringResource?
    @State private var hoursStatus: Status?
    @State private var confirmLeave = false
    @State private var confirmDelete = false
    @State private var deleteTyped = ""
    @State private var deletingClass = false
    @State private var deleteError: LocalizedStringResource?
    @State private var exporting = false
    @State private var exportURL: URL?
    @State private var exportError: LocalizedStringResource?

    enum Status: Equatable { case saved, failed(LocalizedStringResource) }

    private var nameDirty: Bool {
        guard let cls else { return false }
        return name.trimmingCharacters(in: .whitespacesAndNewlines) != (cls.name ?? "")
    }

    private var hoursDirty: Bool {
        guard let cls else { return false }
        return hours != SchoolDayHours.rows(from: cls.school_hours)
            || timezone != (cls.timezone ?? TimeZone.current.identifier)
    }

    private var dirty: Bool { nameDirty || hoursDirty }

    var body: some View {
        ZStack {
            CosmicBackground()
            if let cls {
                form(cls)
            } else if let loadError {
                TeacherErrorBlock(message: TeacherCopy.error(loadError)) { Task { await load() } }
                    .contentColumn()
            } else {
                TeacherLoading()
            }
        }
        .navigationTitle(Text(TeacherCopy.settingsCardTitle))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        // With unsaved edits, Back asks first (and the swipe-back is off).
        .navigationBarBackButtonHidden(dirty)
        .toolbar {
            if dirty {
                ToolbarItem(placement: .topBarLeading) {
                    Button { confirmLeave = true } label: {
                        Label { Text(TeacherCopy.back) } icon: { Image(systemName: "chevron.backward") }
                            .labelStyle(.titleAndIcon)
                    }
                }
            }
        }
        .alert(Text(TeacherCopy.unsavedTitle), isPresented: $confirmLeave) {
            Button {
                Task {
                    if nameDirty { await saveName() }
                    if hoursDirty { await saveHours() }
                    if !dirty { dismiss() }
                }
            } label: { Text(TeacherCopy.unsavedSave) }
            Button(role: .destructive) { dismiss() } label: { Text(TeacherCopy.unsavedDiscard) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        }
        // Typed-name alert, never a confirmationDialog (iPad).
        .alert(Text(TeacherCopy.deleteClassTitle(cls?.name ?? "")), isPresented: $confirmDelete) {
            TextField(text: $deleteTyped) { Text(TeacherCopy.deleteClassPrompt(cls?.name ?? "")) }
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button(role: .destructive) { Task { await deleteClass() } } label: { Text(TeacherCopy.deleteClassConfirm) }
                .disabled(!TeacherRosterRules.namesMatch(deleteTyped, cls?.name ?? ""))
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        } message: {
            Text(TeacherCopy.deleteClassBody)
        }
        .task { await load() }
        .onDisappear {
            if let exportURL { TeacherExportFile.remove(exportURL) }
            exportURL = nil
        }
    }

    private func form(_ cls: TeacherClass) -> some View {
        Form {
            Section {
                TextField(text: $name) { Text(TeacherCopy.createNamePlaceholder) }
                    .textInputAutocapitalization(.words)
                    .onChange(of: name) { _, v in
                        let cut = TeacherStickers.truncated(v, max: TeacherRosterRules.classNameMax)
                        if cut != v { name = cut }
                        nameStatus = nil
                    }
                Button {
                    Task { await saveName() }
                } label: {
                    HStack {
                        if savingName { ProgressView() }
                        Text(TeacherCopy.save).bold()
                    }
                    .frame(minHeight: 44)
                }
                .disabled(savingName || !nameDirty || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                statusLine(nameStatus)
            } header: {
                Text(TeacherCopy.settingsNameSection)
            }

            Section {
                Toggle(isOn: Binding(get: { signInOpen }, set: { v in Task { await setSignIn(v) } })) {
                    Text(TeacherCopy.settingsSignIn)
                }
                .tint(.purple)
                .disabled(savingToggle)
                Picker(selection: Binding(get: { locale }, set: { v in Task { await setLocale(v) } })) {
                    ForEach(AppLanguage.supported, id: \.code) { lang in
                        Text(verbatim: lang.name).tag(lang.code)
                    }
                } label: {
                    Text(TeacherCopy.createLanguage)
                }
                .disabled(savingToggle)
                if let toggleError { Text(toggleError).foregroundStyle(TeacherTheme.urgent) }
            } footer: {
                Text(TeacherCopy.settingsSignInHint)
            }

            // Hours and the zone they're read in are one decision, saved
            // together by one clearly-labelled button.
            Section {
                ForEach($hours) { $day in
                    dayRow($day)
                }
                Picker(selection: $timezone) {
                    ForEach(TeacherTimeZones.options(including: cls.timezone), id: \.self) { id in
                        Text(verbatim: TeacherTimeZones.label(id)).tag(id)
                    }
                } label: {
                    Text(TeacherCopy.createTimezone)
                }
                .onChange(of: timezone) { _, _ in hoursStatus = nil }
                Button {
                    Task { await saveHours() }
                } label: {
                    HStack {
                        if savingHours { ProgressView() }
                        Text(TeacherCopy.hoursSave).bold()
                    }
                    .frame(minHeight: 44)
                }
                .disabled(savingHours || !hoursDirty)
                statusLine(hoursStatus)
            } header: {
                Text(TeacherCopy.hoursHeading)
            } footer: {
                Text(TeacherCopy.hoursHint)
            }

            dataSection(cls)
        }
        .scrollContentBackground(.hidden)
        .contentColumn(maxWidth: ContentWidth.reading)
    }

    /// Data and privacy: the permanent class delete (review §7.3).
    @ViewBuilder
    private func dataSection(_ cls: TeacherClass) -> some View {
        Section {
            Toggle(isOn: Binding(get: { checkinsOn }, set: { v in Task { await setCheckins(v) } })) {
                Text(TeacherCopy.checkinsLabel)
            }
            .tint(.purple)
            .disabled(savingCheckins)
            Text(checkinsOn ? TeacherCopy.checkinsHintOn : TeacherCopy.checkinsHintOff)
                .font(.footnote).foregroundStyle(.secondary)
            if let checkinsError { Text(checkinsError).foregroundStyle(TeacherTheme.urgent) }
        } header: {
            Text(TeacherCopy.dataHeading)
        }

        Section {
            if let exportURL {
                ShareLink(item: exportURL) {
                    Label { Text(TeacherCopy.exportShare) } icon: { Image(systemName: "square.and.arrow.up") }
                        .frame(minHeight: 44)
                }
            } else {
                Button {
                    Task { await exportClass(cls) }
                } label: {
                    HStack {
                        if exporting { ProgressView() }
                        Label { Text(exporting ? TeacherCopy.exportWorking : TeacherCopy.exportButton) } icon: { Image(systemName: "arrow.down.doc") }
                    }
                    .frame(minHeight: 44)
                }
                .disabled(exporting)
            }
            if let exportError { Text(exportError).foregroundStyle(TeacherTheme.urgent) }
            Text(TeacherCopy.exportHint).font(.footnote).foregroundStyle(.secondary)
            Button(role: .destructive) {
                deleteTyped = ""
                deleteError = nil
                confirmDelete = true
            } label: {
                HStack {
                    if deletingClass { ProgressView() }
                    Label { Text(deletingClass ? TeacherCopy.deleting : TeacherCopy.deleteClassButton) } icon: { Image(systemName: "trash.fill") }
                }
                .frame(minHeight: 44)
            }
            .disabled(deletingClass)
            if let deleteError { Text(deleteError).foregroundStyle(TeacherTheme.urgent) }
        } footer: {
            Text(TeacherCopy.deleteClassHint)
        }
    }

    /// Downloads the ZIP to a temporary file for the share sheet. The file
    /// is removed when this screen goes away.
    private func exportClass(_ cls: TeacherClass) async {
        guard !exporting else { return }
        exporting = true
        exportError = nil
        defer { exporting = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let data = try await APIClient.shared.teacherExport(classId: classId, bearerToken: token)
            exportURL = try TeacherExportFile.write(data, name: cls.name ?? "class")
        } catch {
            exportError = TeacherCopy.error(error)
        }
    }

    private func deleteClass() async {
        guard let name = cls?.name, TeacherRosterRules.namesMatch(deleteTyped, name) else {
            deleteError = TeacherCopy.error("confirm_mismatch")
            return
        }
        guard !deletingClass else { return }
        deletingClass = true
        defer { deletingClass = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherDeleteClass(classId: classId, confirmName: deleteTyped, bearerToken: token)
            if res.pending == true {
                // Under way and finishing on its own: say so, stay here.
                deleteError = TeacherCopy.deletePending
            } else {
                onDeleted()
            }
        } catch {
            deleteError = TeacherCopy.error(error)
        }
    }

    /// One weekday: on/off, and when on, its start and end. Stacked so it
    /// fits a phone as well as an iPad.
    private func dayRow(_ day: Binding<SchoolDayHours>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(isOn: day.enabled) {
                Text(verbatim: Self.weekdayName(day.wrappedValue.weekday)).font(.body.weight(.semibold))
            }
            .tint(.purple)
            .onChange(of: day.wrappedValue) { _, _ in hoursStatus = nil }
            if day.wrappedValue.enabled {
                HStack(spacing: 12) {
                    DatePicker(selection: Binding(
                        get: { SchoolDayHours.date(day.wrappedValue.start) },
                        set: { day.wrappedValue.start = SchoolDayHours.hhmm($0) }
                    ), displayedComponents: .hourAndMinute) { Text(TeacherCopy.hoursStart) }
                    .labelsHidden()
                    .accessibilityLabel(Text(verbatim: "\(Self.weekdayName(day.wrappedValue.weekday)), \(String(appLocalized: TeacherCopy.hoursStart))"))
                    Text(verbatim: "–").foregroundStyle(.secondary).accessibilityHidden(true)
                    DatePicker(selection: Binding(
                        get: { SchoolDayHours.date(day.wrappedValue.end) },
                        set: { day.wrappedValue.end = SchoolDayHours.hhmm($0) }
                    ), displayedComponents: .hourAndMinute) { Text(TeacherCopy.hoursEnd) }
                    .labelsHidden()
                    .accessibilityLabel(Text(verbatim: "\(Self.weekdayName(day.wrappedValue.weekday)), \(String(appLocalized: TeacherCopy.hoursEnd))"))
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// ISO weekday (1 = Monday … 7 = Sunday) in the app's language.
    static func weekdayName(_ iso: Int) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.locale = AppLanguage.locale
        let symbols = cal.weekdaySymbols // Sunday first
        return symbols[iso % 7].capitalized(with: AppLanguage.locale)
    }

    @ViewBuilder
    private func statusLine(_ status: Status?) -> some View {
        switch status {
        case .saved: Text(TeacherCopy.settingsSaved).foregroundStyle(Color(red: 0.43, green: 0.91, blue: 0.72))
        case .failed(let msg): Text(msg).foregroundStyle(TeacherTheme.urgent)
        case nil: EmptyView()
        }
    }

    // MARK: Network
    //
    // Each save refreshes only its own fields from the server's answer, so
    // saving the name never throws away hours being edited, and vice versa.

    private func applyAll(_ c: TeacherClass) {
        cls = c
        name = c.name ?? ""
        signInOpen = c.sign_in_open ?? true
        checkinsOn = c.checkins_enabled ?? true
        locale = c.locale == "it" ? "it" : "en"
        timezone = c.timezone ?? TimeZone.current.identifier
        hours = SchoolDayHours.rows(from: c.school_hours)
    }

    private func load() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            if let c = try await APIClient.shared.teacherClasses(bearerToken: token).first(where: { $0.id == classId }) {
                // A reload never overwrites edits in progress.
                if cls == nil || !dirty { applyAll(c) } else { cls = c }
                loadError = nil
            } else {
                loadError = .some("class_not_found")
            }
        } catch {
            if cls == nil { loadError = .some((error as? APIClient.TeacherError)?.code) }
        }
    }

    private func patch(_ p: APIClient.ClassPatch) async throws -> TeacherClass? {
        guard let token = await auth.validAccessToken() else { throw APIClient.TeacherError(code: APIClient.sessionExpiredCode) }
        return try await APIClient.shared.teacherUpdateClass(p, bearerToken: token)
    }

    private func saveName() async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { nameStatus = .failed(TeacherCopy.error("name_required")); return }
        guard !savingName else { return }
        savingName = true
        defer { savingName = false }
        do {
            var p = APIClient.ClassPatch(id: classId)
            p.name = trimmed
            if let c = try await patch(p) {
                cls = c
                name = c.name ?? trimmed
            }
            nameStatus = .saved
        } catch {
            nameStatus = .failed(TeacherCopy.error(error))
        }
    }

    /// Optimistic, one at a time (the switches are disabled while a save is
    /// in flight), rolled back if the server says no.
    private func setSignIn(_ value: Bool) async {
        guard !savingToggle else { return }
        let previous = signInOpen
        signInOpen = value
        toggleError = nil
        savingToggle = true
        defer { savingToggle = false }
        do {
            var p = APIClient.ClassPatch(id: classId)
            p.sign_in_open = value
            if let c = try await patch(p) { cls = c; signInOpen = c.sign_in_open ?? value }
        } catch {
            signInOpen = previous
            toggleError = TeacherCopy.error(error)
        }
    }

    /// Optimistic like the sign-in switch, rolled back if the server says no.
    private func setCheckins(_ value: Bool) async {
        guard !savingCheckins else { return }
        let previous = checkinsOn
        checkinsOn = value
        checkinsError = nil
        savingCheckins = true
        defer { savingCheckins = false }
        do {
            var p = APIClient.ClassPatch(id: classId)
            p.checkins_enabled = value
            if let c = try await patch(p) { cls = c; checkinsOn = c.checkins_enabled ?? value }
        } catch {
            checkinsOn = previous
            checkinsError = TeacherCopy.error(error)
        }
    }

    private func setLocale(_ value: String) async {
        guard !savingToggle else { return }
        let previous = locale
        locale = value
        toggleError = nil
        savingToggle = true
        defer { savingToggle = false }
        do {
            var p = APIClient.ClassPatch(id: classId)
            p.locale = value
            if let c = try await patch(p) { cls = c; locale = c.locale == "it" ? "it" : "en" }
        } catch {
            locale = previous
            toggleError = TeacherCopy.error(error)
        }
    }

    private func saveHours() async {
        guard let payload = SchoolDayHours.payload(hours) else {
            hoursStatus = .failed(TeacherCopy.error("bad_hours"))
            return
        }
        guard !savingHours else { return }
        savingHours = true
        defer { savingHours = false }
        do {
            var p = APIClient.ClassPatch(id: classId)
            p.school_hours = payload
            p.timezone = timezone
            if let c = try await patch(p) {
                cls = c
                timezone = c.timezone ?? timezone
                hours = SchoolDayHours.rows(from: c.school_hours)
            }
            hoursStatus = .saved
        } catch {
            hoursStatus = .failed(TeacherCopy.error(error))
        }
    }
}


/// The data-export ZIP on disk, only for as long as the share sheet needs
/// it: complete file protection, a per-export folder, removed after.
enum TeacherExportFile {
    static func write(_ data: Data, name: String) throws -> URL {
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|")).joined()
            .trimmingCharacters(in: .whitespaces)
        let date = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate])
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("export-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent("\(safe.isEmpty ? "class" : safe)-\(date).zip")
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return url
    }

    static func remove(_ url: URL) {
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }
}
