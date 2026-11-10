import mongoose, { Schema } from "mongoose";

export interface IUser {
    name: string;
    email: string;
    passwordHash?: string | null;
    preferredCurrency: string;
    timezone: string;
    sessionVersion: number;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        passwordHash: {
            type: String,
            required: false,
            default: null,
            select: false,
        },

        preferredCurrency: {
            type: String,
            enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"],
            default: "INR",
            required: true,
        },

        timezone: {
            type: String,
            default: "Asia/Kolkata",
            required: true,
        },

        sessionVersion: {
            type: Number,
            default: 0,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);