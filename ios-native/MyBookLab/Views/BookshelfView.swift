// The Bookshelf — a real, magical library. Books stand as vertical
// spines on a wooden shelf with their title written down the spine.
// Tapping a spine animates the book pulling off the shelf and rotating
// to face the reader, then navigates into the full BookDetailView.
//
// Signed-out and empty-shelf states keep the hero landing + example
// book tile from earlier so first impressions stay magical.
import SwiftUI

struct BookshelfView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf
    @State private var showingSignIn = false

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                Group {
                    if !auth.isSignedIn {
                        signedOutLanding
                    } else if bookshelf.loading {
                        magicalLoader
                    } else if let loadError = bookshelf.error, bookshelf.books.isEmpty {
                        errorState(loadError)
                    } else if bookshelf.books.isEmpty {
                        emptyShelfWithExample
                    } else {
                        signedInLanding
                    }
                }
            }
            .navigationTitle(auth.isSignedIn && !bookshelf.books.isEmpty ? "My Books" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !auth.isSignedIn {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Sign in") { showingSignIn = true }
                            .foregroundStyle(.white)
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingSignIn) {
                NavigationStack { SignInView() }
                    .presentationDragIndicator(.visible)
            }
        }
    }

    // The bookshelf shows just the shelves — no hero. The "My Book Lab"
    // hero + Create-a-Book CTA lives only on the Create tab (the app's
    // opening tab).
    private var signedInLanding: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\(bookshelf.books.count) book\(bookshelf.books.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                Shelves(books: bookshelf.books)
            }
            .padding(.bottom, 24)
        }
        .scrollContentBackground(.hidden)
    }

    private var magicalLoader: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    ShelfRowSkeleton()
                }
            }
            .padding(.vertical)
        }
        .scrollContentBackground(.hidden)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(.red.opacity(0.85))
            Text("Couldn't load your books")
                .font(.title3.bold())
                .foregroundStyle(.white)
            Text(message)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            SparkleButton(action: {
                Task {
                    if let id = auth.user?.id.uuidString {
                        await bookshelf.load(userId: id)
                    }
                }
            }) { Text("Try again") }
            .frame(maxWidth: 360)
            .padding(.horizontal, 60)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // Signed-out Books tab: a simple sign-in prompt + the example book.
    // No full hero here — the hero lives on the Create tab.
    private var signedOutLanding: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 10) {
                    Image("AppLogo")
                        .resizable().aspectRatio(contentMode: .fit)
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                        .shadow(color: .purple.opacity(0.5), radius: 12, y: 6)
                    Text("Your bookshelf")
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text("Sign in to see your saved books and order printed copies.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    SparkleButton(action: { showingSignIn = true }) {
                        Text("Sign in")
                    }
                    .frame(maxWidth: 360)
                    .padding(.horizontal, 48)
                }
                .padding(.top, 40)

                exampleSection
            }
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
    }

    private var emptyShelfWithExample: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("📖").font(.system(size: 56))
                    Text("Your bookshelf is empty")
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                    Text("Tap **Create** to make your first story — or peek at the example below.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.top, 32)
                exampleSection
            }
            .padding(.bottom, 40)
        }
        .scrollContentBackground(.hidden)
    }

    private var exampleSection: some View {
        VStack(spacing: 14) {
            Text("See a finished book")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.7))
                .textCase(.uppercase)
            NavigationLink {
                BookDetailView(book: SampleBook.book)
            } label: {
                exampleCard
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 32)
        }
        .contentColumn(maxWidth: ContentWidth.form)
    }

    private var exampleCard: some View {
        let book = SampleBook.book
        return HStack(spacing: 14) {
            ZStack {
                Color(hex: book.colors?.cover) ?? .purple
                AsyncImage(url: URL(string: book.coverImage ?? "")) { phase in
                    if let img = phase.image {
                        img.resizable().scaledToFill()
                    }
                }
                Image(systemName: "sparkle")
                    .font(.caption)
                    .foregroundStyle(.yellow)
                    .padding(6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
            .frame(width: 72, height: 92)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .purple.opacity(0.5), radius: 10, y: 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(book.title).font(.headline).foregroundStyle(.white)
                Text("by \(book.authorName)")
                    .font(.caption).foregroundStyle(.white.opacity(0.7))
                Text("12 pages · Tap to flip through")
                    .font(.caption2).foregroundStyle(.white.opacity(0.55))
                    .padding(.top, 2)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5))
        }
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - The actual shelf

/// Splits the user's books into rows of 5 spines each and stacks
/// each row on its own wooden shelf. Books stand vertically with
/// their titles printed down the spine, like a real library.
private struct Shelves: View {
    let books: [Book]
    @Environment(\.horizontalSizeClass) private var hSize
    private var booksPerRow: Int { hSize == .regular ? 9 : 5 }

    private var rows: [[Book]] {
        stride(from: 0, to: books.count, by: booksPerRow).map {
            Array(books[$0..<min($0 + booksPerRow, books.count)])
        }
    }

    var body: some View {
        VStack(spacing: 20) {
            ForEach(Array(rows.enumerated()), id: \.offset) { rowIndex, row in
                ShelfRow(books: row, rowIndex: rowIndex)
            }
        }
        .padding(.vertical, 12)
    }
}

private struct ShelfRow: View {
    let books: [Book]
    let rowIndex: Int

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(books.enumerated()), id: \.element.id) { i, book in
                    NavigationLink {
                        BookDetailView(book: book)
                    } label: {
                        BookSpine(book: book, indexInRow: i)
                    }
                    .buttonStyle(BookSpinePressStyle())
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)

            shelfBoard
        }
    }

    private var shelfBoard: some View {
        // Wooden shelf — looks like a polished plank with subtle grain
        // and a soft cosmic underglow.
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.42, green: 0.27, blue: 0.16),
                    Color(red: 0.32, green: 0.20, blue: 0.10),
                    Color(red: 0.45, green: 0.30, blue: 0.18),
                ],
                startPoint: .top, endPoint: .bottom
            )
            ForEach(0..<10, id: \.self) { i in
                Rectangle()
                    .fill(.black.opacity(0.04))
                    .frame(height: 1)
                    .offset(y: CGFloat(i) * 2 - 6)
            }
        }
        .frame(height: 12)
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .shadow(color: .black.opacity(0.4), radius: 4, y: 3)
        .padding(.horizontal, 12)
        .overlay(
            // Soft purple underglow to keep it kid-magical
            LinearGradient(
                colors: [.purple.opacity(0.25), .clear],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 24)
            .padding(.horizontal, 12)
            .blur(radius: 12)
            .offset(y: 12),
            alignment: .top
        )
    }
}

