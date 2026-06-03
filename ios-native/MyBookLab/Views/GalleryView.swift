// Browse books other kids have published. Public — no sign-in
// required. Reads from /api/publish-book?recent=true which returns
// featured books first, then the rest by recency.
//
// Tapping a card pulls the full book payload and shows it in
// BookDetailView (same reader the user's own books use).
import SwiftUI

struct GalleryView: View {
    @State private var books: [PublishedBookSummary] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                content
            }
            .navigationTitle("Featured Books")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .task { await load() }
            .refreshable { await load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if loading && books.isEmpty {
            ProgressView().tint(.white)
        } else if let error, books.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 40))
                    .foregroundStyle(.red.opacity(0.8))
                Text(error)
                    .foregroundStyle(.white.opacity(0.8))
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if books.isEmpty {
            VStack(spacing: 14) {
                Text("🌟").font(.system(size: 64))
                Text("Gallery is just getting started")
                    .font(.title3.bold()).foregroundStyle(.white)
                Text("Publish your finished book to share it here!")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                if let featured = featuredBooks, !featured.isEmpty {
                    section(title: "⭐ Featured", books: featured)
                }
                if let recent = recentBooks, !recent.isEmpty {
                    section(title: "Recently published", books: recent)
                }
            }
            .scrollContentBackground(.hidden)
        }
    }

    private var featuredBooks: [PublishedBookSummary]? {
        books.filter { $0.featured == true }
    }
    private var recentBooks: [PublishedBookSummary]? {
        books.filter { $0.featured != true }
    }

    private func section(title: String, books: [PublishedBookSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
                .padding(.horizontal)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 16)], spacing: 20) {
                ForEach(books) { b in
                    NavigationLink {
                        PublishedBookLoader(slug: b.slug)
                    } label: {
                        galleryCard(b)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 16)
    }

    private func galleryCard(_ book: PublishedBookSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(hex: book.coverColor) ?? .purple)
                Text(book.coverEmoji ?? "📖")
                    .font(.system(size: 56))
                if book.featured == true {
                    Image(systemName: "star.fill")
                        .foregroundStyle(.yellow)
                        .padding(6)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                }
            }
            .aspectRatio(3/4, contentMode: .fit)
            .shadow(color: .purple.opacity(0.5), radius: 10, y: 4)

            Text(book.title)
                .font(.subheadline.bold())
                .lineLimit(2)
                .foregroundStyle(.white)
            Text("by \(book.authorName)\(book.authorAge.map { ", age \($0)" } ?? "")")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(book.title), by \(book.authorName)\(book.authorAge.map { ", age \($0)" } ?? "")")
        .accessibilityHint("Opens the book")
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            books = try await APIClient.shared.fetchGallery()
            error = nil
        } catch is CancellationError {
            // ignore — view went away
        } catch let urlError as URLError where urlError.code == .cancelled {
            // ignore
        } catch {
            // Surface the underlying reason so we can debug the next
            // failure mode without another round-trip.
            self.error = "Couldn't load the gallery.\n\(error.localizedDescription)"
        }
    }
}

// MARK: - Loader for a single published book

private struct PublishedBookLoader: View {
    let slug: String
    @State private var book: Book?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ZStack {
            CosmicBackground()
            if let book {
                BookDetailView(book: book)
            } else if loading {
                ProgressView().tint(.white)
            } else if let error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundStyle(.red.opacity(0.8))
                    Text(error).foregroundStyle(.white.opacity(0.8))
                }
                .padding(.horizontal, 32)
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let raw = try await APIClient.shared.fetchPublishedBook(slug: slug)
            // /api/publish-book?slug=… returns either an object or an
            // array; handle both.
            let arr = (try? JSONSerialization.jsonObject(with: raw) as? [[String: Any]]) ?? []
            let single = (try? JSONSerialization.jsonObject(with: raw) as? [String: Any])
            let payload: [String: Any]? = arr.first ?? single
            guard let payload else {
                self.error = "Book not found"
                self.loading = false
                return
            }

            // The published_books row has top-level columns (slug, title,
            // author_name, etc.) AND a `book_data` jsonb with the full
            // page payload. Pull the full book out of book_data.
            if let bookData = payload["book_data"] as? [String: Any] {
                let json = try JSONSerialization.data(withJSONObject: bookData)
                self.book = try JSONDecoder().decode(Book.self, from: json)
            } else {
                self.error = "This book hasn't been finished yet."
            }
        } catch is CancellationError {
            // ignore
        } catch {
            self.error = "Couldn't open this book."
        }
        self.loading = false
    }
}
