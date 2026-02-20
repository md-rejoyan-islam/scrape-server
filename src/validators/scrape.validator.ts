import { z } from "zod";

// ─── Extractor enum values ──────────────────────────────────

const extractorEnum = z.enum([
  "links",
  "images",
  "headings",
  "text",
  "prices",
  "tables",
]);

// ─── Scrape request body ────────────────────────────────────

export const scrapeBodySchema = z.object({
  url: z.url({ message: "A valid URL is required" }),
  waitFor: z.number().int().min(0).max(60000).optional(),
  extractors: z.array(extractorEnum).optional(),
  fullHtml: z.boolean().optional(),
  screenshot: z.boolean().optional(),
});

// ─── Batch scrape request body ──────────────────────────────

export const batchBodySchema = z.object({
  urls: z
    .array(z.string().url({ message: "Each URL must be valid" }))
    .min(1, "At least one URL is required")
    .max(10, "Max 10 URLs per batch"),
  waitFor: z.number().int().min(0).max(60000).optional(),
  extractors: z.array(extractorEnum).optional(),
  fullHtml: z.boolean().optional(),
});

// ─── Query ?fields= filter ──────────────────────────────────

export const fieldsQuerySchema = z.object({
  fields: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean)
        : undefined,
    ),
});
