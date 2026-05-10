# Scraping Server

A production-ready web scraping API built with **Express 5**, **TypeScript**, and **Puppeteer** (with Cloudflare/Turnstile bypass via `puppeteer-real-browser`). Runs on **[Bun](https://bun.sh/)**.

Scrapes any URL and returns structured data: metadata, headings, links, images, prices, tables, full HTML, readable article HTML, Markdown, and a screenshot — plus a normalized `product` object built from JSON-LD / microdata for e-commerce pages.

---

## Features

- **Synchronous, async (job-based), and batch** scrape endpoints
- **Anti-bot bypass** — Cloudflare Turnstile / generic bot challenges via puppeteer-real-browser + stealth plugin
- **Structured product extraction** — JSON-LD, microdata, OpenGraph, variants, prices, stock
- **Multiple extractors** — links, images, headings, text, prices, tables (opt-in)
- **Readability + Markdown** — readable HTML and Markdown of the article body
- **Screenshots** — base64-encoded PNG
- **Swagger UI** at `/api-docs`
- **Web UI** at `/` (static playground)
- **Field filtering** via `?fields=` query for trimmed responses
- **Docker-ready** with bundled Xvfb for headful Chrome in containers
- **Zod-validated** request bodies

---

## Quick start

### Option A — Run with Docker (recommended)

```bash
docker compose up --build
```

Open:
- UI: http://localhost:8090
- Swagger: http://localhost:8090/api-docs
- API: http://localhost:8090/api

Stop:
```bash
docker compose down
```

### Option B — Run locally with Bun

Prerequisites:
- [Bun](https://bun.sh/) `>= 1.3`
- Chrome/Chromium installed (puppeteer will download it on first install)

```bash
bun install
bun run dev      # dev mode with watch
# or
bun run build    # compile TypeScript to dist/
bun run start    # run the compiled output
```

---

## Configuration

All configuration is via environment variables (a `.env` file in the project root is auto-loaded in local dev; for Docker, set them in `docker-compose.yml`).

| Variable             | Default | Description                                                                                  |
| -------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `PORT`               | `8090`  | HTTP port the server listens on.                                                             |
| `HEADLESS`           | `true`  | Run Chrome headless. (Currently informational — `puppeteer-real-browser` is always headful.) |
| `BOT_BYPASS_ENABLED` | `true`  | Reserved flag for bot-bypass behavior.                                                       |
| `CHROME_PATH`        | auto    | Path to a Chrome/Chromium binary inside the container.                                       |
| `PROXY_URL`          | _none_  | Outbound HTTP proxy URL: `http://user:pass@host:port`. Used by Chrome for all requests.      |

Example `.env`:
```env
PORT=8090
PROXY_URL=http://user:pass@proxy.example.com:8080
```

> The `.env` file is excluded from the Docker build (see `.dockerignore`). To pass values into the container, set them in `docker-compose.yml` under `environment:` instead.

---

## API reference

Base URL: `http://localhost:8090/api`

### `POST /api/scrape` — synchronous scrape

Scrapes a URL and returns the result in the same response. Best for one-off requests and testing.

**Request body** (JSON):

| Field        | Type            | Required | Default                                            | Description                                                                                              |
| ------------ | --------------- | -------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `url`        | string (URL)    | ✅       | —                                                  | The page to scrape.                                                                                      |
| `waitFor`    | number (0..60000) | ❌     | `3000`                                             | Extra wait in ms after page load (for JS-rendered content).                                              |
| `extractors` | string[]        | ❌       | `["links","images","headings","text","prices","tables"]` | Subset of extractors to run. Each adds a top-level key to the response. |
| `fullHtml`   | boolean         | ❌       | `false`                                            | Include the raw post-render HTML under `fullHtml`.                                                       |
| `screenshot` | boolean         | ❌       | `false`                                            | Include a base64 PNG under `screenshotUrl`.                                                              |

**Query params:**

- `fields=a,b,c` — return only the listed top-level fields (e.g. `?fields=metadata,product`).

**Example:**

```bash
curl -X POST http://localhost:8090/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "waitFor": 2000,
    "extractors": ["headings", "links"],
    "screenshot": false
  }'
```

**Response shape:**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/",
    "crawl": {
      "loadedUrl": "https://example.com/",
      "loadedTime": "2026-05-11T12:34:56.000Z",
      "referrerUrl": "https://example.com",
      "httpStatusCode": 200,
      "depth": 0,
      "contentType": "text/html"
    },
    "metadata": { "title": "...", "description": "...", "openGraph": {...}, "jsonLd": [...] },
    "html": "<readable article html>",
    "markdown": "# Title\n\n...",
    "screenshotUrl": null,
    "timeTaken": "3.42s",
    "headings": { "h1": [...], "h2": [...] },
    "links": { "total": 12, "items": [...] },
    "product": { "productTitle": "...", "variants": [...], ... },
    "networkSummary": { "totalRequests": 1, "byType": { "document": 1 } }
  }
}
```

---

### `POST /api/scrape/async` — fire-and-forget

Same body as `/api/scrape`. Immediately returns a `jobId`; poll `/api/jobs/:jobId` to check status and get results.

**Response:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Scraping started. Poll /api/jobs/:jobId for results."
}
```

