import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { transactionControllers } from "../controllers/transaction.controller.js";
import { parseExpenseController } from "../controllers/expense-parse.controller.js";
import { billUpload } from "../middleware/billUpload.js";

function createTransactionRouter(type: "EXPENSE" | "INCOME") {
    const router = Router();
    const controllers = transactionControllers(type);
    router.use(authenticate);
    router.get("/", controllers.list);
    router.post("/", controllers.create);
    if (type === "EXPENSE") {
        router.post("/parse", billUpload, parseExpenseController);
    }
    router.get("/:id", controllers.get);
    router.patch("/:id", controllers.update);
    router.delete("/:id", controllers.delete);
    return router;
}

export const expensesRouter = createTransactionRouter("EXPENSE");
export const incomesRouter = createTransactionRouter("INCOME");
