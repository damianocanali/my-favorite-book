// Badges + daily writing streak. Mirrors the web's useRewardsStore:
// the server is authoritative (`/api/claim-badge` credits coins exactly
// once; `/api/streak` owns the day math), this store caches what it
// learns and drives the celebratory badge popup.
import Foundation
import Observation

struct Badge: Identifiable, Equatable {
    let id: String
    let emoji: String
    let label: String
    let description: String
    let coins: Int
}

@Observable
@MainActor
final class RewardsStore {
    static let shared = RewardsStore()

    /// Effort-based badges — earned by completing steps, not quality.
    /// Keep ids + coin hints in sync with api/claim-badge.js BADGE_COINS
    /// and src/stores/useRewardsStore.js BADGE_DEFINITIONS.
    static let catalog: [Badge] = [
        Badge(id: "first_page", emoji: "📝", label: "First Page", description: "Wrote your first page", coins: 10),
        Badge(id: "first_book", emoji: "📖", label: "Storyteller", description: "Finished your first book", coins: 25),
        Badge(id: "three_books", emoji: "📚", label: "Bookworm", description: "Created 3 books", coins: 30),
        Badge(id: "five_books", emoji: "🏆", label: "Super Author", description: "Created 5 books", coins: 50),
        Badge(id: "ten_books", emoji: "🌟", label: "Writing Star", description: "Created 10 books", coins: 100),
        Badge(id: "used_voice", emoji: "🎤", label: "Voice Writer", description: "Used voice input", coins: 10),
        Badge(id: "used_buddy", emoji: "🤖", label: "AI Friend", description: "Asked Story Buddy for help", coins: 10),
        Badge(id: "submitted_class", emoji: "🏫", label: "Class Star", description: "Submitted a book to class", coins: 20),
        Badge(id: "added_illustration", emoji: "🎨", label: "Illustrator", description: "Generated an illustration", coins: 15),
        Badge(id: "five_pages", emoji: "✍️", label: "Long Story", description: "Wrote a 5+ page story", coins: 20),
        Badge(id: "streak_3", emoji: "🔥", label: "On a Roll", description: "Wrote 3 days in a row", coins: 20),
        Badge(id: "streak_7", emoji: "⚡", label: "Week of Wonders", description: "Wrote 7 days in a row", coins: 50),
        Badge(id: "streak_30", emoji: "🌈", label: "Story Legend", description: "Wrote 30 days in a row", coins: 150),

        // Completion badges. Everything above rewards *starting* things —
        // pages written, books created, days in a row. Nothing rewarded
        // finishing one properly: publishing it, printing it, illustrating
        // it right through. These do, and they carry the biggest coin
        // values because they are the hardest things a child completes.
        Badge(id: "ten_pages", emoji: "📜", label: "Epic Tale", description: "Wrote a 10-page story", coins: 40),
        Badge(id: "three_illustrations", emoji: "🖼️", label: "Picture Book", description: "Put 3 pictures in one book", coins: 25),
        Badge(id: "published_book", emoji: "🌍", label: "Shared It", description: "Published a book to the gallery", coins: 30),
        Badge(id: "printed_book", emoji: "📦", label: "Real Book", description: "Ordered a printed copy", coins: 50),
        Badge(id: "drew_illustration", emoji: "✏️", label: "Own Two Hands", description: "Drew your own picture", coins: 25),
        Badge(id: "made_avatar", emoji: "🦸", label: "That's Me", description: "Made your own avatar", coins: 10),
        Badge(id: "finished_blanks", emoji: "🧩", label: "Puzzle Author", description: "Finished a fill-in-the-blanks story", coins: 15),
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
        fmt.calendar = Calendar.current
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
