import * as THREE from "../vendor/three/three.module.js";
import { LOOKS, lookSignature } from "./looks.js";
import { ELEMENT, basicMat, mat, outlineMaterial, ownMat } from "./materials.js";

const geos = {};

function geo(name, build) {
  if (!geos[name]) geos[name] = build();
  return geos[name];
}

function lathe(name, pts, segments = 14) {
  return geo(name, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments));
}

function add(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.shell = true;
  parent.add(mesh);
  return mesh;
}

function remember(group) {
  group.userData.rest = {
    x: group.rotation.x, y: group.rotation.y, z: group.rotation.z,
    px: group.position.x, py: group.position.y, pz: group.position.z,
  };
}

function applyRest(group) {
  const rest = group.userData.rest;
  if (!rest) return;
  group.rotation.set(rest.x, rest.y, rest.z);
  group.position.set(rest.px, rest.py, rest.pz);
}

function plantFeet(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

function shellPass(root) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh && node.userData.shell) meshes.push(node);
  });
  const material = outlineMaterial();
  for (const mesh of meshes) {
    const hull = new THREE.Mesh(mesh.geometry, material);
    hull.position.copy(mesh.position);
    hull.quaternion.copy(mesh.quaternion);
    hull.scale.copy(mesh.scale);
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.userData.shell = false;
    mesh.parent.add(hull);
  }
}

function rig() {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.02;
  const spine = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 0.58;
  const armL = new THREE.Group();
  armL.position.set(-0.2, 0.42, 0);
  const armR = new THREE.Group();
  armR.position.set(0.2, 0.42, 0);
  const legL = new THREE.Group();
  legL.position.set(-0.09, 0.02, 0);
  const legR = new THREE.Group();
  legR.position.set(0.09, 0.02, 0);
  hips.add(spine, legL, legR);
  spine.add(head, armL, armR);
  root.add(hips);
  for (const part of [hips, spine, head, armL, armR, legL, legR]) remember(part);
  root.userData.parts = { hips, spine, head, armL, armR, legL, legR };
  return root;
}

function face(head, look) {
  const skin = mat(look.skin);
  const skull = add(head, lathe("skull", [
    [0.01, -0.02], [0.1, 0.02], [0.16, 0.1], [0.175, 0.2], [0.15, 0.32], [0.07, 0.38], [0.0, 0.4],
  ], 22), skin, 0, 0, 0);
  skull.userData.shell = true;
  const white = mat("#f7f1ea");
  const iris = mat(look.trim);
  const pupil = mat("#1a1214");
  for (const side of [-1, 1]) {
    const eye = add(head, geo("sclera", () => new THREE.SphereGeometry(0.045, 10, 8)), white, side * 0.062, 0.16, 0.145, 1, 1.05, 0.72);
    eye.userData.shell = false;
    const color = add(head, geo("iris", () => new THREE.SphereGeometry(0.024, 8, 6)), iris, side * 0.062, 0.158, 0.172);
    color.userData.shell = false;
    const dot = add(head, geo("pupil", () => new THREE.SphereGeometry(0.012, 6, 5)), pupil, side * 0.062, 0.158, 0.188);
    dot.userData.shell = false;
  }
  const brow = add(head, geo("brow", () => new THREE.BoxGeometry(0.16, 0.018, 0.03)), mat(look.hair), 0, 0.22, 0.15);
  brow.userData.shell = false;
  const mouth = add(head, geo("mouth", () => new THREE.BoxGeometry(0.05, 0.012, 0.02)), mat("#a85a62"), 0, 0.08, 0.155);
  mouth.userData.shell = false;
  if (look.horns) {
    for (const side of [-1, 1]) {
      const horn = add(head, geo("horn", () => new THREE.ConeGeometry(0.035, 0.26, 8)), mat(look.trim, { emissive: look.trim, emissiveIntensity: 0.25 }), side * 0.1, 0.36, 0);
      horn.rotation.z = side * -0.45;
    }
  }
  if (look.halo) {
    const halo = add(head, geo("halo", () => new THREE.TorusGeometry(0.16, 0.016, 6, 18)), mat(look.trim, { emissive: look.trim, emissiveIntensity: 0.8 }), 0, 0.46, 0);
    halo.rotation.x = Math.PI / 2;
  }
}

