import * as THREE from "../vendor/three/three.module.js";
import { LOOKS, lookSignature } from "./looks.js";
import { ELEMENT, basicMat, mat, ownMat } from "./materials.js";

const geos = {};

function geo(name, build) {
  if (!geos[name]) geos[name] = build();
  return geos[name];
}

function add(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function remember(group) {
  group.userData.rest = {
    x: group.rotation.x,
    y: group.rotation.y,
    z: group.rotation.z,
    px: group.position.x,
    py: group.position.y,
    pz: group.position.z,
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

function rig() {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.46;
  const spine = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = 0.48;
  const armL = new THREE.Group();
  armL.position.set(-0.24, 0.34, 0);
  const armR = new THREE.Group();
  armR.position.set(0.24, 0.34, 0);
  const legL = new THREE.Group();
  legL.position.set(-0.1, -0.02, 0);
  const legR = new THREE.Group();
  legR.position.set(0.1, -0.02, 0);
  hips.add(spine, legL, legR);
  spine.add(head, armL, armR);
  root.add(hips);
  for (const part of [hips, spine, head, armL, armR, legL, legR]) remember(part);
  root.userData.parts = { hips, spine, head, armL, armR, legL, legR };
  return root;
}

function hair(head, look) {
  const color = mat(look.hair, { roughness: 0.6 });
  if (look.hairStyle === "bald") return;
  if (look.hairStyle === "hood") {
    add(head, geo("hood", () => new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)), mat(look.cloth), 0, 0.04, 0.02, 1.05, 1.05, 1.1);
    return;
  }
  if (look.hairStyle === "long") {
    add(head, geo("haircap", () => new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), color, 0, 0.06, 0);
    add(head, geo("lock", () => new THREE.CapsuleGeometry(0.05, 0.28, 3, 6)), color, -0.12, -0.12, 0.04);
    add(head, geo("lock", () => new THREE.CapsuleGeometry(0.05, 0.28, 3, 6)), color, 0.12, -0.12, 0.04);
    add(head, geo("lock", () => new THREE.CapsuleGeometry(0.06, 0.34, 3, 6)), color, 0, -0.16, -0.08);
    return;
  }
  if (look.hairStyle === "braid") {
    add(head, geo("haircap", () => new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), color, 0, 0.05, 0);
    add(head, geo("braid", () => new THREE.CapsuleGeometry(0.045, 0.36, 3, 6)), color, 0.16, -0.16, 0);
    return;
  }
  if (look.hairStyle === "bun") {
    add(head, geo("haircap", () => new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), color, 0, 0.05, 0);
    add(head, geo("bun", () => new THREE.SphereGeometry(0.1, 10, 8)), color, 0, 0.22, -0.06);
    return;
  }
  if (look.hairStyle === "crest") {
    add(head, geo("crest", () => new THREE.ConeGeometry(0.08, 0.28, 5)), color, 0, 0.28, 0);
    add(head, geo("haircap", () => new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45)), color, 0, 0.04, 0);
    return;
  }
  if (look.hairStyle === "wild") {
    add(head, geo("haircap", () => new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6)), color, 0, 0.06, 0, 1.15, 1, 1.1);
    add(head, geo("tuft", () => new THREE.ConeGeometry(0.06, 0.16, 4)), color, -0.12, 0.18, 0.08);
    add(head, geo("tuft", () => new THREE.ConeGeometry(0.06, 0.18, 4)), color, 0.1, 0.2, 0.02);
    return;
  }
  add(head, geo("haircap", () => new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), color, 0, 0.05, 0.02);
}

