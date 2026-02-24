import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import {
  chromium,
  type Response as PlaywrightResponse,
  type Route,
} from "playwright";
import TurndownService from "turndown";

import { BOT_BYPASS_ENABLED } from "../config/index.js";

import type {
  CollectionResult,
  HeadingsMap,
  ImageItem,
  LinkItem,
  Metadata,
  MetaTag,
  MicrodataItem,
  PriceItem,
  ProductData,
  ProductVariant,
  ScrapeOptions,
  ScrapeResult,
  TextContent,
} from "../types/index.js";

// ─── MARKDOWN CONVERTER ─────────────────────────────────────

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "*",
  codeBlockStyle: "fenced",
});

// ─── BROWSER HELPERS ────────────────────────────────────────

export async function closeBrowser(): Promise<void> {
  // no-op — browser is created and closed per request
}

// ─── BOT CHALLENGE DETECTION (fast, no DOM needed) ──────────

function looksLikeChallenge(html: string): boolean {
  if (html.length > 60000) return false; // real pages are usually larger
  const l = html.toLowerCase();
  // Cloudflare
  if (
    l.includes("cf_chl_opt") ||
    l.includes("cf-challenge") ||
    l.includes("cf-turnstile")
  )
    return true;
  if (
    l.includes("just a moment") &&
    (l.includes("cloudflare") || l.includes("ray id"))
  )
    return true;
  if (
    l.includes("managed_checking_msg") ||
    l.includes("cf-browser-verification")
  )
    return true;
  // Generic
  if (
    (l.includes("checking your browser") || l.includes("ddos protection")) &&
    html.length < 20000
  )
    return true;
  if (l.includes("access denied") && html.length < 10000) return true;
  return false;
}

/** Quick single mouse wiggle + tiny scroll — takes ~300ms total */
async function quickHumanSignal(page: any): Promise<void> {
  try {
    await page.mouse.move(
      400 + Math.random() * 600,
      300 + Math.random() * 200,
      { steps: 3 },
    );
    await page.evaluate(() => window.scrollBy(0, 80));
  } catch {}
}

// ─── MAIN SCRAPE FUNCTION ───────────────────────────────────

