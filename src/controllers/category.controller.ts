import { Request, Response, NextFunction } from "express";
import {
    createCategory,
    deleteCategory,
    getCategories,
    parseCategoryType,
    updateCategory,
    validateObjectId,
} from "../services/category.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import {
    createCategorySchema,
    patchCategorySchema,
} from "../schemas/category.schema.js";
import { getStringParam } from "../utils/routeParams.js";

function userId(req: Request): string {
    if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }
    return req.user.id;
}

export async function createCategoryController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(createCategorySchema, req.body);
        const category = await createCategory(input, userId(req));

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
            userId(req),
            parseCategoryType(req.query.type)
        );

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }

}

export async function updateCategoryController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(patchCategorySchema, req.body);
        const category = await updateCategory(
            userId(req),
            getStringParam(req, "id"),
            input
        );
        res.status(200).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
}

export async function deleteCategoryController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = getStringParam(req, "id");
        validateObjectId(id, "category ID");
        const result = await deleteCategory(userId(req), id);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}