function face(head, look) {
  const skin = mat(look.skin, { roughness: 0.62 });
  add(head, geo("head", () => new THREE.SphereGeometry(0.2, 14, 12)), skin, 0, 0, 0, 1, 1.05, 0.96);
  add(head, geo("eye", () => new THREE.SphereGeometry(0.048, 8, 6)), mat("#1a1420"), -0.075, 0.02, 0.15);
  add(head, geo("eye", () => new THREE.SphereGeometry(0.048, 8, 6)), mat("#1a1420"), 0.075, 0.02, 0.15);
  add(head, geo("catch", () => new THREE.SphereGeometry(0.012, 6, 4)), mat("#fffaf0", { emissive: "#fffaf0", emissiveIntensity: 0.4 }), -0.06, 0.03, 0.185);
  add(head, geo("catch", () => new THREE.SphereGeometry(0.012, 6, 4)), mat("#fffaf0", { emissive: "#fffaf0", emissiveIntensity: 0.4 }), 0.08, 0.03, 0.185);
  if (look.horns) {
    const horn = geo("horn", () => new THREE.ConeGeometry(0.04, 0.22, 6));
    const left = add(head, horn, mat(look.trim, { metalness: 0.3, roughness: 0.4 }), -0.1, 0.18, 0);
    left.rotation.z = 0.5;
    const right = add(head, horn, mat(look.trim, { metalness: 0.3, roughness: 0.4 }), 0.1, 0.18, 0);
    right.rotation.z = -0.5;
  }
  if (look.halo) {
    const halo = new THREE.Mesh(geo("halo", () => new THREE.TorusGeometry(0.16, 0.018, 6, 16)), mat(look.trim, { emissive: look.trim, emissiveIntensity: 0.6, metalness: 0.4 }));
    halo.position.y = 0.32;
    halo.rotation.x = Math.PI / 2;
    head.add(halo);
  }
}

function weaponGeo(type) {
  if (type === "sword" || type === "twinblade") {
    return geo("blade", () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.045, 0.08);
      shape.lineTo(0.03, 0.48);
      shape.lineTo(0, 0.56);
      shape.lineTo(-0.03, 0.48);
      shape.lineTo(-0.045, 0.08);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    });
  }
  if (type === "spear" || type === "trident" || type === "scythe") return geo("shaft", () => new THREE.CylinderGeometry(0.02, 0.025, 0.85, 6));
  if (type === "staff") return geo("staff", () => new THREE.CylinderGeometry(0.025, 0.03, 0.9, 6));
  if (type === "bow") return geo("bow", () => new THREE.TorusGeometry(0.22, 0.018, 6, 12, Math.PI));
  if (type === "fan") return geo("fan", () => new THREE.ConeGeometry(0.16, 0.28, 3));
  if (type === "shield") return geo("shield", () => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8));
  if (type === "anchor") return geo("anchor", () => new THREE.TorusGeometry(0.12, 0.03, 6, 10, Math.PI));
  if (type === "hammer") return geo("hammer", () => new THREE.BoxGeometry(0.22, 0.12, 0.12));
  if (type === "lantern") return geo("lantern", () => new THREE.BoxGeometry(0.12, 0.16, 0.12));
  if (type === "claws") return geo("claw", () => new THREE.ConeGeometry(0.03, 0.18, 4));
  if (type === "pail") return geo("pail", () => new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8));
  if (type === "ribbon") return geo("ribbon", () => new THREE.BoxGeometry(0.08, 0.4, 0.015));
  return geo("token", () => new THREE.OctahedronGeometry(0.08, 0));
}

