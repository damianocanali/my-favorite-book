// Lists the current user's print orders, fetched directly from
// Supabase. RLS ensures users only see their own rows. Tapping a row
// drills down to OrderDetailView for the full status timeline.
import SwiftUI
import Supabase

struct OrdersListView: View {
    @Environment(AuthStore.self) private var auth
    @State private var orders: [PrintOrder] = []
    @State private var loading = false
    // App-authored copy, so LocalizedStringResource rather than String —
    // the `Text(String)` initializer neither localizes nor is extracted.
    @State private var error: LocalizedStringResource?

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                content
            }
            .navigationTitle("Orders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .task { await load() }
            .refreshable { await load() }
            .onChange(of: auth.user?.id) { _, _ in
                Task { await load() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if !auth.isSignedIn {
            signedOutPitch
        } else if loading && orders.isEmpty {
            ProgressView().tint(.white)
        } else if let error {
            errorState(error)
        } else if orders.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(orders) { o in
                        NavigationLink {
                            OrderDetailView(orderId: o.id)
                        } label: {
                            orderCard(o)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
        }
    }

    private var signedOutPitch: some View {
        VStack(spacing: 18) {
            Text("📦").font(.system(size: 64))
            Text("Your orders")
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
            Text("Sign in to see your printed book orders.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Text("📭").font(.system(size: 64))
            Text("No orders yet").font(.title3.bold()).foregroundStyle(.white)
            Text("When you order a printed book, it'll show up here.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ msg: LocalizedStringResource) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(.red.opacity(0.8))
            Text(msg).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func orderCard(_ o: PrintOrder) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(o.shipName).bold().foregroundStyle(.white)
                Spacer()
                statusPill(o.status)
            }
            // One keyed format string with three positional arguments.
            // It used to splice a capitalized rawValue straight into the
            // sentence, which both leaked a wire value into the UI and
            // left the order of the parts frozen in English.
            Text(LocalizedStringResource(
                "orders.card.quantity_line",
                defaultValue: "\(o.quantity) × \(String(localized: o.format.displayName)) · \(o.totalCents.asPrice)",
                comment: "Order card subtitle, e.g. \"2 × Hardcover · $44.98\""))
                .font(.caption).foregroundStyle(.white.opacity(0.7))
            Text(formattedDate(o.createdAt))
                .font(.caption2).foregroundStyle(.white.opacity(0.5))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    private func statusPill(_ status: PrintOrderStatus) -> some View {
        // The label now comes from PrintOrderStatus.displayName so the
        // wording lives in one translatable place; only the colour is
        // presentation and stays here.
        Text(status.displayName)
            .font(.caption.bold())
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(pillColor(for: status).opacity(0.35), in: Capsule())
            .foregroundStyle(.white)
    }

    private func pillColor(for status: PrintOrderStatus) -> Color {
        switch status {
        case .pending: return .gray
        case .paid: return .blue
        case .pdfReady, .submitted, .inProduction: return .purple
        case .shipped, .delivered: return .green
        case .failed: return .red
        case .refunded: return .orange
        case .unknown: return .gray
        }
    }

    private func load() async {
        guard let userId = auth.user?.id.uuidString else { orders = []; return }
        loading = true; error = nil
        defer { loading = false }
        do {
            // Direct Supabase query — the SDK attaches the session, and
            // print_orders RLS allows users to read their own rows (the
            // web orders page does exactly this).
            orders = try await AuthStore.shared.supabase
                .from("print_orders")
                .select()
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .execute()
                .value
        } catch is CancellationError {
            // View disappeared mid-request — keep existing orders.
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Same.
        } catch {
            self.error = LocalizedStringResource(
                "orders.list.error.load_failed",
                defaultValue: "Couldn't load orders: \(error.localizedDescription)",
                comment: "%@ is the underlying network/server error, already localized by iOS")
        }
    }


    private func formattedDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
