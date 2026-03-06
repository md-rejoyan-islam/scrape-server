import { Router } from "express";
import healthRoutes from "./health.routes.js";
import jobRoutes from "./job.routes.js";
import scrapeRoutes from "./scrape.routes.js";

const router: Router = Router();

router.use(healthRoutes);
router.use(scrapeRoutes);
router.use(jobRoutes);

export default router;
