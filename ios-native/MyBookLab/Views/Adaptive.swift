import SwiftUI

/// Standard maximum content widths for constraining layouts on large
/// screens (iPad). On iPhone these caps exceed the screen width, so they
/// are visual no-ops — the iPhone layout is unchanged by construction.
enum ContentWidth {
    /// Forms, account, checkout, order detail, sign-in, wizard steps.
    static let form: CGFloat = 640
    /// Lists and single-column reading content.
    static let reading: CGFloat = 720
    /// Wider grids/galleries, centered on very large screens.
    static let wide: CGFloat = 1000
}

extension View {
    /// Caps interactive content (forms, primary buttons, lists) to a
    /// comfortable reading width and centers it horizontally. On iPhone the
    /// cap is wider than the screen, so it behaves like full width; on iPad
    /// it stops content stretching edge-to-edge and gives natural side
    /// padding. Kids are mostly on iPad, so this keeps screens looking
    /// deliberate rather than blown-up.
    func contentColumn(maxWidth: CGFloat = ContentWidth.form) -> some View {
        self
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, 20)
    }
}
