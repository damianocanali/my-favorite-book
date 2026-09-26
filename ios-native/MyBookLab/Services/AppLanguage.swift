// The single source of truth for "what language is this app, and what
// language is this book?"
//
// These are two different questions and conflating them produces the wrong
// answer in a real case: a child in an Italian household can write a book in
// English, and an English UI can be showing a book written in Italian. The UI
// language decides the button labels; the BOOK's language decides which voice
// reads it aloud.
import Foundation

enum AppLanguage {
    /// The language the UI is actually rendering in.
    ///
    /// `Bundle.main.preferredLocalizations.first` — NOT `Locale.current`.
    /// Locale.current follows the device REGION, so an Italian-region device
    /// running the app in English reports "it" and we would read English text
    /// with an Italian voice. preferredLocalizations reports what the bundle
    /// actually resolved to, which is the question being asked.

    /// Languages the app ships, each named in its own language — the way a
    /// language menu should read, so someone who can't read the current UI
    /// can still find theirs.
    static let supported: [(code: String, name: String)] = [("en", "English"), ("it", "Italiano")]

    /// Choose the app's language, independent of the phone's.
    ///
    /// iOS reads AppleLanguages from the app's own defaults at launch, so this
    /// takes effect the next time the app starts — and an app may not restart
    /// itself, so the caller has to say so. It is the per-app override: it
    /// works on an English-only phone, where iOS hides the Settings > App >
    /// Language row entirely, which is why there was previously no way to
    /// reach Italian at all.
    static func choose(_ code: String) {
        UserDefaults.standard.set([code], forKey: "AppleLanguages")
    }

    static var uiLanguage: String {
        Bundle.main.preferredLocalizations.first ?? "en"
    }

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
