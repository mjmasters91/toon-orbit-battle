/** Tiny pixel-buffer helpers. No DOM required until paint(). */

export function buffer(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill(null));
  const api = {
    w,
    h,
    g,
    p(x, y, c) {
      if (!c) return;
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      g[y][x] = c;
    },
    clear(x, y) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      g[y][x] = null;
    },
    rect(x, y, rw, rh, color, dark = null) {
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const edge = dark && (xx === rw - 1 || yy === rh - 1);
          api.p(x + xx, y + yy, edge ? dark : color);
        }
      }
    },
    hline(x, y, rw, color) {
      for (let i = 0; i < rw; i++) api.p(x + i, y, color);
    },
    oval(cx, cy, rx, ry, color, dark = null) {
      if (rx <= 0 || ry <= 0) {
        api.p(cx, cy, color);
        return;
      }
      const rxs = rx * rx;
      const rys = ry * ry;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const n = (x * x) / rxs + (y * y) / rys;
          if (n <= 1) api.p(cx + x, cy + y, dark && n > 0.72 ? dark : color);
        }
      }
    },
    ring(cx, cy, r, color) {
      let x = r;
      let y = 0;
      let err = 1 - x;
      while (x >= y) {
        for (const [px, py] of [
          [x, y], [y, x], [-x, y], [-y, x],
          [-x, -y], [-y, -x], [x, -y], [y, -x],
        ]) api.p(cx + px, cy + py, color);
        y++;
        if (err < 0) err += 2 * y + 1;
        else {
          x--;
          err += 2 * (y - x) + 1;
        }
      }
    },
    stamp(rows, ox, oy, pal) {
      for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === "." || ch === " ") continue;
          const color = pal[ch];
          if (color) api.p(ox + x, oy + y, color);
        }
      }
    },
    line(x0, y0, x1, y1, color, thick = 1) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps);
        const y = Math.round(y0 + ((y1 - y0) * i) / steps);
        api.p(x, y, color);
        if (thick > 1) api.p(x + 1, y, color);
      }
    },
  };
  return api;
}

export function outline(buf, color) {
  const { w, h, g } = buf;
  const marks = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x]) continue;
      if (
        g[y][x - 1] || g[y][x + 1] ||
        (g[y - 1] && g[y - 1][x]) ||
        (g[y + 1] && g[y + 1][x])
      ) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) g[y][x] = color;
}

export function shift(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, c + delta));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function paint(canvas, grid, scale = 1) {
  const h = grid.length;
  const w = grid[0].length;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = grid[y][x];
      if (!c) {
        data[i + 3] = 0;
        continue;
      }
      const n = parseInt(c.slice(1), 16);
      data[i] = (n >> 16) & 255;
      data[i + 1] = (n >> 8) & 255;
      data[i + 2] = n & 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
}

export function filledCount(grid) {
  let n = 0;
  for (const row of grid) for (const c of row) if (c) n++;
  return n;
}

export function maskOf(grid) {
  return grid.map((row) => row.map((c) => (c ? "1" : "0")).join("")).join("\n");
}