function armWeapon(arm, look, mirror = false) {
  const color = mat(look.trim, { metalness: 0.55, roughness: 0.28, emissive: look.trim, emissiveIntensity: 0.12 });
  const mesh = new THREE.Mesh(weaponGeo(look.weapon), look.weapon === "lantern" ? ownMat(look.trim, { emissive: look.trim, emissiveIntensity: 0.8 }) : color);
  mesh.castShadow = true;
  mesh.position.set(mirror ? -0.02 : 0.02, -0.34, 0.08);
  if (look.weapon === "shield") mesh.rotation.x = Math.PI / 2;
  if (look.weapon === "bow") mesh.rotation.z = Math.PI / 2;
  if (look.weapon === "fan") mesh.rotation.x = 0.4;
  if (look.weapon === "anchor") mesh.rotation.z = Math.PI;
  arm.add(mesh);
  if (look.weapon === "scythe") {
    const blade = add(arm, geo("scytheblade", () => new THREE.TorusGeometry(0.16, 0.02, 6, 10, Math.PI * 0.8)), color, 0.02, -0.7, 0);
    blade.rotation.z = -0.6;
  }
  if (look.weapon === "trident") {
    add(arm, geo("tine", () => new THREE.ConeGeometry(0.025, 0.16, 4)), color, 0, -0.78, 0);
    add(arm, geo("tine", () => new THREE.ConeGeometry(0.02, 0.12, 4)), color, -0.06, -0.72, 0);
    add(arm, geo("tine", () => new THREE.ConeGeometry(0.02, 0.12, 4)), color, 0.06, -0.72, 0);
  }
  if (look.weapon === "spear") add(arm, geo("speartip", () => new THREE.ConeGeometry(0.04, 0.16, 4)), color, 0, -0.78, 0);
  if (look.weapon === "hammer") add(arm, geo("haft", () => new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5)), mat("#5a3a22"), 0, -0.2, 0);
  if (look.weapon === "claws") {
    add(arm, weaponGeo("claws"), color, -0.04, -0.32, 0.06);
    add(arm, weaponGeo("claws"), color, 0.04, -0.32, 0.06);
  }
}

function dress(root, look) {
  const { spine, head, armL, armR, legL, legR } = root.userData.parts;
  const bulk = look.bulk || 1;
  const cloth = mat(look.cloth, { roughness: 0.62 });
  const trim = mat(look.trim, { metalness: 0.35, roughness: 0.4, emissive: look.trim, emissiveIntensity: 0.08 });
  const skin = mat(look.skin, { roughness: 0.65 });
  const boot = mat("#2a2118", { roughness: 0.7 });
  face(head, look);
  hair(head, look);
  if (look.robe) {
    add(spine, geo("robe", () => new THREE.CylinderGeometry(0.16, 0.28, 0.55, 8)), cloth, 0, 0.08, 0, bulk, 1, bulk);
  } else {
    add(spine, geo("torso", () => new THREE.CapsuleGeometry(0.16, 0.22, 4, 8)), cloth, 0, 0.16, 0, bulk, 1, 0.9);
  }
  add(spine, geo("neck", () => new THREE.SphereGeometry(0.08, 8, 6)), skin, 0, 0.36, 0);
  add(spine, geo("shoulder", () => new THREE.SphereGeometry(0.09, 8, 6)), cloth, -0.22 * bulk, 0.3, 0, bulk, 1, 1);
  add(spine, geo("shoulder", () => new THREE.SphereGeometry(0.09, 8, 6)), cloth, 0.22 * bulk, 0.3, 0, bulk, 1, 1);
  add(spine, geo("belt", () => new THREE.TorusGeometry(0.15 * bulk, 0.025, 6, 12)), trim, 0, 0.02, 0);
  add(armL, geo("arm", () => new THREE.CapsuleGeometry(0.045, 0.2, 3, 6)), cloth, 0, -0.16, 0);
  add(armR, geo("arm", () => new THREE.CapsuleGeometry(0.045, 0.2, 3, 6)), cloth, 0, -0.16, 0);
  add(armL, geo("hand", () => new THREE.SphereGeometry(0.05, 8, 6)), skin, 0, -0.3, 0);
  add(armR, geo("hand", () => new THREE.SphereGeometry(0.05, 8, 6)), skin, 0, -0.3, 0);
  add(legL, geo("leg", () => new THREE.CapsuleGeometry(0.05, 0.22, 3, 6)), cloth, 0, -0.18, 0);
  add(legR, geo("leg", () => new THREE.CapsuleGeometry(0.05, 0.22, 3, 6)), cloth, 0, -0.18, 0);
  add(legL, geo("boot", () => new THREE.BoxGeometry(0.09, 0.06, 0.14)), boot, 0, -0.34, 0.02);
  add(legR, geo("boot", () => new THREE.BoxGeometry(0.09, 0.06, 0.14)), boot, 0, -0.34, 0.02);
  armWeapon(armR, look, false);
  if (look.weapon === "twinblade" || look.weapon === "shield" || look.weapon === "claws") armWeapon(armL, look, true);
  if (look.cape) {
    const cape = add(spine, geo("cape", () => new THREE.BoxGeometry(0.32, 0.42, 0.02)), mat(look.cloth, { roughness: 0.75 }), 0, 0.08, -0.16);
    cape.userData.cape = true;
  }
  if (look.tail) {
    add(spine, geo("tail", () => new THREE.CapsuleGeometry(0.03, 0.28, 3, 5)), mat(look.trim), 0, 0.05, -0.2);
  }
  const flash = new THREE.Mesh(geo("flash", () => new THREE.SphereGeometry(0.42, 10, 8)), basicMat("#ffffff", 0));
  flash.position.y = 0.3;
  flash.name = "flash";
  root.add(flash);
}

