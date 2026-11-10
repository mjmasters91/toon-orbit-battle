import * as THREE from "../vendor/three/three.module.js";
import { mat } from "./materials.js";

const THEMES = {
  meadow: { sky: "#7eb6e6", fog: "#9ec8ee", ground: "#3f8f45", sun: "#fff2d0", rim: "#8ec8ff", accent: "#2f6a32" },
  coast: { sky: "#6aa6d4", fog: "#b7d4ea", ground: "#e4d2a4", sun: "#fff6e0", rim: "#7ec8ea", accent: "#2f78b0" },
  forest: { sky: "#1d4a38", fog: "#163628", ground: "#214832", sun: "#d8ecc0", rim: "#8ad48a", accent: "#14321e" },
  cinder: { sky: "#5a241c", fog: "#6a3024", ground: "#3a241c", sun: "#ffb070", rim: "#ff6a3a", accent: "#ff8a32" },
  spire: { sky: "#2a3270", fog: "#3a4488", ground: "#d9d4e6", sun: "#f4f0ff", rim: "#f0d78c", accent: "#efe6ff" },
};

function mesh(geo, color, x, y, z, opts) {
  const node = new THREE.Mesh(geo, mat(color, opts));
  node.position.set(x, y, z);
  node.castShadow = true;
  node.receiveShadow = true;
  return node;
}

export function lightRig(scene, themeName = "meadow") {
  const theme = THEMES[themeName] || THEMES.meadow;
  scene.add(new THREE.HemisphereLight(theme.sky, theme.ground, 0.72));
  const sun = new THREE.DirectionalLight(theme.sun, 1.45);
  sun.position.set(-3.2, 6.2, 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.near = 0.4;
  sun.shadow.camera.far = 18;
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(theme.rim, 0.7);
  rim.position.set(4.2, 2.6, -3.4);
  scene.add(rim);
  return theme;
}

export function pedestal(radius = 0.62) {
  const group = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(radius, radius * 1.16, 0.24, 14), "#6a6158", 0, 0.12, 0, { roughness: 0.92, metalness: 0.02 });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, 0.028, 6, 18), mat("#e6c27a", { roughness: 0.32, metalness: 0.62 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.24;
  group.add(base, lip);
  return group;
}

function tree(x, z, h, leaf) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, h * 0.45, 6), "#5a3a22", 0, h * 0.22, 0));
  const top = mesh(new THREE.ConeGeometry(0.28, h * 0.7, 7), leaf, 0, h * 0.62, 0);
  group.add(top);
  group.position.set(x, 0, z);
  return group;
}

function skyDome(top, mid, bot) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, top);
  grd.addColorStop(0.42, mid);
  grd.addColorStop(1, bot);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = "rgba(255,248,236,0.55)";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(6 + (i * 13) % 54, 28 + (i * 11) % 36, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(16, 18, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
  );
  return dome;
}