// MARK: - One book on the shelf

private struct BookSpine: View {
    let book: Book
    let indexInRow: Int

    @Environment(\.horizontalSizeClass) private var hSize
    private var spineWidth: CGFloat { hSize == .regular ? 56 : 44 }
    private var spineColor: Color { Color(hex: book.colors?.cover) ?? .purple }
    private var accentColor: Color { Color(hex: book.colors?.accent) ?? .pink }

    // Slight per-position height variation so the row doesn't look
    // like a perfect picket fence. No tilt — tilt was breaking the
    // bounding box and bleeding into neighbor cells.
    private var spineHeight: CGFloat {
        let base: CGFloat = 168
        let variation: CGFloat = [0, 8, -6, 4, -3][indexInRow % 5]
        return base + variation
    }

    var body: some View {
        ZStack {
            // Spine background
            LinearGradient(
                colors: [spineColor.opacity(0.95), spineColor, spineColor.opacity(0.75)],
                startPoint: .leading, endPoint: .trailing
            )

            // Decorative top + bottom bands (gilded edges)
            VStack {
                Rectangle().fill(accentColor.opacity(0.6)).frame(height: 6)
                Spacer()
                Rectangle().fill(accentColor.opacity(0.6)).frame(height: 6)
            }
            .padding(.vertical, 6)

            // Title — drawn into a horizontal box, then rotated -90°.
            Text(book.title)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(width: spineHeight - 28, height: spineWidth - 12)
                .rotationEffect(.degrees(-90))

            // Tiny sparkle accent
            Image(systemName: "sparkle")
                .font(.system(size: 10))
                .foregroundStyle(.yellow)
                .padding(.top, 4)
                .padding(.trailing, 4)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)

            // Subtle ridge to suggest the spine's curve
            Rectangle()
                .fill(.white.opacity(0.06))
                .frame(width: 1)
                .padding(.vertical, 10)
        }
        .frame(width: spineWidth, height: spineHeight)
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        // The rotated title text inside the ZStack has a hit area
        // wider than the spine's 44pt frame. Without this, taps on
        // book #1's title overflow can land on book #2 and open the
        // wrong destination. Locking the tap shape to the spine's
        // own rectangle routes every tap to the correct book.
        .contentShape(Rectangle())
        .shadow(color: .black.opacity(0.4), radius: 4, x: 1, y: 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(book.title), by \(book.authorName)")
        .accessibilityHint("Opens the book")
    }
}

// MARK: - Press style — tap pulls the book off the shelf

private struct BookSpinePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 1.08 : 1.0)
            .offset(y: configuration.isPressed ? -10 : 0)
            .shadow(
                color: .purple.opacity(configuration.isPressed ? 0.7 : 0),
                radius: configuration.isPressed ? 14 : 0,
                y: configuration.isPressed ? 8 : 0
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.55), value: configuration.isPressed)
    }
}

// MARK: - Loading skeleton

private struct ShelfRowSkeleton: View {
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var shimmer = false
    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(0..<(hSize == .regular ? 9 : 5), id: \.self) { i in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(.white.opacity(shimmer ? 0.18 : 0.08))
                        .frame(width: hSize == .regular ? 56 : 44, height: [168, 176, 162, 172, 165][i % 5])
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)
            RoundedRectangle(cornerRadius: 3)
                .fill(.white.opacity(0.08))
                .frame(height: 12)
                .padding(.horizontal, 12)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                shimmer = true
            }
        }
        .accessibilityHidden(true)
    }
}

// Hex parser stays here for use across the file
extension Color {
    init?(hex: String?) {
        guard let raw = hex?.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: ""),
              let v = UInt64(raw, radix: 16), raw.count == 6 else { return nil }
        let r = Double((v >> 16) & 0xff) / 255
        let g = Double((v >> 8) & 0xff) / 255
        let b = Double(v & 0xff) / 255
        self = Color(red: r, green: g, blue: b)
    }
}
