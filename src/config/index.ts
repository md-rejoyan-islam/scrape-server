import dotenv from "dotenv";
import type { ExtractorName } from "../types/index.js";

dotenv.config();

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

export const BATCH_MAX_URLS = 10;