function hair(head, look) {
  if (look.hairStyle === "bald") return;
  const color = mat(look.hair);
  if (look.hairStyle === "hood") {
    add(head, lathe("hood", [
      [0.02, 0.02], [0.16, 0.08], [0.2, 0.22], [0.16, 0.4], [0.04, 0.46],
    ], 12), mat(look.cloth), 0, 0.02, -0.02);
    return;
  }
  add(head, lathe("haircap", [
    [0.02, 0.16], [0.12, 0.2], [0.19, 0.3], [0.16, 0.4], [0.04, 0.46],
  ], 14), color, 0, 0.02, -0.03);
  const bang = add(head, geo("bang", () => new THREE.SphereGeometry(0.08, 8, 6)), color, 0, 0.3, 0.1, 1.5, 0.45, 0.7);
  bang.userData.shell = true;
  if (look.hairStyle === "long" || look.hairStyle === "wild") {
    for (const side of [-1, 1]) {
      const lock = add(head, geo("lock", () => new THREE.CylinderGeometry(0.035, 0.055, 0.42, 8)), color, side * 0.14, -0.02, -0.02);
      lock.rotation.z = side * 0.15;
    }
    const back = add(head, geo("backlock", () => new THREE.CylinderGeometry(0.04, 0.07, 0.5, 8)), color, 0, -0.06, -0.1);
    back.rotation.x = 0.2;
  }
  if (look.hairStyle === "braid") {
    const braid = add(head, geo("braid", () => new THREE.CylinderGeometry(0.03, 0.045, 0.46, 6)), color, 0.15, -0.04, 0.02);
    braid.rotation.z = -0.2;
  }
  if (look.hairStyle === "bun") {
    add(head, geo("bun", () => new THREE.SphereGeometry(0.09, 10, 8)), color, 0, 0.42, -0.04);
  }
  if (look.hairStyle === "crest") {
    const crest = add(head, geo("crest", () => new THREE.ConeGeometry(0.07, 0.28, 6)), color, 0, 0.5, -0.02);
    crest.rotation.x = -0.2;
  }
  if (look.hairStyle === "wild") {
    add(head, geo("tuft", () => new THREE.ConeGeometry(0.05, 0.16, 5)), color, -0.1, 0.42, 0.04);
    add(head, geo("tuft", () => new THREE.ConeGeometry(0.05, 0.18, 5)), color, 0.08, 0.44, 0);
  }
}

function weaponGeo(type) {
  if (type === "sword" || type === "twinblade") {
    return geo("blade", () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.04, 0.06);
      shape.lineTo(0.028, 0.46);
      shape.lineTo(0, 0.54);
      shape.lineTo(-0.028, 0.46);
      shape.lineTo(-0.04, 0.06);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    });
  }
  if (type === "spear" || type === "trident" || type === "scythe" || type === "staff") {
    return geo(type === "staff" ? "staff" : "shaft", () => new THREE.CylinderGeometry(0.02, 0.028, type === "staff" ? 0.92 : 0.84, 8));
  }
  if (type === "bow") return geo("bow", () => new THREE.TorusGeometry(0.22, 0.016, 6, 14, Math.PI));
  if (type === "fan") return geo("fan", () => new THREE.ConeGeometry(0.16, 0.26, 5));
  if (type === "shield") return geo("shield", () => new THREE.CylinderGeometry(0.16, 0.18, 0.045, 8));
  if (type === "anchor") return geo("anchor", () => new THREE.TorusGeometry(0.12, 0.028, 6, 12, Math.PI));
  if (type === "hammer") return geo("hammer", () => new THREE.BoxGeometry(0.22, 0.12, 0.12));
  if (type === "lantern") return geo("lantern", () => new THREE.OctahedronGeometry(0.09, 0));
  if (type === "claws") return geo("claw", () => new THREE.ConeGeometry(0.028, 0.18, 5));
  if (type === "pail") return geo("pail", () => new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8));
  if (type === "ribbon") return geo("ribbon", () => new THREE.BoxGeometry(0.06, 0.42, 0.012));
  return geo("token", () => new THREE.OctahedronGeometry(0.08, 0));
}

