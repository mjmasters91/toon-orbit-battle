import * as THREE from "three";

const cache = new Map();

function geo(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

const sphere = (r, w = 10, h = 8) => geo(`s${r}-${w}-${h}`, () => new THREE.SphereGeometry(r, w, h));
const box = (w, h, d) => geo(`b${w}-${h}-${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 6) => geo(`c${rt}-${rb}-${h}-${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 5) => geo(`n${r}-${h}-${s}`, () => new THREE.ConeGeometry(r, h, s));
const octa = (r) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const ico = (r) => geo(`i${r}`, () => new THREE.IcosahedronGeometry(r, 0));
const torus = (r, t, s = 10) => geo(`t${r}-${t}-${s}`, () => new THREE.TorusGeometry(r, t, 5, s));
const capsule = (r, len, s = 5) => geo(`p${r}-${len}-${s}`, () => new THREE.CapsuleGeometry(r, len, 2, s));

function wingGeo() {
  return geo("wing", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.2, 0.55, 0.7, 0.95, 1.35, 0.62);
    shape.bezierCurveTo(1.55, 0.28, 1.15, 0.02, 0.55, -0.08);
    shape.bezierCurveTo(0.25, -0.12, 0.08, -0.04, 0, 0);
    return new THREE.ShapeGeometry(shape);
  });
}

function leafGeo() {
  return geo("leaf", () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.28, 0.2, 0.1, 0.62);
    shape.quadraticCurveTo(0, 0.36, -0.1, 0.62);
    shape.quadraticCurveTo(-0.28, 0.2, 0, 0);
    return new THREE.ShapeGeometry(shape);
  });
}

function mat(color, opts = {}) {
  const opacity = opts.opacity ?? 1;
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.ei ?? (opts.emissive ? 0.6 : 0),
    roughness: opts.roughness ?? 0.56,
    metalness: opts.metalness ?? 0.05,
    flatShading: opts.flat !== false,
    transparent: opacity < 1,
    opacity,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? opacity > 0.75,
  });
}

function piece(parent, geometry, material, x, y, z, rot, scl) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (scl) mesh.scale.set(scl[0], scl[1], scl[2]);
  const seeThrough = material.transparent && material.opacity < 0.95;
  mesh.castShadow = !seeThrough;
  mesh.receiveShadow = !seeThrough;
  parent.add(mesh);
  return mesh;
}

let blobMaterial = null;
let blobGeometry = null;

function shadowBlob(root, radius) {
  if (!blobMaterial) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.5)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    blobMaterial = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    });
    blobGeometry = new THREE.CircleGeometry(1, 20);
  }
  const mesh = new THREE.Mesh(blobGeometry, blobMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.scale.setScalar(radius);
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  root.add(mesh);
}

function rig(bobAmp = 0.045) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  const body = new THREE.Group();
  const anchor = new THREE.Object3D();
  root.add(pivot);
  pivot.add(body);
  body.add(anchor);
  const built = {
    root,
    pivot,
    body,
    anchor,
    bobAmp,
    bobSpeed: 2.15,
    phase: Math.random() * Math.PI * 2,
    ringScale: 1,
    animate: null,
  };
  built.idle = (time, pose = {}) => {
    const bob = Math.sin(time * built.bobSpeed + built.phase) * built.bobAmp;
    const recoil = pose.recoil || 0;
    built.pivot.position.set(
      (pose.lunge || 0) - recoil * 0.4,
      bob + (pose.lift || 0) - (pose.topple || 0) * 0.7,
      0,
    );
    built.pivot.rotation.set((pose.topple || 0) * 0.15, 0, -(pose.topple || 0) * 1.2);
    built.animate?.(time, pose);
  };
  return built;
}

function eyes(parent, x, y, z, gap, size = 0.045, color = 0xfff6d8) {
  const material = mat(color, { emissive: color, ei: 0.9, roughness: 0.25 });
  piece(parent, sphere(size, 8, 6), material, x, y, z - gap);
  piece(parent, sphere(size, 8, 6), material, x, y, z + gap);
}

function finish(built, anchor, ringScale = 1, blob = 0.72) {
  built.anchor.position.set(anchor[0], anchor[1], anchor[2]);
  built.ringScale = ringScale;
  shadowBlob(built.root, blob);
  return built;
}

