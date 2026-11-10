import { blitText, textWidth } from "./font.js";
import { buffer, paint } from "./pixel.js";

const W = 180;
const H = 240;

function rarityColor(rarity) {
  if (rarity >= 5) return "#ffd35c";
  if (rarity === 4) return "#d392ff";
  return "#9ecbff";
}

function rarityDark(rarity) {
  if (rarity >= 5) return "#a86a12";
  if (rarity === 4) return "#62348c";
  return "#1e4e86";
}

function rainbow(t) {
  const band = Math.floor(t / 70) % 5;
  return ["#ff5a6a", "#ffd35c", "#7dffa8", "#7ecbff", "#e4b0ff"][band];
}

export function playSummon(canvas, results, hooks) {
  const best = results.reduce((max, row) => Math.max(max, row.rarity), 3);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) {
    hooks.onBurst?.(best);
    hooks.onDone?.();
    return () => {};
  }
  const particles = [];
  const stars = Array.from({ length: 48 }, (_, i) => ({
    x: (i * 29 + 7) % W,
    y: (i * 17 + 3) % 150,
  }));
  let spawned = false;
  let sounded = false;
  let stopped = false;
  const start = performance.now();
  const color = rarityColor(best);
  const dark = rarityDark(best);

  const frame = (now) => {
    if (stopped) return;
    const t = now - start;
    if (t >= 4300) {
      stopped = true;
      hooks.onDone?.();
      return;
    }
    const d = buffer(W, H);
    d.rect(0, 0, W, H, "#07101e");
    d.rect(0, 150, W, 90, "#12243f");
    for (const star of stars) {
      if ((star.x + Math.floor(t / 160)) % 9 === 0) continue;
      d.p(star.x, star.y, "#f6edd8");
    }
    const spin = t / 300;
    for (let a = 0; a < 36; a++) {
      const ang = spin + (a / 36) * Math.PI * 2;
      const radius = 52;
      d.p(90 + Math.round(Math.cos(ang) * radius), 168 + Math.round(Math.sin(ang) * 14), a % 2 ? "#ffd56a" : "#7ecbff");
    }
    const drop = Math.min(1, t / 900);
    const cy = Math.round(24 + drop * 78);
    const cracked = t > 900;
    const shattered = t > 1750;
    if (!shattered) {
      const radius = 16 + Math.round(drop * 6);
      for (let y = -radius; y <= radius; y++) {
        const span = radius - Math.abs(y);
        for (let x = -span; x <= span; x++) {
          const edge = Math.abs(x) >= span - 1;
          let pixel = edge ? dark : color;
          if (!edge && x < -2 && y < 0) pixel = "#fffaf0";
          if (cracked && Math.abs(x * 2 + y) % 7 === 0) pixel = "#120c14";
          d.p(90 + x, cy + y, pixel);
        }
      }
    } else {
      const grow = Math.min(1, (t - 1750) / 500);
      const pillarW = 8 + Math.round(grow * 10);
      for (let y = 20; y < 176; y++) {
        const flick = best >= 5 && t > 2500 ? rainbow(t + y * 12) : color;
        d.hline(90 - Math.floor(pillarW / 2), y, pillarW, y % 3 === 0 ? "#fffaf0" : flick);
      }
      if (best >= 5 && t > 2500 && Math.floor(t / 50) % 2 === 0) {
        d.rect(0, 0, W, 6, "#fff6c8");
        d.rect(0, H - 6, W, 6, "#fff6c8");
      }
    }
    if (t > 1750 && !spawned) {
      spawned = true;
      const count = best >= 5 ? 110 : 60;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * (best >= 5 ? 1.8 : 1.1);
        particles.push({
          x: 90,
          y: cy,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 0.4,
          life: 36 + Math.random() * 30,
          color: best >= 5 && i % 4 === 0 ? rainbow(i * 40) : i % 5 === 0 ? "#ffffff" : color,
        });
      }
    }
    if (t > 1750 && !sounded) {
      sounded = true;
      hooks.onBurst?.(best);
    }
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.03;
      particle.life -= 1;
      if (particle.life > 0) d.p(Math.round(particle.x), Math.round(particle.y), particle.color);
    }
    results.forEach((row, index) => {
      const spread = results.length === 1 ? 0 : index - (results.length - 1) / 2;
      const x = 90 + Math.round(spread * 14) - 2;
      const y = 188 + (index % 2) * 8;
      const lit = t > 400 + index * 70;
      d.rect(x, y, 5, 5, lit ? rarityColor(row.rarity) : "#243044", "#07101e");
      if (lit) d.p(x + 1, y + 1, "#ffffff");
    });
    if (t > 2600) {
      const label = best >= 5 ? "5 STAR" : best === 4 ? "4 STAR" : "SUMMON";
      const scale = 2;
      const x = Math.max(2, Math.floor((W - textWidth(label, scale)) / 2));
      blitText(d, label, x + 1, 17, "#2a1808", scale);
      blitText(d, label, x, 16, best >= 5 ? "#ffd56a" : color, scale);
    }
    paint(canvas, d.g, 1);
    const css = Math.max(1, Math.min(3, Math.floor((window.innerWidth - 24) / W), Math.floor((window.innerHeight - 150) / H)));
    canvas.style.width = `${W * css}px`;
    canvas.style.height = `${H * css}px`;
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return () => {
    stopped = true;
  };
}
