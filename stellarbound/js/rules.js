import { EFFECTS, elementMultiplier, elementRelation } from "./elements.js";

export const DAMAGE_SCALE = 2.12;
export const DEF_CONSTANT = 310;
export const ATB_MAX = 1000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function effectiveStat(unit, stat) {
  let value = unit[stat];
  for (const buff of unit.buffs) {
    const meta = EFFECTS[buff.id];
    if (meta?.stat === stat) value *= meta.mult;
  }
  return value;
}

export function isStunned(unit) {
  return unit.buffs.some((buff) => buff.id === "stun");
}

export function createUnit(def, team, slot, aura = { hp: 1, atk: 1 }) {
  const hp = Math.round(def.hp * (aura.hp ?? 1));
  const atk = Math.round(def.atk * (aura.atk ?? 1));
  return {
    uid: `${team}-${def.id}`,
    id: def.id,
    name: def.name,
    element: def.element,
    epithet: def.epithet,
    role: def.role,
    team,
    slot,
    maxHp: hp,
    hp,
    atk,
    def: def.def,
    spd: def.spd,
    crit: def.crit ?? 0.15,
    skills: def.skills.map((skill) => ({
      name: skill.name,
      blurb: skill.blurb,
      target: skill.target,
      multiplier: skill.multiplier || 0,
      heal: skill.heal || 0,
      cooldown: skill.cooldown || 0,
      effects: (skill.effects || []).map((effect) => ({ ...effect })),
      cdLeft: 0,
    })),
    buffs: [],
    atb: Math.round(def.spd * 3.15),
    alive: true,
    leader: slot === 0 ? def.leader || null : null,
  };
}

export function createSides(match, byId) {
  const playerDefs = match.player.map((id) => byId[id]);
  const enemyDefs = match.enemy.map((id) => byId[id]);
  const playerAura = playerDefs[0].leader || { hp: 1, atk: 1 };
  const enemyAura = enemyDefs[0].leader || { hp: 1, atk: 1 };
  return [
    ...playerDefs.map((def, slot) => createUnit(def, "player", slot, playerAura)),
    ...enemyDefs.map((def, slot) => createUnit(def, "enemy", slot, enemyAura)),
  ];
}

export function tickAtb(units, dt, rate = 1) {
  for (const unit of units) {
    if (!unit.alive) continue;
    unit.atb += effectiveStat(unit, "spd") * dt * rate;
  }
}

export function secondsUntilReady(units, rate = 1) {
  let best = Infinity;
  for (const unit of units) {
    if (!unit.alive || unit.atb >= ATB_MAX) continue;
    const speed = Math.max(1, effectiveStat(unit, "spd") * rate);
    best = Math.min(best, (ATB_MAX - unit.atb) / speed);
  }
  return best;
}

export function pickReady(units) {
  let best = null;
  for (const unit of units) {
    if (!unit.alive || unit.atb < ATB_MAX) continue;
    if (
      !best ||
      unit.atb > best.atb ||
      (unit.atb === best.atb && unit.spd > best.spd) ||
      (unit.atb === best.atb && unit.spd === best.spd && unit.uid < best.uid)
    ) {
      best = unit;
    }
  }
  return best;
}

export function endOfTurn(unit, fresh = new Set()) {
  for (const buff of unit.buffs) {
    if (fresh.has(buff)) continue;
    buff.turns -= 1;
  }
  unit.buffs = unit.buffs.filter((buff) => buff.turns > 0);
}

/** Spend the gauge, cool skills down, and skip the action if stunned. */
export function beginTurn(unit) {
  unit.atb = Math.max(0, unit.atb - ATB_MAX);
  for (const skill of unit.skills) {
    if (skill.cdLeft > 0) skill.cdLeft -= 1;
  }
  const stunned = isStunned(unit);
  if (stunned) endOfTurn(unit);
  return { stunned };
}

