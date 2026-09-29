// "Turn on alerts on this iPad" (Dashboard) and the teacher's notification
// settings (Account). Counterparts of the web's PushAlertsButton and
// NotificationSettings; the device side lives in Services/PushRegistrar.swift.
import SwiftUI

struct PushAlertsCard: View {
    @Environment(PushRegistrar.self) private var push
    @Environment(\.openURL) private var openURL

    private var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    var body: some View {
        Group {
            switch push.permission {
            case .authorized:
                HStack(spacing: 8) {
                    Image(systemName: "bell.badge.fill")
                    Text(isPad ? TeacherCopy.pushOnPad : TeacherCopy.pushOnPhone)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 0.43, green: 0.91, blue: 0.72))
                .frame(maxWidth: .infinity, alignment: .leading)
            case .denied:
                HStack(spacing: 10) {
                    Image(systemName: "bell.slash")
                    Text(TeacherCopy.pushBlocked)
                    Spacer(minLength: 8)
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    } label: {
                        Text(TeacherCopy.pushOpenSettings).font(.subheadline.bold())
                    }
                    .tint(.cyan)
                }
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
            case .notDetermined, .unknown:
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        Task { await push.turnOn() }
                    } label: {
                        HStack(spacing: 8) {
                            if push.busy { ProgressView().tint(.white) } else { Image(systemName: "bell.and.waves.left.and.right") }
                            Text(isPad ? TeacherCopy.pushTurnOnPad : TeacherCopy.pushTurnOnPhone)
                        }
                        .font(.subheadline.bold())
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .overlay(Capsule().strokeBorder(Color.cyan.opacity(0.6)))
                        .foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(push.busy)
                    Text(TeacherCopy.pushHint)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if push.failed {
                Text(TeacherCopy.pushError).font(.caption).foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task { await push.refreshPermission() }
        // Coming back from Settings after allowing (or blocking) alerts.
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            Task { await push.refreshPermission() }
        }
    }
}

/// Account, teachers only: the summary email and how urgent asks reach them.
/// Each change saves on its own, optimistically, and rolls back on failure.
struct TeacherNotificationSettingsCard: View {
    @Environment(AuthStore.self) private var auth
    @State private var settings: TeacherNotificationSettings?
    @State private var loadError = false
    @State private var status: Status?

    enum Status { case saved, error }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label {
                Text(TeacherCopy.settingsTitle).foregroundStyle(.white)
            } icon: {
                Image(systemName: "bell.fill").foregroundStyle(.yellow)
            }
            .font(.headline)

            if loadError {
                Text(TeacherCopy.settingsLoadError).font(.footnote).foregroundStyle(.red)
            }
            if let settings {
                VStack(alignment: .leading, spacing: 6) {
                    Text(TeacherCopy.settingsSummary).font(.caption).foregroundStyle(.white.opacity(0.65))
                    Picker(selection: Binding(
                        get: { settings.summary },
                        set: { value in Task { await save(.init(summary: value)) } }
                    )) {
                        Text(TeacherCopy.settingsDaily).tag("daily")
                        Text(TeacherCopy.settingsWeekly).tag("weekly")
                        Text(TeacherCopy.settingsOff).tag("off")
                    } label: {
                        Text(TeacherCopy.settingsSummary)
                    }
                    .pickerStyle(.segmented)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(TeacherCopy.settingsUrgent).font(.caption).foregroundStyle(.white.opacity(0.65))
                    Toggle(isOn: Binding(
                        get: { settings.push_urgent },
                        set: { value in Task { await save(.init(push_urgent: value)) } }
                    )) { Text(TeacherCopy.settingsPush).foregroundStyle(.white) }
                    .tint(.purple)
                    Toggle(isOn: Binding(
                        get: { settings.email_urgent },
                        set: { value in Task { await save(.init(email_urgent: value)) } }
                    )) { Text(TeacherCopy.settingsEmail).foregroundStyle(.white) }
                    .tint(.purple)
                }
                switch status {
                case .saved: Text(TeacherCopy.settingsSaved).font(.caption).foregroundStyle(.green)
                case .error: Text(TeacherCopy.settingsError).font(.caption).foregroundStyle(.red)
                case nil: EmptyView()
                }
                Text(TeacherCopy.needsDisclaimer).font(.caption2).foregroundStyle(.white.opacity(0.55))
            } else if !loadError {
                ProgressView().tint(.white)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .task { await load() }
    }

    private func load() async {
        guard let token = auth.accessToken else { return }
        do {
            settings = try await APIClient.shared.teacherNotificationSettings(bearerToken: token)
            loadError = false
        } catch {
            loadError = true
        }
    }

    private func save(_ patch: APIClient.NotificationSettingsPatch) async {
        guard let token = auth.accessToken, var next = settings else { return }
        let previous = settings
        if let v = patch.summary { next.summary = v }
        if let v = patch.push_urgent { next.push_urgent = v }
        if let v = patch.email_urgent { next.email_urgent = v }
        settings = next
        status = nil
        do {
            settings = try await APIClient.shared.teacherSaveNotificationSettings(patch, bearerToken: token)
            status = .saved
        } catch {
            settings = previous
            status = .error
        }
    }
}
