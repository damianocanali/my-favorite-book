// First-use AI disclosure for family (consumer) accounts — App Store
// Guideline 5.1.2(i): tell the user, before it happens, that personal data
// goes to third-party AI services and get their agreement. Shown once per
// account on this device, before the family tabs are usable. Class
// (student) accounts never see it: the school's agreement covers them.
//
// What it says must stay true of the server code:
//   - Anthropic (Claude) reads the story text the child writes: Story Buddy
//     (api/story-buddy.js) AND the scene writer that describes each picture
//     (lib/imageScene.js writeScene, called by api/generate-image.js).
//   - Together AI draws from that written scene description
//     (api/generate-image.js), and receives the photo only when a parent
//     uses the photo avatar (api/generate-avatar.js; the photo isn't kept).
//   - OpenAI moderation checks text and finished pictures (api/_aiGuard.js).
import SwiftUI

enum AIDisclosure {
    private static func key(_ userId: String) -> String { "aiDisclosure.v1.\(userId)" }

    static func isAcknowledged(userId: String?, defaults: UserDefaults = .standard) -> Bool {
        guard let userId else { return true }
        return defaults.bool(forKey: key(userId))
    }

    static func acknowledge(userId: String?, defaults: UserDefaults = .standard) {
        guard let userId else { return }
        defaults.set(true, forKey: key(userId))
    }
}

struct AIDisclosureView: View {
    let onContinue: () -> Void

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(AppText("ai_disclosure.title", defaultValue: "How the AI helpers work"))
                        .font(.system(.title, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text(AppText("ai_disclosure.intro", defaultValue: "For grown-ups: My Book Lab uses outside AI services for Story Buddy and pictures. Here is what they receive."))
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.85))

                    point("text.bubble.fill",
                          AppText("ai_disclosure.story_buddy", defaultValue: "Anthropic (Claude) reads the story text your child writes, to give Story Buddy help and to describe each picture to draw."))
                    point("paintbrush.pointed.fill",
                          AppText("ai_disclosure.pictures", defaultValue: "Together AI draws the pictures from that written scene description. If you use a photo avatar, the photo you choose is also sent to Together AI to turn it into a cartoon; we don't keep the photo."))
                    point("checkmark.shield.fill",
                          AppText("ai_disclosure.safety", defaultValue: "OpenAI checks the words and every finished picture for safety."))
                    point("hand.raised.fill",
                          AppText("ai_disclosure.use", defaultValue: "These services get only what each request needs. The Privacy Policy says how long each one keeps it."))

                    Link(destination: URL(string: "https://mybooklab.app/privacy")!) {
                        Text(AppText("ai_disclosure.privacy_link", defaultValue: "Read the Privacy Policy"))
                            .underline()
                    }
                    .foregroundStyle(.white)

                    Button(action: onContinue) {
                        Text(AppText("ai_disclosure.continue", defaultValue: "I understand, continue"))
                            .font(.system(.headline, design: .rounded))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .padding(.top, 8)
                }
                .padding(24)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
        }
        .interactiveDismissDisabled()
    }

    private func point(_ symbol: String, _ text: LocalizedStringResource) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 28)
                .accessibilityHidden(true)
            Text(text)
                .font(.body)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
