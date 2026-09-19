import { Router } from "express";
import {
    createCategoryController,
    getCategoriesController,
} from "../controllers/category.controller.js";

import { validate } from "../middleware/validate.js";
import { createCategorySchema } from "../schemas/category.schema.js";

const router = Router();

router.get("/", getCategoriesController);

router.post(
    "/",
    validate(createCategorySchema),
    createCategoryController
);

export default router;