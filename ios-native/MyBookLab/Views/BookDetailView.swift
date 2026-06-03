// Full book viewer. Swipeable pages with illustrations + text, plus a
// read-aloud toggle that uses AVSpeechSynthesizer. From here the user
// can also tap "Order print" (Phase 6 — not wired yet) or "Edit".
import SwiftUI
import AVFoundation

struct BookDetailView: View {
    let book: Book

    @Environment(AudioService.self) private var audio
    @Environment(AuthStore.self) private var auth
    @Environment(AppRouter.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var draft = BookDraftStore.shared
    @State private var pageIndex = 0
    @State private var speaker = SpeechSpeaker()
    @State private var speakingPage: Int?

    var body: some View {
        ZStack {
            CosmicBackground()

            VStack(spacing: 16) {
                // Header — title + author
                VStack(spacing: 4) {
                    Text(book.title)
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("by \(book.authorName)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .padding(.horizontal)
                .padding(.top, 4)

                if book.pages.isEmpty {
                    emptyState
                } else {
                    TabView(selection: $pageIndex) {
                        // Cover page (index -1 conceptually; use 0 as cover)
                        coverCard.tag(-1)
                        ForEach(Array(book.pages.enumerated()), id: \.offset) { i, page in
                            pageCard(page: page).tag(i)
                        }
                        endCard.tag(book.pages.count)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))

                    pageControls
                }
            }
            .padding(.bottom, 32)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 14) {
                    Button {
                        toggleReadAloud()
                    } label: {
                        Image(systemName: speakingPage == pageIndex
                              ? "speaker.wave.2.fill"
                              : "speaker.wave.2")
                    }
                    .accessibilityLabel(speakingPage == pageIndex ? "Stop reading aloud" : "Read this page aloud")

                    // Edit — only the owner's own books (not the read-only
                    // sample / gallery books) can be edited.
                    if isEditable {
                        Button {
                            speaker.stop()
                            draft.edit(book)
                            router.selectedTab = .create
                            dismiss()
                        } label: {
                            Image(systemName: "pencil")
                        }
                        .accessibilityLabel("Edit book")
                    }

                    NavigationLink {
                        PrintOrderView(book: book)
                    } label: {
                        Image(systemName: "printer.fill")
                    }
                    .accessibilityLabel("Order printed copy")
                }
                .foregroundStyle(.white)
            }
        }
        .onAppear { audio.play(.editor) }
        .onDisappear {
            speaker.stop()
            speakingPage = nil
            audio.play(.bookshelf)
        }
        .onChange(of: pageIndex) { _, _ in
            Haptics.tap()
        }
    }

    // Editable only when signed in and this isn't the read-only sample
    // book (gallery books also use slugs / different ids and aren't the
    // user's own — they simply won't appear from the user's shelf).
    private var isEditable: Bool {
        auth.isSignedIn && book.id != SampleBook.book.id
    }

    private var pageControls: some View {
        HStack {
            Button {
                withAnimation { pageIndex = max(-1, pageIndex - 1) }
            } label: {
                Image(systemName: "chevron.left")
                    .padding(12)
                    .background(.white.opacity(0.12), in: Circle())
                    .foregroundStyle(.white)
            }
            .disabled(pageIndex <= -1)
            .accessibilityLabel("Previous page")

            Spacer()

            Text(pageLabel)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))

            Spacer()

