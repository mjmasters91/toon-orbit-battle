const NS = "http://www.w3.org/2000/svg";

function svg(parts) {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", "0 0 32 32");
  el.setAttribute("class", "ico");
  el.setAttribute("aria-hidden", "true");
  for (const part of parts) {
    const node = document.createElementNS(NS, part.tag || "path");
    for (const [key, value] of Object.entries(part)) {
      if (key === "tag") continue;
      node.setAttribute(key, value);
    }
    el.append(node);
  }
  return el;
}

const ICONS = {
  star: () => svg([
    { d: "M16 3l3.2 7.4 8 .8-6 5.3 1.8 7.8L16 20.8 9 24.3l1.8-7.8-6-5.3 8-.8z", fill: "currentColor" },
  ]),
  gem: () => svg([
    { d: "M8 6h16l4 7-12 14L4 13z", fill: "#7ee0d0" },
    { d: "M8 6l8 6 8-6", fill: "none", stroke: "#e8fff8", "stroke-width": "1.4" },
  ]),
  ticket: () => svg([
    { tag: "rect", x: "4", y: "8", width: "24", height: "16", rx: "3", fill: "#f0d48a" },
    { d: "M12 12h8M12 16h8M12 20h5", stroke: "#8a5a18", "stroke-width": "1.6", fill: "none" },
  ]),
  gold: () => svg([
    { tag: "circle", cx: "16", cy: "16", r: "10", fill: "#f0d48a", stroke: "#a86a12", "stroke-width": "2" },
    { d: "M16 9v14M12 13h6.5a3 3 0 0 1 0 6H12", stroke: "#8a5410", "stroke-width": "1.6", fill: "none" },
  ]),
  home: () => svg([
    { d: "M6 15 L16 6 L26 15 V26 H20 V19 H12 V26 H6 Z", fill: "#f0e2c4" },
  ]),
  summon: () => svg([
    { tag: "circle", cx: "16", cy: "18", r: "8", fill: "none", stroke: "#9ad7ff", "stroke-width": "2" },
    { d: "M16 4l2 6h-4z", fill: "#ffe9a0" },
    { tag: "circle", cx: "16", cy: "18", r: "3", fill: "#7ee0d0" },
  ]),
  units: () => svg([
    { tag: "circle", cx: "11", cy: "11", r: "4", fill: "#f0c2a4" },
    { d: "M6 24c1-5 3-7 5-7s4 2 5 7z", fill: "#e25a32" },
    { tag: "circle", cx: "21", cy: "12", r: "3.2", fill: "#f0c2a4" },
    { d: "M17 24c.6-4 2-6 4-6s3.2 2 4 6z", fill: "#3c92d8" },
  ]),
  party: () => svg([
    { d: "M4 26V14l6-4 6 4v12z", fill: "#e6c27a" },
    { d: "M16 26V12l6-5 6 5v14z", fill: "#f4efe2" },
  ]),
  story: () => svg([
    { d: "M5 8h14v16H5z", fill: "#1d4e38" },
    { d: "M8 18c2-3 4-3 6 0 1 2 3 2 5 0v6H8z", fill: "#3e9a48" },
    { tag: "circle", cx: "22", cy: "10", r: "3", fill: "#f0d78c" },
  ]),
  sound: () => svg([
    { d: "M6 13h5l6-5v16l-6-5H6z", fill: "#f4ead7" },
    { d: "M22 11c2 2 2 8 0 10", fill: "none", stroke: "#f0d48a", "stroke-width": "2" },
  ]),
  mute: () => svg([
    { d: "M6 13h5l6-5v16l-6-5H6z", fill: "#f4ead7" },
    { d: "M22 12l6 8M28 12l-6 8", stroke: "#e07a7a", "stroke-width": "2" },
  ]),
  fire: () => svg([{ d: "M16 3s6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 2 3 3 1 0 0 0-3 0-6z", fill: "#e2582c" }]),
  water: () => svg([{ d: "M16 4s8 9 8 14a8 8 0 0 1-16 0c0-5 8-14 8-14z", fill: "#3c92d8" }]),
  wind: () => svg([
    { d: "M6 10h12a3 3 0 1 0-3-3", fill: "none", stroke: "#7dffa8", "stroke-width": "2" },
    { d: "M5 16h16a3 3 0 1 1-3 3", fill: "none", stroke: "#3cba78", "stroke-width": "2" },
    { d: "M8 22h8a2 2 0 1 1-2 2", fill: "none", stroke: "#d8ffe8", "stroke-width": "2" },
  ]),
  earth: () => svg([
    { d: "M6 20 L16 8 L26 20 Z", fill: "#c4964a" },
    { d: "M10 20h12v5H10z", fill: "#6a4a28" },
  ]),
  light: () => svg([
    { tag: "circle", cx: "16", cy: "16", r: "5", fill: "#fff1c0" },
    { d: "M16 3v4M16 25v4M3 16h4M25 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3", stroke: "#f0d78c", "stroke-width": "1.8" },
  ]),
  dark: () => svg([
    { tag: "circle", cx: "14", cy: "16", r: "8", fill: "#7d5cc4" },
    { tag: "circle", cx: "19", cy: "13", r: "6", fill: "#140e22" },
  ]),
};

export function icon(name) {
  const draw = ICONS[name] || ICONS.star;
  return draw();
}
