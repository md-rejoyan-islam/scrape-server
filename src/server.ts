import { app } from "./app.js";
import { PORT } from "./config/index.js";
import { closeBrowser } from "./utils/scraper.js";

// ─── START ──────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Scrape Server running at http://localhost:${PORT}`);
  console.log(`📡 API:  http://localhost:${PORT}/api/scrape`);
  console.log(`📖 Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🖥️  UI:   http://localhost:${PORT}\n`);
});

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────────

const shutdown = async () => {
  console.log("\nShutting down...");
  await closeBrowser();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
