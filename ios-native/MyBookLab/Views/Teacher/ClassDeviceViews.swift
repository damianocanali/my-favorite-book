// "Set up this iPad for this class" — the teacher's side of a class iPad
// (ClassDeviceStore). Lives on the class screen and in the teacher's
// Account. Only a signed-in teacher ever sees these controls.
//
// Owner-gated: a teacher may replace or remove the iPad's class only if
// they set it up or it's one of their own classes. Another teacher signing
// in on a classroom iPad sees which class it belongs to and "Ask <class>'s
// teacher to change this" — never a way to take it over.
import SwiftUI

/// The signed-in teacher's own class ids, fetched once per screen, and only
/// when the answer matters (the iPad is set up by someone else).
@MainActor
private func loadOwnClassIds(_ auth: AuthStore) async -> Set<String>? {
    guard let token = await auth.validAccessToken(),
          let classes = try? await APIClient.shared.teacherClasses(bearerToken: token)
    else { return nil }
    return Set(classes.map(\.id))
}

/// On a class's screen: set this iPad up for this class, or show that it is
/// and offer to remove it.
struct ClassDeviceCard: View {
    let classId: String
    let name: String
    let code: String?

    @Environment(AuthStore.self) private var auth
    @State private var confirmingSetup = false
    @State private var confirmingRemove = false
    /// nil until loaded (or when it failed): treated as "not yours".
    @State private var ownClassIds: Set<String>?

    private var store: ClassDeviceStore { .shared }

    /// This screen is the teacher's own class, so it counts as theirs even
    /// before the list has loaded.
    private var canManage: Bool {
        store.canManage(userId: auth.user?.id.uuidString,
                        ownClassIds: (ownClassIds ?? []).union([classId]))
    }

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 12) {
                if let device = store.device {
                    ClassDeviceStatusLine(name: device.displayName)
                }
                if let device = store.device, !canManage {
                    Text(SignInCopy.askOwner(device.displayName))
                        .font(.subheadline)
                        .foregroundStyle(TeacherTheme.secondaryText)
                } else if store.device?.classId == classId {
                    Button(role: .destructive) { confirmingRemove = true } label: {
                        Text(SignInCopy.remove)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TeacherTheme.urgent)
                            .frame(minHeight: 44)
                    }
                } else {
                    Button { confirmingSetup = true } label: {
                        Label { Text(SignInCopy.setUpThisIPad) } icon: { Image(systemName: "ipad.and.arrow.forward") }
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(.purple.opacity(0.55), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .disabled(code?.isEmpty ?? true)
                }
            }
        }
        .task(id: store.device?.classId) {
            guard let device = store.device, device.classId != classId,
                  device.setByUserId != auth.user?.id.uuidString else { return }
            ownClassIds = await loadOwnClassIds(auth)
        }
        .sheet(isPresented: $confirmingSetup) {
            ClassDeviceConfirmSheet(
                name: name.isEmpty ? (code ?? "") : name,
                replacing: store.device.flatMap { $0.classId == classId ? nil : $0.displayName },
                onConfirm: {
                    // Re-checked here: the sheet can outlive a change.
                    guard canManage, let code, let userId = auth.user?.id.uuidString else { return false }
                    return store.set(classId: classId, code: code, name: name, setByUserId: userId)
                },
                onClose: { confirmingSetup = false })
        }
        .classDeviceRemoveConfirmation(isPresented: $confirmingRemove, name: store.device?.displayName ?? name)
        // The teacher made a new code (or renamed the class): keep this iPad
        // working instead of leaving children on "isn't available".
        .onChange(of: [code ?? "", name], initial: true) { _, _ in
            guard let device = store.device, device.classId == classId,
                  let code, !code.isEmpty, code != device.code || (!name.isEmpty && name != device.name)
            else { return }
            store.set(classId: classId, code: code, name: name.isEmpty ? device.name : name,
                      setByUserId: device.setByUserId)
        }
    }
}

/// "This iPad is set up for 3B", with an iPad glyph.
struct ClassDeviceStatusLine: View {
    let name: String
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "ipad.landscape").foregroundStyle(.cyan).accessibilityHidden(true)
            Text(SignInCopy.setUpFor(name))
                .font(.headline)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// What setting up a class iPad does, in plain words, before it's done.
struct ClassDeviceConfirmSheet: View {
    let name: String
    /// The class this iPad is set up for now, if it's a different one.
    let replacing: String?
    /// Saves it; false if nothing was saved.
    var onConfirm: () -> Bool
    var onClose: () -> Void

    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Image(systemName: "ipad.and.arrow.forward")
                    .font(.system(size: 40))
                    .foregroundStyle(.cyan)
                    .accessibilityHidden(true)
                Text(SignInCopy.confirmTitle(name))
                    .font(.system(.title2, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
                Text(SignInCopy.confirmBody(name))
                    .foregroundStyle(.white.opacity(0.9))
                if let replacing {
                    Text(SignInCopy.confirmReplaces(replacing))
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.yellow)
                }
                Text(SignInCopy.confirmNote)
                    .font(.callout)
                    .foregroundStyle(TeacherTheme.secondaryText)
                if failed {
                    Text(SignInCopy.saveFailed)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(TeacherTheme.urgent)
                }
                Button {
                    if onConfirm() {
                        Haptics.celebrate()
                        onClose()
                    } else {
                        failed = true
                        AccessibilityNotification.Announcement(String(appLocalized: SignInCopy.saveFailed)).post()
                    }
                } label: {
                    Text(SignInCopy.confirmAction)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(.purple, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
                Button(action: onClose) {
                    Text(TeacherCopy.cancel)
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.85))
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .contentColumn(maxWidth: ContentWidth.form)
        }
        .background(TeacherTheme.sheetBackground.ignoresSafeArea())
        .presentationDetents([.medium, .large])
    }
}

