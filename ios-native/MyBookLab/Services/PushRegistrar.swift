// Push alerts on this device, for a teacher only.
//
//   turnOn()            "Turn on alerts on this iPad": asks permission, then
//                       registers with APNs; the token arrives in the app
//                       delegate and is POSTed to /api/device-token.
//   registerIfAllowed() every launch / sign-in while a teacher is signed in
//                       and permission was already granted, so a rotated
//                       token (or a new teacher on a shared iPad) is picked
//                       up without asking again.
//   forget()            sign-out, BEFORE the session ends: the server drops
//                       this device for that teacher, so the next person on
//                       the iPad never gets their alerts.
//
// Students never register: every entry point checks isStudent, and the
// server rejects a class account on /api/device-token anyway.
import Foundation
import Observation
import UIKit
import UserNotifications
import os

@Observable
@MainActor
final class PushRegistrar {
    static let shared = PushRegistrar()

    private static let log = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "MyBookLab", category: "PushRegistrar"
    )
    private static let tokenKey = "apnsDeviceToken"

    enum Permission { case unknown, notDetermined, denied, authorized }

    private(set) var permission: Permission = .unknown
    /// The current token is on the server for the signed-in teacher.
    private(set) var registered = false
    private(set) var busy = false
    private(set) var failed = false

    /// Development-signed builds talk to the APNs sandbox.
    private static var apnsEnv: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    private var teacherToken: String? {
        let auth = AuthStore.shared
        return auth.isTeacher && !auth.isStudent ? auth.accessToken : nil
    }

    private var storedToken: String? {
        get { UserDefaults.standard.string(forKey: Self.tokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.tokenKey) }
    }

    func refreshPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined: permission = .notDetermined
        case .denied: permission = .denied
        case .authorized, .provisional, .ephemeral: permission = .authorized
        @unknown default: permission = .unknown
        }
    }

    func turnOn() async {
        guard teacherToken != nil else { return }
        busy = true
        failed = false
        defer { busy = false }
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            await refreshPermission()
            guard granted else { return }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            Self.log.warning("push permission failed: \(String(describing: error), privacy: .public)")
            failed = true
        }
    }

    /// Launch / sign-in: re-register silently when a teacher already said yes.
    func registerIfAllowed() async {
        guard teacherToken != nil else { return }
        await refreshPermission()
        guard permission == .authorized else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    // MARK: App delegate callbacks

    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        storedToken = hex
        guard let bearer = teacherToken else { return }
        Task {
            do {
                try await APIClient.shared.registerDeviceToken(hex, env: Self.apnsEnv, bearerToken: bearer)
                registered = true
                failed = false
            } catch {
                Self.log.warning("device-token POST failed: \(String(describing: error), privacy: .public)")
                registered = false
                failed = true
            }
        }
    }

    func didFailToRegister(_ error: Error) {
        Self.log.warning("APNs registration failed: \(String(describing: error), privacy: .public)")
        registered = false
        failed = true
    }

    // MARK: Sign-out

    /// Best effort and bounded: a dead network must never hold up signing out
    /// on a shared iPad for more than a few seconds.
    func forget() async {
        defer { registered = false }
        guard let token = storedToken, let bearer = teacherToken else { return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                try? await APIClient.shared.forgetDeviceToken(token, bearerToken: bearer)
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(5))
            }
            await group.next()
            group.cancelAll()
        }
    }
}

/// UIKit hooks SwiftUI has no equivalent for: the APNs token callbacks and
/// the notification-center delegate (foreground banners and taps).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Set before launch finishes so a tap that cold-launched the app is
        // still delivered here.
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushRegistrar.shared.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in PushRegistrar.shared.didFailToRegister(error) }
    }

    /// In the foreground: still show the banner (an urgent ask must never be
    /// swallowed because the app happened to be open), and refresh the bell.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        Task { @MainActor in await TeacherNotificationsStore.shared.load() }
        completionHandler([.banner, .list, .sound])
    }

    /// A tap: `url` (a same-origin web path) decides the screen; `kind` is
    /// the fallback. Anything unrecognised is ignored, never followed.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        let url = info["url"] as? String
        let kind = info["kind"] as? String
        Task { @MainActor in
            let route: TeacherRoute?
            if let url { route = TeacherRoute.from(pushURL: url) }
            else if kind == "help_grownup" || kind == "help_book" { route = .dashboard }
            else { route = nil }
            if let route, !AuthStore.shared.isStudent {
                TeacherStore.shared.open(route)
            }
            completionHandler()
        }
    }
}