export async function scrapePage(
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const {
    url,
    waitFor = 3000,
    extractors = [],
    fullHtml = false,
    screenshot = false,
  } = options;

  const startTime = Date.now();
  let browser;

  try {
    // Use system Chrome (much harder for Cloudflare to fingerprint)
    // Falls back to bundled Chromium if Chrome is not installed
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
      "--lang=en-US,en",
    ];
    try {
      browser = await chromium.launch({
        channel: "chrome",
        headless: true,
        args: launchArgs,
      });
      console.log("[scraper] Using system Chrome.");
    } catch {
      console.log(
        "[scraper] System Chrome not found, falling back to Chromium.",
      );
      browser = await chromium.launch({
        headless: true,
        args: launchArgs,
      });
    }

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "Europe/Istanbul",
      javaScriptEnabled: true,
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua":
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        Connection: "keep-alive",
        DNT: "1",
      },
    });

    const page = await context.newPage();

    // ─── ADVANCED STEALTH: comprehensive anti-detection ──
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      // Delete the property entirely if possible
      delete (navigator as any).__proto__.webdriver;

      // Realistic plugins array
      const makePluginArray = (plugins: any[]) => {
        const arr = Object.create(PluginArray.prototype);
        plugins.forEach((p, i) => (arr[i] = p));
        Object.defineProperty(arr, "length", { get: () => plugins.length });
        arr.item = (i: number) => plugins[i] || null;
        arr.namedItem = (name: string) =>
          plugins.find((p: any) => p.name === name) || null;
        arr.refresh = () => {};
        return arr;
      };

      Object.defineProperty(navigator, "plugins", {
        get: () =>
          makePluginArray([
            {
              name: "Chrome PDF Plugin",
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
            },
            {
              name: "Chrome PDF Viewer",
              description: "",
              filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              length: 1,
            },
            {
              name: "Native Client",
              description: "",
              filename: "internal-nacl-plugin",
              length: 2,
            },
          ]),
      });

      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "tr"],
      });

      Object.defineProperty(navigator, "platform", {
        get: () => "Win32",
      });

      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 8,
      });

      Object.defineProperty(navigator, "deviceMemory", {
        get: () => 8,
      });

      Object.defineProperty(navigator, "maxTouchPoints", {
        get: () => 0,
      });

      // Chrome runtime object
      const chrome: any = {
        runtime: {
          connect: () => {},
          sendMessage: () => {},
          onMessage: { addListener: () => {}, removeListener: () => {} },
          onConnect: { addListener: () => {}, removeListener: () => {} },
          id: undefined,
        },
        loadTimes: () => ({
          requestTime: Date.now() / 1000 - Math.random() * 2,
          startLoadTime: Date.now() / 1000 - Math.random(),
          commitLoadTime: Date.now() / 1000 - Math.random() * 0.5,
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: Date.now() / 1000 - Math.random() * 0.3,
          firstPaintAfterLoadTime: 0,
          navigationType: "Other",
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: "h2",
          wasAlternateProtocolAvailable: false,
          connectionInfo: "h2",
        }),
        csi: () => ({
          onloadT: Date.now(),
          startE: Date.now() - Math.floor(Math.random() * 1000),
          pageT: Math.random() * 2000 + 500,
          tran: 15,
        }),
        app: {
          isInstalled: false,
          InstallState: {
            INSTALLED: "installed",
            NOT_INSTALLED: "not_installed",
          },
          RunningState: {
            CANNOT_RUN: "cannot_run",
            READY_TO_RUN: "ready_to_run",
            RUNNING: "running",
          },
        },
      };
      (window as any).chrome = chrome;

      // Permissions query
      const originalQuery = window.navigator.permissions.query.bind(
        window.navigator.permissions,
      );
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);

      // WebGL vendor/renderer spoofing
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param: number) {
        if (param === 37445) return "Intel Inc.";
        if (param === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.call(this, param);
      };
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (param: number) {
        if (param === 37445) return "Intel Inc.";
        if (param === 37446) return "Intel Iris OpenGL Engine";
        return getParameter2.call(this, param);
      };

      // Canvas fingerprint noise
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (
        type?: string,
        quality?: any,
      ) {
        if (this.width === 0 && this.height === 0)
          return origToDataURL.call(this, type, quality);
        const ctx = this.getContext("2d");
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] ^= 1; // very subtle noise
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return origToDataURL.call(this, type, quality);
      };

      // Prevent detection of automation iframes
      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
        get: function () {
          return window;
        },
      });

      // sourceBuffer (media check)
      Object.defineProperty(navigator, "connection", {
        get: () => ({
          effectiveType: "4g",
          rtt: 50,
          downlink: 10,
          saveData: false,
        }),
      });
    });

    // Only block heavy media (video/audio/large fonts)
    await page.route("**/*", (route: Route) => {
      const type = route.request().resourceType();
      if (type === "media") {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Collect network requests + track last document response
    const networkRequests: { url: string; status: number; type: string }[] = [];
    let lastDocResponse: PlaywrightResponse | null = null;
    page.on("response", (resp: PlaywrightResponse) => {
      networkRequests.push({
        url: resp.url(),
        status: resp.status(),
        type: resp.request().resourceType(),
      });
      // Track the last HTML document response (the real page after redirects)
      if (resp.request().resourceType() === "document") {
        lastDocResponse = resp;
      }
    });

    // ─── NAVIGATE (with retry on ERR_ABORTED / network errors) ──
    console.log(`[scraper] Navigating to: ${url}`);
    let response: PlaywrightResponse | null = null;
    const MAX_NAV_RETRIES = 3;

    for (let navAttempt = 1; navAttempt <= MAX_NAV_RETRIES; navAttempt++) {
      try {
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        // Wait for network to settle
        try {
          await page.waitForLoadState("networkidle", { timeout: 8000 });
        } catch {}
        break; // success — exit retry loop
      } catch (navError: any) {
        const msg = navError?.message || "";
        console.log(
          `[scraper] Navigation attempt ${navAttempt}/${MAX_NAV_RETRIES} failed: ${msg.substring(0, 120)}`,
        );

        if (navAttempt < MAX_NAV_RETRIES) {
          if (
            msg.includes("ERR_ABORTED") ||
            msg.includes("ERR_CONNECTION") ||
            msg.includes("ERR_TIMED_OUT") ||
            msg.includes("ERR_NAME") ||
            msg.includes("net::") ||
            msg.includes("Timeout")
          ) {
            // Wait before retry — increasing delay each attempt
            const delay = navAttempt * 3000 + Math.random() * 2000;
            console.log(
              `[scraper] Retrying in ${(delay / 1000).toFixed(1)}s...`,
            );
            await page.waitForTimeout(delay);

            // On 2nd retry, try visiting origin first to pick up cookies/pass checks
            if (navAttempt === 2) {
              console.log("[scraper] Trying origin-first strategy...");
              try {
                const origin = new URL(url).origin;
                await page.goto(origin, {
                  waitUntil: "domcontentloaded",
                  timeout: 20000,
                });
                try {
                  await page.waitForLoadState("networkidle", { timeout: 8000 });
                } catch {}
                await page.waitForTimeout(2000);
                await quickHumanSignal(page);
              } catch (originErr) {
                console.log(
                  `[scraper] Origin visit also failed, will retry direct.`,
                );
              }
            }
            continue;
          }
        }
        // Non-retryable or exhausted retries — throw
        throw navError;
      }
    }

    // If page.goto returned null (e.g. download or aborted but page has content), read what we have
    if (!response) {
      console.log("[scraper] No response object — using page content as-is.");
    }

    // ─── BOT-CHALLENGE BYPASS ───────────────────────────────
    let html = await page.content();
    const status = response ? response.status() : 200;
    let botBlocked = false;

    const isChallenged =
      looksLikeChallenge(html) ||
      status === 403 ||
      status === 429 ||
      status === 503;

    if (isChallenged && !BOT_BYPASS_ENABLED) {
      console.log(
        `[scraper] Bot challenge detected (status ${status}) but BOT_BYPASS_ENABLED=false — skipping bypass.`,
      );
      botBlocked = true;
    }

    if (isChallenged && BOT_BYPASS_ENABLED) {
      console.log(
        `[scraper] Challenge detected (status ${status}, ${html.length}b). Waiting for auto-resolve...`,
      );

      // Quick human signal
      await quickHumanSignal(page);

      // Strategy 1: Wait for Cloudflare to auto-redirect after solving.
      // CF JS challenge typically redirects the browser after ~5-15s.
      // We race: waitForNavigation (redirect) vs polling content change.
      const MAX_WAIT = 30000;
      const challengeStart = Date.now();
      let resolved = false;

      // Set up a navigation promise (CF redirects after challenge)
      const navPromise = page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: MAX_WAIT })
        .then(() => {
          console.log("[scraper] Navigation detected (challenge redirect).");
          return true;
        })
        .catch(() => false);

      // Also poll content in case of in-place JS replacement (no redirect)
      const pollPromise = (async () => {
        while (Date.now() - challengeStart < MAX_WAIT) {
          await page.waitForTimeout(1500);
          let h: string;
          try {
            h = await page.content();
          } catch {
            // Page is mid-navigation (challenge redirect in progress) — skip this tick
            continue;
          }
          if (!looksLikeChallenge(h)) {
            console.log("[scraper] Challenge resolved (content changed).");
            return true;
          }
          // Try clicking Turnstile checkbox if visible
          try {
            for (const frame of page.frames()) {
              if (
                frame.url().includes("challenges.cloudflare.com") ||
                frame.url().includes("turnstile")
              ) {
                const cb = await frame.$(
                  "input[type='checkbox'], .ctp-checkbox-label, #challenge-stage",
                );
                if (cb) {
                  await cb.click({ delay: 60 + Math.random() * 80 });
                  await page.waitForTimeout(2000);
                }
                break;
              }
            }
          } catch {}
        }
        return false;
      })();

      resolved = await Promise.race([navPromise, pollPromise]);

      // Re-read content after resolution — wait for load to settle first
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 });
      } catch {}
      try {
        html = await page.content();
      } catch {
        // Page still navigating — give it more time
        await page.waitForTimeout(2000);
        try {
          html = await page.content();
        } catch {}
      }
      try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
      } catch {}

      // Strategy 2: If still blocked, visit origin first to collect CF cookies
      if (looksLikeChallenge(html)) {
        console.log("[scraper] Still blocked — cookie retry via origin...");
        try {
          const origin = new URL(url).origin;
          await page.goto(origin, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });

          // Wait for origin challenge to clear (watch for redirect)
          try {
            await page.waitForNavigation({
              waitUntil: "domcontentloaded",
              timeout: 15000,
            });
          } catch {}
          try {
            await page.waitForLoadState("networkidle", { timeout: 8000 });
          } catch {}

          // Now go to the actual target with CF cookies set
          response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
          try {
            await page.waitForLoadState("networkidle", { timeout: 8000 });
          } catch {}
          await page.waitForTimeout(2000);
          html = await page.content();
        } catch (e) {
          console.log(`[scraper] Cookie retry failed: ${e}`);
        }
      }

      if (looksLikeChallenge(html)) {
        console.log("[scraper] WARNING: Bot protection could not be bypassed.");
        botBlocked = true;
      } else if (!resolved) {
        console.log("[scraper] Challenge bypassed via cookie retry.");
      }
    } else {
      console.log("[scraper] Page loaded (no challenge).");
    }

    // Extra wait for JS rendering
    if (waitFor > 0) {
      await page.waitForTimeout(Math.min(waitFor, 5000));
    }

    // ─── DISMISS POPUPS / MODALS / OVERLAYS ─────────────────
    console.log("[scraper] Checking for popups/modals...");
    try {
      await page.evaluate(() => {
        // Strategy 1: Click all visible close buttons (X, ×, close, kapat, etc.)
        const closeSelectors = [
          // Common close button patterns
          'button[class*="close"]',
          'a[class*="close"]',
          'span[class*="close"]',
          'div[class*="close"]',
          'button[class*="Close"]',
          'a[class*="Close"]',
          '[class*="popup-close"]',
          '[class*="modal-close"]',
          '[class*="overlay-close"]',
          '[class*="dismiss"]',
          '[class*="Dismiss"]',
          // Aria labels
          '[aria-label="Close"]',
          '[aria-label="close"]',
          '[aria-label="Kapat"]',
          '[aria-label="kapat"]',
          // Data attributes
          '[data-dismiss="modal"]',
          '[data-dismiss="popup"]',
          "[data-close]",
          '[data-action="close"]',
          // Common Turkish close patterns
          '[class*="kapat"]',
          '[class*="Kapat"]',
          // Bootstrap modal close
          ".modal .close",
          ".modal-header .close",
          ".btn-close",
          // Fancybox / lightbox close
          ".fancybox-close",
          ".fancybox-close-small",
          ".lightbox-close",
          // Generic X close buttons
          "button:has(> svg)", // buttons containing SVG icons (often X)
        ];

        for (const sel of closeSelectors) {
          try {
            const els = document.querySelectorAll(sel);
            els.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const style = window.getComputedStyle(htmlEl);
              // Only click if the element is visible
              if (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                htmlEl.offsetParent !== null
              ) {
                htmlEl.click();
              }
            });
          } catch {}
        }

        // Strategy 2: Click elements with X or × text content
        const allClickable = document.querySelectorAll(
          "button, a, span, div, i",
        );
        allClickable.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const text = htmlEl.textContent?.trim() || "";
          const style = window.getComputedStyle(htmlEl);
          if (
            (text === "×" ||
              text === "X" ||
              text === "x" ||
              text === "✕" ||
              text === "✖" ||
              text === "✗" ||
              text.toLowerCase() === "close" ||
              text.toLowerCase() === "kapat") &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            htmlEl.offsetParent !== null
          ) {
            htmlEl.click();
          }
        });

        // Strategy 3: Force-hide common overlay/modal containers
        const overlaySelectors = [
          '[class*="popup"]',
          '[class*="Popup"]',
          '[class*="modal"]',
          '[class*="Modal"]',
          '[class*="overlay"]',
          '[class*="Overlay"]',
          '[class*="lightbox"]',
          '[class*="Lightbox"]',
          '[id*="popup"]',
          '[id*="Popup"]',
          '[id*="modal"]',
          '[id*="Modal"]',
          '[id*="overlay"]',
          '[id*="Overlay"]',
          ".fancybox-container",
          ".fancybox-overlay",
        ];

        for (const sel of overlaySelectors) {
          try {
            const els = document.querySelectorAll(sel);
            els.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const rect = htmlEl.getBoundingClientRect();
              // Only hide if it looks like a covering overlay (large enough)
              if (rect.width > 200 && rect.height > 200) {
                const style = window.getComputedStyle(htmlEl);
                const pos = style.position;
                // Only remove fixed/absolute positioned overlays
                if (pos === "fixed" || pos === "absolute") {
                  htmlEl.style.display = "none";
                }
              }
            });
          } catch {}
        }

        // Strategy 4: Restore body scroll (popups often add overflow:hidden)
        document.body.style.overflow = "auto";
        document.body.style.overflowY = "auto";
        document.documentElement.style.overflow = "auto";
      });
      console.log("[scraper] Popup dismiss executed.");
    } catch (e) {
      console.log(`[scraper] Popup dismiss error (non-fatal): ${e}`);
    }

    // Small wait for any animations after closing popups
    await page.waitForTimeout(500);

    // Get final page content (html already captured during challenge resolution)
    try {
      html = await page.content();
    } catch {
      // If page is still navigating, wait and retry
      await page.waitForTimeout(2000);
      try {
        html = await page.content();
      } catch {}
    }
    const pageTitle = await page.title();
    const pageUrl = page.url();

    // Use the last document response (reflects real status after challenge redirect)
    const finalResponse = lastDocResponse || response;
    const httpStatusCode = botBlocked
      ? 403
      : finalResponse
        ? finalResponse.status()
        : null;
    const contentType = finalResponse
      ? finalResponse.headers()["content-type"] || ""
      : "";
    let responseHeaders: Record<string, string> = {};
    try {
      responseHeaders = finalResponse
        ? (finalResponse.headers() as Record<string, string>)
        : {};
    } catch {}

    if (finalResponse !== response && finalResponse) {
      console.log(
        `[scraper] Final status: ${finalResponse.status()} (initial was ${response?.status()})`,
      );
    }

    // Screenshot
    let screenshotBase64: string | null = null;
    if (screenshot) {
      const buf = await page.screenshot({ fullPage: false });
      screenshotBase64 = Buffer.from(buf).toString("base64");
    }

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Readable HTML via Readability
    let readableHtml = "";
    let readableTitle = "";
    try {
      const dom = new JSDOM(html, { url: pageUrl });
      const article = new Readability(dom.window.document).parse();
      if (article) {
        readableHtml = article.content || "";
        readableTitle = article.title || "";
      }
    } catch {}

    // Markdown via Turndown
    let markdown = "";
    try {
      if (readableHtml) {
        markdown = turndown.turndown(readableHtml);
        if (readableTitle) {
          markdown = `# ${readableTitle}\n\n${markdown}`;
        }
      }
    } catch {}

    // Build result
    const result: ScrapeResult = {
      url: pageUrl,

      crawl: {
        loadedUrl: pageUrl,
        loadedTime: new Date().toISOString(),
        referrerUrl: url,
        httpStatusCode,
        depth: 0,
        contentType,
      },

      metadata: buildMetadata($, pageUrl, responseHeaders),

      html: readableHtml || null,
      markdown: markdown || null,
      screenshotUrl: screenshotBase64
        ? `data:image/png;base64,${screenshotBase64}`
        : null,
      timeTaken: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      networkSummary: {
        totalRequests: networkRequests.length,
        byType: networkRequests.reduce(
          (acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };

    // Build product data from jsonLd, metadata, microdata, and page content
    result.product = buildProductData($, result.metadata, pageUrl);

    // Optional extractors
    if (extractors.includes("links")) {
      result.links = extractLinks($, pageUrl);
    }
    if (extractors.includes("images")) {
      result.images = extractImages($, pageUrl);
    }
    if (extractors.includes("headings")) {
      result.headings = extractHeadings($);
    }
    if (extractors.includes("text")) {
      result.text = extractText($);
    }
    if (extractors.includes("prices")) {
      result.prices = extractPrices($);
    }
    if (extractors.includes("tables")) {
      result.tables = extractTables($);
    }
    if (fullHtml) {
      result.fullHtml = html;
    }

    return result;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── BUILD METADATA ─────────────────────────────────────────

function buildMetadata(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  responseHeaders: Record<string, string>,
): Metadata {
  const canonicalUrl = $('link[rel="canonical"]').attr("href") || pageUrl;
  const title = $("title").text().trim() || null;
  const description = $('meta[name="description"]').attr("content") || null;
  const author = $('meta[name="author"]').attr("content") || null;
  const keywords = $('meta[name="keywords"]').attr("content") || null;
  const languageCode = $("html").attr("lang") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;
  const favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    "/favicon.ico";

  // Open Graph
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property")?.replace("og:", "") || "";
    og[prop] = $(el).attr("content") || "";
  });

  // Twitter Card
  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr("name")?.replace("twitter:", "") || "";
    twitter[name] = $(el).attr("content") || "";
  });

  // JSON-LD
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      jsonLd.push(json);
    } catch {}
  });

  // Microdata
  const microdata: MicrodataItem[] = [];
  $("[itemtype]").each((_, el) => {
    const item: MicrodataItem = {
      itemtype: $(el).attr("itemtype") || "",
      properties: {},
    };
    $(el)
      .find("[itemprop]")
      .each((_, prop) => {
        const name = $(prop).attr("itemprop") || "";
        const value =
          $(prop).attr("content") ||
          $(prop).attr("href") ||
          $(prop).attr("src") ||
          $(prop).text().trim();
        item.properties[name] = value;
      });
    microdata.push(item);
  });

  // All meta tags
  const allMeta: MetaTag[] = [];
  $("meta").each((_, el) => {
    const attrs: MetaTag = {};
    const element = $(el);
    if (element.attr("name")) attrs.name = element.attr("name");
    if (element.attr("property")) attrs.property = element.attr("property");
    if (element.attr("content")) attrs.content = element.attr("content");
    if (element.attr("http-equiv"))
      attrs.httpEquiv = element.attr("http-equiv");
    if (element.attr("charset")) attrs.charset = element.attr("charset");
    if (Object.keys(attrs).length > 0) allMeta.push(attrs);
  });

  const metadata: Metadata = {
    canonicalUrl,
    title,
    description,
    author,
    keywords,
    languageCode,
    robots,
    favicon,
    jsonLd: jsonLd.length > 0 ? jsonLd : null,
    allMeta,
    headers: responseHeaders,
  };

  if (Object.keys(og).length > 0) metadata.openGraph = og;
  if (Object.keys(twitter).length > 0) metadata.twitter = twitter;
  if (microdata.length > 0) metadata.microdata = microdata;

  return metadata;
}

