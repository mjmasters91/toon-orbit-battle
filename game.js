/* Toon Orbit Battle — game flow & UI. */
(function () {
  const {CARDS, CARD_LIST, DECKS, COLORS} = window.TOB_CARDS;
  const COPIES = window.TOB_COPIES;
  const E = window.TOB_ENGINE, AI = window.TOB_AI, ART = window.TOB_ART;
  const qs = new URLSearchParams(location.search);
  const AUTO = qs.has('auto'); let autoGames = Math.max(1, parseInt(qs.get('auto') || '1', 10) || 1);
  // ===== CONFIG: seconds on the countdown for every timed phase (placement, discard, swap, silver). =====
  const PHASE_SECONDS = 30;
  const ECONOMY_DEFAULTS = {winCoins: 100, lossCoins: 25, packPrice: 300};
  function readEconomy() {
    const base = {winCoins: ECONOMY_DEFAULTS.winCoins, lossCoins: ECONOMY_DEFAULTS.lossCoins, packPrice: ECONOMY_DEFAULTS.packPrice};
    try {
      const saved = JSON.parse(localStorage.getItem('tob_economy') || 'null');
      if (!saved) return base;
      ['winCoins', 'lossCoins', 'packPrice'].forEach(k => {
        const n = Math.round(Number(saved[k]));
        if (Number.isFinite(n) && n >= 0 && n <= 1000000) base[k] = n;
      });
    } catch (e) { /* keep defaults */ }
    return base;
  }
  let ECONOMY = readEconomy();
  function saveEconomy(next) {
    ECONOMY = next;
    try { localStorage.setItem('tob_economy', JSON.stringify(ECONOMY)); } catch (e) { /* ignore */ }
  }
  function countCoins(node, total) {
    if (!node) return;
    if (reduceMotion()) { node.textContent = '+' + total; return; }
    const start = performance.now();
    const dur = 700;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / dur);
      node.textContent = '+' + Math.round(total * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  const T = AUTO ? {flip: 25, pause: 40, play: PHASE_SECONDS, short: PHASE_SECONDS} : {flip: 750, pause: 1200, play: PHASE_SECONDS, short: PHASE_SECONDS};
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const results = [];
  window.TOB = {results, get G() { return G; }};

  /* ---------- sound (tiny WebAudio blips, early-2000s web style) ---------- */
  let soundOn = !AUTO, actx = null;
  function blip(f = 660, d = 0.08, type = 'square', vol = 0.05) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = vol;
      o.connect(g); g.connect(actx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d); o.stop(actx.currentTime + d + 0.02);
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------- card rendering ---------- */
  function cardHTML(card, info, eager) {
    const c = COLORS[card.color];
    let badge = card.pts, bcls = '';
    const long = card.name.length > 11 ? ' long' : '';
    const gold = !!card.gold;
    const playInfo = info && typeof info === 'object' ? info : null;
    if (playInfo) {
      if (playInfo.knocked) { badge = '✕'; bcls = 'ko'; }
      else { badge = playInfo.value; bcls = playInfo.value > card.pts ? 'up' : playInfo.value < card.pts ? 'down' : ''; }
    }
    const recol2 = playInfo && !playInfo.knocked && playInfo.color !== card.color ? `<div class="recolor" style="background:${COLORS[playInfo.color]}"></div>` : '';
    return `<div class="card${gold ? ' gold' : ''}" data-id="${card.id}" style="--cc:${c}">
      <div class="cname${long}">${card.name}</div>
      <div class="cart">${faceHTML(card, eager)}${gold ? '<div class="holo"></div><div class="spark"></div>' : ''}</div>
      ${gold ? '<div class="goldtag">GOLD</div>' : ''}
      ${card.powers.length ? '<div class="pstar" aria-label="Has a power">★</div>' : ''}
      ${recol2}
      <div class="cpts ${bcls}">${badge}</div>
      ${playInfo && playInfo.knocked ? '<div class="kostamp">CANCELLED</div>' : ''}
    </div>`;
  }
  function faceHTML(card, eager) {
    const src = 'assets/cards/' + encodeURIComponent(card.id) + '.webp';
    return `<img class="cartimg" alt="" data-id="${card.id}" src="${src}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" onload="this.closest('.cart')&&this.closest('.cart').classList.add('ready')" onerror="TOB_ART.useSvg(this)">`;
  }
  function backHTML() { return `<div class="card back"><div class="backlogo"><span>TOON</span><b>ORBIT</b></div></div>`; }

  const narrow = () => matchMedia('(max-width: 1099px)').matches;
  function inspect(card, info, force) {
    const box = $('#inspector');
    const pop = $('#preview'), body = $('#previewBody');
    if (!card) {
      const idle = '<div class="tv-idle">Tap a card to preview it.</div>';
      box.innerHTML = idle;
      if (body) body.innerHTML = idle;
      if (pop) { pop.classList.add('hidden'); pop.classList.remove('force'); }
      return;
    }
    const notes = info ? (info.knocked ? [info.knocked] : info.notes) : [];
    const html = `<div class="tv-card${card.gold ? ' gold' : ''}" style="--cc:${COLORS[card.color]}">
      <div class="tv-art">${faceHTML(card, true)}${card.gold ? '<div class="holo"></div><div class="spark"></div>' : ''}</div>
      <div class="tv-name">${card.name}</div>
      <div class="tv-meta"><span class="gem" style="background:${COLORS[card.color]}"></span>${cap(card.color)} · ${card.pts} pts</div>
      <div class="tv-group">${card.group}</div>
      <div class="tv-feat">${card.features.join(' · ')}</div>
      <div class="tv-power">${card.power}</div>
      ${info ? `<div class="tv-live">In play: <b>${info.knocked ? 0 : info.value}</b> pts${notes.length ? '<br>' + notes.join('<br>') : ''}</div>` : ''}
    </div>`;
    box.innerHTML = html;
    if (body) body.innerHTML = html;
    if (pop) {
      const show = !!(narrow() || force);
      pop.classList.toggle('hidden', !show);
      pop.classList.toggle('force', !!force);
    }
  }

  /* ---------- game state ---------- */
  let G = null, timerId = null, lastPlace = 0;
  function buildDeck(ids) {
    const copies = ids.map(id => COPIES.makeCopy(id, {gold: false})).filter(Boolean);
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    COPIES.stampGold(copies, n);
    return E.shuffle(copies);
  }
  function newState(pIds, oIds, oName) {
    const pDeck = buildDeck(pIds), oDeck = buildDeck(oIds);
    const s = {
      phase: 'INTRO', oName, pDeck, oDeck, pHand: [], oHand: [], pDiscard: [], oDiscard: [],
      goalCards: {p: pDeck[11], o: oDeck[11]},
      boards: {p: Array(7).fill(null), o: Array(7).fill(null)},
      shown: {p: Array(7).fill(false), o: Array(7).fill(false)},
      penalty: {p: 0, o: 0}, silver: {p: null, o: null}, selected: -1, discardSel: new Set(),
      swapMode: false, round: 1, log: [], result: null,
    };
    s.goals = [s.goalCards.p.color, s.goalCards.o.color];
    s.targets = E.targetColors(s.goals);
    return s;
  }
  const draw = (deck, hand) => { while (hand.length < 6 && deck.length) hand.push(deck.shift()); };
  const evalNow = (final) => E.evaluate(G.boards, G.shown, {goals: G.goals, penalty: G.penalty, silver: G.silver, final});
  const activeSlots = () => G.phase === 'PLAY_1' ? [0, 1, 2, 3] : G.phase === 'PLAY_2' ? [4, 5, 6] : [];

  /* ---------- rendering ---------- */
  function slotHTML(side, i, ev) {
    const card = G.boards[side][i];
    const isActive = side === 'p' && activeSlots().includes(i);
    const hidden = G.round < 2 && i >= 4;
    let inner = '';
    if (card) {
      if (G.shown[side][i]) inner = cardHTML(card, ev.cells[side][i], true);
      else if (side === 'p') {
        const faceDown = i === 6 && !G.phase.startsWith('PLAY');
        inner = `<div class="pending">${cardHTML(card, null, true)}${faceDown ? '<div class="pend-tag">Face down</div>' : ''}</div>`;
      }
      else inner = backHTML();
    } else inner = `<div class="slotnum">${i + 1}</div>`;
    return `<div class="slot ${isActive && !card ? 'open' : ''} ${hidden ? 'locked' : ''} ${G.swapMode && side === 'p' && i === 6 ? 'swaptarget' : ''}" data-side="${side}" data-slot="${i}">${inner}</div>`;
  }
  function render() {
    if (!G) return;
    const ev = evalNow(false);
    G.lastEv = ev;
    const row = (side, idx) => idx.map(i => slotHTML(side, i, ev)).join('');
    $('#o-outer').innerHTML = row('o', [4, 5, 6]);
    $('#o-inner').innerHTML = row('o', [0, 1, 2, 3]);
    $('#p-inner').innerHTML = row('p', [0, 1, 2, 3]);
    $('#p-outer').innerHTML = row('p', [4, 5, 6]);
    // hand
    const hand = $('#hand'); hand.innerHTML = '';
    G.pHand.forEach((c, i) => {
      const w = el('div', 'handcard' + (G.selected === i ? ' sel' : '') + (G.discardSel.has(i) ? ' disc' : ''));
      w.innerHTML = cardHTML(c, null, true) + (G.discardSel.has(i) ? '<div class="disc-tag">DISCARD</div>' : '');
      w.dataset.idx = i; w.draggable = G.phase.startsWith('PLAY');
      hand.appendChild(w);
    });
    $('#o-hand').innerHTML = G.oHand.map(() => '<div class="minback"></div>').join('');
    // decks + goal cards
    const deckBox = (side, label) => {
      const deck = side === 'p' ? G.pDeck : G.oDeck, gc = G.goalCards[side], inDeck = deck.includes(gc);
      return `<div class="deckbox"><div class="dlabel">${label}</div>
        <div class="deckstack">${deck.length ? `<div class="stack">${deck.length}</div>` : '<div class="stack empty">0</div>'}
        <div class="goalcard ${inDeck ? '' : 'drawn'}" data-goal="${side}">${cardHTML(gc, null, true)}<div class="goaltag">Goal</div></div></div></div>`;
    };
    $('#decks').innerHTML = deckBox('o', G.oName + "'s Deck") + deckBox('p', 'Your Deck');
    renderScore(ev);
    const live = [].concat(G.pHand, G.oHand, G.boards.p, G.boards.o, [G.goalCards.p, G.goalCards.o]);
    preloadArt(live);
  }
  const preloadedArt = new Set();
  function preloadArt(cards) {
    cards.forEach(c => {
      if (!c || !c.id || preloadedArt.has(c.id)) return;
      preloadedArt.add(c.id);
      const img = new Image();
      img.decoding = 'async';
      img.src = 'assets/cards/' + encodeURIComponent(c.id) + '.webp';
    });
  }
  function renderScore(ev) {
    const tg = G.targets;
    const goalTxt = tg.length === 0 ? 'No goal color — Points only!' : tg.length === 1 ? `Goal color: ${cap(tg[0])} (most cards = +${E.COLOR_BONUS})` : `Goal colors: ${cap(tg[0])} & ${cap(tg[1])} (more of BOTH wins!)`;
    const rows = tg.map(c => `<tr><td><span class="gem" style="background:${COLORS[c]}"></span>${cap(c)}</td><td>${ev.counts.p[c] || 0}</td><td>${ev.counts.o[c] || 0}</td></tr>`).join('');
    const pen = s => G.penalty[s] ? `<div class="pen">−${G.penalty[s]} swap</div>` : '';
    const bon = s => ev.bonus === s ? `<div class="bon">+${E.COLOR_BONUS} color</div>` : '';
    const prev = G.prevScore;
    $('#scoreboard').innerHTML = `
      <div class="sb-title">Score</div>
      <div class="sb-goal">${goalTxt}</div>
      <div class="sb-scores">
        <div class="sb-side me"><div class="sb-name">YOU</div><div class="sb-num" id="sb-p">${ev.score.p}</div>${bon('p')}${pen('p')}</div>
        <div class="sb-vs">VS</div>
        <div class="sb-side opp"><div class="sb-name">${G.oName.toUpperCase()}</div><div class="sb-num" id="sb-o">${ev.score.o}</div>${bon('o')}${pen('o')}</div>
      </div>
      ${tg.length ? `<table class="sb-colors"><tr><th>Color</th><th>You</th><th>Opp</th></tr>${rows}</table>` : ''}
      ${ev.colorLead ? `<div class="sb-lead">${ev.colorLead === 'p' ? 'You lead' : G.oName + ' leads'} in BOTH colors!</div>` : ''}
      ${G.silver.p || G.silver.o ? `<div class="sb-silver">${G.silver.p ? 'Your silver = ' + cap(G.silver.p) : ''} ${G.silver.o ? '· Opp silver = ' + cap(G.silver.o) : ''}</div>` : ''}`;
    if (prev) {
      if (prev.p !== ev.score.p) { const n = $('#sb-p'); if (n) n.classList.add('pop'); }
      if (prev.o !== ev.score.o) { const n = $('#sb-o'); if (n) n.classList.add('pop'); }
    }
    G.prevScore = {p: ev.score.p, o: ev.score.o};
  }

  /* ---------- phase/timer helpers ---------- */
  function setMsg(t) { $('#phaseMsg').innerHTML = t; }
  function setActions(html) { $('#actions').innerHTML = html; }
  function startTimer(secs, onTimeout) {
    stopTimer();
    let left = secs; const t = $('#timer');
    const tick = () => {
      t.textContent = left;
      t.style.setProperty('--p', String(Math.max(0, left) / secs));
      t.setAttribute('aria-label', left + ' seconds left');
      t.className = left <= 10 ? 'warn' : '';
    };
    tick();
    timerId = setInterval(() => { left--; tick(); if (left <= 0) { stopTimer(); onTimeout(); } }, 1000);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId); timerId = null;
    const t = $('#timer'); t.textContent = ''; t.style.removeProperty('--p'); t.removeAttribute('aria-label');
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function aiState() { return {boards: G.boards, shown: G.shown, goals: G.goals, penalty: G.penalty, silver: G.silver}; }

  async function flipSeq(list) {
    for (const [side, slot] of list) {
      if (!G.boards[side][slot]) continue;
      G.shown[side][slot] = true; blip(side === 'p' ? 520 : 440, 0.07);
      render();
      const cell = document.querySelector(`.slot[data-side="${side}"][data-slot="${slot}"] .card`);
      if (cell) cell.classList.add('flipin');
      await wait(T.flip);
    }
  }

  /* ---------- flow ---------- */
  function hidePreview() {
    const p = $('#preview'); if (p) { p.classList.add('hidden'); p.classList.remove('force'); }
    hideReward();
  }
  function hideReward() {
    const reward = $('#reward');
    if (reward) { reward.classList.add('hidden'); reward.innerHTML = ''; }
  }
  function startGame(pIds, oIds, oName) {
    $('#overlay').classList.add('hidden');
    hidePreview();
    G = newState(pIds, oIds, oName);
    draw(G.pDeck, G.pHand); draw(G.oDeck, G.oHand);
    render(); setActions('');
    const tg = G.targets;
    setMsg(`Decks shuffled! Bottom cards: <b>${cap(G.goals[0])}</b> vs <b>${cap(G.goals[1])}</b> → ${tg.length ? 'Goal: ' + tg.map(cap).join(' & ') : 'No goal color'}`);
    blip(880, 0.15, 'triangle');
    setTimeout(() => beginPlay(1), T.pause * 1.5);
  }
  function beginPlay(round) {
    G.round = round; G.phase = round === 1 ? 'PLAY_1' : 'PLAY_2'; G.selected = -1;
    const n = round === 1 ? 4 : 3;
    setMsg(`<b>Round ${round}:</b> Play ${n} toons! Tap or drag a card, then tap a slot.`);
    setActions(`<button class="btn go" id="btnReady" disabled>READY!</button>`);
    render(); updateReady();
    startTimer(T.play, () => { setMsg("Time's up! Filling your empty slots…"); finishPlay(true); });
    if (AUTO) setTimeout(() => finishPlay(true), 10);
  }
  function updateReady() {
    const b = $('#btnReady'); if (!b) return;
    if (G.phase.startsWith('PLAY')) b.disabled = activeSlots().some(i => !G.boards.p[i]);
  }
  function placeCard(handIdx, slot) {
    if (!G.phase.startsWith('PLAY') || !activeSlots().includes(slot) || G.boards.p[slot]) return;
    const [c] = G.pHand.splice(handIdx, 1); G.boards.p[slot] = c; G.selected = -1; blip(700, 0.05);
    lastPlace = performance.now();
    render(); updateReady();
    const cell = document.querySelector(`.slot[data-side="p"][data-slot="${slot}"] .card`);
    if (cell) cell.classList.add('dropin');
  }
  function unplace(slot) {
    if (!G.phase.startsWith('PLAY') || !activeSlots().includes(slot) || !G.boards.p[slot]) return;
    G.pHand.push(G.boards.p[slot]); G.boards.p[slot] = null; render(); updateReady();
  }
  // Time's up: fill the player's empty slots with the best picks from their hand
  // (same evaluator the computer uses, run from the player's side of the table).
  function autoFillPlayer(slots) {
    const empty = slots.filter(s => !G.boards.p[s]);
    if (!empty.length || !G.pHand.length) return;
    const mine = G.boards.p.map((c, i) => !!c && (G.shown.p[i] || slots.includes(i)));
    const mirror = {boards: {p: G.boards.o, o: G.boards.p}, shown: {p: G.shown.o, o: mine},
      goals: [G.goals[1], G.goals[0]], penalty: {p: G.penalty.o, o: G.penalty.p}, silver: {p: null, o: null}};
    const pick = AI.choosePlacement(mirror, G.pHand, empty) || [];
    empty.forEach((s, i) => { const c = pick[i]; if (c) { G.boards.p[s] = c; G.pHand.splice(G.pHand.indexOf(c), 1); } });
  }
  async function finishPlay(auto) {
    if (!G.phase.startsWith('PLAY')) return;
    const slots = activeSlots();
    if (auto) autoFillPlayer(slots);
    if (slots.some(s => !G.boards.p[s])) return;
    stopTimer(); setActions('');
    const round = G.round;
    G.phase = round === 1 ? 'REVEAL_1' : 'REVEAL_2';
    // AI places using only face-up information
    const pick = AI.choosePlacement(aiState(), G.oHand, slots);
    slots.forEach((s, i) => { G.boards.o[s] = pick[i]; G.oHand.splice(G.oHand.indexOf(pick[i]), 1); });
    setMsg(`${G.oName} is ready… Revealing!`); render();
    await wait(T.pause);
    const order = round === 1 ? [0, 1, 2, 3] : [4, 5];
    await flipSeq(order.flatMap(i => [['p', i], ['o', i]]));
    const ev = evalNow(false);
    setMsg(`Round ${round} scored: You <b>${ev.score.p}</b> – ${G.oName} <b>${ev.score.o}</b>`);
    await wait(T.pause);
    if (round === 1) beginDiscard(); else beginSwap();
  }
  function beginDiscard() {
    G.phase = 'DISCARD'; G.discardSel = new Set();
    setMsg('Discard up to 2 cards (tap to mark), then press DONE. You will draw back to 6.');
    setActions(`<button class="btn go" id="btnDiscard">DONE</button>`);
    render();
    startTimer(T.short, () => { G.discardSel = new Set(); finishDiscard(); }); // time's up = discard nothing
    if (AUTO) setTimeout(() => { if (Math.random() < .5 && G.pHand.length) G.discardSel.add(0); finishDiscard(); }, 10);
  }
  function finishDiscard() {
    if (G.phase !== 'DISCARD') return;
    stopTimer();
    const keep = G.pHand.filter((c, i) => !G.discardSel.has(i));
    G.pDiscard.push(...G.pHand.filter((c, i) => G.discardSel.has(i)));
    G.pHand = keep; G.discardSel = new Set();
    const od = AI.chooseDiscards(G.oHand, G.goals, G.boards.o);
    G.oHand = G.oHand.filter(c => !od.includes(c)); G.oDiscard.push(...od);
    draw(G.pDeck, G.pHand); draw(G.oDeck, G.oHand);
    G.log.push(`${G.oName} discarded ${od.length} card(s).`);
    setMsg(`${G.oName} discarded ${od.length} card${od.length === 1 ? '' : 's'}. Hands refilled!`);
    render();
    setTimeout(() => beginPlay(2), T.pause);
  }
  function beginSwap() {
    G.phase = 'SWAP';
    if (!G.pHand.length) return afterSwap(null);
    setMsg(`Swap your face-down last card for one in your hand? Costs <b>−${E.SWAP_PENALTY}</b> points.`);
    setActions(`<button class="btn warn" id="btnSwapYes">SWAP (−${E.SWAP_PENALTY})</button><button class="btn" id="btnSwapNo">NO SWAP</button>`);
    render();
    startTimer(T.short, () => afterSwap(null));
    if (AUTO) setTimeout(() => afterSwap(Math.random() < .3 ? 0 : null), 10);
  }
  function afterSwap(handIdx) {
    if (G.phase !== 'SWAP') return;
    stopTimer(); G.swapMode = false;
    if (handIdx != null && G.pHand[handIdx]) {
      const old = G.boards.p[6]; G.boards.p[6] = G.pHand[handIdx]; G.pHand[handIdx] = old; G.penalty.p = E.SWAP_PENALTY;
    }
    const oc = AI.chooseSwap(aiState(), G.oHand);
    let msg = handIdx != null ? `You swapped (−${E.SWAP_PENALTY}). ` : '';
    if (oc) { const i = G.oHand.indexOf(oc); G.oHand[i] = G.boards.o[6]; G.boards.o[6] = oc; G.penalty.o = E.SWAP_PENALTY; msg += `${G.oName} swapped their last card! (−${E.SWAP_PENALTY})`; }
    else msg += `${G.oName} kept their last card.`;
    setMsg(msg); setActions(''); render();
    setTimeout(beginSilver, T.pause);
  }
  function beginSilver() {
    G.phase = 'SILVER';
    const has = s => G.boards[s].some(c => c && c.color === 'silver');
    if (has('o')) G.silver.o = null;
    const oPick = has('o') ? AI.chooseSilver(aiState()) : null;
    if (!has('p')) return finishSilver(null, oPick);
    setMsg('You have SILVER cards in play! Pick the color all your silver cards will count as.');
    setActions(E.PLAYABLE_COLORS.map(c => `<button class="btn colorbtn" data-color="${c}" style="background:${COLORS[c]}">${cap(c)}</button>`).join(''));
    render();
    const def = G.targets[0] || 'red';
    startTimer(T.short, () => finishSilver(def, oPick));
    G.pendingSilver = oPick;
    if (AUTO) setTimeout(() => finishSilver(def, oPick), 10);
  }
  async function finishSilver(pColor, oColor) {
    if (G.phase !== 'SILVER') return;
    stopTimer(); setActions('');
    G.silver.p = pColor; G.silver.o = oColor;
    G.phase = 'REVEAL_3';
    setMsg('Final cards flipping…'); render();
    await wait(T.pause / 2);
    await flipSeq([['p', 6], ['o', 6]]);
    gameOver();
  }
  async function gameOver() {
    G.phase = 'OVER';
    hidePreview();
    const ev = evalNow(true); render();
    const r = ev.result; G.result = r;
    results.push({winner: r.winner, reason: r.reason, score: ev.score, total: ev.total, counts: ev.counts, targets: ev.targets});
    const title = r.winner === 'p' ? 'YOU WIN!' : r.winner === 'o' ? 'YOU LOSE!' : 'TIE GAME!';
    const how = r.reason === 'color' ? `Won by Color — more ${ev.targets.map(cap).join(' AND ')} cards` : r.reason === 'points' ? 'Won by Points' : 'Same score — nobody wins';
    const line = s => `${ev.total[s]} pts${ev.bonus === s ? ` + ${E.COLOR_BONUS} color bonus` : ''}${G.penalty[s] ? ` − ${G.penalty[s]} swap` : ''} = <b>${ev.score[s]}</b>`;
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const pill = (side, who) => `<div class="go-pill ${side === 'p' ? 'me' : 'opp'}"><div class="go-who">${who}</div><div class="go-num">${ev.score[side]}</div><div class="go-math">${line(side)}</div></div>`;
    ov.innerHTML = `<div class="panel gameover ${r.winner === 'p' ? 'win' : r.winner === 'o' ? 'lose' : 'tie'}">
      <div class="go-title">${title}</div><div class="go-how">${how}</div>
      <div class="go-scores">${pill('p', 'You')}${pill('o', G.oName)}</div>
      ${ev.targets.length ? `<div class="go-colors">${ev.targets.map(c => `<div class="go-color"><span class="gem" style="background:${COLORS[c]}"></span>${cap(c)} cards: You ${ev.counts.p[c] || 0} · ${G.oName} ${ev.counts.o[c] || 0}</div>`).join('')}</div>` : ''}
      <div class="go-btns"><button class="btn go" id="btnAgain">PLAY AGAIN</button><button class="btn" id="btnPick">CHANGE DECK</button><button class="btn" id="btnBoard">VIEW BOARD</button></div></div>`;
    blip(r.winner === 'p' ? 990 : 220, 0.4, 'triangle', 0.08);
    setMsg(title + ' ' + how); setActions(`<button class="btn go" id="btnAgain2">PLAY AGAIN</button>`);
    window.TOB_DONE = results.length;
    let outcome = null;
    try { outcome = await recordResult(r); }
    catch (e) { outcome = null; }
    if (outcome && outcome.gained > 0) {
      const btns = ov.querySelector('.go-btns');
      if (btns) btns.insertAdjacentHTML('beforebegin', `<div class="coinaward"><span class="coinicon" aria-hidden="true"></span> <b id="coinGain">+0</b> Orbit Coins</div>`);
      countCoins($('#coinGain'), outcome.gained);
    }
    if (outcome && outcome.reward) showReward(outcome.reward);
    if (AUTO && results.length < autoGames) setTimeout(() => quickStart(), 50);
  }

  /* ---------- accounts, collection, rewards ---------- */
  function closeUserMenu() {
    const menu = $('#userPop');
    if (menu) menu.classList.add('hidden');
    const b = $('#btnUser');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function renderUser() {
    const menu = $('#userMenu');
    const user = window.TOB_AUTH.currentUser();
    if (!menu) return;
    if (!user) {
      menu.classList.add('hidden');
      closeUserMenu();
      const bal = $('#coinBal');
      if (bal) bal.classList.add('hidden');
      const adminBtn = $('#btnAdmin');
      if (adminBtn) adminBtn.classList.add('hidden');
      return;
    }
    menu.classList.remove('hidden');
    const name = user.username || 'Player';
    $('#userAvatar').textContent = name.slice(0, 1).toUpperCase();
    $('#userName').textContent = name;
    $('#btnUser').setAttribute('aria-label', 'Account menu for ' + name);
  }
  function randomReward() {
    const id = CARD_LIST[Math.floor(Math.random() * CARD_LIST.length)].id;
    const gold = Math.random() < 0.1;
    const copy = COPIES.makeCopy(id, {gold});
    return {id: copy.id, gold: !!copy.gold, uid: copy.uid};
  }
  function starterRecords(deckKey) {
    const deck = DECKS[deckKey] || DECKS.galaxy;
    return deck.cards.map(id => {
      const copy = COPIES.makeCopy(id, {gold: false});
      return {id: copy.id, gold: false, uid: copy.uid};
    });
  }
  function collectionStats(profile) {
    const ids = new Set();
    let gold = 0;
    (profile.collection || []).forEach(rec => {
      if (!rec || !CARDS[rec.id]) return;
      ids.add(rec.id);
      if (rec.gold) gold++;
    });
    return {unique: ids.size, total: CARD_LIST.length, gold};
  }
  async function recordResult(r) {
    if (!window.TOB_AUTH.currentUser()) return null;
    const profile = await window.TOB_AUTH.loadProfile();
    if (!profile) return null;
    profile.stats = profile.stats || {wins: 0, losses: 0, games: 0};
    profile.stats.games = (profile.stats.games | 0) + 1;
    let reward = null;
    if (r.winner === 'p') {
      profile.stats.wins = (profile.stats.wins | 0) + 1;
      reward = randomReward();
      profile.collection = (profile.collection || []).concat([reward]);
    } else if (r.winner === 'o') {
      profile.stats.losses = (profile.stats.losses | 0) + 1;
    }
    const gained = r.winner === 'p' ? ECONOMY.winCoins : ECONOMY.lossCoins;
    profile.coins = (profile.coins | 0) + gained;
    const saved = await window.TOB_AUTH.saveProfile(profile);
    if (saved && saved.ok) rememberPacks(profile);
    if (!saved || !saved.ok) return null;
    return {reward, gained};
  }
  function showReward(rec) {
    const copy = COPIES.makeCopy(rec.id, {gold: !!rec.gold, uid: rec.uid});
    if (!copy) return;
    const layer = $('#reward');
    layer.classList.remove('hidden');
    layer.innerHTML = `<div class="panel reward${copy.gold ? ' gold' : ''}">
      <div class="reward-title">New toon!</div>
      <div class="reward-stage">
        <div class="reward-flip">${cardHTML(copy, null, true)}</div>
        ${copy.gold ? '<div class="burst"></div><div class="burst b2"></div><div class="burst b3"></div>' : ''}
      </div>
      <div class="reward-name">${copy.name}</div>
      ${copy.gold ? '<div class="reward-gold">GOLD</div>' : ''}
      <div class="tag">Added to your collection.</div>
      <div class="go-btns"><button type="button" class="btn go" id="btnRewardOk">NICE!</button></div>
    </div>`;
    blip(copy.gold ? 1040 : 880, 0.22, 'triangle', 0.07);
  }
  async function doLogOut() {
    closeUserMenu();
    try { await window.TOB_AUTH.logOut(); } catch (e) { /* leave the table anyway */ }
    renderUser();
    rememberPacks(null);
    G = null;
    stopTimer();
    showAuth('login');
  }
  let authMode = 'signup';
  let starterPick = 'galaxy';
  function showAuth(mode) {
    if (mode) authMode = mode;
    stopTimer();
    hidePreview();
    closeUserMenu();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const remote = window.TOB_AUTH.mode === 'supabase';
    const signup = authMode !== 'login';
    const guest = window.TOB_AUTH.peekGuest();
    const claim = !!(guest && ((guest.collection && guest.collection.length) || (guest.stats && (guest.stats.games || guest.stats.wins || guest.stats.losses))));
    const decks = Object.entries(DECKS).map(([k, d]) => {
      const gems = [...new Set(d.cards.map(id => CARDS[id].color))].map(c => `<span class="gem" style="background:${COLORS[c]}"></span>`).join('');
      return `<button type="button" class="starterpick${starterPick === k ? ' on' : ''}" data-starter="${k}"><span class="dname">${d.name}</span><span class="dcolors">${gems}</span></button>`;
    }).join('');
    const tag = remote
      ? (signup ? 'Create an email account. Your toons sync through Supabase.' : 'Log in with email to open your collection.')
      : (signup ? 'Accounts stay on this device. Guest toons move over when you sign up.' : 'Welcome back. Your collection is saved on this device.');
    ov.innerHTML = `<div class="panel auth">
      <div class="big-logo"><span class="ring"></span>TOON ORBIT <b>BATTLE</b></div>
      <div class="tag">${window.TOB_AUTH.initError || tag}</div>
      <div class="auth-tabs">
        <button type="button" class="btn${signup ? ' go' : ''}" id="tabSignUp">Sign up</button>
        <button type="button" class="btn${signup ? '' : ' go'}" id="tabLogIn">Log in</button>
      </div>
      <div class="auth-form">
        ${remote ? '<label class="field">Email<input id="authEmail" type="email" autocomplete="email" inputmode="email"></label>' : ''}
        ${(!remote || signup) ? '<label class="field">Username<input id="authUser" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false"></label>' : ''}
        <label class="field">Password<input id="authPass" type="password" maxlength="128" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        ${signup ? `<div class="field-label">Starter deck</div><div class="starter-grid">${decks}</div>` : ''}
        ${claim && !signup ? '<p class="auth-claim">You have guest toons. Sign up to keep them.</p>' : ''}
        ${signup && claim ? '<p class="auth-claim" id="authClaim">Your guest cards and record will move to this account.</p>' : ''}
        <p class="auth-error" id="authError" role="alert"></p>
        <button type="button" class="btn go" id="btnAuthSubmit">${signup ? 'Create account' : 'Log in'}</button>
      </div>
      <button type="button" class="btn" id="btnGuest">Play as guest</button>
    </div>`;
    $('#tabSignUp').onclick = () => showAuth('signup');
    $('#tabLogIn').onclick = () => showAuth('login');
    ov.querySelectorAll('[data-starter]').forEach(btn => {
      btn.onclick = () => {
        starterPick = btn.dataset.starter;
        ov.querySelectorAll('[data-starter]').forEach(node => node.classList.toggle('on', node === btn));
      };
    });
    $('#btnGuest').onclick = async () => {
      const res = await window.TOB_AUTH.playAsGuest();
      if (!res.ok) { $('#authError').textContent = res.error; return; }
      renderUser();
      await liveProfile();
      showHome();
    };
    $('#btnAuthSubmit').onclick = async () => {
      const btn = $('#btnAuthSubmit');
      const errBox = $('#authError');
      errBox.textContent = '';
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = 'Please wait…';
      const creds = {
        username: $('#authUser') ? $('#authUser').value : '',
        password: $('#authPass').value,
        email: $('#authEmail') ? $('#authEmail').value : '',
      };
      try {
        if (signup) {
          const guestSnap = window.TOB_AUTH.peekGuest();
          const res = await window.TOB_AUTH.signUp(creds);
          if (!res.ok) { errBox.textContent = res.error; return; }
          const profile = await window.TOB_AUTH.loadProfile();
          profile.starterDeck = starterPick;
          const starter = starterRecords(starterPick);
          const hasGuest = !!(guestSnap && ((guestSnap.collection && guestSnap.collection.length) || (guestSnap.stats && (guestSnap.stats.games || guestSnap.stats.wins || guestSnap.stats.losses)) || guestSnap.welcomeGranted || (guestSnap.packs | 0) > 0));
          if (hasGuest) {
            profile.collection = starter.concat(guestSnap.collection || []);
            profile.stats.wins += (guestSnap.stats && guestSnap.stats.wins) || 0;
            profile.stats.losses += (guestSnap.stats && guestSnap.stats.losses) || 0;
            profile.stats.games += (guestSnap.stats && guestSnap.stats.games) || 0;
            const guestWelcome = guestSnap.welcomeGranted === true;
            profile.packs = (guestSnap.packs | 0) + (guestWelcome ? 0 : 3);
            profile.welcomeGranted = true;
            profile.coins = guestSnap.coins | 0;
            profile.lastDaily = typeof guestSnap.lastDaily === 'string' ? guestSnap.lastDaily : null;
          } else profile.collection = starter;
          const saved = await window.TOB_AUTH.saveProfile(profile);
          if (!saved.ok) { errBox.textContent = saved.error || 'Could not save your collection.'; return; }
          if (hasGuest) window.TOB_AUTH.clearGuest();
        } else {
          const res = await window.TOB_AUTH.logIn(creds);
          if (!res.ok) { errBox.textContent = res.error; return; }
        }
        renderUser();
        await liveProfile();
        showHome();
      } finally {
        if (btn.isConnected) { btn.disabled = false; btn.textContent = prev; }
      }
    };
  }
  let mineFilter = 'all';
  function showMyCollection() {
    stopTimer();
    hidePreview();
    closeUserMenu();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const draw = async () => {
      const profile = await window.TOB_AUTH.loadProfile();
      if (!profile) { showAuth('login'); return; }
      const byId = new Map();
      (profile.collection || []).forEach(rec => {
        if (!rec || !CARDS[rec.id]) return;
        let group = byId.get(rec.id);
        if (!group) { group = {count: 0, gold: 0, sample: rec}; byId.set(rec.id, group); }
        group.count++;
        if (rec.gold) { group.gold++; group.sample = rec; }
      });
      const stats = collectionStats(profile);
      const since = profile.createdAt ? new Date(profile.createdAt) : null;
      const sinceTxt = since && !Number.isNaN(since.getTime())
        ? since.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})
        : '';
      const filters = [['all', 'All'], ['owned', 'Owned'], ['gold', 'Gold']].concat(Object.keys(COLORS).map(c => [c, cap(c)]));
      const cards = CARD_LIST.filter(c => {
        const group = byId.get(c.id);
        if (mineFilter === 'owned') return !!(group && group.count);
        if (mineFilter === 'gold') return !!(group && group.gold);
        if (mineFilter !== 'all' && COLORS[mineFilter]) return c.color === mineFilter;
        return true;
      });
      const cells = cards.map(c => {
        const group = byId.get(c.id);
        if (!group || !group.count) {
          return `<div class="ccard locked" data-cid="${c.id}"><div class="card silhouette" style="--cc:${COLORS[c.color]}"><div class="lockmark" aria-hidden="true"></div></div></div>`;
        }
        const copy = COPIES.makeCopy(group.sample.id, {gold: group.gold > 0, uid: group.sample.uid});
        const badge = group.count > 1 ? `<div class="copycount">${group.count}</div>` : '';
        return `<div class="ccard" data-cid="${c.id}" data-gold="${copy.gold ? '1' : '0'}">${badge}${cardHTML(copy, null, true)}</div>`;
      }).join('');
      ov.innerHTML = `<div class="panel mine">
        <div class="sb-title">My Collection</div>
        <div class="progress-line" id="colProgress">${stats.unique} / ${stats.total} collected, ${stats.gold} gold</div>
        <div class="mine-stats">${sinceTxt ? 'Since ' + sinceTxt + ' · ' : ''}${profile.stats.wins | 0} wins · ${profile.stats.losses | 0} losses · ${profile.stats.games | 0} games</div>
        <div class="filters">${filters.map(([id, label]) => `<button type="button" class="btn filter${mineFilter === id ? ' on' : ''}" data-filter="${id}">${label}</button>`).join('')}</div>
        ${cells ? `<div class="cgrid">${cells}</div>` : '<p class="tag">Nothing in this filter yet.</p>'}
        <div class="go-btns"><button type="button" class="btn" id="btnMineBack">BACK</button></div>
      </div>`;
      ov.querySelectorAll('[data-filter]').forEach(btn => { btn.onclick = () => { mineFilter = btn.dataset.filter; draw(); }; });
      $('#btnMineBack').onclick = () => {
        if (G && G.phase !== 'OVER' && G.phase !== 'INTRO') $('#overlay').classList.add('hidden');
        else showHome();
      };
      ov.querySelectorAll('.ccard').forEach(node => {
        node.onclick = (ev) => {
          ev.stopPropagation();
          if (node.classList.contains('locked')) return;
          const group = byId.get(node.dataset.cid);
          if (!group) return;
          inspect(COPIES.makeCopy(group.sample.id, {gold: group.gold > 0, uid: group.sample.uid}));
        };
      });
    };
    draw();
  }

  /* ---------- packs ---------- */
  let packState = {packs: 0, lastDaily: null, coins: 0, role: 'player'};
  let stageToken = 0;
  let currentPulls = null;
  let flipped = [];
  let packSummaryShown = false;
  let packBusy = false;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function rememberPacks(profile) {
    const user = window.TOB_AUTH.currentUser();
    packState = {
      packs: profile ? (profile.packs | 0) : 0,
      lastDaily: profile && typeof profile.lastDaily === 'string' ? profile.lastDaily : null,
      coins: profile ? (profile.coins | 0) : 0,
      role: profile && profile.role === 'admin' ? 'admin' : 'player',
    };
    document.querySelectorAll('[data-packbadge]').forEach(el => {
      el.textContent = packState.packs ? String(packState.packs) : '';
      el.classList.toggle('on', packState.packs > 0);
    });
    const bal = $('#coinBal');
    const count = $('#coinCount');
    if (bal) bal.classList.toggle('hidden', !user);
    if (count && user) count.textContent = String(packState.coins);
    const adminBtn = $('#btnAdmin');
    if (adminBtn) adminBtn.classList.toggle('hidden', !user || packState.role !== 'admin');
  }
  async function liveProfile() {
    let profile = await window.TOB_AUTH.loadProfile();
    if (!profile) { rememberPacks(null); return null; }
    if (profile.welcomeGranted !== true) {
      profile.welcomeGranted = false;
      const saved = await window.TOB_AUTH.saveProfile(profile);
      if (saved && saved.ok) profile = await window.TOB_AUTH.loadProfile();
    }
    rememberPacks(profile);
    return profile;
  }
  function rollPack(ownedIds) {
    const ids = CARD_LIST.map(c => c.id);
    const unowned = ids.filter(id => !ownedIds.has(id));
    const pulls = [];
    const forceAt = unowned.length ? Math.floor(Math.random() * 5) : -1;
    for (let i = 0; i < 5; i++) {
      const id = i === forceAt ? unowned[Math.floor(Math.random() * unowned.length)] : ids[Math.floor(Math.random() * ids.length)];
      const gold = Math.random() < 0.1; /* pack */
      const copy = COPIES.makeCopy(id, {gold});
      pulls.push({id: copy.id, gold: !!copy.gold, uid: copy.uid});
    }
    return pulls;
  }
  function annotatePulls(pulls, before) {
    const counts = {};
    before.forEach(rec => { if (rec && rec.id) counts[rec.id] = (counts[rec.id] || 0) + 1; });
    return pulls.map(pull => {
      counts[pull.id] = (counts[pull.id] || 0) + 1;
      return {id: pull.id, gold: !!pull.gold, uid: pull.uid, isNew: counts[pull.id] === 1, dup: counts[pull.id]};
    });
  }
  function packSound(kind) {
    if (kind === 'shake') blip(130, 0.16, 'sawtooth', 0.035);
    else if (kind === 'tear') { blip(480, 0.06, 'square', 0.04); blip(860, 0.1, 'triangle', 0.04); }
    else if (kind === 'flip') blip(640, 0.06, 'square', 0.045);
    else if (kind === 'gold') { blip(880, 0.08, 'triangle', 0.06); blip(1320, 0.16, 'triangle', 0.05); }
    else blip(720, 0.1, 'triangle', 0.05);
  }
  function foilMarkup() {
    const bits = Array.from({length: 8}, (_, i) => `<i style="--i:${i}"></i>`).join('');
    return `<div class="foil-sheen"></div><div class="foil-tear"></div>
      <div class="foil-face"><div class="foil-brand"><span class="foil-planet" aria-hidden="true"></span><span class="foil-words">TOON ORBIT <b>BATTLE</b></span></div><div class="foil-sub">TOON PACK</div></div>
      <div class="foil-bits">${bits}</div>`;
  }
  function goldBurst() {
    packSound('gold');
    try { if (navigator.vibrate) navigator.vibrate([28, 36, 70]); } catch (e) { /* no haptic */ }
    if (reduceMotion()) return;
    const flash = el('div', 'goldflash');
    const ray = el('div', 'goldray');
    document.body.appendChild(flash);
    document.body.appendChild(ray);
    setTimeout(() => { flash.remove(); ray.remove(); }, 520);
  }
  function showPacks() {
    closeUserMenu();
    hidePreview();
    stopTimer();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const draw = async () => {
      const profile = await liveProfile();
      if (!profile) { showAuth('login'); return; }
      const claimed = profile.lastDaily === todayKey();
      ov.innerHTML = `<div class="panel packs">
        <div class="sb-title">Packs</div>
        <div class="foilpack idle">${foilMarkup()}</div>
        <div class="progress-line" id="packCount">${profile.packs | 0} unopened</div>
        <div class="shop" id="packShop">
          <div class="sb-title">Pack shop</div>
          <div class="shop-price"><span class="coinicon" aria-hidden="true"></span> ${ECONOMY.packPrice} Orbit Coins</div>
          <button type="button" class="btn go" id="btnBuyPack" ${(profile.coins | 0) < ECONOMY.packPrice ? 'disabled' : ''}>Buy pack</button>
          <p class="shop-note" id="shopNote">${(profile.coins | 0) < ECONOMY.packPrice ? `You need ${ECONOMY.packPrice} Orbit Coins for a pack. You have ${profile.coins | 0}.` : 'Buy a pack with Orbit Coins. No real money.'}</p>
        </div>
        <div class="tag">Five toons. One is new when you still have cards to find. Each copy has a 10% chance to be gold.</div>
        <div class="go-btns">
          <button type="button" class="btn go" id="btnOpenPack" ${(profile.packs | 0) < 1 ? 'disabled' : ''}>Open pack</button>
          <button type="button" class="btn" id="btnDaily" ${claimed ? 'disabled' : ''}>${claimed ? 'Daily pack claimed' : 'Claim daily pack'}</button>
          <button type="button" class="btn" id="btnPackBack">BACK</button>
        </div>
      </div>`;
      $('#btnPackBack').onclick = () => showHome();
    };
    draw();
  }
  async function claimDaily() {
    const profile = await liveProfile();
    if (!profile) return;
    const today = todayKey();
    if (profile.lastDaily === today) return;
    profile.lastDaily = today;
    profile.packs = (profile.packs | 0) + 1;
    const saved = await window.TOB_AUTH.saveProfile(profile);
    if (!saved || !saved.ok) return;
    rememberPacks(profile);
    packSound('daily');
    showPacks();
  }
  async function buyPack() {
    const profile = await liveProfile();
    if (!profile) return;
    if ((profile.coins | 0) < ECONOMY.packPrice) return;
    profile.coins = (profile.coins | 0) - ECONOMY.packPrice;
    profile.packs = (profile.packs | 0) + 1;
    const saved = await window.TOB_AUTH.saveProfile(profile);
    if (!saved || !saved.ok) return;
    rememberPacks(profile);
    packSound('daily');
    showPacks();
  }
  function toast(msg) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = msg;
    node.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => node.classList.add('hidden'), 2200);
  }
  function clampInt(v, fallback) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > 1000000) return fallback;
    return n;
  }
  function showAdmin() {
    if (packState.role !== 'admin') return showHome();
    closeUserMenu();
    hidePreview();
    stopTimer();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const people = window.TOB_AUTH.listProfiles();
    const cardOpts = CARD_LIST.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const rows = people.map(p => {
      const count = (p.collection || []).length;
      const key = String(p.username || '').toLowerCase();
      return `<div class="adminrow" data-user="${key}">
        <div class="adminwho"><b>${p.username}</b> <span>${p.role === 'admin' ? 'admin' : 'player'}</span></div>
        <div class="adminmeta">${p.coins | 0} coins · ${p.packs | 0} packs · ${count} cards</div>
        <div class="admingrid">
          <input class="admin-in" data-field="coins" type="number" min="0" value="${p.coins | 0}" aria-label="Coins for ${p.username}">
          <button type="button" class="btn" data-act="coins">Set coins</button>
          <input class="admin-in" data-field="packs" type="number" min="0" value="${p.packs | 0}" aria-label="Packs for ${p.username}">
          <button type="button" class="btn" data-act="packs">Set packs</button>
          <select data-field="card" aria-label="Card for ${p.username}">${cardOpts}</select>
          <label class="goldlab"><input type="checkbox" data-field="gold"> Gold</label>
          <button type="button" class="btn" data-act="card">Grant card</button>
          <button type="button" class="btn" data-act="role">${p.role === 'admin' ? 'Demote' : 'Make admin'}</button>
        </div>
      </div>`;
    }).join('') || '<p class="tag">No accounts on this device.</p>';
    ov.innerHTML = `<div class="panel admin">
      <div class="sb-title">Admin</div>
      <p class="tag">Local admin is device-only and client-side. Anyone with this browser can change the data. A Supabase project has to enforce the admin role on the server.</p>
      <div class="econ">
        <label>Win <input id="ecoWin" type="number" min="0" value="${ECONOMY.winCoins}"></label>
        <label>Loss <input id="ecoLoss" type="number" min="0" value="${ECONOMY.lossCoins}"></label>
        <label>Pack <input id="ecoPrice" type="number" min="0" value="${ECONOMY.packPrice}"></label>
        <button type="button" class="btn go" id="btnSaveEcon">Save economy</button>
      </div>
      <div class="adminlist">${rows}</div>
      <div class="go-btns"><button type="button" class="btn" id="btnAdminBack">BACK</button></div>
    </div>`;
    $('#btnAdminBack').onclick = () => showHome();
    $('#btnSaveEcon').onclick = () => {
      saveEconomy({
        winCoins: clampInt($('#ecoWin').value, ECONOMY.winCoins),
        lossCoins: clampInt($('#ecoLoss').value, ECONOMY.lossCoins),
        packPrice: clampInt($('#ecoPrice').value, ECONOMY.packPrice),
      });
      toast('Saved economy');
      showAdmin();
    };
    ov.querySelectorAll('[data-act]').forEach(btn => { btn.onclick = () => adminAct(btn); });
  }
  function adminAct(btn) {
    const row = btn.closest('.adminrow');
    const username = row && row.dataset.user;
    const profile = window.TOB_AUTH.listProfiles().find(p => String(p.username || '').toLowerCase() === username);
    if (!profile) { toast('That player is not on this device'); return; }
    const act = btn.dataset.act;
    if (act === 'coins') profile.coins = clampInt(row.querySelector('[data-field="coins"]').value, profile.coins | 0);
    else if (act === 'packs') {
      profile.packs = clampInt(row.querySelector('[data-field="packs"]').value, profile.packs | 0);
      profile.welcomeGranted = true;
    } else if (act === 'card') {
      const id = row.querySelector('[data-field="card"]').value;
      if (!CARDS[id]) { toast('Pick a card'); return; }
      const gold = !!row.querySelector('[data-field="gold"]').checked;
      const copy = COPIES.makeCopy(id, {gold});
      profile.collection = (profile.collection || []).concat([{id: copy.id, gold: !!copy.gold, uid: copy.uid}]);
    } else if (act === 'role') {
      if (String(profile.username || '').toLowerCase() === 'guest') { toast('Guest stays a player'); return; }
      profile.role = profile.role === 'admin' ? 'player' : 'admin';
    }
    const saved = window.TOB_AUTH.adminSave(profile.username, profile);
    if (!saved || !saved.ok) { toast((saved && saved.error) || 'Could not save'); return; }
    const me = window.TOB_AUTH.currentUser();
    if (me && String(me.username || '').toLowerCase() === username) rememberPacks(saved.profile);
    const labels = {coins: 'Updated coins for ', packs: 'Updated packs for ', card: 'Granted a card to ', role: 'Updated role for '};
    toast((labels[act] || 'Saved ') + profile.username);
    showAdmin();
  }
  async function openPack() {
    if (packBusy) return;
    packBusy = true;
    try {
      const profile = await liveProfile();
      if (!profile || (profile.packs | 0) < 1) return;
      const before = (profile.collection || []).slice();
      const pulls = rollPack(new Set(before.map(rec => rec && rec.id).filter(Boolean)));
      const annotated = annotatePulls(pulls, before);
      profile.packs = (profile.packs | 0) - 1;
      profile.collection = before.concat(pulls.map(p => ({id: p.id, gold: !!p.gold, uid: p.uid})));
      const saved = await window.TOB_AUTH.saveProfile(profile);
      if (!saved || !saved.ok) return;
      rememberPacks(profile);
      currentPulls = annotated;
      flipped = annotated.map(() => false);
      packSummaryShown = false;
      await playPull();
    } finally {
      packBusy = false;
    }
  }
  function pullTagHTML(pull) {
    const bits = [];
    if (pull.isNew) bits.push('<span class="newtag">NEW!</span>');
    if (pull.dup > 1) bits.push(`<span class="duptag">x${pull.dup}</span>`);
    if (pull.gold) bits.push('<span class="goldpill">GOLD</span>');
    return `<div class="pulltags">${bits.join('')}</div>`;
  }
  function stageCard(pull, i) {
    const copy = COPIES.makeCopy(pull.id, {gold: pull.gold, uid: pull.uid});
    return `<button type="button" class="stagecard pullcard${pull.gold ? ' is-gold' : ''}" data-i="${i}">
      ${pullTagHTML(pull)}
      <span class="pull-inner">
        <span class="pull-back">${backHTML()}</span>
        <span class="pull-front">${cardHTML(copy, null, true)}</span>
      </span>
    </button>`;
  }
  function thumbHTML(pull) {
    const copy = COPIES.makeCopy(pull.id, {gold: pull.gold, uid: pull.uid});
    return `<div class="thumb">${cardHTML(copy, null, true)}</div>`;
  }
  async function playPull() {
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const reduce = reduceMotion();
    ov.innerHTML = `<div class="packtake"><div class="foilpack${reduce ? ' tear' : ' shake'}" id="foilPack">${foilMarkup()}</div></div>`;
    packSound('shake');
    if (!reduce) await wait(700);
    const pack = $('#foilPack');
    if (pack) pack.classList.add('tear');
    packSound('tear');
    if (!reduce) await wait(420);
    renderStage();
  }
  function renderStage() {
    const i = flipped.findIndex(v => !v);
    if (i < 0) { showPackSummary(); return; }
    const done = currentPulls.map((pull, idx) => flipped[idx] ? thumbHTML(pull) : '').join('');
    $('#overlay').innerHTML = `<div class="packtake">
      <div class="stagehint">Tap to flip</div>
      <div class="stagewrap">${stageCard(currentPulls[i], i)}</div>
      <button type="button" class="btn go" id="btnRevealAll">Reveal all</button>
      <div class="dock">${done}</div>
    </div>`;
  }
  function flipPull(i) {
    if (!currentPulls || flipped[i] || packSummaryShown) return;
    const node = document.querySelector('.stagecard');
    if (!node || node.classList.contains('flipped') || +node.dataset.i !== i) return;
    node.classList.add('flipped');
    packSound('flip');
    if (currentPulls[i].gold) goldBurst();
    const token = ++stageToken;
    const hold = reduceMotion() ? 0 : 1000;
    setTimeout(() => {
      if (token !== stageToken || packSummaryShown) return;
      flipped[i] = true;
      if (flipped.every(Boolean)) showPackSummary();
      else renderStage();
    }, hold);
  }
  function revealAll() {
    if (!currentPulls || packSummaryShown) return;
    stageToken++;
    const unseenGold = currentPulls.some((pull, i) => pull.gold && !flipped[i]);
    currentPulls.forEach((_, i) => { flipped[i] = true; });
    if (unseenGold) goldBurst();
    showPackSummary();
  }
  function showPackSummary() {
    if (packSummaryShown || !currentPulls) return;
    packSummaryShown = true;
    stageToken++;
    const fresh = currentPulls.filter(p => p.isNew).length;
    const golds = currentPulls.filter(p => p.gold).length;
    const slots = currentPulls.map(pull => {
      const copy = COPIES.makeCopy(pull.id, {gold: pull.gold, uid: pull.uid});
      return `<div class="pullslot">${pullTagHTML(pull)}<div class="pullshown">${cardHTML(copy, null, true)}</div></div>`;
    }).join('');
    $('#overlay').innerHTML = `<div class="packtake summarytake">
      <div class="reward-title pack-summary" id="packSummary">${fresh} new, ${golds} gold</div>
      <div class="pullgrid">${slots}</div>
      <div class="go-btns">
        <button type="button" class="btn go" id="btnOpenAnother" ${packState.packs > 0 ? '' : 'disabled'}>Open another</button>
        <button type="button" class="btn" id="btnViewPackCollection">View collection</button>
      </div>
    </div>`;
  }

  /* ---------- deck selection / builder ---------- */
  let lastDeck = null;
  const OPP_NAMES = {galaxy: 'Commander Kix', spooky: 'Baron Boo', barnyard: 'Farmer Fizz', sprout: 'Professor Sprig', custom: 'Mystery Rival'};
  function customDeck() { try { const d = JSON.parse(localStorage.getItem('tob_custom') || '[]'); return d.filter(id => CARDS[id]); } catch (e) { return []; } }
  function quickStart(key) {
    key = key || lastDeck || Object.keys(DECKS)[Math.floor(Math.random() * 4)];
    lastDeck = key;
    const pIds = key === 'custom' ? customDeck() : DECKS[key].cards;
    const others = Object.keys(DECKS).filter(k => k !== key);
    const ok = others[Math.floor(Math.random() * others.length)];
    startGame(pIds, DECKS[ok].cards, OPP_NAMES[ok]);
  }
  function deckBlock(key, name, ids, playable) {
    let pts = 0;
    const colors = {};
    ids.forEach(id => {
      const c = CARDS[id];
      if (!c) return;
      pts += c.pts;
      colors[c.color] = (colors[c.color] || 0) + 1;
    });
    const dots = Object.entries(colors).map(([c, n]) => `<span class="cdot"><span class="gem" style="background:${COLORS[c]}"></span>${n} ${cap(c)}</span>`).join('');
    const cards = ids.map(id => {
      const c = CARDS[id];
      if (!c) return '';
      return `<button type="button" class="deckcard" data-cid="${c.id}"><img src="assets/cards/${encodeURIComponent(c.id)}.webp" alt="" data-id="${c.id}"><span class="dinfo"><b>${c.name}</b><span class="dmeta"><span class="gem" style="background:${COLORS[c.color]}"></span>${c.pts} pts · ${cap(c.color)}</span><span class="dpower">${c.power}</span></span></button>`;
    }).join('');
    const play = playable
      ? `<button type="button" class="btn go deckplay" data-deck="${key}">Play</button>`
      : `<button type="button" class="btn" id="btnBuild">Build it</button>`;
    return `<section class="deckblock"><div class="deckhead"><div><div class="dname">${name}</div><div class="dsum">${pts} base pts</div><div class="dcolors">${dots}</div></div>${play}</div><div class="deckgrid">${cards}</div></section>`;
  }
  let homeClock = null;
  function stopHomeClock() {
    if (homeClock) clearInterval(homeClock);
    homeClock = null;
  }
  function dailyClockText() {
    if (packState.lastDaily !== todayKey()) return 'READY';
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let ms = Math.max(0, mid - now);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function showHome() {
    stopTimer();
    hidePreview();
    closeUserMenu();
    stopHomeClock();
    const user = window.TOB_AUTH.currentUser();
    if (!user) return showAuth('signup');
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const draw = async () => {
      const profile = await window.TOB_AUTH.loadProfile();
      if (!window.TOB_AUTH.currentUser()) return;
      const owned = (profile && profile.collection) || [];
      let feat = null;
      if (owned.length) {
        const rec = owned[Math.floor(Math.random() * owned.length)];
        feat = {id: rec.id, gold: !!rec.gold, owned: owned.filter(c => c.id === rec.id).length};
      } else {
        const c = CARD_LIST[Math.floor(Math.random() * CARD_LIST.length)];
        feat = {id: c.id, gold: false, owned: 0};
      }
      const def = CARDS[feat.id];
      const copy = COPIES.makeCopy(feat.id, {gold: feat.gold});
      const pulls = owned.length > 12 ? owned.slice(12).slice(-4).reverse() : [];
      const pullList = pulls.length
        ? pulls.map(p => `<li>${CARDS[p.id] ? CARDS[p.id].name : p.id}${p.gold ? ' · GOLD' : ''}</li>`).join('')
        : '<li>No pulls yet. Open a pack!</li>';
      const ready = packState.lastDaily !== todayKey();
      const admin = packState.role === 'admin';
      const tab = (id, label) => `<button type="button" class="portal-tab" id="${id}"><span>${label}</span><span class="chev" aria-hidden="true">&gt;</span></button>`;
      ov.innerHTML = `<div id="homeScreen" class="portal">
        <div class="portal-top">
          <div class="portal-brand"><span class="ring"></span><span class="portal-word">TOON ORBIT <b>TRADING CARDS</b></span></div>
          <div class="portal-greet">HI, ${(user.username || 'PLAYER').toUpperCase()}!</div>
          <div class="portal-tools">
            <div class="portal-pill"><span class="coinicon" aria-hidden="true"></span> YOU HAVE ${packState.coins | 0} ORBIT COINS</div>
            <button type="button" class="portal-logout" id="btnHomeOut">LOGOUT</button>
            <button type="button" class="portal-sound" id="btnHomeSound">SOUND ${soundOn ? 'ON' : 'OFF'}</button>
            <div class="portal-daily">${ready ? 'DAILY PACK READY' : 'DAILY PACK CLAIMED'}</div>
          </div>
        </div>
        <div class="portal-body">
          <nav class="portal-tabs">
            ${tab('btnGetCards', 'GET CARDS')}
            ${tab('btnPlayTab', 'PLAY')}
            ${tab('btnHomeCollection', 'MY COLLECTION')}
            ${tab('btnOpenPacks', 'OPEN PACKS')}
            ${admin ? tab('btnHomeAdmin', 'ADMIN') : ''}
            ${tab('btnCollection', 'CARD GALLERY')}
            ${tab('btnRules2', 'HOW TO PLAY')}
          </nav>
          <section class="portal-main">
            <div class="portal-frame">
              <div class="portal-framehead"><span class="portal-badge" aria-hidden="true"></span> FEATURED CARD</div>
              <div class="portal-feature">
                <div class="portal-info">
                  <div class="portal-cardname">${def.name}</div>
                  <div>${def.pts} PTS · ${cap(def.color)}</div>
                  <div>${feat.gold ? 'GOLD' : 'STANDARD'} · YOU OWN ${feat.owned}</div>
                  <div class="portal-power">${def.power}</div>
                  ${ready ? `<button type="button" class="portal-clock" id="btnDaily"><span>DAILY PACK</span><b id="homeClock">${dailyClockText()}</b></button>` : `<div class="portal-clock"><span>TIME REMAINING</span><b id="homeClock">${dailyClockText()}</b></div>`}
                </div>
                <div class="portal-stage">${cardHTML(copy, null, true)}</div>
              </div>
              <button type="button" class="portal-cta" id="btnPlay">PLAY NOW</button>
              <button type="button" class="portal-cta" id="btnPacks">OPEN PACK</button>
            </div>
          </section>
        </div>
        <div class="portal-bottom">
          <div class="portal-box">
            <div class="portal-boxhead">RECENT PULLS</div>
            <ul class="portal-pulls">${pullList}</ul>
          </div>
          <div class="portal-box">
            <div class="portal-boxhead">TOON TIPS</div>
            <p>Match both goal colors to win outright. Gold copies are just for show, and they score the same.</p>
          </div>
        </div>
      </div>`;
      homeClock = setInterval(() => {
        const node = document.getElementById('homeClock');
        if (!node) { stopHomeClock(); return; }
        node.textContent = dailyClockText();
      }, 1000);
    };
    draw();
  }
  function showDeckSelect() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const cd = customDeck();
    const blocks = Object.entries(DECKS).map(([k, d]) => deckBlock(k, d.name, d.cards, true)).join('');
    const custom = cd.length === 12 ? deckBlock('custom', 'My Deck', cd, true) : `<section class="deckblock"><div class="deckhead"><div><div class="dname">My Deck</div><div class="dsum">${cd.length}/12 cards</div></div><button type="button" class="btn" id="btnBuild">Build it</button></div></section>`;
    ov.innerHTML = `<div class="panel select deckscreen">
      <div class="sb-title">Choose a deck</div>
      <div class="tag">Every card is listed in full. Tap one for the complete preview.</div>
      ${blocks}${custom}
      <div class="go-btns"><button class="btn" id="btnDeckHome">HOME</button></div>
    </div>`;
    ov.querySelectorAll('.deckcard').forEach(btn => {
      btn.onclick = (ev) => { ev.stopPropagation(); inspect(CARDS[btn.dataset.cid], null, true); };
    });
  }
  let collectionGold = false;
  function showCollection() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const draw = () => {
      const cards = CARD_LIST.map(c => COPIES.makeCopy(c.id, {gold: collectionGold}));
      ov.innerHTML = `<div class="panel collection">
        <div class="sb-title">Card Gallery</div>
        <div class="tag">Gold copies are cosmetic. Every toon can have one, and they play the same.</div>
        <label class="goldtoggle"><input type="checkbox" id="goldView" ${collectionGold ? 'checked' : ''}> View gold copies</label>
        <div class="cgrid">${cards.map(c => `<div class="ccard" data-cid="${c.id}">${cardHTML(c, null, true)}</div>`).join('')}</div>
        <div class="go-btns"><button class="btn" id="btnBack">BACK</button></div></div>`;
      $('#goldView').onchange = () => { collectionGold = $('#goldView').checked; draw(); };
      $('#btnBack').onclick = showHome;
      ov.querySelectorAll('.ccard').forEach(node => {
        node.onclick = (ev) => { ev.stopPropagation(); inspect(COPIES.makeCopy(node.dataset.cid, {gold: collectionGold})); };
      });
    };
    draw();
  }
  function showBuilder() {
    let sel = customDeck();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const draw = () => {
      ov.innerHTML = `<div class="panel builder"><div class="sb-title">DECK BUILDER — pick 12 different cards (${sel.length}/12)</div>
      <div class="bgrid">${CARD_LIST.map(c => `<div class="bcard ${sel.includes(c.id) ? 'in' : ''}" data-bid="${c.id}">${cardHTML(c)}</div>`).join('')}</div>
      <div class="go-btns"><button class="btn go" id="btnSaveDeck" ${sel.length === 12 ? '' : 'disabled'}>SAVE & PLAY</button><button class="btn" id="btnBack">BACK</button></div></div>`;
      ov.querySelectorAll('.bcard').forEach(b => {
        b.onclick = () => { const id = b.dataset.bid; if (sel.includes(id)) sel = sel.filter(x => x !== id); else if (sel.length < 12) sel.push(id); draw(); inspect(CARDS[id]); };
        b.onmouseenter = () => inspect(CARDS[b.dataset.bid]);
      });
      $('#btnSaveDeck').onclick = () => { localStorage.setItem('tob_custom', JSON.stringify(sel)); quickStart('custom'); };
      $('#btnBack').onclick = showDeckSelect;
    };
    draw();
  }
  function showRules() {
    const ov = $('#overlay'); ov.classList.remove('hidden');
    ov.innerHTML = `<div class="panel rules"><div class="sb-title">HOW TO PLAY</div><ol>
      <li><b>Decks:</b> 12 different cards each. Every card has a color, points, a power (or none) and features. Both decks are shuffled and each deck's <b>bottom card</b> is shown: its color is a <b>goal color</b>. Black and Silver are not goal colors; if both bottom cards share a color there is just one goal color.</li>
      <li><b>Round 1:</b> You draw 6. Put 4 cards in the 4 inner slots and press READY. Cards flip one by one and are scored.</li>
      <li><b>Cancel-outs:</b> If the same character is in play twice (either board, even your own), the lower-value version survives and the others are cancelled. The exact same card on both boards cancels both.</li>
      <li><b>Powers</b> change points or colors. Multipliers (x2) apply to the printed points first, then bonuses (+3). "Next to" means any touching slot on your side; "opposite" is the card across from it.</li>
      <li><b>Discard</b> 0–2 of your leftover cards and draw back up to 6.</li>
      <li><b>Round 2:</b> Three new slots open below. Play 3 cards; the first 2 flip, the last stays face down.</li>
      <li><b>Swap:</b> You may trade your face-down card for one in your hand for −10 points.</li>
      <li><b>Silver:</b> If you have Silver cards in play, choose one color they all count as.</li>
      <li><b>Winning:</b> With 2 goal colors, having more cards of <b>both</b> colors wins outright. With 1 goal color, whoever has more of it gets +15. Then the higher score wins. Equal scores = tie.</li>
      <li>Every phase has a ${PHASE_SECONDS}-second countdown. If it hits zero, the game finishes the phase for you: empty slots get filled with the best cards from your hand, and you discard nothing.</li></ol>
      <div class="go-btns"><button class="btn go" id="btnClose">GOT IT!</button></div></div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('.usermenu')) closeUserMenu();
    const pop = $('#preview');
    const keep = e.target.closest('.preview-sheet, .handcard, .ccard, .card, .goalcard, .deckcard');
    if (pop && !pop.classList.contains('hidden') && !keep) { pop.classList.add('hidden'); pop.classList.remove('force'); }
    const t = e.target.closest('button, .handcard, .slot, .deckpick, .goalcard');
    if (!t) return;
    if (t.id === 'btnReady') return finishPlay(false);
    if (t.id === 'btnDiscard') return finishDiscard();
    if (t.id === 'btnPreviewClose' || t.id === 'previewBackdrop') { $('#preview').classList.add('hidden'); return; }
    if (t.id === 'btnSwapYes') { G.swapMode = true; setMsg('Tap a card in your hand to put in your last slot (−10).'); setActions('<button class="btn" id="btnSwapNo">CANCEL – NO SWAP</button>'); render(); return; }
    if (t.id === 'btnSwapNo') return afterSwap(null);
    if (t.classList.contains('colorbtn')) return finishSilver(t.dataset.color, G.pendingSilver);
    if (t.id === 'btnAgain' || t.id === 'btnAgain2') return quickStart();
    if (t.id === 'btnHome' || t.id === 'btnDeckHome') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('signup');
      return showHome();
    }
    if (t.id === 'btnPlay' || t.id === 'btnPlayTab') return showDeckSelect();
    if (t.id === 'btnPick' || t.id === 'btnNew') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('signup');
      return showDeckSelect();
    }
    if (t.id === 'btnBoard') { $('#overlay').classList.add('hidden'); return; }
    if (t.id === 'btnBuild') return showBuilder();
    if (t.id === 'btnCollection') return showCollection();
    if (t.id === 'btnRules' || t.id === 'btnRules2') return showRules();
    if (t.id === 'btnClose') {
      if (G && G.phase !== 'OVER') $('#overlay').classList.add('hidden');
      else if (!window.TOB_AUTH.currentUser()) showAuth('signup');
      else showHome();
      return;
    }
    if (t.id === 'btnUser') {
      const menu = $('#userPop');
      const open = menu.classList.toggle('hidden') === false;
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (t.id === 'btnPacks' || t.id === 'btnPacksMenu' || t.id === 'btnGetCards' || t.id === 'btnOpenPacks') return showPacks();
    if (t.id === 'btnHomeCollection') return showMyCollection();
    if (t.id === 'btnAdmin' || t.id === 'btnHomeAdmin') return showAdmin();
    if (t.id === 'btnHomeOut') { doLogOut(); return; }
    if (t.id === 'btnBuyPack') return buyPack();
    if (t.id === 'btnOpenPack' || t.id === 'btnOpenAnother') return openPack();
    if (t.id === 'btnDaily') return claimDaily();
    if (t.id === 'btnRevealAll') return revealAll();
    if (t.classList.contains('pullcard')) return flipPull(+t.dataset.i);
    if (t.id === 'btnViewPackCollection') return showMyCollection();
    if (t.id === 'btnMyCollection') return showMyCollection();
    if (t.id === 'btnLogOut') { doLogOut(); return; }
    if (t.id === 'btnRewardOk') return hideReward();
    if (t.id === 'btnSound' || t.id === 'btnHomeSound') {
      soundOn = !soundOn;
      const on = soundOn ? 'On' : 'Off';
      const soundBtn = $('#btnSound');
      if (soundBtn) soundBtn.innerHTML = `<span class="lbl-full">Sound: ${on}</span><span class="lbl-short">${on}</span>`;
      const homeSound = $('#btnHomeSound');
      if (homeSound) homeSound.textContent = 'Sound: ' + on;
      return;
    }
    if (t.classList.contains('deckplay')) {
      const k = t.dataset.deck;
      if (k === 'custom' && customDeck().length !== 12) return showBuilder();
      return quickStart(k);
    }
    if (t.classList.contains('deckpick')) { const k = t.dataset.deck; if (k === 'custom' && customDeck().length !== 12) return showBuilder(); return quickStart(k); }
    if (!G) return;
    if (t.classList.contains('handcard')) {
      const i = +t.dataset.idx;
      const card = G.pHand[i];
      if (G.phase === 'DISCARD') { if (G.discardSel.has(i)) G.discardSel.delete(i); else if (G.discardSel.size < 2) G.discardSel.add(i); blip(600, .04); render(); if (card) inspect(card); return; }
      if (G.phase === 'SWAP' && G.swapMode) { if (card) inspect(card); return afterSwap(i); }
      if (G.phase.startsWith('PLAY')) {
        if (G.selected === i) { const free = activeSlots().find(s => !G.boards.p[s]); if (free != null) { if (card) inspect(card); return placeCard(i, free); } }
        G.selected = i; render(); if (card) inspect(card); return;
      }
      if (card) inspect(card);
      return;
    }
    if (t.classList.contains('goalcard')) {
      const held = t.querySelector('.card[data-id]');
      if (held && CARDS[held.dataset.id]) inspect(CARDS[held.dataset.id]);
      return;
    }
    if (t.classList.contains('slot')) {
      const held = t.querySelector('.card[data-id]');
      if (held && CARDS[held.dataset.id]) {
        const side = t.dataset.side, si = +t.dataset.slot;
        let info = null;
        if (G.lastEv && G.shown[side] && G.shown[side][si]) info = G.lastEv.cells[side][si];
        inspect(CARDS[held.dataset.id], info);
      }
      if (t.dataset.side !== 'p') return;
      const s = +t.dataset.slot;
      if (G.boards.p[s] && !G.shown.p[s]) return unplace(s);
      if (G.selected >= 0) return placeCard(G.selected, s);
      if (activeSlots().includes(s) && G.pHand.length && G.phase.startsWith('PLAY')) setMsg('Pick a card from your hand first, then tap a slot.');
    }
  });
  document.addEventListener('dblclick', e => {
    if (performance.now() - lastPlace < 500) return;
    const h = e.target.closest('.handcard');
    if (!h || !h.isConnected || !G || !G.phase.startsWith('PLAY')) return;
    const free = activeSlots().find(s => !G.boards.p[s]); if (free != null) placeCard(+h.dataset.idx, free);
  });
  document.addEventListener('dragstart', e => { const h = e.target.closest('.handcard'); if (h) e.dataTransfer.setData('text/plain', h.dataset.idx); });
  document.addEventListener('dragover', e => { const s = e.target.closest('.slot.open'); if (s) { e.preventDefault(); s.classList.add('hover'); } });
  document.addEventListener('dragleave', e => { const s = e.target.closest('.slot'); if (s) s.classList.remove('hover'); });
  document.addEventListener('drop', e => { const s = e.target.closest('.slot.open'); if (!s) return; e.preventDefault(); placeCard(+e.dataTransfer.getData('text/plain'), +s.dataset.slot); });
  document.addEventListener('mouseover', e => {
    if (narrow()) return;
    const c = e.target.closest('.card[data-id]'); if (!c) return;
    const slot = c.closest('.slot'); let info = null;
    if (slot && G && G.lastEv) { const side = slot.dataset.side, i = +slot.dataset.slot; if (G.shown[side][i]) info = G.lastEv.cells[side][i]; }
    inspect(CARDS[c.dataset.id], info);
  });

  window.TOB.renderCopy = cardHTML;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tracked = null;
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.card.gold, .tv-card.gold');
      if (tracked && tracked !== card) tracked.classList.remove('track');
      tracked = card || null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--hx', ((e.clientX - r.left) / r.width * 100).toFixed(1));
      card.style.setProperty('--hy', ((e.clientY - r.top) / r.height * 100).toFixed(1));
      card.classList.add('track');
    }, {passive: true});
  } else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      const x = Math.max(0, Math.min(100, 50 + e.gamma));
      const y = Math.max(0, Math.min(100, 50 + (e.beta || 0) / 2));
      document.documentElement.style.setProperty('--hx', x.toFixed(1));
      document.documentElement.style.setProperty('--hy', y.toFixed(1));
      document.documentElement.classList.add('tilt');
    }, {passive: true});
  }
  inspect(null);
  boot();

  async function boot() {
    try { await window.TOB_AUTH.ready; }
    catch (e) { /* the sign-in screen surfaces initError */ }
    renderUser();
    if (AUTO) {
      if (!window.TOB_AUTH.currentUser()) await window.TOB_AUTH.playAsGuest();
      renderUser();
      await liveProfile();
      quickStart(qs.get('deck') || null);
    } else if (window.TOB_AUTH.currentUser()) {
      await liveProfile();
      showHome();
    } else showAuth('signup');
  }
})();
