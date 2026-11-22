// Frames the raw captures in a drawn iPhone / iPad with a caption, at App Store sizes, into store/screenshots.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const RAW = new URL("./raw/", import.meta.url).pathname;
const font = (fam, w) =>
  readFileSync(`${REPO}/node_modules/@expo-google-fonts/${fam.toLowerCase()}/${w}/${fam}_${w}.ttf`).toString("base64");
const OUTFIT_BOLD = font("Outfit", "700Bold");
const OUTFIT_SEMI = font("Outfit", "600SemiBold");
const INTER_SEMI = font("Inter", "600SemiBold");

const SHOTS = [
  ["1-menu", "Spell to survive", "Type each word before the clock runs out"],
  ["2-play", "Faster every round", "Build combos and earn power-ups"],
  ["3-boss", "Defeat the bosses", "Then face the Typo Tyrant at the top"],
  ["4-customize", "Make it yours", "Unlock themes and word packs as you play"],
  ["5-retro", "Unlock Retro Court", "A pixel-castle style with a chiptune score"],
];

// Device geometry in points; k scales points to output pixels.
const SIZES = {
  phone: {
    dir: "iphone-6.9", w: 1320, h: 2868, capTop: 170, title: 116, sub: 54, deviceTop: 490, k: 2.33,
    screen: { w: 430, h: 932, radius: 56 }, bezel: 12, bodyRadius: 68,
    statusH: 62, time: "9:41", island: { w: 126, h: 37, top: 11 }, home: { w: 140, bottom: 8 },
    // [side, top, length] in points
    buttons: [["left", 118, 32], ["left", 172, 58], ["left", 244, 58], ["right", 200, 96]],
  },
  ipad: {
    dir: "ipad-13", w: 2064, h: 2752, capTop: 160, title: 124, sub: 58, deviceTop: 480, k: 1.53,
    screen: { w: 1032, h: 1376, radius: 18 }, bezel: 22, bodyRadius: 40,
    statusH: 24, time: "9:41  Sun Nov 22", home: { w: 320, bottom: 7 }, camera: true,
    buttons: [["top", 860, 70], ["right", 80, 52], ["right", 146, 52]],
  },
};

// Status bar glyphs (white), drawn at a given height in points.
const signal = h =>
  `<svg height="${h}" viewBox="0 0 18 12"><g fill="#fff">${[0, 1, 2, 3]
    .map(i => `<rect x="${i * 5}" y="${9 - i * 3}" width="3.2" height="${3 + i * 3}" rx="0.8"/>`)
    .join("")}</g></svg>`;
const wifi = h =>
  `<svg height="${h}" viewBox="0 0 16 12"><g fill="#fff"><path d="M8 11.6 5.6 9.1a3.4 3.4 0 0 1 4.8 0z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0L11.2 8.3a4.5 4.5 0 0 0-6.4 0z"/><path d="M1.1 4.6a9.8 9.8 0 0 1 13.8 0L13.5 6a7.8 7.8 0 0 0-11 0z"/></g></svg>`;
const battery = h =>
  `<svg height="${h}" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.6" fill="none" stroke="#fff" stroke-opacity="0.45"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="#fff"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="#fff" fill-opacity="0.45"/></svg>`;

function device(z, img) {
  const k = z.k;
  const p = v => `${(v * k).toFixed(1)}px`;
  const sw = z.screen.w, sh = z.screen.h, b = z.bezel;
  const bw = sw + 2 * b, bh = sh + 2 * b;
  const phone = !!z.island;
  const iconH = phone ? 12 : 10;

  const buttons = z.buttons
    .map(([side, at, len]) => {
      const t = 3.2; // how far a button sticks out
      if (side === "top") return `<div class="btn" style="left:${p(at)};top:${p(-t)};width:${p(len)};height:${p(t + 2)}"></div>`;
      const x = side === "left" ? -t : bw - 2;
      return `<div class="btn" style="left:${p(x)};top:${p(at)};width:${p(t + 2)};height:${p(len)}"></div>`;
    })
    .join("");

  const status = phone
    ? `<div class="sb" style="height:${p(z.island.top * 2 + z.island.h)}">
         <div class="ear" style="width:${p((sw - z.island.w) / 2)}"><span style="font-size:${p(17)}">${z.time}</span></div>
         <div style="width:${p(z.island.w)}"></div>
         <div class="ear" style="width:${p((sw - z.island.w) / 2)};gap:${p(6)}">${signal(p(iconH))}${wifi(p(iconH))}${battery(p(iconH + 1))}</div>
       </div>
       <div class="island" style="top:${p(z.island.top)};left:${p((sw - z.island.w) / 2)};width:${p(z.island.w)};height:${p(z.island.h)};border-radius:${p(z.island.h / 2)}"></div>`
    : `<div class="sb ipad" style="height:${p(z.statusH)};padding:0 ${p(20)}">
         <span style="font-size:${p(13)}">${z.time}</span>
         <div style="display:flex;align-items:center;gap:${p(6)}">${wifi(p(iconH))}${battery(p(iconH + 1))}</div>
       </div>`;

  return `
  <div class="body" style="left:${(z.w - bw * k) / 2}px;top:${z.deviceTop}px;width:${p(bw)};height:${p(bh)};border-radius:${p(z.bodyRadius)}">
    ${buttons}
    <div class="rim" style="border-radius:${p(z.bodyRadius)};padding:${p(2.2)}">
      <div class="bezel" style="border-radius:${p(z.bodyRadius - 2.2)};padding:${p(b - 2.2)}">
        <div class="screen" style="border-radius:${p(z.screen.radius)}">
          <img src="data:image/png;base64,${img}">
          ${status}
          <div class="home" style="width:${p(z.home.w)};height:${p(5)};bottom:${p(z.home.bottom)};left:${p((sw - z.home.w) / 2)}"></div>
        </div>
      </div>
    </div>
    ${z.camera ? `<div class="cam" style="left:${p(bw / 2 - 3)};top:${p(b / 2 - 3)};width:${p(6)};height:${p(6)}"></div>` : ""}
  </div>`;
}