// ─── EXTRACTORS ─────────────────────────────────────────────

function extractLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): CollectionResult<LinkItem> {
  const links: LinkItem[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    const title = $(el).attr("title") || "";
    const rel = $(el).attr("rel") || "";
    if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
      links.push({
        href: resolveUrl(href, baseUrl),
        text: text.substring(0, 200),
        title,
        rel,
        isExternal: isExternalLink(href, baseUrl),
      });
    }
  });
  return { total: links.length, items: links };
}

function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): CollectionResult<ImageItem> {
  const images: ImageItem[] = [];
  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy") ||
      "";
    const alt = $(el).attr("alt") || "";
    const title = $(el).attr("title") || "";
    const width = $(el).attr("width") || "";
    const height = $(el).attr("height") || "";
    if (src) {
      images.push({ src: resolveUrl(src, baseUrl), alt, title, width, height });
    }
  });

  $("[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset") || "";
    srcset.split(",").forEach((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (parts[0]) {
        images.push({
          src: resolveUrl(parts[0], baseUrl),
          alt: "",
          title: "",
          descriptor: parts[1] || "",
        });
      }
    });
  });

  const unique = [...new Map(images.map((img) => [img.src, img])).values()];
  return { total: unique.length, items: unique };
}

function extractHeadings($: cheerio.CheerioAPI): HeadingsMap {
  const headings: HeadingsMap = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
  };
  for (let i = 1; i <= 6; i++) {
    const tag = `h${i}` as keyof HeadingsMap;
    $(tag).each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings[tag].push(text);
    });
  }
  return headings;
}

