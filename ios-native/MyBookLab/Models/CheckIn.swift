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
import CoreGraphics

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

extension Feeling {
    /// The word for this feeling. Same catalog keys the check-in sheet uses, so
    /// both read "Rabbia" on an Italian device — the constellation used to fall
    /// back to the raw English id for its VoiceOver label.
    var displayName: LocalizedStringResource {
        switch self {
        case .happy:   return "Happy"
        case .proud:   return "Proud"
        case .tired:   return "Tired"
        case .worried: return "Worried"
        case .angry:   return "Angry"
        case .sad:     return "Sad"
        }
    }
}

/// The feelings a child has noticed, once each, ordered by when each was last
/// noticed so the line through them ends at the most recent. Mirrors
/// constellationFeelings in src/lib/checkIn.js.
///
/// One star per FEELING, not per check-in: drawing every entry turns the sky
/// into a tally, and five angry stars is "angry: 5" with extra steps.
func constellationFeelings(_ entries: [CheckInEntry]) -> [Feeling] {
    var lastSeen: [Feeling: Date] = [:]
    for e in entries where e.at > (lastSeen[e.feeling] ?? .distantPast) {
        lastSeen[e.feeling] = e.at
    }
    return lastSeen.sorted { $0.value < $1.value }.map(\.key)
}

/// Hand-placed star positions (fractions of the panel) for one to six
/// feelings. MUST match CONSTELLATION_LAYOUTS in src/lib/checkIn.js, whose test
/// proves no word overlaps another word or star — including the longest,
/// Italian "Preoccupazione" — at the 320x200 panel shape used on both.
let constellationLayouts: [[CGPoint]] = [
    [],
    [.init(x: 0.5, y: 0.42)],
    [.init(x: 0.28, y: 0.58), .init(x: 0.72, y: 0.34)],
    [.init(x: 0.18, y: 0.6), .init(x: 0.5, y: 0.28), .init(x: 0.82, y: 0.56)],
    [.init(x: 0.14, y: 0.58), .init(x: 0.38, y: 0.26), .init(x: 0.62, y: 0.6), .init(x: 0.86, y: 0.3)],
    [.init(x: 0.22, y: 0.16), .init(x: 0.74, y: 0.3), .init(x: 0.26, y: 0.5), .init(x: 0.76, y: 0.64), .init(x: 0.24, y: 0.84)],
    [.init(x: 0.2, y: 0.14), .init(x: 0.72, y: 0.26), .init(x: 0.28, y: 0.46), .init(x: 0.8, y: 0.56), .init(x: 0.22, y: 0.8), .init(x: 0.7, y: 0.86)],
]
