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
}
