import Foundation

enum SubscriptionPlan: String, Codable, Sendable {
    case free, family, classroom
}

enum SubscriptionStatus: String, Codable, Sendable {
    case active, canceled, pastDue = "past_due", incomplete
}

struct UserSubscription: Codable, Sendable {
    var plan: SubscriptionPlan
    var status: SubscriptionStatus
    var currentPeriodEnd: String?
    var revenuecatProductId: String?

    enum CodingKeys: String, CodingKey {
        case plan, status
        case currentPeriodEnd = "current_period_end"
        case revenuecatProductId = "revenuecat_product_id"
    }
}
