// A class iPad: a teacher has set this device up for one of their classes,
// so when nobody is signed in the app opens straight on that class's name
// list and children never type the class code.
//
// Explicit and teacher-controlled — the opposite of the old behaviour, where
// the last class code and the last "who's signing in" choice were silently
// remembered and the next person after any sign-out landed in the class flow.
// Only a signed-in teacher can set or remove it (Classes → a class, or their
// Account). Sign-out, account deletion and a failing code never clear it:
// a teacher removes it.
//
// UserDefaults, not the Keychain: none of it is secret. The class code is
// already printed on every sign-in card in the room, and it only opens the
// name list; each child still needs their three pictures.
import Foundation
import Observation

struct ClassDevice: Codable, Equatable, Sendable {
    let classId: String
    let code: String
    /// Shown to children as the banner ("Class 3B"). Data, never translated.
    let name: String
    let setAt: Date
    let setByUserId: String

    /// What children see: the class's name, or its code for a class that
    /// has no name.
    var displayName: String { name.trimmingCharacters(in: .whitespaces).isEmpty ? code : name }
}

@Observable
@MainActor
final class ClassDeviceStore {
    static let shared = ClassDeviceStore()

    static let defaultsKey = "classDevice"
    /// Keys from the old implicit memory: the last class code typed on the
    /// class sign-in, and the last "who's signing in" door. Nothing reads
    /// them any more; they are deleted at launch so a stale value can't
    /// outlive the update.
    static let legacyKeys = ["classCode", "signInWho"]

    private let defaults: UserDefaults
    private(set) var device: ClassDevice?

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        device = Self.read(from: defaults)
    }

    /// A stored value that isn't a whole, well-formed record reads as "not
    /// set up" rather than half a class.
    static func read(from defaults: UserDefaults) -> ClassDevice? {
        guard let data = defaults.data(forKey: defaultsKey),
              let stored = try? JSONDecoder().decode(ClassDevice.self, from: data),
              isValid(stored) else { return nil }
        return stored
    }

    static func isValid(_ d: ClassDevice) -> Bool {
        // Same shape as the server's CODE_RE (lib/school/crypto.js): 6–8.
        !d.classId.isEmpty && (6...8).contains(d.code.count)
            && d.code.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }

    func isSetUp(forClass classId: String) -> Bool { device?.classId == classId }

    /// Teacher only (callers are all inside the teacher's own screens).
    /// False when the record isn't valid and nothing was saved.
    @discardableResult
    func set(classId: String, code: String, name: String, setByUserId: String) -> Bool {
        let d = ClassDevice(classId: classId, code: code.uppercased(), name: name,
                            setAt: Date(), setByUserId: setByUserId)
        guard Self.isValid(d), let data = try? JSONEncoder().encode(d) else { return false }
        defaults.set(data, forKey: Self.defaultsKey)
        device = d
        return true
    }

    /// Whether the signed-in teacher may change or remove this iPad's class:
    /// they set it up, or it's one of their own classes. Anything else is
    /// another teacher's classroom iPad.
    func canManage(userId: String?, ownClassIds: Set<String>) -> Bool {
        guard let device else { return true }
        if let userId, device.setByUserId == userId { return true }
        return ownClassIds.contains(device.classId)
    }

    func remove() {
        defaults.removeObject(forKey: Self.defaultsKey)
        device = nil
    }

    /// Launch: forget the old implicit memory (idempotent).
    static func purgeLegacyKeys(defaults: UserDefaults = .standard) {
        for key in legacyKeys { defaults.removeObject(forKey: key) }
    }
}
