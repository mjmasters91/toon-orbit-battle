let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = Boolean(value);
}

export function resume() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, type, peak, delay = 0, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, peak, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const data = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = data.getChannelData(0);
  for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = data;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
  source.stop(t + dur);
}

export function blip() {
  tone(620, 0.07, "square", 0.028, 0, 160);
}

export function summonCharge() {
  [392, 523, 659, 784].forEach((freq, i) => tone(freq, 0.16, "square", 0.03, i * 0.08));
  noise(0.35, 0.018, 0.15);
}

export function rarityFanfare(star) {
  if (star >= 5) {
    [523, 659, 784, 1046, 1318].forEach((freq, i) => tone(freq, 0.26, "triangle", 0.05, i * 0.07));
    tone(1568, 0.35, "square", 0.02, 0.22);
    noise(0.3, 0.04);
    return;
  }
  if (star === 4) {
    [440, 554, 659, 880].forEach((freq, i) => tone(freq, 0.15, "square", 0.034, i * 0.06));
    return;
  }
  tone(392, 0.1, "square", 0.03);
  tone(523, 0.12, "triangle", 0.028, 0.08);
}

export function powerup() {
  tone(523, 0.08, "square", 0.03);
  tone(784, 0.12, "square", 0.03, 0.06);
}
