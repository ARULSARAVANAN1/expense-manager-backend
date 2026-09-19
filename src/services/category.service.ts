import { CategoryModel } from "../model/Category";

interface CreateCategoryInput {
    name: string;
    type: "INCOME" | "EXPENSE";
    userId: string;
}

export async function createCategory(data: CreateCategoryInput) {
    return CategoryModel.create(data);
}

export async function getCategories(userId: string) {
    return CategoryModel.find({ userId })
        .sort({ createdAt: -1 });
}