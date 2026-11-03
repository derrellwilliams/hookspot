import Foundation
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics

/// ImageIO port of src/exif.js + avatarUpload.js resizing. Decodes HEIC natively,
/// downsamples without loading the full bitmap, and re-encodes JPEG with no
/// metadata (like the web canvas re-encode — stored images carry no EXIF/GPS).
///
/// Decoding a 12MP HEIC and re-encoding it takes long enough to hang a frame, so the
/// public entry points are `@concurrent` and always run off the main actor.
nonisolated enum ImageProcessing {
    static let storageMaxPx = 2048, storageQuality = 0.85
    static let thumbMaxPx = 960, thumbQuality = 0.82       // keep in sync with exif.js / backfill-thumbnails.js
    static let identifyMaxPx = 1024, identifyQuality = 0.85
    static let displayMaxPx = 1200, displayQuality = 0.82
    static let avatarPx = 128, avatarQuality = 0.82

    struct Exif: Sendable, Equatable {
        var coordinate: Coordinate?
        var dateTimeOriginal: Date?
    }

    enum ImageError: Error { case decodeFailed, encodeFailed }

    static func exif(from data: Data) -> Exif {
        guard let src = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] else { return Exif() }
        var out = Exif()
        if let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any],
           let lat = gps[kCGImagePropertyGPSLatitude] as? Double,
           let lng = gps[kCGImagePropertyGPSLongitude] as? Double {
            let latRef = gps[kCGImagePropertyGPSLatitudeRef] as? String
            let lngRef = gps[kCGImagePropertyGPSLongitudeRef] as? String
            out.coordinate = Coordinate(latitude: latRef == "S" ? -lat : lat, longitude: lngRef == "W" ? -lng : lng)
        }
        let exifDict = props[kCGImagePropertyExifDictionary] as? [CFString: Any]
        let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any]
        let raw = exifDict?[kCGImagePropertyExifDateTimeOriginal] as? String ?? tiff?[kCGImagePropertyTIFFDateTime] as? String
        out.dateTimeOriginal = DateParsing.exif(raw)
        return out
    }

    /// Downsample so the longest side ≤ maxPx (never upscales), orientation applied, → JPEG.
    static func jpeg(from data: Data, maxPx: Int, quality: Double) throws -> Data {
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            throw ImageError.decodeFailed
        }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPx,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { throw ImageError.decodeFailed }
        return try encode(image, quality: quality)
    }

    /// Center-cropped square avatar (avatarUpload.js resizeToBlob).
    @concurrent static func avatarJPEG(from data: Data) async throws -> Data {
        let base = try jpeg(from: data, maxPx: 1024, quality: 0.95)
        guard let src = CGImageSourceCreateWithData(base as CFData, nil),
              let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { throw ImageError.decodeFailed }
        let s = min(img.width, img.height)
        guard let cropped = img.cropping(to: CGRect(x: (img.width - s) / 2, y: (img.height - s) / 2, width: s, height: s)),
              let ctx = CGContext(data: nil, width: avatarPx, height: avatarPx, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw ImageError.encodeFailed }
        ctx.interpolationQuality = .high
        ctx.draw(cropped, in: CGRect(x: 0, y: 0, width: avatarPx, height: avatarPx))
        guard let out = ctx.makeImage() else { throw ImageError.encodeFailed }
        return try encode(out, quality: avatarQuality)
    }

    @concurrent static func storageJPEG(_ data: Data) async throws -> Data { try jpeg(from: data, maxPx: storageMaxPx, quality: storageQuality) }
    @concurrent static func thumbJPEG(_ data: Data) async throws -> Data { try jpeg(from: data, maxPx: thumbMaxPx, quality: thumbQuality) }
    @concurrent static func identifyJPEG(_ data: Data) async throws -> Data { try jpeg(from: data, maxPx: identifyMaxPx, quality: identifyQuality) }
    @concurrent static func previewJPEG(_ data: Data, maxPx: Int) async throws -> Data { try jpeg(from: data, maxPx: maxPx, quality: 0.85) }
    @concurrent static func displayJPEG(_ data: Data) async throws -> Data { try jpeg(from: data, maxPx: displayMaxPx, quality: displayQuality) }

    private static func encode(_ image: CGImage, quality: Double) throws -> Data {
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw ImageError.encodeFailed
        }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { throw ImageError.encodeFailed }
        return out as Data
    }
}
