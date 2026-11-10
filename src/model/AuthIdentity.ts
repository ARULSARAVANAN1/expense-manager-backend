import mongoose, { Schema } from "mongoose";

export interface IAuthIdentity {
    userId: mongoose.Types.ObjectId;
    provider: "google";
    providerSubject: string;
    createdAt: Date;
    updatedAt: Date;
}

const authIdentitySchema = new Schema<IAuthIdentity>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        provider: {
            type: String,
            enum: ["google"],
            required: true,
        },
        providerSubject: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

authIdentitySchema.index(
    { provider: 1, providerSubject: 1 },
    { unique: true }
);
authIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const AuthIdentityModel = mongoose.model<IAuthIdentity>(
    "AuthIdentity",
    authIdentitySchema
);
