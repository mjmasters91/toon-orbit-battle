import * as THREE from "three";
import { createArena, FLOOR_Y } from "./arena.js";
import { createAudio } from "./audio.js";
import { ELEMENT_INFO, EFFECTS, relationCopy } from "./elements.js";
import { createBursts, createPulse } from "./effects.js";
import { buildMonster } from "./models.js";
import { BY_ID, MATCH, ROSTER } from "./roster.js";
import { BattleSession } from "./session.js";
import { createUi } from "./ui.js";

const PLAYER_SLOTS = [
  { x: -1.7, z: 2.55 },
  { x: -3.45, z: 0.75 },
  { x: -5.2, z: -1.05 },
  { x: -6.95, z: -2.85 },
];
const ENEMY_SLOTS = [
  { x: 1.7, z: 2.55 },
  { x: 3.45, z: 0.75 },
  { x: 5.2, z: -1.05 },
  { x: 6.95, z: -2.85 },
];

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function ringSlot(index, count, radius = 7.75) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.sin(angle) * radius,
    z: Math.cos(angle) * radius,
    facing: angle + Math.PI / 2,
  };
}

function strikeCurve(k) {
  if (k < 0.16) return (k / 0.16) * 0.15;
  if (k < 0.4) return 0.15 + ((k - 0.16) / 0.24) * 0.85;
  if (k < 0.58) return 1;
  return Math.max(0, 1 - (k - 0.58) / 0.42);
}

function leaderLine(units, team) {
  const leader = units.find((unit) => unit.team === team && unit.leader);
  if (!leader) return "";
  return `${leader.name} · ${leader.leader.name} · ${leader.leader.detail}`;
}

