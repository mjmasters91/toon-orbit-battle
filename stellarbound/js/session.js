import { EFFECTS } from "./elements.js";
import { BY_ID, MATCH } from "./roster.js";
import {
  beginTurn,
  chooseAiAction,
  commitAction,
  createSides,
  endOfTurn,
  pickReady,
  planAction,
  secondsUntilReady,
  tickAtb,
  winnerOf,
} from "./rules.js";

function unitName(units, uid) {
  return units.find((unit) => unit.uid === uid)?.name ?? "Someone";
}

export function describeResolution(units, actor, skill, events) {
  const lines = [`${actor.name} uses ${skill.name}.`];
  if (skill.multiplier > 0 && skill.target === "enemy") {
    const hit = events.find((event) => event.kind === "damage");
    if (hit) {
      const tags = [
        hit.relation === "advantage" ? "favored" : "",
        hit.relation === "disadvantage" ? "unfavored" : "",
        hit.crit ? "critical" : "",
        hit.glance ? "glancing" : "",
      ].filter(Boolean);
      lines.push(`${unitName(units, hit.uid)} takes ${hit.amount}${tags.length ? ` (${tags.join(", ")})` : ""}.`);
    }
  } else if (skill.multiplier > 0 && skill.target === "enemies") {
    const hits = events.filter((event) => event.kind === "damage");
    const total = hits.reduce((sum, event) => sum + event.amount, 0);
    if (hits.length) lines.push(`The blast lands for ${total} total.`);
  }

  if (skill.heal > 0 && skill.target === "allies") {
    const total = events.filter((event) => event.kind === "heal").reduce((sum, event) => sum + event.amount, 0);
    if (total > 0) lines.push(`${skill.name} restores ${total} across the line.`);
  } else {
    for (const event of events) {
      if (event.kind === "heal" && event.amount > 0) {
        lines.push(`${unitName(units, event.uid)} regains ${event.amount}.`);
      }
    }
  }

  for (const event of events) {
    if (event.kind === "damage" && event.ko) lines.push(`${unitName(units, event.uid)} falls.`);
    if (event.kind === "effect") {
      const meta = EFFECTS[event.effect];
      const verb = meta?.helpful ? "gains" : "suffers";
      lines.push(`${unitName(units, event.uid)} ${verb} ${meta?.name ?? event.effect}.`);
    }
    if (event.kind === "resist") lines.push(`${unitName(units, event.uid)} resists.`);
  }
  return lines;
}

export class BattleSession {
  constructor(match = MATCH, rng = Math.random, byId = BY_ID) {
    this.match = match;
    this.rng = rng;
    this.byId = byId;
    this.rate = 2;
    this.auto = false;
    this.log = [];
    this.actionCount = 0;
    this.winner = null;
    this.phase = "tick";
    this.activeUid = null;
    this.pending = null;
    this.enrageLogged = false;
    this.units = createSides(match, byId);
  }

  reset() {
    const auto = this.auto;
    const rate = this.rate;
    this.auto = auto;
    this.rate = rate;
    this.log = [];
    this.actionCount = 0;
    this.winner = null;
    this.phase = "tick";
    this.activeUid = null;
    this.pending = null;
    this.enrageLogged = false;
    this.units = createSides(this.match, this.byId);
    this.auto = auto;
  }

  enrageAmp() {
    if (this.actionCount < 46) return 1;
    return 1 + (this.actionCount - 46) * 0.06;
  }

  applyHeat() {
    const amp = this.enrageAmp();
    for (const unit of this.units) unit.enrage = amp;
    if (amp > 1 && !this.enrageLogged) {
      this.enrageLogged = true;
      this.pushLog(["The starlight burns hotter."]);
    }
  }

  unit(uid) {
    return this.units.find((unit) => unit.uid === uid) || null;
  }

  active() {
    return this.unit(this.activeUid);
  }

  pushLog(lines) {
    for (const line of lines) this.log.push(line);
    if (this.log.length > 10) this.log.splice(0, this.log.length - 10);
  }

  judgeByRemaining() {
    const score = (team) =>
      this.units.filter((unit) => unit.team === team).reduce((sum, unit) => sum + unit.hp / unit.maxHp, 0);
    return score("player") >= score("enemy") ? "player" : "enemy";
  }