function wingPair(parent, material, x, y, z, span = 1) {
  const left = piece(parent, wingGeo(), material, x, y, z + 0.08, [ -0.35, -Math.PI / 2, 0 ], [span, span, span]);
  const right = piece(parent, wingGeo(), material, x, y, z - 0.08, [ 0.35, Math.PI / 2, 0 ], [span, span, span]);
  left.castShadow = false;
  right.castShadow = false;
  return { left, right };
}

function pyreling() {
  const built = rig(0.05);
  const body = built.body;
  const fur = mat(0xe25a12);
  const belly = mat(0xffb15e);
  const dark = mat(0x7a2a0c);
  const flame = mat(0xffe7a2, { emissive: 0xff4d1a, ei: 1, roughness: 0.32 });
  piece(body, sphere(0.38, 10, 8), fur, -0.05, 0.62, 0, null, [1.7, 0.72, 0.62]);
  piece(body, sphere(0.22, 8, 6), belly, 0.12, 0.5, 0, null, [1.2, 0.5, 0.5]);
  piece(body, sphere(0.26, 10, 8), fur, 0.58, 0.78, 0, null, [1.15, 0.9, 0.82]);
  piece(body, cone(0.09, 0.36, 5), dark, 0.86, 0.7, 0, [0, 0, -Math.PI / 2]);
  piece(body, cone(0.1, 0.38, 4), fur, 0.46, 1.08, 0.12, [0.2, 0, 0.1]);
  piece(body, cone(0.1, 0.38, 4), fur, 0.46, 1.08, -0.12, [-0.2, 0, 0.1]);
  eyes(body, 0.72, 0.84, 0, 0.09, 0.04, 0xfff1b0);
  for (const [x, z] of [[0.22, 0.18], [0.22, -0.18], [-0.32, 0.16], [-0.32, -0.16]]) {
    piece(body, capsule(0.075, 0.26, 4), dark, x, 0.28, z);
  }
  const flames = new THREE.Group();
  body.add(flames);
  [[0.05, 1.02, 0, 0.32], [-0.22, 0.96, 0.12, 0.24], [-0.24, 0.96, -0.1, 0.22], [0.18, 0.98, 0.08, 0.18]].forEach(
    ([x, y, z, h], index) => {
      piece(flames, cone(0.07, h, 4), flame, x, y, z, [0, 0, index % 2 ? 0.3 : -0.25]);
    },
  );
  const tail = new THREE.Group();
  tail.position.set(-0.58, 0.74, 0);
  body.add(tail);
  piece(tail, sphere(0.14, 8, 6), fur, -0.08, 0.06, 0);
  piece(tail, sphere(0.12, 8, 6), flame, -0.26, 0.2, 0);
  piece(tail, sphere(0.09, 8, 6), flame, -0.4, 0.36, 0);
  built.animate = (time) => {
    tail.rotation.z = 0.55 + Math.sin(time * 3.2) * 0.2;
    tail.rotation.y = Math.sin(time * 4.2) * 0.35;
    flames.scale.y = 0.86 + Math.sin(time * 14) * 0.16;
  };
  return finish(built, [0.4, 1.28, 0], 1, 0.78);
}

