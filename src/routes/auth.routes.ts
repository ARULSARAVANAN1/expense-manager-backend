import { Router } from "express";

import {
    registerController,
    loginController,
    meController,
} from "../controllers/auth.controller.js";

import { validate } from "../middleware/validate.js";

import {
    registerSchema,
    loginSchema,
} from "../schemas/auth.schema.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post(
    "/register",
    validate(registerSchema),
    registerController
);

router.post(
    "/login",
    validate(loginSchema),
    loginController
);

router.get(
    "/me",
    authenticate,
    meController
);

export default router;