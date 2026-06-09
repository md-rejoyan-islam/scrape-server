<div align="center">

# 🕷️ Scraping Server

**A production-grade web scraping API with anti-bot bypass, structured product extraction, and OpenAPI docs.**

[![Bun](https://img.shields.io/badge/Bun-1.3+-000?logo=bun&logoColor=fbf0df)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000?logo=express&logoColor=white)](https://expressjs.com/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-24.x-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#-license)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-scrape--server.rejoyan.me-5b9dff?logoColor=white)](https://scrape-server.rejoyan.me)

🌐 **Live instance:** [**scrape-server.rejoyan.me**](https://scrape-server.rejoyan.me) · [Swagger docs](https://scrape-server.rejoyan.me/api-docs)

[Quick start](#-quick-start) · [API reference](#-api-reference) · [Swagger UI](#-interactive-api-docs-swagger) · [Configuration](#%EF%B8%8F-configuration) · [Docker notes](#-docker-notes) · [License](#-license)

</div>

---

## ✨ Highlights

|                                |                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 🛡️ **Anti-bot bypass**         | Cloudflare Turnstile & generic challenges via [`puppeteer-real-browser`](https://www.npmjs.com/package/puppeteer-real-browser) + stealth plugin |
| 🛒 **Structured product data** | Normalized output from JSON-LD, microdata, OpenGraph — including variants, prices, stock                                                        |
| 🧩 **Pluggable extractors**    | `links`, `images`, `headings`, `text`, `prices`, `tables` — opt in per request                                                                  |
| 📜 **Readability & Markdown**  | Clean article HTML and Markdown output via Mozilla Readability + Turndown                                                                       |
| 📸 **Screenshots**             | Base64-encoded PNG of the rendered page                                                                                                         |
| ⚡ **Three execution modes**   | Synchronous, async (job-based), and parallel batch (up to 10 URLs)                                                                              |
| 📚 **Swagger UI**              | Interactive OpenAPI 3 docs at `/api-docs`                                                                                                       |
| 🎯 **Field projection**        | `?fields=a,b,c` to trim responses                                                                                                               |
| 🐳 **Docker-native**           | One-command bring-up with bundled Xvfb for headful Chrome                                                                                       |
| ✅ **Type-safe inputs**        | Zod-validated request bodies                                                                                                                    |

---

## 🚀 Quick start

### 🐳 Option A — Docker (recommended)

```bash
docker compose up --build
```

That's it. After ~2 minutes (first build):

|                     |                                  |
| ------------------- | -------------------------------- |
| 🖥️ **Web UI**       | http://localhost:8090            |
| 📖 **Swagger docs** | http://localhost:8090/api-docs   |
| 📡 **API base**     | http://localhost:8090/api        |
| ❤️ **Health**       | http://localhost:8090/api/health |

Stop the stack:

```bash
docker compose down
```

### 💻 Option B — Local with Bun

**Prerequisites:** [Bun](https://bun.sh/) `>= 1.3` and a modern Chrome/Chromium (Puppeteer downloads one on first install).

```bash
bun install
bun run dev       # watch mode — auto-reload on changes
```

Build & run the compiled output:

```bash
bun run build     # tsc → dist/
bun run start     # bun dist/src/server.js
```

---

## 📖 Interactive API docs (Swagger)

The full OpenAPI 3 specification lives at [`docs/swagger.yaml`](docs/swagger.yaml) and is **rendered as interactive Swagger UI** once the server is running:

> 👉 **http://localhost:8090/api-docs**

From the Swagger UI you can:

- 🔍 Browse every endpoint with full request/response schemas
- 🧪 **Try requests live** with the built-in "Try it out" button
- 📥 Inspect example payloads and response shapes inline
- 📤 Export/download the raw spec for codegen or client SDK generation

The static UI playground at **http://localhost:8090/** is a friendlier sandbox for non-engineers.

> 💡 **For client SDKs:** point your favorite OpenAPI generator (e.g. [`openapi-typescript`](https://www.npmjs.com/package/openapi-typescript), [`openapi-generator-cli`](https://openapi-generator.tech/)) at `http://localhost:8090/api-docs/swagger.json` to auto-generate a fully-typed client.

---

## ⚙️ Configuration

All settings are environment variables. Locally, drop them in a `.env` at the project root (auto-loaded). For Docker, set them under `environment:` in [`docker-compose.yml`](docker-compose.yml).

| Variable             | Default | Description                                                                            |
| -------------------- | ------- | -------------------------------------------------------------------------------------- |
| `PORT`               | `8090`  | HTTP port the server listens on.                                                       |
| `HEADLESS`           | `true`  | Run Chrome headless. _(Informational — `puppeteer-real-browser` is always headful.)_   |
| `BOT_BYPASS_ENABLED` | `true`  | Reserved flag for future bot-bypass tuning.                                            |
| `CHROME_PATH`        | auto    | Explicit path to Chrome/Chromium (set inside the container).                           |
| `PROXY_URL`          | _none_  | Outbound HTTP proxy: `http://[user:pass@]host:port`. Used by Chrome for every request. |

**Example `.env`:**

```env
PORT=8090
PROXY_URL=http://user:pass@proxy.example.com:8080
```

> 🔒 `.env` is **excluded** from the Docker build (see [`.dockerignore`](.dockerignore)). Container env must go in `docker-compose.yml`.

---

## 🔌 API reference

Base URL: `http://localhost:8090/api` · Full schemas: **[Swagger UI](http://localhost:8090/api-docs)**

<table>
<tr><th>Method</th><th>Path</th><th>Purpose</th></tr>
<tr><td><code>POST</code></td><td><a href="#post-apiscrape--synchronous-scrape"><code>/api/scrape</code></a></td><td>Synchronous scrape</td></tr>
<tr><td><code>POST</code></td><td><a href="#post-apiscrapeasync--fire-and-forget"><code>/api/scrape/async</code></a></td><td>Fire-and-forget — returns a <code>jobId</code></td></tr>
<tr><td><code>POST</code></td><td><a href="#post-apiscrapebatch--multi-url-batch"><code>/api/scrape/batch</code></a></td><td>Batch up to 10 URLs in parallel</td></tr>
<tr><td><code>GET</code></td><td><a href="#get-apijobsjobid--job-status--result"><code>/api/jobs/:jobId</code></a></td><td>Poll a job's status & result</td></tr>
<tr><td><code>GET</code></td><td><a href="#get-apijobs--list-all-jobs"><code>/api/jobs</code></a></td><td>List all jobs (metadata only)</td></tr>
<tr><td><code>GET</code></td><td><a href="#get-apihealth--health-check"><code>/api/health</code></a></td><td>Server health & uptime</td></tr>
</table>

---

### `POST /api/scrape` — synchronous scrape

Scrapes a URL and returns the full result in the same response. Best for ad-hoc requests and testing.

**Request body:**

| Field        | Type                | Required | Default                                                  | Description                                           |
| ------------ | ------------------- | -------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `url`        | `string` (URL)      | ✅       | —                                                        | The page to scrape.                                   |
| `waitFor`    | `number` (0..60000) | ❌       | `3000`                                                   | Extra ms to wait after page load (JS-rendered pages). |
| `extractors` | `ExtractorName[]`   | ❌       | `["links","images","headings","text","prices","tables"]` | Which extractors to run.                              |
| `fullHtml`   | `boolean`           | ❌       | `false`                                                  | Include raw post-render HTML under `fullHtml`.        |
| `screenshot` | `boolean`           | ❌       | `false`                                                  | Include base64 PNG under `screenshotUrl`.             |

**Query:** `?fields=a,b,c` — projection of top-level fields.

**Example:**

```bash
curl -X POST http://localhost:8090/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "waitFor": 2000,
    "extractors": ["headings", "links"]
  }'
```

<details>
<summary><b>Response shape</b></summary>

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
    "metadata": {
      "title": "...",
      "description": "...",
      "openGraph": {},
      "jsonLd": []
    },
    "html": "<readable article html>",
    "markdown": "# Title\n\n...",
    "screenshotUrl": null,
    "timeTaken": "3.42s",
    "headings": { "h1": ["..."], "h2": ["..."] },
    "links": { "total": 12, "items": [] },
    "product": { "productTitle": "...", "variants": [], "priceTry": null },
    "networkSummary": { "totalRequests": 1, "byType": { "document": 1 } }
  }
}
```

</details>

---

### `POST /api/scrape/async` — fire-and-forget

Same body as `/api/scrape`. Returns immediately with a `jobId`; poll [`/api/jobs/:jobId`](#get-apijobsjobid--job-status--result) for results.

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Scraping started. Poll /api/jobs/:jobId for results."
}
```

---

### `POST /api/scrape/batch` — multi-URL batch

Scrape up to **10 URLs in parallel**. Same options as `/api/scrape` but with a `urls` array.

**Request:**

```json
{
  "urls": ["https://a.com", "https://b.com"],
  "extractors": ["headings"]
}
```

**Response (immediate):**

```json
{
  "success": true,
  "batchId": "...",
  "jobIds": ["...", "..."],
  "message": "Batch scraping started."
}
```

Poll each `jobId` independently.

---

### `GET /api/jobs/:jobId` — job status & result

| Field         | When           | Description                        |
| ------------- | -------------- | ---------------------------------- |
| `status`      | always         | `running` · `completed` · `failed` |
| `data`        | on `completed` | Full `ScrapeResult` (see above).   |
| `error`       | on `failed`    | Error message string.              |
| `createdAt`   | always         | ISO timestamp.                     |
| `completedAt` | when done      | ISO timestamp.                     |

Supports `?fields=` to project the inner `data`.

---

### `GET /api/jobs` — list all jobs

Returns metadata for every job in the in-memory store (without payloads).

> ⚠️ The job store is **in-memory** and resets on container restart. For production, swap [`src/services/job.service.ts`](src/services/job.service.ts) for Redis or Postgres.

---

### `GET /api/health` — health check

```json
{ "status": "ok", "uptime": 123.45 }
```

---

## 🧩 Project layout

```
.
├── 🐳 Dockerfile                    # Bun + puppeteer base image, Xvfb installed
├── 🐳 docker-compose.yml            # Single-service compose (port 8090)
├── 🐳 docker-entrypoint.sh          # Starts Xvfb, then execs CMD
├── 📦 package.json
├── 🔒 bun.lock
├── ⚙️  tsconfig.json
├── 📁 docs/
│   └── 📜 swagger.yaml              # OpenAPI 3 spec → served at /api-docs
├── 📁 public/
│   └── 🌐 index.html                # Static UI → served at /
└── 📁 src/
    ├── server.ts                    # HTTP entrypoint
    ├── app.ts                       # Express app, middleware, static & swagger
    ├── config/index.ts              # Env vars, constants
    ├── controllers/                 # Request handlers
    ├── middlewares/validate.ts      # Zod body validator
    ├── routes/                      # Thin route layer per resource
    ├── services/
    │   ├── job.service.ts           # In-memory job store
    │   └── scraper.service.ts       # Timeout wrapper around scrapePage
    ├── utils/
    │   ├── pick-fields.ts           # ?fields= projection helper
    │   └── scraper.ts               # All puppeteer + extraction logic
    ├── validators/scrape.validator.ts  # Zod schemas
    └── types/index.ts               # Domain & DTO types
```

---

## 🛠️ Development

### Scripts

| Script          | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `bun run dev`   | Run `src/server.ts` with `bun --watch` (no build step). |
| `bun run build` | Compile TypeScript → `dist/`.                           |
| `bun run start` | Run the compiled output (`bun dist/src/server.js`).     |

### Type-check without emitting

```bash
bunx tsc --noEmit
```

### Adding a new extractor

1. Add the name to `ExtractorName` in [`src/types/index.ts`](src/types/index.ts).
2. Add it to the enum in [`src/validators/scrape.validator.ts`](src/validators/scrape.validator.ts).
3. Implement `extractFoo($, baseUrl)` in [`src/utils/scraper.ts`](src/utils/scraper.ts).
4. Wire it into the `scrapePage` block (`if (extractors.includes("foo"))`).
5. Add the response field to `ScrapeResult` in `types/index.ts`.
6. Update [`docs/swagger.yaml`](docs/swagger.yaml) so Swagger UI reflects the new shape.

---

## 🐳 Docker notes

### Why an entrypoint script?

`puppeteer-real-browser` runs Chrome **headful** (`headless: false`) so anti-bot detection works — that requires a real X display. The image ships with `xvfb`, and [`docker-entrypoint.sh`](docker-entrypoint.sh) starts `Xvfb :99` before exec'ing the server, then sets `DISPLAY=:99` so Chrome attaches.

### Tuning shared memory

The default `shm_size: "2gb"` is sized for a single Chrome. If you raise the batch limit or run many scrapes in parallel, bump it to `4gb`+ to prevent Chrome crashes.

### Using a proxy

```yaml
environment:
  - PROXY_URL=http://user:pass@proxy-server:8080
```

Credentials are URL-decoded before being passed to Chrome.

---

## ⚠️ Limitations & production notes

- **In-memory job store** — jobs are lost on restart. Swap [`src/services/job.service.ts`](src/services/job.service.ts) for Redis or Postgres before going live.
- **Batch cap is 10 URLs** — see `BATCH_MAX_URLS` in [`src/config/index.ts`](src/config/index.ts).
- **Scrape timeout is 240s** — see `SCRAPE_TIMEOUT_MS` in [`src/config/index.ts`](src/config/index.ts).
- **No authentication** — anyone with network access can scrape arbitrary URLs. Put it behind a reverse proxy with auth/rate-limits before exposing publicly.

---

## 📄 License

**© 2026 Rejoyan Islam. All Rights Reserved.**

This project is **proprietary and source-available** — it is **not** open source. The code is published for reference and evaluation only. You may **not** copy, reproduce, modify, distribute, host, deploy, or create derivative works from any part of it without prior **written permission** from the author. See the full [`LICENSE`](LICENSE) for the exact terms.

For licensing or permission inquiries: **rejoyanislam0014@gmail.com**

<div align="center">

Made with 🕷️ + ☕ by [Rejoyan Islam](mailto:rejoyanislam0014@gmail.com) — built on [Bun](https://bun.sh/), [Express](https://expressjs.com/), and [Puppeteer](https://pptr.dev/).

</div>
