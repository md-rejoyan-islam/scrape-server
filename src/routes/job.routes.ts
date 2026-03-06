import { Router } from "express";
import { getJobById, listJobs } from "../controllers/job.controller.js";

const router: Router = Router();

router.get("/jobs", listJobs);
router.get("/jobs/:jobId", getJobById);

export default router;
