/** Small original tones. Nothing is loaded from a file. */

export function createAudio() {
  let ctx = null;
  let muted = false;

  function context() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type, gain, slide) {
    const c = context();
    if (!c || muted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      context();
    },
    toggle() {
      muted = !muted;
      if (!muted) context();
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      blip(540, 0.05, "triangle", 0.03);
    },
    start() {
      blip(196, 0.28, "triangle", 0.04, 392);
    },
    hit(element) {
      const freq = { flame: 170, tide: 230, gale: 310, radiant: 420, umbral: 130 }[element] || 200;
      blip(freq, 0.12, "sawtooth", 0.03, freq * 0.55);
    },
    heal() {
      blip(520, 0.16, "sine", 0.035, 780);
    },
    buff() {
      blip(340, 0.12, "triangle", 0.028, 520);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        setTimeout(() => blip(freq, 0.16, "triangle", 0.04), index * 110);
      });
    },
    lose() {
      [392, 311, 233, 174].forEach((freq, index) => {
        setTimeout(() => blip(freq, 0.2, "sine", 0.035), index * 130);
      });
    },
  };
}
