import { chromium } from "playwright";
(async () => {
    console.log("launching...");
    const b = await chromium.launch({ headless: false, channel: "chrome" });
    const p = await b.newPage();
    await p.goto("https://google.com");
    console.log("launched!");
    await new Promise(r => setTimeout(r, 5000));
    await b.close();
})();
