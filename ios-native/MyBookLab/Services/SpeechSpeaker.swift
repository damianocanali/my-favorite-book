// Read-aloud for book pages. Lifted out of BookDetailView, which is a
// view file and shouldn't be declaring services.
//
// @MainActor matters here rather than being ceremony: AVSpeechSynthesizer
// is not thread-safe, and `synth.isSpeaking` is read-then-acted-on in
// stop(). Every caller is already a SwiftUI view, so isolating the whole
// type costs nothing and removes the race.
import AVFoundation
import Observation

@Observable
@MainActor
final class SpeechSpeaker {
    private let synth = AVSpeechSynthesizer()

    /// Speaks `text` in `language` (a BCP-47 tag like "it" or "en-US").
    ///
    /// The language argument is not a nicety. This used to hardcode "en-US",
    /// which meant Italian text was run through English grapheme-to-phoneme
    /// rules — "ciao" comes out as "kyow", "gli" as "glai", final vowels get
    /// swallowed. The result is not accented English, it is unintelligible.
    /// For the 6-8 and dyslexic end of this audience, read-aloud is how they
    /// follow their own story, so this is a correctness bug rather than
    /// polish.
    ///
    /// Pass the BOOK's language, not the UI's — see AppLanguage.
    func speak(_ text: String, language: String? = nil) {
        stop()
        let tag = language ?? AppLanguage.uiLanguage
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.45
        utterance.voice = Self.bestVoice(for: tag)
        synth.speak(utterance)
    }

    func stop() {
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }

    /// Picks the nicest installed voice for a language.
    ///
    /// Quality ranking matters for a children's app: the default compact
    /// voices are noticeably robotic, and premium/enhanced ones are often
    /// already downloaded. Matching on the language PREFIX ("it" matches
    /// "it-IT") means a book tagged just "it" still finds the Italian voice.
    ///
    /// Falls back to the system's default voice for the tag, then to the
    /// device's own preferred language — never to a silent utterance.
    static func bestVoice(for tag: String) -> AVSpeechSynthesisVoice? {
        let base = String(tag.prefix(2)).lowercased()

        let candidates = AVSpeechSynthesisVoice.speechVoices().filter {
            $0.language.lowercased().hasPrefix(base)
        }
        if !candidates.isEmpty {
            let ranked = candidates.max { a, b in
                rank(a.quality) < rank(b.quality)
            }
            if let ranked { return ranked }
        }

        return AVSpeechSynthesisVoice(language: tag)
            ?? AVSpeechSynthesisVoice(language: base)
            ?? AVSpeechSynthesisVoice(language: AppLanguage.uiLanguage)
    }

    private static func rank(_ q: AVSpeechSynthesisVoiceQuality) -> Int {
        switch q {
        case .premium: return 3
        case .enhanced: return 2
        case .default: return 1
        @unknown default: return 0
        }
    }
}
