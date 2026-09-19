import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error(error);

    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
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
        });

        return;
    }

    // Mongoose validation error
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: Object.values(error.errors).map(
                (item) => item.message
            ),
        });

        return;
    }

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
}