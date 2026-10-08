import SwiftUI

/// Account → "Have a code from Atlas?" — for signed-in family accounts only
/// (AccountView hides it for class accounts and in teacher mode). The family
/// types the 8-character code the website showed them after they arrived
/// from Atlas Mind Academy; api/referral/redeem-code attaches the referral
/// to this account. No prices, nothing personal, results in an alert.
struct AtlasCodeCard: View {
    @Environment(AuthStore.self) private var auth
    @State private var expanded = false
    @State private var code = ""
    @State private var busy = false
    @State private var resultTitle: LocalizedStringResource?
    @State private var resultMessage: LocalizedStringResource?
    @State private var showResult = false
    @FocusState private var fieldFocused: Bool

    /// "k7m4q2" → "K7M4-Q2": uppercase, only the code alphabet's characters,
    /// at most 8, a dash after the fourth.
    static func format(_ raw: String) -> String {
        let allowed = Set("23456789ABCDEFGHJKMNPQRSTVWXYZ")
        let chars = raw.uppercased().filter { allowed.contains($0) }.prefix(8)
        let s = String(chars)
        guard s.count > 4 else { return s }
        return "\(s.prefix(4))-\(s.dropFirst(4))"
    }

    private var isComplete: Bool { code.count == 9 }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.snappy) { expanded.toggle() }
                if expanded { fieldFocused = true }
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "ticket.fill").foregroundStyle(.cyan).frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(AppText("account.atlas.row_title", defaultValue: "Have a code from Atlas?"))
                            .foregroundStyle(.white)
                        Text(AppText("account.atlas.row_subtitle", defaultValue: "Enter the code from Atlas Mind Academy"))
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(.white.opacity(0.5)).font(.caption)
                }
            }
            .buttonStyle(.plain)

            if expanded {
                Text(AppText("account.atlas.help", defaultValue: "Type the 8-character code the My Book Lab website showed you after you came from Atlas Mind Academy."))
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.75))
                TextField(text: $code, prompt: Text(verbatim: "XXXX-XXXX")) {
                    Text(AppText("account.atlas.field_label", defaultValue: "Code from Atlas"))
                }
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .keyboardType(.asciiCapable)
                .font(.system(.title3, design: .monospaced))
                .multilineTextAlignment(.center)
                .focused($fieldFocused)
                .submitLabel(.done)
                .onSubmit { if isComplete { Task { await submit() } } }
                .onChange(of: code) { _, new in
                    let formatted = Self.format(new)
                    if formatted != new { code = formatted }
                }
                .padding(12)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if busy { ProgressView() }
                        Text(AppText("account.atlas.submit", defaultValue: "Use code"))
                    }
                    .frame(maxWidth: .infinity).padding(12)
                }
                .background(.purple.opacity(isComplete ? 0.8 : 0.3), in: RoundedRectangle(cornerRadius: 12))
                .foregroundStyle(.white)
                .disabled(!isComplete || busy)
            }
        }
        .padding(16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .alert(Text(resultTitle ?? AppText("account.atlas.error_title", defaultValue: "That didn't work")),
               isPresented: $showResult) {
            Button(role: .cancel) {} label: {
                Text(AppText("account.atlas.ok", defaultValue: "OK"))
            }
        } message: {
            if let resultMessage { Text(resultMessage) }
        }
    }

    private func submit() async {
        guard isComplete, !busy else { return }
        busy = true
        defer { busy = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            try await APIClient.shared.redeemAtlasCode(code, bearerToken: token)
            Haptics.celebrate()
            resultTitle = AppText("account.atlas.success_title", defaultValue: "Code added")
            resultMessage = AppText("account.atlas.success_body", defaultValue: "Thank you! This account is now linked to your Atlas referral.")
            code = ""
            expanded = false
        } catch let APIError.http(status, body) {
            resultTitle = AppText("account.atlas.error_title", defaultValue: "That didn't work")
            resultMessage = Self.message(status: status, code: APIError.code(in: body))
        } catch {
            resultTitle = AppText("account.atlas.error_title", defaultValue: "That didn't work")
            resultMessage = AppText("account.atlas.error_generic", defaultValue: "Something went wrong. Please try again later.")
        }
        showResult = true
    }

    static func message(status: Int, code: String?) -> LocalizedStringResource {
        switch code {
        case "invalid_code":
            return AppText("account.atlas.error_invalid", defaultValue: "That code didn't work. Check it and try again.")
        case "already_referred":
            return AppText("account.atlas.error_already", defaultValue: "This account already has an Atlas referral.")
        case "rate_limited":
            return AppText("account.atlas.error_rate_limited", defaultValue: "Too many tries. Please wait a while and try again.")
        default:
            return AppText("account.atlas.error_generic", defaultValue: "Something went wrong. Please try again later.")
        }
    }
}
