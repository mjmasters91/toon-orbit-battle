import { buffer } from "./pixel.js";

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
      if (!color) {
        data[i + 3] = 255;
        data[i] = 20;
        data[i + 1] = 12;
        data[i + 2] = 34;
        continue;
      }
      const n = parseInt(color.slice(1), 16);
      data[i] = (n >> 16) & 255;
      data[i + 1] = (n >> 8) & 255;
      data[i + 2] = n & 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function island(d, x, y, w) {
  d.rect(x, y, w, 7, "#1a1030");
  d.rect(x + 3, y - 5, Math.max(8, w - 12), 6, "#2a1848");
  d.rect(x + Math.floor(w * 0.4), y - 12, 5, 8, "#3d2864");
  d.hline(x, y, w, "#7a68a0");
  d.rect(x + 6, y + 2, 3, 2, "#6a5888");
}

export function startSky(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let frame = 0;
  let width = 0;
  const height = 120;
  let stars = [];

  function layout() {
    const aspect = Math.max(0.7, window.innerWidth / Math.max(1, window.innerHeight));
    const next = Math.max(180, Math.min(380, Math.round(height * aspect)));
    if (next === width) return;
    width = next;
    stars = Array.from({ length: 90 }, (_, i) => ({
      x: (i * 53 + 11) % width,
      y: (i * 29 + 5) % 78,
      big: i % 7 === 0,
    }));
  }

  function tick() {
    layout();
    frame += 1;
    const d = buffer(width, height);
    d.rect(0, 0, width, height, "#140c22");
    d.rect(0, 76, width, 44, "#241433");
    d.rect(0, 102, width, 18, "#3a2158");
    for (const star of stars) {
      const on = ((frame >> 4) + star.x) % 9 !== 0;
      if (!on) continue;
      d.p(star.x, star.y, star.big ? "#fff6d2" : "#9ad7ff");
      if (star.big) d.p(star.x + 1, star.y, "#fff6d2");
    }
    d.oval(width - 34, 24, 8, 8, "#f3e2b0", "#c8b27a");
    d.oval(width - 30, 22, 6, 6, "#140c22");
    island(d, 12, 108, 40);
    island(d, Math.floor(width * 0.42), 112, 56);
    island(d, width - 64, 104, 30);
    blit(canvas, ctx, d.g);
    if (!reduce) requestAnimationFrame(tick);
  }

  tick();
  window.addEventListener("resize", () => {
    width = 0;
  });
}
