// The single source of truth for "what language is this app, and what
// language is this book?"
//
// These are two different questions and conflating them produces the wrong
// answer in a real case: a child in an Italian household can write a book in
// English, and an English UI can be showing a book written in Italian. The UI
// language decides the button labels; the BOOK's language decides which voice
// reads it aloud.
//
// Switching language is live — no restart (an app may not restart itself,
// and "close the app and open it again" is a poor thing to ask a teacher or a
// child). Every way a string gets localized follows the choice:
//   - SwiftUI Text / Label / titles (LocalizedStringKey, LocalizedStringResource):
//     the app root injects `.environment(\.locale, …)` and is rebuilt with
//     `.id(code)` when it changes (MyBookLabApp);
//   - code-side lookups (TeacherCopy strings read as a String, accessibility
//     sentences, spoken text): `String(appLocalized:)` below, which resolves a
//     LocalizedStringResource in the chosen locale. Never `String(localized:)`
//     directly — that follows the launch language;
//   - anything that asks Bundle.main itself (NSLocalizedString, UIKit): Bundle.main
//     is re-classed at launch so its lookups read the chosen .lproj.
// AppleLanguages is still written, so system-provided strings (share sheet,
// permission prompts) match on the next launch.
import Foundation
import Observation
import ObjectiveC

enum AppLanguage {
    private static let choiceKey = "appLanguage"

    /// Languages the app ships, each named in its own language — the way a
    /// language menu should read, so someone who can't read the current UI
    /// can still find theirs.
    static let supported: [(code: String, name: String)] = [("en", "English"), ("it", "Italiano")]

    private static func isSupported(_ code: String) -> Bool {
        supported.contains { $0.code == code }
    }

    /// Call once, first thing at launch, before any string is looked up.
    static func bootstrap() {
        object_setClass(Bundle.main, AppLocalizedMainBundle.self)
        LocalizedBundleBox.set(code: uiLanguage)
    }

    /// Choose the app's language, independent of the phone's. Takes effect
    /// at once: the lookup bundle switches here and the root view (which
    /// observes AppLanguageState) rebuilds in the new locale.
    ///
    /// Also the per-app override iOS itself reads at launch: it works on an
    /// English-only phone, where iOS hides the Settings > App > Language row
    /// entirely.
    @MainActor
    static func choose(_ code: String) {
        guard isSupported(code) else { return }
        UserDefaults.standard.set(code, forKey: choiceKey)
        UserDefaults.standard.set([code], forKey: "AppleLanguages")
        LocalizedBundleBox.set(code: code)
        AppLanguageState.shared.code = code
    }

    /// The language the UI is rendering in: the in-app choice if one was
    /// made, else what the bundle resolved to at launch.
    ///
    /// `Bundle.main.preferredLocalizations.first` — NOT `Locale.current`.
    /// Locale.current follows the device REGION, so an Italian-region device
    /// running the app in English reports "it" and we would read English text
    /// with an Italian voice. preferredLocalizations reports what the bundle
    /// actually resolved to, which is the question being asked.
    static var uiLanguage: String {
        if let chosen = UserDefaults.standard.string(forKey: choiceKey), isSupported(chosen) {
            return chosen
        }
        let resolved = String((Bundle.main.preferredLocalizations.first ?? "en").prefix(2))
        return isSupported(resolved) ? resolved : "en"
    }

    /// The locale every lookup and formatter in the UI uses.
    static var locale: Locale { Locale(identifier: uiLanguage) }

    /// Locale tag to send to the AI endpoints so Story Buddy replies in the
    /// child's language. Just the base language — the server only branches on
    /// that, and sending "it-CH" would make its lookup miss.
    static var apiLocale: String {
        String(uiLanguage.prefix(2))
    }

    /// Which language to SPEAK a given book in.
    ///
    /// Books created from 2.1 onward record the language they were written in.
    /// Older books have no such field, so fall back to the UI language — which
    /// is what the child was using when they wrote it, and therefore the best
    /// guess available.
    static func speechLanguage(for bookLanguage: String?) -> String {
        let tag = bookLanguage?.trimmingCharacters(in: .whitespaces)
        if let tag, !tag.isEmpty { return tag }
        return uiLanguage
    }
}

/// What the app root observes: changing `code` rebuilds the whole view tree
/// in the new locale.
@Observable
@MainActor
final class AppLanguageState {
    static let shared = AppLanguageState()
    var code: String = AppLanguage.uiLanguage
    var locale: Locale { Locale(identifier: code) }
    private init() {}
}

/// The chosen .lproj, readable from any thread (Bundle lookups happen off the
/// main actor too).
private enum LocalizedBundleBox {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var bundle: Bundle?

    static func set(code: String) {
        let path = Bundle.main.path(forResource: code, ofType: "lproj")
        let b = path.flatMap { Bundle(path: $0) }
        lock.lock(); bundle = b; lock.unlock()
    }

    static var current: Bundle? {
        lock.lock(); defer { lock.unlock() }
        return bundle
    }
}

/// Bundle.main's class after bootstrap(): string lookups read the chosen
/// language's .lproj (strings + stringsdict plurals); everything else is the
/// normal main bundle.
private final class AppLocalizedMainBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let lproj = LocalizedBundleBox.current {
            return lproj.localizedString(forKey: key, value: value, table: tableName)
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

extension String {
    /// A LocalizedStringResource resolved in the app's chosen language (not
    /// the launch language). Use this, never `String(localized:)`, for any
    /// app string read as a plain String.
    init(appLocalized resource: LocalizedStringResource) {
        var r = resource
        r.locale = AppLanguage.locale
        self.init(localized: r)
    }
}
