// Live Activity UI for a print order: lock-screen banner + Dynamic
// Island, walking through created → printing → shipped → delivered.
// State updates come from PrintOrderActivityManager in the main app.
import ActivityKit
import SwiftUI
import WidgetKit

private struct OrderStage {
    /// Not copy — an emoji is the same in every language, so it stays a
    /// plain `String` and is rendered with `Text(verbatim:)`.
    let emoji: String
    /// Was `String`, which meant every `Text(s.label)` on the lock screen
    /// and in the Dynamic Island picked `Text`'s non-localizing
    /// initializer — none of these labels ever reached the catalog.
    let label: LocalizedStringResource
    let step: Int // 0-based of 4
}

/// `status` is the wire rawValue shared with `PrintOrderStatus` and
/// lib/print/state.js — matched, never rendered. The keys below are the
/// SAME `order.status.<rawValue>` keys the app target uses in
/// PrintOrderStatus.displayName, so the app bundle and this extension's
/// bundle name the same concepts identically. (The extension has its own
/// Bundle.main and therefore its own catalog: the keys agree, the entries
/// are separate copies.)
private func stage(for status: String) -> OrderStage {
    switch status {
    case "pending":
        return OrderStage(emoji: "🛒",
                          label: LocalizedStringResource("order.status.pending", defaultValue: "Order placed",
                                                         comment: "Live Activity stage: order created, awaiting payment"),
                          step: 0)
    case "paid":
        return OrderStage(emoji: "✅",
                          label: LocalizedStringResource("order.status.paid", defaultValue: "Payment confirmed",
                                                         comment: "Live Activity stage: payment went through"),
                          step: 0)
    case "pdf_ready":
        return OrderStage(emoji: "🖨️",
                          label: LocalizedStringResource("order.status.pdf_ready", defaultValue: "Sent to printer",
                                                         comment: "Live Activity stage: print PDF built and handed over"),
                          step: 1)
    case "submitted":
        return OrderStage(emoji: "🖨️",
                          label: LocalizedStringResource("order.status.submitted", defaultValue: "Sent to printer",
                                                         comment: "Live Activity stage: accepted by the print partner"),
                          step: 1)
    case "in_production":
        return OrderStage(emoji: "📚",
                          label: LocalizedStringResource("order.status.in_production", defaultValue: "Being printed",
                                                         comment: "Live Activity stage: the book is on the press"),
                          step: 2)
    case "shipped":
        return OrderStage(emoji: "🚚",
                          label: LocalizedStringResource("order.status.shipped", defaultValue: "On its way!",
                                                         comment: "Live Activity stage: shipped, in transit"),
                          step: 3)
    case "delivered":
        return OrderStage(emoji: "🎉",
                          label: LocalizedStringResource("order.status.delivered", defaultValue: "Delivered!",
                                                         comment: "Live Activity stage: the book arrived"),
                          step: 4)
    case "failed":
        return OrderStage(emoji: "⚠️",
                          label: LocalizedStringResource("order.status.failed", defaultValue: "Something went wrong",
                                                         comment: "Live Activity stage: the order could not be completed"),
                          step: 0)
    case "refunded":
        return OrderStage(emoji: "↩️",
                          label: LocalizedStringResource("order.status.refunded", defaultValue: "Refunded",
                                                         comment: "Live Activity stage: money returned to the customer"),
                          step: 0)
    default:
        return OrderStage(emoji: "📦",
                          label: LocalizedStringResource("order.status.unknown", defaultValue: "Processing",
                                                         comment: "Live Activity stage for a status the app doesn't recognize yet"),
                          step: 0)
    }
}

struct PrintOrderLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PrintOrderActivityAttributes.self) { context in
            lockScreen(context)
        } dynamicIsland: { context in
            let s = stage(for: context.state.status)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(verbatim: s.emoji).font(.title2)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        // The book's title is data: verbatim, never translated.
                        Text(verbatim: context.attributes.bookTitle)
                            .font(.caption.bold())
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        // The expanded centre region is narrow and the stage
                        // labels grow in Italian ("Something went wrong" ->
                        // "Si è verificato un problema"), so let it shrink
                        // rather than truncate.
                        Text(s.label)
                            .font(.caption2)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    progressBar(step: s.step)
                }
            } compactLeading: {
                Text(verbatim: s.emoji)
            } compactTrailing: {
                // Keyed so the separator can change per locale; the numbers
                // stay numbers.
                Text(LocalizedStringResource(
                    "order.live.progress",
                    defaultValue: "\(s.step)/4",
                    comment: "Compact Dynamic Island progress out of four stages, e.g. \"2/4\""))
                    .font(.caption2.bold())
            } minimal: {
                Text(verbatim: s.emoji)
            }
        }
    }

    private func lockScreen(_ context: ActivityViewContext<PrintOrderActivityAttributes>) -> some View {
        let s = stage(for: context.state.status)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(verbatim: s.emoji).font(.title2)
                VStack(alignment: .leading, spacing: 1) {
                    // One format string with the title as its argument, so a
                    // translator can move the quoted title wherever Italian
                    // wants it instead of being frozen into English order.
                    Text(LocalizedStringResource(
                        "order.live.headline",
                        defaultValue: "\"\(context.attributes.bookTitle)\" in print",
                        comment: "Live Activity lock-screen headline; %@ is the book title"))
                        .font(.subheadline.bold())
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(s.label)
                        .font(.caption)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                Spacer()
            }
            progressBar(step: s.step)
        }
        .padding(14)
        .activityBackgroundTint(Color(red: 0.13, green: 0.08, blue: 0.30))
        .activitySystemActionForegroundColor(.white)
        .foregroundStyle(.white)
    }

    private func progressBar(step: Int) -> some View {
        HStack(spacing: 4) {
            ForEach(0..<4, id: \.self) { i in
                Capsule()
                    .fill(i < step ? Color.yellow : Color.white.opacity(0.25))
                    .frame(height: 5)
            }
        }
    }
}