function cindermaw() {
  const built = rig(0.03);
  built.bobSpeed = 1.5;
  const body = built.body;
  const hide = mat(0x6a2a16);
  const rock = mat(0x2c211c, { roughness: 0.85 });
  const belly = mat(0x8d3b1e);
  const lava = mat(0xffb15a, { emissive: 0xff4a12, ei: 0.95 });
  piece(body, sphere(0.72, 10, 8), hide, -0.05, 0.86, 0, null, [1.25, 0.82, 0.95]);
  piece(body, sphere(0.4, 8, 6), belly, 0.1, 0.62, 0, null, [1.1, 0.55, 0.8]);
  piece(body, sphere(0.42, 10, 8), hide, 0.72, 0.98, 0, null, [1.15, 0.85, 1.05]);
  const jaw = new THREE.Group();
  jaw.position.set(0.78, 0.78, 0);
  body.add(jaw);
  piece(jaw, box(0.46, 0.16, 0.48), hide, 0.22, -0.02, 0);
  piece(jaw, box(0.16, 0.1, 0.08), mat(0xf2efe6), 0.4, 0.08, 0.12);
  piece(jaw, box(0.16, 0.1, 0.08), mat(0xf2efe6), 0.4, 0.08, -0.12);
  piece(body, box(0.42, 0.14, 0.46), rock, 0.86, 1.02, 0);
  piece(body, sphere(0.08, 6, 5), lava, 0.95, 0.9, 0);
  eyes(body, 0.98, 1.12, 0, 0.16, 0.05, 0xffc14a);
  piece(body, cone(0.1, 0.32, 4), rock, 0.7, 1.38, 0.2, [0.3, 0, 0.2]);
  piece(body, cone(0.1, 0.32, 4), rock, 0.7, 1.38, -0.2, [-0.3, 0, 0.2]);
  [[-0.15, 1.28, 0], [0.15, 1.2, 0.18], [-0.35, 1.12, -0.16]].forEach(([x, y, z], index) => {
    piece(body, box(0.36, 0.12, 0.28), rock, x, y, z, [0.2, index, 0.15]);
  });
  [[-0.05, 0.95], [-0.3, 0.8], [0.2, 0.75]].forEach(([x, y]) => {
    piece(body, box(0.16, 0.05, 0.05), lava, x, y, 0.42);
  });
  for (const [x, z] of [[0.35, 0.32], [0.35, -0.32], [-0.4, 0.3], [-0.4, -0.3]]) {
    piece(body, cyl(0.14, 0.16, 0.42, 5), rock, x, 0.24, z);
  }
  built.animate = (time) => {
    jaw.rotation.z = -0.32 + Math.sin(time * 1.6) * 0.1;
  };
  return finish(built, [0.55, 1.7, 0], 1.35, 1.05);
}

function galewing() {
  const built = rig(0.04);
  const body = built.body;
  const feather = mat(0x7fbf62);
  const chest = mat(0xf4f0d8);
  const beak = mat(0xe6b15a, { roughness: 0.4 });
  const wingMat = mat(0xd7f3b0, { side: THREE.DoubleSide, roughness: 0.7, emissive: 0x6ea85a, ei: 0.15 });
  piece(body, sphere(0.32, 10, 8), feather, 0, 1.05, 0, null, [0.85, 1.15, 0.75]);
  piece(body, sphere(0.2, 8, 6), chest, 0.12, 0.95, 0, null, [0.7, 0.8, 0.6]);
  piece(body, sphere(0.2, 8, 6), feather, 0.18, 1.48, 0);
  piece(body, cone(0.08, 0.34, 4), beak, 0.42, 1.46, 0, [0, 0, -Math.PI / 2]);
  piece(body, cone(0.05, 0.22, 4), feather, 0.12, 1.72, 0);
  eyes(body, 0.3, 1.54, 0, 0.08, 0.035, 0x16301a);
  piece(body, capsule(0.07, 0.46, 4), feather, 0.05, 0.48, 0.1, [0, 0, 0.15]);
  piece(body, capsule(0.07, 0.46, 4), feather, 0.05, 0.48, -0.1, [0, 0, 0.15]);
  piece(body, cone(0.06, 0.16, 4), beak, 0.08, 0.12, 0.12);
  piece(body, cone(0.06, 0.16, 4), beak, 0.08, 0.12, -0.12);
  const wings = wingPair(body, wingMat, -0.05, 1.2, 0, 0.82);
  const tail = new THREE.Group();
  tail.position.set(-0.28, 1.05, 0);
  body.add(tail);
  piece(tail, box(0.28, 0.06, 0.12), feather, -0.2, 0.08, 0.12, [0, 0.4, 0.4]);
  piece(tail, box(0.34, 0.06, 0.12), feather, -0.24, 0.02, 0, [0, 0, 0.2]);
  piece(tail, box(0.28, 0.06, 0.12), feather, -0.2, 0.08, -0.12, [0, -0.4, 0.4]);
  built.animate = (time) => {
    const flap = Math.sin(time * 7) * 0.45;
    wings.left.rotation.z = flap;
    wings.right.rotation.z = -flap;
    tail.rotation.y = Math.sin(time * 3) * 0.25;
  };
  return finish(built, [0.15, 1.9, 0], 1.05, 0.62);
}