export function createGame() {
  const canvas = document.getElementById("view");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 180);
  const look = new THREE.Vector3(0, 1.7, 0);
  const arena = createArena(scene);
  const bursts = createBursts(scene);
  const pulse = createPulse(scene);
  pulse.setFloor(FLOOR_Y);
  const audio = createAudio();
  const ui = createUi();

  const actors = ROSTER.map((monster, index) => {
    const built = buildMonster(monster.id);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.82, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf0d7a0,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(built.ringScale || 1);
    ring.visible = false;
    built.root.add(ring);
    scene.add(built.root);
    const slot = ringSlot(index, ROSTER.length);
    built.root.position.set(slot.x, FLOOR_Y, slot.z);
    built.root.rotation.y = slot.facing;
    return {
      id: monster.id,
      monster,
      built,
      root: built.root,
      anchor: built.anchor,
      ring,
      pose: { lunge: 0, lift: 0, recoil: 0, topple: 0 },
      recoil: 0,
      down: 0,
      team: null,
      uid: null,
      home: new THREE.Vector3(),
      homeFacing: slot.facing,
      homeScale: 1,
      fromPos: new THREE.Vector3(),
      fromFacing: slot.facing,
      fromScale: 1,
      flashUntil: 0,
      meshes: [],
    };
  });

  for (const actor of actors) {
    actor.root.traverse((object) => {
      if (object.isMesh && object.material?.emissive) actor.meshes.push(object);
    });
  }

  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const plates = new Map();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const projected = new THREE.Vector3();
  const camFrom = new THREE.Vector3();
  const lookFrom = new THREE.Vector3();
  const battleCam = new THREE.Vector3(0.25, 7.5, 12.7);
  const battleLook = new THREE.Vector3(0, 1.25, 0);

  const game = {
    mode: "title",
    time: 0,
    session: null,
    aim: null,
    anim: null,
    gameSpeed: 1,
    shake: 0,
    deployT: 0,
    ui,
    audio,
    actors,
    start,
    debugState,
  };

  ui.onPlay = () => beginDeploy();
  ui.onSkill = (index) => pressSkill(index);
  ui.onPreview = (index) => previewSkill(index);
  ui.onAuto = () => toggleAuto();
  ui.onSpeed = () => {
    game.gameSpeed = game.gameSpeed === 1 ? 2 : 1;
    ui.setSpeed(game.gameSpeed);
    audio.click();
  };
  ui.onMute = () => {
    const muted = audio.toggle();
    ui.setMute(muted);
  };
  ui.onRematch = () => rematch();
  ui.onTitle = () => backToTitle();

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKey);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  const onPlate = (event) => {
    const plate = event.target.closest?.(".plate");
    if (plate?.dataset.uid) tryTarget(plate.dataset.uid);
  };
  document.getElementById("plates").addEventListener("pointerdown", onPlate);
  document.getElementById("plates").addEventListener("click", onPlate);

  resize();

  function start() {
    game.mode = "title";
    ui.setMode("title");
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0);
      last = now;
      try {
        game.time += dt;
        game.frames = (game.frames || 0) + 1;
        arena.update(game.time);
        bursts.update(dt);
        pulse.update(dt);
        if (game.mode === "title") updateTitle();
        else if (game.mode === "deploy") updateDeploy(dt);
        else updateBattle(dt);
        updateActors(dt);
        updateRings();
        updatePlates();
        placeCamera();
        renderer.render(scene, camera);
      } catch (error) {
        game.lastError = `${error.message}\n${error.stack || ""}`;
        if (!game.reported) {
          game.reported = true;
          console.error(error);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(1, height);
    camera.aspect = aspect;
    camera.fov = aspect < 0.9 ? 50 : aspect < 1.35 ? 42 : 36;
    camera.updateProjectionMatrix();
    battleCam.set(0.25, aspect < 0.9 ? 10.4 : 7.5, aspect < 0.9 ? 16.8 : 12.7);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 900 ? 1.5 : 2));
    renderer.setSize(width, height, false);
  }

  function updateTitle() {
    const angle = game.time * 0.08;
    camera.position.set(Math.sin(angle) * 16.6, 7.05, Math.cos(angle) * 16.6);
    look.set(0, 1.75, 0);
    let nearest = actors[0];
    let best = Infinity;
    for (const actor of actors) {
      const distance = actor.root.position.distanceToSquared(camera.position);
      if (distance < best) {
        best = distance;
        nearest = actor;
      }
    }
    ui.setFeatured(nearest.monster);
  }

  function beginDeploy() {
    if (game.mode !== "title") return;
    audio.unlock();
    audio.start();
    audio.click();
    game.session = new BattleSession();
    game.session.auto = false;
    assignHomes(false);
    for (const actor of actors) {
      actor.fromPos.copy(actor.root.position);
      actor.fromFacing = actor.root.rotation.y;
      actor.fromScale = actor.root.scale.x || 1;
      actor.down = 0;
      actor.pose.topple = 0;
      actor.pose.lunge = 0;
      actor.pose.lift = 0;
      actor.root.visible = true;
    }
    camFrom.copy(camera.position);
    lookFrom.copy(look);
    game.deployT = 0;
    game.mode = "deploy";
    game.aim = null;
    game.anim = null;
    ui.setMode("deploy");
    ui.setAuto(false);
    ui.setSpeed(game.gameSpeed);
    ui.hideDock();
    ui.hideResult();
    ui.clearFloaters();
    ui.setBanner("The constellations take their marks");
    ui.setLeaders(leaderLine(game.session.units, "player"), leaderLine(game.session.units, "enemy"));
    ui.setLog([]);
    ensurePlates();
  }

  function assignHomes(snap) {
    for (const actor of actors) {
      actor.team = null;
      actor.uid = null;
      actor.root.userData.uid = null;
    }
    MATCH.player.forEach((id, index) => bindFighter(id, "player", index));
    MATCH.enemy.forEach((id, index) => bindFighter(id, "enemy", index));
    for (const actor of actors) {
      if (actor.uid) continue;
      actor.home.set(actor.root.position.x, FLOOR_Y - 1.6, actor.root.position.z);
      actor.homeFacing = actor.root.rotation.y;
      actor.homeScale = 0.02;
    }
    if (snap) {
      for (const actor of actors) {
        actor.root.position.copy(actor.home);
        actor.root.rotation.y = actor.homeFacing;
        actor.root.scale.setScalar(actor.homeScale);
        actor.root.visible = actor.homeScale > 0.2;
        actor.down = 0;
        actor.pose.topple = 0;
        actor.pose.lunge = 0;
        actor.pose.lift = 0;
        restoreFlash(actor);
      }
    }
  }

  function bindFighter(id, team, index) {
    const actor = actorById.get(id);
    const slot = team === "player" ? PLAYER_SLOTS[index] : ENEMY_SLOTS[index];
    actor.team = team;
    actor.uid = `${team}-${id}`;
    actor.root.userData.uid = actor.uid;
    actor.home.set(slot.x, FLOOR_Y, slot.z);
    actor.homeFacing = team === "player" ? -0.42 : Math.PI + 0.42;
    actor.homeScale = 1;
  }

  function updateDeploy(dt) {
    game.deployT += dt;
    const k = smoothstep(game.deployT / 1.35);
    for (const actor of actors) {
      actor.root.position.lerpVectors(actor.fromPos, actor.home, k);
      actor.root.rotation.y = lerpAngle(actor.fromFacing, actor.homeFacing, k);
      const scale = actor.fromScale + (actor.homeScale - actor.fromScale) * k;
      actor.root.scale.setScalar(scale);
    }
    camera.position.lerpVectors(camFrom, battleCam, k);
    look.lerpVectors(lookFrom, battleLook, k);
    ui.setTurn(game.session.units, null);
    if (k >= 1) {
      for (const actor of actors) {
        if (actor.homeScale < 0.2) actor.root.visible = false;
      }
      game.mode = "battle";
      ui.setMode("battle");
      ui.setBanner("Take your marks");
    }
  }

  function updateBattle(dt) {
    const scaled = dt * game.gameSpeed;
    if (game.anim) {
      driveAnim(scaled);
      return;
    }
    if (game.mode !== "battle" || !game.session || game.session.phase === "end") return;
    const signal = game.session.update(scaled);
    ui.setTurn(game.session.units, game.session.activeUid);
    ui.setLog(game.session.log);
    if (!signal) return;
    if (signal.type === "input") showInput(signal.actor);
    else if (signal.type === "skill" || signal.type === "stun") beginAnim(signal);
    else if (signal.type === "end") showResult(signal.winner);
  }

  function showInput(actor) {
    game.aim = null;
    ui.showDock(actor);
    ui.setArmed(-1);
    ui.setBanner(`Your turn · ${actor.name}`);
    ui.setHint("Choose a skill. Keys 1, 2, and 3 select one.");
    ui.setTurn(game.session.units, actor.uid);
  }

  function previewSkill(index) {
    const actor = game.session?.active();
    const skill = actor?.skills[index];
    if (!skill || game.session.phase !== "input") return;
    ui.setHint(skill.cdLeft ? `${skill.name} cools for ${skill.cdLeft} more of ${actor.name}'s turns.` : skill.blurb);
  }

  function pressSkill(index) {
    const session = game.session;
    const actor = session?.active();
    if (!actor || session.phase !== "input") return;
    const skill = actor.skills[index];
    if (!skill || skill.cdLeft > 0) return;
    audio.click();
    if (skill.target === "enemy" || skill.target === "ally") {
      game.aim = { skillIndex: index };
      ui.setArmed(index);
      ui.setHint(`${skill.blurb} Choose a ${skill.target === "enemy" ? "foe" : "ally"}.`);
      return;
    }
    game.aim = null;
    const result = session.submit(index, null);
    if (!result.ok) {
      ui.setHint(result.reason || "That skill cannot be used.");
      return;
    }
    ui.hideDock();
    beginAnim(result);
  }

  function tryTarget(uid) {
    if (!game.aim || game.session?.phase !== "input") return;
    const unit = game.session.unit(uid);
    if (!isValidTarget(unit)) return;
    const index = game.aim.skillIndex;
    game.aim = null;
    const result = game.session.submit(index, uid);
    if (!result.ok) {
      ui.setHint(result.reason || "Choose another target.");
      return;
    }
    ui.hideDock();
    beginAnim(result);
  }

  function isValidTarget(unit) {
    if (!game.aim || !unit?.alive) return false;
    const skill = game.session.active()?.skills[game.aim.skillIndex];
    if (!skill) return false;
    if (skill.target === "enemy") return unit.team === "enemy";
    if (skill.target === "ally") return unit.team === "player";
    return false;
  }

  function toggleAuto() {
    if (!game.session || game.mode === "title" || game.mode === "deploy") return;
    game.session.auto = !game.session.auto;
    ui.setAuto(game.session.auto);
    audio.click();
    if (game.session.auto && game.session.phase === "input") {
      game.aim = null;
      ui.hideDock();
      const result = game.session.launchAi();
      if (result?.ok) beginAnim(result);
    }
  }

  function beginAnim(signal) {
    const skill = signal.skill;
    const kind = signal.type === "stun" ? "stun" : skill.target === "enemies" ? "nova" : skill.multiplier > 0 ? "strike" : "cast";
    game.anim = {
      t: 0,
      dur: kind === "stun" ? 0.62 : kind === "nova" ? 1.12 : kind === "cast" ? 0.86 : 1.02,
      impactAt: kind === "cast" ? 0.46 : 0.4,
      impacted: signal.type === "stun",
      kind,
      actorUid: signal.actor.uid,
      targets: signal.targets || [],
      element: signal.actor.element,
      skill,
    };
    ui.setBanner(signal.type === "stun" ? `${signal.actor.name} is stunned` : `${signal.actor.name} · ${skill.name}`);
    ui.setTurn(game.session.units, signal.actor.uid);
    ui.setLog(game.session.log);
  }

  function driveAnim(dt) {
    const anim = game.anim;
    anim.t += dt;
    const k = Math.min(1, anim.t / anim.dur);
    const actor = actorByUid(anim.actorUid);
    if (actor && anim.kind !== "stun") {
      if (anim.kind === "strike") {
        actor.pose.lunge = strikeCurve(k) * 1.7;
        actor.pose.lift = Math.sin(Math.min(1, k / 0.42) * Math.PI) * 0.16;
      } else if (anim.kind === "nova") {
        actor.pose.lunge = strikeCurve(k) * 0.45;
        actor.pose.lift = Math.sin(k * Math.PI) * 0.28;
      } else {
        actor.pose.lift = Math.sin(k * Math.PI) * 0.32;
      }
    }
    if (!anim.impacted && k >= anim.impactAt) {
      anim.impacted = true;
      const pending = game.session.applyPending();
      if (pending?.events) impactVfx(anim, pending.events);
      ui.setLog(game.session.log);
    }
    if (k < 1) return;
    if (actor) {
      actor.pose.lunge = 0;
      actor.pose.lift = 0;
    }
    const winner = game.session.finishBusy();
    game.anim = null;
    ui.setLog(game.session.log);
    if (winner) showResult(winner);
    else if (game.session.phase === "input") showInput(game.session.active());
    else ui.setBanner("");
  }

  function impactVfx(anim, events) {
    let heavy = anim.kind === "nova";
    for (const event of events) {
      const actor = actorByUid(event.uid);
      if (!actor) continue;
      const point = worldPoint(actor.anchor);
      if (event.kind === "damage") {
        actor.recoil = 1;
        flash(actor, 0xfff4ea, 140);
        bursts.burst(point, ELEMENT_INFO[anim.element].value, event.crit ? 16 : 10);
        const kind = event.crit ? "crit" : event.glance ? "glance" : event.relation === "advantage" ? "favored" : "";
        floatAt(actor, String(event.amount), kind);
        if (!game.session.unit(event.uid)?.alive) actor.down = 1;
        audio.hit(anim.element);
        heavy = heavy || event.crit || event.amount > 420;
      } else if (event.kind === "heal" && event.amount > 0) {
        bursts.burst(point, 0x9cf0c8, 9, 1.2);
        floatAt(actor, `+${event.amount}`, "heal");
        audio.heal();
      } else if (event.kind === "effect") {
        const helpful = EFFECTS[event.effect]?.helpful;
        bursts.burst(point, helpful ? 0xffd56a : 0xb79cff, 8, 1.3);
        audio.buff();
      }
    }
    if (anim.kind === "nova" && anim.targets.length) {
      const spot = centroid(anim.targets);
      pulse.fire(spot.x, spot.z, ELEMENT_INFO[anim.element].value, 2.6);
    }
    if (heavy) game.shake = Math.max(game.shake, 0.16);
  }

  function updateActors(dt) {
    const now = performance.now();
    for (const actor of actors) {
      if (!actor.root.visible) continue;
      actor.pose.topple += ((actor.down || 0) - actor.pose.topple) * Math.min(1, dt * 5);
      actor.recoil = Math.max(0, actor.recoil - dt * 3.4);
      if (!game.anim || actorByUid(game.anim.actorUid) !== actor) {
        actor.pose.recoil = actor.recoil;
      } else {
        actor.pose.recoil = actor.recoil;
      }
      actor.built.idle(game.time, actor.pose);
      if (actor.flashUntil && now >= actor.flashUntil) restoreFlash(actor);
    }
  }

  function updateRings() {
    const active = game.session?.activeUid;
    for (const actor of actors) {
      const unit = actor.uid ? game.session?.unit(actor.uid) : null;
      const show =
        game.mode === "battle" &&
        unit?.alive &&
        (unit.uid === active || isValidTarget(unit));
      actor.ring.visible = Boolean(show);
      if (!show) continue;
      let color = 0xf0d7a0;
      if (isValidTarget(unit)) {
        const relation = relationOfActive(unit);
        color = relation === "advantage" ? 0xffd56a : relation === "disadvantage" ? 0x9eb4d4 : 0xfff6ea;
      }
      actor.ring.material.color.setHex(color);
      actor.ring.material.opacity = 0.45 + Math.sin(game.time * 5) * 0.25;
    }
  }

  function relationOfActive(unit) {
    const actor = game.session?.active();
    if (!actor || !game.aim) return "neutral";
    const skill = actor.skills[game.aim.skillIndex];
    if (!skill || skill.multiplier <= 0) return "neutral";
    return unit.element && actor.element ? relationWord(actor.element, unit.element) : "neutral";
  }

  function relationWord(attacker, defender) {
    const copy = relationCopy(attacker, defender);
    if (copy.includes("unfavored")) return "disadvantage";
    if (copy.includes("favored")) return "advantage";
    return "neutral";
  }

  function updatePlates() {
    if (!game.session || game.mode === "title" || game.mode === "deploy") {
      for (const el of plates.values()) el.hidden = true;
      return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    for (const unit of game.session.units) {
      const el = plates.get(unit.uid);
      const actor = actorByUid(unit.uid);
      if (!el || !actor) continue;
      ui.updatePlate(el, unit, unit.uid === game.session.activeUid, isValidTarget(unit));
      if (!unit.alive) continue;
      const screen = project(actor.anchor, width, height);
      el.hidden = screen.behind;
      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y}px`;
    }
  }

  function ensurePlates() {
    ui.clearPlates();
    plates.clear();
    for (const unit of game.session.units) {
      const el = ui.makePlate(unit);
      el.addEventListener("pointerenter", () => {
        if (!isValidTarget(unit)) return;
        const actor = game.session.active();
        const skill = actor?.skills[game.aim.skillIndex];
        if (skill?.multiplier > 0 && skill.target === "enemy") ui.setHint(relationCopy(actor.element, unit.element));
      });
      plates.set(unit.uid, el);
    }
  }

  function placeCamera() {
    if (game.mode === "battle" || game.mode === "result") {
      camera.position.copy(battleCam);
      look.copy(battleLook);
    }
    if (game.shake > 0 && game.mode !== "title") {
      camera.position.x += (Math.random() - 0.5) * game.shake;
      camera.position.y += (Math.random() - 0.5) * game.shake * 0.65;
      game.shake = Math.max(0, game.shake - 0.02);
    }
    camera.lookAt(look);
  }

  function showResult(winner) {
    game.mode = "result";
    game.aim = null;
    ui.hideDock();
    ui.setMode("result");
    ui.showResult(winner === "player" ? "player" : "enemy");
    ui.setBanner(winner === "player" ? "Victory" : "Defeat");
    ui.setTurn(game.session.units, null);
    if (winner === "player") audio.win();
    else audio.lose();
  }

  function rematch() {
    if (!game.session) return;
    const auto = game.session.auto;
    const speed = game.gameSpeed;
    game.session.reset();
    game.session.auto = auto;
    assignHomes(true);
    game.anim = null;
    game.aim = null;
    game.mode = "battle";
    game.gameSpeed = speed;
    ui.setMode("battle");
    ui.hideResult();
    ui.hideDock();
    ui.clearFloaters();
    ui.setAuto(auto);
    ui.setLeaders(leaderLine(game.session.units, "player"), leaderLine(game.session.units, "enemy"));
    ui.setLog([]);
    ui.setBanner("Rematch. Take your marks.");
    ensurePlates();
    audio.start();
  }

  function backToTitle() {
    game.session = null;
    game.anim = null;
    game.aim = null;
    game.mode = "title";
    ui.clearPlates();
    plates.clear();
    ui.clearFloaters();
    ui.hideResult();
    ui.hideDock();
    ui.setMode("title");
    for (const actor of actors) {
      const slot = ringSlot(ROSTER.findIndex((monster) => monster.id === actor.id), ROSTER.length);
      actor.root.visible = true;
      actor.root.scale.setScalar(1);
      actor.root.position.set(slot.x, FLOOR_Y, slot.z);
      actor.root.rotation.y = slot.facing;
      actor.uid = null;
      actor.team = null;
      actor.down = 0;
      actor.pose.topple = 0;
      actor.pose.lunge = 0;
      actor.pose.lift = 0;
      actor.root.userData.uid = null;
      restoreFlash(actor);
    }
  }

  function onKey(event) {
    if (event.key === "Escape") {
      game.aim = null;
      ui.setArmed(-1);
      if (game.session?.phase === "input") ui.setHint("Choose a skill. Keys 1, 2, and 3 select one.");
      return;
    }
    if (event.key === "1" || event.key === "2" || event.key === "3") pressSkill(Number(event.key) - 1);
  }

  function onPointerMove(event) {
    const uid = pickUid(event);
    const unit = uid ? game.session?.unit(uid) : null;
    canvas.style.cursor = unit && isValidTarget(unit) ? "pointer" : "default";
    if (unit && isValidTarget(unit)) {
      const actor = game.session.active();
      const skill = actor?.skills[game.aim.skillIndex];
      if (skill?.multiplier > 0 && skill.target === "enemy") ui.setHint(relationCopy(actor.element, unit.element));
    }
  }

  function onPointerDown(event) {
    const uid = pickUid(event);
    if (uid) tryTarget(uid);
  }

  function pickUid(event) {
    if (!game.session || game.mode !== "battle") return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const roots = actors.filter((actor) => actor.uid && game.session.unit(actor.uid)?.alive).map((actor) => actor.root);
    const hits = raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    let object = hits[0].object;
    while (object) {
      if (object.userData?.uid) return object.userData.uid;
      object = object.parent;
    }
    return null;
  }

  function actorByUid(uid) {
    return actors.find((actor) => actor.uid === uid) || null;
  }

  function worldPoint(object) {
    const point = new THREE.Vector3();
    object.getWorldPosition(point);
    return point;
  }

  function centroid(uids) {
    const point = new THREE.Vector3();
    let count = 0;
    for (const uid of uids) {
      const actor = actorByUid(uid);
      if (!actor) continue;
      point.add(actor.root.position);
      count += 1;
    }
    if (count) point.multiplyScalar(1 / count);
    return point;
  }

  function project(object, width, height) {
    object.getWorldPosition(projected);
    projected.project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      behind: projected.z > 1,
    };
  }

  function floatAt(actor, text, kind) {
    const screen = project(actor.anchor, canvas.clientWidth, canvas.clientHeight);
    ui.spawnFloater(screen.x + (Math.random() - 0.5) * 18, screen.y - 18, text, kind);
  }

  function flash(actor, color, ms) {
    actor.flashUntil = performance.now() + ms;
    const seen = new Set();
    for (const mesh of actor.meshes) {
      const material = mesh.material;
      if (!material?.emissive || seen.has(material)) continue;
      seen.add(material);
      material.userData.baseEm ??= material.emissive.clone();
      material.userData.baseEi ??= material.emissiveIntensity;
      material.emissive.setHex(color);
      material.emissiveIntensity = 0.85;
    }
  }

  function restoreFlash(actor) {
    actor.flashUntil = 0;
    const seen = new Set();
    for (const mesh of actor.meshes) {
      const material = mesh.material;
      if (!material?.userData?.baseEm || seen.has(material)) continue;
      seen.add(material);
      material.emissive.copy(material.userData.baseEm);
      material.emissiveIntensity = material.userData.baseEi ?? 0;
    }
  }

  function debugState() {
    return {
      mode: game.mode,
      phase: game.session?.phase ?? null,
      winner: game.session?.winner ?? null,
      frames: game.frames || 0,
      deployT: game.deployT,
      lastError: game.lastError || null,
      banner: document.getElementById("banner")?.textContent ?? "",
      units:
        game.session?.units.map((unit) => ({
          name: unit.name,
          team: unit.team,
          hp: unit.hp,
          maxHp: unit.maxHp,
          alive: unit.alive,
          atb: Math.round(unit.atb),
        })) ?? [],
    };
  }

  return game;
}
