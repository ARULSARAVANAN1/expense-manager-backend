import mongoose, { Schema } from "mongoose";

export interface ICategory {
    name: string;
    type: "INCOME" | "EXPENSE";
    normalizedName?: string;
    icon: string;
    color: string;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        normalizedName: {
            type: String,
            trim: true,
        },

        type: {
            type: String,
            enum: ["INCOME", "EXPENSE"],
            required: true,
        },

        icon: {
            type: String,
            default: "tag",
            maxlength: 32,
        },

        color: {
            type: String,
            default: "#808080",
            match: /^#[0-9A-Fa-f]{6}$/,
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

categorySchema.index(
    { userId: 1, type: 1, normalizedName: 1 },
    {
        unique: true,
        partialFilterExpression: { normalizedName: { $type: "string" } },
    }
);

export const CategoryModel =
    mongoose.model<ICategory>("Category", categorySchema);