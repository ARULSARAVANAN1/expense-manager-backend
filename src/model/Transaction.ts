import mongoose, { Schema } from "mongoose";

export interface ITransaction {
    amount: number;
    type: "INCOME" | "EXPENSE";
    description?: string;
    transactionDate: Date;

    userId: mongoose.Types.ObjectId;
    accountId: mongoose.Types.ObjectId;
    categoryId: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
    {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        type: {
            type: String,
            enum: ["INCOME", "EXPENSE"],
            required: true,
        },

        description: {
            type: String,
            trim: true,
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
            required: true,
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

export const TransactionModel =
    mongoose.model<ITransaction>(
        "Transaction",
        transactionSchema
    );