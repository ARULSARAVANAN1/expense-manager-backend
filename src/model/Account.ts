import mongoose, { Schema } from "mongoose";

export interface IAccount {
    name: string;
    type?: "BANK" | "CASH" | "CREDIT_CARD" | "WALLET";
    normalizedName?: string;
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

        normalizedName: {
            type: String,
            trim: true,
        },

        type: {
            type: String,
            enum: ["BANK", "CASH", "CREDIT_CARD", "WALLET"],
            default: "WALLET",
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

accountSchema.index(
    { userId: 1, normalizedName: 1 },
    {
        unique: true,
        partialFilterExpression: { normalizedName: { $type: "string" } },
    }
);

export const AccountModel =
    mongoose.model<IAccount>("Account", accountSchema);