function tidecaller() {
  const built = rig(0.07);
  built.bobSpeed = 1.7;
  const body = built.body;
  const robe = mat(0x147e86);
  const pale = mat(0xd9fff8);
  const water = mat(0x7ee7e2, { opacity: 0.82, roughness: 0.22, emissive: 0x147a86, ei: 0.28, side: THREE.DoubleSide });
  const orbMat = mat(0xe8fffc, { emissive: 0x7af0ea, ei: 1.1, roughness: 0.15 });
  piece(body, cone(0.48, 1.05, 8), robe, 0, 0.58, 0);
  piece(body, sphere(0.26, 10, 8), robe, 0, 1.32, 0, null, [0.85, 1.05, 0.7]);
  piece(body, sphere(0.16, 8, 6), pale, 0.08, 1.28, 0, null, [0.5, 0.7, 0.4]);
  piece(body, sphere(0.2, 10, 8), pale, 0, 1.72, 0);
  piece(body, cone(0.14, 0.26, 4), robe, 0, 1.96, 0);
  eyes(body, 0.12, 1.76, 0, 0.07, 0.03, 0x08343a);
  const ribbons = new THREE.Group();
  body.add(ribbons);
  const ribbonGeo = wingGeo();
  for (const side of [-1, 1]) {
    const ribbon = piece(ribbons, ribbonGeo, water, -0.02, 0.62, 0.18 * side, [0.7 * side, side, 1.15], [0.32, 0.48, 0.32]);
    ribbon.castShadow = false;
    ribbon.userData.side = side;
  }
  const drops = [];
  for (let i = 0; i < 4; i += 1) {
    const drop = piece(body, sphere(0.05, 6, 5), water, -0.1 + i * 0.05, 0.35 + (i % 2) * 0.2, (i - 1.5) * 0.12);
    drop.castShadow = false;
    drops.push(drop);
  }
  const armL = piece(body, capsule(0.06, 0.38, 4), robe, 0.08, 1.28, 0.28, [0.4, 0, -0.8]);
  const armR = piece(body, capsule(0.06, 0.38, 4), robe, 0.08, 1.28, -0.28, [-0.4, 0, -0.8]);
  const orb = piece(body, ico(0.12), orbMat, 0.32, 1.18, 0);
  built.animate = (time) => {
    ribbons.rotation.y = Math.sin(time * 1.2) * 0.25;
    orb.rotation.y = time * 1.6;
    orb.position.y = 1.18 + Math.sin(time * 2.4) * 0.06;
    armL.rotation.z = -0.8 + Math.sin(time * 2) * 0.08;
    armR.rotation.z = -0.8 + Math.sin(time * 2) * 0.08;
    drops.forEach((drop, index) => {
      drop.position.y = 0.28 + ((time * 0.35 + index * 0.25) % 0.7);
    });
  };
  return finish(built, [0, 2.15, 0], 0.95, 0.62);
}

function lumenhart() {
  const built = rig(0.035);
  const body = built.body;
  const coat = mat(0xf3e6cf);
  const shade = mat(0xd9c4a2);
  const gold = mat(0xffd56a, { emissive: 0xffc14a, ei: 0.7, roughness: 0.35, metalness: 0.2 });
  piece(body, sphere(0.36, 10, 8), coat, 0, 0.95, 0, null, [1.45, 0.85, 0.72]);
  piece(body, sphere(0.16, 8, 6), shade, 0.15, 0.82, 0, null, [1.1, 0.7, 0.6]);
  piece(body, cyl(0.08, 0.1, 0.48, 6), coat, 0.42, 1.28, 0, [0, 0, -0.9]);
  piece(body, sphere(0.16, 8, 6), coat, 0.62, 1.5, 0, null, [1.25, 0.85, 0.8]);
  piece(body, cone(0.07, 0.2, 4), shade, 0.82, 1.42, 0, [0, 0, -Math.PI / 2]);
  eyes(body, 0.72, 1.56, 0, 0.07, 0.028, 0x2a2418);
  piece(body, octa(0.08), gold, 0.62, 1.68, 0);
  const antlers = new THREE.Group();
  antlers.position.set(0.58, 1.62, 0);
  body.add(antlers);
  for (const side of [-1, 1]) {
    const branch = new THREE.Group();
    branch.position.set(0, 0, 0.08 * side);
    branch.rotation.z = -0.4;
    branch.rotation.x = 0.55 * side;
    antlers.add(branch);
    piece(branch, cyl(0.025, 0.04, 0.46, 4), gold, 0, 0.22, 0);
    piece(branch, cyl(0.018, 0.028, 0.24, 4), gold, 0.1, 0.38, 0, [0, 0, -1]);
    piece(branch, cyl(0.016, 0.024, 0.2, 4), gold, -0.02, 0.42, 0.06, [0.6, 0, 0.3]);
  }
  for (const [x, z] of [[0.22, 0.16], [0.22, -0.16], [-0.32, 0.15], [-0.32, -0.15]]) {
    piece(body, capsule(0.055, 0.62, 4), shade, x, 0.42, z);
  }
  piece(body, sphere(0.08, 6, 5), coat, -0.62, 1.05, 0);
  built.animate = (time) => {
    antlers.rotation.y = Math.sin(time * 1.4) * 0.06;
  };
  return finish(built, [0.45, 1.95, 0], 1.1, 0.8);
}

