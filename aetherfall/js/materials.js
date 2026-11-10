import * as THREE from "../vendor/three/three.module.js";

export const ELEMENT = {
  fire: "#e2582c",
  water: "#3c92d8",
  wind: "#3cba78",
  earth: "#c4964a",
  light: "#f2d78c",
  dark: "#7d5cc4",
};

const cache = new Map();

export function mat(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.52}|${opts.metalness ?? 0.08}|${opts.emissive || ""}|${opts.emissiveIntensity ?? 0}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.52,
      metalness: opts.metalness ?? 0.08,
      emissive: new THREE.Color(opts.emissive || "#000000"),
      emissiveIntensity: opts.emissiveIntensity ?? (opts.emissive ? 0.35 : 0),
    });
    cache.set(key, material);
  }
  return material;
}

export function ownMat(color, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.12,
    emissive: new THREE.Color(opts.emissive || color),
    emissiveIntensity: opts.emissiveIntensity ?? 0.2,
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
  });
  material.userData.own = true;
  return material;
}