function extractText($: cheerio.CheerioAPI): TextContent {
  const clone = $.root().clone();
  clone.find("script, style, noscript, iframe").remove();
  const bodyText = clone.find("body").text().replace(/\s+/g, " ").trim();

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  const listItems: string[] = [];
  $("li").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 5 && text.length < 500) listItems.push(text);
  });

  return {
    bodyTextLength: bodyText.length,
    bodyTextPreview: bodyText.substring(0, 1000),
    paragraphs: paragraphs.slice(0, 50),
    listItems: listItems.slice(0, 50),
  };
}

function extractPrices($: cheerio.CheerioAPI): CollectionResult<PriceItem> {
  const prices: PriceItem[] = [];
  const priceSelectors = [
    '[class*="price"]',
    '[class*="Price"]',
    '[id*="price"]',
    '[id*="Price"]',
    "[data-price]",
    '[itemprop="price"]',
    '[class*="cost"]',
    '[class*="amount"]',
  ];

  const seen = new Set<string>();
  priceSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      const dataPrice = $(el).attr("data-price") || $(el).attr("content") || "";
      const priceMatch = text.match(
        /[$€£₺₹]?\s*[\d,.]+\s*(?:TL|USD|EUR|GBP|₺|TRY)?/gi,
      );
      if (priceMatch) {
        priceMatch.forEach((p) => {
          const cleaned = p.trim();
          if (cleaned.length > 1 && cleaned.length < 30 && !seen.has(cleaned)) {
            seen.add(cleaned);
            prices.push({
              text: cleaned,
              dataPrice,
              element: (el as any).tagName || "",
              class: $(el).attr("class") || "",
            });
          }
        });
      }
    });
  });

  return { total: prices.length, items: prices };
}

