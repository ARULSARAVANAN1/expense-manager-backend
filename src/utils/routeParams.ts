import { Request } from "express";
import { AppError } from "./AppError.js";

export function getStringParam(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string") {
        throw new AppError(`Invalid ${name}`, 422, "VALIDATION_ERROR");
    }
    return value;
}
