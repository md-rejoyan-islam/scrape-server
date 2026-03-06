import { DEFAULT_EXTRACTORS, SCRAPE_TIMEOUT_MS } from "../config/index.js";
import { scrapePage } from "../utils/scraper.js";

import type { ScrapeRequestBody, ScrapeResult } from "../types/index.js";

export interface ScrapeParams {
  url: string;
  waitFor?: number;
  extractors?: ScrapeRequestBody["extractors"];
  fullHtml?: boolean;
  screenshot?: boolean;
}

/**
 * Run a scrape with a timeout guard.
 */
export async function scrape(params: ScrapeParams): Promise<ScrapeResult> {
  const { url, waitFor, extractors, fullHtml, screenshot } = params;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Scrape timed out after 120s")),
      SCRAPE_TIMEOUT_MS,
    ),
  );

  return Promise.race([
    scrapePage({
      url,
      waitFor: waitFor ?? 3000,
      extractors: extractors ?? DEFAULT_EXTRACTORS,
      fullHtml: fullHtml ?? false,
      screenshot: screenshot ?? false,
    }),
    timeout,
  ]);
}
