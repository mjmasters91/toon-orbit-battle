/* Toon Orbit Battle — rules engine (own implementation of gToons-style scoring). */
(function (root) {
  const NEUTRAL = new Set(['black', 'silver']);
  const PLAYABLE_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
  // Board: slots 0-3 = inner row (round 1), 4-6 = outer row (round 2), sitting between the inner cards.
  // "Next to"/"neighboring" = every touching slot on the same side (diagonals included).
  const ADJ = {0:[1,4], 1:[0,2,4,5], 2:[1,3,5,6], 3:[2,6], 4:[0,1,5], 5:[1,2,4,6], 6:[2,3,5]};
  const SWAP_PENALTY = 10, COLOR_BONUS = 15;
  const other = s => (s === 'p' ? 'o' : 'p');

  function matches(card, color, f) {
    if (!f) return true;
    if (f.color && color !== f.color) return false;
    if (f.feature && !card.features.includes(f.feature)) return false;
    if (f.notFeature && card.features.includes(f.notFeature)) return false;
    if (f.char && card.char !== f.char) return false;
    if (f.group && card.group !== f.group) return false;
    return true;
  }

  /**
   * Evaluate the visible board.
   * boards: {p:[card|null x7], o:[...]}, shown: {p:[bool x7], o:[...]} (face-up cards only are scored)
   * opts: {silver:{p:color|null,o:color|null}, penalty:{p:0|10,o:0|10}, goals:[colorP,colorO], final:bool}
   */
  function evaluate(boards, shown, opts = {}) {
    const live = []; // entries {side, slot, card}
    const res = {p: [], o: []};
    for (const s of ['p', 'o']) for (let i = 0; i < 7; i++) {
      const card = boards[s][i];
      res[s][i] = null;
      if (!card || !(shown[s] && shown[s][i])) continue;
      const e = {side: s, slot: i, card, knocked: null, color: card.color, mul: 1, add: 0, notes: []};
      res[s][i] = e; live.push(e);
    }
    // 1) Knockouts: identical card on both boards -> all copies cancelled.
    //    Same character (different card) -> only the lowest printed value survives; ties for lowest cancel each other.
    const byId = {}, byChar = {};
    live.forEach(e => { (byId[e.card.id] = byId[e.card.id] || []).push(e); (byChar[e.card.char] = byChar[e.card.char] || []).push(e); });
    Object.values(byId).forEach(list => { if (list.length > 1) list.forEach(e => e.knocked = 'Same gToon on both boards — cancelled'); });
    Object.values(byChar).forEach(list => {
      if (list.length < 2) return;
      const min = Math.min(...list.map(e => e.card.pts));
      const lows = list.filter(e => e.card.pts === min);
      list.forEach(e => {
        if (e.knocked) return;
        if (e.card.pts > min) e.knocked = `Cancelled by lower-value ${e.card.char} (${min})`;
        else if (lows.length > 1) e.knocked = `Same character played twice — cancelled`;
      });
    });
    const active = live.filter(e => !e.knocked);
    const onSide = (s) => active.filter(e => e.side === s);
    const at = (s, i) => active.find(e => e.side === s && e.slot === i);
    const neighborsOf = (e) => ADJ[e.slot].map(i => at(e.side, i)).filter(Boolean);
    const oppositeOf = (e) => at(other(e.side), e.slot);
    // 2) Color changes from powers (e.g. "Treats neighboring cards as Red").
    active.forEach(src => src.card.powers.forEach(pw => {
      if (pw.type !== 'recolor') return;
      neighborsOf(src).forEach(t => { if (t.color !== pw.color) { t.color = pw.color; t.notes.push(`Now ${pw.color} (${src.card.name})`); } });
    }));
    // 3) Point powers: gather multipliers and adders, then value = printed x multipliers + adders (floored at 0).
    const apply = (t, pw, src, times = 1) => {
      if (times <= 0) return;
      if (pw.op === 'mul') { t.mul *= Math.pow(pw.n, times); t.notes.push(`x${Math.pow(pw.n, times)} (${src.card.name})`); }
      else { t.add += pw.n * times; t.notes.push(`${pw.n * times >= 0 ? '+' : ''}${pw.n * times} (${src.card.name})`); }
    };
    active.forEach(src => src.card.powers.forEach(pw => {
      if (pw.type !== 'boost') return;
      if (pw.cond) {
        const pool = pw.cond.kind === 'nextTo' ? neighborsOf(src) : active.filter(e => e !== src);
        if (!pool.some(e => matches(e.card, e.color, pw.cond.filter))) return;
      }
      let times = 1;
      if (pw.each) {
        const pool = pw.each.where === 'neighbors' ? neighborsOf(src) : active.filter(e => e !== src);
        times = pool.filter(e => matches(e.card, e.color, pw.each.filter)).length;
      }
      let targets = [];
      switch (pw.who) {
        case 'self': targets = [src]; break;
        case 'all': targets = active; break;
        case 'allOther': targets = active.filter(e => e !== src); break;
        case 'neighbors': targets = neighborsOf(src); break;
        case 'opposite': targets = [oppositeOf(src)].filter(Boolean); break;
        case 'neighborsOrOpposite': targets = [...neighborsOf(src), oppositeOf(src)].filter(Boolean); break;
      }
      targets.filter(t => pw.who === 'self' || matches(t.card, t.color, pw.filter)).forEach(t => apply(t, pw, src, times));
    }));
    live.forEach(e => { e.value = e.knocked ? 0 : Math.max(0, e.card.pts * e.mul + e.add); });
    // 4) Totals and goal-color counts. Silver cards count as their owner's chosen color (counts only).
    const silver = opts.silver || {}, penalty = opts.penalty || {p: 0, o: 0};
    const out = {cells: res, total: {}, score: {}, counts: {p: {}, o: {}}, bonus: null, penalty};
    for (const s of ['p', 'o']) {
      out.total[s] = onSide(s).reduce((a, e) => a + e.value, 0);
      onSide(s).forEach(e => {
        let c = e.color;
        if (c === 'silver' && silver[s]) c = silver[s];
        e.countColor = c;
        if (!NEUTRAL.has(c)) out.counts[s][c] = (out.counts[s][c] || 0) + 1;
      });
      out.score[s] = out.total[s] - (penalty[s] || 0);
    }
    const goals = targetColors(opts.goals || []);
    out.targets = goals;
    const cnt = (s, c) => out.counts[s][c] || 0;
    if (goals.length === 1) {
      const c = goals[0];
      if (cnt('p', c) > cnt('o', c)) out.bonus = 'p'; else if (cnt('o', c) > cnt('p', c)) out.bonus = 'o';
      if (out.bonus) out.score[out.bonus] += COLOR_BONUS;
    }
    if (goals.length === 2) {
      const [a, b] = goals;
      if (cnt('p', a) > cnt('o', a) && cnt('p', b) > cnt('o', b)) out.colorLead = 'p';
      else if (cnt('o', a) > cnt('p', a) && cnt('o', b) > cnt('p', b)) out.colorLead = 'o';
    }
    if (opts.final) out.result = decide(out);
    return out;
  }

  function targetColors(goalColors) {
    return [...new Set(goalColors.filter(c => c && !NEUTRAL.has(c)))];
  }

  function decide(ev) {
    if (ev.targets.length === 2 && ev.colorLead) return {winner: ev.colorLead, reason: 'color'};
    if (ev.score.p > ev.score.o) return {winner: 'p', reason: 'points'};
    if (ev.score.o > ev.score.p) return {winner: 'o', reason: 'points'};
    return {winner: null, reason: 'tie'};
  }

  function shuffle(a, rng = Math.random) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const api = {evaluate, targetColors, decide, shuffle, ADJ, NEUTRAL, PLAYABLE_COLORS, SWAP_PENALTY, COLOR_BONUS, matches};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TOB_ENGINE = api;
})(this);