function armWeapon(arm, look, mirror = false) {
  const metal = mat(look.trim, { emissive: look.trim, emissiveIntensity: 0.2 });
  const mesh = new THREE.Mesh(
    weaponGeo(look.weapon),
    look.weapon === "lantern" ? ownMat(look.trim, { emissive: look.trim, emissiveIntensity: 0.9 }) : metal,
  );
  mesh.castShadow = true;
  mesh.userData.shell = true;
  mesh.position.set(mirror ? -0.02 : 0.02, -0.36, 0.06);
  if (look.weapon === "shield") mesh.rotation.x = Math.PI / 2;
  if (look.weapon === "bow") mesh.rotation.z = Math.PI / 2;
  if (look.weapon === "anchor") mesh.rotation.z = Math.PI;
  arm.add(mesh);
  if (look.weapon === "scythe") {
    const blade = add(arm, geo("scytheblade", () => new THREE.TorusGeometry(0.16, 0.018, 6, 10, Math.PI * 0.85)), metal, 0.02, -0.72, 0.04);
    blade.rotation.z = -0.5;
  }
  if (look.weapon === "trident" || look.weapon === "spear") {
    add(arm, geo("speartip", () => new THREE.ConeGeometry(0.04, 0.16, 6)), metal, 0, -0.8, 0);
  }
  if (look.weapon === "trident") {
    add(arm, geo("tine", () => new THREE.ConeGeometry(0.02, 0.12, 5)), metal, -0.06, -0.74, 0);
    add(arm, geo("tine", () => new THREE.ConeGeometry(0.02, 0.12, 5)), metal, 0.06, -0.74, 0);
  }
  if (look.weapon === "hammer") add(arm, geo("haft", () => new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6)), mat("#5a3a22"), 0, -0.18, 0);
  if (look.weapon === "claws") {
    add(arm, weaponGeo("claws"), metal, -0.04, -0.32, 0.08);
    add(arm, weaponGeo("claws"), metal, 0.04, -0.32, 0.08);
  }
}

