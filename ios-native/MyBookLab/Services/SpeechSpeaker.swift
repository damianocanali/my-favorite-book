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

    func speak(_ text: String) {
        stop()
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.45
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        synth.speak(utterance)
    }

    func stop() {
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }
}
