import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
    createBudgetController,
    deleteBudgetController,
    listBudgetsController,
    updateBudgetController,
} from "../controllers/budget.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", listBudgetsController);
router.post("/", createBudgetController);
router.patch("/:id", updateBudgetController);
router.delete("/:id", deleteBudgetController);

export default router;
