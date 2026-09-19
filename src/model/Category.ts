import mongoose, { Schema } from "mongoose";

export interface ICategory {
    name: string;
    type: "INCOME" | "EXPENSE";
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

        type: {
            type: String,
            enum: ["INCOME", "EXPENSE"],
            required: true,
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

export const CategoryModel =
    mongoose.model<ICategory>("Category", categorySchema);