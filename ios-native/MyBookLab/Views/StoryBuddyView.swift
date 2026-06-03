// Story Buddy chat. Friendly AI writing coach — nudges with ideas
// instead of writing for the kid. Each suggestion can be tapped to
// append to the current page in the wizard. Backed by /api/story-buddy.
import SwiftUI

struct StoryBuddyView: View {
    let currentPageText: String
    let onInsert: (String) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [Msg] = []
    @State private var input: String = ""
    @State private var sending = false
    @State private var error: String?

    struct Msg: Identifiable {
        let id = UUID()
        let role: Role
        let content: String
        enum Role { case user, buddy }
    }

    var body: some View {
        ZStack {
            CosmicBackground()
            VStack(spacing: 0) {
                header
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 12) {
                            if messages.isEmpty {
                                placeholderBubble
                            }
                            ForEach(messages) { m in
                                bubble(for: m)
                            }
                            if sending {
                                HStack {
                                    ProgressView().tint(.white)
                                    Text("Thinking…").font(.caption).foregroundStyle(.white.opacity(0.7))
                                    Spacer()
                                }
                                .padding(.horizontal)
                            }
                            if let error {
                                Text(error)
                                    .font(.footnote)
                                    .foregroundStyle(.red.opacity(0.9))
                                    .padding(.horizontal)
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                        .padding(.vertical, 12)
                    }
                    .onChange(of: messages.count) { _, _ in
                        withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                    }
                }
                inputBar
            }
        }
    }

    private var header: some View {
        HStack {
            Image(systemName: "sparkles")
                .foregroundStyle(.yellow)
            Text("Story Buddy")
                .font(.headline)
                .foregroundStyle(.white)
            Spacer()
            Button("Done") { dismiss() }.foregroundStyle(.white)
        }
        .padding()
        .background(.ultraThinMaterial)
    }

    private var placeholderBubble: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").foregroundStyle(.yellow)
                Text("Story Buddy").font(.caption).bold().foregroundStyle(.white.opacity(0.7))
            }
            Text("Hi! I help you find ideas — I never write the story for you. What's happening in your page so far? Try asking me things like:")
                .font(.subheadline)
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 6) {
                suggestion("What could happen next?")
                suggestion("Help me describe what the forest looks like")
                suggestion("What might my character feel right now?")
            }
        }
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private func suggestion(_ text: String) -> some View {
        Button {
            input = text
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb").font(.caption)
                Text(text)
                    .font(.footnote)
                    .multilineTextAlignment(.leading)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 10)
            .background(.purple.opacity(0.3), in: Capsule())
            .foregroundStyle(.white)
        }
    }

    private func bubble(for m: Msg) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if m.role == .buddy {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles").foregroundStyle(.yellow).font(.caption)
                        Text("Buddy").font(.caption).bold().foregroundStyle(.white.opacity(0.7))
                    }
                    Text(m.content)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Button {
                        onInsert(m.content)
                        dismiss()
                    } label: {
                        Label("Add to my page", systemImage: "arrow.down.doc")
                            .font(.caption)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 10)
                            .background(.purple.opacity(0.7), in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
                .padding(12)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                Spacer(minLength: 24)
            } else {
                Spacer(minLength: 24)
                Text(m.content)
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(.purple.opacity(0.7), in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(.horizontal)
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("", text: $input,
                      prompt: Text("Ask Buddy…").foregroundStyle(.white.opacity(0.5)),
                      axis: .vertical)
                .lineLimit(1...4)
                .padding(10)
                .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
            Button {
                Task { await send() }
            } label: {
                Image(systemName: "paperplane.fill")
                    .padding(12)
                    .background(.purple, in: Circle())
                    .foregroundStyle(.white)
            }
            .disabled(sending || input.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private func send() async {
        let message = input.trimmingCharacters(in: .whitespaces)
        guard !message.isEmpty, let token = auth.accessToken else { return }
        input = ""
        messages.append(Msg(role: .user, content: message))
        sending = true
        error = nil
        defer { sending = false }

        do {
            let res = try await APIClient.shared.askStoryBuddy(
                .init(message: message, context: currentPageText.isEmpty ? nil : currentPageText),
                bearerToken: token
            )
            messages.append(Msg(role: .buddy, content: res.reply))
        } catch {
            self.error = "Buddy couldn't reply. Try again?"
        }
    }
}
