import { getAllJobs, getJob } from "../services/job.service.js";
import { pickFields } from "../utils/pick-fields.js";
import { fieldsQuerySchema } from "../validators/scrape.validator.js";

import type { Request, Response } from "express";

export const getJobById = (req: Request, res: Response): void => {
  const jobId = req.params.jobId as string;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Apply ?fields= filter to job data
  const { fields } = fieldsQuerySchema.parse(req.query);
  if (fields && job.data) {
    const filtered = {
      ...job,
      data: pickFields(job.data as unknown as Record<string, unknown>, fields),
    };
    res.json(filtered);
    return;
  }

  res.json(job);
};

export const listJobs = (_req: Request, res: Response): void => {
  res.json(getAllJobs());
};
