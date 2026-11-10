import mongoose, { Schema } from "mongoose";

export interface IBudget {
    userId: mongoose.Types.ObjectId;
    categoryId: mongoose.Types.ObjectId;
    month: string;
    amount: number;
    amountPaise: number;
    createdAt: Date;
    updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        month: {
            type: String,
            required: true,
            match: /^\d{4}-(0[1-9]|1[0-2])$/,
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        amountPaise: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: (amount: number) => Number.isSafeInteger(amount),
                message: "Budget amount in paise must be a safe integer",
            },
        },
    },
    { timestamps: true }
);

budgetSchema.index(
    { userId: 1, categoryId: 1, month: 1 },
    { unique: true }
);

export const BudgetModel = mongoose.model<IBudget>("Budget", budgetSchema);