function dress(root, look) {
  const { spine, head, armL, armR, legL, legR } = root.userData.parts;
  const bulk = look.bulk || 1;
  const cloth = mat(look.cloth);
  const trim = mat(look.trim, { emissive: look.trim, emissiveIntensity: 0.18 });
  const skin = mat(look.skin);
  const bootMat = mat("#241810");
  face(head, look);
  hair(head, look);
  const torsoPts = look.robe
    ? [[0.08, 0], [0.2 * bulk, 0.06], [0.22 * bulk, 0.28], [0.16 * bulk, 0.48], [0.08, 0.58]]
    : [[0.1, 0], [0.16 * bulk, 0.05], [0.12 * bulk, 0.2], [0.1 * bulk, 0.3], [0.17 * bulk, 0.44], [0.11, 0.54], [0.07, 0.58]];
  add(spine, lathe(look.robe ? "robe" : "torso", torsoPts, 16), cloth, 0, -0.02, 0);
  const plate = add(spine, geo("plate", () => new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), trim, 0, 0.34, 0.06, 1.15 * bulk, 0.55, 0.75);
  plate.userData.shell = true;
  const gem = add(spine, geo("gem", () => new THREE.OctahedronGeometry(0.045, 0)), ownMat(look.trim, { emissive: look.trim, emissiveIntensity: 0.85 }), 0, 0.32, 0.14);
  gem.userData.shell = false;
  add(armL, geo("arm", () => new THREE.CylinderGeometry(0.04, 0.055, 0.26, 8)), cloth, 0, -0.16, 0);
  add(armR, geo("arm", () => new THREE.CylinderGeometry(0.04, 0.055, 0.26, 8)), cloth, 0, -0.16, 0);
  const hand = geo("hand", () => new THREE.SphereGeometry(0.055, 8, 6));
  add(armL, hand, skin, 0, -0.32, 0.01, 0.85, 0.7, 1);
  add(armR, hand, skin, 0, -0.32, 0.01, 0.85, 0.7, 1);
  add(armL, geo("thumb", () => new THREE.ConeGeometry(0.018, 0.05, 5)), skin, 0.03, -0.3, 0.03);
  add(armR, geo("thumb", () => new THREE.ConeGeometry(0.018, 0.05, 5)), skin, -0.03, -0.3, 0.03);
  add(legL, geo("leg", () => new THREE.CylinderGeometry(0.045, 0.06, 0.28, 8)), cloth, 0, -0.16, 0);
  add(legR, geo("leg", () => new THREE.CylinderGeometry(0.045, 0.06, 0.28, 8)), cloth, 0, -0.16, 0);
  add(legL, geo("boot", () => new THREE.SphereGeometry(0.055, 8, 6)), bootMat, 0, -0.32, 0.03, 1, 0.7, 1.35);
  add(legR, geo("boot", () => new THREE.SphereGeometry(0.055, 8, 6)), bootMat, 0, -0.32, 0.03, 1, 0.7, 1.35);
  if (bulk > 1.1) {
    add(spine, geo("pauldron", () => new THREE.SphereGeometry(0.09, 8, 6)), trim, -0.2 * bulk, 0.4, 0, 1.2, 0.7, 1);
    add(spine, geo("pauldron", () => new THREE.SphereGeometry(0.09, 8, 6)), trim, 0.2 * bulk, 0.4, 0, 1.2, 0.7, 1);
  }
  armWeapon(armR, look, false);
  if (look.weapon === "twinblade" || look.weapon === "shield" || look.weapon === "claws") armWeapon(armL, look, true);
  if (look.cape) {
    const cape = add(spine, lathe("cape", [
      [0.02, 0], [0.18, 0.05], [0.22, 0.28], [0.12, 0.5],
    ], 10), mat(look.cloth), 0, 0.05, -0.12);
    cape.rotation.x = 0.15;
    cape.scale.z = 0.45;
    cape.userData.cape = true;
  }
  if (look.tail) {
    const tail = add(spine, geo("hero-tail", () => new THREE.CylinderGeometry(0.02, 0.045, 0.36, 6)), mat(look.trim), 0, 0.08, -0.16);
    tail.rotation.x = 1.1;
  }
  const flash = new THREE.Mesh(geo("flash", () => new THREE.SphereGeometry(0.55, 10, 8)), basicMat("#fff6e0", 0));
  flash.position.y = 0.35;
  flash.name = "flash";
  flash.userData.shell = false;
  root.add(flash);
}

export function buildUnit(id) {
  const look = LOOKS[id] || LOOKS.pip;
  const root = rig();
  dress(root, look);
  shellPass(root);
  root.scale.setScalar(1.15);
  plantFeet(root);
  root.userData.signature = lookSignature(id);
  root.userData.id = id;
  root.name = id;
  return root;
}

