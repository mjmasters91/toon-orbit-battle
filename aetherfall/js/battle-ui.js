import * as THREE from "../vendor/three/three.module.js";
import { dressArena } from "./arena.js";
import { autoChoice, endRound, enemyTurn, openBattle, performAction } from "./battle.js";
import { buildMonster, buildUnit, poseFigure } from "./figures.js";
import { ELEMENT, basicMat } from "./materials.js";
import { mountView } from "./stage.js";
import { MAPS } from "./stages.js";

function groundRing(position, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.48, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(position.x, 0.04, position.z);
  return ring;
}

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (key === "class") node.className = val;
    else if (key === "text") node.textContent = String(val);
    else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2).toLowerCase(), val);
    else node.setAttribute(key, val === true ? "" : String(val));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

let activeStop = null;

export function stopBattle() {
  const fn = activeStop;
  activeStop = null;
  if (fn) fn();
}

export function renderBattleScreen(parent, options) {
  const battle = openBattle(options.allies, options.encounter);
  const map = MAPS[options.encounter.mapIndex];
  let timer = 0;
  let speed = 1;
  let auto = false;
  let cursor = 0;
  let target = 0;
  let busy = false;
  const started = performance.now();
  let stopped = false;
  const actors = new Map();
  const fx = [];
  let sceneRef = null;
  let cameraRef = null;
  let camHome = new THREE.Vector3(0.2, 2.7, 7.6);
  let camLook = new THREE.Vector3(0.15, 0.65, 0);
  let focusUntil = 0;
  let focusPos = camHome.clone();

  const stage = h("div", { class: "stage battle-stage", id: "battle-stage" });
  const hud = h("div", { class: "hud-layer", id: "hud-layer" });
  const strip = h("div", { class: "turn-strip", id: "turn-strip" });
  const log = h("p", { id: "battle-log", class: "battle-log", text: `${map.name} · ${options.title}` });
  const commands = h("div", { class: "commands", id: "battle-commands" });
  const root = h("section", { id: "battle-app", class: "screen battle-screen" },
    strip,
    h("div", { class: "field-wrap" }, stage, hud),
    log,
    commands,
  );
  parent.append(root);

  function skillName(unit, kind, fallback) {
    return unit.skills?.find((row) => row.kind === kind)?.name || fallback;
  }

  function skillText(unit, kind) {
    return unit.skills?.find((row) => row.kind === kind)?.text || "";
  }

  function delay() {
    return speed === 2 ? 220 : 460;
  }

  function livingAllies() {
    return battle.allies.map((unit, index) => ({ unit, index })).filter((row) => row.unit.hp > 0);
  }

  function currentActor() {
    const rows = livingAllies();
    if (!rows.length) return null;
    cursor = cursor % rows.length;
    return rows[cursor];
  }

  function placeAllies(scene) {
    battle.allies.forEach((unit, index) => {
      const figure = buildUnit(unit.spriteId || unit.id);
      figure.position.set(-1.45, 0, (index - 1.5) * 0.95);
      figure.rotation.y = -Math.PI / 2;
      scene.add(figure);
      scene.add(groundRing(figure.position, "#f0d48a"));
      actors.set(unit.id, { figure, unit, bar: barFor(unit) });
    });
  }

  function syncEnemies(scene) {
    for (const [id, actor] of actors) {
      if (actor.unit.side === "enemy") {
        scene.remove(actor.figure);
        actor.bar.remove();
        actors.delete(id);
      }
    }
    battle.enemies.forEach((unit, index) => {
      const figure = buildMonster(unit.kind || "slime", unit.element, unit.boss);
      figure.position.set(1.65, 0, (index - (battle.enemies.length - 1) / 2) * 1.15);
      figure.rotation.y = Math.PI / 2;
      scene.add(figure);
      scene.add(groundRing(figure.position, unit.boss ? "#ffb15a" : "#f4efe4"));
      actors.set(unit.id, { figure, unit, bar: barFor(unit) });
    });
  }

  function barFor(unit) {
    const node = h("div", { class: `overhead ${unit.boss ? "boss" : ""}`, "data-unit": unit.id },
      h("b", { text: unit.name }),
      h("div", { class: "hp" }, h("i")),
      h("div", { class: "gauge" }, h("i")),
    );
    hud.append(node);
    return node;
  }

  function layoutHud() {
    if (!cameraRef) return;
    const width = stage.clientWidth || 1;
    const height = stage.clientHeight || 1;
    for (const actor of actors.values()) {
      const point = actor.figure.position.clone();
      point.y += actor.unit.boss ? 2.15 : 1.55;
      point.project(cameraRef);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      actor.bar.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const hp = Math.max(0, actor.unit.hp / actor.unit.hpMax);
      actor.bar.querySelector(".hp i").style.width = `${hp * 100}%`;
      actor.bar.querySelector(".gauge i").style.width = `${actor.unit.gauge}%`;
      actor.bar.classList.toggle("down", actor.unit.hp <= 0);
    }
  }

  function floatNumber(id, text, kind) {
    const actor = actors.get(id);
    if (!actor) return;
    const note = h("span", { class: `floater ${kind}`, text });
    actor.bar.append(note);
    setTimeout(() => note.remove(), 700);
  }

  function burst(fromId, toId, color, count, arts) {
    if (!sceneRef) return;
    const from = actors.get(fromId)?.figure?.position?.clone() || new THREE.Vector3(-1, 1, 0);
    const to = actors.get(toId)?.figure?.position?.clone() || new THREE.Vector3(1, 1, 0);
    from.y += 0.8;
    to.y += 0.8;
    const sparkGeo = new THREE.SphereGeometry(arts ? 0.07 : 0.045, 6, 4);
    sparkGeo.userData.own = true;
    const mesh = new THREE.InstancedMesh(sparkGeo, basicMat(color, 1), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sceneRef.add(mesh);
    const dummy = new THREE.Object3D();
    const seeds = Array.from({ length: count }, (_, i) => ({
      ang: (i / count) * Math.PI * 2,
      lift: (i % 5) * 0.08,
    }));
    const born = performance.now();
    fx.push({
      tick(now) {
        const u = Math.min(1, (now - born) / (arts ? 520 : 360));
        seeds.forEach((seed, i) => {
          dummy.position.lerpVectors(from, to, u);
          dummy.position.x += Math.cos(seed.ang) * (1 - u) * 0.35;
          dummy.position.y += Math.sin(u * Math.PI) * 0.45 + seed.lift;
          dummy.position.z += Math.sin(seed.ang) * (1 - u) * 0.25;
          dummy.scale.setScalar(arts ? 1.3 - u : 1 - u * 0.6);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (u >= 1) {
          sceneRef.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          return false;
        }
        return true;
      },
    });
  }

  function focusOn(id) {
    const actor = actors.get(id);
    if (!actor) return;
    focusPos = actor.figure.position.clone().add(new THREE.Vector3(0.2, 1.5, 2.4));
    focusUntil = performance.now() + (speed === 2 ? 280 : 520);
  }

  const view = mountView(stage, ({ scene, camera }) => {
    sceneRef = scene;
    cameraRef = camera;
    dressArena(scene, map.id);
    placeAllies(scene);
    syncEnemies(scene);
    camera.position.copy(camHome);
    camera.lookAt(camLook);
    stage.addEventListener("pointerdown", onPick);
    return {
      tick(now) {
        const narrow = camera.aspect < 0.9;
        camera.fov = narrow ? 50 : 32;
        camera.updateProjectionMatrix();
        camHome.set(0.15, narrow ? 3.3 : 2.7, narrow ? 9.4 : 7.6);
        const blend = now < focusUntil ? 0.08 : 0.06;
        const goal = now < focusUntil ? focusPos : camHome;
        camera.position.lerp(goal, blend);
        camera.lookAt(camLook);
        for (const actor of actors.values()) {
          const clip = actor.figure.userData.clip || "idle";
          if (actor.unit.hp <= 0) actor.figure.userData.clip = "death";
          actor.figure.userData.phase = (actor.figure.userData.phase || 0) + 0.028 * (speed === 2 ? 1.7 : 1);
          poseFigure(actor.figure, actor.figure.userData.clip || "idle", now / 1000 + actor.figure.position.x);
          if ((actor.figure.userData.phase || 0) > 1 && clip !== "death") actor.figure.userData.clip = "idle";
        }
        for (let i = fx.length - 1; i >= 0; i--) {
          if (!fx[i].tick(now)) fx.splice(i, 1);
        }
        layoutHud();
        const actor = currentActor();
        for (const row of actors.values()) {
          row.bar.classList.toggle("active", Boolean(actor && row.unit.id === actor.unit.id));
          row.bar.classList.toggle("target", row.unit.side === "enemy" && battle.enemies[target] === row.unit);
        }
      },
      onDispose() {
        stage.removeEventListener("pointerdown", onPick);
      },
    };
  });

  function onPick(event) {
    if (!cameraRef || !sceneRef) return;
    const rect = stage.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, cameraRef);
    const figures = battle.enemies.map((unit) => actors.get(unit.id)?.figure).filter(Boolean);
    const hits = ray.intersectObjects(figures, true);
    if (!hits.length) return;
    const enemy = battle.enemies.find((unit) => {
      const figure = actors.get(unit.id)?.figure;
      return figure && hitInside(figure, hits[0].object);
    });
    if (enemy && enemy.hp > 0) {
      target = battle.enemies.indexOf(enemy);
      renderCommands();
    }
  }

  function hitInside(figure, object) {
    let node = object;
    while (node) {
      if (node === figure) return true;
      node = node.parent;
    }
    return false;
  }

  function renderStrip() {
    const rows = livingAllies();
    const names = [
      ...rows.map((row) => row.unit.name),
      ...battle.enemies.filter((unit) => unit.hp > 0).map((unit) => unit.name),
    ];
    strip.replaceChildren(...names.map((name, index) => h("span", { class: index === 0 ? "now" : "", text: name })));
  }

  function renderCommands() {
    renderStrip();
    const actor = currentActor();
    if (battle.over) {
      commands.replaceChildren(resultPanel());
      return;
    }
    if (!actor || !view.ok) {
      if (!view.ok) commands.replaceChildren(h("p", { text: "The arena could not be drawn." }));
      return;
    }
    const artsReady = actor.unit.gauge >= 100;
    commands.replaceChildren(
      h("p", { class: "turn-line", text: `${actor.unit.name} · ${actor.unit.role}` }),
      h("div", { class: "skill-dock" },
        h("button", { class: "orb", type: "button", id: "act-attack", title: "Attack", onclick: () => act("attack") }, h("b", { text: "Attack" })),
        h("button", { class: "orb", type: "button", id: "act-skill", title: skillText(actor.unit, "Skill"), onclick: () => act("skill") }, h("b", { text: skillName(actor.unit, "Skill", "Skill") })),
        h("button", { class: `orb arts ${artsReady ? "arts-ready" : ""}`, type: "button", id: "act-arts", title: skillText(actor.unit, "Art"), disabled: !artsReady, onclick: () => act("arts") }, h("b", { text: skillName(actor.unit, "Art", "Arts") })),
      ),
      h("div", { class: "row utility" },
        h("button", { class: `btn ghost ${auto ? "on" : ""}`, type: "button", id: "battle-auto", text: auto ? "Auto on" : "Auto", onclick: toggleAuto }),
        h("button", { class: "btn ghost", type: "button", id: "battle-speed", text: speed === 2 ? "Speed 2x" : "Speed 1x", onclick: () => { speed = speed === 2 ? 1 : 2; renderCommands(); } }),
        h("button", { class: "btn ghost", type: "button", text: "Retreat", onclick: () => shutdown(() => options.onExit("retreat")) }),
      ),
    );
  }

  function resultPanel() {
    const won = battle.over === "win";
    return h("div", { class: `result-panel ${won ? "win" : "lose"}`, id: won ? "victory" : "defeat" },
      h("h2", { text: won ? "Victory" : "Defeat" }),
      h("p", { id: "battle-summary", text: won ? `${battle.turns} turns · ${battle.deaths} fallen` : "The party could not hold the stage." }),
      won ? h("p", { id: "battle-reward", text: options.rewardLine ? options.rewardLine(battle) : "" }) : null,
      h("div", { class: "row" },
        won ? h("button", { class: "btn", id: "battle-continue", type: "button", text: "Claim", onclick: () => shutdown(() => options.onVictory({
          won: true,
          turns: battle.turns,
          deaths: battle.deaths,
          seconds: Math.max(1, Math.round((performance.now() - started) / 1000)),
        })) }) : null,
        h("button", { class: "btn ghost", id: "battle-retry", type: "button", text: "Retry", onclick: () => shutdown(() => options.onExit("retry")) }),
        h("button", { class: "btn ghost", type: "button", text: "Map", onclick: () => shutdown(() => options.onExit("map")) }),
      ),
    );
  }

  function showLog(entries, actorId, action) {
    const blows = entries.filter((row) => row.type === "damage" || row.type === "heal");
    for (const row of blows) floatNumber(row.id, row.type === "heal" ? `+${row.amount}` : String(row.amount), row.type === "heal" ? "heal" : "damage");
    const strike = blows.find((row) => row.type === "damage");
    if (strike && actorId) {
      const color = ELEMENT[actors.get(actorId)?.unit.element] || "#f0d78c";
      const arts = action === "arts" || entries.some((row) => row.arts);
      burst(actorId, strike.id, color, arts ? 32 : 14, arts);
      focusOn(action === "attack" ? strike.id : actorId);
      const fig = actors.get(actorId)?.figure;
      if (fig) {
        fig.userData.clip = action === "attack" ? "attack" : "skill";
        fig.userData.phase = 0;
      }
      const foe = actors.get(strike.id)?.figure;
      if (foe && action !== "arts") {
        foe.userData.clip = "hit";
        foe.userData.phase = 0;
      }
    }
    if (entries.some((row) => row.arts)) {
      const banner = h("div", { class: "arts-burst", id: "arts-burst", text: "Arts" });
      root.querySelector(".field-wrap").append(banner);
      setTimeout(() => banner.remove(), 700);
    }
    const text = blows.map((row) => row.type === "heal" ? `+${row.amount}` : String(row.amount)).join("  ");
    if (text) log.textContent = text;
  }

  function lowestHurt() {
    let best = 0;
    let ratio = 2;
    battle.allies.forEach((unit, index) => {
      if (unit.hp <= 0) return;
      const score = unit.hp / unit.hpMax;
      if (score < ratio) { ratio = score; best = index; }
    });
    return best;
  }

  function act(action) {
    if (busy || battle.over || auto) return;
    const actor = currentActor();
    if (!actor) return;
    if (action === "arts" && actor.unit.gauge < 100) return;
    busy = true;
    const friendly = (action === "skill" || action === "arts") && actor.unit.role === "healer";
    const entries = performAction(battle, actor.unit, action, friendly ? lowestHurt() : target);
    afterAction(entries, actor.unit.id, action);
  }

  function afterAction(entries, actorId, action) {
    showLog(entries, actorId, action);
    if (battle.over) {
      renderCommands();
      busy = false;
      return;
    }
    const rows = livingAllies();
    cursor = (cursor + 1) % Math.max(1, rows.length);
    if (cursor === 0) {
      const before = battle.wave;
      const enemyLog = enemyTurn(battle);
      const endLog = endRound(battle);
      showLog([...enemyLog, ...endLog], battle.enemies[0]?.id, "attack");
      if (sceneRef && battle.wave !== before && !battle.over) syncEnemies(sceneRef);
    }
    renderCommands();
    busy = false;
    if (auto && !battle.over) scheduleAuto();
  }

  function scheduleAuto() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (stopped || !auto || battle.over) return;
      const actor = currentActor();
      if (!actor) return;
      const choice = autoChoice(battle, actor.unit);
      busy = true;
      const entries = performAction(battle, actor.unit, choice.action, choice.target);
      afterAction(entries, actor.unit.id, choice.action);
    }, delay());
  }

  function toggleAuto() {
    auto = !auto;
    renderCommands();
    if (auto) scheduleAuto();
    else clearTimeout(timer);
  }

  function shutdown(done) {
    if (stopped) return;
    stopped = true;
    activeStop = null;
    clearTimeout(timer);
    view.stop?.();
    done();
  }

  renderCommands();
  activeStop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  return { battle };
}
