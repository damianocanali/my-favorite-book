// One place to turn cents into money.
//
// This was copy-pasted into three views as
// `String(format: "$%.2f", Double(cents) / 100)`, which hardcodes both
// the dollar sign and US decimal punctuation. `.currency` asks the
// user's locale instead, so a customer with their phone set to French
// sees "12,99 $US" rather than a mangled "$12.99".
//
// The code stays "USD" deliberately: prices are charged in US dollars by
// Lulu, so the *currency* is fixed even though the *formatting* isn't.
import Foundation

extension Int {
    /// Formats a price given in cents, e.g. `1299.asPrice` → "$12.99".
    var asPrice: String {
        (Double(self) / 100).formatted(.currency(code: "USD"))
    }
}