function extractTables(
  $: cheerio.CheerioAPI,
): CollectionResult<{ headers: string[]; rows: string[][] }> {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  $("table").each((i, table) => {
    if (i >= 10) return;
    const headers: string[] = [];
    const rows: string[][] = [];

    $(table)
      .find("th")
      .each((_, th) => {
        headers.push($(th).text().trim());
      });

    $(table)
      .find("tr")
      .each((_, tr) => {
        const cells: string[] = [];
        $(tr)
          .find("td")
          .each((_, td) => {
            cells.push($(td).text().trim());
          });
        if (cells.length > 0) rows.push(cells);
      });

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  });
  return { total: tables.length, items: tables };
}

// ─── BUILD PRODUCT DATA ─────────────────────────────────────

function buildProductData(
  $: cheerio.CheerioAPI,
  metadata: Metadata,
  pageUrl: string,
): ProductData {
  const jsonLdItems = metadata.jsonLd || [];
  const microdataItems = metadata.microdata || [];

  // ── Find ALL Product/ProductGroup JSON-LD entries ─────────
  const allProductLds: any[] = [];
  for (const item of jsonLdItems) {
    collectJsonLdProducts(item, allProductLds);
  }

  // Prefer ProductGroup over Product (it usually wraps variants)
  let productLd: any =
    allProductLds.find(
      (p) =>
        p["@type"] === "ProductGroup" ||
        (Array.isArray(p["@type"]) && p["@type"].includes("ProductGroup")),
    ) ||
    allProductLds[0] ||
    null;

  // ── Basic fields ──────────────────────────────────────────
  const productTitle =
    productLd?.name ||
    getProductMicrodata(microdataItems, "name") ||
    metadata.title ||
    null;

  const languageCode = metadata.languageCode || null;

  const productDescription =
    productLd?.description ||
    getProductMicrodata(microdataItems, "description") ||
    metadata.description ||
    null;

  const productBrand =
    (typeof productLd?.brand === "object"
      ? productLd?.brand?.name
      : productLd?.brand) ||
    getProductMicrodata(microdataItems, "brand") ||
    null;

  const productSku =
    productLd?.sku ||
    productLd?.mpn ||
    productLd?.productID ||
    getProductMicrodata(microdataItems, "sku") ||
    getProductMicrodata(microdataItems, "mpn") ||
    null;

  // ── Weight ────────────────────────────────────────────────
  let productWeight: string | null = null;
  if (productLd?.weight) {
    productWeight =
      typeof productLd.weight === "object"
        ? `${productLd.weight.value || ""} ${productLd.weight.unitText || productLd.weight.unitCode || ""}`.trim()
        : String(productLd.weight);
  }
  if (!productWeight && productTitle) {
    const weightMatch = productTitle.match(
      /(\d+[\.,]?\d*)\s*(ml|l|g|kg|oz|fl\s*oz|lb|lbs|cl|mg|mm|cm|m)\b/i,
    );
    if (weightMatch) {
      productWeight = `${weightMatch[1]} ${weightMatch[2]}`;
    }
  }

  // ── Price data ────────────────────────────────────────────
  const offers = normalizeOffers(productLd?.offers);
  const mainOffer = offers[0] || null;

  let currency =
    mainOffer?.priceCurrency ||
    getProductMicrodata(microdataItems, "priceCurrency") ||
    null;
  let sellPrice = parsePrice(
    mainOffer?.price ??
      mainOffer?.lowPrice ??
      getProductMicrodata(microdataItems, "price"),
  );
  let regularPrice = parsePrice(mainOffer?.highPrice) || sellPrice;

  // If sell == regular, there's no discount
  if (regularPrice && sellPrice && regularPrice === sellPrice) {
    regularPrice = sellPrice;
  }

  // Fallback: scrape visible prices from page
  if (sellPrice === null) {
    const pagePrices = extractVisiblePrices($);
    if (pagePrices.sell !== null) {
      sellPrice = pagePrices.sell;
      regularPrice = pagePrices.regular ?? pagePrices.sell;
      if (!currency) currency = pagePrices.currency;
    }
  }

  const priceTry =
    currency || sellPrice !== null
      ? {
          currency: currency || "TRY",
          productRegularPrice: regularPrice,
          productSellPrice: sellPrice,
        }
      : null;

  // ── In stock ──────────────────────────────────────────────
  let productInStock: boolean | null = null;
  if (mainOffer?.availability) {
    const avail = String(mainOffer.availability).toLowerCase();
    productInStock =
      avail.includes("instock") ||
      avail.includes("in_stock") ||
      avail.includes("limitedavailability");
  } else {
    const microAvail = getProductMicrodata(microdataItems, "availability");
    if (microAvail) {
      productInStock =
        microAvail.toLowerCase().includes("instock") ||
        microAvail.toLowerCase().includes("in_stock");
    }
  }

  // ── Images ────────────────────────────────────────────────
  const productImagelinks: string[] = [];
  // From JSON-LD
  if (productLd?.image) {
    const imgs = Array.isArray(productLd.image)
      ? productLd.image
      : [productLd.image];
    for (const img of imgs) {
      const src = typeof img === "object" ? img.url || img.contentUrl : img;
      if (src && typeof src === "string") {
        productImagelinks.push(resolveUrl(src, pageUrl));
      }
    }
  }
  // From OG image
  if (metadata.openGraph?.image) {
    const ogImg = resolveUrl(metadata.openGraph.image, pageUrl);
    if (!productImagelinks.includes(ogImg)) {
      productImagelinks.push(ogImg);
    }
  }
  // From page product image selectors
  const productImgSelectors = [
    '[class*="product"] img[src]',
    '[class*="gallery"] img[src]',
    '[id*="product"] img[src]',
    "[data-product] img[src]",
    '[itemprop="image"]',
  ];
  for (const sel of productImgSelectors) {
    $(sel).each((_, el) => {
      const src =
        $(el).attr("src") ||
        $(el).attr("data-src") ||
        $(el).attr("content") ||
        $(el).attr("href") ||
        "";
      if (src && !src.startsWith("data:")) {
        const resolved = resolveUrl(src, pageUrl);
        if (!productImagelinks.includes(resolved)) {
          productImagelinks.push(resolved);
        }
      }
    });
  }

  // ── Features ──────────────────────────────────────────────
  let productFeatures: string | null = null;
  // Try JSON-LD additionalProperty
  if (productLd?.additionalProperty) {
    const props = Array.isArray(productLd.additionalProperty)
      ? productLd.additionalProperty
      : [productLd.additionalProperty];
    const feats = props
      .map((p: any) => `${p.name || ""}: ${p.value || ""}`.trim())
      .filter(Boolean);
    if (feats.length > 0) productFeatures = feats.join(", ");
  }
  // Try page feature selectors
  if (!productFeatures) {
    const featureSelectors = [
      '[class*="feature"]',
      '[class*="spec"]',
      '[class*="attribute"]',
      '[id*="feature"]',
      '[id*="spec"]',
    ];
    const feats: string[] = [];
    for (const sel of featureSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 500) {
          feats.push(text);
        }
      });
      if (feats.length > 0) break;
    }
    if (feats.length > 0) productFeatures = feats.slice(0, 10).join(", ");
  }

  // ── Variants ──────────────────────────────────────────────
  const variants: ProductVariant[] = [];

  // Strategy 1: hasVariant on main product or any product LD (ProductGroup / Product)
  const hasVariantSource = allProductLds.find((p) => p.hasVariant);
  if (hasVariantSource?.hasVariant) {
    const variantList = Array.isArray(hasVariantSource.hasVariant)
      ? hasVariantSource.hasVariant
      : [hasVariantSource.hasVariant];
    for (const v of variantList) {
      variants.push(
        buildVariantFromLd(
          v,
          productSku,
          productWeight,
          productImagelinks,
          productInStock,
          pageUrl,
        ),
      );
    }
  }

  // Strategy 2: model property (some sites use model instead of hasVariant)
  if (variants.length === 0 && productLd?.model) {
    const models = Array.isArray(productLd.model)
      ? productLd.model
      : [productLd.model];
    for (const m of models) {
      if (m && typeof m === "object") {
        variants.push(
          buildVariantFromLd(
            m,
            productSku,
            productWeight,
            productImagelinks,
            productInStock,
            pageUrl,
          ),
        );
      }
    }
  }

  // Strategy 3: offers contain itemOffered (each offer wraps a variant product)
  if (variants.length === 0) {
    const offersWithItem = offers.filter((o: any) => o.itemOffered);
    if (offersWithItem.length > 0) {
      for (const offer of offersWithItem) {
        const item = offer.itemOffered;
        const v: any = { ...item, offers: offer };
        variants.push(
          buildVariantFromLd(
            v,
            productSku,
            productWeight,
            productImagelinks,
            productInStock,
            pageUrl,
          ),
        );
      }
    }
  }

  // Strategy 4: multiple offers (each offer is a variant)
  if (variants.length === 0 && offers.length > 1) {
    for (const offer of offers) {
      variants.push({
        option_name: offer.name ? "Title" : null,
        option_value: offer.name || offer.sku || offer.description || null,
        variant_price_try: parsePrice(offer.price ?? offer.lowPrice),
        variant_compare_at_price_try: parsePrice(offer.highPrice) || null,
        variant_sku: offer.sku || offer.mpn || productSku || null,
        variant_weight:
          extractWeightFromText(offer.name || "") || productWeight,
        variant_size: extractVariantProp(offer, "size"),
        variant_image:
          resolveVariantImage(offer, pageUrl) || productImagelinks[0] || null,
        variant_in_stock: parseAvailability(offer.availability, productInStock),
      });
    }
  }

  // Strategy 5: multiple Product JSON-LD blocks across different script tags (one per variant)
  if (variants.length === 0 && allProductLds.length > 1) {
    // Only treat as variants if they share a similar name pattern or all have offers
    const productBlocks = allProductLds.filter(
      (p) => p["@type"] === "Product" || p["@type"] === "IndividualProduct",
    );
    if (productBlocks.length > 1) {
      for (const p of productBlocks) {
        variants.push(
          buildVariantFromLd(
            p,
            productSku,
            productWeight,
            productImagelinks,
            productInStock,
            pageUrl,
          ),
        );
      }
    }
  }

  // Fallback: if no variants found, create a single default variant from main product
  if (variants.length === 0) {
    variants.push({
      option_name: null,
      option_value: null,
      variant_price_try: sellPrice,
      variant_compare_at_price_try:
        regularPrice !== sellPrice ? regularPrice : null,
      variant_sku: productSku,
      variant_weight: productWeight,
      variant_size: null,
      variant_image: productImagelinks[0] || null,
      variant_in_stock: productInStock,
    });
  }

  return {
    productTitle,
    languageCode,
    productWeight,
    priceTry,
    productDescription,
    productFeatures,
    productImagelinks,
    variants,
    productInStock,
    productSku,
    productBrand,
    productUrl: pageUrl,
  };
}

