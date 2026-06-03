import UIKit

extension UIImage {
    /// Center-crops to a square, then scales to `size × size` points.
    ///
    /// IMPORTANT: `UIImage.size` is in POINTS but `cgImage` width/height
    /// are in PIXELS. On a 3× device a `UIGraphicsImageRenderer` produced
    /// image with .size = 256×256 has a backing cgImage of 768×768. The
    /// earlier version of this helper computed the crop rect in points
    /// and applied it to the cgImage in pixels — losing the bottom ⅔ of
    /// the image. We now compute the crop in pixels directly.
    func resizedSquare(to size: CGFloat) -> UIImage {
        guard let cg = self.cgImage else { return self }
        let pxWidth = CGFloat(cg.width)
        let pxHeight = CGFloat(cg.height)
        let shortSide = min(pxWidth, pxHeight)
        let cropRect = CGRect(
            x: (pxWidth - shortSide) / 2,
            y: (pxHeight - shortSide) / 2,
            width: shortSide,
            height: shortSide
        )
        guard let cgCropped = cg.cropping(to: cropRect) else { return self }
        let cropped = UIImage(cgImage: cgCropped, scale: self.scale, orientation: self.imageOrientation)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { _ in
            cropped.draw(in: CGRect(x: 0, y: 0, width: size, height: size))
        }
    }
}
