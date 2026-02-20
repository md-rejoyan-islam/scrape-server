import { v4 as uuidv4 } from "uuid";
import { completeJob, createJob, failJob } from "../services/job.service.js";
import { scrape } from "../services/scraper.service.js";
import { pickFields } from "../utils/pick-fields.js";
import { fieldsQuerySchema } from "../validators/scrape.validator.js";

import type { Request, Response } from "express";
import type { BatchRequestBody, ScrapeRequestBody } from "../types/index.js";

// ─── Synchronous scrape ─────────────────────────────────────

export const scrapeSync = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Body already validated by Zod middleware
  const { url, waitFor, extractors, fullHtml, screenshot } =
    req.body as ScrapeRequestBody;

  try {
    const result = await scrape({
      url,
      waitFor,
      extractors,
      fullHtml,
      screenshot,
    });

    // Apply ?fields= filter
    const { fields } = fieldsQuerySchema.parse(req.query);
    const data = pickFields(
      result as unknown as Record<string, unknown>,
      fields,
    );

    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Async scrape ───────────────────────────────────────────

export const scrapeAsync = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Body already validated by Zod middleware
  const { url, waitFor, extractors, fullHtml, screenshot } =
    req.body as ScrapeRequestBody;

  const jobId = uuidv4();
  createJob(jobId, url);

  res.json({
    success: true,
    jobId,
    message: "Scraping started. Poll /api/jobs/:jobId for results.",
  });

  scrape({ url, waitFor, extractors, fullHtml, screenshot })
    .then((result) => completeJob(jobId, result))
    .catch((err: Error) => failJob(jobId, err.message));
};

// ─── Batch scrape ───────────────────────────────────────────

export const scrapeBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Body already validated by Zod middleware
  const { urls, waitFor, extractors, fullHtml } = req.body as BatchRequestBody;

  const batchId = uuidv4();
  const jobIds = urls.map(() => uuidv4());

  jobIds.forEach((id, i) => {
    createJob(id, urls[i], batchId);
  });

  res.json({
    success: true,
    batchId,
    jobIds,
    message: "Batch scraping started.",
  });

  urls.forEach((url, i) => {
    scrape({ url, waitFor, extractors, fullHtml, screenshot: false })
      .then((result) => completeJob(jobIds[i], result))
      .catch((err: Error) => failJob(jobIds[i], err.message));
  });
};
