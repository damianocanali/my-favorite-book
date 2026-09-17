// Report a book from the public gallery, or block its author.
//
// App Store Guideline 1.2 requires an app that displays user-generated
// content to give every viewer a way to flag objectionable material and
// to block the person who posted it. Two distinct reports hide a book
// automatically — see supabase-migrations/016_book_reports.sql.
import SwiftUI

struct ReportBookSheet: View {
    let book: PublishedBookSummary
    /// Called after a successful report so the caller can drop the book
    /// from the list it's showing.
    var onReported: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthStore.self) private var auth

    @State private var reason: ReportReason = .inappropriate
    @State private var details: String = ""
    @State private var sending = false
    @State private var error: String?
    @State private var sent = false

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                if sent {
                    sentState
                } else {
                    form
                }
            }
            .navigationTitle(sent ? "Thanks" : "Report this book")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(sent ? "Done" : "Cancel") { dismiss() }
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private var sentState: some View {
        VStack(spacing: 14) {
            Text("🛡️").font(.system(size: 56))
            Text("Thanks for telling us")
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
            Text("A grown-up from our team will look at this book. We review every report within 24 hours.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("“\(book.title)” by \(book.authorName)")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.horizontal)

                Text("What's wrong with it?")
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal)

                VStack(spacing: 0) {
                    ForEach(ReportReason.allCases) { r in
                        Button {
                            reason = r
                        } label: {
                            HStack {
                                Text(r.label).foregroundStyle(.white)
                                Spacer()
                                if reason == r {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.purple)
                                }
                            }
                            .padding(.vertical, 12)
                            .padding(.horizontal, 14)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if r != ReportReason.allCases.last {
                            Divider().overlay(.white.opacity(0.1))
                        }
                    }
                }
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Anything else? (optional)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                    TextField("", text: $details, axis: .vertical)
                        .lineLimit(3...5)
                        .padding(12)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal)

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red.opacity(0.9))
                        .padding(.horizontal)
                }

                SparkleButton(action: { Task { await send() } }) {
                    HStack {
                        if sending { ProgressView().tint(.white) }
                        Text(sending ? "Sending…" : "Send report")
                    }
                }
                .disabled(sending)
                .padding(.horizontal)

                if let authorId = book.userId {
                    Button {
                        Task { await block(authorId) }
                    } label: {
                        Text("Also hide everything by this author")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.7))
                            .underline()
                    }
                    .padding(.horizontal)
                }

                Text("You can also email support@mybooklab.app.")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.5))
                    .padding(.horizontal)
                    .padding(.top, 4)
            }
            .padding(.top, 12)
            .padding(.bottom, 32)
            .frame(maxWidth: ContentWidth.form)
            .frame(maxWidth: .infinity)
        }
    }

    private func send() async {
        guard let token = auth.accessToken else {
            error = "Please sign in to report a book."
            return
        }
        sending = true
        error = nil
        defer { sending = false }
        do {
            try await APIClient.shared.reportBook(
                slug: book.slug,
                reason: reason.rawValue,
                details: details.isEmpty ? nil : details,
                bearerToken: token
            )
            sent = true
            onReported?()
        } catch {
            self.error = "Couldn't send that report: \(error.localizedDescription)"
        }
    }

    private func block(_ authorId: String) async {
        guard let token = auth.accessToken else {
            error = "Please sign in to block an author."
            return
        }
        do {
            try await APIClient.shared.blockAuthor(userId: authorId, bearerToken: token)
            sent = true
            onReported?()
        } catch {
            self.error = "Couldn't block that author: \(error.localizedDescription)"
        }
    }
}
