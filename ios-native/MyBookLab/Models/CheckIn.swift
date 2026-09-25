// The emotional check-in, mirrored from the web implementation.
//
// The ids here MUST match src/lib/checkIn.js exactly. Nothing syncs them —
// entries never leave the device, so there is no server to disagree with — but
// the two platforms share a spec, a set of illustrations and a translation
// catalogue, and an id that drifts silently breaks all three.
//
// This is not a wellbeing feature and must never be described as one. See
// docs/superpowers/specs/2026-09-20-emotional-check-in-design.md: software
// "intended to treat" a childhood condition can qualify as a medical device
// under the EU MDR (MDCG 2019-11 Rev.1). A check-in is a product feature; an
// efficacy claim is a regulatory event.

import Foundation

enum Feeling: String, CaseIterable, Codable, Sendable, Identifiable {
    case happy, proud, tired, worried, angry, sad
    var id: String { rawValue }

    /// Colour used for this feeling's star in the constellation. Matches the
    /// `tone` field on the web's FEELINGS.
    var tone: String {
        switch self {
        case .happy:   return "gold"
        case .proud:   return "purple"
        case .tired:   return "blue"
        case .worried: return "cyan"
        case .angry:   return "pink"
        case .sad:     return "indigo"
        }
    }
}

enum Need: String, CaseIterable, Codable, Sendable, Identifiable {
    // `break` is a Swift keyword, hence the backticks; the raw value is what
    // matches the web and the asset filenames.
    case takeBreak = "break"
    case quiet
    case help
    case keepGoing = "keep_going"

    var id: String { rawValue }
}

/// One check-in. Three fields, deliberately: no free text, no book id, no page
/// id. The moment a feeling can be tied to a page, the app holds a record of
/// *what upset this child* — a heavier artefact than "how am I doing lately",
/// and one that invites the parent dashboard the spec rules out.
struct CheckInEntry: Codable, Identifiable, Sendable, Equatable {
    var id: String = UUID().uuidString
    var at: Date
    var feeling: Feeling
    /// Absent when the child closed the sheet after choosing a feeling.
    var need: Need?
}

enum CheckInLimits {
    /// Both caps apply, whichever bites first. Unbounded local storage is a
    /// real bug, and no child needs a year of history.
    static let maxEntries = 60
    static let maxAgeDays = 30
}

/// Drops anything past either cap, newest kept.
func pruneCheckIns(_ entries: [CheckInEntry], now: Date = Date()) -> [CheckInEntry] {
    let cutoff = now.addingTimeInterval(-Double(CheckInLimits.maxAgeDays) * 86_400)
    return entries
        .filter { $0.at >= cutoff }
        .sorted { $0.at > $1.at }
        .prefix(CheckInLimits.maxEntries)
        .reversed()
}
