import { v4 as uuidv4 } from "uuid";
import { completeJob, createJob, failJob } from "../services/job.service.js";
import { scrape } from "../services/scraper.service.js";
import { pickFields } from "../utils/pick-fields.js";
import { fieldsQuerySchema } from "../validators/scrape.validator.js";
// ─── Synchronous scrape ─────────────────────────────────────
export const scrapeSync = async (req, res) => {
    // Body already validated by Zod middleware
    const { url, waitFor, extractors, fullHtml, screenshot } = req.body;
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
        const data = pickFields(result, fields);
        // If the scraped page returned a non-200 status, forward that status
        const pageStatus = result.crawl?.httpStatusCode;
        if (pageStatus && pageStatus !== 200) {
            res.status(pageStatus).json({ success: false, data });
        }
        else {
            res.json({ success: true, data });
        }
    }
    catch (err) {
        console.error("Scrape error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
// ─── Async scrape ───────────────────────────────────────────
export const scrapeAsync = async (req, res) => {
    // Body already validated by Zod middleware
    const { url, waitFor, extractors, fullHtml, screenshot } = req.body;
    const jobId = uuidv4();
    createJob(jobId, url);
    res.json({
        success: true,
        jobId,
        message: "Scraping started. Poll /api/jobs/:jobId for results.",
    });
    scrape({ url, waitFor, extractors, fullHtml, screenshot })
        .then((result) => completeJob(jobId, result))
        .catch((err) => failJob(jobId, err.message));
};
// ─── Batch scrape ───────────────────────────────────────────
export const scrapeBatch = async (req, res) => {
    // Body already validated by Zod middleware
    const { urls, waitFor, extractors, fullHtml } = req.body;
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
            .catch((err) => failJob(jobIds[i], err.message));
    });
};