---

### `POST /api/scrape/batch` — multi-URL batch

Scrape up to **10 URLs** in parallel. Same options as `/api/scrape` but with a `urls` array instead of `url`.

**Request body:**

```json
{
  "urls": ["https://a.com", "https://b.com"],
  "extractors": ["headings"]
}
```

**Response** (immediate):

```json
{
  "success": true,
  "batchId": "...",
  "jobIds": ["...", "..."],
  "message": "Batch scraping started."
}
```

Then poll each `jobId` via `/api/jobs/:jobId`.

---

### `GET /api/jobs/:jobId` — job status / result

Returns the job record. While running, `data` is absent. Once `completed`, `data` contains the scrape result. On failure, `error` contains the message.

Supports `?fields=` to filter the inner `data` object.

```json
{
  "status": "completed",
  "createdAt": "2026-05-11T12:34:00.000Z",
  "completedAt": "2026-05-11T12:34:05.000Z",
  "url": "https://example.com",
  "data": { ... }
}
```

---

### `GET /api/jobs` — list all jobs

Returns metadata for every job in the in-memory store (without `data` payloads).

> **Note:** the job store is in-memory and resets on container restart.

---

### `GET /api/health` — health check

```json
{ "status": "ok", "uptime": 123.45 }
```

---

## Project layout

```
.
├── Dockerfile                    # Bun + puppeteer base image, Xvfb installed
├── docker-compose.yml            # Single-service compose (port 8090)
├── docker-entrypoint.sh          # Starts Xvfb, then execs CMD
├── package.json
├── bun.lock
├── tsconfig.json
├── docs/
│   └── swagger.yaml              # OpenAPI 3 spec served at /api-docs
├── public/
│   └── index.html                # Static UI served at /
└── src/
    ├── server.ts                 # HTTP entrypoint
    ├── app.ts                    # Express app, middleware, static & swagger
    ├── config/index.ts           # Env vars, constants
    ├── controllers/
    │   ├── health.controller.ts
    │   ├── job.controller.ts
    │   └── scrape.controller.ts
    ├── middlewares/
    │   └── validate.ts           # Zod body validator
    ├── routes/                   # Thin route layer per resource
    ├── services/
    │   ├── job.service.ts        # In-memory job store
    │   └── scraper.service.ts    # Timeout wrapper around scrapePage
    ├── utils/
    │   ├── pick-fields.ts        # ?fields= projection helper
    │   └── scraper.ts            # All puppeteer + extraction logic
    ├── validators/
    │   └── scrape.validator.ts   # Zod schemas
    └── types/
        └── index.ts              # Domain & DTO types
```

---

## Development

### Scripts

| Script          | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `bun run dev`   | Run `src/server.ts` directly with `bun --watch` (no tsc). |
| `bun run build` | Compile TypeScript → `dist/`.                             |
| `bun run start` | Run the compiled output (`bun dist/src/server.js`).       |

### Type-check

```bash
bunx tsc --noEmit
```

### Adding a new extractor

1. Add the name to the `ExtractorName` union in [src/types/index.ts](src/types/index.ts).
2. Add it to the enum in [src/validators/scrape.validator.ts](src/validators/scrape.validator.ts).
3. Implement an `extractFoo($, baseUrl)` function in [src/utils/scraper.ts](src/utils/scraper.ts).
4. Wire it into the `scrapePage` switch block (`if (extractors.includes("foo"))`).
5. Add the response field to `ScrapeResult` in `types/index.ts`.

---

## Docker notes

### Why an entrypoint script?

`puppeteer-real-browser` runs Chrome **headful** (`headless: false`) so anti-bot detection works. That requires a real X display. The image ships with `xvfb`, and [docker-entrypoint.sh](docker-entrypoint.sh) starts `Xvfb :99` before exec'ing the server, then sets `DISPLAY=:99` so Chrome attaches to it.

### Increasing parallelism

The default `shm_size: "2gb"` in `docker-compose.yml` is sized for a single Chrome instance. If you raise the batch limit (currently 10) or run many parallel scrapes, bump this to `4gb`+ to prevent Chrome crashes.

### Using a proxy

Set `PROXY_URL` in `docker-compose.yml`:

```yaml
environment:
  - PROXY_URL=http://user:pass@proxy-server:8080
```

Format: `http://[user:pass@]host:port`. Credentials are URL-decoded before being passed to Chrome.

---

## Limitations

- **In-memory job store** — jobs are lost on restart. Swap [src/services/job.service.ts](src/services/job.service.ts) for Redis/Postgres for production.
- **Batch cap is 10 URLs** — see `BATCH_MAX_URLS` in [src/config/index.ts](src/config/index.ts).
- **Scrape timeout is 240s** — see `SCRAPE_TIMEOUT_MS` in [src/config/index.ts](src/config/index.ts).
- **No authentication** — anyone with network access to the server can scrape arbitrary URLs. Put it behind a reverse proxy with auth before exposing publicly.

---

## License

ISC
