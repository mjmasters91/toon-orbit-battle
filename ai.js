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
  function choosePlacement(st, hand, slots) {
    let best = null, bestU = -Infinity;
    perms(hand, Math.min(slots.length, hand.length), pick => {
      const ob = st.boards.o.slice(), osh = st.shown.o.slice();
      slots.forEach((s, i) => { ob[s] = pick[i]; osh[s] = true; });
      const ev = E.evaluate({p: st.boards.p, o: ob}, {p: st.shown.p, o: osh}, {goals: st.goals, penalty: st.penalty});
      const u = util(ev) + Math.random() * 1.5; // small jitter so it isn't robotic
      if (u > bestU) { bestU = u; best = pick.slice(); }
    });
    return best;
  }
  // Discard weak cards: keep goal-color cards and cards whose powers combo with the board/hand.
  function chooseDiscards(hand, goals, board) {
    const targets = E.targetColors(goals);
    const pool = hand.concat((board || []).filter(Boolean));
    const combo = c => c.powers.some(pw => {
      const f = (pw.cond && pw.cond.filter) || (pw.each && pw.each.filter) || pw.filter;
      return !f || pool.some(o => o !== c && E.matches(o, o.color, f));
    });
    const dupChar = c => (board || []).some(o => o && o.char === c.char);
    const keepScore = c => c.pts + (targets.includes(c.color) ? 8 : 0) + (combo(c) ? 6 : 0) - (dupChar(c) ? 12 : 0);
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
  function chooseSilver(st) {
    let best = null, bestU = -Infinity;
    E.PLAYABLE_COLORS.forEach(c => {
      const shownO = st.shown.o.slice(); shownO[6] = true;
      const ev = E.evaluate(st.boards, {p: st.shown.p, o: shownO}, {goals: st.goals, penalty: st.penalty, silver: {p: st.silver.p, o: c}});
      const u = util(ev); if (u > bestU) { bestU = u; best = c; }
    });
    return best;
  }
  const api = {choosePlacement, chooseDiscards, chooseSwap, chooseSilver, util};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TOB_AI = api;
})(this);
