// Siri / Shortcuts / Spotlight actions. "Hey Siri, start a story in My
// Book Lab" opens the app on the right tab. No extension needed — App
// Intents in the main target run in-process.
import AppIntents
import Foundation

struct OpenMyBooksIntent: AppIntent {
    static let title: LocalizedStringResource = "Open My Books"
    static let description = IntentDescription("Opens your bookshelf in My Book Lab.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.selectedTab = .books
        return .result()
    }
}

struct StartNewStoryIntent: AppIntent {
    static let title: LocalizedStringResource = "Start a New Story"
    static let description = IntentDescription("Jumps straight into creating a new book.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppRouter.shared.selectedTab = .create
        return .result()
    }
}

struct MyBookLabShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenMyBooksIntent(),
            phrases: [
                "Open my books in \(.applicationName)",
                "Show my bookshelf in \(.applicationName)",
            ],
            shortTitle: "My Books",
            systemImageName: "books.vertical.fill"
        )
        AppShortcut(
            intent: StartNewStoryIntent(),
            phrases: [
                "Start a story in \(.applicationName)",
                "Create a book in \(.applicationName)",
            ],
            shortTitle: "New Story",
            systemImageName: "plus.circle.fill"
        )
    }
}
