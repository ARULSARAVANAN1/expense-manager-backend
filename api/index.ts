import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";
import app from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    await connectDatabase();
    app(req as Request, res as unknown as Response);
}
