// Indexes the kid's books in Spotlight so searching their book's title
// on the home screen jumps straight into the app. Reindexed wholesale
// whenever the bookshelf loads/changes — the collection is small.
import CoreSpotlight
import Foundation

enum SpotlightIndexer {
    static let domain = "com.myfavoritebook.app.books"

    static func reindex(_ books: [Book]) {
        let items = books.map { book -> CSSearchableItem in
            let attributes = CSSearchableItemAttributeSet(contentType: .content)
            attributes.title = book.title
            attributes.contentDescription = "A story by \(book.authorName) in My Book Lab"
            attributes.keywords = ["book", "story", book.authorName]
            return CSSearchableItem(
                uniqueIdentifier: "book-\(book.id)",
                domainIdentifier: domain,
                attributeSet: attributes
            )
        }
        let index = CSSearchableIndex.default()
        index.deleteSearchableItems(withDomainIdentifiers: [domain]) { _ in
            guard !items.isEmpty else { return }
            index.indexSearchableItems(items, completionHandler: nil)
        }
    }
}
