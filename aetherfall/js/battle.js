/** Turn-based story combat. Party versus waves. No DOM. */

const BEATS = { fire: "wind", wind: "earth", earth: "water", water: "fire" };

export function elementMod(attack, defense) {
  if (!attack || !defense || attack === defense) return 1;
  if (BEATS[attack] === defense) return 1.3;
  if (BEATS[defense] === attack) return 0.75;
  if ((attack === "light" && defense === "dark") || (attack === "dark" && defense === "light")) return 1.3;
  return 1;
}

function blankStatus() {
  return { atk: 0, def: 0, mag: 0, burn: 0, regen: 0 };
}

export function strikeDamage(attacker, defender, multiplier, element) {
  const atk = attacker.atk * (1 + (attacker.status?.atk || 0));
  const def = defender.def * (1 + (defender.status?.def || 0));
  const raw = atk * multiplier * elementMod(element || attacker.element, defender.element);
  return Math.max(1, Math.round(raw - def * 0.22));
}

export function healAmount(actor, multiplier = 1.4) {
  const mag = actor.mag * (1 + (actor.status?.mag || 0));
  return Math.max(1, Math.round(mag * multiplier));
}

function living(list) {
  return list.map((unit, index) => ({ unit, index })).filter((row) => row.unit.hp > 0);
}

function lowest(list) {
  return living(list).sort((a, b) => a.unit.hp / a.unit.hpMax - b.unit.hp / b.unit.hpMax)[0];
}

function tickStatus(unit, log) {
  if (unit.hp <= 0) return;
  if (unit.status.burn > 0) {
    const dmg = Math.max(1, Math.round(unit.hpMax * 0.06));
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.status.burn -= 1;
    log.push({ type: "burn", id: unit.id, amount: dmg });
  }
  if (unit.status.regen > 0 && unit.hp > 0) {
    const heal = Math.max(1, Math.round(unit.hpMax * 0.05));
    unit.hp = Math.min(unit.hpMax, unit.hp + heal);
    unit.status.regen -= 1;
    log.push({ type: "regen", id: unit.id, amount: heal });
  }
  if (unit.status.atk > 0) unit.status.atk = Math.max(0, unit.status.atk - 0.05);
  if (unit.status.def > 0) unit.status.def = Math.max(0, unit.status.def - 0.05);
  if (unit.status.mag > 0) unit.status.mag = Math.max(0, unit.status.mag - 0.05);
}

export function createBattle(allies, encounter) {
  return {
    allies: allies.map((ally) => ({
      ...ally,
      hp: ally.hp,
      hpMax: ally.hp,
      gauge: 0,
      status: blankStatus(),
      side: "ally",
    })),
    waves: encounter.waves.map((wave) => wave.map((foe) => ({
      ...foe,
      hp: foe.hp,
      hpMax: foe.hpMax || foe.hp,
      gauge: 0,
      status: blankStatus(),
      side: "enemy",
      role: "attacker",
    }))),
    wave: 0,
    enemies: [],
    round: 1,
    turns: 0,
    deaths: 0,
    log: [],
    over: null,
    difficulty: encounter.difficulty,
    mapIndex: encounter.mapIndex,
    stage: encounter.stage,
  };
}

function loadWave(battle) {
  const wave = battle.waves[battle.wave];
  if (!wave) {
    battle.over = "win";
    return;
  }
  battle.enemies = wave.map((foe) => ({ ...foe, status: blankStatus(), hp: foe.hpMax }));
}

export function beginBattle(battle) {
  loadWave(battle);
  return battle;
}

function gainGauge(unit, amount) {
  if (unit.hp <= 0) return;
  unit.gauge = Math.min(100, unit.gauge + amount);
}

function hurt(battle, defender, amount, log) {
  defender.hp = Math.max(0, defender.hp - amount);
  gainGauge(defender, 16);
  log.push({ type: "damage", id: defender.id, amount, hp: defender.hp });
  if (defender.hp === 0 && defender.side === "ally") battle.deaths += 1;
}

function pickEnemyTarget(battle, element) {
  const open = living(battle.enemies);
  if (!open.length) return null;
  const adv = open.find((row) => elementMod(element, row.unit.element) > 1);
  if (adv) return adv.index;
  return lowest(battle.enemies).index;
}

function pickAllyTarget(battle) {
  const weak = lowest(battle.allies);
  return weak ? weak.index : 0;
}

function sides(battle, actor) {
  const friends = actor.side === "ally" ? battle.allies : battle.enemies;
  const foes = actor.side === "ally" ? battle.enemies : battle.allies;
  return { friends, foes };
}

