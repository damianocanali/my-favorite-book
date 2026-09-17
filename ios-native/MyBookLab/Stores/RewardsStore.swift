// Badges + daily writing streak. Mirrors the web's useRewardsStore:
// the server is authoritative (`/api/claim-badge` credits coins exactly
// once; `/api/streak` owns the day math), this store caches what it
// learns and drives the celebratory badge popup.
import Foundation
import Observation

struct Badge: Identifiable, Equatable {
    /// Wire id. Contract with api/claim-badge.js BADGE_COINS and the
    /// web's BADGE_DEFINITIONS — never localize, never rename.
    let id: String
    let emoji: String
    /// Display text. `LocalizedStringResource` (not `String`) so the
    /// literals below are extracted into the String Catalog and so
    /// `Text(badge.label)` picks the localizing initializer.
    let label: LocalizedStringResource
    let description: LocalizedStringResource
    let coins: Int

    /// Identity is the wire id; LocalizedStringResource equality would
    /// compare resolved text, which is not what "same badge" means.
    static func == (lhs: Badge, rhs: Badge) -> Bool { lhs.id == rhs.id }
}

@Observable
@MainActor
final class RewardsStore {
    static let shared = RewardsStore()

    /// Effort-based badges — earned by completing steps, not quality.
    /// Keep ids + coin hints in sync with api/claim-badge.js BADGE_COINS
    /// and src/stores/useRewardsStore.js BADGE_DEFINITIONS.
    ///
    /// Labels avoid agent nouns ("Storyteller", "Illustrator"). English
    /// hides the problem; Italian cannot render an agent noun without
    /// choosing a gender (narratore/narratrice), and the app never learns
    /// the child's gender. Every label below is a thing or an exclamation,
    /// which any language can translate without guessing.
    static let catalog: [Badge] = [
        Badge(id: "first_page", emoji: "📝",
              label: LocalizedStringResource("badge.first_page.label", defaultValue: "First Page"),
              description: LocalizedStringResource("badge.first_page.description", defaultValue: "Wrote your first page"),
              coins: 10),
        Badge(id: "first_book", emoji: "📖",
              label: LocalizedStringResource("badge.first_book.label", defaultValue: "The End"),
              description: LocalizedStringResource("badge.first_book.description", defaultValue: "Finished your first book"),
              coins: 25),
        Badge(id: "three_books", emoji: "📚",
              label: LocalizedStringResource("badge.three_books.label", defaultValue: "Bookworm"),
              description: LocalizedStringResource("badge.three_books.description", defaultValue: "Created 3 books"),
              coins: 30),
        Badge(id: "five_books", emoji: "🏆",
              label: LocalizedStringResource("badge.five_books.label", defaultValue: "Super Shelf"),
              description: LocalizedStringResource("badge.five_books.description", defaultValue: "Created 5 books"),
              coins: 50),
        Badge(id: "ten_books", emoji: "🌟",
              label: LocalizedStringResource("badge.ten_books.label", defaultValue: "Writing Star"),
              description: LocalizedStringResource("badge.ten_books.description", defaultValue: "Created 10 books"),
              coins: 100),
        Badge(id: "used_voice", emoji: "🎤",
              label: LocalizedStringResource("badge.used_voice.label", defaultValue: "Magic Voice"),
              description: LocalizedStringResource("badge.used_voice.description", defaultValue: "Used voice input"),
              coins: 10),
        Badge(id: "used_buddy", emoji: "🤖",
              label: LocalizedStringResource("badge.used_buddy.label", defaultValue: "AI Friend"),
              description: LocalizedStringResource("badge.used_buddy.description", defaultValue: "Asked Story Buddy for help"),
              coins: 10),
        Badge(id: "submitted_class", emoji: "🏫",
              label: LocalizedStringResource("badge.submitted_class.label", defaultValue: "Class Star"),
              description: LocalizedStringResource("badge.submitted_class.description", defaultValue: "Submitted a book to class"),
              coins: 20),
        Badge(id: "added_illustration", emoji: "🎨",
              label: LocalizedStringResource("badge.added_illustration.label", defaultValue: "Picture Magic"),
              description: LocalizedStringResource("badge.added_illustration.description", defaultValue: "Generated an illustration"),
              coins: 15),
        Badge(id: "five_pages", emoji: "✍️",
              label: LocalizedStringResource("badge.five_pages.label", defaultValue: "Long Story"),
              description: LocalizedStringResource("badge.five_pages.description", defaultValue: "Wrote a 5+ page story"),
              coins: 20),
        Badge(id: "streak_3", emoji: "🔥",
              label: LocalizedStringResource("badge.streak_3.label", defaultValue: "On a Roll"),
              description: LocalizedStringResource("badge.streak_3.description", defaultValue: "Wrote 3 days in a row"),
              coins: 20),
        Badge(id: "streak_7", emoji: "⚡",
              label: LocalizedStringResource("badge.streak_7.label", defaultValue: "Week of Wonders"),
              description: LocalizedStringResource("badge.streak_7.description", defaultValue: "Wrote 7 days in a row"),
              coins: 50),
        Badge(id: "streak_30", emoji: "🌈",
              label: LocalizedStringResource("badge.streak_30.label", defaultValue: "Story Legend"),
              description: LocalizedStringResource("badge.streak_30.description", defaultValue: "Wrote 30 days in a row"),
              coins: 150),

        // Completion badges. Everything above rewards *starting* things —
        // pages written, books created, days in a row. Nothing rewarded
        // finishing one properly: publishing it, printing it, illustrating
        // it right through. These do, and they carry the biggest coin
        // values because they are the hardest things a child completes.
        Badge(id: "ten_pages", emoji: "📜",
              label: LocalizedStringResource("badge.ten_pages.label", defaultValue: "Epic Tale"),
              description: LocalizedStringResource("badge.ten_pages.description", defaultValue: "Wrote a 10-page story"),
              coins: 40),
        Badge(id: "three_illustrations", emoji: "🖼️",
              label: LocalizedStringResource("badge.three_illustrations.label", defaultValue: "Picture Book"),
              description: LocalizedStringResource("badge.three_illustrations.description", defaultValue: "Put 3 pictures in one book"),
              coins: 25),
        Badge(id: "published_book", emoji: "🌍",
              label: LocalizedStringResource("badge.published_book.label", defaultValue: "Shared It"),
              description: LocalizedStringResource("badge.published_book.description", defaultValue: "Published a book to the gallery"),
              coins: 30),
        Badge(id: "printed_book", emoji: "📦",
              label: LocalizedStringResource("badge.printed_book.label", defaultValue: "Real Book"),
              description: LocalizedStringResource("badge.printed_book.description", defaultValue: "Ordered a printed copy"),
              coins: 50),
        Badge(id: "drew_illustration", emoji: "✏️",
              label: LocalizedStringResource("badge.drew_illustration.label", defaultValue: "Own Two Hands"),
              description: LocalizedStringResource("badge.drew_illustration.description", defaultValue: "Drew your own picture"),
              coins: 25),
        Badge(id: "made_avatar", emoji: "🦸",
              label: LocalizedStringResource("badge.made_avatar.label", defaultValue: "That's Me"),
              description: LocalizedStringResource("badge.made_avatar.description", defaultValue: "Made your own avatar"),
              coins: 10),
        Badge(id: "finished_blanks", emoji: "🧩",
              label: LocalizedStringResource("badge.finished_blanks.label", defaultValue: "Puzzle Solved"),
              description: LocalizedStringResource("badge.finished_blanks.description", defaultValue: "Finished a fill-in-the-blanks story"),
              coins: 15),
    ]