export function buildUnit(id) {
  const look = LOOKS[id] || LOOKS.pip;
  const root = rig();
  dress(root, look);
  root.scale.setScalar(1.2);
  plantFeet(root);
  root.userData.signature = lookSignature(id);
  root.userData.id = id;
  root.name = id;
  return root;
}

function monsterRig(y) {
  const root = rig();
  root.userData.parts.hips.position.y = y;
  remember(root.userData.parts.hips);
  return root;
}

export function buildMonster(kind, element = "earth", boss = false) {
  const tint = ELEMENT[element] || ELEMENT.earth;
  const body = mat(tint, { roughness: 0.48, emissive: tint, emissiveIntensity: 0.12 });
  const dark = mat("#241820", { roughness: 0.6 });
  const root = monsterRig(kind === "slime" ? 0.4 : 0.55);
  const { spine, head, armL, armR, legL, legR } = root.userData.parts;
  if (kind === "slime") {
    add(spine, geo("slime", () => new THREE.SphereGeometry(0.34, 14, 10)), body, 0, 0.05, 0, 1.1, 0.85, 1.05);
    add(head, geo("eye", () => new THREE.SphereGeometry(0.05, 8, 6)), dark, -0.08, -0.18, 0.22);
    add(head, geo("eye", () => new THREE.SphereGeometry(0.05, 8, 6)), dark, 0.08, -0.18, 0.22);
  } else if (kind === "beast" || kind === "drake") {
    add(spine, geo("beastbody", () => new THREE.CapsuleGeometry(0.18, 0.28, 4, 8)), body, 0, 0.12, 0, 1, 0.8, 1.35);
    add(head, geo("beasthead", () => new THREE.SphereGeometry(0.16, 10, 8)), body, 0, -0.05, 0.12, 1.1, 0.9, 1.25);
    add(head, geo("snout", () => new THREE.BoxGeometry(0.1, 0.06, 0.12)), body, 0, -0.08, 0.26);
    add(spine, geo("paw", () => new THREE.BoxGeometry(0.1, 0.08, 0.14)), dark, -0.12, -0.18, 0.12);
    add(spine, geo("paw", () => new THREE.BoxGeometry(0.1, 0.08, 0.14)), dark, 0.12, -0.18, -0.02);
    const tail = add(spine, geo("tail", () => new THREE.CapsuleGeometry(0.04, 0.28, 3, 5)), body, 0, 0.02, -0.28);
    tail.rotation.x = 1.15;
    if (kind === "drake") {
      const wing = geo("wing", () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.35, 0.15, 0.55, 0.4);
        shape.quadraticCurveTo(0.2, 0.28, 0, 0.12);
        return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      });
      const left = add(spine, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.2, transparent: true, opacity: 0.9 }), -0.2, 0.2, 0);
      left.rotation.y = 0.4;
      const right = add(spine, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.2 }), 0.2, 0.2, 0);
      right.rotation.y = Math.PI - 0.4;
      add(head, geo("horn", () => new THREE.ConeGeometry(0.04, 0.2, 5)), mat("#f2d8a0", { metalness: 0.3 }), 0, 0.12, 0.05);
    }
  } else if (kind === "crab") {
    add(spine, geo("shell", () => new THREE.SphereGeometry(0.28, 12, 8)), body, 0, 0.1, 0, 1.3, 0.7, 1);
    const claw = geo("claw", () => new THREE.BoxGeometry(0.16, 0.08, 0.22));
    add(armL, claw, body, -0.12, -0.05, 0.12);
    add(armR, claw, body, 0.12, -0.05, 0.12);
    add(legL, geo("pin", () => new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5)), dark, 0, -0.16, 0);
    add(legR, geo("pin", () => new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5)), dark, 0, -0.16, 0);
  } else if (kind === "plant") {
    add(legL, geo("stem", () => new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6)), mat("#5a3a22"), 0, -0.1, 0);
    add(head, geo("bulb", () => new THREE.SphereGeometry(0.22, 10, 8)), body, 0, -0.1, 0);
    add(head, geo("leaf", () => new THREE.ConeGeometry(0.08, 0.22, 4)), mat("#2f8a40"), -0.12, 0.08, 0);
    add(head, geo("leaf", () => new THREE.ConeGeometry(0.08, 0.22, 4)), mat("#2f8a40"), 0.12, 0.08, 0);
    add(head, geo("bloom", () => new THREE.SphereGeometry(0.06, 8, 6)), mat("#e85a8c"), 0.1, 0.02, 0.12);
  } else if (kind === "bird" || kind === "moth") {
    add(spine, geo("bird", () => new THREE.SphereGeometry(0.16, 10, 8)), body, 0, 0.15, 0, 1, 0.8, 1.3);
    add(head, geo("beak", () => new THREE.ConeGeometry(0.04, 0.12, 4)), mat("#f2d8a0"), 0, -0.16, 0.16);
    const wing = geo(kind === "moth" ? "mothwing" : "birdwing", () => new THREE.BoxGeometry(0.34, 0.02, 0.22));
    const left = add(armL, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.15 }), -0.2, 0, 0);
    left.rotation.z = 0.4;
    const right = add(armR, wing, ownMat(tint, { emissive: tint, emissiveIntensity: 0.15 }), 0.2, 0, 0);
    right.rotation.z = -0.4;
  } else if (kind === "golem" || kind === "scorpion") {
    add(spine, geo("block", () => new THREE.BoxGeometry(0.42, 0.36, 0.3)), body, 0, 0.12, 0);
    add(head, geo("blockhead", () => new THREE.BoxGeometry(0.22, 0.16, 0.18)), mat("#d8e0ea"), 0, -0.12, 0.02);
    add(head, geo("rune", () => new THREE.BoxGeometry(0.06, 0.06, 0.02)), ownMat("#7ee0c8", { emissive: "#7ee0c8", emissiveIntensity: 0.8 }), 0, -0.12, 0.1);
    add(armL, geo("slab", () => new THREE.BoxGeometry(0.12, 0.32, 0.12)), body, 0, -0.1, 0);
    add(armR, geo("slab", () => new THREE.BoxGeometry(0.12, 0.32, 0.12)), body, 0, -0.1, 0);
    add(legL, geo("slab", () => new THREE.BoxGeometry(0.12, 0.22, 0.12)), dark, 0, -0.16, 0);
    add(legR, geo("slab", () => new THREE.BoxGeometry(0.12, 0.22, 0.12)), dark, 0, -0.16, 0);
    if (kind === "scorpion") add(spine, geo("stinger", () => new THREE.ConeGeometry(0.05, 0.24, 5)), mat("#f0d78c"), 0.05, 0.28, -0.2);
  } else if (kind === "wraith" || kind === "seraph") {
    add(spine, geo("shroud", () => new THREE.ConeGeometry(0.28, 0.7, 8)), ownMat(tint, { transparent: true, opacity: 0.88, emissive: tint, emissiveIntensity: 0.25 }), 0, 0.05, 0);
    add(head, geo("wisp", () => new THREE.SphereGeometry(0.1, 8, 6)), ownMat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.7 }), 0, -0.16, 0.08);
    if (kind === "seraph") {
      const wing = geo("seraphwing", () => new THREE.BoxGeometry(0.5, 0.04, 0.22));
      add(armL, wing, mat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.3 }), -0.28, 0.05, -0.05);
      add(armR, wing, mat("#fff6e0", { emissive: "#fff6e0", emissiveIntensity: 0.3 }), 0.28, 0.05, -0.05);
      const halo = new THREE.Mesh(geo("halo", () => new THREE.TorusGeometry(0.16, 0.016, 6, 14)), mat("#f0d78c", { emissive: "#f0d78c", emissiveIntensity: 0.7 }));
      halo.position.y = 0.16;
      halo.rotation.x = Math.PI / 2;
      head.add(halo);
    }
  } else {
    add(spine, geo("blob", () => new THREE.SphereGeometry(0.24, 10, 8)), body, 0, 0.1, 0);
  }
  const flash = new THREE.Mesh(geo("flash", () => new THREE.SphereGeometry(0.46, 10, 8)), basicMat("#ffffff", 0));
  flash.name = "flash";
  root.add(flash);
  root.userData.monster = kind;
  root.userData.signature = `${kind}|${element}|${boss ? "boss" : "mob"}`;
  if (boss) root.scale.setScalar(1.55);
  plantFeet(root);
  return root;
}