export function buildMonster(kind, element = "earth", boss = false) {
  const tint = ELEMENT[element] || ELEMENT.earth;
  const body = mat(tint, { emissive: tint, emissiveIntensity: 0.12 });
  const dark = mat("#2a1c18");
  const root = rig();
  const { spine, head, armL, armR } = root.userData.parts;
  if (kind === "slime") {
    add(spine, lathe("slime", [
      [0.05, 0], [0.28, 0.06], [0.34, 0.22], [0.26, 0.4], [0.08, 0.48],
    ], 16), body, 0, 0, 0);
    for (const side of [-1, 1]) {
      const eye = add(head, geo("sclera", () => new THREE.SphereGeometry(0.05, 8, 6)), mat("#f4f7f2"), side * 0.1, -0.16, 0.22);
      eye.userData.shell = false;
      const pupil = add(head, geo("pupil", () => new THREE.SphereGeometry(0.02, 6, 5)), dark, side * 0.1, -0.16, 0.26);
      pupil.userData.shell = false;
    }
    add(spine, geo("gem", () => new THREE.OctahedronGeometry(0.06, 0)), ownMat("#fff6c8", { emissive: "#fff6c8", emissiveIntensity: 0.7 }), 0, 0.28, 0.18);
  } else if (kind === "beast" || kind === "drake") {
    add(spine, lathe("beast", [
      [0.08, 0.02], [0.2, 0.1], [0.22, 0.24], [0.16, 0.36], [0.08, 0.42],
    ], 12), body, 0, 0.05, 0, 1.15, 0.9, 1.45);
    add(head, lathe("muzzle", [[0.02, 0], [0.1, 0.04], [0.08, 0.12], [0.02, 0.16]], 8), body, 0, -0.22, 0.18);
    add(head, geo("fang", () => new THREE.ConeGeometry(0.015, 0.06, 4)), mat("#f4efe4"), -0.03, -0.28, 0.26);
    add(head, geo("fang", () => new THREE.ConeGeometry(0.015, 0.06, 4)), mat("#f4efe4"), 0.03, -0.28, 0.26);
    add(head, geo("ear", () => new THREE.ConeGeometry(0.04, 0.12, 5)), body, -0.1, -0.08, 0);
    add(head, geo("ear", () => new THREE.ConeGeometry(0.04, 0.12, 5)), body, 0.1, -0.08, 0);
    for (const [x, z] of [[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.08], [0.12, -0.08]]) {
      add(spine, geo("paw", () => new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6)), dark, x, -0.02, z);
    }
    const tail = add(spine, geo("beasttail", () => new THREE.CylinderGeometry(0.025, 0.05, 0.4, 6)), body, 0, 0.12, -0.28);
    tail.rotation.x = 1.2;
    for (const side of [-1, 1]) {
      const eye = add(head, geo("pupil", () => new THREE.SphereGeometry(0.02, 6, 5)), mat("#1a1214"), side * 0.05, -0.18, 0.22);
      eye.userData.shell = false;
    }
    if (kind === "drake") {
      const wing = geo("wing", () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.28, 0.2, 0.62, 0.42);
        shape.quadraticCurveTo(0.3, 0.22, 0.05, 0.08);
        return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      });
      const left = add(spine, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }), -0.18, 0.28, 0);
      left.rotation.y = 0.5;
      const right = add(spine, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }), 0.18, 0.28, 0);
      right.rotation.y = Math.PI - 0.5;
      add(head, geo("horn", () => new THREE.ConeGeometry(0.035, 0.22, 6)), mat("#f2d8a0", { emissive: "#f2d8a0", emissiveIntensity: 0.2 }), 0, 0.02, 0.05);
    }
  } else if (kind === "crab") {
    add(spine, lathe("shell", [[0.05, 0], [0.32, 0.04], [0.3, 0.16], [0.08, 0.22]], 12), body, 0, 0.08, 0, 1.2, 0.8, 1);
    const claw = geo("clawbox", () => new THREE.SphereGeometry(0.1, 8, 6));
    add(armL, claw, body, -0.22, 0.02, 0.12, 1.3, 0.7, 0.8);
    add(armR, claw, body, 0.22, 0.02, 0.12, 1.3, 0.7, 0.8);
    add(spine, geo("pin", () => new THREE.CylinderGeometry(0.025, 0.03, 0.16, 5)), dark, -0.16, -0.02, 0.05);
    add(spine, geo("pin", () => new THREE.CylinderGeometry(0.025, 0.03, 0.16, 5)), dark, 0.16, -0.02, 0.05);
    add(spine, geo("pin", () => new THREE.CylinderGeometry(0.025, 0.03, 0.16, 5)), dark, -0.1, -0.02, -0.08);
    add(spine, geo("pin", () => new THREE.CylinderGeometry(0.025, 0.03, 0.16, 5)), dark, 0.1, -0.02, -0.08);
  } else if (kind === "plant") {
    add(spine, geo("stem", () => new THREE.CylinderGeometry(0.04, 0.07, 0.36, 7)), mat("#5a3a22"), 0, 0.12, 0);
    add(head, lathe("bulb", [[0.02, 0], [0.16, 0.06], [0.14, 0.2], [0.02, 0.26]], 10), body, 0, -0.2, 0);
    add(head, geo("leaf", () => new THREE.ConeGeometry(0.07, 0.22, 5)), mat("#2f8a40"), -0.12, 0.02, 0);
    add(head, geo("leaf", () => new THREE.ConeGeometry(0.07, 0.22, 5)), mat("#2f8a40"), 0.12, 0.02, 0);
    add(head, geo("bloom", () => new THREE.SphereGeometry(0.06, 8, 6)), mat("#e85a8c", { emissive: "#e85a8c", emissiveIntensity: 0.3 }), 0.08, -0.08, 0.12);
  } else if (kind === "bird" || kind === "moth") {
    add(spine, lathe("birdbody", [[0.04, 0.05], [0.12, 0.12], [0.1, 0.28], [0.03, 0.36]], 10), body, 0, 0.1, 0, 1, 0.9, 1.4);
    add(head, geo("beak", () => new THREE.ConeGeometry(0.035, 0.14, 5)), mat("#f2d8a0"), 0, -0.22, 0.16);
    const wing = geo(kind === "moth" ? "mothwing" : "birdwing", () => new THREE.SphereGeometry(0.18, 8, 6));
    const left = add(armL, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.25 }), -0.16, 0.05, 0, 1.4, 0.25, 0.9);
    left.rotation.z = 0.5;
    const right = add(armR, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.25 }), 0.16, 0.05, 0, 1.4, 0.25, 0.9);
    right.rotation.z = -0.5;
  } else if (kind === "golem" || kind === "scorpion") {
    add(spine, geo("block", () => new THREE.BoxGeometry(0.4, 0.34, 0.28)), body, 0, 0.22, 0);
    add(head, geo("blockhead", () => new THREE.BoxGeometry(0.22, 0.16, 0.16)), mat("#d5dbe4"), 0, -0.16, 0.02);
    add(head, geo("rune", () => new THREE.OctahedronGeometry(0.05, 0)), ownMat("#7ee0c8", { emissive: "#7ee0c8", emissiveIntensity: 0.9 }), 0, -0.16, 0.1);
    add(armL, geo("slab", () => new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6)), body, 0, -0.08, 0);
    add(armR, geo("slab", () => new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6)), body, 0, -0.08, 0);
    add(spine, geo("slab", () => new THREE.CylinderGeometry(0.07, 0.08, 0.18, 6)), dark, -0.12, 0.02, 0);
    add(spine, geo("slab", () => new THREE.CylinderGeometry(0.07, 0.08, 0.18, 6)), dark, 0.12, 0.02, 0);
    if (kind === "scorpion") {
      const tail = add(spine, geo("stinger", () => new THREE.CylinderGeometry(0.03, 0.05, 0.36, 5)), mat("#f0d78c", { emissive: "#f0d78c", emissiveIntensity: 0.25 }), 0, 0.36, -0.12);
      tail.rotation.x = 0.8;
    }
  } else if (kind === "wraith" || kind === "seraph") {
    add(spine, lathe("shroud", [[0.04, 0], [0.22, 0.08], [0.2, 0.4], [0.08, 0.62]], 12), ownMat(tint, { emissive: tint, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }), 0, 0, 0);
    const face = add(head, geo("wisp", () => new THREE.SphereGeometry(0.08, 8, 6)), ownMat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.85 }), 0, -0.18, 0.08);
    face.userData.shell = false;
    if (kind === "seraph") {
      const wing = geo("seraphwing", () => new THREE.SphereGeometry(0.28, 8, 6));
      add(armL, wing, mat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.35 }), -0.22, 0.05, -0.02, 1.3, 0.2, 0.8);
      add(armR, wing, mat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.35 }), 0.22, 0.05, -0.02, 1.3, 0.2, 0.8);
      const halo = add(head, geo("halo", () => new THREE.TorusGeometry(0.14, 0.015, 6, 16)), mat("#f0d78c", { emissive: "#f0d78c", emissiveIntensity: 0.8 }), 0, 0.08, 0);
      halo.rotation.x = Math.PI / 2;
    }
  } else {
    add(spine, lathe("blob", [[0.04, 0], [0.2, 0.08], [0.16, 0.28], [0.04, 0.36]], 10), body, 0, 0.05, 0);
  }
  if (boss) {
    add(spine, geo("crown", () => new THREE.OctahedronGeometry(0.1, 0)), ownMat("#f0d78c", { emissive: "#f0d78c", emissiveIntensity: 0.8 }), 0, 0.55, 0);
    add(spine, geo("boss-horn", () => new THREE.ConeGeometry(0.04, 0.24, 6)), mat("#f4efe4"), -0.12, 0.42, 0);
    add(spine, geo("boss-horn", () => new THREE.ConeGeometry(0.04, 0.24, 6)), mat("#f4efe4"), 0.12, 0.42, 0);
  }
  const flash = new THREE.Mesh(geo("flash", () => new THREE.SphereGeometry(0.5, 8, 6)), basicMat("#fff6e0", 0));
  flash.name = "flash";
  flash.userData.shell = false;
  root.add(flash);
  shellPass(root);
  root.userData.monster = kind;
  root.userData.signature = `${kind}|${element}|${boss ? "boss" : "mob"}`;
  if (boss) root.scale.setScalar(1.85);
  plantFeet(root);
  return root;
}