    private(set) var earnedBadges: Set<String> = []
    private(set) var currentStreak: Int = 0
    private(set) var longestStreak: Int = 0
    /// Set when a badge was just credited — MainTabView shows the popup.
    var newBadge: Badge?

    private let lastTouchKey = "streak_last_touch_day"

    // MARK: - Loading

    /// Pull earned badges (direct Supabase read, select-own RLS) and the
    /// streak. Call on launch and whenever the signed-in user changes.
    func refresh() async {
        guard let token = AuthStore.shared.accessToken else {
            earnedBadges = []
            currentStreak = 0
            longestStreak = 0
            return
        }
        struct BadgeRow: Decodable { let badge_id: String }
        if let rows: [BadgeRow] = try? await AuthStore.shared.supabase
            .from("user_badges")
            .select("badge_id")
            .execute()
            .value {
            earnedBadges = Set(rows.map(\.badge_id))
        }
        if let streak = try? await APIClient.shared.getStreak(bearerToken: token) {
            currentStreak = streak.currentStreak
            longestStreak = streak.longestStreak
            SharedData.updateStreak(currentStreak)
        }
    }

    // MARK: - Streak

    /// Report "the kid wrote something today". Debounced to one server
    /// call per local day; auto-claims streak badges as thresholds pass.
    func recordWritingActivity() {
        guard let token = AuthStore.shared.accessToken else { return }
        let day = Self.localDayString()
        guard UserDefaults.standard.string(forKey: lastTouchKey) != day else { return }
        UserDefaults.standard.set(day, forKey: lastTouchKey)

        Task {
            do {
                let streak = try await APIClient.shared.touchStreak(day: day, bearerToken: token)
                currentStreak = streak.currentStreak
                longestStreak = streak.longestStreak
                SharedData.updateStreak(currentStreak)
                for (threshold, badgeId) in [(3, "streak_3"), (7, "streak_7"), (30, "streak_30")]
                where streak.currentStreak >= threshold {
                    await earn(badgeId)
                }
            } catch {
                // Let a later edit retry today.
                UserDefaults.standard.removeObject(forKey: lastTouchKey)
            }
        }
    }

    /// Local calendar day as YYYY-MM-DD — the server tolerates ±1 day
    /// around UTC, so any real timezone is fine.
    static func localDayString(now: Date = Date()) -> String {
        let fmt = DateFormatter()
        // en_US_POSIX is REQUIRED with a fixed dateFormat. Without it the
        // formatter follows the device's calendar and locale, so on a device
        // set to a Japanese or Buddhist calendar "yyyy" emits an era year
        // ("0007-09-16", "2568-09-16") and the day key sent to /api/streak is
        // garbage — every streak silently breaks. The wire format is
        // Gregorian YYYY-MM-DD and must never be localized.
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.calendar = Calendar(identifier: .gregorian)
        fmt.timeZone = TimeZone.current
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: now)
    }

    // MARK: - Badges

    /// Claim a badge. Returns true when the server actually credited
    /// (false for already-claimed, signed-out, or unknown ids).
    @discardableResult
    func earn(_ badgeId: String) async -> Bool {
        guard !earnedBadges.contains(badgeId),
              let badge = Self.catalog.first(where: { $0.id == badgeId }),
              let token = AuthStore.shared.accessToken else { return false }
        do {
            let res = try await APIClient.shared.claimBadge(badgeId: badgeId, bearerToken: token)
            earnedBadges.insert(badgeId)
            guard !res.alreadyClaimed else { return false }
            if let balance = res.balance {
                CoinsStore.shared.applyServerBalance(balance)
            }
            newBadge = badge
            return true
        } catch {
            return false
        }
    }

    /// Catalog with earned flags, for the badges grid in Account.
    var badges: [(badge: Badge, earned: Bool)] {
        Self.catalog.map { ($0, earnedBadges.contains($0.id)) }
    }
}