// ── Product helpers ─────────────────────────────────────────

const PRODUCT_TYPES = new Set([
  "Product",
  "IndividualProduct",
  "ProductGroup",
  "ProductModel",
  "ProductCollection",
]);

function isProductType(type: any): boolean {
  if (!type) return false;
  if (typeof type === "string") return PRODUCT_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => PRODUCT_TYPES.has(t));
  return false;
}

/** Recursively collect ALL JSON-LD objects that are Product-like */
function collectJsonLdProducts(obj: any, results: any[]): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectJsonLdProducts(item, results);
    return;
  }
  if (isProductType(obj["@type"])) {
    results.push(obj);
  }
  // Recurse into @graph
  if (obj["@graph"]) {
    collectJsonLdProducts(obj["@graph"], results);
  }
  // Recurse into mainEntity
  if (obj.mainEntity) {
    collectJsonLdProducts(obj.mainEntity, results);
  }
  // Recurse into mainEntityOfPage
  if (obj.mainEntityOfPage && typeof obj.mainEntityOfPage === "object") {
    collectJsonLdProducts(obj.mainEntityOfPage, results);
  }
}

/** Normalize offers to an array (handles AggregateOffer, nested offers, etc.) */
function normalizeOffers(offers: any): any[] {
  if (!offers) return [];
  if (Array.isArray(offers)) {
    // Could be an array of Offers or array of AggregateOffers
    const flat: any[] = [];
    for (const o of offers) {
      flat.push(...normalizeOffers(o));
    }
    return flat;
  }
  if (
    offers["@type"] === "AggregateOffer" ||
    offers["@type"] === "AggregateOfferEnumeration"
  ) {
    if (offers.offers) {
      return Array.isArray(offers.offers) ? offers.offers : [offers.offers];
    }
    return [offers];
  }
  return [offers];
}