            Button {
                withAnimation { pageIndex = min(book.pages.count, pageIndex + 1) }
            } label: {
                Image(systemName: "chevron.right")
                    .padding(12)
                    .background(.white.opacity(0.12), in: Circle())
                    .foregroundStyle(.white)
            }
            .disabled(pageIndex >= book.pages.count)
            .accessibilityLabel("Next page")
        }
        .padding(.horizontal, 24)
    }

    private var pageLabel: String {
        switch pageIndex {
        case -1: return "Cover"
        case book.pages.count: return "The End"
        default: return "Page \(pageIndex + 1) of \(book.pages.count)"
        }
    }

    // MARK: - Cards

    private var coverCard: some View {
        bookCard {
            VStack {
                Spacer()
                coverArt
                    .frame(width: 220, height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .shadow(color: .black.opacity(0.4), radius: 12, y: 6)
                Spacer().frame(height: 24)
                Text(book.title)
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .foregroundStyle(.black)
                    .multilineTextAlignment(.center)
                Text("by \(book.authorName)")
                    .font(.title3)
                    .foregroundStyle(.black.opacity(0.7))
                Spacer()
            }
            .padding()
        }
    }

    @ViewBuilder
    private var coverArt: some View {
        // Prefer the generated cover; if none, fall back to the kid's
        // hero portrait; finally an emoji-on-gradient.
        let coverRaw = book.coverImage ?? ""
        let heroRaw = book.characters.first?.imageData ?? ""
        let bestImage = [coverRaw, heroRaw].first { $0.hasPrefix("http") || $0.hasPrefix("data:") }
        if let raw = bestImage, let url = URL(string: raw) {
            ZStack {
                Color(hex: book.colors?.cover) ?? .purple
                AsyncImage(url: url) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        } else {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(hex: book.colors?.cover) ?? .purple,
                        (Color(hex: book.colors?.accent) ?? .pink).opacity(0.6)
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                Text(book.characters.first?.emoji ?? book.setting?.emoji ?? "📖")
                    .font(.system(size: 96))
            }
        }
    }

    private func pageCard(page: BookPage) -> some View {
        let illustration = page.illustrationData ?? ""
        let isRealImage = illustration.hasPrefix("http") || illustration.hasPrefix("data:")
        return bookCard {
            VStack(alignment: .leading, spacing: 12) {
                Group {
                    if isRealImage, let url = URL(string: illustration) {
                        AsyncImage(url: url) { phase in
                            if let img = phase.image {
                                img.resizable().scaledToFill()
                            } else if phase.error != nil {
                                Image(systemName: "photo").foregroundStyle(.gray)
                            } else {
                                ProgressView()
                            }
                        }
                    } else {
                        // Most synced pages have no illustration here
                        // (web stripped to '[saved-locally]'). Show a
                        // friendly emoji placeholder instead of a
                        // broken-photo icon.
                        ZStack {
                            LinearGradient(
                                colors: [
                                    (Color(hex: book.colors?.cover) ?? .purple).opacity(0.18),
                                    (Color(hex: book.colors?.accent) ?? .pink).opacity(0.18)
                                ],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                            Text(book.characters.first?.emoji ?? book.setting?.emoji ?? "✨")
                                .font(.system(size: 56))
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(page.text)
                    .font(.system(.body, design: .serif))
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer()

                HStack {
                    Spacer()
                    Text("\(page.pageNumber)")
                        .font(.caption.bold())
                        .frame(width: 28, height: 28)
                        .background(Color(hex: book.colors?.cover) ?? .purple, in: Circle())
                        .foregroundStyle(.white)
                }
            }
            .padding()
        }
    }

    private var endCard: some View {
        bookCard {
            VStack(spacing: 12) {
                Spacer()
                Text("The End")
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .foregroundStyle(Color(hex: book.colors?.cover) ?? .purple)
                Text(book.title)
                    .font(.title3)
                    .foregroundStyle(.black.opacity(0.7))
                Text("Written by \(book.authorName)")
                    .font(.subheadline)
                    .foregroundStyle(.black.opacity(0.6))
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "book.closed")
                .font(.system(size: 56))
                .foregroundStyle(.white.opacity(0.7))
            Text("No pages yet")
                .foregroundStyle(.white)
            Text("Open this book in Create to add pages.")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func bookCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        RoundedRectangle(cornerRadius: 18)
            .fill(Color(red: 0.98, green: 0.97, blue: 0.93))
            .overlay(content())
            .padding(.horizontal, 16)
            .shadow(color: .black.opacity(0.4), radius: 12, y: 6)
    }

    // MARK: - Read aloud

    private func toggleReadAloud() {
        guard pageIndex >= 0 && pageIndex < book.pages.count else {
            speaker.stop(); speakingPage = nil; return
        }
        if speakingPage == pageIndex {
            speaker.stop(); speakingPage = nil
        } else {
            speaker.speak(book.pages[pageIndex].text)
            speakingPage = pageIndex
        }
    }
}

@Observable
final class SpeechSpeaker {
    private let synth = AVSpeechSynthesizer()
    func speak(_ text: String) {
        stop()
        let utter = AVSpeechUtterance(string: text)
        utter.rate = 0.45
        utter.voice = AVSpeechSynthesisVoice(language: "en-US")
        synth.speak(utter)
    }
    func stop() {
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    }
}
