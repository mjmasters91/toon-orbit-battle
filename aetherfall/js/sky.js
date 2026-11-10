import { buffer, shift } from "./pixel.js";

function blit(canvas, ctx, grid) {
  const h = grid.length;
  const w = grid[0].length;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const color = grid[y][x];
      const n = parseInt((color || "#16304e").slice(1), 16);
      data[i] = (n >> 16) & 255;
      data[i + 1] = (n >> 8) & 255;
      data[i + 2] = n & 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function cloud(d, x, y, w, tint) {
  d.rect(x, y, w, 4, tint);
  d.rect(x + 3, y - 3, Math.max(6, w - 8), 4, shift(tint, 18));
  d.rect(x + 6, y - 5, Math.max(4, w - 14), 3, "#f7fbff");
}

function tree(d, x, y) {
  d.rect(x + 2, y, 2, 6, "#3a2a18");
  d.rect(x, y - 4, 6, 5, "#2f8a48");
  d.rect(x + 1, y - 6, 4, 3, "#67c878");
  d.p(x + 2, y - 7, "#d8ffe4");
}

function island(d, x, y, w, grass, dirt) {
  d.rect(x, y, w, 8, dirt);
  d.rect(x + 2, y - 3, w - 4, 4, grass);
  d.hline(x, y, w, shift(grass, 30));
  d.rect(x + 4, y + 6, Math.max(8, w - 10), 4, shift(dirt, -18));
  tree(d, x + 6, y - 2);
  if (w > 28) tree(d, x + w - 14, y - 1);
  d.rect(x + Math.floor(w / 2) - 3, y - 12, 6, 10, "#d8d2c8");
  d.rect(x + Math.floor(w / 2) - 1, y - 16, 2, 5, "#f0d78a");
}

function castle(d, x, y) {
  d.rect(x, y, 28, 16, "#c8c2d8");
  d.rect(x - 4, y - 8, 8, 24, "#b0a8c4");
  d.rect(x + 24, y - 8, 8, 24, "#b0a8c4");
  d.rect(x + 10, y - 14, 8, 14, "#ddd6ea");
  d.rect(x + 12, y - 18, 4, 5, "#f0d78a");
  d.p(x + 13, y - 20, "#ff5a4a");
  for (const wx of [x + 2, x + 14, x + 26]) d.rect(wx, y + 4, 3, 4, "#8fd0ff");
  d.rect(x + 11, y + 8, 6, 8, "#3a3058");
}

export function startSky(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let frame = 0;
  let width = 0;
  const height = 180;
  let stars = [];

  function layout() {
    const aspect = Math.max(0.7, window.innerWidth / Math.max(1, window.innerHeight));
    const next = Math.max(240, Math.min(420, Math.round(height * aspect)));
    if (next === width) return;
    width = next;
    stars = Array.from({ length: 70 }, (_, i) => ({
      x: (i * 47 + 9) % width,
      y: (i * 19 + 4) % 70,
      big: i % 6 === 0,
    }));
  }

  function tick() {
    layout();
    frame += 1;
    const d = buffer(width, height);
    for (let y = 0; y < height; y++) {
      const c = y < 70 ? "#1a3c72" : y < 120 ? "#2a5c98" : "#4a8cc0";
      d.rect(0, y, width, 1, c);
    }
    const drift = Math.floor(frame / 6);
    for (const star of stars) {
      if (((frame >> 4) + star.x) % 10 === 0) continue;
      const x = star.x;
      d.p(x, star.y, star.big ? "#fff6d2" : "#d7ecff");
      if (star.big) d.p(x + 1, star.y, "#fff6d2");
    }
    d.oval(width - 42, 28, 10, 10, "#fff4c8", "#f0d48a");
    d.oval(width - 38, 26, 7, 7, "#1a3c72");
    cloud(d, ((18 - drift) % (width + 40)) - 20, 36, 26, "#e7f2ff");
    cloud(d, ((90 - Math.floor(drift / 2)) % (width + 50)) - 10, 24, 34, "#f4f8ff");
    cloud(d, ((150 - drift) % (width + 30)) + 10, 48, 22, "#d5e6ff");
    island(d, 18, 150, 46, "#3ea864", "#6a4a32");
    castle(d, Math.floor(width * 0.42), 128);
    island(d, width - 78, 146, 54, "#49b870", "#7a5a3a");
    for (let i = 0; i < 16; i++) {
      const x = (i * 37 + frame) % width;
      const y = 80 + ((i * 13 + Math.floor(frame / 2)) % 50);
      d.p(x, y, i % 2 ? "#fff6c8" : "#b7fff0");
    }
    blit(canvas, ctx, d.g);
    if (!reduce) requestAnimationFrame(tick);
  }

  tick();
  window.addEventListener("resize", () => {
    width = 0;
  });
}
