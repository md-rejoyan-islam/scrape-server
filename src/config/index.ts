import dotenv from "dotenv";
import type { ExtractorName } from "../types/index.js";

dotenv.config({ override: true });

export const PORT = Number(process.env.PORT || 3010);

export const DEFAULT_EXTRACTORS: ExtractorName[] = [
  "links",
  "images",
  "headings",
  "text",
  "prices",
  "tables",
];

export const SCRAPE_TIMEOUT_MS = 240_000; // 240s

export const BOT_BYPASS_ENABLED =
  (process.env.BOT_BYPASS_ENABLED || "true").toLowerCase() === "true";

export const HEADLESS =
  (process.env.HEADLESS || "true").toLowerCase() === "true";

export const BATCH_MAX_URLS = 10;