function umbraknight() {
  const built = rig(0.025);
  const body = built.body;
  const plate = mat(0x4a4168, { metalness: 0.48, roughness: 0.35 });
  const trim = mat(0x8d7bb8, { metalness: 0.35, roughness: 0.4, emissive: 0x3a2a58, ei: 0.25 });
  const cloth = mat(0x2a2040, { side: THREE.DoubleSide, roughness: 0.8 });
  const glow = mat(0xe4d9ff, { emissive: 0xa78bfa, ei: 1 });
  piece(body, box(0.38, 0.5, 0.28), plate, 0, 1.15, 0);
  piece(body, box(0.28, 0.42, 0.22), trim, 0.04, 1.12, 0);
  piece(body, box(0.22, 0.26, 0.24), plate, 0, 1.58, 0);
  piece(body, box(0.18, 0.06, 0.2), glow, 0.12, 1.56, 0);
  piece(body, cone(0.08, 0.28, 4), plate, 0, 1.86, 0);
  piece(body, sphere(0.12, 6, 5), plate, 0, 1.28, 0.24);
  piece(body, sphere(0.12, 6, 5), plate, 0, 1.28, -0.24);
  piece(body, capsule(0.07, 0.4, 4), plate, 0.02, 1.15, 0.32, [0, 0, -0.15]);
  piece(body, capsule(0.07, 0.4, 4), plate, 0.02, 1.15, -0.18, [0.1, 0, 0.35]);
  piece(body, box(0.14, 0.46, 0.16), plate, 0.04, 0.48, 0.1);
  piece(body, box(0.14, 0.46, 0.16), plate, 0.04, 0.48, -0.1);
  const cape = piece(body, new THREE.PlaneGeometry(0.72, 0.95), cloth, -0.18, 1.15, 0);
  cape.castShadow = false;
  const sword = new THREE.Group();
  sword.position.set(0.1, 0.95, 0.34);
  body.add(sword);
  piece(sword, box(0.06, 0.7, 0.05), glow, 0.05, 0.35, 0);
  piece(sword, box(0.2, 0.06, 0.08), trim, 0.05, 0.02, 0);
  built.animate = (time) => {
    cape.rotation.y = Math.sin(time * 1.5) * 0.12;
    cape.rotation.x = 0.08;
    sword.rotation.z = -0.15 + Math.sin(time * 1.2) * 0.04;
  };
  return finish(built, [0, 2.05, 0], 1, 0.62);
}

