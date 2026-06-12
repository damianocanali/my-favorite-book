// Native music service. Mirrors the web's src/services/audioService.js:
// one track per "scene" (home / wizard / editor / bookshelf / gallery)
// with crossfade between them and a persistent mute toggle.
//
// Audio session is configured `.ambient`, which means:
//   - Mixes with the user's Music / podcasts (we don't kick them out)
//   - Silent switch silences us
//   - No background audio entitlement needed
//
// Tracks live in MyBookLab/Resources/audio/{key}.mp3.
import AVFoundation
import Observation

@Observable
@MainActor
final class AudioService {
    static let shared = AudioService()

    enum Track: String, CaseIterable {
        case home, wizard, editor, bookshelf, gallery
    }

    /// Short one-shot effects. Files live next to the music tracks in
    /// Resources/audio/{rawValue}.mp3 — playSFX is a silent no-op when
    /// an asset hasn't been added yet, so code can ship ahead of audio.
    enum SFX: String {
        case pageTurn = "page-turn"
        case celebrate
        case sparkle
    }

    private(set) var muted: Bool = UserDefaults.standard.bool(forKey: "music_muted")
    private(set) var currentTrack: Track?

    private var player: AVAudioPlayer?
    private var sfxPlayers: [SFX: AVAudioPlayer] = [:]
    private var fadeTimer: Timer?
    private let targetVolume: Float = 0.25
    private let sfxVolume: Float = 0.6
    private let fadeDuration: TimeInterval = 0.8

    init() {
        configureSession()
    }

    private func configureSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .ambient,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Non-fatal — audio just won't play. Don't crash the app.
        }
    }

    /// Play the given track, looping, with a crossfade from the
    /// currently-playing track. If the same track is already playing,
    /// this is a no-op.
    func play(_ track: Track) {
        if currentTrack == track && player?.isPlaying == true { return }
        currentTrack = track

        let oldPlayer = player
        let newPlayer = makePlayer(for: track)
        guard let newPlayer else { return }

        newPlayer.numberOfLoops = -1
        newPlayer.volume = 0
        newPlayer.play()

        fadeTimer?.invalidate()
        let steps = 20
        let interval = fadeDuration / Double(steps)
        var step = 0
        let endVolume = muted ? 0 : targetVolume

        fadeTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] timer in
            step += 1
            let progress = Float(step) / Float(steps)
            Task { @MainActor in
                newPlayer.volume = progress * endVolume
                oldPlayer?.volume = (1 - progress) * (oldPlayer?.volume ?? 0)
                if step >= steps {
                    timer.invalidate()
                    oldPlayer?.stop()
                    self?.fadeTimer = nil
                }
            }
        }

        player = newPlayer
    }

    func stop() {
        fadeTimer?.invalidate()
        player?.stop()
        player = nil
        currentTrack = nil
    }

    /// Play a one-shot sound effect on top of the music. Respects the
    /// single "Sounds" mute toggle (one switch for everything keeps the
    /// settings simple for kids/parents).
    func playSFX(_ sfx: SFX) {
        guard !muted else { return }
        let player = sfxPlayers[sfx] ?? makeSFXPlayer(for: sfx)
        guard let player else { return }
        sfxPlayers[sfx] = player
        player.currentTime = 0
        player.volume = sfxVolume
        player.play()
    }

    func setMuted(_ value: Bool) {
        muted = value
        UserDefaults.standard.set(value, forKey: "music_muted")
        player?.volume = value ? 0 : targetVolume
    }

    func toggleMuted() { setMuted(!muted) }

    // MARK: - Private

    private func makePlayer(for track: Track) -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: track.rawValue, withExtension: "mp3", subdirectory: "audio") else {
            // Fall back to flat layout in case the resources/audio path
            // got flattened during the build.
            guard let altURL = Bundle.main.url(forResource: track.rawValue, withExtension: "mp3") else {
                return nil
            }
            return try? AVAudioPlayer(contentsOf: altURL)
        }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.prepareToPlay()
            return p
        } catch {
            return nil
        }
    }

    private func makeSFXPlayer(for sfx: SFX) -> AVAudioPlayer? {
        let url = Bundle.main.url(forResource: sfx.rawValue, withExtension: "mp3", subdirectory: "audio")
            ?? Bundle.main.url(forResource: sfx.rawValue, withExtension: "mp3")
        guard let url, let p = try? AVAudioPlayer(contentsOf: url) else { return nil }
        p.prepareToPlay()
        return p
    }
}
