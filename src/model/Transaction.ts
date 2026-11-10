import mongoose, { Schema } from "mongoose";

export interface ITransaction {
    amount: number;
    amountPaise?: number;
    type: "INCOME" | "EXPENSE";
    description: string;
    notes?: string | null;
    transactionDate: Date;

    userId: mongoose.Types.ObjectId;
    accountId?: mongoose.Types.ObjectId | null;
    categoryId: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
    {
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        amountPaise: {
            type: Number,
            min: 1,
            validate: {
                validator: (amount: number) =>
                    Number.isSafeInteger(amount),
                message: "Amount in paise must be a safe integer",
            },
        },

        type: {
            type: String,
            enum: ["INCOME", "EXPENSE"],
            required: true,
        },

        description: {
            type: String,
            trim: true,
            required: true,
            maxlength: 200,
        },

        notes: {
            type: String,
            trim: true,
            maxlength: 2000,
        },

        transactionDate: {
            type: Date,
            default: Date.now,
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: false,
            default: null,
        },

        categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

transactionSchema.index({ userId: 1, type: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, type: 1, categoryId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, type: 1, accountId: 1, transactionDate: -1 });

export const TransactionModel =
    mongoose.model<ITransaction>(
        "Transaction",
        transactionSchema
    );