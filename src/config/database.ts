import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

export async function connectDatabase(): Promise<void> {
    if (mongoose.connection.readyState === 1) return;

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined");
    }

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(mongoUri)
            .then((connection) => {
                console.log("MongoDB connected");
                return connection;
            })
            .catch((error: unknown) => {
                connectionPromise = undefined;
                throw error;
            });
    }

    await connectionPromise;
}