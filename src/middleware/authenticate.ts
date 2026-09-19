import {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../utils/AppError.js";
import { verifyToken } from "../utils/jwt.js";

export function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return next(
            new AppError("Authentication required", 401)
        );
    }

    if (!authorization.startsWith("Bearer ")) {
        return next(
            new AppError("Invalid authorization header", 401)
        );
    }

    const token = authorization.substring(7);

    try {
        const payload = verifyToken(token);

        req.user = {
            id: payload.userId,
        };

        next();
    } catch {
        next(
            new AppError(
                "Invalid or expired token",
                401
            )
        );
    }
}