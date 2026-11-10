import express from "express";
import categoryRoutes from "./routes/category.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import accountRoutes from "./routes/account.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import financialGoalRoutes from "./routes/financial-goal.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import { expensesRouter, incomesRouter } from "./routes/transaction.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./docs/openapi.js";

const app = express();

app.use(express.json({ limit: "100kb" }));
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(
    cors({
        origin: corsOrigins,
    })
);

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "Expense Finance Manager API is running",
    });
});

app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: "Expense Manager API Docs",
}));

app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/expenses", expensesRouter);
app.use("/api/incomes", incomesRouter);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", financialGoalRoutes);
app.use("/api/summaries", summaryRoutes);

// Must be after routes
app.use(errorHandler);
export default app;