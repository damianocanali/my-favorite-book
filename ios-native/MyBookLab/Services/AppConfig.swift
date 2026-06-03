// Centralized config — read once at app launch and made available
// app-wide via AppConfig.shared.
//
// The two base URLs are hardcoded here. They aren't secret, and
// piping URLs through an xcconfig is fragile: xcconfig treats "//" as
// a comment, so "https://…" gets truncated to "https:" unless you use
// awkward escaping. Hardcoding sidesteps the whole "bad URL" class of
// bugs.
//
// Only the actual secrets come from Info.plist (fed by
// Config.local.xcconfig, which is gitignored):
//   SUPABASE_ANON_KEY         — publishable anon key
//   GOOGLE_SIGN_IN_CLIENT_ID  — iOS OAuth client id
//   REVENUECAT_API_KEY        — RevenueCat iOS public key
import Foundation

struct AppConfig {
    let apiBase: URL
    let supabaseURL: URL
    let supabaseAnonKey: String
    let googleSignInClientID: String
    let revenueCatAPIKey: String

    static let shared: AppConfig = {
        let bundle = Bundle.main
        func value(_ key: String) -> String {
            (bundle.object(forInfoDictionaryKey: key) as? String) ?? ""
        }

        // Optional override: set API_BASE_HOST in Config.local.xcconfig
        // to a preview deployment host (just the hostname, no scheme —
        // e.g. "my-favorite-book-abc123.vercel.app") to point the app
        // at a Vercel Preview deployment for testing without touching
        // production. Leave it blank to use mybooklab.app.
        let overrideHost = value("API_BASE_HOST").trimmingCharacters(in: .whitespaces)
        let apiBase: URL = overrideHost.isEmpty
            ? URL(string: "https://mybooklab.app")!
            : (URL(string: "https://\(overrideHost)") ?? URL(string: "https://mybooklab.app")!)

        return AppConfig(
            apiBase: apiBase,
            supabaseURL: URL(string: "https://ydpblgmirurobwdhzbqj.supabase.co")!,
            supabaseAnonKey: value("SUPABASE_ANON_KEY"),
            googleSignInClientID: value("GOOGLE_SIGN_IN_CLIENT_ID"),
            revenueCatAPIKey: value("REVENUECAT_API_KEY")
        )
    }()
}
