import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    if (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "entity.parse.failed"
    ) {
        res.status(400).json({
            success: false,
            message: "Malformed JSON request body",
            code: "MALFORMED_JSON",
        });
        return;
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "entity.too.large"
    ) {
        res.status(413).json({
            success: false,
            message: "Request body is too large",
            code: "PAYLOAD_TOO_LARGE",
        });
        return;
    }

    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
            code: error.code,
            ...(error.errors ? { errors: error.errors } : {}),
        });

        return;
    }

    // MongoDB duplicate key error
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
    ) {
        res.status(409).json({
            success: false,
            message: "Resource already exists",
            code: "DUPLICATE_RESOURCE",
        });

        return;
    }

    // Mongoose validation error
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            errors: Object.values(error.errors).map(
                (item) => item.message
            ),
        });

        return;
    }

    console.error(error);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
    });
}