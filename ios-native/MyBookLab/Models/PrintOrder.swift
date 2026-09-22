// Mirrors the print_orders row shape returned by /api/print-orders/get.
// Status enum mirrors lib/print/state.js — keep in sync if the web side
// adds new states.
import Foundation

enum PrintFormat: String, Codable, Sendable {
    case hardcover, softcover
    case unknown

    init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = PrintFormat(rawValue: raw) ?? .unknown
    }

    /// Human-readable, translatable name for this format.
    ///
    /// The `rawValue` ("hardcover" / "softcover") is the API contract with
    /// the server and the print partner — it must never be shown to a
    /// user, capitalized or otherwise, because it can't be translated.
    /// Views render this instead.
    var displayName: LocalizedStringResource {
        switch self {
        case .hardcover:
            LocalizedStringResource("print.format.hardcover", defaultValue: "Hardcover",
                                    comment: "Print format: a book with a rigid cover")
        case .softcover:
            LocalizedStringResource("print.format.softcover", defaultValue: "Softcover",
                                    comment: "Print format: a book with a flexible paper cover")
        case .unknown:
            LocalizedStringResource("print.format.unknown", defaultValue: "Unknown",
                                    comment: "Print format the app doesn't recognize yet")
        }
    }
}

/// Print pricing, mirrored from the server so the quote the app shows
/// matches the amount Stripe charges.
///
/// SOURCE OF TRUTH: `PRICES` in lib/print/pricing.js and
/// `FLAT_SHIPPING_CENTS` in api/print-orders/create.js. The web mirrors
/// the same values in src/lib/printPricing.js. If you change a price,
/// change it in all three — a mismatch here bills the customer a
/// different amount than the one they agreed to.
enum PrintPricing {
    static let flatShippingCents = 499

    static func unitCents(for format: PrintFormat) -> Int {
        switch format {
        case .hardcover: return 3999
        case .softcover: return 1999
        case .unknown: return 1999
        }
    }

    /// "$39.99" — derived from the cents above so a display string can
    /// never drift away from the number used in the total.
    ///
    /// Formatting goes through `Int.asPrice` (see Models/PriceFormatting.swift):
    /// the currency stays USD because that is what Lulu actually bills, but
    /// the grouping and decimal separator follow the reader's locale, so an
    /// Italian device sees "39,99 USD" instead of a mangled "$39.99".
    static func priceLabel(for format: PrintFormat) -> String {
        unitCents(for: format).asPrice
    }
}

/// Print pricing, mirrored from the server so the quote the app shows
/// matches the amount Stripe charges.
///
/// SOURCE OF TRUTH: `PRICES` in lib/print/pricing.js and
/// `FLAT_SHIPPING_CENTS` in api/print-orders/create.js. The web mirrors
/// the same values in src/lib/printPricing.js. If you change a price,
/// change it in all three — a mismatch here bills the customer a
/// different amount than the one they agreed to.
enum PrintPricing {
    static let flatShippingCents = 499

    static func unitCents(for format: PrintFormat) -> Int {
        switch format {
        case .hardcover: return 3999
        case .softcover: return 1999
        case .unknown: return 1999
        }
    }

    /// "$39.99" — derived from the cents above so a display string can
    /// never drift away from the number used in the total.
    static func priceLabel(for format: PrintFormat) -> String {
        let cents = unitCents(for: format)
        return String(format: "$%.2f", Double(cents) / 100)
    }
}

enum PrintOrderStatus: String, Codable, Sendable {
    case pending
    case paid
    case pdfReady = "pdf_ready"
    case submitted
    case inProduction = "in_production"
    case shipped
    case delivered
    case failed
    case refunded
    case unknown

    // Tolerate any status string the server might send that we don't
    // model yet — decode it as `.unknown` instead of throwing and
    // dropping the whole order.
    init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        self = PrintOrderStatus(rawValue: raw) ?? .unknown
    }

    /// The label a customer sees for this status.
    ///
    /// The `rawValue` is the wire contract shared with lib/print/state.js
    /// and with the Live Activity content state — never render it. Two
    /// views used to derive their own text from it (one by capitalizing
    /// the raw string, one with a hand-written switch); both now read
    /// this single translatable mapping.
    var displayName: LocalizedStringResource {
        switch self {
        case .pending:
            LocalizedStringResource("order.status.pending", defaultValue: "Waiting on payment",
                                    comment: "Print order status: payment not completed yet")
        case .paid:
            LocalizedStringResource("order.status.paid", defaultValue: "Preparing files",
                                    comment: "Print order status: paid, building the print PDF")
        case .pdfReady:
            LocalizedStringResource("order.status.pdf_ready", defaultValue: "Sent to printer",
                                    comment: "Print order status: PDF built, handed to the print partner")
        case .submitted:
            LocalizedStringResource("order.status.submitted", defaultValue: "Sent to printer",
                                    comment: "Print order status: accepted by the print partner")
        case .inProduction:
            LocalizedStringResource("order.status.in_production", defaultValue: "Printing",
                                    comment: "Print order status: the book is being printed")
        case .shipped:
            LocalizedStringResource("order.status.shipped", defaultValue: "On the way",
                                    comment: "Print order status: shipped, in transit")
        case .delivered:
            LocalizedStringResource("order.status.delivered", defaultValue: "Delivered",
                                    comment: "Print order status: arrived")
        case .failed:
            LocalizedStringResource("order.status.failed", defaultValue: "Failed",
                                    comment: "Print order status: the order could not be completed")
        case .refunded:
            LocalizedStringResource("order.status.refunded", defaultValue: "Refunded",
                                    comment: "Print order status: money returned to the customer")
        case .unknown:
            LocalizedStringResource("order.status.unknown", defaultValue: "Processing",
                                    comment: "Print order status the app doesn't recognize yet")
        }
    }
}

