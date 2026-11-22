// Captures raw Typo Tyrant screens from the web build for App Store screenshots.
// Usage: start the web build (npx expo start --web --port 8081), then from this folder:
//   npm i --no-save playwright@1.52.0 && npx playwright install chromium
//   node capture.mjs && node compose.mjs
// Raw captures go to ./raw (git-ignored); framed screenshots go to store/screenshots.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = "http://localhost:8081";
const OUT = URL_("./raw/");
function URL_(p) { return new globalThis.URL(p, import.meta.url).pathname; }
mkdirSync(OUT, { recursive: true });

// Safe areas (points) of iPhone 6.9" (status bar + Dynamic Island, home indicator) and iPad 13".
const DEVICES = {
  phone: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, insets: { top: 62, bottom: 34 } },
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, insets: { top: 24, bottom: 20 } },
};

const ONLY = process.env.ONLY || "12345"; // add "6" for the purchase review screenshot
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, dev) {
  const { insets, ...opts } = DEVICES[dev];
  const ctx = await browser.newContext({ ...opts, colorScheme: "dark" });
  const page = await ctx.newPage();
  // Headless Chromium reports env(safe-area-inset-*) as 0. react-native-safe-area-context measures a hidden
  // element padded with those env() values, so answer that measurement with the real device's safe area.
  await page.addInitScript(({ top, bottom }) => {
    const real = window.getComputedStyle.bind(window);
    window.getComputedStyle = (el, pseudo) => {
      const cs = real(el, pseudo);
      if (!el?.style?.cssText?.includes("safe-area-inset")) return cs;
      return new Proxy(cs, {
        get(t, k) {
          if (k === "paddingTop") return `${top}px`;
          if (k === "paddingBottom") return `${bottom}px`;
          if (k === "paddingLeft" || k === "paddingRight") return "0px";
          const v = t[k];
          return typeof v === "function" ? v.bind(t) : v;
        },
      });
    };
  }, insets);
  await page.goto(URL);
  await page.waitForSelector("text=CHOOSE YOUR QUEST", { timeout: 60000 });
  await sleep(1500);
  return { ctx, page };
}

const clickText = (page, t) => page.locator(`text="${t}"`).first().click();

// Type the current word (or its first n letters) into the hidden input.
const typeWord = (page, n) =>
  page.evaluate(n => {
    const inp = document.querySelector('input[aria-label="Type here"]');
    const w = document.querySelector('[aria-label^="Word "]')?.getAttribute("aria-label")?.slice(5);
    if (!inp || !w) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(inp, n == null ? w : w.slice(0, n));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, n);

const freeze = page => page.evaluate(() => { window.requestAnimationFrame = () => 0; });

async function shot(page, dev, name) {
  // On a phone the keyboard is already up during play; hide the web-only "tap for keyboard" hint.
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("div")) if (e.childElementCount === 0 && e.textContent === "Tap here to bring up the keyboard") e.style.visibility = "hidden";
  });
  await sleep(150);
  await page.screenshot({ path: `${OUT}${dev}-${name}.png` });
  console.log("saved", dev, name);
}

async function scenes(browser, dev) {
  // 1. Menu with Tower Climb selected
  if (ONLY.includes("1")) {
    const { ctx, page } = await open(browser, dev);
    await page.locator('[aria-label^="Tower Climb"]').first().click();
    await sleep(900);
    await shot(page, dev, "1-menu");
    await ctx.close();
  }
  // 2. Gameplay: play a while, then stop mid-word
  if (ONLY.includes("2")) {
    const { ctx, page } = await open(browser, dev);
    await clickText(page, "Begin · Medium");
    const dismiss = () =>
      page.evaluate(() => {
        const b = [...document.querySelectorAll("div")].find(e => e.childElementCount === 0 && /^Keep (?!or swap)/.test(e.textContent || ""));
        if (b) { b.click(); return true; }
        return false;
      });
    const state = () =>
      page.evaluate(() => ({
        boss: !!document.querySelector('[aria-label*="health left"]'),
        len: (document.querySelector('[aria-label^="Word "]')?.getAttribute("aria-label")?.length ?? 5) - 5,
        text: document.body.innerText,
      }));
    for (let i = 0; i < 80; i++) {
      await dismiss();
      const st = await state();
      // Round 3, not in a boss fight, a longer word showing, and no pop-up: stop here.
      if (i > 20 && /ROUND\n3/.test(st.text) && !st.boss && st.len >= 6 && !/Keep or swap|BOSS/.test(st.text)) break;
      await typeWord(page);
      await sleep(450);
    }
    await typeWord(page, 3);
    await sleep(700);
    await freeze(page);
    await shot(page, dev, "2-play");
    await ctx.close();
  }
  // 3. Boss Rush: first boss, a few letters in
  if (ONLY.includes("3")) {
    const { ctx, page } = await open(browser, dev);
    await page.locator('[aria-label^="Boss Rush"]').first().click();
    await sleep(500);
    await clickText(page, "Begin the rush");
    await page.waitForSelector('[aria-label*="health left"]', { timeout: 20000 });
    await sleep(500);
    await typeWord(page); await sleep(900);
    await typeWord(page, 2); await sleep(700);
    await freeze(page);
    await shot(page, dev, "3-boss");
    await ctx.close();
  }
  // 4. Customize with every theme unlocked (developer switch), 5. Retro Court menu
  if (ONLY.includes("4")) {
    const { ctx, page } = await open(browser, dev);
    await page.locator('[aria-label="Settings"]').first().click();
    await sleep(600);
    const row = page.locator('text="Unlock all themes & packs"').first();
    await row.scrollIntoViewIfNeeded();
    const switches = page.locator('[role="switch"], input[type="checkbox"]');
    await switches.last().click();
    await sleep(400);
    await clickText(page, "Done");
    await sleep(600);
    await clickText(page, "Customize");
    await sleep(900);
    await shot(page, dev, "4-customize");
    await page.locator('[aria-label^="Retro Court style"]').first().click();
    await sleep(600);
    await clickText(page, "Done");
    await sleep(1200);
    await shot(page, dev, "5-retro");
    await ctx.close();
  }
}

// 6. Paywall, for the in-app purchase's review screenshot in App Store Connect (saved unframed).
async function paywall(browser, dev) {
  const { ctx, page } = await open(browser, dev);
  await clickText(page, "Typo Tyrant Pro");
  await page.waitForSelector('text="Unlock everything"');
  await sleep(900);
  // The web build has no App Store, so it shows a development-only "Test mode" note; real builds never do.
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("div"))
      if (e.childElementCount === 0 && (e.textContent || "").startsWith("Test mode:")) e.style.display = "none";
  });
  await shot(page, dev, "6-paywall");
  await ctx.close();
}

const browser = await chromium.launch();
if (ONLY.includes("6")) await paywall(browser, "phone");
for (const dev of process.argv.slice(2).length ? process.argv.slice(2) : ["phone", "ipad"]) {
  await scenes(browser, dev);
}
await browser.close();
