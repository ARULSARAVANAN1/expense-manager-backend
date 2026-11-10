import { Request, Response, NextFunction } from "express";

import {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    loginWithGoogle,
} from "../services/auth.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import { googleLoginSchema } from "../schemas/auth.schema.js";

export async function registerController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result = await registerUser(req.body);

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function loginController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result = await loginUser(req.body);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function googleLoginController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { credential } = parseInput(googleLoginSchema, req.body);
        const result = await loginWithGoogle(credential);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function meController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            throw new AppError(
                "Authentication required",
                401
            );
        }

        const user = await getCurrentUser(req.user.id);

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
}

export async function logoutController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            throw new AppError("Authentication required", 401);
        }

        await logoutUser(req.user.id);
        res.status(200).json({ success: true, data: { loggedOut: true } });
    } catch (error) {
        next(error);
    }
}