extension View {
    /// "Remove 3B from this iPad?" → removes it.
    func classDeviceRemoveConfirmation(isPresented: Binding<Bool>, name: String) -> some View {
        alert(Text(SignInCopy.removeTitle(name)), isPresented: isPresented) {
            Button(role: .destructive) {
                ClassDeviceStore.shared.remove()
            } label: { Text(SignInCopy.remove) }
            Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
        } message: {
            Text(SignInCopy.removeBody)
        }
    }
}

/// The teacher's Account: which class this iPad is set up for (and remove
/// it, if it's theirs), or pick one of their classes to set it up.
struct ClassDeviceAccountCard: View {
    @Environment(AuthStore.self) private var auth
    @State private var picking = false
    @State private var confirmingRemove = false
    @State private var ownClassIds: Set<String>?

    private var store: ClassDeviceStore { .shared }

    private var canManage: Bool {
        store.canManage(userId: auth.user?.id.uuidString, ownClassIds: ownClassIds ?? [])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Image(systemName: "ipad.landscape").foregroundStyle(.cyan).frame(width: 24)
                    .accessibilityHidden(true)
                Text(SignInCopy.accountHeading).font(.headline).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
            }
            if let device = store.device {
                Text(SignInCopy.setUpFor(device.displayName))
                    .foregroundStyle(.white.opacity(0.9))
                if canManage {
                    Button(role: .destructive) { confirmingRemove = true } label: {
                        Text(SignInCopy.remove)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.red.opacity(0.9))
                            .frame(minHeight: 44)
                    }
                } else {
                    Text(SignInCopy.askOwner(device.displayName))
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                }
            } else {
                Text(SignInCopy.accountNone)
                    .foregroundStyle(.white.opacity(0.75))
                Button { picking = true } label: {
                    Text(SignInCopy.accountPick)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .background(.purple.opacity(0.55), in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .task(id: store.device?.classId) {
            guard let device = store.device, device.setByUserId != auth.user?.id.uuidString else { return }
            ownClassIds = await loadOwnClassIds(auth)
        }
        .sheet(isPresented: $picking) { ClassDevicePickerSheet { picking = false } }
        .classDeviceRemoveConfirmation(isPresented: $confirmingRemove, name: store.device?.displayName ?? "")
    }
}

/// The teacher's classes → the same confirm sheet as the class screen.
private struct ClassDevicePickerSheet: View {
    var onDone: () -> Void

    @Environment(AuthStore.self) private var auth
    @State private var classes: [TeacherClass]?
    @State private var failed = false
    @State private var chosen: TeacherClass?

    private var store: ClassDeviceStore { .shared }

    private var canReplace: Bool {
        store.canManage(userId: auth.user?.id.uuidString, ownClassIds: Set((classes ?? []).map(\.id)))
    }

    var body: some View {
        Group {
            if let chosen {
                ClassDeviceConfirmSheet(
                    name: (chosen.name ?? "").isEmpty ? (chosen.code ?? "") : (chosen.name ?? ""),
                    replacing: store.device.flatMap { $0.classId == chosen.id ? nil : $0.displayName },
                    onConfirm: {
                        guard canReplace, let code = chosen.code,
                              let userId = auth.user?.id.uuidString else { return false }
                        return store.set(classId: chosen.id, code: code,
                                         name: chosen.name ?? "", setByUserId: userId)
                    },
                    onClose: onDone)
            } else {
                NavigationStack {
                    list
                        .navigationTitle(Text(TeacherCopy.classSwitcher))
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button(action: onDone) { Text(TeacherCopy.cancel) }
                            }
                        }
                }
            }
        }
        .task { await load() }
    }

    @ViewBuilder private var list: some View {
        if let classes {
            let usable = classes.filter { !($0.code ?? "").isEmpty }
            if let device = store.device, !canReplace {
                // Someone else's class iPad (set up while this sheet was
                // open): no way to take it over from here.
                Text(SignInCopy.askOwner(device.displayName))
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(TeacherTheme.sheetBackground.ignoresSafeArea())
            } else if usable.isEmpty {
                Text(SignInCopy.accountNoClasses)
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(TeacherTheme.sheetBackground.ignoresSafeArea())
            } else {
                List(usable) { c in
                    Button { chosen = c } label: {
                        HStack {
                            Text(verbatim: (c.name ?? "").isEmpty ? (c.code ?? "") : (c.name ?? ""))
                                .foregroundStyle(.white)
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(TeacherTheme.secondaryText)
                        }
                        .frame(minHeight: 44)
                    }
                    .listRowBackground(TeacherTheme.cardFill)
                }
                .scrollContentBackground(.hidden)
                .background(TeacherTheme.sheetBackground.ignoresSafeArea())
            }
        } else if failed {
            TeacherErrorBlock(message: SignInCopy.loadFailed) { Task { await load() } }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(TeacherTheme.sheetBackground.ignoresSafeArea())
        } else {
            ProgressView().tint(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(TeacherTheme.sheetBackground.ignoresSafeArea())
        }
    }

    private func load() async {
        failed = false
        guard let token = await auth.validAccessToken() else { failed = true; return }
        do {
            classes = try await APIClient.shared.teacherClasses(bearerToken: token)
        } catch {
            failed = true
        }
    }
}
