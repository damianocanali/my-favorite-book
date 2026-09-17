// On-device store for full page illustrations + cover images.
//
// The cloud row (user_books.book_data) only keeps a "[saved-locally]" marker
// in place of each image so the row stays small — the same convention the web
// app uses with localStorage. The real image bytes (base64 data: URLs from
// /api/generate-image, which returns data:image/png;base64,...) live HERE and
// are merged back whenever the shelf reloads.
//
// Without this, illustrations vanished on reopen: the stripped cloud copy was
// the only thing that survived an app restart / shelf re-fetch, and the full
// bytes were never written to disk.
import Foundation

enum IllustrationStore {
    static let marker = "[saved-locally]"

    private static let dir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let d = base.appendingPathComponent("Illustrations", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()

    /// One file per image, named "<bookId>__<key>". Book/page ids are UUIDs or
    /// integers, but sanitize defensively so a stray "/" can't escape the dir.
    private static func fileURL(book: String, key: String) -> URL {
        let safe = "\(book)__\(key)".replacingOccurrences(of: "/", with: "_")
        return dir.appendingPathComponent(safe)
    }

    private static func coverKey() -> String { "cover" }
    private static func pageKey(_ pageId: Int) -> String { "page-\(pageId)" }

    /// Persist every real image in the book BEFORE it's stripped for the cloud.
    /// Markers and empties are ignored so we never overwrite a good image with
    /// the placeholder.
    static func save(_ book: Book) {
        if let cover = book.coverImage, isReal(cover) {
            write(cover, book: book.id, key: coverKey())
        }
        for page in book.pages {
            if let img = page.illustrationData, isReal(img) {
                write(img, book: book.id, key: pageKey(page.id))
            }
        }
    }

    /// Replace "[saved-locally]" markers (or a missing cover) in a freshly
    /// loaded book with the real image from disk. If nothing is stored for a
    /// page, the marker is left as-is and the UI shows its placeholder.
    static func restore(_ book: Book) -> Book {
        var b = book
        if b.coverImage == marker || b.coverImage == nil,
           let cover = read(book: b.id, key: coverKey()) {
            b.coverImage = cover
        }
        b.pages = b.pages.map { page in
            guard page.illustrationData == marker else { return page }
            var p = page
            p.illustrationData = read(book: b.id, key: pageKey(page.id))
            return p
        }
        return b
    }

    /// Drop a deleted book's images.
    static func remove(bookId: String) {
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: nil) else { return }
        let prefix = "\(bookId.replacingOccurrences(of: "/", with: "_"))__"
        for f in files where f.lastPathComponent.hasPrefix(prefix) {
            try? FileManager.default.removeItem(at: f)
        }
    }

    // MARK: - Helpers

    private static func isReal(_ s: String) -> Bool { !s.isEmpty && s != marker }

    private static func write(_ value: String, book: String, key: String) {
        try? value.data(using: .utf8)?.write(to: fileURL(book: book, key: key), options: .atomic)
    }

    private static func read(book: String, key: String) -> String? {
        guard let data = try? Data(contentsOf: fileURL(book: book, key: key)),
              let s = String(data: data, encoding: .utf8), !s.isEmpty else { return nil }
        return s
    }
}