const page = await (await chromium.launch()).newPage();
for (const [dev, z] of Object.entries(SIZES)) {
  const out = `${REPO}/store/screenshots/${z.dir}`;
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: z.w, height: z.h });
  for (const [i, [name, title, sub]] of SHOTS.entries()) {
    const img = readFileSync(`${RAW}${dev}-${name}.png`).toString("base64");
    await page.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: O; font-weight: 700; src: url(data:font/ttf;base64,${OUTFIT_BOLD}); }
      @font-face { font-family: O; font-weight: 600; src: url(data:font/ttf;base64,${OUTFIT_SEMI}); }
      @font-face { font-family: I; font-weight: 600; src: url(data:font/ttf;base64,${INTER_SEMI}); }
      html, body { margin: 0; width: ${z.w}px; height: ${z.h}px; overflow: hidden; }
      body {
        background-color: #140B22;
        background-image:
          radial-gradient(circle at 50% 8%, rgba(255,170,90,0.36), transparent 34%),
          radial-gradient(circle at 92% 46%, rgba(170,90,255,0.26), transparent 40%),
          radial-gradient(circle at 6% 74%, rgba(255,90,130,0.20), transparent 38%);
        font-family: O, sans-serif; text-align: center; position: relative;
      }
      .cap { position: absolute; left: 0; right: 0; top: ${z.capTop}px; }
      h1 { margin: 0; font-weight: 700; font-size: ${z.title}px; line-height: 1.1; letter-spacing: -1px;
        background: linear-gradient(180deg, #FFE7A6, #F2B544); -webkit-background-clip: text; background-clip: text; color: transparent;
        filter: drop-shadow(0 0 30px rgba(255,190,90,0.35)); }
      p { margin: ${Math.round(z.sub * 0.45)}px 0 0; font-weight: 600; font-size: ${z.sub}px; color: #C9B3D6; }
      .body { position: absolute; filter: drop-shadow(0 50px 70px rgba(0,0,0,0.55)) drop-shadow(0 0 80px rgba(255,190,90,0.12)); }
      .btn { position: absolute; background: linear-gradient(90deg, #4A4350, #2A2430); border-radius: 3px; }
      .rim { position: absolute; inset: 0; background: linear-gradient(145deg, #6B6372, #2B2531 40%, #4C4553 75%, #221D27); }
      .bezel { width: 100%; height: 100%; box-sizing: border-box; background: #050307; }
      .screen { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; }
      .screen img { display: block; width: 100%; height: 100%; }
      .sb { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; color: #fff; font-family: I, sans-serif; font-weight: 600; }
      .sb.ipad { justify-content: space-between; box-sizing: border-box; }
      .ear { display: flex; align-items: center; justify-content: center; }
      .island { position: absolute; background: #000; }
      .home { position: absolute; background: rgba(255,255,255,0.75); border-radius: 99px; }
      .cam { position: absolute; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #2C3A55, #07080C 70%); }
    </style></head><body>
      <div class="cap"><h1>${title}</h1><p>${sub}</p></div>
      ${device(z, img)}
    </body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const file = `${out}/0${i + 1}-${name.slice(2)}.png`;
    await page.screenshot({ path: file });
    console.log("wrote", file.replace(REPO + "/", ""));
  }
}
process.exit(0);