struct PrintOrder: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var userId: String
    var bookId: String
    var format: PrintFormat
    var quantity: Int
    var unitPriceCents: Int
    var shippingCents: Int
    var taxCents: Int
    var totalCents: Int
    var status: PrintOrderStatus
    var statusMessage: String?
    var shipName: String
    var shipAddressLine1: String
    var shipAddressLine2: String?
    var shipCity: String
    var shipState: String
    var shipPostalCode: String
    var shipCountry: String
    var shipEmail: String
    var shipPhone: String?
    var luluOrderId: String?
    var luluTrackingNumber: String?
    var luluTrackingUrl: String?
    var luluCarrier: String?
    var stripePaymentIntentId: String?
    var stripeChargeId: String?
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case bookId = "book_id"
        case format, quantity
        case unitPriceCents = "unit_price_cents"
        case shippingCents = "shipping_cents"
        case taxCents = "tax_cents"
        case totalCents = "total_cents"
        case status
        case statusMessage = "status_message"
        case shipName = "ship_name"
        case shipAddressLine1 = "ship_address_line1"
        case shipAddressLine2 = "ship_address_line2"
        case shipCity = "ship_city"
        case shipState = "ship_state"
        case shipPostalCode = "ship_postal_code"
        case shipCountry = "ship_country"
        case shipEmail = "ship_email"
        case shipPhone = "ship_phone"
        case luluOrderId = "lulu_order_id"
        case luluTrackingNumber = "lulu_tracking_number"
        case luluTrackingUrl = "lulu_tracking_url"
        case luluCarrier = "lulu_carrier"
        case stripePaymentIntentId = "stripe_payment_intent_id"
        case stripeChargeId = "stripe_charge_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // Lenient decoder — print_orders rows have evolved and some fields
    // may be null or missing on older rows. Default everything so one
    // unexpected row never drops the whole list.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func int(_ k: CodingKeys) -> Int { (try? c.decode(Int.self, forKey: k)) ?? 0 }
        func str(_ k: CodingKeys) -> String { (try? c.decode(String.self, forKey: k)) ?? "" }
        func optStr(_ k: CodingKeys) -> String? { try? c.decode(String.self, forKey: k) }

        self.id = str(.id)
        self.userId = str(.userId)
        self.bookId = str(.bookId)
        self.format = (try? c.decode(PrintFormat.self, forKey: .format)) ?? .unknown
        self.quantity = int(.quantity)
        self.unitPriceCents = int(.unitPriceCents)
        self.shippingCents = int(.shippingCents)
        self.taxCents = int(.taxCents)
        self.totalCents = int(.totalCents)
        self.status = (try? c.decode(PrintOrderStatus.self, forKey: .status)) ?? .unknown
        self.statusMessage = optStr(.statusMessage)
        self.shipName = str(.shipName)
        self.shipAddressLine1 = str(.shipAddressLine1)
        self.shipAddressLine2 = optStr(.shipAddressLine2)
        self.shipCity = str(.shipCity)
        self.shipState = str(.shipState)
        self.shipPostalCode = str(.shipPostalCode)
        self.shipCountry = (try? c.decode(String.self, forKey: .shipCountry)) ?? "US"
        self.shipEmail = str(.shipEmail)
        self.shipPhone = optStr(.shipPhone)
        self.luluOrderId = optStr(.luluOrderId)
        self.luluTrackingNumber = optStr(.luluTrackingNumber)
        self.luluTrackingUrl = optStr(.luluTrackingUrl)
        self.luluCarrier = optStr(.luluCarrier)
        self.stripePaymentIntentId = optStr(.stripePaymentIntentId)
        self.stripeChargeId = optStr(.stripeChargeId)
        self.createdAt = str(.createdAt)
        self.updatedAt = str(.updatedAt)
    }
}

struct ShippingAddress: Codable, Sendable {
    var name: String
    var addressLine1: String
    var addressLine2: String?
    var city: String
    var state: String
    var postalCode: String
    var country: String
    var email: String
    var phone: String?

    enum CodingKeys: String, CodingKey {
        case name
        case addressLine1 = "address_line1"
        case addressLine2 = "address_line2"
        case city, state
        case postalCode = "postal_code"
        case country, email, phone
    }
}

struct CreatePrintOrderRequest: Codable, Sendable {
    var bookId: String
    var format: PrintFormat
    var quantity: Int
    var shipping: ShippingAddress
}

struct CreatePrintOrderResponse: Codable, Sendable {
    var orderId: String
    var clientSecret: String
    var totalCents: Int
    // Sent by api/print-orders/create.js so the app configures Stripe
    // with a key in the same live/test mode as the PaymentIntent.
    // Optional so an older server that doesn't send it still decodes.
    var publishableKey: String?
}
