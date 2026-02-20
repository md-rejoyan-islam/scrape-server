import { Router } from "express";
import {
  scrapeAsync,
  scrapeBatch,
  scrapeSync,
} from "../controllers/scrape.controller.js";
import { validateBody } from "../middlewares/validate.js";
import {
  batchBodySchema,
  scrapeBodySchema,
} from "../validators/scrape.validator.js";

const router = Router();

router.post("/scrape", validateBody(scrapeBodySchema), scrapeSync);
router.post("/scrape/async", validateBody(scrapeBodySchema), scrapeAsync);
router.post("/scrape/batch", validateBody(batchBodySchema), scrapeBatch);

export default router;