function terrain(color, accent) {
  const geometry = new THREE.PlaneGeometry(18, 18, 28, 28);
  const pos = geometry.attributes.position;
  const colors = [];
  const base = new THREE.Color(color);
  const alt = new THREE.Color(accent);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.hypot(x, y);
    const mask = Math.min(1, Math.max(0, (dist - 2.2) / 3.5));
    const h = (Math.sin(x * 0.65) * 0.18 + Math.cos(y * 0.5) * 0.12 + Math.sin(x * 1.4 + y * 0.8) * 0.06) * mask;
    pos.setZ(i, h);
    const mix = base.clone().lerp(alt, 0.25 + 0.35 * Math.sin(x * 1.7 + y));
    colors.push(mix.r, mix.g, mix.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = mat(color).clone();
  material.vertexColors = true;
  material.userData.own = true;
  const node = new THREE.Mesh(geometry, material);
  node.rotation.x = -Math.PI / 2;
  node.receiveShadow = true;
  return node;
}

function rock(x, z, s, color) {
  const node = mesh(new THREE.DodecahedronGeometry(s, 0), color, x, s * 0.45, z);
  node.rotation.y = x;
  return node;
}

export function dressArena(scene, mapId) {
  const theme = lightRig(scene, mapId);
  scene.fog = new THREE.Fog(theme.fog, 9, 20);
  const skies = {
    meadow: ["#8ec6f2", "#d7ecff", "#8fbf6a"],
    coast: ["#7eb6e4", "#f3e7c8", "#6aa0c8"],
    forest: ["#163628", "#2a6848", "#1a3a28"],
    cinder: ["#4a1c18", "#c4623a", "#3a2018"],
    spire: ["#1c2458", "#8aa0d8", "#d7d2ea"],
  };
  const sky = skies[mapId] || skies.meadow;
  scene.add(skyDome(sky[0], sky[1], sky[2]));
  scene.add(terrain(theme.ground, theme.accent));
  if (mapId === "coast") {
    const water = mesh(new THREE.CircleGeometry(7, 24), "#3a88c0", 0.4, 0.04, 2.2, { emissive: "#1a4a78", emissiveIntensity: 0.25 });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    scene.add(rock(-2.6, 1.5, 0.32, "#d8cbb0"));
    scene.add(rock(2.5, 1.2, 0.22, "#efe6c8"));
    scene.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6), "#8a6a48", 2.2, 0.35, -1.6));
  } else if (mapId === "forest") {
    scene.add(tree(-3.1, -1.4, 2.2, "#1c5a32"));
    scene.add(tree(3.2, -1.1, 2.6, "#143e24"));
    scene.add(tree(-2.4, 2.2, 1.8, "#246838"));
    scene.add(tree(2.2, 2.4, 2.1, "#184828"));
    scene.add(rock(1.8, 1.2, 0.2, "#4a4038"));
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.35, 8), "#5a4030", -1.6, 0.16, 1.5));
  } else if (mapId === "cinder") {
    const crack = mesh(new THREE.BoxGeometry(2.2, 0.05, 0.16), "#ff6a32", 0.2, 0.05, 0.3, { emissive: "#ff5a20", emissiveIntensity: 1 });
    scene.add(crack);
    scene.add(rock(-2.4, -0.8, 0.4, "#5a3028"));
    scene.add(rock(2.3, 0.6, 0.28, "#3a221c"));
    scene.add(mesh(new THREE.ConeGeometry(0.16, 0.7, 6), "#ffb15a", -1.2, 0.4, 1.4, { emissive: "#ff6a32", emissiveIntensity: 0.7 }));
  } else if (mapId === "spire") {
    for (const x of [-2.6, 2.6]) {
      scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 8), "#efe8f6", x, 0.9, -1.6));
      scene.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), "#f0d78c", x, 1.84, -1.6, { emissive: "#f0d78c", emissiveIntensity: 0.25 }));
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 8, 24), mat("#f0d78c", { emissive: "#f0d78c", emissiveIntensity: 0.45 }));
    ring.position.set(0, 2.3, -1.4);
    scene.add(ring);
    scene.add(rock(-1.4, 1.6, 0.18, "#c8c4dc"));
  } else {
    scene.add(tree(-3, -0.6, 1.7, "#2f8a40"));
    scene.add(tree(3.1, 0.8, 2, "#3e9a48"));
    scene.add(tree(-2.2, 2.3, 1.5, "#246838"));
    scene.add(rock(1.6, 1.5, 0.22, "#6a5a40"));
    scene.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), "#f2d56a", -1.5, 0.16, 1.6, { emissive: "#f2d56a", emissiveIntensity: 0.2 }));
    scene.add(mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.4, 8), "#6a5844", 2.1, 0.18, -1.8));
  }
  return theme;
}

export function dressSanctuary(scene) {
  lightRig(scene, "spire");
  scene.fog = new THREE.Fog("#c8b8e8", 8, 18);
  scene.add(skyDome("#2a2458", "#d7c4a4", "#8eb6d8"));
  const isle = mesh(new THREE.CylinderGeometry(2.3, 1.5, 0.7, 16), "#6a5e52", 0, -0.2, 0);
  const cap = mesh(new THREE.CylinderGeometry(2.15, 2.25, 0.18, 16), "#3f8a48", 0, 0.12, 0);
  scene.add(isle, cap);
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6), "#efe8f4", -1.7, 0.7, -1.7));
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6), "#efe8f4", 1.7, 0.7, -1.7));
  scene.add(mesh(new THREE.BoxGeometry(0.9, 0.1, 0.16), "#e6c27a", 0, 1.25, -1.7, { emissive: "#e6c27a", emissiveIntensity: 0.2 }));
  scene.add(rock(1.7, 1.1, 0.2, "#8a7a68"));
  const float = mesh(new THREE.DodecahedronGeometry(0.16, 0), "#d8c8ea", -1.8, 1.4, 0.4);
  scene.add(float);
  return float;
}

export function dressGallery(scene) {
  lightRig(scene, "spire");
  scene.background = null;
  scene.fog = null;
}

export function dressAltar(scene) {
  const theme = lightRig(scene, "spire");
  scene.background = new THREE.Color("#120c22");
  scene.fog = new THREE.Fog("#1a1030", 6, 14);
  const floor = mesh(new THREE.CircleGeometry(3.2, 24), "#2a2218", 0, 0, 0, { roughness: 0.9 });
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(pedestal(0.78));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 8, 28), mat("#7ec8ff", { emissive: "#7ec8ff", emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.25 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.7;
  ring.name = "portal";
  scene.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(1.25);
  ring2.position.y = 1.15;
  ring2.name = "portal-outer";
  scene.add(ring2);
  for (let i = 0; i < 6; i++) {
    const stone = mesh(new THREE.DodecahedronGeometry(0.12, 0), "#6a5a48", Math.cos(i) * 1.35, 0.1, Math.sin(i) * 1.35);
    scene.add(stone);
  }
  return theme;
}