function thorngust() {
  const built = rig(0.04);
  const body = built.body;
  const vine = mat(0x3e6a38);
  const leaf = mat(0xb6e36a, { side: THREE.DoubleSide, emissive: 0x6ea84a, ei: 0.18 });
  const thorn = mat(0xe7e2b4, { roughness: 0.4 });
  const bloom = mat(0xf4f7d8, { emissive: 0xd6e68a, ei: 0.25 });
  piece(body, cyl(0.12, 0.16, 0.7, 6), vine, 0, 0.85, 0);
  piece(body, sphere(0.22, 8, 6), vine, 0, 1.28, 0);
  const head = new THREE.Group();
  head.position.set(0.04, 1.58, 0);
  body.add(head);
  piece(head, sphere(0.2, 8, 6), bloom, 0, 0.05, 0);
  for (let i = 0; i < 5; i += 1) {
    const petal = piece(head, leafGeo(), leaf, 0, 0.05, 0);
    petal.rotation.y = (i / 5) * Math.PI * 2;
    petal.rotation.z = 0.7;
    petal.position.y = 0.12;
  }
  eyes(head, 0.12, 0.08, 0, 0.07, 0.03, 0x1d3318);
  const skirt = new THREE.Group();
  skirt.position.set(0, 0.7, 0);
  body.add(skirt);
  for (let i = 0; i < 6; i += 1) {
    const frond = piece(skirt, leafGeo(), leaf, 0, 0, 0, null, [1.3, 1.3, 1.3]);
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.rotation.x = 0.9;
  }
  const armL = piece(body, capsule(0.045, 0.46, 4), vine, 0.05, 1.15, 0.22, [0.2, 0, -0.7]);
  const armR = piece(body, capsule(0.045, 0.46, 4), vine, 0.05, 1.15, -0.22, [-0.2, 0, -0.7]);
  piece(armL, cone(0.04, 0.14, 4), thorn, 0, 0.18, 0.08, [1, 0, 0]);
  piece(armR, cone(0.04, 0.14, 4), thorn, 0, 0.18, -0.08, [1, 0, 0]);
  piece(body, cone(0.08, 0.28, 4), vine, 0.06, 0.16, 0.1, [0.2, 0, 0.2]);
  piece(body, cone(0.08, 0.28, 4), vine, 0.06, 0.16, -0.1, [-0.2, 0, 0.2]);
  built.animate = (time) => {
    skirt.rotation.y = Math.sin(time * 1.3) * 0.15;
    head.rotation.y = Math.sin(time * 1.6) * 0.12;
    armL.rotation.z = -0.7 + Math.sin(time * 2) * 0.1;
    armR.rotation.z = -0.7 + Math.sin(time * 2 + 0.4) * 0.1;
  };
  return finish(built, [0, 2.05, 0], 1, 0.66);
}

function voidmoth() {
  const built = rig(0.14);
  built.bobSpeed = 1.8;
  const body = built.body;
  body.position.y = 1.15;
  const hide = mat(0x241833);
  const wingMat = mat(0x4b2d78, { side: THREE.DoubleSide, emissive: 0x6a48b0, ei: 0.28, opacity: 0.94 });
  const spot = mat(0xefe6ff, { emissive: 0xc8b6ff, ei: 0.8 });
  piece(body, sphere(0.22, 8, 6), hide, 0, 0.15, 0, null, [1.4, 0.7, 0.7]);
  piece(body, sphere(0.12, 8, 6), hide, 0.22, 0.18, 0);
  eyes(body, 0.3, 0.22, 0, 0.05, 0.03, 0xf4eeff);
  piece(body, cyl(0.012, 0.012, 0.28, 4), spot, 0.2, 0.34, 0.06, [0.2, 0, -0.5]);
  piece(body, cyl(0.012, 0.012, 0.28, 4), spot, 0.2, 0.34, -0.06, [-0.2, 0, -0.5]);
  const upper = wingPair(body, wingMat, -0.05, 0.22, 0, 1.25);
  const lower = wingPair(body, wingMat, -0.05, 0.02, 0, 0.85);
  piece(upper.left, sphere(0.1, 8, 6), spot, 0.7, 0.28, 0.02);
  piece(upper.right, sphere(0.1, 8, 6), spot, 0.7, 0.28, 0.02);
  built.animate = (time) => {
    const flap = Math.sin(time * 6.5) * 0.55;
    upper.left.rotation.z = -0.2 + flap;
    upper.right.rotation.z = 0.2 - flap;
    lower.left.rotation.z = 0.25 + flap * 0.6;
    lower.right.rotation.z = -0.25 - flap * 0.6;
  };
  return finish(built, [0.1, 0.55, 0], 1.15, 0.7);
}

