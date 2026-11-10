import { autoChoice, elementMod, endRound, enemyTurn, openBattle, performAction } from "./battle.js";
import { renderField, renderMonster } from "./monsters.js";
import { paint } from "./pixel.js";
import { MAPS } from "./stages.js";

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

function paintMonster(canvas, unit, frame) {
  paint(canvas, renderMonster(unit.kind || "slime", unit.element, unit.boss, frame), unit.boss ? 3 : 2);
}

export function renderBattleScreen(parent, options) {
  const battle = openBattle(options.allies, options.encounter);
  const map = MAPS[options.encounter.mapIndex];
  let frame = 0;
  let timer = 0;
  let speed = 1;
  let auto = false;
  let cursor = 0;
  let target = 0;
  let busy = false;
  const started = performance.now();
  let stopped = false;

  const field = h("canvas", { class: "pixel field-art", "data-field": map.id });
  const log = h("p", { id: "battle-log", class: "battle-log", text: "Choose an action." });
  const allyLane = h("div", { class: "lane allies" });
  const enemyLane = h("div", { class: "lane enemies" });
  const commands = h("div", { class: "commands", id: "battle-commands" });
  const root = h("section", { id: "battle-app", class: "screen battle-screen" },
    h("div", { class: "field-wrap" }, field, enemyLane, allyLane),
    log,
    commands,
  );
  parent.append(root);
  paint(field, renderField(map.id), 1);
  field.style.width = "100%";
  field.style.height = "260px";

  function skillName(unit, kind, fallback) {
  return unit.skills?.find((row) => row.kind === kind)?.name || fallback;
}

function skillText(unit, kind) {
  return unit.skills?.find((row) => row.kind === kind)?.text || "";
}

function delay() {
    return (speed === 2 ? 180 : 380);
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

  function floatNumber(anchor, text, kind) {
    if (!anchor) return;
    const note = h("span", { class: `floater ${kind}`, text });
    anchor.append(note);
    setTimeout(() => note.remove(), 700);
  }

  function flash(id) {
    const node = root.querySelector(`[data-unit="${id}"]`);
    if (!node) return node;
    node.classList.add(kindFlash(id));
    setTimeout(() => node.classList.remove("hit", "heal", "arts"), 220);
    return node;
  }

  function kindFlash(id) {
    return "hit";
  }

  function renderUnits() {
    const actor = currentActor();
    allyLane.replaceChildren(...battle.allies.map((unit, index) => unitCard(unit, index, actor && actor.index === index)));
    enemyLane.replaceChildren(...battle.enemies.map((unit, index) => unitCard(unit, index, false)));
    root.querySelectorAll("canvas[data-monster]").forEach((canvas) => {
      const unit = [...battle.allies, ...battle.enemies].find((row) => row.id === canvas.dataset.unit);
      if (unit) paintMonster(canvas, unit, frame);
    });
  }

  function unitCard(unit, index, active) {
    const pct = Math.max(0, Math.round((unit.hp / unit.hpMax) * 100));
    const node = h("button", {
      type: "button",
      class: `battler ${unit.side} ${unit.boss ? "boss" : ""} ${active ? "active" : ""} ${unit.hp <= 0 ? "down" : ""}`,
      "data-unit": unit.id,
      onclick: () => {
        if (unit.side === "enemy" && unit.hp > 0) target = index;
        renderCommands();
      },
    },
      h("canvas", {
        class: "pixel",
        "data-monster": unit.kind || "hero",
        "data-element": unit.element,
        "data-boss": unit.boss ? "1" : "0",
        "data-unit": unit.id,
      }),
      h("p", { class: "battler-name", text: unit.name }),
      h("div", { class: "hp" }, h("i", { style: `width:${pct}%` })),
      h("div", { class: "gauge" }, h("i", { style: `width:${unit.gauge}%` })),
    );
    if (!unit.kind) {
      node.querySelector("canvas").remove();
      node.prepend(h("canvas", { class: "pixel", "data-sprite": unit.spriteId, "data-scale": "2", "data-unit": unit.id }));
    }
    return node;
  }

  function renderCommands() {
    const actor = currentActor();
    if (battle.over) {
      commands.replaceChildren(resultPanel());
      return;
    }
    if (!actor) return;
    const artsReady = actor.unit.gauge >= 100;
    commands.replaceChildren(
      h("p", { class: "turn-line", text: `${actor.unit.name} · ${actor.unit.role}` }),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", id: "act-attack", text: "Attack", onclick: () => act("attack") }),
        h("button", { class: "btn", type: "button", id: "act-skill", title: skillText(actor.unit, "Skill"), text: skillName(actor.unit, "Skill", "Skill"), onclick: () => act("skill") }),
        h("button", { class: `btn ${artsReady ? "arts-ready" : ""}`, type: "button", id: "act-arts", title: skillText(actor.unit, "Art"), text: skillName(actor.unit, "Art", "Arts"), disabled: !artsReady, onclick: () => act("arts") }),
      ),
      h("div", { class: "row" },
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

  function describe(entry) {
    if (entry.type === "damage") return `${entry.amount}`;
    if (entry.type === "heal") return `+${entry.amount}`;
    if (entry.type === "burn") return `burn ${entry.amount}`;
    if (entry.type === "buff") return entry.arts ? "Arts aura" : "Aura";
    if (entry.type === "guard") return "Guard";
    if (entry.type === "inflict") return "Burn";
    return "";
  }

  function showLog(entries) {
    const last = entries.filter((row) => row.type === "damage" || row.type === "heal").slice(-1)[0];
    if (!last) return;
    const node = flash(last.id);
    floatNumber(node, describe(last), last.type === "heal" ? "heal" : elementClass(last));
    if (last.type === "damage") node?.classList.add("hit");
    if (entries.some((row) => row.arts)) {
      root.classList.add("arts-flash");
      const burst = h("div", { class: "arts-burst", id: "arts-burst", text: "Arts" });
      root.querySelector(".field-wrap").append(burst);
      setTimeout(() => {
        root.classList.remove("arts-flash");
        burst.remove();
      }, 700);
    }
    log.textContent = entries.map(describe).filter(Boolean).join("  ") || log.textContent;
  }

  function elementClass() {
    return "damage";
  }

  function act(action) {
    if (busy || battle.over || auto) return;
    const actor = currentActor();
    if (!actor) return;
    if (action === "arts" && actor.unit.gauge < 100) return;
    busy = true;
    const entries = performAction(battle, actor.unit, action, action === "skill" && actor.unit.role === "healer" ? lowestHurt() : target);
    afterAction(entries);
  }

  function lowestHurt() {
    let best = 0;
    let ratio = 2;
    battle.allies.forEach((unit, index) => {
      if (unit.hp <= 0) return;
      const r = unit.hp / unit.hpMax;
      if (r < ratio) { ratio = r; best = index; }
    });
    return best;
  }

  function afterAction(entries) {
    showLog(entries);
    if (battle.over) {
      renderUnits();
      renderCommands();
      busy = false;
      return;
    }
    const rows = livingAllies();
    cursor = (cursor + 1) % Math.max(1, rows.length);
    if (cursor === 0) {
      const enemyLog = enemyTurn(battle);
      const endLog = endRound(battle);
      showLog([...enemyLog, ...endLog]);
    }
    renderUnits();
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
      const entries = performAction(battle, actor.unit, choice.action, choice.action === "skill" && actor.unit.role === "healer" ? choice.target : choice.target);
      afterAction(entries);
    }, delay());
  }

  function toggleAuto() {
    auto = !auto;
    renderCommands();
    if (auto) scheduleAuto();
    else clearTimeout(timer);
  }

  function shutdown(done) {
    stopped = true;
    clearTimeout(timer);
    clearInterval(idle);
    done();
  }

  const idle = setInterval(() => {
    frame = (frame + 1) % 6;
    root.querySelectorAll("canvas[data-monster]").forEach((canvas) => {
      const unit = battle.enemies.find((row) => row.id === canvas.dataset.unit);
      if (unit) paintMonster(canvas, unit, frame);
    });
    root.querySelectorAll("canvas[data-sprite]").forEach((canvas) => {
      const id = canvas.dataset.sprite;
      if (!id || !options.paintUnit) return;
      options.paintUnit(canvas, id, frame, 2);
    });
  }, speed === 2 ? 120 : 180);

  renderUnits();
  renderCommands();
  log.textContent = `${map.name} · ${options.title}`;
  return { battle };
}

export function advantageText(attack, defense) {
  const mod = elementMod(attack, defense);
  if (mod > 1) return "Advantage";
  if (mod < 1) return "Resist";
  return "";
}
