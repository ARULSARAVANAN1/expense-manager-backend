import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
    createAccountController,
    deleteAccountController,
    getAccountsController,
    updateAccountController,
} from "../controllers/account.controller.js";

const router = Router();
router.use(authenticate);
router.get("/", getAccountsController);
router.post("/", createAccountController);
router.patch("/:id", updateAccountController);
router.delete("/:id", deleteAccountController);

export default router;
