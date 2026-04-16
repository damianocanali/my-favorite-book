#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeMusicPlugin, "NativeMusic",
    CAP_PLUGIN_METHOD(playTrack, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setMuted, CAPPluginReturnPromise);
)
