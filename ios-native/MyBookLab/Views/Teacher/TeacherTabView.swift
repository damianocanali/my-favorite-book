// The teacher's app: Dashboard · Classes · Account, in place of the family
// tabs. MainTabView switches to this in teacher mode (TeacherStore); on
// iPad the tab bar reads as the top tabs / sidebar, on iPhone as the usual
// bottom bar — same TabView, same appearance the family tabs set up.
//
// Owns the bell's 60 s poll, so it runs exactly while the teacher area is
// on screen and the app is active.
import SwiftUI
import UserNotifications

struct TeacherTabView: View {
    @Environment(TeacherStore.self) private var teacher
    @Environment(TeacherNotificationsStore.self) private var bell
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AudioService.self) private var audio

    var body: some View {
        @Bindable var teacher = teacher
        TabView(selection: $teacher.selectedTab) {
            TeacherDashboardView()
                .tabItem { Label { Text(TeacherCopy.tabDashboard) } icon: { Image(systemName: "rectangle.grid.2x2.fill") } }
                .tag(TeacherTab.dashboard)

            TeacherClassesView()
                .tabItem { Label { Text(TeacherCopy.tabClasses) } icon: { Image(systemName: "graduationcap.fill") } }
                .tag(TeacherTab.classes)

            AccountView()
                .tabItem { Label { Text(TeacherCopy.tabAccount) } icon: { Image(systemName: "person.crop.circle.fill") } }
                .tag(TeacherTab.account)
        }
        .tint(.white)
        // No kids' background music in the teacher area.
        .onAppear { audio.stop() }
        // Restarts on every scene-phase change and only loops while active,
        // so nothing polls from the background.
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await bell.load()
                try? await UNUserNotificationCenter.current().setBadgeCount(bell.unread)
                try? await Task.sleep(for: TeacherNotificationsStore.pollInterval)
            }
        }
    }
}

/// The slim strip over the kids' app while a teacher previews it.
struct KidsPreviewBanner: View {
    @Environment(TeacherStore.self) private var teacher

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "eye.fill").accessibilityHidden(true)
            Text(TeacherCopy.previewBanner).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 8)
            Button {
                teacher.exitKidsPreview()
            } label: {
                Text(TeacherCopy.previewBack)
                    .font(.footnote.bold())
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(.white.opacity(0.2), in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .font(.footnote)
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.purple.opacity(0.85))
    }
}
