import { EFFECTS, ELEMENT_INFO } from "./elements.js";

const TARGET_LABEL = {
  enemy: "One foe",
  enemies: "All foes",
  ally: "One ally",
  allies: "All allies",
  self: "Self",
};

export function createUi() {
  const $ = (id) => document.getElementById(id);
  const els = {
    title: $("title-screen"),
    hud: $("battle-hud"),
    banner: $("banner"),
    track: $("turn-track"),
    log: $("log"),
    dock: $("dock"),
    actor: $("actor-line"),
    skills: $("skills"),
    hint: $("hint"),
    auto: $("auto"),
    speed: $("speed"),
    mute: $("mute"),
    result: $("result"),
    resultTitle: $("result-title"),
    resultBody: $("result-body"),
    leadPlayer: $("lead-player"),
    leadEnemy: $("lead-enemy"),
    featured: $("featured"),
    floaters: $("floaters"),
    plates: $("plates"),
  };

  const api = {
    onPlay: null,
    onSkill: null,
    onPreview: null,
    onAuto: null,
    onSpeed: null,
    onMute: null,
    onRematch: null,
    onTitle: null,

    setMode(mode) {
      document.body.dataset.mode = mode;
      const battling = mode === "battle" || mode === "deploy" || mode === "result";
      els.title.hidden = battling;
      els.hud.hidden = !battling;
      if (mode !== "result") els.result.hidden = true;
    },

    setFeatured(monster) {
      if (!monster) return;
      const element = ELEMENT_INFO[monster.element]?.name ?? monster.element;
      els.featured.textContent = `${monster.name} · ${element} · ${monster.epithet}`;
    },

    setBanner(text) {
      els.banner.textContent = text || "";
    },

    setLeaders(playerLine, enemyLine) {
      els.leadPlayer.textContent = playerLine;
      els.leadEnemy.textContent = enemyLine;
    },

    setLog(lines) {
      els.log.replaceChildren();
      for (const line of lines.slice(-5)) {
        const p = document.createElement("p");
        p.textContent = line;
        els.log.appendChild(p);
      }
    },

    setTurn(units, activeUid) {
      els.track.querySelectorAll(".mark").forEach((node) => node.remove());
      for (const unit of units) {
        if (!unit.alive && unit.uid !== activeUid) continue;
        const mark = document.createElement("div");
        mark.className = `mark team-${unit.team} el-${unit.element}${unit.uid === activeUid ? " is-acting" : ""}`;
        mark.style.left = `${Math.max(3, Math.min(97, unit.atb / 10))}%`;
        mark.innerHTML = `<span class="gem"></span>`;
        mark.title = unit.name;
        els.track.appendChild(mark);
      }
    },

    showDock(actor) {
      els.dock.hidden = false;
      els.dock.style.setProperty("--el", ELEMENT_INFO[actor.element].hex);
      const element = ELEMENT_INFO[actor.element].name;
      els.actor.textContent = `${actor.name} · ${element} · ${actor.epithet}`;
      els.skills.replaceChildren();
      actor.skills.forEach((skill, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "skill";
        button.disabled = skill.cdLeft > 0;
        button.innerHTML = `<span class="skill-top"><b></b><em></em></span><small></small>`;
        button.querySelector("b").textContent = skill.name;
        button.querySelector("em").textContent = skill.cdLeft ? String(skill.cdLeft) : "";
        button.querySelector("small").textContent = TARGET_LABEL[skill.target] || "";
        button.title = skill.blurb;
        button.addEventListener("click", () => api.onSkill?.(index));
        button.addEventListener("pointerenter", () => api.onPreview?.(index));
        button.addEventListener("focus", () => api.onPreview?.(index));
        els.skills.appendChild(button);
      });
    },

    setArmed(index) {
      [...els.skills.children].forEach((button, buttonIndex) => {
        button.classList.toggle("is-armed", buttonIndex === index);
      });
    },

    setHint(text) {
      els.hint.textContent = text || "";
    },

    hideDock() {
      els.dock.hidden = true;
      els.hint.textContent = "";
    },

    setAuto(on) {
      els.auto.setAttribute("aria-pressed", on ? "true" : "false");
      els.auto.classList.toggle("is-on", on);
      els.auto.textContent = on ? "Auto on" : "Auto";
    },

    setSpeed(mult) {
      els.speed.textContent = `${mult}×`;
    },

    setMute(muted) {
      els.mute.textContent = muted ? "Sound off" : "Sound";
      els.mute.setAttribute("aria-pressed", muted ? "true" : "false");
    },

    showResult(winner) {
      els.result.hidden = false;
      if (winner === "player") {
        els.resultTitle.textContent = "The ring is yours";
        els.resultBody.textContent = "All four rivals are down. The stars hold your names a little longer.";
      } else {
        els.resultTitle.textContent = "The ring goes dark";
        els.resultBody.textContent = "Your four have fallen. The night keeps the field.";
      }
    },

    hideResult() {
      els.result.hidden = true;
    },

    spawnFloater(x, y, text, kind) {
      const el = document.createElement("div");
      el.className = `floater ${kind || ""}`;
      const tag = kind === "crit" ? "CRIT" : kind === "glance" ? "GLANCE" : "";
      el.innerHTML = "<b></b>";
      el.querySelector("b").textContent = text;
      if (tag) {
        const small = document.createElement("small");
        small.textContent = tag;
        el.appendChild(small);
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      els.floaters.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    },

    clearFloaters() {
      els.floaters.replaceChildren();
    },

    makePlate(unit) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `plate team-${unit.team} el-${unit.element}`;
      el.dataset.uid = unit.uid;
      el.innerHTML = `
        <span class="plate-top"><span class="diamond"></span><span class="plate-name"></span></span>
        <span class="bar"><span></span></span>
        <span class="hp-num"></span>
        <span class="icons"></span>
      `;
      els.plates.appendChild(el);
      return el;
    },

    clearPlates() {
      els.plates.replaceChildren();
    },

    updatePlate(el, unit, active, targetable) {
      el.querySelector(".plate-name").textContent = unit.name;
      const pct = Math.max(0, unit.hp / unit.maxHp);
      const fill = el.querySelector(".bar > span");
      fill.style.width = `${pct * 100}%`;
      fill.style.background = pct > 0.55 ? "#8ee0a2" : pct > 0.28 ? "#f0c36a" : "#e25b4a";
      el.querySelector(".hp-num").textContent = `${Math.ceil(unit.hp)} / ${unit.maxHp}`;
      const icons = el.querySelector(".icons");
      const signature = unit.buffs.map((buff) => buff.id).join(",");
      if (icons.dataset.sig !== signature) {
        icons.dataset.sig = signature;
        icons.replaceChildren();
        for (const buff of unit.buffs) {
          const meta = EFFECTS[buff.id];
          const chip = document.createElement("i");
          chip.className = meta?.helpful ? "up" : "down";
          chip.textContent = meta?.name ?? buff.id;
          icons.appendChild(chip);
        }
      }
      el.classList.toggle("is-active", active);
      el.classList.toggle("is-target", targetable);
      el.hidden = !unit.alive;
      el.style.cursor = targetable ? "pointer" : "default";
    },
  };

  $("play").addEventListener("click", () => api.onPlay?.());
  els.auto.addEventListener("click", () => api.onAuto?.());
  els.speed.addEventListener("click", () => api.onSpeed?.());
  els.mute.addEventListener("click", () => api.onMute?.());
  $("rematch").addEventListener("click", () => api.onRematch?.());
  $("return").addEventListener("click", () => api.onTitle?.());
  return api;
}
