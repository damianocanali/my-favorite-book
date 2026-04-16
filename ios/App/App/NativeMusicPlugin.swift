import Capacitor
import AVFoundation

@objc(NativeMusicPlugin)
public class NativeMusicPlugin: CAPPlugin {

    public override func load() {
        // Listen for JS calls to play/stop/mute
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    @objc private func appDidBecomeActive() {
        NativeMusicPlayer.shared.resume()
    }

    @objc private func appDidEnterBackground() {
        NativeMusicPlayer.shared.pause()
    }

    @objc func playTrack(_ call: CAPPluginCall) {
        let track = call.getString("track") ?? "home"
        let muted = call.getBool("muted") ?? false
        NativeMusicPlayer.shared.play(track: track, muted: muted)
        call.resolve()
    }

    @objc func setMuted(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        NativeMusicPlayer.shared.setMuted(muted)
        call.resolve()
    }
}
