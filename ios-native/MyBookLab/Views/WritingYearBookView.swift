// A built "My Writing Year" book on screen — the teacher's preview and a
// class account's read-only view. Same content the PDF prints
// (lib/print/writing-year-html.js); each piece can be read aloud in the
// class language. Web: WritingYearBookView.jsx.
import SwiftUI

struct WritingYearBookView: View {
    let book: WYBook
    @State private var speaker = SpeechSpeaker()

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Text(verbatim: book.avatar_emoji ?? "✏️").font(.system(size: 40)).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    if let title = book.cover_title, !title.isEmpty {
                        Text(verbatim: title).font(.headline)
                    } else {
                        Text(WritingYearCopy.cardHeading).font(.headline)
                    }
                    Text(verbatim: [book.name, book.class_name ?? "", WritingYearRules.yearLabel(book.year)]
                        .filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(.white.opacity(0.75))
                }
            }
            .foregroundStyle(.white)

            if book.pieces.isEmpty {
                Text(WritingYearCopy.previewEmpty).font(.subheadline).foregroundStyle(.white.opacity(0.75))
            }

            ForEach(Array(book.pieces.enumerated()), id: \.offset) { index, piece in
                pieceCard(index: index, piece: piece)
            }

            if let about = book.about, !aboutRows(about).isEmpty {
                card {
                    Text(WritingYearCopy.previewAbout).font(.headline).foregroundStyle(.white)
                    ForEach(aboutRows(about), id: \.0) { field, text in
                        Text(WritingYearCopy.aboutPrompt(field)).font(.caption.weight(.semibold)).foregroundStyle(.cyan)
                        Text(verbatim: text).font(.body).foregroundStyle(.white)
                    }
                }
            }

            if let note = book.teacher_note, !note.isEmpty {
                card {
                    Text(WritingYearCopy.previewTeacherNote).font(.headline).foregroundStyle(.white)
                    Text(verbatim: note).font(.body).foregroundStyle(.white)
                }
            }
        }
        .onDisappear { speaker.stop() }
    }

    private func aboutRows(_ a: WYBook.About) -> [(String, String)] {
        [("about_favorite", a.about_favorite), ("about_best_sentence", a.about_best_sentence), ("about_learned", a.about_learned)]
            .compactMap { f, v in (v ?? "").isEmpty ? nil : (f, v ?? "") }
    }

    private func text(of piece: WYBook.Piece) -> String {
        if piece.kind == "worksheet" {
            return (piece.boxes ?? []).map { "\($0.prompt). \($0.answer)" }.joined(separator: "\n")
        }
        return (piece.pages ?? []).map(\.text).joined(separator: "\n")
    }

    private func pieceCard(index: Int, piece: WYBook.Piece) -> some View {
        let spoken = text(of: piece)
        return card {
            HStack {
                Text(verbatim: "\(index + 1). \(piece.title ?? "")").font(.headline).foregroundStyle(.white)
                Spacer()
                Button { speaker.toggle(spoken, language: book.lang) } label: {
                    Image(systemName: speaker.isSpeaking(spoken) ? "stop.circle.fill" : "speaker.wave.2.fill")
                        .font(.title3).foregroundStyle(.cyan).frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(speaker.isSpeaking(spoken) ? WritingYearCopy.stop : WritingYearCopy.listen))
            }
            if piece.kind == "worksheet" {
                ForEach(piece.boxes ?? [], id: \.self) { box in
                    Text(verbatim: box.prompt).font(.caption.weight(.semibold)).foregroundStyle(.cyan)
                    Text(verbatim: box.answer).font(.body).foregroundStyle(.white)
                }
            } else {
                ForEach(Array((piece.pages ?? []).enumerated()), id: \.offset) { _, page in
                    HStack(alignment: .top, spacing: 10) {
                        if let image = page.image, let url = URL(string: image) {
                            AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { Color.white.opacity(0.08) }
                                .frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 10))
                                .accessibilityHidden(true)
                        }
                        Text(verbatim: page.text).font(.body).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }

    private func card<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) { content() }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
    }
}
