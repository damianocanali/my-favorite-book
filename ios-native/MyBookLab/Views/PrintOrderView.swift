// Order a printed copy of a book. Three-step flow:
//   1. Format + quantity
//   2. Shipping address
//   3. Pay via Stripe PaymentSheet (native iOS sheet, supports Apple Pay)
//
// Once the payment intent confirms, /api/stripe-webhook flips the
// order to "paid" and the PDF worker chain takes over. We navigate
// the user to OrderDetailView which polls for status changes.
import SwiftUI
import StripePaymentSheet

struct PrintOrderView: View {
    let book: Book

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @Environment(AppRouter.self) private var router

    @State private var format: PrintFormat = .softcover
    @State private var quantity: Int = 1

    @State private var name: String = ""
    @State private var line1: String = ""
    @State private var line2: String = ""
    @State private var city: String = ""
    @State private var state: String = ""
    @State private var postalCode: String = ""
    @State private var phone: String = ""

    @State private var loading = false
    @State private var error: String?

    @State private var paymentSheet: PaymentSheet?
    @State private var paymentResult: PaymentSheetResult?
    @State private var createdOrderId: String?

    private var unitCents: Int { format == .hardcover ? 3499 : 1999 }
    private var shippingCents: Int { 499 }
    private var totalCents: Int { unitCents * quantity + shippingCents }

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    bookSummary
                    formatPicker
                    quantityStepper
                    shippingForm
                    totalRow
                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .padding(.horizontal)
                    }
                    SparkleButton(action: { Task { await placeOrder() } }) {
                        HStack {
                            if loading { ProgressView().tint(.white) }
                            Text(loading ? "Setting up payment…" : "Pay & order")
                        }
                    }
                    .disabled(loading || !canSubmit)
                    .padding(.horizontal)
                    .padding(.top, 8)
                }
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Order printed copy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .onChange(of: paymentResult) { _, result in
            handlePaymentResult(result)
        }
    }

    // MARK: - Sections

    private var bookSummary: some View {
        let raw = book.coverImage ?? ""
        let url = (raw.hasPrefix("http") || raw.hasPrefix("data:")) ? URL(string: raw) : nil
        return HStack(spacing: 12) {
            ZStack {
                Color(hex: book.colors?.cover) ?? .purple
                if let url {
                    AsyncImage(url: url) { phase in
                        if let img = phase.image { img.resizable().scaledToFill() }
                    }
                } else {
                    Text(book.characters.first?.emoji ?? book.setting?.emoji ?? "📖")
                        .font(.title)
                }
            }
            .frame(width: 56, height: 76)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(book.title).bold().foregroundStyle(.white)
                Text("by \(book.authorName)")
                    .font(.caption).foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
        }
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    private var formatPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Format")
            HStack(spacing: 10) {
                formatCard(.softcover, label: "Softcover", subtitle: "Everyday read", price: "$19.99", recommended: false)
                formatCard(.hardcover, label: "Hardcover", subtitle: "Keepsake quality", price: "$34.99", recommended: true)
            }
        }
        .padding(.horizontal)
    }

    // Hardcover surfaces with a "Recommended" badge — it's the high-margin
    // option and parents/gifters convert better when it's emphasized as
    // the keepsake choice.
    private func formatCard(_ value: PrintFormat, label: String, subtitle: String, price: String, recommended: Bool) -> some View {
        let selected = format == value
        return Button { format = value } label: {
            VStack(spacing: 4) {
                if recommended {
                    Text("⭐️ Recommended")
                        .font(.caption2.bold())
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(.yellow, in: Capsule())
                        .foregroundStyle(.black)
                }
                Text(label).bold().foregroundStyle(.white)
                Text(subtitle).font(.caption2).foregroundStyle(.white.opacity(0.6))
                Text(price).font(.caption).foregroundStyle(.white.opacity(0.85))
            }
            .frame(maxWidth: .infinity)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(selected ? Color.purple.opacity(0.45) : Color.white.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(selected ? Color.white.opacity(0.6) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    private var quantityStepper: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                sectionTitle("Quantity")
                Spacer()
                Stepper(value: $quantity, in: 1...10) {
                    Text("\(quantity)").foregroundStyle(.white)
                }
                .labelsHidden()
                Text("\(quantity)").font(.title3.bold()).foregroundStyle(.white).frame(width: 36)
            }

            // Quick-quantity gift bundles. Each chip just bumps the
            // stepper — pricing remains linear (server is the source
            // of truth) — but the framing turns "how many?" into
            // "who's this for?" which drives bigger orders.
            HStack(spacing: 8) {
                quickQtyChip(qty: 1, emoji: "1️⃣", label: "Just one")
                quickQtyChip(qty: 2, emoji: "🎁", label: "Gift pair")
                quickQtyChip(qty: 3, emoji: "👨‍👩‍👧", label: "Family pack")
                quickQtyChip(qty: 5, emoji: "🎒", label: "Class set")
            }
        }
        .padding(.horizontal)
    }

    private func quickQtyChip(qty: Int, emoji: String, label: String) -> some View {
        let selected = quantity == qty
        return Button { quantity = qty } label: {
            VStack(spacing: 2) {
                Text(emoji).font(.title3)
                Text(label).font(.caption2).foregroundStyle(.white.opacity(0.85))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(selected ? Color.purple.opacity(0.4) : Color.white.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(selected ? Color.white.opacity(0.5) : Color.clear, lineWidth: 1.2)
            )
        }
        .buttonStyle(.plain)
    }

    private var shippingForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Shipping to")
            field("Full name", text: $name)
            field("Address line 1", text: $line1)
            field("Address line 2 (optional)", text: $line2)
            HStack {
                field("City", text: $city)
                field("State", text: $state).frame(width: 90)
            }
            field("ZIP", text: $postalCode).keyboardType(.numberPad)
            field("Phone", text: $phone).keyboardType(.phonePad)
        }
        .padding(.horizontal)
    }

    private func field(_ label: String, text: Binding<String>) -> some View {
        TextField("", text: text,
                  prompt: Text(label).foregroundStyle(.white.opacity(0.4)))
            .textInputAutocapitalization(.words)
            .padding(12)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
    }

    private var totalRow: some View {
        HStack {
            Text("Total")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Spacer()
            Text(formattedTotal(totalCents))
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private func sectionTitle(_ s: String) -> some View {
        Text(s)
            .font(.caption.bold())
            .foregroundStyle(.white.opacity(0.7))
            .textCase(.uppercase)
    }

    // MARK: - Order placement

    private var canSubmit: Bool {
        !name.isEmpty && !line1.isEmpty && !city.isEmpty
            && !state.isEmpty && !postalCode.isEmpty
            && !phone.isEmpty && (auth.user?.email != nil)
    }

    private func placeOrder() async {
        guard let token = auth.accessToken,
              let email = auth.user?.email else { return }
        loading = true; error = nil
        defer { loading = false }

        do {
            let body = CreatePrintOrderRequest(
                bookId: book.id,
                format: format,
                quantity: quantity,
                shipping: ShippingAddress(
                    name: name,
                    addressLine1: line1,
                    addressLine2: line2.isEmpty ? nil : line2,
                    city: city,
                    state: state,
                    postalCode: postalCode,
                    country: "US",
                    email: email,
                    phone: phone
                )
            )
            let res = try await APIClient.shared.createPrintOrder(body, bearerToken: token)
            createdOrderId = res.orderId

            // Configure native Stripe PaymentSheet.
            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "My Book Lab"
            config.allowsDelayedPaymentMethods = false
            // Apple Pay: enable once you've added an Apple Pay merchant
            // identifier and provisioned a certificate in Stripe. Until
            // then, card-only is fine.
            // config.applePay = .init(merchantId: "merchant.com.myfavoritebook.app", merchantCountryCode: "US")

            let sheet = PaymentSheet(paymentIntentClientSecret: res.clientSecret, configuration: config)
            self.paymentSheet = sheet

            // Present the sheet from the current root window.
            guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let root = scene.windows.first?.rootViewController else { return }
            sheet.present(from: topController(root)) { result in
                self.paymentResult = result
            }
        } catch {
            self.error = "Couldn't create order: \(error.localizedDescription)"
        }
    }

    private func topController(_ vc: UIViewController) -> UIViewController {
        var top = vc
        while let presented = top.presentedViewController { top = presented }
        return top
    }

    private func handlePaymentResult(_ result: PaymentSheetResult?) {
        guard let result else { return }
        switch result {
        case .completed:
            // Order is paid. Drop the user on the order detail screen,
            // which polls Supabase for status updates as the webhook +
            // PDF worker chain runs.
            router.selectedTab = .orders
            dismiss()
        case .canceled:
            break
        case .failed(let err):
            self.error = "Payment failed: \(err.localizedDescription)"
        }
    }

    private func formattedTotal(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }
}

extension PaymentSheetResult: @retroactive Equatable {
    public static func == (lhs: PaymentSheetResult, rhs: PaymentSheetResult) -> Bool {
        switch (lhs, rhs) {
        case (.completed, .completed), (.canceled, .canceled): return true
        case (.failed, .failed): return true
        default: return false
        }
    }
}
