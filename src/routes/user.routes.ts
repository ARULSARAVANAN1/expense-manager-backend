import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
    changePasswordController,
    updateUserController,
} from "../controllers/user.controller.js";

const router = Router();

router.patch("/me", authenticate, updateUserController);
router.post("/me/change-password", authenticate, changePasswordController);

export default router;