function brinehorn() {
  const built = rig(0.028);
  built.bobSpeed = 1.6;
  const body = built.body;
  const shell = mat(0xc45c38, { roughness: 0.48 });
  const under = mat(0xf0c39a);
  const claw = mat(0xf6e2c8, { roughness: 0.4 });
  const horn = mat(0xf7f1df, { roughness: 0.35 });
  piece(body, sphere(0.62, 10, 8), shell, 0, 0.78, 0, null, [1.15, 0.72, 1.15]);
  piece(body, sphere(0.4, 8, 6), under, 0.1, 0.48, 0, null, [0.9, 0.45, 0.9]);
  piece(body, cone(0.12, 0.48, 5), horn, -0.05, 1.28, 0, [0.2, 0, 0.15]);
  const claws = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set(0.55, 0.55, 0.42 * side);
    body.add(group);
    piece(group, capsule(0.1, 0.34, 4), claw, 0.2, 0.05, 0, [0, 0, -1.1]);
    piece(group, cone(0.1, 0.28, 4), claw, 0.48, 0.08, 0.06, [0, 0, -1.3]);
    piece(group, cone(0.08, 0.22, 4), claw, 0.42, -0.02, -0.06, [0, 0, -0.7]);
    claws.push(group);
  }
  for (let i = 0; i < 4; i += 1) {
    const z = i < 2 ? 0.28 : -0.28;
    const x = i % 2 === 0 ? 0.15 : -0.3;
    piece(body, cyl(0.06, 0.08, 0.36, 5), under, x, 0.2, z, [0.4, 0, 0]);
  }
  const stalkL = piece(body, cyl(0.03, 0.03, 0.22, 5), under, 0.35, 1.05, 0.16);
  const stalkR = piece(body, cyl(0.03, 0.03, 0.22, 5), under, 0.35, 1.05, -0.16);
  piece(stalkL, sphere(0.06, 8, 6), mat(0x1a2428, { emissive: 0xfff2c8, ei: 0.4 }), 0, 0.14, 0);
  piece(stalkR, sphere(0.06, 8, 6), mat(0x1a2428, { emissive: 0xfff2c8, ei: 0.4 }), 0, 0.14, 0);
  [[0.1, 1.15, 0.3], [-0.2, 1.05, -0.35], [0.05, 0.95, 0.4]].forEach(([x, y, z]) => {
    piece(body, sphere(0.07, 6, 5), mat(0x8d3e2c), x, y, z);
  });
  built.animate = (time) => {
    claws[0].rotation.y = Math.sin(time * 2) * 0.12;
    claws[1].rotation.y = -Math.sin(time * 2) * 0.12;
    stalkL.rotation.x = Math.sin(time * 1.5) * 0.1;
    stalkR.rotation.x = -Math.sin(time * 1.5) * 0.1;
  };
  return finish(built, [0.2, 1.55, 0], 1.3, 1);
}

function solshard() {
  const built = rig(0.03);
  const body = built.body;
  const crystal = mat(0xffe7a0, { emissive: 0xffc14a, ei: 0.45, roughness: 0.18, metalness: 0.35 });
  const core = mat(0xfff8e4, { emissive: 0xfff1c2, ei: 0.8, roughness: 0.12, metalness: 0.2 });
  const pale = mat(0xf7f1dc, { roughness: 0.25, metalness: 0.2, emissive: 0xffe0a0, ei: 0.2 });
  piece(body, cyl(0.12, 0.16, 0.55, 5), pale, 0.06, 0.4, 0.12);
  piece(body, cyl(0.12, 0.16, 0.55, 5), pale, 0.06, 0.4, -0.12);
  piece(body, octa(0.48), crystal, 0, 1.15, 0);
  piece(body, octa(0.18), core, 0.05, 1.15, 0.05);
  piece(body, octa(0.2), crystal, 0, 1.62, 0);
  const shards = [];
  [[0.15, 1.25, 0.42], [0.1, 1.05, -0.4], [-0.15, 1.4, 0.28]].forEach(([x, y, z], index) => {
    const shard = piece(body, octa(0.14 + index * 0.02), crystal, x, y, z);
    shards.push({ shard, y });
  });
  eyes(body, 0.16, 1.66, 0, 0.07, 0.035, 0xfff6d0);
  built.animate = (time) => {
    shards.forEach((item, index) => {
      item.shard.position.y = item.y + Math.sin(time * 2 + index) * 0.08;
      item.shard.rotation.y = time * 0.8 + index;
    });
  };
  return finish(built, [0, 1.95, 0], 1.05, 0.7);
}

