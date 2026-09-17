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