export function performAction(battle, actor, action, targetIndex) {
  const log = [];
  if (!actor || actor.hp <= 0 || battle.over) return log;
  const arts = action === "arts" && actor.gauge >= 100;
  const skill = action === "skill" || arts;
  const mul = arts ? 2.5 : action === "skill" ? 1.65 : 1;
  const role = actor.role;
  const { friends, foes } = sides(battle, actor);

  if (role === "healer" && skill) {
    const ally = friends[targetIndex] && friends[targetIndex].hp > 0 ? friends[targetIndex] : lowest(friends)?.unit;
    if (ally) {
      const amount = healAmount(actor, arts ? 2.4 : 1.5);
      ally.hp = Math.min(ally.hpMax, ally.hp + amount);
      ally.status.regen = arts ? 3 : 1;
      log.push({ type: "heal", id: ally.id, amount, actor: actor.id, arts });
    }
  } else if (role === "support" && skill) {
    for (const ally of friends) {
      if (ally.hp <= 0) continue;
      ally.status.atk = Math.min(0.45, ally.status.atk + (arts ? 0.3 : 0.18));
      ally.status.mag = Math.min(0.45, ally.status.mag + (arts ? 0.3 : 0.18));
    }
    log.push({ type: "buff", actor: actor.id, arts });
  } else if (role === "tank" && skill) {
    actor.status.def = Math.min(0.6, actor.status.def + (arts ? 0.4 : 0.25));
    const foe = foes[targetIndex] && foes[targetIndex].hp > 0 ? foes[targetIndex] : lowest(foes)?.unit;
    if (foe) {
      const amount = strikeDamage(actor, foe, mul * 0.85, actor.element);
      hurt(battle, foe, amount, log);
    }
    log.push({ type: "guard", actor: actor.id, arts });
  } else {
    const foe = foes[targetIndex] && foes[targetIndex].hp > 0 ? foes[targetIndex] : lowest(foes)?.unit;
    if (foe) {
      const amount = strikeDamage(actor, foe, mul, actor.element);
      hurt(battle, foe, amount, log);
      if (skill && (actor.element === "fire" || (actor.side === "enemy" && battle.difficulty !== "normal"))) {
        foe.status.burn = arts ? 3 : 2;
        log.push({ type: "inflict", id: foe.id, status: "burn" });
      }
    }
  }

  if (arts) {
    actor.gauge = 0;
    for (const row of log) row.arts = true;
    log.push({ type: "arts", actor: actor.id, arts: true });
  } else gainGauge(actor, skill ? 28 : 52);
  battle.log.push(...log);
  return log;
}

function enemiesAlive(battle) {
  return battle.enemies.some((unit) => unit.hp > 0);
}

function alliesAlive(battle) {
  return battle.allies.some((unit) => unit.hp > 0);
}

export function enemyTurn(battle, rng = Math.random) {
  const logs = [];
  for (const foe of battle.enemies) {
    if (foe.hp <= 0 || battle.over) continue;
    const target = pickAllyTarget(battle);
    const special = battle.difficulty !== "normal" && rng() < (battle.difficulty === "nightmare" ? 0.55 : 0.3);
    const action = special ? "skill" : "attack";
    foe.role = special && battle.difficulty === "nightmare" && rng() < 0.4 ? "support" : "attacker";
    logs.push(...performAction(battle, foe, action, target));
    if (!alliesAlive(battle)) {
      battle.over = "lose";
      break;
    }
  }
  return logs;
}

export function endRound(battle) {
  const log = [];
  battle.turns += 1;
  for (const unit of [...battle.allies, ...battle.enemies]) tickStatus(unit, log);
  if (!alliesAlive(battle)) battle.over = "lose";
  else if (!enemiesAlive(battle)) {
    battle.wave += 1;
    if (battle.wave >= battle.waves.length) battle.over = "win";
    else loadWave(battle);
  }
  if (!battle.over) battle.round += 1;
  battle.log.push(...log);
  return log;
}

export function openBattle(allies, encounter) {
  const battle = createBattle(allies, encounter);
  beginBattle(battle);
  return battle;
}

export function autoChoice(battle, actor) {
  if (actor.gauge >= 100) return { action: "arts", target: pickEnemyTarget(battle, actor.element) ?? 0 };
  if (actor.role === "healer") {
    const hurtAlly = lowest(battle.allies);
    if (hurtAlly && hurtAlly.unit.hp < hurtAlly.unit.hpMax * 0.75) {
      return { action: "skill", target: hurtAlly.index };
    }
  }
  if (actor.role === "support" || actor.role === "tank") return { action: "skill", target: pickEnemyTarget(battle, actor.element) ?? 0 };
  return { action: "attack", target: pickEnemyTarget(battle, actor.element) ?? 0 };
}

export function snapshot(battle) {
  return {
    round: battle.round,
    turns: battle.turns,
    deaths: battle.deaths,
    wave: battle.wave,
    over: battle.over,
    allies: battle.allies.map((unit) => ({ id: unit.id, name: unit.name, hp: unit.hp, hpMax: unit.hpMax, gauge: unit.gauge, element: unit.element })),
    enemies: battle.enemies.map((unit) => ({ id: unit.id, name: unit.name, hp: unit.hp, hpMax: unit.hpMax, boss: unit.boss, element: unit.element, kind: unit.kind })),
  };
}
