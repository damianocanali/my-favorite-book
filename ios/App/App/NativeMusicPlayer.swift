import AVFoundation

class NativeMusicPlayer {
    static let shared = NativeMusicPlayer()
    private var player: AVAudioPlayer?
    private var currentTrack: String?
    private var isMuted = false
    private let volume: Float = 0.25

    private init() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .ambient,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {}
    }

    func play(track: String, muted: Bool) {
        isMuted = muted

        // Don't restart if same track is already playing
        if currentTrack == track, let p = player, p.isPlaying { return }

        guard let url = Bundle.main.url(forResource: track, withExtension: "mp3", subdirectory: "public/audio") else {
            return
        }

        do {
            player?.stop()
            player = try AVAudioPlayer(contentsOf: url)
            player?.numberOfLoops = -1 // infinite loop
            player?.volume = muted ? 0 : volume
            player?.prepareToPlay()
            player?.play()
            currentTrack = track
        } catch {}
    }

    func setMuted(_ muted: Bool) {
        isMuted = muted
        if muted {
            player?.setVolume(0, fadeDuration: 0.5)
        } else {
            player?.setVolume(volume, fadeDuration: 0.5)
        }
    }

    func pause() {
        player?.pause()
    }

    func resume() {
        if let p = player, !p.isPlaying, !isMuted {
            p.play()
        }
    }
}