function ease(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function poseFigure(root, clip, time) {
  const parts = root.userData.parts;
  if (!parts) return;
  for (const part of Object.values(parts)) applyRest(part);
  const breathe = Math.sin(time * 1.6);
  parts.hips.position.y += breathe * 0.015;
  parts.spine.rotation.x = breathe * 0.035;
  parts.spine.scale.y = 1 + breathe * 0.02;
  parts.head.rotation.y = Math.sin(time * 0.7) * 0.1;
  parts.head.rotation.x = Math.sin(time * 0.45) * 0.03;
  parts.armL.rotation.z = 0.12;
  parts.armR.rotation.z = -0.12;
  parts.armL.rotation.x = 0.18 + breathe * 0.04;
  parts.armR.rotation.x = 0.18 - breathe * 0.04;
  parts.legL.rotation.x = Math.sin(time * 1.6) * 0.04;
  parts.legR.rotation.x = -Math.sin(time * 1.6) * 0.04;
  const cape = parts.spine.children.find((child) => child.userData?.cape);
  if (cape) cape.rotation.x = 0.18 + Math.sin(time * 1.3) * 0.08;
  const phase = root.userData.phase || 0;
  if (clip === "attack") {
    const p = Math.min(phase, 1.2);
    if (p < 0.28) {
      const a = ease(p / 0.28);
      parts.armR.rotation.x = 0.9 * a;
      parts.spine.rotation.x = 0.18 * a;
      parts.hips.position.z = -0.1 * a;
    } else if (p < 0.62) {
      const a = ease((p - 0.28) / 0.34);
      parts.armR.rotation.x = 0.9 - 2.5 * a;
      parts.spine.rotation.x = 0.18 - 0.45 * a;
      parts.hips.position.z = -0.1 + 0.48 * a;
      parts.hips.rotation.y = 0.25 * a;
    } else {
      const a = ease((p - 0.62) / 0.4);
      parts.armR.rotation.x = -1.6 + 0.9 * a;
      parts.hips.position.z = 0.38 * (1 - a);
      parts.hips.rotation.y = 0.25 * (1 - a);
    }
  } else if (clip === "skill") {
    const lift = ease(Math.min(1, phase));
    parts.armL.rotation.x = -1.35 * lift;
    parts.armR.rotation.x = -1.35 * lift;
    parts.armL.rotation.z = 0.35 * lift;
    parts.armR.rotation.z = -0.35 * lift;
    parts.hips.position.y += Math.sin(Math.min(phase, 1) * Math.PI) * 0.1;
    parts.spine.rotation.x = -0.12 * lift;
  } else if (clip === "hit") {
    const kick = Math.max(0, 1 - phase * 1.4);
    parts.spine.rotation.x = 0.45 * kick;
    parts.hips.position.z = -0.16 * kick;
    parts.head.rotation.x = 0.28 * kick;
  } else if (clip === "death") {
    const fall = ease(Math.min(1, phase));
    parts.hips.rotation.z = 1.2 * fall;
    parts.hips.position.y -= 0.28 * fall;
  }
  const flash = root.getObjectByName("flash");
  if (flash) {
    const glow = clip === "skill" ? Math.max(0, 0.55 * Math.sin(Math.min(phase, 1) * Math.PI)) : clip === "hit" ? Math.max(0, 0.8 - phase) : 0;
    flash.material.opacity = glow;
  }
}
