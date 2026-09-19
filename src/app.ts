import express from "express";
import categoryRoutes from "./routes/category.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(
    cors({
        origin: "http://localhost:5173",
    })
);

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "Expense Finance Manager API is running",
    });
});

app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);

// Must be after routes
app.use(errorHandler);
export default app;