function mistlyn() {
  const built = rig(0.04);
  const body = built.body;
  const scale = mat(0x1c7f8c);
  const belly = mat(0xd8fff6);
  const fin = mat(0x8ee0d4, { side: THREE.DoubleSide, emissive: 0x3ec6c6, ei: 0.2 });
  const segments = [];
  for (let i = 0; i < 8; i += 1) {
    const along = i / 7;
    const angle = along * Math.PI * 1.5 - 0.2;
    const radius = 0.42;
    const x = Math.cos(angle) * radius * 0.85;
    const z = Math.sin(angle) * radius;
    const y = 0.38 + along * 0.85;
    const size = 0.2 - along * 0.1;
    const mesh = piece(body, sphere(Math.max(0.08, size), 8, 6), i % 2 ? scale : belly, x, y, z);
    segments.push({ mesh, x, y, z });
  }
  const head = segments[7].mesh;
  piece(head, cone(0.08, 0.18, 4), fin, 0.12, 0.02, 0.08, [0.4, 0, -0.6]);
  piece(head, cone(0.08, 0.18, 4), fin, 0.12, 0.02, -0.08, [-0.4, 0, -0.6]);
  eyes(head, 0.1, 0.04, 0, 0.05, 0.025, 0xe8fff8);
  built.animate = (time) => {
    segments.forEach((seg, index) => {
      seg.mesh.position.y = seg.y + Math.sin(time * 2.2 + index * 0.55) * 0.05;
      seg.mesh.position.z = seg.z + Math.cos(time * 1.7 + index * 0.4) * 0.04;
    });
  };
  return finish(built, [0.15, 1.55, 0], 1, 0.7);
}

function duskwhelp() {
  const built = rig(0.04);
  const body = built.body;
  const fur = mat(0x2a2438);
  const mist = mat(0x6d5c92, { opacity: 0.45, emissive: 0x5a4a86, ei: 0.25, depthWrite: false });
  const ear = mat(0x3a3154);
  piece(body, sphere(0.36, 10, 8), fur, -0.05, 0.62, 0, null, [1.4, 0.72, 0.62]);
  piece(body, sphere(0.22, 8, 6), fur, 0.42, 0.78, 0, null, [1.2, 0.85, 0.8]);
  piece(body, cone(0.08, 0.22, 4), fur, 0.66, 0.7, 0, [0, 0, -Math.PI / 2]);
  eyes(body, 0.52, 0.86, 0, 0.08, 0.035, 0xe4dcff);
  piece(body, cone(0.07, 0.22, 4), ear, 0.34, 1.02, 0.1, [0.2, 0, 0.4]);
  const bent = piece(body, cone(0.06, 0.16, 4), ear, 0.36, 0.98, -0.12, [0.8, 0, 0.2]);
  for (const [x, z] of [[0.18, 0.16], [0.18, -0.16], [-0.28, 0.14], [-0.28, -0.14]]) {
    piece(body, capsule(0.06, 0.28, 4), fur, x, 0.28, z);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.55, 0.7, 0);
  body.add(tail);
  piece(tail, sphere(0.12, 8, 6), mist, -0.1, 0.06, 0);
  piece(tail, sphere(0.1, 8, 6), mist, -0.26, 0.14, 0);
  piece(tail, sphere(0.08, 8, 6), mist, -0.4, 0.24, 0);
  built.animate = (time) => {
    tail.rotation.y = Math.sin(time * 3) * 0.4;
    tail.rotation.z = 0.3 + Math.sin(time * 2.4) * 0.15;
    bent.rotation.z = 0.2 + Math.sin(time * 2) * 0.08;
  };
  return finish(built, [0.35, 1.2, 0], 1.05, 0.75);
}

const BUILDERS = {
  pyreling,
  cindermaw,
  galewing,
  tidecaller,
  lumenhart,
  umbraknight,
  thorngust,
  voidmoth,
  brinehorn,
  solshard,
  mistlyn,
  duskwhelp,
};

export function buildMonster(id) {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`No Stellarbound model for ${id}`);
  const built = builder();
  built.root.userData.monsterId = id;
  return built;
}
