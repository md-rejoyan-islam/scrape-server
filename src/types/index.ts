// ─── TYPES ──────────────────────────────────────────────────

export interface ScrapeOptions {
  url: string;
  waitFor?: number;
  extractors?: ExtractorName[];
  fullHtml?: boolean;
  screenshot?: boolean;
}

export type ExtractorName =
  | "links"
  | "images"
  | "headings"
  | "text"
  | "prices"
  | "tables";

export interface CrawlInfo {
  loadedUrl: string;
  loadedTime: string;
  referrerUrl: string;
  httpStatusCode: number | null;
  depth: number;
  contentType: string;
}

export interface Metadata {
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  author: string | null;
  keywords: string | null;
  languageCode: string | null;
  robots: string | null;
  favicon: string;
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
  jsonLd: unknown[] | null;
  microdata?: MicrodataItem[];
  allMeta: MetaTag[];
  headers: Record<string, string>;
}

export interface MicrodataItem {
  itemtype: string;
  properties: Record<string, string>;
}

export interface MetaTag {
  name?: string;
  property?: string;
  content?: string;
  httpEquiv?: string;
  charset?: string;
}

export interface LinkItem {
  href: string;
  text: string;
  title: string;
  rel: string;
  isExternal: boolean;
}

export interface ImageItem {
  src: string;
  alt: string;
  title: string;
  width?: string;
  height?: string;
  descriptor?: string;
}

export interface PriceItem {
  text: string;
  dataPrice: string;
  element: string;
  class: string;
}

export interface HeadingsMap {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface TextContent {
  bodyTextLength: number;
  bodyTextPreview: string;
  paragraphs: string[];
  listItems: string[];
}

export interface CollectionResult<T> {
  total: number;
  items: T[];
}

export interface NetworkSummary {
  totalRequests: number;
  byType: Record<string, number>;
}

export interface ScrapeResult {
  url: string;
  crawl: CrawlInfo;
  metadata: Metadata;
  html: string | null;
  markdown: string | null;
  screenshotUrl: string | null;
  timeTaken: string;
  links?: CollectionResult<LinkItem>;
  images?: CollectionResult<ImageItem>;
  headings?: HeadingsMap;
  text?: TextContent;
  prices?: CollectionResult<PriceItem>;
  tables?: CollectionResult<{ headers: string[]; rows: string[][] }>;
  fullHtml?: string;
  networkSummary: NetworkSummary;
}

// ─── JOB TYPES ──────────────────────────────────────────────

export interface Job {
  status: "running" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  url: string;
  batchId?: string;
  data?: ScrapeResult;
  error?: string;
}

// ─── API REQUEST/RESPONSE ───────────────────────────────────

export interface ScrapeRequestBody {
  url: string;
  waitFor?: number;
  extractors?: ExtractorName[];
  fullHtml?: boolean;
  screenshot?: boolean;
}

export interface BatchRequestBody {
  urls: string[];
  waitFor?: number;
  extractors?: ExtractorName[];
  fullHtml?: boolean;
}
