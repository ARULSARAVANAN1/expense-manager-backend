import { Router } from "express";
import { monthlySummaryController } from "../controllers/monthly-summary.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();
router.use(authenticate);
router.post("/monthly", monthlySummaryController);
export default router;
