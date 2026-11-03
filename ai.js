/* Toon Orbit Battle — computer opponent. Plays only from what it can see (never peeks at hidden cards). */
(function (root) {
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.TOB_ENGINE;
  const NEUTRAL = E.NEUTRAL;

  // Utility from the AI's ('o') point of view.
  function util(ev) {
    let u = ev.score.o - ev.score.p;
    if (ev.colorLead === 'o') u += 100; else if (ev.colorLead === 'p') u -= 100;
    // soft pull toward goal colors (cards still to come may complete a lead)
    ev.targets.forEach(c => { u += 2 * ((ev.counts.o[c] || 0) - (ev.counts.p[c] || 0)); });
    return u;
  }
  function perms(items, k, cb, pre = [], used = new Set()) {
    if (pre.length === k) return cb(pre);
    items.forEach((it, i) => { if (!used.has(i)) { used.add(i); pre.push(it); perms(items, k, cb, pre, used); pre.pop(); used.delete(i); } });
  }
  // st: {boards, shown, goals, silver, penalty}; slots: target slot indices; hand: AI's hand.
  function difficultyForRating(rating) {
    const n = rating | 0;
    if (n >= 1700) return 'champion';
    if (n >= 1550) return 'diamond';
    if (n >= 1400) return 'platinum';
    if (n >= 1250) return 'gold';
    if (n >= 1100) return 'silver';
    return 'bronze';
  }
  function jitterFor(level) {
    if (level === 'champion') return 0;
    if (level === 'diamond') return 0.15;
    if (level === 'platinum') return 0.4;
    if (level === 'silver') return 3;
    if (level === 'bronze') return 8;
    return 1.5;
  }
  function choosePlacement(st, hand, slots, level) {
    if (level === 'bronze') return hand.slice(0, Math.min(slots.length, hand.length));
    if (level === 'silver') return hand.slice().sort((a, b) => b.pts - a.pts).slice(0, Math.min(slots.length, hand.length));
    let best = null, bestU = -Infinity;
    const jitter = jitterFor(level);
    perms(hand, Math.min(slots.length, hand.length), pick => {
      const ob = st.boards.o.slice(), osh = st.shown.o.slice();
      slots.forEach((s, i) => { ob[s] = pick[i]; osh[s] = true; });
      const ev = E.evaluate({p: st.boards.p, o: ob}, {p: st.shown.p, o: osh}, {goals: st.goals, penalty: st.penalty});
      const u = util(ev) + Math.random() * jitter;
      if (u > bestU) { bestU = u; best = pick.slice(); }
    });
    return best;
  }
  // Discard weak cards: keep goal-color cards and cards whose powers combo with the board/hand.
  function chooseDiscards(hand, goals, board, level) {
    if (level === 'bronze') return [];
    if (level === 'silver') return hand.slice().sort((a, b) => a.pts - b.pts).slice(0, 1);
    const targets = E.targetColors(goals);
    const pool = hand.concat((board || []).filter(Boolean));
    const book = root.TOB_COMBOS;
    const ids = new Set(pool.map(o => o.id));
    const arches = new Set(pool.map(o => o.archetype).filter(Boolean));
    const combo = c => {
      if (c.powers.some(pw => {
        const f = (pw.cond && pw.cond.filter) || (pw.each && pw.each.filter) || pw.filter;
        return !f || pool.some(o => o !== c && E.matches(o, o.color, f));
      })) return true;
      if (!book) return false;
      if (book.sets.some(s => s.ids.includes(c.id) && s.ids.some(id => id !== c.id && ids.has(id)))) return true;
      return book.pairs.some(p => (c.archetype === p.a && arches.has(p.b)) || (c.archetype === p.b && arches.has(p.a)));
    };
    const dupChar = c => (board || []).some(o => o && o.char === c.char);
    const keepScore = c => c.pts + (targets.includes(c.color) ? 8 : 0) + (combo(c) ? 9 : 0) - (dupChar(c) ? 12 : 0);
    return hand.slice().sort((a, b) => keepScore(a) - keepScore(b)).filter(c => keepScore(c) < 7).slice(0, 2);
  }
  // Returns hand card to swap into the last slot, or null.
  function chooseSwap(st, hand) {
    const base = E.evaluate(st.boards, st.shown, {goals: st.goals, penalty: st.penalty});
    // the AI knows its own hidden last card, so evaluate with it visible on its side
    const withOwn = (card, pen) => {
      const ob = st.boards.o.slice(); ob[6] = card; const osh = st.shown.o.slice(); osh[6] = true;
      return util(E.evaluate({p: st.boards.p, o: ob}, {p: st.shown.p, o: osh}, {goals: st.goals, penalty: {p: st.penalty.p, o: pen}}));
    };
    const cur = withOwn(st.boards.o[6], 0);
    let best = null, bestU = cur + 3;
    hand.forEach(c => { const u = withOwn(c, E.SWAP_PENALTY); if (u > bestU) { bestU = u; best = c; } });
    return best;
  }
  function chooseSilver(st, level) {
    if (level === 'bronze' || level === 'silver') {
      const counts = {};
      (st.boards.o || []).forEach(card => { if (card && !E.NEUTRAL.has(card.color)) counts[card.color] = (counts[card.color] || 0) + 1; });
      return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'red';
    }
    let best = null, bestU = -Infinity;
    E.PLAYABLE_COLORS.forEach(c => {
      const shownO = st.shown.o.slice(); shownO[6] = true;
      const ev = E.evaluate(st.boards, {p: st.shown.p, o: shownO}, {goals: st.goals, penalty: st.penalty, silver: {p: st.silver.p, o: c}});
      const u = util(ev); if (u > bestU) { bestU = u; best = c; }
    });
    return best;
  }
  const api = {choosePlacement, chooseDiscards, chooseSwap, chooseSilver, util, difficultyForRating};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TOB_AI = api;
})(this);
