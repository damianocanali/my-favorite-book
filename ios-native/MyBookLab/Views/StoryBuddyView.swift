// Story Buddy. Kid-friendly writing helper. Two big tap buttons —
// "Give me ideas" (sentence starters) and "Help me think" (guided
// questions) — backed by /api/story-buddy's intent path. Older kids
// (author age 9+) also get a free-form "Ask your own question" chat,
// backed by the same endpoint's chat path. It nudges with ideas and
// never writes the whole story for the kid.
import SwiftUI

struct StoryBuddyView: View {
    let book: Book
    let page: BookPage
    let onInsert: (String) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    // Idea buttons
    @State private var loading = false
    @State private var error: String?
    @State private var ideas: [String] = []
    @State private var ideaKind: IdeaKind?

    // Age-gated chat
    @State private var chatRevealed = false
    @State private var messages: [Msg] = []
    @State private var input: String = ""
    @State private var sending = false

    enum IdeaKind {
        case starters, questions
        var intent: String { self == .starters ? "starters" : "questions" }
    }

    struct Msg: Identifiable {
        let id = UUID()
        let role: Role
        let content: String
        enum Role { case user, buddy }
    }

    /// Chat is offered only to older kids. Unknown/blank age stays
    /// buttons-only.
    private var allowsChat: Bool { (book.authorAge ?? 0) >= 9 }

    var body: some View {
        ZStack {
            CosmicBackground()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 16) {
                        intro
                        ideaButtons

                        if loading {
                            thinkingRow
                        }
                        if let error {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red.opacity(0.9))
                        }
                        if !ideas.isEmpty {
                            ideaResults
                        }
                        if allowsChat {
                            chatSection
                        }
                    }
                    .padding()
                    .frame(maxWidth: 640)
                    .frame(maxWidth: .infinity)
                }
                if chatRevealed {
                    inputBar
                }
            }
        }
    }

    // MARK: - Header / intro

    private var header: some View {
        HStack {
            Image(systemName: "sparkles").foregroundStyle(.yellow)
            Text("Story Buddy").font(.headline).foregroundStyle(.white)
            Spacer()
            Button("Done") { dismiss() }.foregroundStyle(.white)
        }
        .padding()
        .background(.ultraThinMaterial)
    }

    private var intro: some View {
        Text("Stuck? Tap a button and I'll help with ideas — I never write your story for you. ✨")
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.85))
            .multilineTextAlignment(.center)
            .padding(.top, 4)
    }

    // MARK: - Idea buttons

    private var ideaButtons: some View {
        HStack(spacing: 12) {
            ideaButton(emoji: "💡", title: "Give me ideas", kind: .starters)
            ideaButton(emoji: "🤔", title: "Help me think", kind: .questions)
        }
    }

    private func ideaButton(emoji: String, title: String, kind: IdeaKind) -> some View {
        Button {
            Task { await loadIdeas(kind) }
        } label: {
            VStack(spacing: 8) {
                Text(emoji).font(.system(size: 40))
                Text(title)
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .fill(ideaKind == kind ? Color.purple.opacity(0.45) : Color.white.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .strokeBorder(ideaKind == kind ? Color.white.opacity(0.7) : Color.clear, lineWidth: 2)
            )
        }
        .disabled(loading)
    }

    private var thinkingRow: some View {
        HStack(spacing: 8) {
            ProgressView().tint(.white)
            Text("Thinking…").font(.caption).foregroundStyle(.white.opacity(0.7))
        }
    }

    // MARK: - Idea results

    @ViewBuilder
    private var ideaResults: some View {
        VStack(alignment: .leading, spacing: 10) {
            if ideaKind == .starters {
                Text("Pick one to start writing!")
                    .font(.caption).foregroundStyle(.white.opacity(0.7))
                ForEach(ideas, id: \.self) { starter in
                    Button {
                        onInsert(starter)
                        dismiss()
                    } label: {
                        starterCard(starter)
                    }
                }
            } else {
                Text("Think about these, then keep writing!")
                    .font(.caption).foregroundStyle(.white.opacity(0.7))
                ForEach(ideas, id: \.self) { question in
                    questionCard(question)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func starterCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\u{201C}\(text)\u{201D}")
                .font(.system(.subheadline, design: .serif))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
            HStack(spacing: 4) {
                Image(systemName: "hand.tap").font(.caption2)
                Text("Tap to use this").font(.caption2)
            }
            .foregroundStyle(.cyan.opacity(0.8))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(.white.opacity(0.12), lineWidth: 1)
        )
    }

    private func questionCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("💭")
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Age-gated chat

    @ViewBuilder
    private var chatSection: some View {
        if !chatRevealed {
            Button {
                withAnimation { chatRevealed = true }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil.and.scribble")
                    Text("Ask your own question")
                }
                .font(.footnote.bold())
                .padding(.vertical, 8)
                .padding(.horizontal, 14)
                .background(.white.opacity(0.08), in: Capsule())
                .foregroundStyle(.white.opacity(0.85))
            }
            .padding(.top, 4)
        } else {
            VStack(spacing: 12) {
                ForEach(messages) { m in
                    bubble(for: m)
                }
                if sending {
                    thinkingRow
                }
            }
            .padding(.top, 4)
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
            .accessibilityLabel("Send message")
            .disabled(sending || input.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    // MARK: - Actions

    private func loadIdeas(_ kind: IdeaKind) async {
        guard let token = auth.accessToken else { return }
        ideaKind = kind
        ideas = []
        error = nil
        loading = true
        defer { loading = false }
        do {
            ideas = try await APIClient.shared.storyBuddyIdeas(
                intent: kind.intent, book: book, page: page, bearerToken: token
            )
        } catch {
            self.error = "Buddy couldn't reply. Try again?"
        }
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
                .init(message: message, context: page.text.isEmpty ? nil : page.text),
                bearerToken: token
            )
            messages.append(Msg(role: .buddy, content: res.reply))
        } catch {
            self.error = "Buddy couldn't reply. Try again?"
        }
    }
}
