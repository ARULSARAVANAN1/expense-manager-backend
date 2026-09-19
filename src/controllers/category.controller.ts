import { Request, Response, NextFunction } from "express";
import {
    createCategory,
    getCategories,
} from "../services/category.service.js";

export async function createCategoryController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const category = await createCategory(req.body);

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
}

export async function getCategoriesController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const categories = await getCategories(
            req.query.userId as string
        );

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
}