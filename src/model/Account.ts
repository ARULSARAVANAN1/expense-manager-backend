import mongoose, { Schema } from "mongoose";

export interface IAccount {
    name: string;
    type: "BANK" | "CASH" | "CREDIT_CARD" | "WALLET";
    balance: number;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        type: {
            type: String,
            enum: ["BANK", "CASH", "CREDIT_CARD", "WALLET"],
            required: true,
        },

        balance: {
            type: Number,
            default: 0,
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

export const AccountModel =
    mongoose.model<IAccount>("Account", accountSchema);