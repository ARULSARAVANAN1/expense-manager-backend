import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError.js";
import { MAX_BILL_IMAGE_BYTES } from "../utils/billImage.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_BILL_IMAGE_BYTES,
        files: 1,
        fields: 0,
        parts: 2,
    },
    fileFilter: (_req, file, callback) => {
        if (!allowedTypes.has(file.mimetype)) {
            callback(new AppError(
                "Upload a JPEG, PNG, or WebP bill image",
                422,
                "UNSUPPORTED_BILL_IMAGE"
            ));
            return;
        }
        callback(null, true);
    },
}).single("image");

export function billUpload(req: Request, res: Response, next: NextFunction) {
    if (!req.is("multipart/form-data")) {
        next();
        return;
    }
    upload(req, res, (error: unknown) => {
        if (error instanceof AppError) {
            next(error);
        } else if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            next(new AppError("Bill image must not exceed 5 MB", 413, "BILL_IMAGE_TOO_LARGE"));
        } else if (error) {
            next(new AppError(
                "Send exactly one file named image, with no other multipart fields",
                422,
                "INVALID_BILL_UPLOAD"
            ));
        } else {
            next();
        }
    });
}
