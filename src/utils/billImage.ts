import sharp from "sharp";
import { AppError } from "./AppError.js";

export const MAX_BILL_IMAGE_BYTES = 5 * 1024 * 1024;
const formats: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
};

export async function billImageDataUrl(buffer: Buffer, mimeType: string): Promise<string> {
    if (buffer.length > MAX_BILL_IMAGE_BYTES) {
        throw new AppError("Bill image must not exceed 5 MB", 413, "BILL_IMAGE_TOO_LARGE");
    }
    if (!formats[mimeType] || buffer.length === 0) {
        throw new AppError("Upload a JPEG, PNG, or WebP bill image", 422, "UNSUPPORTED_BILL_IMAGE");
    }
    let normalized: Buffer;
    try {
        const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning" });
        const metadata = await image.metadata();
        if (metadata.format !== formats[mimeType] || (metadata.pages ?? 1) !== 1) {
            throw new AppError(
                "Upload one non-animated image matching its declared file type",
                422,
                "INVALID_BILL_IMAGE"
            );
        }
        normalized = await image.rotate().flatten({ background: "#ffffff" })
            .jpeg({ quality: 90 }).toBuffer();
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
            "Bill image is corrupt, incomplete, or exceeds 16 megapixels",
            422,
            "INVALID_BILL_IMAGE"
        );
    }
    if (normalized.length > MAX_BILL_IMAGE_BYTES) {
        throw new AppError("Decoded bill image is too large; upload a smaller image", 413, "BILL_IMAGE_TOO_LARGE");
    }
    return `data:image/jpeg;base64,${normalized.toString("base64")}`;
}
