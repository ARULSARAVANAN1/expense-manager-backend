import {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../utils/AppError.js";
import { verifyToken } from "../utils/jwt.js";
import { UserModel } from "../model/User.js";

export async function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return next(
            new AppError("Authentication required", 401, "UNAUTHENTICATED")
        );
    }

    if (!authorization.startsWith("Bearer ")) {
        return next(
            new AppError(
                "Invalid authorization header",
                401,
                "INVALID_SESSION"
            )
        );
    }

    const token = authorization.substring(7);

    let payload;
    try {
        payload = verifyToken(token);
    } catch {
        return next(
            new AppError("Invalid or expired token", 401, "INVALID_SESSION")
        );
    }

    const user = await UserModel.findById(payload.userId)
        .select("sessionVersion")
        .lean();

    if (!user || (user.sessionVersion ?? 0) !== payload.sessionVersion) {
        return next(
            new AppError("Invalid or expired token", 401, "INVALID_SESSION")
        );
    }

    req.user = { id: payload.userId };
    next();
}