/** Build a ProductVariant from a JSON-LD variant/product entry */
function buildVariantFromLd(
  v: any,
  fallbackSku: string | null,
  fallbackWeight: string | null,
  fallbackImages: string[],
  fallbackInStock: boolean | null,
  pageUrl: string,
): ProductVariant {
  const vOffers = normalizeOffers(v.offers);
  const vOffer = vOffers[0] || null;

  // Determine option name/value from variant properties
  let optionName: string | null = v.name ? "Title" : null;
  let optionValue: string | null = v.name || null;

  // Try to extract specific variant dimensions (color, size, etc.)
  if (v.color) {
    optionName = "Color";
    optionValue =
      typeof v.color === "object" ? v.color.name || v.color : v.color;
  } else if (v.size) {
    optionName = "Size";
    optionValue = typeof v.size === "object" ? v.size.name || v.size : v.size;
  } else if (v.additionalProperty) {
    const props = Array.isArray(v.additionalProperty)
      ? v.additionalProperty
      : [v.additionalProperty];
    if (props.length > 0) {
      optionName = props[0].name || null;
      optionValue = props[0].value || v.name || null;
    }
  }
  // Also check variesBy or variant identifiers
  if (v.sku && !optionValue) {
    optionValue = v.sku;
  }

  return {
    option_name: optionName,
    option_value: optionValue !== null ? String(optionValue) : null,
    variant_price_try: parsePrice(vOffer?.price ?? vOffer?.lowPrice ?? v.price),
    variant_compare_at_price_try: parsePrice(vOffer?.highPrice) || null,
    variant_sku:
      v.sku ||
      v.mpn ||
      v.productID ||
      v.gtin13 ||
      v.gtin ||
      fallbackSku ||
      null,
    variant_weight:
      extractWeightFromText(v.name || "") ||
      (v.weight
        ? typeof v.weight === "object"
          ? `${v.weight.value || ""} ${v.weight.unitText || v.weight.unitCode || ""}`.trim()
          : String(v.weight)
        : null) ||
      fallbackWeight,
    variant_size: extractVariantProp(v, "size"),
    variant_image: resolveVariantImage(v, pageUrl) || fallbackImages[0] || null,
    variant_in_stock: vOffer?.availability
      ? parseAvailability(vOffer.availability, fallbackInStock)
      : v.offers?.availability
        ? parseAvailability(v.offers.availability, fallbackInStock)
        : fallbackInStock,
  };
}

