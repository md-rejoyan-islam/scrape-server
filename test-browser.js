const { chromium } = require("playwright-extra");
chromium.launch({ headless: false, channel: "chrome" }).then(async b => {
  console.log("Launched!");
  const page = await b.newPage();
  await page.goto("https://example.com");
  console.log("Navigated!");
  setTimeout(() => b.close(), 5000);
});