export function poseFigure(root, clip, time) {
  const parts = root.userData.parts;
  if (!parts) return;
  for (const part of Object.values(parts)) applyRest(part);
  const breathe = Math.sin(time * 1.7);
  parts.spine.rotation.x = breathe * 0.04;
  parts.head.rotation.y = Math.sin(time * 0.8) * 0.12;
  parts.head.rotation.x = Math.sin(time * 0.5) * 0.04;
  parts.armL.rotation.x = 0.15 + breathe * 0.05;
  parts.armR.rotation.x = 0.15 - breathe * 0.05;
  parts.legL.rotation.x = Math.sin(time * 1.7) * 0.05;
  parts.legR.rotation.x = -Math.sin(time * 1.7) * 0.05;
  const cape = parts.spine.children.find((child) => child.userData?.cape);
  if (cape) cape.rotation.x = 0.08 + Math.sin(time * 1.4) * 0.06;
  const phase = root.userData.phase || 0;
  if (clip === "attack") {
    const swing = Math.sin(Math.min(phase, 1) * Math.PI);
    parts.armR.rotation.x = -1.5 * swing;
    parts.hips.rotation.y = swing * 0.45;
    parts.spine.rotation.x = -0.2 * swing;
  } else if (clip === "skill") {
    const lift = Math.min(1, phase);
    parts.armL.rotation.x = -1.3 * lift;
    parts.armR.rotation.x = -1.3 * lift;
    parts.hips.position.y += Math.sin(Math.min(lift, 1) * Math.PI) * 0.08;
  } else if (clip === "hit") {
    const kick = Math.max(0, 1 - phase);
    parts.spine.rotation.x = 0.35 * kick;
    parts.hips.position.z += 0.12 * kick;
    parts.head.rotation.x = 0.2 * kick;
  } else if (clip === "death") {
    const fall = Math.min(1, phase);
    parts.hips.rotation.z = 1.15 * fall;
    parts.hips.position.y -= 0.35 * fall;
  }
  const flash = root.getObjectByName("flash");
  if (flash) {
    const glow = clip === "skill" ? Math.max(0, 0.45 - phase * 0.3) : clip === "hit" ? Math.max(0, 0.65 - phase) : 0;
    flash.material.opacity = glow;
  }
}
