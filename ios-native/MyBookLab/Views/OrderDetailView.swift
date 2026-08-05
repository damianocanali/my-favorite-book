// Detail screen for a single print order. Polls Supabase every 30s
// while the order is in a non-terminal state so the user sees
// progress as the webhook + PDF worker + Lulu submission chain runs.
import SwiftUI
import Supabase

struct OrderDetailView: View {
    let orderId: String

    @Environment(AuthStore.self) private var auth
    @State private var order: PrintOrder?
    @State private var loading = true
    @State private var error: String?
    @State private var pollTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                if let order {
                    VStack(alignment: .leading, spacing: 18) {
                        header(order)
                        timeline(order)
                        if let trackingUrl = order.luluTrackingUrl,
                           let url = URL(string: trackingUrl) {
                            Link(destination: url) {
                                HStack {
                                    Image(systemName: "shippingbox")
                                    Text("Track package")
                                    Spacer()
                                    Image(systemName: "arrow.up.forward")
                                }
                                .foregroundStyle(.white)
                                .padding(14)
                                .background(.green.opacity(0.35), in: RoundedRectangle(cornerRadius: 14))
                            }
                            .padding(.horizontal)
                        }
                        summary(order)
                        shippingTo(order)
                    }
                    .padding(.vertical, 16)
                    .contentColumn(maxWidth: ContentWidth.form)
                } else if loading {
                    ProgressView().tint(.white)
                        .padding(.top, 40)
                } else if let error {
                    Text(error).foregroundStyle(.red.opacity(0.85))
                        .multilineTextAlignment(.center).padding(.horizontal, 32)
                }
            }
        }
        .navigationTitle("Order")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await startPolling() }
        .onDisappear { pollTask?.cancel() }
    }

    // MARK: - Sections

    private func header(_ o: PrintOrder) -> some View {
        VStack(spacing: 6) {
            Text("Order #" + String(o.id.suffix(8)).uppercased())
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
            Text(o.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                .font(.caption.bold())
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(.purple.opacity(0.35), in: Capsule())
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity)
    }

    private func timeline(_ o: PrintOrder) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            timelineStep(label: "Order placed", reached: true, current: false)
            timelineStep(label: "Payment confirmed", reached: hasReached(o, .paid), current: o.status == .paid)
            timelineStep(label: "Sent to printer", reached: hasReached(o, .submitted), current: o.status == .submitted || o.status == .pdfReady)
            timelineStep(label: "In production", reached: hasReached(o, .inProduction), current: o.status == .inProduction)
            timelineStep(label: "Shipped", reached: hasReached(o, .shipped), current: o.status == .shipped)
            timelineStep(label: "Delivered", reached: hasReached(o, .delivered), current: o.status == .delivered, last: true)
        }
        .padding(16)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private func timelineStep(label: String, reached: Bool, current: Bool, last: Bool = false) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(reached ? Color.purple : Color.white.opacity(0.15))
                        .frame(width: 18, height: 18)
                    if current {
                        Circle().stroke(.white, lineWidth: 2)
                            .frame(width: 26, height: 26)
                    }
                }
                if !last {
                    Rectangle()
                        .fill(reached ? Color.purple.opacity(0.6) : Color.white.opacity(0.12))
                        .frame(width: 2, height: 28)
                }
            }
            Text(label)
                .foregroundStyle(reached ? .white : .white.opacity(0.6))
                .padding(.bottom, 14)
                .padding(.top, -2)
            Spacer()
        }
    }

    private func hasReached(_ o: PrintOrder, _ status: PrintOrderStatus) -> Bool {
        rank(of: o.status) >= rank(of: status)
    }

    private func rank(of status: PrintOrderStatus) -> Int {
        switch status {
        case .pending: return 0
        case .paid: return 1
        case .pdfReady: return 2
        case .submitted: return 3
        case .inProduction: return 4
        case .shipped: return 5
        case .delivered: return 6
        case .failed, .refunded, .unknown: return 0
        }
    }

    private func summary(_ o: PrintOrder) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader("Summary")
            row("Format", "\(o.format.rawValue.capitalized) × \(o.quantity)")
            row("Subtotal", (o.unitPriceCents * o.quantity).asPrice)
            row("Shipping", (o.shippingCents).asPrice)
            Divider().background(.white.opacity(0.15))
            row("Total", (o.totalCents).asPrice, emphasized: true)
        }
        .padding(16)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private func shippingTo(_ o: PrintOrder) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeader("Shipping to")
            Text(o.shipName).bold().foregroundStyle(.white)
            Text(o.shipAddressLine1).foregroundStyle(.white.opacity(0.85))
            if let line2 = o.shipAddressLine2, !line2.isEmpty {
                Text(line2).foregroundStyle(.white.opacity(0.85))
            }
            Text("\(o.shipCity), \(o.shipState) \(o.shipPostalCode)")
                .foregroundStyle(.white.opacity(0.85))
            Text(o.shipEmail).font(.caption).foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private func sectionHeader(_ s: String) -> some View {
        Text(s).font(.caption.bold()).foregroundStyle(.white.opacity(0.7)).textCase(.uppercase)
    }

    private func row(_ label: String, _ value: String, emphasized: Bool = false) -> some View {
        HStack {
            Text(label).foregroundStyle(.white.opacity(0.75))
            Spacer()
            Text(value)
                .foregroundStyle(.white)
                .fontWeight(emphasized ? .bold : .regular)
        }
    }

    // MARK: - Polling

    private func startPolling() async {
        pollTask?.cancel()
        pollTask = Task {
            await fetchOnce()
            // Poll while the order is in a non-terminal state.
            while !Task.isCancelled, let o = self.order,
                  ![PrintOrderStatus.delivered, .failed, .refunded].contains(o.status) {
                try? await Task.sleep(for: .seconds(30))
                if Task.isCancelled { break }
                await fetchOnce()
            }
        }
    }

    private func fetchOnce() async {
        do {
            let row: PrintOrder = try await AuthStore.shared.supabase
                .from("print_orders")
                .select()
                .eq("id", value: orderId)
                .single()
                .execute()
                .value
            self.order = row
            self.error = nil
            // Keep the Live Activity in step with the freshest status
            // (ends it automatically on delivered/failed/refunded).
            PrintOrderActivityManager.update(orderId: row.id, status: row.status)
        } catch is CancellationError {
            // View went away during the request — ignore.
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Same — silently abort.
        } catch {
            // Don't blow away an existing order on a transient network blip.
            if self.order == nil { self.error = "Couldn't load this order." }
        }
        self.loading = false
    }

}
