// Live Activity UI for a print order: lock-screen banner + Dynamic
// Island, walking through created → printing → shipped → delivered.
// State updates come from PrintOrderActivityManager in the main app.
import ActivityKit
import SwiftUI
import WidgetKit

private struct OrderStage {
    let emoji: String
    let label: String
    let step: Int // 0-based of 4
}

private func stage(for status: String) -> OrderStage {
    switch status {
    case "pending": return OrderStage(emoji: "🛒", label: "Order placed", step: 0)
    case "paid": return OrderStage(emoji: "✅", label: "Payment confirmed", step: 0)
    case "pdf_ready", "submitted": return OrderStage(emoji: "🖨️", label: "Sent to printer", step: 1)
    case "in_production": return OrderStage(emoji: "📚", label: "Being printed", step: 2)
    case "shipped": return OrderStage(emoji: "🚚", label: "On its way!", step: 3)
    case "delivered": return OrderStage(emoji: "🎉", label: "Delivered!", step: 4)
    case "failed": return OrderStage(emoji: "⚠️", label: "Something went wrong", step: 0)
    case "refunded": return OrderStage(emoji: "↩️", label: "Refunded", step: 0)
    default: return OrderStage(emoji: "📦", label: "Processing", step: 0)
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
                    Text(s.emoji).font(.title2)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.bookTitle)
                            .font(.caption.bold())
                            .lineLimit(1)
                        Text(s.label).font(.caption2)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    progressBar(step: s.step)
                }
            } compactLeading: {
                Text(s.emoji)
            } compactTrailing: {
                Text("\(s.step)/4").font(.caption2.bold())
            } minimal: {
                Text(s.emoji)
            }
        }
    }

    private func lockScreen(_ context: ActivityViewContext<PrintOrderActivityAttributes>) -> some View {
        let s = stage(for: context.state.status)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(s.emoji).font(.title2)
                VStack(alignment: .leading, spacing: 1) {
                    Text("\"\(context.attributes.bookTitle)\" in print")
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    Text(s.label).font(.caption)
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
