import * as THREE from "../vendor/three/three.module.js";

let renderer = null;
let failed = false;
let loop = 0;
let active = null;

const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

export function webglAvailable() {
  if (failed) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function acquire() {
  if (renderer || failed) return renderer;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "gl-canvas";
    return renderer;
  } catch {
    failed = true;
    renderer = null;
    return null;
  }
}

export function glMessage() {
  const note = document.createElement("p");
  note.className = "gl-fail";
  note.textContent = "This device could not start the 3D view. The rest of Aetherfall still keeps your save.";
  return note;
}

export function releaseView() {
  if (loop) cancelAnimationFrame(loop);
  loop = 0;
  if (active?.ctx?.dispose) active.ctx.dispose();
  if (active?.scene) {
    active.scene.traverse((obj) => {
      if (obj.geometry?.userData?.own) obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material?.userData?.own) material.dispose();
      }
    });
  }
  active = null;
}

export function mountView(container, setup) {
  releaseView();
  const gl = acquire();
  if (!gl || !webglAvailable()) {
    container.replaceChildren(glMessage());
    return { ok: false, stop: releaseView, camera: null, scene: null, ctx: null };
  }
  container.replaceChildren(gl.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  let ctx = {};
  try {
    ctx = setup({ scene, camera, renderer: gl, THREE }) || {};
  } catch (error) {
    console.error(error);
    container.replaceChildren(glMessage());
    return { ok: false, stop: releaseView, camera, scene, ctx: null };
  }
  active = { container, scene, camera, ctx };

  const resize = () => {
    const width = Math.max(2, container.clientWidth || 320);
    const height = Math.max(2, container.clientHeight || 240);
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    gl.setSize(width, height, false);
    gl.domElement.style.width = "100%";
    gl.domElement.style.height = "100%";
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const previousDispose = ctx.onDispose;
  ctx.dispose = () => {
    observer.disconnect();
    previousDispose?.();
  };

  const frame = (now) => {
    if (!active || active.scene !== scene) return;
    loop = requestAnimationFrame(frame);
    if (document.hidden) return;
    ctx.tick?.(now);
    gl.render(scene, camera);
  };
  loop = requestAnimationFrame(frame);
  const stop = () => {
    observer.disconnect();
    if (active?.scene === scene) releaseView();
  };
  ctx.dispose = () => {
    observer.disconnect();
    ctx.onDispose?.();
  };
  return { ok: true, stop, camera, scene, ctx, renderer: gl };
}

export function snapshotUnit(build, width = 160, height = 200) {
  const gl = acquire();
  if (!gl) return "";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a140f");
  scene.add(new THREE.HemisphereLight("#f4efe2", "#3a2a22", 0.9));
  const sun = new THREE.DirectionalLight("#fff2d2", 1.3);
  sun.position.set(-2, 4, 3);
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#8ec8ff", 0.55);
  rim.position.set(3, 2, -2);
  scene.add(rim);
  const figure = build();
  figure.rotation.y = 0.45;
  scene.add(figure);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
  camera.position.set(0.15, 1.15, 3.15);
  camera.lookAt(0, 0.85, 0);
  const target = new THREE.WebGLRenderTarget(width, height);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  const buffer = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(target, 0, 0, width, height, buffer);
  gl.setRenderTarget(previous);
  target.dispose();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const image = canvas.getContext("2d").createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4;
    image.data.set(buffer.subarray(src, src + width * 4), y * width * 4);
  }
  canvas.getContext("2d").putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
