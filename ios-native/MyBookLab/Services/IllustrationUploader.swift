// Puts a drawing in Supabase Storage and returns its public URL.
//
// This is the whole reason a drawing can be printed. Books sync with
// on-device base64 stripped out, so an illustration only survives to the
// print pipeline if it is a real URL — see api/_imageStore.js and
// migration 014. Generated art already takes this route server-side;
// drawings upload straight from the device.
//
// The bucket's insert policy restricts writes to `<user-id>/…`, so the
// path prefix is not decoration — a different prefix is rejected.
import Foundation
import Supabase
import UIKit

enum IllustrationUploader {
    static let bucket = "book-illustrations"

    enum UploadError: LocalizedError {
        case notSignedIn
        case encodingFailed

        var errorDescription: String? {
            switch self {
            case .notSignedIn: return "Sign in to save your drawing."
            case .encodingFailed: return "Couldn't save that drawing. Please try again."
            }
        }
    }

    /// Uploads a PNG and returns the public URL to store on the page.
    static func upload(_ image: UIImage, kind: String = "drawing") async throws -> String {
        guard let userId = AuthStore.shared.user?.id.uuidString.lowercased() else {
            throw UploadError.notSignedIn
        }
        guard let data = image.pngData() else {
            throw UploadError.encodingFailed
        }

        let path = "\(userId)/\(kind)-\(UUID().uuidString.replacingOccurrences(of: "-", with: "")).png"
        let storage = AuthStore.shared.supabase.storage.from(bucket)

        _ = try await storage.upload(
            path,
            data: data,
            options: FileOptions(contentType: "image/png", upsert: true)
        )
        return try storage.getPublicURL(path: path).absoluteString
    }
}
