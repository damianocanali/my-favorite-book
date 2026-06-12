// Starts/updates the print-order Live Activity (lock screen + Dynamic
// Island). Honest limitation: there's no push infrastructure, so the
// state only advances while the app is open and polling — staleDate
// (4h) makes iOS visually mark it stale instead of showing old data as
// current, and cleanup() ends anything older than 3 days on launch.
import ActivityKit
import Foundation

@MainActor
enum PrintOrderActivityManager {
    private static let staleAfter: TimeInterval = 4 * 3600
    private static let endAfter: TimeInterval = 3 * 24 * 3600
    private static let terminalStatuses: Set<PrintOrderStatus> = [.delivered, .failed, .refunded]

    static func start(orderId: String, bookTitle: String, status: PrintOrderStatus = .paid) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // One activity per order.
        endActivities(matching: orderId)
        let attributes = PrintOrderActivityAttributes(orderId: orderId, bookTitle: bookTitle)
        _ = try? Activity.request(
            attributes: attributes,
            content: content(for: status)
        )
    }

    static func update(orderId: String, status: PrintOrderStatus) {
        Task {
            for activity in Activity<PrintOrderActivityAttributes>.activities
            where activity.attributes.orderId == orderId {
                if terminalStatuses.contains(status) {
                    await activity.end(content(for: status), dismissalPolicy: .default)
                } else if activity.content.state.status != status.rawValue {
                    await activity.update(content(for: status))
                }
            }
        }
    }

    /// Call on app launch: ends activities whose last update is ancient
    /// (the order kept moving while the app was closed).
    static func cleanup() {
        Task {
            for activity in Activity<PrintOrderActivityAttributes>.activities {
                if Date().timeIntervalSince(activity.content.state.updatedAt) > endAfter {
                    await activity.end(activity.content, dismissalPolicy: .immediate)
                }
            }
        }
    }

    private static func content(for status: PrintOrderStatus) -> ActivityContent<PrintOrderActivityAttributes.ContentState> {
        ActivityContent(
            state: .init(status: status.rawValue, updatedAt: Date()),
            staleDate: Date().addingTimeInterval(staleAfter)
        )
    }

    private static func endActivities(matching orderId: String) {
        Task {
            for activity in Activity<PrintOrderActivityAttributes>.activities
            where activity.attributes.orderId == orderId {
                await activity.end(activity.content, dismissalPolicy: .immediate)
            }
        }
    }
}