  update(dt) {
    if (this.phase !== "tick") return null;
    let actor = pickReady(this.units);
    if (!actor) {
      tickAtb(this.units, dt, this.rate);
      actor = pickReady(this.units);
      if (!actor) return null;
    }
    if (this.actionCount >= 100) {
      this.winner = this.judgeByRemaining();
      this.phase = "end";
      this.pushLog(["The stars call the bout."]);
      return { type: "end", winner: this.winner };
    }
    const opened = beginTurn(actor);
    this.actionCount += 1;
    this.applyHeat();
    this.activeUid = actor.uid;
    if (!actor.alive) {
      this.phase = "tick";
      this.activeUid = null;
      return null;
    }
    if (opened.stunned) {
      this.phase = "busy";
      this.pending = { kind: "stun", actorUid: actor.uid, applied: true, fresh: new Set(), winner: null };
      this.pushLog([`${actor.name} is stunned and loses the turn.`]);
      return { type: "stun", actor };
    }
    if (actor.team === "player" && !this.auto) {
      this.phase = "input";
      return { type: "input", actor };
    }
    return this.launchAi(actor);
  }

  launchAi(actor = this.active()) {
    if (!actor) return null;
    const choice = chooseAiAction(actor, this.units, this.rng);
    return this.launch(actor, choice.skillIndex, choice.targetUid);
  }

  submit(skillIndex, targetUid) {
    if (this.phase !== "input") return { ok: false, reason: "It is not your turn." };
    const actor = this.active();
    return this.launch(actor, skillIndex, targetUid);
  }

  launch(actor, skillIndex, targetUid) {
    let plan = planAction(this.units, actor.uid, skillIndex, targetUid, this.rng);
    if (!plan.ok && skillIndex !== 0) {
      const foe = this.units.find((unit) => unit.alive && unit.team !== actor.team);
      plan = planAction(this.units, actor.uid, 0, foe?.uid ?? null, this.rng);
    }
    if (!plan.ok) return plan;
    this.phase = "busy";
    this.activeUid = actor.uid;
    this.pending = {
      kind: "skill",
      actorUid: actor.uid,
      skillIndex,
      skill: plan.skill,
      events: plan.events,
      targets: plan.targets,
      applied: false,
      fresh: null,
      winner: null,
    };
    return { ok: true, type: "skill", actor, skill: plan.skill, events: plan.events, targets: plan.targets };
  }

  applyPending() {
    if (!this.pending || this.pending.applied) return this.pending;
    const actor = this.unit(this.pending.actorUid);
    this.pending.fresh = commitAction(this.units, this.pending.actorUid, this.pending.events);
    this.pending.applied = true;
    this.pending.winner = winnerOf(this.units);
    if (actor && this.pending.skill) {
      this.pushLog(describeResolution(this.units, actor, this.pending.skill, this.pending.events));
    }
    return this.pending;
  }

  finishBusy() {
    const pending = this.pending;
    if (!pending) {
      this.phase = this.winner ? "end" : "tick";
      return this.winner;
    }
    if (pending.kind === "skill" && !pending.applied) this.applyPending();
    const actor = this.unit(pending.actorUid);
    if (pending.kind === "skill" && actor?.alive) endOfTurn(actor, pending.fresh || new Set());
    const winner = pending.winner || winnerOf(this.units);
    this.pending = null;
    this.activeUid = null;
    if (winner) {
      this.winner = winner;
      this.phase = "end";
      return winner;
    }
    this.phase = "tick";
    return null;
  }
}

export function autoplay(match = MATCH, rng = Math.random, maxSteps = 5000) {
  const session = new BattleSession(match, rng);
  session.auto = true;
  let guard = 0;
  while (session.phase !== "end" && guard < maxSteps) {
    guard += 1;
    if (session.phase === "busy") {
      session.applyPending();
      session.finishBusy();
      continue;
    }
    const signal = session.update(0);
    if (signal) continue;
    const gap = secondsUntilReady(session.units, session.rate);
    if (!Number.isFinite(gap)) break;
    session.update(gap + 1e-4);
  }
  return session;
}
