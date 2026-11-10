import { Router } from "express";
import {
    createCategoryController,
    deleteCategoryController,
    getCategoriesController,
    updateCategoryController,
} from "../controllers/category.controller.js";

import { validate } from "../middleware/validate.js";
import { createCategorySchema } from "../schemas/category.schema.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router().use(authenticate);

router.get("/", getCategoriesController);

router.post(
    "/",
    validate(createCategorySchema),
    createCategoryController
);
router.patch("/:id", updateCategoryController);
router.delete("/:id", deleteCategoryController);

export default router;