/** Resolve an image URL from a JSON-LD variant/offer object */
function resolveVariantImage(obj: any, pageUrl: string): string | null {
  const img = obj.image;
  if (!img) return null;
  if (typeof img === "string") return resolveUrl(img, pageUrl);
  if (Array.isArray(img)) {
    const first = img[0];
    if (typeof first === "string") return resolveUrl(first, pageUrl);
    if (first?.url) return resolveUrl(first.url, pageUrl);
    if (first?.contentUrl) return resolveUrl(first.contentUrl, pageUrl);
  }
  if (img.url) return resolveUrl(img.url, pageUrl);
  if (img.contentUrl) return resolveUrl(img.contentUrl, pageUrl);
  return null;
}

/** Extract a specific variant property (size, color, etc.) */
function extractVariantProp(obj: any, prop: string): string | null {
  // Direct property
  if (obj[prop]) {
    return typeof obj[prop] === "object"
      ? obj[prop].name || obj[prop].value || String(obj[prop])
      : String(obj[prop]);
  }
  // From additionalProperty array
  if (obj.additionalProperty) {
    const props = Array.isArray(obj.additionalProperty)
      ? obj.additionalProperty
      : [obj.additionalProperty];
    const match = props.find(
      (p: any) => p.name?.toLowerCase() === prop.toLowerCase(),
    );
    if (match) return match.value || null;
  }
  return null;
}

/** Parse availability string to boolean */
function parseAvailability(
  availability: any,
  fallback: boolean | null,
): boolean | null {
  if (!availability) return fallback;
  const avail = String(availability).toLowerCase();
  if (
    avail.includes("instock") ||
    avail.includes("in_stock") ||
    avail.includes("limitedavailability")
  )
    return true;
  if (
    avail.includes("outofstock") ||
    avail.includes("out_of_stock") ||
    avail.includes("discontinued") ||
    avail.includes("soldout")
  )
    return false;
  return fallback;
}

/** Parse a price string/number to a number or null */
function parsePrice(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value)
    .replace(/[^\d.,\-]/g, "")
    .replace(/\.(?=.*\.)/g, "") // remove all dots except the last
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Extract weight from a text string */
function extractWeightFromText(text: string): string | null {
  if (!text) return null;
  const m = text.match(
    /(\d+[\.,]?\d*)\s*(ml|l|g|kg|oz|fl\s*oz|lb|lbs|cl|mg|mm|cm|m)\b/i,
  );
  return m ? `${m[1]} ${m[2]}` : null;
}

/** Get a property from microdata items with Product type */
function getProductMicrodata(
  items: { itemtype: string; properties: Record<string, string> }[],
  prop: string,
): string | null {
  for (const item of items) {
    if (
      item.itemtype.toLowerCase().includes("product") ||
      item.itemtype.toLowerCase().includes("offer")
    ) {
      if (item.properties[prop]) return item.properties[prop];
    }
  }
  return null;
}

/** Fallback: extract visible prices from the page using common selectors */
function extractVisiblePrices($: cheerio.CheerioAPI): {
  sell: number | null;
  regular: number | null;
  currency: string | null;
} {
  let sell: number | null = null;
  let regular: number | null = null;
  let currency: string | null = null;

  // Sale / current price selectors
  const sellSelectors = [
    '[class*="sale-price"]',
    '[class*="salePrice"]',
    '[class*="selling-price"]',
    '[class*="sellingPrice"]',
    '[class*="discounted"]',
    '[class*="current-price"]',
    '[class*="currentPrice"]',
    '[itemprop="price"]',
    "[data-price]",
  ];
  // Regular / old price selectors
  const regularSelectors = [
    '[class*="old-price"]',
    '[class*="oldPrice"]',
    '[class*="original-price"]',
    '[class*="originalPrice"]',
    '[class*="regular-price"]',
    '[class*="regularPrice"]',
    '[class*="list-price"]',
    '[class*="listPrice"]',
    'del [class*="price"]',
    's [class*="price"]',
  ];

  for (const sel of sellSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const val =
        el.attr("content") || el.attr("data-price") || el.text().trim();
      sell = parsePrice(val);
      if (sell !== null) break;
    }
  }

  for (const sel of regularSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const val =
        el.attr("content") || el.attr("data-price") || el.text().trim();
      regular = parsePrice(val);
      if (regular !== null) break;
    }
  }

  // Try to detect currency from page
  const priceText = $('[itemprop="price"], [class*="price"]')
    .first()
    .text()
    .trim();
  if (priceText) {
    if (priceText.includes("₺") || priceText.includes("TL")) currency = "TRY";
    else if (priceText.includes("$")) currency = "USD";
    else if (priceText.includes("€")) currency = "EUR";
    else if (priceText.includes("£")) currency = "GBP";
  }

  return { sell, regular, currency };
}

// ─── HELPERS ────────────────────────────────────────────────

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function isExternalLink(href: string, base: string): boolean {
  try {
    const linkHost = new URL(href, base).hostname;
    const baseHost = new URL(base).hostname;
    return linkHost !== baseHost;
  } catch {
    return false;
  }
}
