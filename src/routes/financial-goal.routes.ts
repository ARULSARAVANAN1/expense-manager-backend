import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
    addGoalContributionController,
    createFinancialGoalController,
    deleteFinancialGoalController,
    deleteGoalContributionController,
    financialGoalPlanPreviewController,
    financialGoalSavingsPlanController,
    getFinancialGoalController,
    listFinancialGoalsController,
    listGoalContributionsController,
    updateFinancialGoalController,
    updateFinancialGoalStatusController,
    updateGoalContributionController,
} from "../controllers/financial-goal.controller.js";

const router = Router();
router.use(authenticate);
router.post("/plan-preview", financialGoalPlanPreviewController);
router.get("/", listFinancialGoalsController);
router.post("/", createFinancialGoalController);
router.get("/:goalId/savings-plan", financialGoalSavingsPlanController);
router.get("/:goalId/contributions", listGoalContributionsController);
router.post("/:goalId/contributions", addGoalContributionController);
router.patch("/:goalId/contributions/:contributionId", updateGoalContributionController);
router.delete("/:goalId/contributions/:contributionId", deleteGoalContributionController);
router.patch("/:goalId/status", updateFinancialGoalStatusController);
router.get("/:goalId", getFinancialGoalController);
router.patch("/:goalId", updateFinancialGoalController);
router.delete("/:goalId", deleteFinancialGoalController);

export default router;