export function computeDamage(attacker, defender, multiplier, rng) {
  const atk = effectiveStat(attacker, "atk");
  const def = Math.max(0, effectiveStat(defender, "def"));
  const relation = elementRelation(attacker.element, defender.element);
  const raw = atk * multiplier * DAMAGE_SCALE;
  const mitigation = def / (def + DEF_CONSTANT);
  let amount = raw * (1 - mitigation) * elementMultiplier(relation) * (attacker.enrage || 1);
  let crit = false;
  let glance = false;
  if (relation === "disadvantage" && rng() < 0.45) {
    glance = true;
    amount *= 0.55;
  } else if (rng() < attacker.crit) {
    crit = true;
    amount *= 1.5;
  }
  amount *= 0.93 + rng() * 0.14;
  return {
    amount: Math.max(1, Math.round(amount)),
    crit,
    glance,
    relation,
  };
}

export function estimateDamage(attacker, defender, multiplier) {
  const atk = effectiveStat(attacker, "atk");
  const def = Math.max(0, effectiveStat(defender, "def"));
  const relation = elementRelation(attacker.element, defender.element);
  const raw = atk * multiplier * DAMAGE_SCALE;
  const mitigation = def / (def + DEF_CONSTANT);
  return raw * (1 - mitigation) * elementMultiplier(relation) * (attacker.enrage || 1);
}

function living(units, team) {
  return units.filter((unit) => unit.alive && unit.team === team);
}

export function planAction(units, actorUid, skillIndex, targetUid, rng) {
  const actor = units.find((unit) => unit.uid === actorUid);
  if (!actor?.alive) return { ok: false, reason: "That constellation has fallen." };
  const skill = actor.skills[skillIndex];
  if (!skill) return { ok: false, reason: "Unknown skill." };
  if (skill.cdLeft > 0) return { ok: false, reason: "That skill is still cooling." };

  const allies = living(units, actor.team);
  const enemies = living(units, actor.team === "player" ? "enemy" : "player");
  let list = [];
  if (skill.target === "enemy") {
    const target = enemies.find((unit) => unit.uid === targetUid);
    if (!target) return { ok: false, reason: "Choose a living foe." };
    list = [target];
  } else if (skill.target === "ally") {
    const target = allies.find((unit) => unit.uid === targetUid);
    if (!target) return { ok: false, reason: "Choose a living ally." };
    list = [target];
  } else if (skill.target === "enemies") {
    if (!enemies.length) return { ok: false, reason: "No foes remain." };
    list = enemies.slice();
  } else if (skill.target === "allies") {
    list = allies.slice();
  } else if (skill.target === "self") {
    list = [actor];
  } else {
    return { ok: false, reason: "That skill has no target." };
  }

  const events = [];
  if (skill.multiplier > 0) {
    for (const target of list) {
      const hit = computeDamage(actor, target, skill.multiplier, rng);
      events.push({
        kind: "damage",
        uid: target.uid,
        amount: hit.amount,
        crit: hit.crit,
        glance: hit.glance,
        relation: hit.relation,
        ko: target.hp - hit.amount <= 0,
      });
    }
  }
  if (skill.heal > 0) {
    for (const target of list) {
      const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * skill.heal));
      events.push({ kind: "heal", uid: target.uid, amount });
    }
  }
  for (const effect of skill.effects || []) {
    let pool = list;
    if (effect.to === "self") pool = [actor];
    else if (effect.to === "allies") pool = allies;
    else if (effect.to === "enemies") pool = enemies;
    for (const target of pool) {
      if (!target.alive) continue;
      const chance = effect.chance ?? 1;
      if (chance < 1 && rng() >= chance) {
        events.push({ kind: "resist", uid: target.uid, effect: effect.id });
        continue;
      }
      events.push({ kind: "effect", uid: target.uid, effect: effect.id, turns: effect.turns });
    }
  }
  if (skill.cooldown > 0) {
    events.push({ kind: "cooldown", skillIndex, cooldown: skill.cooldown });
  }
  return { ok: true, skill, events, targets: list.map((unit) => unit.uid) };
}

