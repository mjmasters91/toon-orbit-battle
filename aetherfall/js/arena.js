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

export function dressArena(scene, mapId) {
  const theme = lightRig(scene, mapId);
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, 7.5, 16);
  const ground = mesh(new THREE.CircleGeometry(6.5, 28), theme.ground, 0, 0, 0, { roughness: 0.95, metalness: 0 });
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  if (mapId === "coast") {
    const water = mesh(new THREE.CircleGeometry(6.2, 24), "#3a88c0", 0, 0.02, 1.4, { roughness: 0.18, metalness: 0.2, emissive: "#1a4a78", emissiveIntensity: 0.15 });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    scene.add(mesh(new THREE.DodecahedronGeometry(0.28, 0), "#d8cbb0", -2.2, 0.18, 1.6));
    scene.add(mesh(new THREE.ConeGeometry(0.16, 0.7, 5), "#efe6c8", 2.4, 0.35, 1.8));
  } else if (mapId === "forest") {
    scene.add(tree(-2.4, -1.2, 1.8, "#1f6a38"));
    scene.add(tree(2.5, -0.8, 2.1, "#184e2c"));
    scene.add(tree(-2.1, 1.6, 1.5, "#2a7a40"));
    scene.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), "#c45a6a", 1.8, 0.1, 1.5));
  } else if (mapId === "cinder") {
    const crack = mesh(new THREE.BoxGeometry(1.4, 0.04, 0.12), "#ff6a32", 0.4, 0.04, 0.2, { emissive: "#ff5a20", emissiveIntensity: 0.8, roughness: 0.4 });
    scene.add(crack);
    scene.add(mesh(new THREE.ConeGeometry(0.45, 0.9, 6), "#5a3028", -2.2, 0.45, -0.6));
    scene.add(mesh(new THREE.DodecahedronGeometry(0.22, 0), "#3a221c", 2.1, 0.16, 0.8));
  } else if (mapId === "spire") {
    for (const x of [-2.3, 2.3]) {
      scene.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), "#efe8f6", x, 0.8, -1.4));
      scene.add(mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), "#f0d78c", x, 1.64, -1.4, { metalness: 0.4, roughness: 0.35 }));
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 24), mat("#f0d78c", { metalness: 0.55, roughness: 0.3, emissive: "#f0d78c", emissiveIntensity: 0.25 }));
    ring.position.set(0, 2.1, -1.2);
    scene.add(ring);
  } else {
    scene.add(tree(-2.3, -0.4, 1.4, "#2f8a40"));
    scene.add(tree(2.4, 0.6, 1.6, "#3e9a48"));
    scene.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), "#f2d56a", -1.4, 0.16, 1.4));
  }
  return theme;
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
