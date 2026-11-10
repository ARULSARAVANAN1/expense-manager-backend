import mongoose from "mongoose";
import { BudgetModel } from "../model/Budget.js";
import { CategoryModel } from "../model/Category.js";
import { TransactionModel } from "../model/Transaction.js";
import { AppError } from "../utils/AppError.js";

type CategoryType = "INCOME" | "EXPENSE";

function categoryDto(category: {
    id: string;
    name: string;
    type: CategoryType;
    icon?: string;
    color?: string;
}) {
    return {
        id: category.id,
        name: category.name,
        type: category.type.toLowerCase(),
        icon: category.icon ?? "tag",
        color: category.color ?? "#808080",
    };
}

export async function createCategory(
    data: {
        name: string;
        type: CategoryType;
        icon: string;
        color: string;
    },
    userId: string
) {
    const duplicate = await CategoryModel.exists({
        userId,
        type: data.type,
        name: new RegExp(`^${escapeRegex(data.name.trim())}$`, "i"),
    });
    if (duplicate) {
        throw new AppError("Category name already exists", 409, "DUPLICATE_CATEGORY");
    }

    const category = await CategoryModel.create({
        ...data,
        normalizedName: data.name.trim().toLocaleLowerCase("en"),
        userId,
    });

    return categoryDto(category);
}

export async function getCategories(userId: string, type?: CategoryType) {
    const categories = await CategoryModel.find({
        userId,
        ...(type ? { type } : {}),
    }).sort({ name: 1, _id: 1 });

    return categories.map(categoryDto);
}

export async function updateCategory(
    userId: string,
    categoryId: string,
    data: {
        name?: string;
        type?: CategoryType;
        icon?: string;
        color?: string;
    }
) {
    validateObjectId(categoryId, "category ID");
    const category = await CategoryModel.findOne({ _id: categoryId, userId });
    if (!category) {
        throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
    }

    if (data.type && data.type !== category.type) {
        const [transaction, budget] = await Promise.all([
            TransactionModel.exists({ userId, categoryId }),
            BudgetModel.exists({ userId, categoryId }),
        ]);
        if (transaction || budget) {
            throw new AppError(
                "Category type cannot change while it is referenced",
                409,
                "CATEGORY_IN_USE"
            );
        }
    }

    if (data.name) {
        const duplicate = await CategoryModel.exists({
            _id: { $ne: categoryId },
            userId,
            type: data.type ?? category.type,
            name: new RegExp(`^${escapeRegex(data.name.trim())}$`, "i"),
        });
        if (duplicate) {
            throw new AppError(
                "Category name already exists",
                409,
                "DUPLICATE_CATEGORY"
            );
        }
    }

    Object.assign(category, data);
    if (data.name) {
        category.normalizedName = data.name.trim().toLocaleLowerCase("en");
    }
    await category.save();
    return categoryDto(category);
}

export async function deleteCategory(userId: string, categoryId: string) {
    const category = await CategoryModel.findOne({ _id: categoryId, userId });
    if (!category) {
        throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
    }

    const [transaction, budget] = await Promise.all([
        TransactionModel.exists({ userId, categoryId }),
        BudgetModel.exists({ userId, categoryId }),
    ]);
    if (transaction || budget) {
        throw new AppError(
            "Category is referenced by transactions or budgets",
            409,
            "CATEGORY_IN_USE"
        );
    }

    await category.deleteOne();
    return { id: category.id };
}

export function parseCategoryType(value: unknown): CategoryType | undefined {
    if (value === "expense" || value === "EXPENSE") return "EXPENSE";
    if (value === "income" || value === "INCOME") return "INCOME";
    if (value === undefined) return undefined;
    throw new AppError(
        "Type must be expense or income",
        422,
        "VALIDATION_ERROR"
    );
}

export function validateObjectId(value: string, label: string): void {
    if (!mongoose.isValidObjectId(value)) {
        throw new AppError(`Invalid ${label}`, 422, "VALIDATION_ERROR");
    }

}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
