const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const path = require("path");

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    // Launch puppeteer-real-browser to bypass Cloudflare and similar advanced bots
    const puppeteer = require("puppeteer");
    process.env.CHROME_PATH = puppeteer.executablePath();
    const { connect } = require("puppeteer-real-browser");
    const { browser, page } = await connect({
      headless: false,
      args: [],
      customConfig: {
        executablePath: puppeteer.executablePath(),
      },
      turnstile: true,
      connectOption: {},
      disableXvfb: false,
      ignoreAllFlags: false,
    });

    // Route to URL
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait 10 seconds to let Cloudflare JS challenge execute and pass
    await new Promise((r) => setTimeout(r, 10000));

    const content = await page.content();
    await browser.close();

    const $ = cheerio.load(content);

    // Extract basic product details using common meta tags or selectors
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "N/A";
    const image =
      $('meta[property="og:image"]').attr("content") ||
      $("img").first().attr("src") ||
      "N/A";
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "N/A";

    // Heuristic for price parsing
    let price =
      $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[property="og:price:amount"]').attr("content") ||
      $(".price").first().text().trim() ||
      $('[class*="price"]').first().text().trim() ||
      "N/A";

    // Clean price text if it has extra spaces
    if (price !== "N/A") {
      price = price.replace(/\s+/g, " ");
    }

    return res.json({
      title,
      image,
      description,
      price,
      url,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return res
      .status(500)
      .json({ error: "Failed to scrape data", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