export function commitAction(units, actorUid, events) {
  const actor = units.find((unit) => unit.uid === actorUid);
  const fresh = new Set();
  for (const event of events) {
    if (event.kind === "damage") {
      const target = units.find((unit) => unit.uid === event.uid);
      if (!target?.alive) continue;
      target.hp = Math.max(0, target.hp - event.amount);
      if (target.hp === 0) target.alive = false;
    } else if (event.kind === "heal") {
      const target = units.find((unit) => unit.uid === event.uid);
      if (!target?.alive || event.amount <= 0) continue;
      target.hp = Math.min(target.maxHp, target.hp + event.amount);
    } else if (event.kind === "effect") {
      const target = units.find((unit) => unit.uid === event.uid);
      if (!target?.alive) continue;
      let buff = target.buffs.find((item) => item.id === event.effect);
      if (buff) buff.turns = event.turns;
      else {
        buff = { id: event.effect, turns: event.turns };
        target.buffs.push(buff);
      }
      if (target === actor) fresh.add(buff);
    } else if (event.kind === "cooldown" && actor) {
      actor.skills[event.skillIndex].cdLeft = event.cooldown;
    }
  }
  return fresh;
}

export function winnerOf(units) {
  const player = units.some((unit) => unit.team === "player" && unit.alive);
  const enemy = units.some((unit) => unit.team === "enemy" && unit.alive);
  if (player && enemy) return null;
  if (player) return "player";
  if (enemy) return "enemy";
  return "draw";
}

function effectBonus(skill, actor, allies, enemies, target) {
  let bonus = 0;
  for (const effect of skill.effects || []) {
    const pool =
      effect.to === "self"
        ? [actor]
        : effect.to === "allies"
          ? allies
          : effect.to === "enemies"
            ? enemies
            : target
              ? [target]
              : skill.target === "enemies"
                ? enemies
                : skill.target === "allies"
                  ? allies
                  : [actor];
    const fresh = pool.filter((unit) => unit.alive && !unit.buffs.some((buff) => buff.id === effect.id));
    const weight = effect.id === "stun" ? 120 : effect.id.endsWith("down") ? 78 : 62;
    bonus += fresh.length * weight * (effect.chance ?? 1);
  }
  return bonus;
}

function healScore(skill, actor, allies, target) {
  if (!skill.heal) return 0;
  const gained = (unit) => Math.min(unit.maxHp - unit.hp, Math.round(unit.maxHp * skill.heal));
  if (skill.target === "allies") {
    return allies.reduce((sum, unit) => sum + gained(unit), 0) * 0.82;
  }
  if (skill.target === "ally") {
    return gained(target || actor) * 1.05;
  }
  return gained(actor) * 1.05;
}

function damageScore(actor, skill, target) {
  if (!skill.multiplier || !target) return 0;
  let score = estimateDamage(actor, target, skill.multiplier);
  if (score >= target.hp) score += 230;
  else score += (1 - target.hp / target.maxHp) * 70;
  const relation = elementRelation(actor.element, target.element);
  if (relation === "advantage") score += 36;
  if (relation === "disadvantage") score -= 28;
  return score;
}

export function chooseAiAction(actor, units, rng = Math.random) {
  const allies = living(units, actor.team);
  const enemies = living(units, actor.team === "player" ? "enemy" : "player");
  let best = { score: -Infinity, skillIndex: 0, targetUid: enemies[0]?.uid ?? allies[0]?.uid ?? null };

  actor.skills.forEach((skill, skillIndex) => {
    if (skill.cdLeft > 0) return;
    const consider = (target) => {
      let score = 0;
      if (skill.multiplier > 0) {
        if (skill.target === "enemies") {
          for (const foe of enemies) score += damageScore(actor, skill, foe);
        } else if (target && target.team !== actor.team) {
          score += damageScore(actor, skill, target);
        }
      }
      score += healScore(skill, actor, allies, target);
      score += effectBonus(skill, actor, allies, enemies, target);
      score *= 0.97 + rng() * 0.06;
      if (score > best.score) {
        best = {
          score,
          skillIndex,
          targetUid: skill.target === "enemy" || skill.target === "ally" ? target?.uid ?? null : null,
        };
      }
    };

    if (skill.target === "enemy") enemies.forEach(consider);
    else if (skill.target === "ally") allies.forEach(consider);
    else consider(null);
  });

  if (!Number.isFinite(best.score)) {
    return { skillIndex: 0, targetUid: enemies[0]?.uid ?? null };
  }
  return { skillIndex: best.skillIndex, targetUid: best.targetUid };
}
