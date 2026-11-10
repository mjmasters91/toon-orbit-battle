import * as THREE from "../vendor/three/three.module.js";

export const ELEMENT = {
  fire: "#e2582c",
  water: "#3c92d8",
  wind: "#3cba78",
  earth: "#c4964a",
  light: "#f2d78c",
  dark: "#7d5cc4",
};

let ramp = null;
let shell = null;

function gradientMap() {
  if (ramp) return ramp;
  const data = new Uint8Array([
    42, 40, 48, 255,
    108, 104, 112, 255,
    186, 182, 176, 255,
    255, 250, 242, 255,
  ]);
  ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.wrapS = THREE.ClampToEdgeWrapping;
  ramp.colorSpace = THREE.NoColorSpace;
  ramp.needsUpdate = true;
  return ramp;
}

export function outlineMaterial() {
  if (shell) return shell;
  shell = new THREE.MeshBasicMaterial({ color: "#1a1218", side: THREE.BackSide });
  shell.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "vec3 transformed = vec3(position) + normal * 0.028;",
    );
  };
  return shell;
}

const cache = new Map();

export function mat(color, opts = {}) {
  const key = `${color}|${opts.emissive || ""}|${opts.emissiveIntensity ?? 0}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: gradientMap(),
      emissive: new THREE.Color(opts.emissive || "#000000"),
      emissiveIntensity: opts.emissiveIntensity ?? (opts.emissive ? 0.45 : 0),
    });
    cache.set(key, material);
  }
  return material;
}

export function ownMat(color, opts = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    emissive: new THREE.Color(opts.emissive || color),
    emissiveIntensity: opts.emissiveIntensity ?? 0.35,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
  });
  material.userData.own = true;
  return material;
}

export function basicMat(color, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.userData.own = true;
  return material;
}
