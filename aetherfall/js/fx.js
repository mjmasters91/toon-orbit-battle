import { blitText, textWidth } from "./font.js";
import { buffer, paint } from "./pixel.js";

const W = 160;
const H = 210;

function rarityColor(rarity) {
  if (rarity >= 5) return "#ffd35c";
  if (rarity === 4) return "#d392ff";
  return "#8ec6ff";
}

function rarityDark(rarity) {
  if (rarity >= 5) return "#8a5a10";
  if (rarity === 4) return "#62348c";
  return "#1e4e86";
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
  const stars = Array.from({ length: 42 }, (_, i) => ({
    x: (i * 37 + 5) % W,
    y: (i * 19 + 3) % H,
  }));
  let spawned = false;
  let sounded = false;
  let stopped = false;
  const start = performance.now();

  const frame = (now) => {
    if (stopped) return;
    const t = now - start;
    if (t >= 2800) {
      stopped = true;
      hooks.onDone?.();
      return;
    }
    const d = buffer(W, H);
    d.rect(0, 0, W, H, "#07040f");
    d.rect(0, 150, W, 60, "#140c22");
    for (const star of stars) {
      if ((star.x + Math.floor(t / 140)) % 8 === 0) continue;
      d.p(star.x, star.y, "#f6edd8");
    }
    const spin = t / 260;
    for (let a = 0; a < 32; a++) {
      const ang = spin + (a / 32) * Math.PI * 2;
      const radius = 46 + Math.sin(t / 180) * 2;
      const x = 80 + Math.round(Math.cos(ang) * radius);
      const y = 92 + Math.round(Math.sin(ang) * radius * 0.4);
      d.p(x, y, a % 2 ? "#ffd56a" : "#7ef0e0");
    }
    const color = rarityColor(best);
    const dark = rarityDark(best);
    if (t < 1780) {
      const radius = Math.max(3, Math.round(5 + Math.min(1, t / 1400) * 24));
      for (let y = -radius; y <= radius; y++) {
        const span = radius - Math.abs(y);
        for (let x = -span; x <= span; x++) {
          const edge = Math.abs(x) >= span - 1;
          let pixel = edge ? dark : color;
          if (t > 1150 && Math.abs(x + y * 2) % 9 === 0) pixel = "#1a1020";
          if (!edge && Math.abs(x) < 2 && y < -2) pixel = "#fffaf0";
          d.p(80 + x, 92 + y, pixel);
        }
      }
    }
    results.forEach((row, index) => {
      const spread = results.length === 1 ? 0 : index - (results.length - 1) / 2;
      const x = 80 + Math.round(spread * 13) - 2;
      const y = 158 + (index % 2) * 6;
      const lit = t > 360 + index * 80;
      d.rect(x, y, 5, 5, lit ? rarityColor(row.rarity) : "#2a2438", "#07040f");
      if (lit) d.p(x + 1, y + 1, "#ffffff");
    });
    if (t > 1550 && !spawned) {
      spawned = true;
      const count = best >= 5 ? 100 : 55;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * (best >= 5 ? 1.8 : 1.05);
        particles.push({
          x: 80,
          y: 92,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 0.55,
          life: 28 + Math.random() * 34,
          color: i % 6 === 0 ? "#ffffff" : color,
        });
      }
    }
    if (t > 1550 && !sounded) {
      sounded = true;
      hooks.onBurst?.(best);
    }
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.035;
      particle.life -= 1;
      if (particle.life > 0) d.p(Math.round(particle.x), Math.round(particle.y), particle.color);
    }
    if (best >= 5 && t > 1550 && t < 2000 && Math.floor(t / 50) % 2 === 0) {
      d.rect(0, 0, W, 4, "#fff6c8");
      d.rect(0, H - 4, W, 4, "#fff6c8");
    }
    if (t > 1700) {
      const label = best >= 5 ? "5 STAR" : best === 4 ? "4 STAR" : "SUMMON";
      const scale = 2;
      const x = Math.max(2, Math.floor((W - textWidth(label, scale)) / 2));
      blitText(d, label, x + 1, 25, "#2a1808", scale);
      blitText(d, label, x, 24, best >= 5 ? "#ffd56a" : color, scale);
    }
    if (t > 1550 && t < 2200) {
      const core = Math.max(2, 7 - Math.floor((t - 1550) / 90));
      d.rect(80 - core, 92 - core, core * 2, core * 2, "#fffaf0");
    }
    paint(canvas, d.g, 1);
    const css = Math.max(
      1,
      Math.min(
        3,
        Math.floor((window.innerWidth - 24) / W),
        Math.floor((window.innerHeight - 150) / H),
      ),
    );
    canvas.style.width = `${W * css}px`;
    canvas.style.height = `${H * css}px`;
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return () => {
    stopped = true;
  };
}
