/* Toon Orbit Battle — game flow & UI. */
(function () {
  const {CARDS, CARD_LIST, DECKS, COLORS} = window.TOB_CARDS;
  const COPIES = window.TOB_COPIES;
  const E = window.TOB_ENGINE, AI = window.TOB_AI, ART = window.TOB_ART;
  const qs = new URLSearchParams(location.search);
  const AUTO = qs.has('auto'); let autoGames = Math.max(1, parseInt(qs.get('auto') || '1', 10) || 1);
  // ===== CONFIG: seconds on the countdown for every timed phase (placement, discard, swap, silver). =====
  const PHASE_SECONDS = 30;
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
    return `<img class="cartimg" alt="" data-id="${card.id}" src="${src}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" onerror="TOB_ART.useSvg(this)">`;
  }
  function backHTML() { return `<div class="card back"><div class="backlogo"><span>TOON</span><b>ORBIT</b></div></div>`; }

  const narrow = () => matchMedia('(max-width: 1099px)').matches;
  function inspect(card, info) {
    const box = $('#inspector');
    const pop = $('#preview'), body = $('#previewBody');
    if (!card) {
      const idle = '<div class="tv-idle">Tap a card to preview it.</div>';
      box.innerHTML = idle;
      if (body) body.innerHTML = idle;
      if (pop) pop.classList.add('hidden');
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
    if (pop) pop.classList.toggle('hidden', !narrow());
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
  function hidePreview() { const p = $('#preview'); if (p) p.classList.add('hidden'); }
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
  function gameOver() {
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
    if (AUTO && results.length < autoGames) setTimeout(() => quickStart(), 50);
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
  function showDeckSelect() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const cd = customDeck();
    ov.innerHTML = `<div class="panel select">
      <div class="big-logo"><span class="ring"></span>TOON ORBIT <b>BATTLE</b></div>
      <div class="tag">Pick a 12-card deck, match the goal colors, and out-score your rival!</div>
      <div class="decklist">${Object.entries(DECKS).map(([k, d]) => `<div class="deckpick" data-deck="${k}">
        <div class="fan">${d.cards.slice(0, 3).map(id => cardHTML(CARDS[id])).join('')}</div>
        <div class="dname">${d.name}</div><div class="dcolors">${[...new Set(d.cards.map(id => CARDS[id].color))].map(c => `<span class="gem" style="background:${COLORS[c]}"></span>`).join('')}</div></div>`).join('')}
        <div class="deckpick ${cd.length === 12 ? '' : 'dim'}" data-deck="custom"><div class="fan">${cd.slice(0, 3).map(id => cardHTML(CARDS[id])).join('') || '<div class="card back"><div class="backlogo"><span>MY</span><b>DECK</b></div></div>'}</div>
        <div class="dname">My Deck</div><div class="dcolors">${cd.length}/12 cards</div></div></div>
      <div class="go-btns"><button class="btn" id="btnCollection">COLLECTION</button><button class="btn" id="btnBuild">DECK BUILDER</button><button class="btn" id="btnRules2">HOW TO PLAY</button></div></div>`;
  }
  let collectionGold = false;
  function showCollection() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const draw = () => {
      const cards = CARD_LIST.map(c => COPIES.makeCopy(c.id, {gold: collectionGold}));
      ov.innerHTML = `<div class="panel collection">
        <div class="sb-title">Collection</div>
        <div class="tag">Gold copies are cosmetic. Every toon can have one, and they play the same.</div>
        <label class="goldtoggle"><input type="checkbox" id="goldView" ${collectionGold ? 'checked' : ''}> View gold copies</label>
        <div class="cgrid">${cards.map(c => `<div class="ccard" data-cid="${c.id}">${cardHTML(c)}</div>`).join('')}</div>
        <div class="go-btns"><button class="btn" id="btnBack">BACK</button></div></div>`;
      $('#goldView').onchange = () => { collectionGold = $('#goldView').checked; draw(); };
      $('#btnBack').onclick = showDeckSelect;
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
    const pop = $('#preview');
    const keep = e.target.closest('.preview-sheet, .handcard, .ccard, .card, .goalcard');
    if (pop && !pop.classList.contains('hidden') && !keep) pop.classList.add('hidden');
    const t = e.target.closest('button, .handcard, .slot, .deckpick, .goalcard');
    if (!t) return;
    if (t.id === 'btnReady') return finishPlay(false);
    if (t.id === 'btnDiscard') return finishDiscard();
    if (t.id === 'btnPreviewClose' || t.id === 'previewBackdrop') { $('#preview').classList.add('hidden'); return; }
    if (t.id === 'btnSwapYes') { G.swapMode = true; setMsg('Tap a card in your hand to put in your last slot (−10).'); setActions('<button class="btn" id="btnSwapNo">CANCEL – NO SWAP</button>'); render(); return; }
    if (t.id === 'btnSwapNo') return afterSwap(null);
    if (t.classList.contains('colorbtn')) return finishSilver(t.dataset.color, G.pendingSilver);
    if (t.id === 'btnAgain' || t.id === 'btnAgain2') return quickStart();
    if (t.id === 'btnPick' || t.id === 'btnNew') return showDeckSelect();
    if (t.id === 'btnBoard') { $('#overlay').classList.add('hidden'); return; }
    if (t.id === 'btnBuild') return showBuilder();
    if (t.id === 'btnCollection') return showCollection();
    if (t.id === 'btnRules' || t.id === 'btnRules2') return showRules();
    if (t.id === 'btnClose') { if (G && G.phase !== 'OVER') $('#overlay').classList.add('hidden'); else showDeckSelect(); return; }
    if (t.id === 'btnSound') { soundOn = !soundOn; t.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off'); return; }
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
  if (AUTO) quickStart(qs.get('deck') || null); else showDeckSelect();
})();
