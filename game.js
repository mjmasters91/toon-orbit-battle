/* Toon Orbit Battle — game flow & UI. */
(function () {
  const {CARDS, CARD_LIST, DECKS, COLORS} = window.TOB_CARDS;
  const COPIES = window.TOB_COPIES;
  const E = window.TOB_ENGINE, AI = window.TOB_AI, ART = window.TOB_ART;
  const qs = new URLSearchParams(location.search);
  const AUTO = qs.has('auto'); let autoGames = Math.max(1, parseInt(qs.get('auto') || '1', 10) || 1);
  // ===== CONFIG: seconds on the countdown for every timed phase (placement, discard, swap, silver). =====
  const PHASE_SECONDS = 90;
  function clockText(left) {
    left = Math.max(0, left | 0);
    if (left >= 60) {
      const m = Math.floor(left / 60);
      const s = left % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    return String(left);
  }
  const GOLD_CHANCE = 0.03;
  const ECONOMY_DEFAULTS = {winCoins: 100, lossCoins: 25, packPrice: 300, themePrice: 400, themeWeekPrice: 350, auctionFee: 0};
  function readEconomy() {
    const base = {winCoins: ECONOMY_DEFAULTS.winCoins, lossCoins: ECONOMY_DEFAULTS.lossCoins, packPrice: ECONOMY_DEFAULTS.packPrice, themePrice: ECONOMY_DEFAULTS.themePrice, themeWeekPrice: ECONOMY_DEFAULTS.themeWeekPrice, auctionFee: ECONOMY_DEFAULTS.auctionFee};
    try {
      const saved = JSON.parse(localStorage.getItem('tob_economy') || 'null');
      if (!saved) return base;
      ['winCoins', 'lossCoins', 'packPrice', 'themePrice', 'themeWeekPrice', 'auctionFee'].forEach(k => {
        const n = Math.round(Number(saved[k]));
        const capN = k === 'auctionFee' ? 50 : 1000000;
        if (Number.isFinite(n) && n >= 0 && n <= capN) base[k] = n;
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
  window.TOB = {results, get G() { return G; }, clockText, phaseSeconds: PHASE_SECONDS};

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
  function previewFrame(card, info) {
    if (!card) {
      return `<div class="tv-card is-idle">
        <div class="tv-art"></div>
        <div class="tv-name"></div>
        <div class="tv-meta"></div>
        <div class="tv-skill"><div class="tv-idle">Hover a card to see its stats</div></div>
      </div>`;
    }
    const notes = info ? (info.knocked ? [info.knocked] : info.notes) : [];
    return `<div class="tv-card${card.gold ? ' gold' : ''}" style="--cc:${COLORS[card.color]}">
      <div class="tv-art">${faceHTML(card, true)}${card.gold ? '<div class="holo"></div><div class="spark"></div>' : ''}</div>
      <div class="tv-name">${card.name}</div>
      <div class="tv-meta"><span class="gem" style="background:${COLORS[card.color]}"></span>${cap(card.color)} · ${card.pts} pts${card.archetype ? ' · ' + card.archetype : ''}</div>
      <div class="tv-skill">
        ${card.group ? `<div class="tv-group">${card.group}</div>` : ''}
        ${(card.features || []).length ? `<div class="tv-feat">${card.features.join(' · ')}</div>` : ''}
        ${card.power && card.power !== 'No Power' ? `<div class="tv-power">${card.power}</div>` : ''}
        ${(window.TOB_COMBOS ? window.TOB_COMBOS.blurbs(card) : []).map(line => `<div class="tv-combo">${line}</div>`).join('')}
        ${info ? `<div class="tv-live">In play: <b>${info.knocked ? 0 : info.value}</b> pts${notes.length ? '<br>' + notes.join('<br>') : ''}</div>` : ''}
      </div>
    </div>`;
  }
  function matchBoardOn() {
    const ov = $('#overlay');
    return !!(ov && ov.classList.contains('hidden'));
  }
  function inspect(card, info, force) {
    const box = $('#inspector');
    const pop = $('#preview'), body = $('#previewBody');
    const html = previewFrame(card, info);
    box.innerHTML = html;
    if (body) body.innerHTML = html;
    if (pop) {
      if (matchBoardOn()) {
        pop.classList.add('hidden');
        pop.classList.remove('force');
      } else {
        const show = !!(narrow() || force);
        pop.classList.toggle('hidden', !show);
        pop.classList.toggle('force', !!force);
      }
    }
  }

  /* ---------- game state ---------- */
  let G = null, timerId = null, lastPlace = 0;
  function buildDeck(entries) {
    const explicit = (entries || []).some(e => e && typeof e === 'object');
    const copies = (entries || []).map(entry => {
      const id = typeof entry === 'string' ? entry : entry && entry.id;
      const gold = !!(entry && typeof entry === 'object' && entry.gold);
      const uid = entry && typeof entry === 'object' ? entry.uid : null;
      return COPIES.makeCopy(id, {gold, uid: uid || undefined});
    }).filter(Boolean);
    if (!explicit) {
      const n = 1 + (Math.random() < 0.5 ? 1 : 0);
      COPIES.stampGold(copies, n);
    }
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
      swapMode: false, round: 1,       log: [], result: null, seenCombos: new Set(),
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
    const glowing = ev && ev.combos && ev.combos.some(c => c.side === side && c.slots.includes(i));
    let inner = '';
    if (card) {
      if (G.shown[side][i]) inner = cardHTML(card, ev.cells[side][i], true);
      else if (side === 'p') {
        const faceDown = i === 6 && !G.phase.startsWith('PLAY');
        inner = `<div class="pending">${cardHTML(card, null, true)}${faceDown ? '<div class="pend-tag">Face down</div>' : ''}</div>`;
      }
      else inner = backHTML();
    } else inner = `<div class="slotnum">${i + 1}</div>`;
    return `<div class="slot ${isActive && !card ? 'open' : ''} ${hidden ? 'locked' : ''} ${glowing ? 'comboglow' : ''} ${G.swapMode && side === 'p' && i === 6 ? 'swaptarget' : ''}" data-side="${side}" data-slot="${i}">${inner}</div>`;
  }
  function render() {
    if (window.TOB.battleLock) return;
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
    const dot = c => `<span class="gem" style="background:${COLORS[c]}"></span>${cap(c)}`;
    const goalTxt = tg.length === 0 ? 'No goal color — Points only!' : tg.length === 1 ? `Goal color: ${dot(tg[0])} (most cards = +${E.COLOR_BONUS})` : `Goal colors: ${dot(tg[0])} & ${dot(tg[1])} (more of BOTH wins!)`;
    const rows = tg.map(c => `<tr><td><span class="gem" style="background:${COLORS[c]}"></span>${cap(c)}</td><td>${ev.counts.p[c] || 0}</td><td>${ev.counts.o[c] || 0}</td></tr>`).join('');
    const pen = s => G.penalty[s] ? `<div class="pen">−${G.penalty[s]} swap</div>` : '';
    const bon = s => ev.bonus === s ? `<div class="bon">+${E.COLOR_BONUS} color</div>` : '';
    const crew = s => (ev.combos || []).filter(c => c.side === s).map(c => `${c.name} +${c.bonus}`).join(' · ');
    const prev = G.prevScore;
    $('#scoreboard').innerHTML = `
      <div class="sb-title">Score</div>
      <div class="sb-goal">${goalTxt}</div>
      <div class="sb-scores">
        <div class="sb-side me"><div class="sb-name">YOU</div><div class="sb-num" id="sb-p">${ev.score.p}</div>${bon('p')}${pen('p')}${crew('p') ? `<div class="bon crew">${crew('p')}</div>` : ''}</div>
        <div class="sb-vs">VS</div>
        <div class="sb-side opp"><div class="sb-name">${G.oName.toUpperCase()}</div><div class="sb-num" id="sb-o">${ev.score.o}</div>${bon('o')}${pen('o')}${crew('o') ? `<div class="bon crew">${crew('o')}</div>` : ''}</div>
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
      if (window.TOB.battleLock) return;
      t.textContent = clockText(left);
      t.style.setProperty('--p', String(Math.max(0, left) / secs));
      t.setAttribute('aria-label', left + ' seconds left');
      t.className = (left >= 60 ? 'wide' : '') + (left <= 10 ? ' warn' : '');
    };
    tick();
    timerId = setInterval(() => { left--; tick(); if (left <= 0) { stopTimer(); onTimeout(); } }, 1000);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId); timerId = null;
    const t = $('#timer'); t.textContent = ''; t.style.removeProperty('--p'); t.removeAttribute('aria-label');
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function announceCombos() {
    const ev = G && G.lastEv;
    if (!ev || !ev.combos) return;
    const fresh = ev.combos.filter(c => !G.seenCombos.has(c.side + ':' + c.id));
    fresh.forEach(c => G.seenCombos.add(c.side + ':' + c.id));
    if (!fresh.length) return;
    const top = fresh.slice().sort((a, b) => b.bonus - a.bonus)[0];
    let el = document.getElementById('comboCall');
    if (!el) { el = document.createElement('div'); el.id = 'comboCall'; document.body.appendChild(el); }
    el.innerHTML = `<b>${top.name}!</b> <span>+${top.bonus}</span>`;
    el.classList.remove('show', 'obsidian');
    if (String(top.id || '').indexOf('ob_') === 0) el.classList.add('obsidian');
    void el.offsetWidth;
    el.classList.add('show');
  }
  function aiState() { return {boards: G.boards, shown: G.shown, goals: G.goals, penalty: G.penalty, silver: G.silver}; }

  async function flipSeq(list) {
    for (const [side, slot] of list) {
      if (!G.boards[side][slot]) continue;
      G.shown[side][slot] = true; blip(side === 'p' ? 520 : 440, 0.07);
      render();
      announceCombos();
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
    touchRanked();
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
  function copyEntry(entry) {
    if (!entry || !entry.id || !CARDS[entry.id]) return null;
    return COPIES.makeCopy(entry.id, {gold: !!entry.gold});
  }
  function copyList(list) { return (list || []).map(copyEntry).filter(Boolean); }
  function touchRanked() {
    if (G && G.rankedId && window.TOB_PVP && window.TOB_PVP.bumpBotClock) window.TOB_PVP.bumpBotClock(G.rankedId);
  }
  async function playRankedBot(match) {
    window.TOB.battleLock = null;
    const ov = $('#overlay');
    if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; }
    hidePreview();
    const host = (match.state && match.state.host) || {};
    const guest = (match.state && match.state.guest) || {};
    const pGoal = copyEntry(host.goal);
    const oGoal = copyEntry(guest.goal);
    G = {
      phase: 'INTRO', oName: match.bot_name || match.guest_name || 'Orbit Bot',
      pDeck: copyList(host.deck), oDeck: copyList(guest.deck),
      pHand: copyList(host.hand), oHand: copyList(guest.hand),
      pDiscard: [], oDiscard: [],
      goalCards: {p: pGoal, o: oGoal},
      boards: {p: Array(7).fill(null), o: Array(7).fill(null)},
      shown: {p: Array(7).fill(false), o: Array(7).fill(false)},
      penalty: {p: 0, o: 0}, silver: {p: null, o: null},
      selected: -1, discardSel: new Set(), swapMode: false, round: 1,
      log: [], result: null, seenCombos: new Set(),
      rankedId: match.id,
      rankHand: (host.hand || []).map(c => ({id: c.id, gold: !!(c && c.gold)})),
      rankBusy: false,
    };
    G.goals = [pGoal && pGoal.color, oGoal && oGoal.color];
    G.targets = E.targetColors(G.goals);
    render();
    setMsg('Ranked match vs ' + G.oName + '.');
    touchRanked();
    beginPlay(1);
  }
  async function finishRankedPlay(auto) {
    if (!G.phase.startsWith('PLAY') || G.rankBusy) return;
    const slots = activeSlots();
    if (auto) autoFillPlayer(slots);
    if (slots.some(s => !G.boards.p[s])) return;
    G.rankBusy = true;
    stopTimer(); setActions('');
    const hand = (G.rankHand || []).slice();
    const moves = [];
    for (const slot of slots) {
      const card = G.boards.p[slot];
      const idx = hand.findIndex(c => c && c.id === card.id && !!c.gold === !!card.gold);
      if (idx < 0) { G.rankBusy = false; setMsg('That card is not in the dealt hand.'); return; }
      moves.push({t: 'place', slot, hand: idx});
      hand.splice(idx, 1);
    }
    const res = await window.TOB_PVP.commitRanked(G.rankedId, moves);
    G.rankBusy = false;
    if (!res || !res.ok) { beginPlay(G.round); setMsg((res && res.error) || 'The server rejected that round.'); return; }
    const host = res.match.state.host || {};
    const guest = res.match.state.guest || {};
    slots.forEach(s => { G.boards.o[s] = copyEntry(guest.board && guest.board[s]); });
    G.pHand = copyList(host.hand);
    G.pDeck = copyList(host.deck);
    G.oHand = copyList(guest.hand);
    G.oDeck = copyList(guest.deck);
    G.rankHand = (host.hand || []).map(c => ({id: c.id, gold: !!(c && c.gold)}));
    const round = G.round;
    G.phase = round === 1 ? 'REVEAL_1' : 'REVEAL_2';
    setMsg(G.oName + ' is ready… Revealing!');
    render();
    await wait(T.pause);
    const order = round === 1 ? [0, 1, 2, 3] : [4, 5];
    await flipSeq(order.flatMap(i => [['p', i], ['o', i]]));
    const ev = evalNow(false);
    setMsg(`Round ${round} scored: You <b>${ev.score.p}</b> – ${G.oName} <b>${ev.score.o}</b>`);
    await wait(T.pause);
    if (round === 1) beginDiscard(); else beginSwap();
  }
  async function finishPlay(auto) {
    if (G && G.rankedId) return finishRankedPlay(auto);
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
    touchRanked();
    startTimer(T.short, () => { G.discardSel = new Set(); finishDiscard(); }); // time's up = discard nothing
    if (AUTO) setTimeout(() => { if (Math.random() < .5 && G.pHand.length) G.discardSel.add(0); finishDiscard(); }, 10);
  }
  async function finishRankedDiscard() {
    if (G.rankBusy) return;
    G.rankBusy = true;
    stopTimer();
    const res = await window.TOB_PVP.commitRanked(G.rankedId, [{t: 'discard', idx: [...G.discardSel]}]);
    G.rankBusy = false;
    if (!res || !res.ok) { beginDiscard(); setMsg((res && res.error) || 'Discard was rejected.'); return; }
    const host = res.match.state.host || {};
    const guest = res.match.state.guest || {};
    G.pHand = copyList(host.hand);
    G.pDeck = copyList(host.deck);
    G.oHand = copyList(guest.hand);
    G.oDeck = copyList(guest.deck);
    G.rankHand = (host.hand || []).map(c => ({id: c.id, gold: !!(c && c.gold)}));
    G.discardSel = new Set();
    setMsg(G.oName + ' discarded. Hands refilled!');
    render();
    setTimeout(() => beginPlay(2), T.pause);
  }
  function finishDiscard() {
    if (G.phase !== 'DISCARD') return;
    if (G.rankedId) return finishRankedDiscard();
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
    touchRanked();
    startTimer(T.short, () => afterSwap(null));
    if (AUTO) setTimeout(() => afterSwap(Math.random() < .3 ? 0 : null), 10);
  }
  async function afterRankedSwap(handIdx) {
    if (G.phase !== 'SWAP' || G.rankBusy) return;
    G.rankBusy = true;
    stopTimer(); G.swapMode = false;
    const move = {t: 'swap'};
    if (handIdx != null) move.hand = handIdx;
    const res = await window.TOB_PVP.commitRanked(G.rankedId, [move]);
    G.rankBusy = false;
    if (!res || !res.ok) { beginSwap(); setMsg((res && res.error) || 'Swap was rejected.'); return; }
    const host = res.match.state.host || {};
    const guest = res.match.state.guest || {};
    G.boards.p[6] = copyEntry(host.board && host.board[6]);
    G.boards.o[6] = copyEntry(guest.board && guest.board[6]);
    G.pHand = copyList(host.hand);
    G.oHand = copyList(guest.hand);
    G.penalty.p = host.penalty | 0;
    G.penalty.o = guest.penalty | 0;
    setMsg('Swaps locked in.'); setActions(''); render();
    setTimeout(beginSilver, T.pause);
  }
  function afterSwap(handIdx) {
    if (G.rankedId) return afterRankedSwap(handIdx);
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
  function beginRankedSilver() {
    G.phase = 'SILVER';
    const has = s => G.boards[s].some(c => c && c.color === 'silver');
    if (!has('p')) return finishRankedSilver(null);
    setMsg('You have SILVER cards in play! Pick the color all your silver cards will count as.');
    setActions(E.PLAYABLE_COLORS.map(c => `<button class="btn colorbtn" data-color="${c}" style="background:${COLORS[c]}">${cap(c)}</button>`).join(''));
    render();
    touchRanked();
    startTimer(T.short, () => finishRankedSilver(G.targets[0] || 'red'));
  }
  async function finishRankedSilver(color) {
    if (!G || G.phase !== 'SILVER' || G.rankBusy) return;
    G.rankBusy = true;
    stopTimer(); setActions('');
    const move = {t: 'silver'};
    if (color) move.color = color;
    const res = await window.TOB_PVP.commitRanked(G.rankedId, [move]);
    G.rankBusy = false;
    if (!res || !res.ok) { beginRankedSilver(); setMsg((res && res.error) || 'Silver was rejected.'); return; }
    const host = res.match.state.host || {};
    const guest = res.match.state.guest || {};
    G.silver.p = host.silver || null;
    G.silver.o = guest.silver || null;
    G.rankedSummary = {delta: res.match.host_delta, winner: res.match.winner, host: res.match.host};
    G.phase = 'REVEAL_3';
    setMsg('Final cards flipping…');
    render();
    await wait(T.pause / 2);
    await flipSeq([['p', 6], ['o', 6]]);
    gameOver();
  }
  function beginSilver() {
    if (G.rankedId) return beginRankedSilver();
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
    const ranked = !!(G && G.rankedId);
    const delta = ranked && G.rankedSummary ? G.rankedSummary.delta : null;
    const rating = delta == null ? '' : `<div class="go-how">Rating ${delta > 0 ? '+' : ''}${delta}</div>`;
    ov.innerHTML = `<div class="panel gameover ${r.winner === 'p' ? 'win' : r.winner === 'o' ? 'lose' : 'tie'}">
      <div class="go-title">${title}</div><div class="go-how">${how}</div>
      ${rating}
      <div class="go-scores">${pill('p', 'You')}${pill('o', G.oName)}</div>
      ${ev.targets.length ? `<div class="go-colors">${ev.targets.map(c => `<div class="go-color"><span class="gem" style="background:${COLORS[c]}"></span>${cap(c)} cards: You ${ev.counts.p[c] || 0} · ${G.oName} ${ev.counts.o[c] || 0}</div>`).join('')}</div>` : ''}
      <div class="go-btns">${ranked ? '<button class="btn go" id="btnRankedBack">BACK TO RANKED</button>' : '<button class="btn go" id="btnAgain">PLAY AGAIN</button><button class="btn" id="btnPick">CHANGE DECK</button>'}<button class="btn" id="btnBoard">VIEW BOARD</button></div></div>`;
    blip(r.winner === 'p' ? 990 : 220, 0.4, 'triangle', 0.08);
    setMsg(title + ' ' + how); setActions(ranked ? '<button class="btn go" id="btnRankedBack2">BACK TO RANKED</button>' : '<button class="btn go" id="btnAgain2">PLAY AGAIN</button>');
    window.TOB_DONE = results.length;
    let outcome = null;
    try { outcome = ranked ? null : await recordResult(r); }
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
    const user = window.TOB_AUTH.currentUser();
    const account = !!(user && !user.guest);
    const out = $('#btnLogOut');
    const inn = $('#btnNavLogin');
    if (out) out.classList.toggle('hidden', !account);
    if (inn) inn.classList.toggle('hidden', account);
    const bal = $('#coinBal');
    if (bal) bal.classList.toggle('hidden', !user);
    const adminBtn = $('#btnAdmin');
    if (adminBtn) adminBtn.classList.toggle('hidden', !user || packState.role !== 'admin');
    closeUserMenu();
    paintOrbit();
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
      if (!rec || !CARDS[rec.id] || CARDS[rec.id].adminOnly) return;
      ids.add(rec.id);
      if (rec.gold) gold++;
    });
    return {unique: ids.size, total: CARD_LIST.length, gold};
  }
  function isOnlinePlayer() {
    const user = window.TOB_AUTH.currentUser && window.TOB_AUTH.currentUser();
    return !!(user && !user.guest && window.TOB_AUTH.mode === 'supabase');
  }
  async function recordResult(r) {
    if (!window.TOB_AUTH.currentUser()) return null;
    if (isOnlinePlayer()) {
      const result = r.winner === 'p' ? 'win' : r.winner === 'o' ? 'loss' : 'tie';
      const res = await window.TOB_AUTH.recordMatch(result, lastDeck);
      if (!res || !res.ok) { toast((res && res.error) || 'Could not save the match.'); return null; }
      const profile = await window.TOB_AUTH.loadProfile();
      if (profile) rememberPacks(profile);
      const data = res.data || {};
      return {reward: data.reward || null, gained: data.gained | 0};
    }
    const profile = await window.TOB_AUTH.loadProfile();
    if (!profile) return null;
    profile.stats = profile.stats || {wins: 0, losses: 0, games: 0};
    profile.stats.games = (profile.stats.games | 0) + 1;
    let reward = null;
    if (r.winner === 'p') {
      profile.stats.wins = (profile.stats.wins | 0) + 1;
      profile.stats.streak = (profile.stats.streak | 0) + 1;
      profile.stats.bestStreak = Math.max(profile.stats.bestStreak | 0, profile.stats.streak);
      reward = randomReward();
      profile.collection = (profile.collection || []).concat([reward]);
    } else {
      if (r.winner === 'o') profile.stats.losses = (profile.stats.losses | 0) + 1;
      profile.stats.streak = 0;
    }
    profile.stats.decks = profile.stats.decks || {};
    if (lastDeck) profile.stats.decks[lastDeck] = (profile.stats.decks[lastDeck] | 0) + 1;
    profile.stats.archetypes = profile.stats.archetypes || {};
    if (G && G.boards && G.shown) {
      G.boards.p.forEach((card, i) => {
        if (!card || !G.shown.p[i] || !card.archetype) return;
        profile.stats.archetypes[card.archetype] = (profile.stats.archetypes[card.archetype] | 0) + 1;
      });
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
  function deckImportAnswers() {
    try {
      const saved = JSON.parse(localStorage.getItem('tob_deck_import_choice') || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) { return {}; }
  }
  async function offerLocalDeckImport() {
    if (!isOnlinePlayer()) return;
    const me = window.TOB_AUTH.currentUser();
    let deck = [];
    try { deck = JSON.parse(localStorage.getItem('tob_custom') || '[]'); } catch (e) { deck = []; }
    if (!Array.isArray(deck) || !deck.length) return;
    const answers = deckImportAnswers();
    if (answers[me.id] === 'yes' || answers[me.id] === 'no' || localStorage.getItem('tob_deck_imported') === me.id) return;
    const yes = window.confirm('Import your local deck layout onto this account? Coins and cards are not imported.');
    answers[me.id] = yes ? 'yes' : 'no';
    localStorage.setItem('tob_deck_import_choice', JSON.stringify(answers));
    if (!yes) return;
    localStorage.setItem('tob_deck_imported', me.id);
    const res = await window.TOB_AUTH.saveDeck(deck);
    toast(res && res.ok ? 'Imported your deck layout.' : ((res && res.error) || 'Could not import the deck.'));
  }
  async function doLogOut() {
    closeUserMenu();
    try { await window.TOB_AUTH.logOut(); } catch (e) { /* leave the table anyway */ }
    if (window.TOB_TRADES && window.TOB_TRADES.reset) window.TOB_TRADES.reset();
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
    const soon = !!window.TOB_AUTH.onlineSoon;
    const signup = authMode !== 'login';
    const guest = window.TOB_AUTH.peekGuest();
    const claim = !!(guest && ((guest.collection && guest.collection.length) || (guest.stats && (guest.stats.games || guest.stats.wins || guest.stats.losses))));
    const decks = Object.entries(DECKS).filter(([, d]) => !d.ai).map(([k, d]) => {
      const gems = [...new Set(d.cards.map(id => CARDS[id].color))].map(c => `<span class="gem" style="background:${COLORS[c]}"></span>`).join('');
      return `<button type="button" class="starterpick${starterPick === k ? ' on' : ''}" data-starter="${k}"><span class="dname">${d.name}</span><span class="dcolors">${gems}</span></button>`;
    }).join('');
    const tag = soon
      ? 'Online accounts coming soon. Play is saved on this device for now.'
      : remote
        ? (signup ? 'Pick a username and password. Your toons are saved online.' : 'Log in with your username and password.')
        : (signup ? 'Accounts stay on this device. Guest toons move over when you sign up.' : 'Welcome back. Your collection is saved on this device.');
    ov.innerHTML = `<div class="panel auth">
      <div class="big-logo"><span class="ring"></span>TOON ORBIT <b>BATTLE</b></div>
      <div class="tag">${window.TOB_AUTH.initError || tag}</div>
      <div class="auth-tabs">
        <button type="button" class="btn${signup ? ' go' : ''}" id="tabSignUp">Sign up</button>
        <button type="button" class="btn${signup ? '' : ' go'}" id="tabLogIn">Log in</button>
      </div>
      <div class="auth-form">
        <label class="field">Username<input id="authUser" type="text" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
        <label class="field">Password<input id="authPass" type="password" maxlength="128" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        ${signup ? `<div class="field-label">Starter deck</div><div class="starter-grid">${decks}</div>` : ''}
        ${claim && !signup ? '<p class="auth-claim">You have guest toons. Sign up to keep them.</p>' : ''}
        ${signup && claim && !remote ? '<p class="auth-claim" id="authClaim">Your guest cards and record will move to this account.</p>' : ''}
        ${remote ? '<p class="auth-claim">Coins and cards are not copied from this device. You can import a local deck layout after you log in.</p>' : ''}
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
      if (!openHashedPage()) showHome();
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
          if (remote) {
            const started = await window.TOB_AUTH.chooseStarter(starterPick);
            if (!started.ok) { errBox.textContent = started.error || 'Could not grant the starter deck.'; return; }
          } else {
          const profile = await window.TOB_AUTH.loadProfile();
          profile.starterDeck = starterPick;
          const starter = starterRecords(starterPick);
          const hasGuest = !!(guestSnap && ((guestSnap.collection && guestSnap.collection.length) || (guestSnap.stats && (guestSnap.stats.games || guestSnap.stats.wins || guestSnap.stats.losses)) || guestSnap.welcomeGranted || (guestSnap.packs | 0) > 0));
          if (hasGuest) {
            profile.collection = starter.concat(guestSnap.collection || []);
            profile.stats.wins += (guestSnap.stats && guestSnap.stats.wins) || 0;
            profile.stats.losses += (guestSnap.stats && guestSnap.stats.losses) || 0;
            profile.stats.games += (guestSnap.stats && guestSnap.stats.games) || 0;
            profile.stats.packsOpened = (guestSnap.stats && guestSnap.stats.packsOpened) || 0;
            profile.stats.auctionsSold = (guestSnap.stats && guestSnap.stats.auctionsSold) || 0;
            profile.stats.auctionsWon = (guestSnap.stats && guestSnap.stats.auctionsWon) || 0;
            profile.stats.streak = (guestSnap.stats && guestSnap.stats.streak) || 0;
            profile.stats.bestStreak = (guestSnap.stats && guestSnap.stats.bestStreak) || 0;
            profile.stats.decks = (guestSnap.stats && guestSnap.stats.decks) || {};
            profile.stats.archetypes = (guestSnap.stats && guestSnap.stats.archetypes) || {};
            profile.avatar = guestSnap.avatar || null;
            profile.showcase = guestSnap.showcase || [];
            profile.friends = guestSnap.friends || [];
            const guestWelcome = guestSnap.welcomeGranted === true;
            profile.packs = (guestSnap.packs | 0) + (guestWelcome ? 0 : 3);
            profile.welcomeGranted = true;
            profile.coins = guestSnap.coins | 0;
            profile.lastDaily = typeof guestSnap.lastDaily === 'string' ? guestSnap.lastDaily : null;
          } else profile.collection = starter;
          const saved = await window.TOB_AUTH.saveProfile(profile);
          if (!saved.ok) { errBox.textContent = saved.error || 'Could not save your collection.'; return; }
          if (hasGuest) window.TOB_AUTH.clearGuest();
          }
        } else {
          const res = await window.TOB_AUTH.logIn(creds);
          if (!res.ok) { errBox.textContent = res.error; return; }
        }
        await offerLocalDeckImport();
        renderUser();
        await liveProfile();
        if (!openHashedPage()) showHome();
      } catch (e) {
        errBox.textContent = (e && e.message) ? e.message : 'Something went wrong. If Confirm email is on, turn it off in Supabase Auth settings, then try again.';
      } finally {
        if (btn.isConnected) { btn.disabled = false; btn.textContent = prev; }
      }
    };
  }
  let mineFilter = 'all';
  let archFilter = '';
  let comboOnly = false;
  function archOptions() {
    const names = [...new Set(CARD_LIST.map(c => c.archetype).filter(Boolean))].sort();
    return `<select id="archPick" class="archpick" aria-label="Archetype"><option value="">All archetypes</option>${names.map(a => `<option value="${a}"${archFilter === a ? ' selected' : ''}>${a}</option>`).join('')}</select>`;
  }
  function showMyCollection() {
    stopTimer();
    hidePreview();
    closeUserMenu();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const draw = async () => {
      hidePackTip();
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
      tipOwnedIds = new Set(byId.keys());
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
        if (archFilter && c.archetype !== archFilter) return false;
        return true;
      });
      const cells = cards.map(c => {
        const group = byId.get(c.id);
        if (!group || !group.count) {
          return `<div class="ccard locked" data-cid="${c.id}"><div class="card silhouette" style="--cc:${COLORS[c.color]}"><div class="lockmark" aria-hidden="true"></div></div></div>`;
        }
        const copy = COPIES.makeCopy(group.sample.id, {gold: group.gold > 0, uid: group.sample.uid});
        const badge = group.count > 1 ? `<div class="copycount">${group.count}</div>` : '';
        return `<div class="ccard" data-cid="${c.id}" data-gold="${copy.gold ? '1' : '0'}">${badge}${cardHTML(copy)}</div>`;
      }).join('');
      ov.innerHTML = `<div class="panel mine">
        <div class="sb-title">My Collection</div>
        <div class="progress-line" id="colProgress">${stats.unique} / ${stats.total} collected, ${stats.gold} gold</div>
        <div class="mine-stats">${sinceTxt ? 'Since ' + sinceTxt + ' · ' : ''}${profile.stats.wins | 0} wins · ${profile.stats.losses | 0} losses · ${profile.stats.games | 0} games</div>
        <div class="filters">${filters.map(([id, label]) => `<button type="button" class="btn filter${mineFilter === id ? ' on' : ''}" data-filter="${id}">${label}</button>`).join('')}</div>
        ${archOptions()}
        ${cells ? `<div class="cgrid">${cells}</div>` : '<p class="tag">Nothing in this filter yet.</p>'}
        <div class="go-btns"><button type="button" class="btn" id="btnMineBack">BACK</button></div>
      </div>`;
      ov.querySelectorAll('[data-filter]').forEach(btn => { btn.onclick = () => { mineFilter = btn.dataset.filter; draw(); }; });
      const archPick = $('#archPick');
      if (archPick) archPick.onchange = () => { archFilter = archPick.value; draw(); };
      $('#btnMineBack').onclick = () => {
        if (G && G.phase !== 'OVER' && G.phase !== 'INTRO') $('#overlay').classList.add('hidden');
        else showHome();
      };
      ov.querySelectorAll('.ccard').forEach(node => {
        node.onclick = (ev) => {
          ev.stopPropagation();
          if (node.classList.contains('locked')) return;
          if (!packCanHover()) showCollectionTip(node);
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
  let currentPackTheme = null;
  let pullOwnedBefore = new Set();
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
    siteProfile = profile || null;
    paintFriendBadge();
    paintOrbit();
  }
  let siteProfile = null;
  let shopTab = 'packs';
  let friendIncoming = 0;
  function paintFriendBadge() {
    document.querySelectorAll('[data-friendbadge]').forEach(el => {
      el.textContent = friendIncoming ? String(friendIncoming) : '';
      el.classList.toggle('on', friendIncoming > 0);
    });
  }
  async function refreshFriendBadge() {
    const user = window.TOB_AUTH.currentUser();
    if (!user || user.guest || window.TOB_AUTH.mode !== 'supabase' || !window.TOB_AUTH.listFriendRequests) {
      friendIncoming = 0;
      paintFriendBadge();
      return 0;
    }
    const rows = await window.TOB_AUTH.listFriendRequests();
    friendIncoming = rows.filter(row => row.direction === 'in').length;
    paintFriendBadge();
    return friendIncoming;
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
    if (packState.role === 'admin' && window.TOB_OBSIDIAN && window.TOB_AUTH.mode !== 'supabase') {
      const have = new Set((profile.collection || []).map(r => r.id + (r.gold ? ':g' : ':s')));
      let added = false;
      window.TOB_OBSIDIAN.forEach(c => {
        ['s', 'g'].forEach(kind => {
          if (have.has(c.id + ':' + kind)) return;
          const copy = COPIES.makeCopy(c.id, {gold: kind === 'g'});
          if (!copy) return;
          profile.collection = (profile.collection || []).concat([{id: copy.id, gold: !!copy.gold, uid: copy.uid}]);
          added = true;
        });
      });
      if (added) {
        const saved = await window.TOB_AUTH.saveProfile(profile);
        if (saved && saved.ok) profile = await window.TOB_AUTH.loadProfile();
        rememberPacks(profile);
      }
    }
    return profile;
  }
  const THEME_LOOK = {
    'Barnyard': {icon: '🐄', hue: 48},
    'Candy Folk': {icon: '🍬', hue: 330},
    'Critters': {icon: '🐾', hue: 28},
    'Dinos': {icon: '🦕', hue: 92},
    'Dragons': {icon: '🐉', hue: 8},
    'Elementals': {icon: '🔥', hue: 18},
    'Fairies': {icon: '🧚', hue: 300},
    'Galaxy': {icon: '🌌', hue: 250},
    'Ghosts': {icon: '👻', hue: 262},
    'Knights': {icon: '🛡️', hue: 45},
    'Ninjas': {icon: '🥷', hue: 222},
    'Pirates': {icon: '🏴‍☠️', hue: 200},
    'Robots': {icon: '🤖', hue: 188},
    'Sea Creatures': {icon: '🐙', hue: 168},
    'Space Aliens': {icon: '👽', hue: 128},
    'Spooks': {icon: '🎃', hue: 280},
    'Sprouts': {icon: '🌱', hue: 110},
    'Toons': {icon: '🎬', hue: 36},
    'Undead': {icon: '💀', hue: 140},
    'Wizards': {icon: '🧙', hue: 268},
  };
  let weekKeyOverride = '';
  function isoWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function liveThemes() {
    const seen = {};
    CARD_LIST.forEach(c => {
      if (!c || !c.archetype || c.adminOnly || String(c.id).indexOf('ob_') === 0) return;
      seen[c.archetype] = true;
    });
    return Object.keys(seen).sort().map(key => {
      const look = THEME_LOOK[key] || {icon: '✦', hue: 24};
      return {key, icon: look.icon, hue: look.hue};
    });
  }
  function weekPack() {
    const packs = liveThemes();
    if (!packs.length) return null;
    if (weekKeyOverride) return packs.find(theme => theme.key === weekKeyOverride) || {key: weekKeyOverride, icon: '✦', hue: 24};
    const n = isoWeekNumber(new Date());
    return packs[(Math.max(1, n) - 1) % packs.length];
  }
  async function refreshWeekPack() {
    weekKeyOverride = '';
    if (!window.TOB_AUTH || window.TOB_AUTH.mode !== 'supabase' || !window.TOB_AUTH.rpc) return;
    const res = await window.TOB_AUTH.rpc('current_week_pack');
    if (res && res.ok && typeof res.data === 'string' && res.data) weekKeyOverride = res.data;
  }
  function priceForTheme(key) {
    const full = ECONOMY.themePrice | 0;
    const week = weekPack();
    if (week && week.key === key) return ECONOMY.themeWeekPrice | 0;
    return full;
  }
  function escPack(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  }
  function publicPool(archetype) {
    let pool = CARD_LIST.filter(c => c && !c.adminOnly && String(c.id).indexOf('ob_') !== 0);
    if (archetype) pool = pool.filter(c => c.archetype === archetype);
    return pool;
  }
  function rollPack(ownedIds, archetype) {
    const pool = publicPool(archetype);
    const ids = pool.map(c => c.id);
    const unowned = ids.filter(id => !ownedIds.has(id));
    const pulls = [];
    const forceAt = unowned.length ? Math.floor(Math.random() * 5) : -1;
    for (let i = 0; i < 5; i++) {
      const id = i === forceAt ? unowned[Math.floor(Math.random() * unowned.length)] : ids[Math.floor(Math.random() * ids.length)];
      const gold = Math.random() < GOLD_CHANCE;
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
  function foilMarkup(theme) {
    const bits = Array.from({length: 8}, (_, i) => `<i style="--i:${i}"></i>`).join('');
    const icon = theme ? `<div class="foil-icon" aria-hidden="true">${theme.icon}</div>` : '<span class="foil-planet" aria-hidden="true"></span>';
    const label = theme ? escPack(theme.key) : 'TOON PACK';
    return `<div class="foil-sheen"></div><div class="foil-tear"></div>
      <div class="foil-face"><div class="foil-brand">${icon}<span class="foil-words">TOON ORBIT <b>BATTLE</b></span></div><div class="foil-sub">${label}</div></div>
      <div class="foil-bits">${bits}</div>`;
  }
  function foilEl(theme, extra) {
    const cls = 'foilpack' + (theme ? ' theme' : '') + (extra ? ' ' + extra : '');
    const style = theme ? ` style="--ph:${theme.hue}"` : '';
    return `<div class="${cls}"${style}>${foilMarkup(theme)}</div>`;
  }
  function goldBurst() {
    packSound('gold');
    try { if (navigator.vibrate) navigator.vibrate([28, 36, 70]); } catch (e) { /* no haptic */ }
    if (reduceMotion()) return;
    const flash = el('div', 'goldflash');
    const ray = el('div', 'goldray');
    document.body.appendChild(flash);
    document.body.appendChild(ray);
    setTimeout(() => { flash.remove(); ray.remove(); }, 720);
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
      await refreshWeekPack();
      const claimed = profile.lastDaily === todayKey();
      const coins = profile.coins | 0;
      const week = weekPack();
      const full = ECONOMY.themePrice | 0;
      const themes = liveThemes().filter(theme => !week || theme.key !== week.key);
      const packArt = theme => foilEl(theme, 'mini');
      const priceLine = theme => {
        const price = priceForTheme(theme.key);
        const sale = week && theme.key === week.key && price < full;
        return `<div class="shop-price">${sale ? `<s>${full}</s> ` : ''}<span class="coinicon" aria-hidden="true"></span> ${price}</div>`;
      };
      const buyBtn = theme => {
        const price = priceForTheme(theme.key);
        return `<button type="button" class="btn go" data-buytheme="${escPack(theme.key)}" ${coins >= price ? '' : 'disabled'}>Buy &amp; Open</button>`;
      };
      const poolFor = key => CARD_LIST.filter(c => isPublicCard(c.id) && (!key || c.archetype === key));
      const oddsHTML = cards => {
        const n = cards.length || 1;
        const parts = ['Common', 'Uncommon', 'Rare', 'Legendary'].map(name => {
          const hit = cards.filter(c => rarityName(c) === name).length;
          if (!hit) return '';
          return name + ' ' + Math.round(hit / n * 100) + '%';
        }).filter(Boolean);
        return `<div class="odds-line">5 cards per pack</div><div class="odds-line">Each card: ${parts.join(' · ')}</div>`;
      };
      const packCard = (theme, weekFlag) => `<article class="shop-pack${weekFlag ? ' week' : ''}">
          ${weekFlag ? '<div class="weekbadge">PACK OF THE WEEK</div>' : ''}
          ${packArt(theme)}
          <div class="shop-name">${theme.icon} ${escPack(theme.key)}</div>
          ${oddsHTML(poolFor(theme.key))}
          ${priceLine(theme)}
          ${buyBtn(theme)}
        </article>`;
      const hero = week ? packCard(week, true) : '';
      const grid = themes.map(theme => packCard(theme, false)).join('');
      const cardsPane = `<section class="pack-shop"><p class="shop-note">Singles are not sold here. Win them in packs, or bid in the auction house.</p><button type="button" class="btn" id="btnShopGallery">Card Gallery</button></section>`;
      const packsPane = `<section class="pack-hold">
          ${foilEl(null, 'idle mini')}
          <div class="progress-line" id="packCount">${profile.packs | 0} standard pack${(profile.packs | 0) === 1 ? '' : 's'} waiting</div>
          <div class="go-btns">
            <button type="button" class="btn" id="btnOpenPack" ${(profile.packs | 0) < 1 ? 'disabled' : ''}>Open pack</button>
            <button type="button" class="btn" id="btnDaily" ${claimed ? 'disabled' : ''}>${claimed ? 'Daily pack claimed' : 'Claim daily pack'}</button>
          </div>
        </section>
        <div class="shop-grid">${hero}<article class="shop-pack standard">
          ${foilEl(null, 'mini')}
          <div class="shop-name">Standard pack</div>
          ${oddsHTML(poolFor(null))}
          <div class="shop-price"><span class="coinicon" aria-hidden="true"></span> ${ECONOMY.packPrice | 0}</div>
          <div class="go-btns">
            <button type="button" class="btn go" id="btnBuyOpenPack" ${coins < (ECONOMY.packPrice | 0) ? 'disabled' : ''}>Buy &amp; Open</button>
            <button type="button" class="btn" id="btnBuyPack" ${coins < (ECONOMY.packPrice | 0) ? 'disabled' : ''}>Buy</button>
          </div>
        </article>${grid}</div>
        <p class="tag">Each copy has a ${Math.round(GOLD_CHANCE * 100)}% chance to be gold. A Buy keeps the pack unopened. Themed packs open right away.</p>`;
      ov.innerHTML = `<div id="packScreen">
        <div class="shop-tabs">
          <button type="button" class="btn${shopTab === 'packs' ? ' go' : ''}" id="btnShopPacks">Packs</button>
          <button type="button" class="btn${shopTab === 'cards' ? ' go' : ''}" id="btnShopCards">Cards</button>
        </div>
        <h1 class="shop-title">Toon Orbit Battle Shop</h1>
        ${shopTab === 'cards' ? cardsPane : packsPane}
      </div>`;
    };
    draw();
  }
  async function claimDaily() {
    if (isOnlinePlayer()) {
      const res = await window.TOB_AUTH.claimDaily();
      if (!res || !res.ok) { toast((res && res.error) || 'Could not claim the daily pack.'); return; }
      const profile = await window.TOB_AUTH.loadProfile();
      if (profile) rememberPacks(profile);
      packSound('daily');
      showPacks();
      return;
    }
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
  async function buyPack(andOpen) {
    if (isOnlinePlayer()) {
      const res = await window.TOB_AUTH.buyPack();
      if (!res || !res.ok) { toast((res && res.error) || 'Could not buy a pack.'); return; }
      const profile = await window.TOB_AUTH.loadProfile();
      if (profile) rememberPacks(profile);
      packSound('daily');
      if (andOpen) return openPack();
      showPacks();
      return;
    }
    const profile = await liveProfile();
    if (!profile) return;
    if ((profile.coins | 0) < (ECONOMY.packPrice | 0)) return;
    profile.coins = (profile.coins | 0) - (ECONOMY.packPrice | 0);
    profile.packs = (profile.packs | 0) + 1;
    const saved = await window.TOB_AUTH.saveProfile(profile);
    if (!saved || !saved.ok) return;
    rememberPacks(profile);
    packSound('daily');
    if (andOpen) return openPack();
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
  function rankName(wins) {
    if (wins >= 20) return 'Legend';
    if (wins >= 5) return 'Pro';
    return 'Rookie';
  }
  function ownedIndex(profile) {
    const by = new Map();
    (profile.collection || []).forEach(rec => {
      if (!rec || !CARDS[rec.id]) return;
      let group = by.get(rec.id);
      if (!group) { group = {id: rec.id, count: 0, gold: false}; by.set(rec.id, group); }
      group.count++;
      if (rec.gold) group.gold = true;
    });
    return by;
  }
  function isPublicCard(id) {
    if (!id || String(id).indexOf('ob_') === 0) return false;
    const card = CARDS[id];
    return !!(card && !card.adminOnly);
  }
  function autoShowcase(profile) {
    return [...ownedIndex(profile).values()].filter(row => isPublicCard(row.id)).sort((a, b) => (b.gold - a.gold) || (a.count - b.count) || ((CARDS[b.id].pts | 0) - (CARDS[a.id].pts | 0)) || a.id.localeCompare(b.id)).slice(0, 6);
  }
  function topKey(map) {
    let best = '', n = 0;
    Object.keys(map || {}).forEach(k => { if ((map[k] | 0) > n) { n = map[k] | 0; best = k; } });
    return best;
  }
  function favoriteArchetype(profile) {
    const played = topKey(profile.stats && profile.stats.archetypes);
    if (played) return played;
    const owned = {};
    (profile.collection || []).forEach(rec => {
      const card = CARDS[rec.id];
      if (!card || !card.archetype) return;
      owned[card.archetype] = (owned[card.archetype] || 0) + 1;
    });
    return topKey(owned) || '—';
  }
  function favoriteDeck(profile) {
    const key = topKey(profile.stats && profile.stats.decks);
    if (!key) return '—';
    if (key === 'custom') return 'My Deck';
    return (DECKS[key] && DECKS[key].name) || key;
  }
  async function showProfile(who, opts) {
    opts = opts || {};
    stopTimer();
    hidePreview();
    closeUserMenu();
    const me = window.TOB_AUTH.currentUser();
    if (!me) return showAuth('login');
    const mine = !who || String(who).toLowerCase() === String(me.username || '').toLowerCase();
    let profile = mine ? await window.TOB_AUTH.loadProfile() : await window.TOB_AUTH.loadPublicProfile(who);
    if (!profile) { toast('No profile with that name on this device'); return opts.back === 'admin' ? showAdmin() : showHome(); }
    const editable = mine;
    let picking = false;
    let avatarPick = false;
    let friendNote = '';
    let friendNoteBad = false;
    const draw = async () => {
      if (mine) profile = await window.TOB_AUTH.loadProfile();
      if (!profile) return showHome();
      const owned = ownedIndex(profile);
      const avatarId = (profile.avatar && isPublicCard(profile.avatar) && owned.has(profile.avatar)) ? profile.avatar : ((autoShowcase(profile)[0] && autoShowcase(profile)[0].id) || 'zoomer');
      const pinned = (profile.showcase || []).filter(id => isPublicCard(id) && (owned.has(id) || !mine));
      const shown = pinned.length ? pinned.slice(0, 6) : autoShowcase(profile).map(c => c.id);
      const s = profile.stats || {};
      const wins = s.wins | 0, losses = s.losses | 0, games = s.games | 0;
      const pct = games ? Math.round((wins / games) * 100) : 0;
      const col = collectionStats(profile);
      const copies = (profile.collection || []).length;
      const since = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}) : '—';
      const stage = (id, on) => {
        const rec = owned.get(id) || {gold: false};
        const copy = COPIES.makeCopy(id, {gold: !!rec.gold});
        return copy ? `<button type="button" class="prof-card${on ? ' on' : ''}" data-id="${id}">${cardHTML(copy, null, true)}</button>` : '';
      };
      const showcase = (picking ? [...owned.keys()].filter(isPublicCard) : shown.filter(isPublicCard)).map(id => stage(id, picking && (profile.showcase || []).includes(id))).join('') || '<p class="prof-note">No cards yet. Open a pack to fill this shelf.</p>';
      const avatars = avatarPick ? `<div class="prof-avatars">${[...owned.keys()].filter(isPublicCard).map(id => `<button type="button" class="prof-mini${id === profile.avatar ? ' on' : ''}" data-ava="${id}"><img src="assets/cards/${encodeURIComponent(id)}.webp" alt=""></button>`).join('')}</div>` : '';
      const friends = editable ? await window.TOB_AUTH.listFriends() : [];
      const onlineFriends = editable && window.TOB_AUTH.mode === 'supabase' && !me.guest;
      let requests = [];
      if (onlineFriends && window.TOB_AUTH.listFriendRequests) requests = await window.TOB_AUTH.listFriendRequests();
      const incoming = requests.filter(row => row.direction === 'in');
      const outgoing = requests.filter(row => row.direction === 'out');
      if (onlineFriends) { friendIncoming = incoming.length; paintFriendBadge(); }
      const requestHtml = onlineFriends ? `<div class="prof-h">INCOMING REQUESTS</div>
          <ul class="prof-friends">${incoming.map(row => `<li><span>${liveEsc(row.username)}</span><button type="button" class="btn go" data-accept="${row.id}">Accept</button><button type="button" class="btn" data-decline="${row.id}">Decline</button></li>`).join('') || '<li class="prof-note">No incoming requests.</li>'}</ul>
          <div class="prof-h">SENT REQUESTS</div>
          <ul class="prof-friends">${outgoing.map(row => `<li><span>${liveEsc(row.username)}</span><span class="prof-pending">Pending</span><button type="button" class="btn" data-cancel="${row.id}">Cancel</button></li>`).join('') || '<li class="prof-note">No sent requests.</li>'}</ul>` : '';
      const friendHtml = editable ? `<section class="prof-block prof-friendsblock">
          <div class="prof-h">FRIENDS</div>
          <form class="prof-add" id="friendForm"><input id="friendName" maxlength="16" placeholder="Username" aria-label="Friend username"><button type="submit" class="btn go">Add</button></form>
          <p class="${friendNoteBad ? 'prof-err' : 'prof-note'}" id="friendErr">${liveEsc(friendNote)}</p>
          ${requestHtml}
          ${onlineFriends ? '<label class="pvp-private"><input type="checkbox" id="friendPrivate"> Private match</label>' : ''}
          <ul class="prof-friends">${friends.map(name => `<li><span>${liveEsc(name)}</span><button type="button" class="btn" data-challenge="${liveEsc(name)}">Challenge</button><button type="button" class="btn" data-view="${liveEsc(name)}">View</button><button type="button" class="btn" data-drop="${liveEsc(name)}">Remove</button></li>`).join('') || '<li class="prof-note">No friends yet.</li>'}</ul>
          ${onlineFriends ? '' : '<p class="prof-note">Friend requests use an online account. On this device, only usernames registered here can be found.</p>'}
        </section>` : '';
      let pvpHist = '';
      if (editable && window.TOB_AUTH.mode === 'supabase' && window.TOB_AUTH.rpc) {
        const hist = await window.TOB_AUTH.rpc('pvp_history');
        if (hist && hist.ok && Array.isArray(hist.data) && hist.data.length) {
          pvpHist = `<section class="prof-block"><div class="prof-h">PVP HISTORY</div><ul class="prof-friends">${hist.data.map(row => `<li><span>${row.opponent || 'Opponent'}</span><span>${row.result}${row.coins ? ' · +' + row.coins : ''}</span></li>`).join('')}</ul></section>`;
        }
      }
      const ov = $('#overlay');
      ov.classList.remove('hidden');
      ov.innerHTML = `<div id="profileScreen">
        <div class="prof-wrap">
          <h1 class="prof-title">Profile</h1>
          <header class="prof-head">
            <img class="prof-ava" src="assets/cards/${encodeURIComponent(avatarId)}.webp" alt="">
            <div class="prof-id">
              <div class="prof-name">${profile.username || 'Player'}</div>
              <div class="prof-rank">${rankName(wins)}</div>
              <div class="prof-meta">Member since ${since}</div>
              <div class="prof-coins"><span class="coinicon" aria-hidden="true"></span> ${profile.coins | 0} Orbit Coins</div>
              ${editable ? `<button type="button" class="btn" id="btnAvatar">${avatarPick ? 'Close avatars' : 'Choose avatar'}</button>` : ''}
              ${avatars}
            </div>
          </header>
          <section class="prof-block prof-showblock">
            <div class="prof-h">RAREST CARDS</div>
            <div class="prof-show">${showcase}</div>
            ${editable ? `<div class="prof-actions"><button type="button" class="btn" id="btnPin">${picking ? 'Done' : 'Pin showcase'}</button>${pinned.length ? '<button type="button" class="btn" id="btnUnpin">Use rarest</button>' : ''}</div>` : `<p class="prof-note">${pinned.length ? 'Pinned by this player.' : 'Their rarest cards, gold first.'}</p>`}
          </section>
          ${friendHtml}
          ${pvpHist}
          <section class="prof-block prof-statsblock">
            <div class="prof-h">STATS</div>
            <div class="prof-stats">
              <div><b>${wins}</b><span>Wins</span></div>
              <div><b>${losses}</b><span>Losses</span></div>
              <div><b>${pct}%</b><span>Win rate</span></div>
              <div><b>${s.streak | 0}</b><span>Streak</span></div>
              <div><b>${s.bestStreak | 0}</b><span>Best streak</span></div>
              <div><b>${games}</b><span>Matches</span></div>
              <div><b>${s.packsOpened | 0}</b><span>Packs opened</span></div>
              <div><b>${copies}</b><span>Total cards</span></div>
              <div><b>${col.unique}</b><span>Unique</span></div>
              <div><b>${col.gold}</b><span>Gold</span></div>
              <div><b>${col.unique}/${col.total}</b><span>Collection</span></div>
              <div><b>${favoriteArchetype(profile)}</b><span>Favorite type</span></div>
              <div><b>${favoriteDeck(profile)}</b><span>Most-used deck</span></div>
              <div><b>${s.auctionsSold | 0}</b><span>Auctions sold</span></div>
              <div><b>${s.auctionsWon | 0}</b><span>Auctions won</span></div>
            </div>
          </section>
          <div class="go-btns"><button type="button" class="btn" id="btnProfileBack">BACK</button></div>
        </div>
      </div>`;
      $('#btnProfileBack').onclick = () => {
        if (opts.back === 'admin') return showAdmin();
        if (opts.back === 'profile') return showProfile();
        return showHome();
      };
      if (editable) {
        $('#btnAvatar').onclick = () => { avatarPick = !avatarPick; draw(); };
        ov.querySelectorAll('[data-ava]').forEach(btn => { btn.onclick = async () => { profile.avatar = btn.dataset.ava; await window.TOB_AUTH.saveProfile(profile); avatarPick = false; draw(); }; });
        const pin = $('#btnPin');
        if (pin) pin.onclick = async () => {
          if (!picking) {
            if (!(profile.showcase || []).length) profile.showcase = autoShowcase(profile).map(c => c.id);
            picking = true;
            await window.TOB_AUTH.saveProfile(profile);
            draw();
            return;
          }
          picking = false;
          draw();
        };
        const unpin = $('#btnUnpin');
        if (unpin) unpin.onclick = async () => { profile.showcase = []; await window.TOB_AUTH.saveProfile(profile); picking = false; draw(); };
        ov.querySelectorAll('.prof-card').forEach(btn => {
          btn.onclick = async () => {
            if (!picking) { inspect(COPIES.makeCopy(btn.dataset.id, {gold: !!(owned.get(btn.dataset.id) || {}).gold}), null, true); return; }
            const id = btn.dataset.id;
            const cur = (profile.showcase || []).slice();
            const i = cur.indexOf(id);
            if (i >= 0) cur.splice(i, 1);
            else if (cur.length < 6) cur.push(id);
            profile.showcase = cur;
            await window.TOB_AUTH.saveProfile(profile);
            draw();
          };
        });
        const form = $('#friendForm');
        form.onsubmit = async (ev) => {
          ev.preventDefault();
          const name = ($('#friendName').value || '').trim();
          const res = await window.TOB_AUTH.addFriend(name);
          if (!res || !res.ok) {
            friendNoteBad = true;
            friendNote = (res && res.error) || 'Could not add that friend.';
            const err = $('#friendErr');
            if (err) { err.className = 'prof-err'; err.textContent = friendNote; }
            return;
          }
          const accepted = !!(res.data && res.data.accepted);
          friendNoteBad = false;
          friendNote = accepted ? "You're now friends with " + name + '!' : 'Request sent';
          toast(friendNote);
          draw();
        };
        const friendAct = async (fn, okText) => {
          const res = await fn();
          if (!res || !res.ok) {
            friendNoteBad = true;
            friendNote = (res && res.error) || 'Could not update that request.';
            toast(friendNote);
            draw();
            return;
          }
          friendNoteBad = false;
          friendNote = okText;
          toast(okText);
          refreshFriendBadge();
          draw();
        };
        ov.querySelectorAll('[data-accept]').forEach(btn => { btn.onclick = () => friendAct(() => window.TOB_AUTH.acceptFriend(btn.dataset.accept), "You're now friends!"); });
        ov.querySelectorAll('[data-decline]').forEach(btn => { btn.onclick = () => friendAct(() => window.TOB_AUTH.declineFriend(btn.dataset.decline), 'Request declined'); });
        ov.querySelectorAll('[data-cancel]').forEach(btn => { btn.onclick = () => friendAct(() => window.TOB_AUTH.cancelFriend(btn.dataset.cancel), 'Request cancelled'); });
        ov.querySelectorAll('[data-view]').forEach(btn => { btn.onclick = () => showProfile(btn.dataset.view, {back: 'profile'}); });
        ov.querySelectorAll('[data-challenge]').forEach(btn => { btn.onclick = () => {
          const box = document.getElementById('friendPrivate');
          if (window.TOB_PVP) window.TOB_PVP.challenge(btn.dataset.challenge, !!(box && box.checked));
        }; });
        ov.querySelectorAll('[data-drop]').forEach(btn => { btn.onclick = async () => { await window.TOB_AUTH.removeFriend(btn.dataset.drop); draw(); }; });
      } else {
        ov.querySelectorAll('.prof-card').forEach(btn => { btn.onclick = () => inspect(COPIES.makeCopy(btn.dataset.id, {gold: !!(owned.get(btn.dataset.id) || {}).gold}), null, true); });
      }
    };
    draw();
  }
  async function showAdmin() {
    if (packState.role !== 'admin') return showHome();
    closeUserMenu();
    hidePreview();
    stopTimer();
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    let people = window.TOB_AUTH.listProfiles();
    if (window.TOB_AUTH.mode === 'supabase') {
      const listed = await window.TOB_AUTH.rpc('admin_list_players');
      if (!listed.ok) { toast(listed.error || 'Admins only.'); return showHome(); }
      people = (listed.data || []).map(p => ({id: p.id, username: p.username, role: p.role, coins: p.coins, packs: p.unopened_packs, collection: new Array(Number(p.cards) || 0)}));
    }
    const cardOpts = CARD_LIST.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const rows = people.map(p => {
      const count = (p.collection || []).length;
      const key = String(p.username || '').toLowerCase();
      return `<div class="adminrow" data-user="${key}" data-id="${p.id || ''}">
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
          <button type="button" class="btn" data-act="all">Give all cards</button>
          <button type="button" class="btn" data-act="allgold">Give all gold cards</button>
          <button type="button" class="btn" data-act="role">${p.role === 'admin' ? 'Demote' : 'Make admin'}</button>
          <button type="button" class="btn" data-act="profile">Profile</button>
          <button type="button" class="btn" data-act="obsidian">Give Obsidian cards</button>
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
        <label>Theme pack <input id="ecoTheme" type="number" min="0" value="${ECONOMY.themePrice | 0}"></label>
        <label>Week pack <input id="ecoWeek" type="number" min="0" value="${ECONOMY.themeWeekPrice | 0}"></label>
        <label>Auction fee % <input id="ecoFee" type="number" min="0" max="50" value="${ECONOMY.auctionFee | 0}"></label>
        <button type="button" class="btn go" id="btnSaveEcon">Save economy</button>
      </div>
      <div class="adminlist">${rows}</div>
      <div class="go-btns"><button type="button" class="btn" id="btnAdminBack">BACK</button></div>
    </div>`;
    $('#btnAdminBack').onclick = () => showHome();
    $('#btnSaveEcon').onclick = async () => {
      const next = {
        winCoins: clampInt($('#ecoWin').value, ECONOMY.winCoins),
        lossCoins: clampInt($('#ecoLoss').value, ECONOMY.lossCoins),
        packPrice: clampInt($('#ecoPrice').value, ECONOMY.packPrice),
        themePrice: clampInt($('#ecoTheme').value, ECONOMY.themePrice | 0),
        themeWeekPrice: clampInt($('#ecoWeek').value, ECONOMY.themeWeekPrice | 0),
        auctionFee: Math.min(50, clampInt($('#ecoFee').value, ECONOMY.auctionFee | 0)),
      };
      if (isOnlinePlayer()) {
        const res = await window.TOB_AUTH.rpc('admin_set_prices', {p_prices: {
          win_coins: next.winCoins, loss_coins: next.lossCoins, pack_price: next.packPrice,
          theme_price: next.themePrice, theme_week_price: next.themeWeekPrice, auction_fee: next.auctionFee,
        }});
        if (!res || !res.ok) { toast((res && res.error) || 'Could not save prices.'); return; }
      }
      saveEconomy(next);
      toast('Saved economy');
      showAdmin();
    };
    ov.querySelectorAll('[data-act]').forEach(btn => { btn.onclick = () => adminAct(btn); });
  }
  async function adminActOnline(btn) {
    const row = btn.closest('.adminrow');
    const id = row && row.dataset.id;
    const act = btn.dataset.act;
    if (!id) { toast('That player is not online'); return; }
    if (act === 'profile') { showProfile(row.dataset.user, {back: 'admin'}); return; }
    let res = {ok: false, error: 'That action stays on the device.'};
    if (act === 'coins') res = await window.TOB_AUTH.rpc('admin_give_coins', {p_user: id, p_amount: clampInt(row.querySelector('[data-field="coins"]').value, 0)});
    else if (act === 'packs') res = await window.TOB_AUTH.rpc('admin_give_packs', {p_user: id, p_amount: clampInt(row.querySelector('[data-field="packs"]').value, 0)});
    else if (act === 'card') {
      const card = row.querySelector('[data-field="card"]').value;
      res = await window.TOB_AUTH.rpc('admin_give_card', {p_user: id, p_card: card, p_gold: !!row.querySelector('[data-field="gold"]').checked});
    } else if (act === 'all' || act === 'allgold') {
      if (!window.confirm('Give cards through the server?')) return;
      res = await window.TOB_AUTH.rpc('admin_give_all', {p_user: id, p_gold: act === 'allgold'});
    } else if (act === 'obsidian') {
      if (!window.confirm('Give Obsidian Order cards, standard and gold?')) return;
      res = {ok: true};
      for (const card of (window.TOB_OBSIDIAN || [])) {
        const a = await window.TOB_AUTH.rpc('admin_give_card', {p_user: id, p_card: card.id, p_gold: false});
        const b = await window.TOB_AUTH.rpc('admin_give_card', {p_user: id, p_card: card.id, p_gold: true});
        if (!a.ok || !b.ok) { res = a.ok ? b : a; break; }
      }
    }
    toast(res && res.ok ? 'Saved' : ((res && res.error) || 'Could not save'));
    if (res && res.ok) showAdmin();
  }
  function adminAct(btn) {
    if (window.TOB_AUTH.mode === 'supabase') { adminActOnline(btn); return; }
    const row = btn.closest('.adminrow');
    const username = row && row.dataset.user;
    const profile = window.TOB_AUTH.listProfiles().find(p => String(p.username || '').toLowerCase() === username);
    if (!profile) { toast('That player is not on this device'); return; }
    const act = btn.dataset.act;
    if (act === 'profile') { showProfile(profile.username, {back: 'admin'}); return; }
    let customToast = '';
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
    } else if (act === 'obsidian') {
      if (!window.TOB_OBSIDIAN) { toast('Obsidian cards are not loaded'); return; }
      if (!window.confirm('Give Obsidian Order cards, standard and gold, to ' + profile.username + '?')) return;
      const have = new Set((profile.collection || []).map(r => r.id + (r.gold ? ':g' : ':s')));
      window.TOB_OBSIDIAN.forEach(c => {
        ['s', 'g'].forEach(kind => {
          if (have.has(c.id + ':' + kind)) return;
          const copy = COPIES.makeCopy(c.id, {gold: kind === 'g'});
          if (copy) profile.collection = (profile.collection || []).concat([{id: copy.id, gold: !!copy.gold, uid: copy.uid}]);
        });
      });
      customToast = 'Gave Obsidian Order cards to ' + profile.username;
    } else if (act === 'all' || act === 'allgold') {
      const gold = act === 'allgold';
      const n = CARD_LIST.length;
      const what = gold ? n + ' gold cards' : n + ' cards';
      if (!window.confirm('Give ' + what + ' to ' + profile.username + '?')) return;
      const made = CARD_LIST.map(c => COPIES.makeCopy(c.id, {gold: false})).filter(Boolean);
      if (gold) COPIES.stampGold(made, made.length);
      profile.collection = (profile.collection || []).concat(made.map(c => ({id: c.id, gold: !!c.gold, uid: c.uid})));
      customToast = 'Gave ' + what + ' to ' + profile.username;
    } else if (act === 'role') {
      if (String(profile.username || '').toLowerCase() === 'guest') { toast('Guest stays a player'); return; }
      profile.role = profile.role === 'admin' ? 'player' : 'admin';
    }
    const saved = window.TOB_AUTH.adminSave(profile.username, profile);
    if (!saved || !saved.ok) { toast((saved && saved.error) || 'Could not save'); return; }
    const me = window.TOB_AUTH.currentUser();
    if (me && String(me.username || '').toLowerCase() === username) rememberPacks(saved.profile);
    const labels = {coins: 'Updated coins for ', packs: 'Updated packs for ', card: 'Granted a card to ', role: 'Updated role for '};
    toast(customToast || ((labels[act] || 'Saved ') + profile.username));
    showAdmin();
  }
  async function beginPull(profile, pulls, before) {
    profile.stats = profile.stats || {};
    profile.stats.packsOpened = (profile.stats.packsOpened | 0) + 1;
    profile.collection = before.concat(pulls.map(p => ({id: p.id, gold: !!p.gold, uid: p.uid})));
    const saved = await window.TOB_AUTH.saveProfile(profile);
    if (!saved || !saved.ok) return false;
    rememberPacks(profile);
    currentPulls = annotatePulls(pulls, before);
    pullOwnedBefore = new Set(before.map(rec => rec && rec.id).filter(Boolean));
    flipped = currentPulls.map(() => false);
    packSummaryShown = false;
    await playPull();
    return true;
  }
  async function playServerPull(res, theme) {
    if (!res || !res.ok) { toast((res && res.error) || 'Could not open that pack.'); return; }
    const pulls = (res.data && res.data.pulls) || [];
    const profile = await window.TOB_AUTH.loadProfile();
    const bag = {};
    ((profile && profile.collection) || []).forEach(rec => { if (rec) bag[rec.id] = (bag[rec.id] || 0) + 1; });
    pulls.forEach(p => { if (bag[p.id]) bag[p.id] -= 1; });
    pullOwnedBefore = new Set(Object.keys(bag).filter(id => bag[id] > 0));
    currentPulls = pulls.map(p => ({id: p.id, gold: !!p.gold, uid: p.uid, isNew: !!p.isNew, dup: p.isNew ? 1 : 2}));
    currentPackTheme = theme || null;
    flipped = currentPulls.map(() => false);
    packSummaryShown = false;
    if (profile) rememberPacks(profile);
    await playPull();
  }
  async function buyThemePack(key) {
    if (packBusy) return;
    const theme = liveThemes().find(item => item.key === key);
    if (!theme) return;
    if (isOnlinePlayer()) {
      packBusy = true;
      try { await playServerPull(await window.TOB_AUTH.openPack('theme', theme.key), theme); }
      finally { packBusy = false; }
      return;
    }
    const price = priceForTheme(theme.key);
    packBusy = true;
    try {
      const profile = await liveProfile();
      if (!profile) return;
      if ((profile.coins | 0) < price) { toast('Not enough Orbit Coins'); return; }
      const before = (profile.collection || []).slice();
      const pulls = rollPack(new Set(before.map(rec => rec && rec.id).filter(Boolean)), theme.key);
      profile.coins = (profile.coins | 0) - price;
      currentPackTheme = theme;
      const ok = await beginPull(profile, pulls, before);
      if (!ok) toast('Could not open that pack');
    } finally {
      packBusy = false;
    }
  }
  async function openPack() {
    if (packBusy) return;
    if (isOnlinePlayer()) {
      packBusy = true;
      try { await playServerPull(await window.TOB_AUTH.openPack('inventory', null), null); }
      finally { packBusy = false; }
      return;
    }
    packBusy = true;
    try {
      const profile = await liveProfile();
      if (!profile || (profile.packs | 0) < 1) return;
      const before = (profile.collection || []).slice();
      const pulls = rollPack(new Set(before.map(rec => rec && rec.id).filter(Boolean)));
      profile.packs = (profile.packs | 0) - 1;
      currentPackTheme = null;
      await beginPull(profile, pulls, before);
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
        <span class="pull-front">${cardHTML(copy, null, true)}${pull.gold ? '<span class="goldsweep"></span>' : ''}</span>
      </span>
    </button>`;
  }
  function cardComboFacts(card, ownedIds, pullIds) {
    const book = window.TOB_COMBOS;
    if (!book || !card) return [];
    const owned = ownedIds || new Set();
    const pulled = pullIds || new Set();
    const facts = [];
    const idState = id => pulled.has(id) ? 'pack' : owned.has(id) ? 'own' : 'miss';
    (book.sets || []).filter(s => s.ids.includes(card.id)).forEach(s => {
      facts.push({
        name: s.name,
        bonus: s.bonus,
        partners: s.ids.filter(id => id !== card.id).map(id => ({name: CARDS[id] ? CARDS[id].name : id, state: idState(id)})),
      });
    });
    (book.pairs || []).filter(p => card.archetype && (p.a === card.archetype || p.b === card.archetype)).forEach(p => {
      const other = p.a === card.archetype ? p.b : p.a;
      const inPull = [...pulled].some(id => CARDS[id] && CARDS[id].archetype === other);
      const had = [...owned].some(id => CARDS[id] && CARDS[id].archetype === other);
      facts.push({name: p.name, bonus: p.bonus, partners: [{name: other, state: inPull ? 'pack' : had ? 'own' : 'miss'}]});
    });
    return facts;
  }
  function pullComboFacts(card, ownedBefore, pullIds) {
    return cardComboFacts(card, ownedBefore, pullIds);
  }
  function statsHTML(pull, withPuck) {
    const card = CARDS[pull.id];
    if (!card) return '';
    const copy = COPIES.makeCopy(pull.id, {gold: !!pull.gold, uid: pull.uid});
    const plain = !!pull.plain;
    const ownedIds = plain ? (pull.ownedIds || new Set()) : pullOwnedBefore;
    const pullIds = plain ? new Set() : new Set((currentPulls || []).map(item => item.id));
    const facts = cardComboFacts(card, ownedIds, pullIds);
    const mark = state => state === 'pack' ? 'is-pack' : state === 'own' ? 'is-own' : 'is-miss';
    const markText = state => state === 'pack' ? 'In this pack' : state === 'own' ? 'Owned' : 'Not owned';
    const factHtml = facts.length ? facts.map(fact => `<div class="ps-fact"><span class="db-badge">COMBO</span> <b>${escPack(fact.name)}</b> +${fact.bonus}<ul>${fact.partners.map(p => `<li class="${mark(p.state)}">${markText(p.state)} · ${escPack(p.name)}</li>`).join('')}</ul></div>`).join('') : '<p class="ps-skill">No named crew or archetype pair on this card.</p>';
    const power = card.power && card.power !== 'No Power' ? card.power : 'No power.';
    return `<div class="pullstats">
      ${withPuck ? `<div class="ps-puck">${cardHTML(copy, null, true)}</div>` : ''}
      <div class="ps-name">${escPack(card.name)}</div>
      <div class="ps-line"><b>${card.pts} power</b> · <i class="gem" style="background:${COLORS[card.color]}"></i> ${escPack(cap(card.color))}${pull.gold ? ' · Gold' : ''}</div>
      <div class="ps-line">${escPack(card.archetype || 'No archetype')} · ${escPack(card.group || '')}</div>
      <p class="ps-skill">${escPack(power)}</p>
      ${pull.isNew ? '<div class="pulltags"><span class="newtag">NEW!</span></div>' : ''}
      <div class="ps-h">Combos</div>
      ${factHtml}
    </div>`;
  }
  function combosFromPull(pulls) {
    const pullIds = new Set(pulls.map(p => p.id));
    const have = new Set(pullOwnedBefore);
    pullIds.forEach(id => have.add(id));
    const book = window.TOB_COMBOS || {sets: [], pairs: []};
    const lines = [];
    (book.sets || []).forEach(s => {
      const now = s.ids.every(id => have.has(id));
      const before = s.ids.every(id => pullOwnedBefore.has(id));
      if (now && !before && s.ids.some(id => pullIds.has(id))) lines.push(s.name + ' +' + s.bonus);
    });
    const arches = ids => {
      const set = new Set();
      ids.forEach(id => { const card = CARDS[id]; if (card && card.archetype) set.add(card.archetype); });
      return set;
    };
    const beforeArch = arches(pullOwnedBefore);
    const nowArch = arches(have);
    (book.pairs || []).forEach(p => {
      const now = nowArch.has(p.a) && nowArch.has(p.b);
      const before = beforeArch.has(p.a) && beforeArch.has(p.b);
      const touched = pulls.some(pull => {
        const card = CARDS[pull.id];
        return card && (card.archetype === p.a || card.archetype === p.b);
      });
      if (now && !before && touched) lines.push(p.name + ' +' + p.bonus);
    });
    return lines;
  }
  async function playPull() {
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    const reduce = reduceMotion();
    const theme = currentPackTheme;
    ov.innerHTML = `<div class="packtake"><div class="foilpack${theme ? ' theme' : ''}${reduce ? ' tear' : ' shake'}" id="foilPack"${theme ? ` style="--ph:${theme.hue}"` : ''}>${foilMarkup(theme)}</div></div>`;
    packSound('shake');
    if (!reduce) await wait(920);
    const pack = $('#foilPack');
    if (pack) pack.classList.add('tear');
    packSound('tear');
    if (!reduce) await wait(560);
    renderStage();
  }
  function renderStage() {
    const i = flipped.findIndex(v => !v);
    if (i < 0) { showPackSummary(); return; }
    const done = currentPulls.map((pull, idx) => {
      if (!flipped[idx]) return '';
      const copy = COPIES.makeCopy(pull.id, {gold: pull.gold, uid: pull.uid});
      return `<button type="button" class="thumb" data-pull="${idx}">${cardHTML(copy, null, true)}</button>`;
    }).join('');
    const hint = packCanHover() ? 'Hover a card for stats' : 'Tap a card to flip it';
    $('#overlay').innerHTML = `<div class="packtake">
      <div class="stagehint">${currentPackTheme ? escPack(currentPackTheme.icon + ' ' + currentPackTheme.key) : 'Standard pack'} · ${hint}</div>
      <div class="packstage">
        <div class="stagewrap">${stageCard(currentPulls[i], i)}</div>
      </div>
      <div class="go-btns">
        <button type="button" class="btn go" id="btnNextPull" data-i="${i}" hidden>Next card</button>
        <button type="button" class="btn" id="btnRevealAll">Reveal all</button>
      </div>
      <div class="dock">${done}</div>
    </div>`;
  }
  function flipPull(i) {
    if (!currentPulls || flipped[i] || packSummaryShown) return;
    const node = document.querySelector('.stagecard');
    if (!node || +node.dataset.i !== i) return;
    if (node.classList.contains('flipped')) {
      if (!packCanHover()) showPackTip(node, currentPulls[i]);
      return;
    }
    node.classList.add('flipped');
    packSound('flip');
    if (currentPulls[i].gold) goldBurst();
    const next = document.getElementById('btnNextPull');
    if (next) next.hidden = false;
    if (packCanHover()) showPackTip(node, currentPulls[i]);
  }
  function advancePull(i) {
    if (!currentPulls || packSummaryShown || !flipped) return;
    const node = document.querySelector('.stagecard');
    if (!node || !node.classList.contains('flipped') || +node.dataset.i !== i) return;
    flipped[i] = true;
    if (flipped.every(Boolean)) showPackSummary();
    else renderStage();
  }
  function revealAll() {
    if (!currentPulls || packSummaryShown) return;
    stageToken++;
    const unseenGold = currentPulls.some((pull, i) => pull.gold && !flipped[i]);
    currentPulls.forEach((_, i) => { flipped[i] = true; });
    if (unseenGold) goldBurst();
    showPackSummary();
  }
  function packCanHover() {
    return matchMedia('(hover: hover) and (pointer: fine)').matches;
  }
  function hidePackTip() {
    const tip = document.getElementById('packTip');
    if (tip) tip.classList.remove('open');
  }
  function showPackTip(anchor, pull) {
    if (!anchor || !pull) return;
    if (matchBoardOn()) return;
    let tip = document.getElementById('packTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'packTip';
      tip.className = 'packtip';
      document.body.appendChild(tip);
    }
    const mark = String(pull.uid || pull.id);
    if (tip.dataset.for === mark && tip.classList.contains('open')) return;
    tip.dataset.for = mark;
    tip.innerHTML = statsHTML(pull, false);
    tip.classList.remove('open', 'from-right', 'from-top');
    tip.style.left = '0px';
    tip.style.top = '0px';
    const gap = 12;
    const box = anchor.getBoundingClientRect();
    const w = tip.offsetWidth || 280;
    const h = tip.offsetHeight || 160;
    let left = box.right + gap;
    let top = box.top + (box.height - h) / 2;
    let place = 'right';
    if (left + w > window.innerWidth - 8) {
      left = box.left - gap - w;
      place = 'left';
    }
    if (left < 8) {
      left = Math.max(8, Math.min(box.left, window.innerWidth - w - 8));
      top = box.top - h - gap;
      place = 'above';
      if (top < 8) { top = box.bottom + gap; place = 'below'; }
    }
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
    if (top < 8) top = 8;
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    if (place === 'left') tip.classList.add('from-right');
    if (place === 'above') tip.classList.add('from-top');
    requestAnimationFrame(() => tip.classList.add('open'));
  }
  let tipOwnedIds = null;
  function collectionCard(node) {
    if (!node || !node.closest) return null;
    const card = node.closest('.ccard');
    if (!card || card.classList.contains('locked')) return null;
    if (!card.closest('.panel.collection, .panel.mine')) return null;
    return card;
  }
  function showCollectionTip(card) {
    const id = card.dataset.cid;
    if (!id || !CARDS[id]) return;
    const gold = card.dataset.gold === '1' || (!card.dataset.gold && collectionGold);
    showPackTip(card, {
      id,
      gold: !!gold,
      uid: 'collection:' + id + (gold ? ':g' : ':s'),
      plain: true,
      ownedIds: tipOwnedIds,
    });
  }
  if (!openPack._tip) {
    openPack._tip = true;
    document.addEventListener('mouseover', e => {
      if (!packCanHover() || !currentPulls) return;
      const card = e.target.closest && e.target.closest('.pullslot, .stagecard.flipped, .thumb');
      if (!card || !card.closest('#overlay')) return;
      const i = card.dataset.pull != null ? +card.dataset.pull : +card.dataset.i;
      if (!currentPulls[i]) return;
      showPackTip(card, currentPulls[i]);
    });
    document.addEventListener('mouseout', e => {
      if (!packCanHover()) return;
      const card = e.target.closest && e.target.closest('.pullslot, .stagecard.flipped, .thumb');
      if (!card) return;
      const next = e.relatedTarget;
      if (next && card.contains(next)) return;
      hidePackTip();
    });
    document.addEventListener('mouseover', e => {
      if (!packCanHover()) return;
      const feed = e.target.closest && e.target.closest('.feed-card');
      if (feed) { showFeedTip(feed); return; }
      const card = collectionCard(e.target);
      if (!card) return;
      showCollectionTip(card);
    });
    document.addEventListener('mouseout', e => {
      if (!packCanHover()) return;
      const card = (e.target.closest && e.target.closest('.feed-card')) || collectionCard(e.target);
      if (!card) return;
      const next = e.relatedTarget;
      if (next && card.contains(next)) return;
      hidePackTip();
    });
  }
  function showPackSummary() {
    if (packSummaryShown || !currentPulls) return;
    hidePackTip();
    packSummaryShown = true;
    stageToken++;
    const fresh = currentPulls.filter(p => p.isNew).length;
    const golds = currentPulls.filter(p => p.gold).length;
    const power = currentPulls.reduce((sum, pull) => sum + ((CARDS[pull.id] && CARDS[pull.id].pts) || 0), 0);
    const made = combosFromPull(currentPulls);
    const slots = currentPulls.map((pull, i) => {
      const card = CARDS[pull.id];
      const copy = COPIES.makeCopy(pull.id, {gold: pull.gold, uid: pull.uid});
      return `<button type="button" class="pullslot${pull.gold ? ' is-gold' : ''}" data-pull="${i}">
        ${pullTagHTML(pull)}
        <span class="pullshown">${cardHTML(copy, null, true)}</span>
        <span class="pullname">${escPack(card ? card.name : pull.id)}</span>
        <span class="pullmeta">${card ? card.pts : 0} pts</span>
      </button>`;
    }).join('');
    $('#overlay').innerHTML = `<div class="packtake summarytake">
      <div class="reward-title pack-summary" id="packSummary">${fresh} new, ${golds} gold</div>
      <div class="pullgrid">${slots}</div>
      <div class="pulltotal">Total power ${power}</div>
      <div class="pullmade"><b>You can now make:</b> ${made.length ? escPack(made.join(', ')) : 'no new combo from this pack.'}</div>
      <div class="go-btns">
        <button type="button" class="btn go" id="btnOpenAnother" ${packState.packs > 0 ? '' : 'disabled'}>Open another</button>
        <button type="button" class="btn" id="btnPackBuilder">Go to Deck Builder</button>
      </div>
    </div>`;
  }
  /* ---------- deck selection / builder ---------- */
  let lastDeck = null;
  const OPP_NAMES = {galaxy: 'Commander Kix', spooky: 'Baron Boo', barnyard: 'Farmer Fizz', sprout: 'Professor Sprig', batch1: 'Captain Crumble', custom: 'Mystery Rival'};
  function readRawDeck() {
    try { const d = JSON.parse(localStorage.getItem('tob_custom') || '[]'); return Array.isArray(d) ? d : []; }
    catch (e) { return []; }
  }
  function entryId(entry) { return typeof entry === 'string' ? entry : entry && entry.id; }
  function escrowUids() {
    const house = window.TOB_AUCTIONS;
    const me = window.TOB_AUTH.currentUser && window.TOB_AUTH.currentUser();
    if (!house || !house.list || !me) return new Set();
    const mine = String(me.username || '').toLowerCase();
    const set = new Set();
    house.list().forEach(lot => {
      if (lot && lot.status === 'open' && String(lot.seller || '').toLowerCase() === mine && lot.card && lot.card.uid) set.add(lot.card.uid);
    });
    return set;
  }
  function ownedBags(profile) {
    const skip = escrowUids();
    const by = new Map();
    ((profile && profile.collection) || []).forEach(rec => {
      if (!rec || !CARDS[rec.id] || skip.has(rec.uid)) return;
      let bag = by.get(rec.id);
      if (!bag) { bag = {standard: null, gold: null}; by.set(rec.id, bag); }
      if (rec.gold) { if (!bag.gold) bag.gold = rec; }
      else if (!bag.standard) bag.standard = rec;
    });
    return by;
  }
  function resolveEntry(entry, bags) {
    const id = entryId(entry);
    if (!id || !CARDS[id]) return null;
    const bag = bags && bags.get(id);
    const askedGold = !!(entry && typeof entry === 'object' && entry.gold);
    const askedUid = entry && typeof entry === 'object' ? entry.uid : null;
    if (bag && askedUid) {
      if (bag.gold && bag.gold.uid === askedUid) return {id, gold: true, uid: bag.gold.uid};
      if (bag.standard && bag.standard.uid === askedUid) return {id, gold: false, uid: bag.standard.uid};
    }
    if (bag) {
      if (askedGold && bag.gold) return {id, gold: true, uid: bag.gold.uid};
      if (!askedGold && bag.standard) return {id, gold: false, uid: bag.standard.uid};
      if (bag.gold && !bag.standard) return {id, gold: true, uid: bag.gold.uid};
      if (bag.standard) return {id, gold: false, uid: bag.standard.uid};
    }
    return {id, gold: false, uid: null};
  }
  function resolveDeck(raw, bags) {
    const out = [];
    const seen = new Set();
    (raw || []).forEach(entry => {
      const row = resolveEntry(entry, bags);
      if (!row || seen.has(row.id) || (row.uid && out.some(x => x.uid && x.uid === row.uid))) return;
      seen.add(row.id);
      out.push(row);
    });
    return out.slice(0, 12);
  }
  function customDeck(bags) { return resolveDeck(readRawDeck(), bags); }
  function playerDecks() { return Object.keys(DECKS).filter(k => !DECKS[k].ai && (!DECKS[k].adminOnly || packState.role === 'admin')); }
  async function quickStart(key) {
    window.TOB.battleLock = null;
    const playable = playerDecks();
    key = key || lastDeck || playable[Math.floor(Math.random() * playable.length)];
    if (key !== 'custom' && !DECKS[key]) key = playable[0];
    lastDeck = key;
    let pIds = DECKS[key] ? DECKS[key].cards : [];
    if (key === 'custom') {
      const profile = await window.TOB_AUTH.loadProfile();
      pIds = customDeck(ownedBags(profile));
    }
    const others = Object.keys(DECKS).filter(k => k !== key && !DECKS[k].adminOnly);
    const ok = others[Math.floor(Math.random() * others.length)];
    startGame(pIds, DECKS[ok].cards, OPP_NAMES[ok] || DECKS[ok].name);
  }
  function deckKnown(entries) {
    return (entries || []).filter(entry => CARDS[entryId(entry)]);
  }
  function deckHasObsidian(entries) {
    return deckKnown(entries).some(entry => {
      const id = entryId(entry);
      const card = CARDS[id];
      return String(id).indexOf('ob_') === 0 || !!(card && card.adminOnly);
    });
  }
  function deckBlockReason(entries) {
    const list = deckKnown(entries);
    const reasons = [];
    if (list.length < 12) reasons.push('Needs 12 cards (' + list.length + '/12).');
    if (deckHasObsidian(list) && packState.role !== 'admin') reasons.push('Obsidian cards are not allowed in ranked.');
    return reasons.join(' ');
  }
  function deckTile(key, name, entries) {
    const list = deckKnown(entries);
    let pts = 0;
    const colors = {};
    list.forEach(entry => {
      const card = CARDS[entryId(entry)];
      pts += card.pts;
      colors[card.color] = (colors[card.color] || 0) + 1;
    });
    const chips = Object.entries(colors).map(([c, n]) => `<span class="deck-chip" title="${n} ${cap(c)}"><i style="background:${COLORS[c]}"></i>${n}</span>`).join('');
    const pucks = list.map(entry => {
      const id = entryId(entry);
      const card = CARDS[id];
      const gold = !!(entry && typeof entry === 'object' && entry.gold);
      const copy = COPIES.makeCopy(id, {gold, uid: entry && entry.uid});
      return `<button type="button" class="deck-puck" data-cid="${card.id}" data-gold="${gold ? '1' : '0'}" aria-label="${card.name}">${cardHTML(copy, null, true)}</button>`;
    }).join('');
    const reason = deckBlockReason(list);
    const edit = key === 'custom' ? `<button type="button" class="btn deck-build" id="btnBuild">${list.length === 12 ? 'Edit' : 'Build deck'}</button>` : '';
    const play = reason
      ? `<p class="deck-reason">${reason}</p>${edit}`
      : `<button type="button" class="btn go deckplay" data-deck="${key}">Choose deck</button>${edit}`;
    const badge = key === 'obsidian' ? '<span class="adminbadge">ADMIN</span>' : '';
    const detail = list.map(entry => {
      const card = CARDS[entryId(entry)];
      const gold = !!(entry && typeof entry === 'object' && entry.gold);
      return `<div class="deck-line"><b>${card.name}</b><span>${card.pts} pts · ${cap(card.color)}${gold ? ' · Gold' : ''}</span><span>${card.power}</span></div>`;
    }).join('');
    return `<article class="decktile${key === 'obsidian' ? ' obsidian' : ''}" data-deckname="${name.toLowerCase()}">
      <div class="decktile-top">
        <div class="decktile-copy">
          <div class="dname">${badge}${name}</div>
          <div class="dsum">${pts} base pts · ${list.length}/12</div>
          <div class="deck-chips">${chips}</div>
        </div>
        <div class="decktile-actions">${play}</div>
      </div>
      <div class="deck-pucks">${pucks}</div>
      <button type="button" class="deck-view" data-viewcards aria-expanded="false">View cards</button>
      <div class="deck-detail">${detail}</div>
    </article>`;
  }
  let homeClock = null;
  let livePreview = null;
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
  function liveEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  async function homeAuctions() {
    if (livePreview) return livePreview.lots.filter(lot => lot && lot.card && isPublicCard(lot.card.id)).slice(0, 5);
    const house = window.TOB_AUCTIONS;
    if (house && house.refresh) { try { await house.refresh(); } catch (e) { /* local list still works */ } }
    const all = house && house.list ? house.list() : [];
    return all.filter(lot => lot && lot.status === 'open' && lot.ends > Date.now() && lot.card && isPublicCard(lot.card.id))
      .sort((a, b) => a.ends - b.ends).slice(0, 5);
  }
  async function homeMatches() {
    if (livePreview) return livePreview.games.slice(0, 5);
    if (!window.TOB_AUTH || window.TOB_AUTH.mode !== 'supabase' || !window.TOB_AUTH.rpc) return [];
    const res = await window.TOB_AUTH.rpc('list_live_matches');
    if (!res || !res.ok || !Array.isArray(res.data)) return [];
    return res.data.slice(0, 5);
  }
  function livePhase(phase) {
    return {place1: 'Round 1', discard: 'Discard', place2: 'Round 2', silver: 'Silver', score: 'Final'}[phase] || 'Live';
  }
  function liveMatchMeta(match) {
    const round = livePhase(match.phase);
    if (match.host_score != null && match.guest_score != null) return round + ' · ' + match.host_score + '–' + match.guest_score;
    const placed = (board) => (board || []).filter(card => card && card.id && isPublicCard(card.id)).length;
    if (match.phase === 'score' && window.TOB_ENGINE && match.host_board) {
      try {
        const asBoard = (entries) => {
          const row = (entries || []).map(entry => (!entry || !entry.id || !isPublicCard(entry.id) || !CARDS[entry.id]) ? null : Object.assign({}, CARDS[entry.id], {gold: !!entry.gold}));
          while (row.length < 7) row.push(null);
          return row.slice(0, 7);
        };
        const boards = {p: asBoard(match.host_board), o: asBoard(match.guest_board)};
        const shown = {p: boards.p.map(Boolean), o: boards.o.map(Boolean)};
        const ev = window.TOB_ENGINE.evaluate(boards, shown, {
          goals: [match.host_goal || null, match.guest_goal || null],
          silver: {p: match.host_silver || null, o: match.guest_silver || null},
          penalty: {p: 0, o: 0},
          final: true,
        });
        return round + ' · ' + ev.score.p + '–' + ev.score.o;
      } catch (e) { /* the round label still shows */ }
    }
    if (match.host_board || match.guest_board) return round + ' · ' + placed(match.host_board) + '–' + placed(match.guest_board);
    return round;
  }
  function liveNowMarkup(lots, games) {
    const auc = lots.length ? lots.map(lot => {
      const copy = COPIES.makeCopy(lot.card.id, {gold: !!lot.card.gold, uid: lot.card.uid});
      return `<article class="live-row">
        <span class="live-puck">${copy ? cardHTML(copy) : ''}</span>
        <span class="live-copy"><b>${liveEsc(lot.card.name)}</b><span>${lot.card.gold ? 'GOLD · ' : ''}${lot.bidder ? lot.bid + ' bid' : lot.start + ' start'}</span></span>
        <span class="live-time" data-live-ends="${lot.ends}">${aucClock(lot.ends)}</span>
        <button type="button" class="btn live-bid" data-live-auction="${liveEsc(lot.id)}">Bid</button>
      </article>`;
    }).join('') : '<div class="live-empty"><p>Nothing is up for bid yet.</p><button type="button" class="btn" id="btnLiveAuc">See auctions</button></div>';
    const mats = games.length ? games.map(match => `<article class="live-row">
        <span class="live-avatars"><img src="assets/cards/${encodeURIComponent(isPublicCard(match.host_avatar) ? match.host_avatar : 'zoomer')}.webp" alt=""><img src="assets/cards/${encodeURIComponent(isPublicCard(match.guest_avatar) ? match.guest_avatar : 'zoomer')}.webp" alt=""></span>
        <span class="live-copy"><b>${liveEsc(match.host_name)} vs ${liveEsc(match.guest_name)}</b><span>${liveEsc(liveMatchMeta(match))}</span></span>
        <button type="button" class="btn live-bid" data-live-watch="${liveEsc(match.id)}">Watch</button>
      </article>`).join('') : '<div class="live-empty"><p>No public matches right now.</p><button type="button" class="btn" id="btnLivePvp">Play a friend</button></div>';
    return `<div class="live-grid"><section class="home-panel"><h3>Live auctions</h3>${auc}</section><section class="home-panel"><h3>Live matches</h3>${mats}</section></div>`;
  }
  function bindLive(root) {
    root.querySelectorAll('[data-live-auction]').forEach(btn => { btn.onclick = () => openAuction(btn.dataset.liveAuction); });
    const liveAuc = root.querySelector('#btnLiveAuc');
    if (liveAuc) liveAuc.onclick = () => {
      const userNow = window.TOB_AUTH.currentUser();
      if (!userNow || userNow.guest) return showAuth('login');
      showAuctions();
    };
    root.querySelectorAll('[data-live-watch]').forEach(btn => { btn.onclick = () => window.TOB_PVP && window.TOB_PVP.spectate(btn.dataset.liveWatch); });
    const livePvp = root.querySelector('#btnLivePvp');
    if (livePvp) livePvp.onclick = () => {
      const userNow = window.TOB_AUTH.currentUser();
      if (!userNow || userNow.guest) return showAuth('login');
      if (window.TOB_PVP) window.TOB_PVP.show();
    };
  }
  let liveRefresh = null;
  async function refreshLivePanel() {
    const screen = document.getElementById('homeScreen');
    if (!screen || livePreview || liveRefresh) return;
    const grid = screen.querySelector('.live-grid');
    if (!grid) return;
    liveRefresh = (async () => {
      const lots = await homeAuctions();
      const games = await homeMatches();
      const next = screen.querySelector('.live-grid');
      if (next) next.outerHTML = liveNowMarkup(lots, games);
      bindLive(screen);
    })();
    try { await liveRefresh; } finally { liveRefresh = null; }
  }
  function openAuction(id) {
    const user = window.TOB_AUTH.currentUser();
    if (!user || user.guest) return showAuth('login');
    aucLot = id;
    aucTab = 'detail';
    showAuctions();
  }
  let pullFeedRows = [];
  let pullFeedChannel = null;
  function pullAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 48) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }
  function showFeedTip(node) {
    const id = node && node.dataset && node.dataset.cid;
    if (!id || !CARDS[id]) return;
    const gold = node.dataset.gold === '1';
    showPackTip(node, {id, gold, uid: 'feed:' + id + (gold ? ':g' : ':s'), plain: true, ownedIds: tipOwnedIds || new Set()});
  }
  function paintPullFeed() {
    const list = document.getElementById('pullFeed');
    if (!list) return;
    if (!pullFeedRows.length) {
      list.innerHTML = '<li class="feed-empty">No rare pulls yet. Be the first!</li>';
      return;
    }
    list.innerHTML = pullFeedRows.slice(0, 10).map(row => {
      const card = CARDS[row.card_id];
      const name = card ? card.name : row.card_id;
      const gold = !!row.is_gold;
      const who = liveEsc(row.username || 'Someone');
      return `<li><button type="button" class="feed-user" data-feed-user="${who}">${who}</button> pulled <button type="button" class="feed-card${gold ? ' is-gold' : ''}" data-cid="${liveEsc(row.card_id)}" data-gold="${gold ? '1' : '0'}">${liveEsc(name)}</button>${gold ? ' <b class="feed-gold">GOLD</b>' : ''} · ${pullAgo(row.created_at)}</li>`;
    }).join('');
  }
  async function loadPullFeed() {
    const list = document.getElementById('pullFeed');
    if (!list) return;
    if (!window.TOB_AUTH || window.TOB_AUTH.mode !== 'supabase' || !window.TOB_AUTH.rpc) {
      pullFeedRows = [];
      paintPullFeed();
      return;
    }
    const res = await window.TOB_AUTH.rpc('public_recent_pulls', {p_limit: 10});
    const msg = (res && res.error) || '';
    if (!res || !res.ok || /does not exist|could not find|PGRST202|42883|schema cache/i.test(msg)) {
      pullFeedRows = [];
      paintPullFeed();
      return;
    }
    let data = res.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = []; }
    }
    pullFeedRows = Array.isArray(data) ? data : [];
    paintPullFeed();
  }
  function watchPullFeed() {
    const db = window.TOB_AUTH && window.TOB_AUTH.client && window.TOB_AUTH.client();
    if (!db || pullFeedChannel || window.TOB_AUTH.mode !== 'supabase') return;
    pullFeedChannel = db.channel('pull-feed')
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'pull_feed'}, () => {
        if (document.getElementById('homeScreen')) loadPullFeed();
      })
      .subscribe();
  }
  function showHome() {
    auctionNotices();
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
      if (profile) rememberPacks(profile);
      const liveLots = await homeAuctions();
      const liveGames = await homeMatches();
      const admin = packState.role === 'admin';
      const tab = (id, label, short) => `<button type="button" class="portal-tab" id="${id}"><span class="tab-ico" aria-hidden="true"></span><span class="tab-label"><span class="tab-long">${label}</span><span class="tab-short">${short}</span></span>${id === 'btnProfile' ? '<span class="packbadge" data-friendbadge></span>' : ''}<span class="chev" aria-hidden="true">&gt;</span></button>`;
      ov.innerHTML = `<div id="homeScreen" class="portal">
        <div class="portal-top">
          <div class="portal-brand"><span class="ring"></span><span class="portal-word">TOON ORBIT <b>TRADING CARDS</b></span></div>
          ${window.TOB_AUTH.onlineSoon ? '<p class="online-soon">Online accounts coming soon. Play is saved on this device for now.</p>' : ''}
          <button type="button" class="portal-greet" id="btnProfileGreet">HI, ${(user.username || 'PLAYER').toUpperCase()}!</button>
          <div class="portal-tools">
            <div class="portal-pill"><span class="coinicon" aria-hidden="true"></span> YOU HAVE ${packState.coins | 0} ORBIT COINS</div>
            <button type="button" class="portal-logout" id="btnHomeOut">LOGOUT</button>
            <button type="button" class="portal-sound" id="btnHomeSound">SOUND ${soundOn ? 'ON' : 'OFF'}</button>
          </div>
        </div>
        <div class="portal-shell">
          <nav class="portal-tabs">
            ${tab('btnPlayTab', 'PLAY', 'PLAY')}
            ${tab('btnPvp', 'PVP', 'PVP')}
            ${tab('btnDecks', 'DECKS', 'DECKS')}
            ${tab('btnProfile', 'PROFILE', 'PROFILE')}
            ${tab('btnAuctions', 'AUCTIONS', 'BIDS')}
            ${tab('btnHomeCollection', 'MY COLLECTION', 'BINDER')}
            ${admin ? tab('btnHomeAdmin', 'ADMIN', 'ADMIN') : ''}
            ${tab('btnCollection', 'CARD GALLERY', 'GALLERY')}
            ${tab('btnRules2', 'HOW TO PLAY', 'HELP')}
          </nav>
          <div class="portal-content">
          <section class="portal-main">
            ${liveNowMarkup(liveLots, liveGames)}
            <div class="home-actions">
              <button type="button" class="btn go home-pill" id="btnPlay">Play now</button>
            </div>
          </section>
          <div class="portal-bottom">
            <div class="portal-box">
              <div class="portal-boxhead">RECENT PULLS</div>
              <ul class="portal-pulls" id="pullFeed"><li class="feed-empty">No rare pulls yet. Be the first!</li></ul>
            </div>
            <div class="portal-box">
              <div class="portal-boxhead">TOON TIPS</div>
              <p>Match both goal colors to win outright. Gold copies are just for show, and they score the same.</p>
            </div>
          </div>
          </div>
        </div>
      </div>`;
      bindLive(ov);
      let liveTick = 0;
      loadPullFeed();
      watchPullFeed();
      homeClock = setInterval(() => {
        if (!document.getElementById('homeScreen')) { stopHomeClock(); return; }
        document.querySelectorAll('[data-live-ends]').forEach(el => { el.textContent = aucClock(+el.dataset.liveEnds); });
        liveTick += 1;
        if (liveTick % 30 === 0) paintPullFeed();
        if (liveTick % 45 === 0) loadPullFeed();
        if (!livePreview && liveTick % 5 === 0) refreshLivePanel();
      }, 1000);
      paintFriendBadge();
      refreshFriendBadge();
      watchHomeLive();
      watchFriendRequests();
      if (window.TOB_TRADES && window.TOB_TRADES.watch) window.TOB_TRADES.watch();
    };
    draw();
  }
  async function showDeckSelect() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const profile = await window.TOB_AUTH.loadProfile();
    const cd = customDeck(ownedBags(profile));
    const premade = Object.entries(DECKS).filter(([, d]) => !d.ai && (!d.adminOnly || packState.role === 'admin')).map(([k, d]) => deckTile(k, d.name, d.cards)).join('');
    ov.innerHTML = `<div class="panel select deckscreen">
      <div class="deckscreen-bar">
        <div class="sb-title">Choose a deck</div>
        <input id="deckQ" placeholder="Search decks" aria-label="Search decks">
        <button type="button" class="btn" id="btnDeckHome">Home</button>
      </div>
      <div class="deck-grid">${deckTile('custom', 'My Deck', cd)}${premade}</div>
    </div>`;
    const q = $('#deckQ');
    if (q) q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      ov.querySelectorAll('.decktile').forEach(tile => {
        tile.hidden = !!(v && tile.dataset.deckname.indexOf(v) === -1);
      });
    };
    ov.querySelectorAll('[data-viewcards]').forEach(btn => {
      btn.onclick = () => {
        const tile = btn.closest('.decktile');
        const open = tile.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Hide cards' : 'View cards';
      };
    });
    ov.querySelectorAll('.deck-puck').forEach(btn => {
      const show = () => showPackTip(btn, {
        id: btn.dataset.cid,
        gold: btn.dataset.gold === '1',
        uid: 'deckpick:' + btn.dataset.cid + (btn.dataset.gold === '1' ? ':g' : ''),
        plain: true,
        ownedIds: new Set(),
      });
      btn.onmouseenter = show;
      btn.onmouseleave = () => hidePackTip();
      btn.onclick = (ev) => { ev.stopPropagation(); show(); };
    });
  }
  let collectionGold = false;
  function showCollection() {
    stopTimer();
    hidePreview();
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const draw = () => {
      hidePackTip();
      tipOwnedIds = null;
      const galleryPool = (packState.role === 'admin' && window.TOB_OBSIDIAN) ? CARD_LIST.concat(window.TOB_OBSIDIAN) : CARD_LIST.filter(c => isPublicCard(c.id));
      const cards = galleryPool.filter(c => (!archFilter || c.archetype === archFilter) && (!comboOnly || (window.TOB_COMBOS && window.TOB_COMBOS.cardInCombo(c)))).map(c => COPIES.makeCopy(c.id, {gold: collectionGold}));
      const crewList = comboOnly && window.TOB_COMBOS ? window.TOB_COMBOS.sets.map(s => `<div class="combochip"><b>${s.name}</b> +${s.bonus} · ${s.ids.map(id => CARDS[id] ? CARDS[id].name : id).join(', ')}</div>`).join('') : '';
      ov.innerHTML = `<div class="panel collection">
        <div class="sb-title">Card Gallery</div>
        <div class="tag">${CARD_LIST.length} toons. Gold copies are cosmetic. Every toon can have one, and they play the same.</div>
        <label class="goldtoggle"><input type="checkbox" id="goldView" ${collectionGold ? 'checked' : ''}> View gold copies</label>
        ${archOptions()}
        <button type="button" class="btn filter${comboOnly ? ' on' : ''}" id="comboOnly">Has combo</button>
        ${crewList ? `<div class="combolist">${crewList}</div>` : ''}
        <div class="cgrid">${cards.map(c => `<div class="ccard" data-cid="${c.id}">${cardHTML(c)}</div>`).join('')}</div>
        <div class="go-btns"><button class="btn" id="btnBack">BACK</button></div></div>`;
      $('#goldView').onchange = () => { collectionGold = $('#goldView').checked; draw(); };
      const archPick = $('#archPick');
      if (archPick) archPick.onchange = () => { archFilter = archPick.value; draw(); };
      const comboBtn = $('#comboOnly');
      if (comboBtn) comboBtn.onclick = () => { comboOnly = !comboOnly; draw(); };
      $('#btnBack').onclick = showHome;
      ov.querySelectorAll('.ccard').forEach(node => {
        node.onclick = (ev) => {
          ev.stopPropagation();
          if (!packCanHover()) showCollectionTip(node);
          inspect(COPIES.makeCopy(node.dataset.cid, {gold: collectionGold}));
        };
      });
    };
    draw();
  }
  let buildFinish = 'all', buildColor = '', buildArch = '', buildQ = '', buildSort = 'name', buildCombo = false, buildOwned = false, buildNotIn = false, buildPartners = false, buildView = 'grid', buildFocus = '', buildFrom = 'home', buildDeckOpen = false, buildSheet = false, buildFlash = '', buildFiltersOpen = false;
  function comboFacts(card, selIds, ownedIds) {
    const book = window.TOB_COMBOS;
    if (!book || !card) return [];
    const facts = [];
    (book.sets || []).filter(s => s.ids.includes(card.id)).forEach(s => {
      facts.push({
        kind: 'crew', name: s.name, bonus: s.bonus,
        partners: s.ids.filter(id => id !== card.id).map(id => ({
          name: CARDS[id] ? CARDS[id].name : id,
          state: selIds.has(id) ? 'in' : ownedIds.has(id) ? 'own' : 'miss',
        })),
      });
    });
    (book.pairs || []).filter(p => card.archetype && (p.a === card.archetype || p.b === card.archetype)).forEach(p => {
      const other = p.a === card.archetype ? p.b : p.a;
      const ids = [...selIds];
      const inDeck = ids.some(id => CARDS[id] && CARDS[id].archetype === other);
      const owned = [...ownedIds].some(id => CARDS[id] && CARDS[id].archetype === other);
      facts.push({kind: 'pair', name: p.name, bonus: p.bonus, partners: [{name: other, state: inDeck ? 'in' : owned ? 'own' : 'miss'}]});
    });
    return facts;
  }
  function extraPowers(card) {
    const lines = [];
    (card.powers || []).forEach(p => {
      if (p.type === 'tag' && p.all) lines.push('Enabler: this card counts as any archetype.');
      else if (p.type === 'tag' && p.archetype) lines.push('Enabler: neighbors count as ' + p.archetype + '.');
      if (p.cond && p.cond.kind === 'opposite' && p.cond.filter && p.cond.filter.archetype) lines.push('Rivalry: +' + p.n + ' when the card opposite is ' + p.cond.filter.archetype + '.');
      if (p.cond && p.cond.kind === 'pure') lines.push('All-in: +' + p.n + ' if every face-up card on your side shares one archetype.');
      if (p.each && p.each.distinct === 'archetype') lines.push('Diverse team: +' + p.n + ' for each different archetype on your side, up to +4.');
    });
    return lines;
  }
  function deckComboReport(selIds, ownedIds) {
    const book = window.TOB_COMBOS || {sets: [], pairs: []};
    const active = [];
    const suggest = [];
    (book.sets || []).forEach(s => {
      const have = s.ids.filter(id => selIds.has(id));
      const miss = s.ids.filter(id => !selIds.has(id));
      if (have.length === s.ids.length) active.push(s.name + ' +' + s.bonus);
      else if (have.length) miss.filter(id => ownedIds.has(id)).forEach(id => suggest.push(CARDS[id].name + ' completes ' + s.name + ' (+' + s.bonus + ')'));
    });
    const arches = new Set([...selIds].map(id => CARDS[id] && CARDS[id].archetype).filter(Boolean));
    (book.pairs || []).forEach(p => {
      if (arches.has(p.a) && arches.has(p.b)) active.push(p.name + ' +' + p.bonus);
      else if (arches.has(p.a) !== arches.has(p.b)) {
        const need = arches.has(p.a) ? p.b : p.a;
        const owned = [...ownedIds].filter(id => CARDS[id] && CARDS[id].archetype === need);
        if (owned.length) suggest.push(CARDS[owned[0]].name + ' (' + need + ') completes ' + p.name + ' (+' + p.bonus + ')');
      }
    });
    return {active, suggest: suggest.slice(0, 8)};
  }
  async function showBuilder(from) {
    if (from) buildFrom = from;
    buildFiltersOpen = false;
    stopHomeClock();
    stopTimer();
    hidePreview();
    closeUserMenu();
    const ovEarly = $('#overlay');
    ovEarly.classList.remove('hidden');
    ovEarly.innerHTML = `<div id="deckBuilder"><header class="db-top"><div class="db-title">DECK BUILDER</div></header><div class="db-skel">${'<div class="sk"></div>'.repeat(6)}</div></div>`;
    const profile = await window.TOB_AUTH.loadProfile();
    const bags = ownedBags(profile);
    let sel = customDeck(bags);
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const buildPool = (packState.role === 'admin' && window.TOB_OBSIDIAN) ? CARD_LIST.concat(window.TOB_OBSIDIAN) : CARD_LIST;
    const arches = [...new Set(buildPool.map(c => c.archetype).filter(Boolean))].sort();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const ownedIds = new Set(bags.keys());
    const ownCount = new Map();
    const pullRank = new Map();
    escrowUids();
    const listed = new Set();
    if (window.TOB_AUCTIONS && window.TOB_AUCTIONS.list) {
      const me = window.TOB_AUTH.currentUser && window.TOB_AUTH.currentUser();
      const mine = me ? String(me.username || '').toLowerCase() : '';
      window.TOB_AUCTIONS.list().forEach(lot => {
        if (lot && lot.status === 'open' && String(lot.seller || '').toLowerCase() === mine && lot.card) listed.add(lot.card.uid);
      });
    }
    ((profile && profile.collection) || []).forEach((rec, i) => {
      if (!rec || !CARDS[rec.id] || listed.has(rec.uid)) return;
      ownCount.set(rec.id, (ownCount.get(rec.id) || 0) + 1);
      pullRank.set(rec.id, i);
    });
    const haystack = new Map();
    buildPool.forEach(c => {
      let extra = '';
      const book = window.TOB_COMBOS;
      if (book) {
        (book.sets || []).forEach(s => { if (s.ids.includes(c.id)) extra += ' ' + s.name + ' ' + s.ids.map(id => CARDS[id] ? CARDS[id].name : '').join(' '); });
        (book.pairs || []).forEach(p => { if (c.archetype && (p.a === c.archetype || p.b === c.archetype)) extra += ' ' + p.name + ' ' + p.a + ' ' + p.b; });
      }
      haystack.set(c.id, (c.name + ' ' + (c.power || '') + ' ' + (c.archetype || '') + ' ' + c.group + extra).toLowerCase());
    });
    if (!buildFocus || !CARDS[buildFocus]) buildFocus = (sel[0] && sel[0].id) || '';
    const chosen = id => sel.find(row => row.id === id);
    let savedListScroll = 0;
    let pressScroll = null;

    function partnerSet(selIds) {
      const partnerIds = new Set();
      const book = window.TOB_COMBOS || {sets: [], pairs: []};
      (book.sets || []).forEach(s => {
        if (!s.ids.some(id => selIds.has(id))) return;
        s.ids.forEach(id => { if (!selIds.has(id) && ownedIds.has(id)) partnerIds.add(id); });
      });
      const deckArches = new Set([...selIds].map(id => CARDS[id] && CARDS[id].archetype).filter(Boolean));
      (book.pairs || []).forEach(p => {
        if (deckArches.has(p.a) === deckArches.has(p.b)) return;
        const need = deckArches.has(p.a) ? p.b : p.a;
        buildPool.forEach(c => { if (c.archetype === need && ownedIds.has(c.id) && !selIds.has(c.id)) partnerIds.add(c.id); });
      });
      return partnerIds;
    }
    function visibleCards() {
      const selIds = new Set(sel.map(row => row.id));
      const q = buildQ.trim().toLowerCase();
      const partnerIds = partnerSet(selIds);
      const pool = buildPool.filter(c => {
        const bag = bags.get(c.id);
        if (q && (haystack.get(c.id) || '').indexOf(q) === -1) return false;
        if (buildCombo && !(window.TOB_COMBOS && window.TOB_COMBOS.cardInCombo(c))) return false;
        if (buildOwned && !bag) return false;
        if (buildNotIn && selIds.has(c.id)) return false;
        if (buildPartners && !partnerIds.has(c.id)) return false;
        if (buildFinish === 'gold') return !!(bag && bag.gold);
        if (buildFinish === 'standard') return !!(bag && bag.standard) || !bag;
        return true;
      });
      const colorCounts = {};
      const archCounts = {};
      pool.forEach(c => {
        if (!buildArch || (c.archetype || '') === buildArch) colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        if (!buildColor || c.color === buildColor) archCounts[c.archetype || ''] = (archCounts[c.archetype || ''] || 0) + 1;
      });
      const cards = pool.filter(c => (!buildColor || c.color === buildColor) && (!buildArch || (c.archetype || '') === buildArch));
      const byColor = (a, b) => a.color.localeCompare(b.color) || a.name.localeCompare(b.name);
      const byArch = (a, b) => (a.archetype || '').localeCompare(b.archetype || '') || a.name.localeCompare(b.name);
      cards.sort((a, b) => buildSort === 'pts-desc' ? b.pts - a.pts || a.name.localeCompare(b.name)
        : buildSort === 'pts-asc' ? a.pts - b.pts || a.name.localeCompare(b.name)
        : buildSort === 'color' ? byColor(a, b)
        : buildSort === 'arch' ? byArch(a, b)
        : buildSort === 'recent' ? (pullRank.get(b.id) || -1) - (pullRank.get(a.id) || -1) || a.name.localeCompare(b.name)
        : buildSort === 'owned' ? (ownCount.get(b.id) || 0) - (ownCount.get(a.id) || 0) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name));
      return {cards, colorCounts, archCounts, partnerIds, selIds, q};
    }
    function listScroller() {
      const col = document.querySelector('#deckBuilder .db-listcol');
      if (col) {
        const oy = getComputedStyle(col).overflowY;
        if (oy === 'auto' || oy === 'scroll') return col;
      }
      return document.getElementById('overlay');
    }
    function searchSnap() {
      const q = document.getElementById('buildQ');
      return {on: !!q && document.activeElement === q, start: q ? q.selectionStart : 0, end: q ? q.selectionEnd : 0};
    }
    function restoreSearch(snap) {
      if (!snap || !snap.on) return;
      const q = document.getElementById('buildQ');
      if (!q) return;
      if (document.activeElement !== q) q.focus({preventScroll: true});
      try { q.setSelectionRange(snap.start, snap.end); } catch (e) { /* ignore */ }
    }
    function activeFilterCount() {
      let n = 0;
      if (buildFinish !== 'all') n++;
      if (buildCombo) n++;
      if (buildOwned) n++;
      if (buildNotIn) n++;
      if (buildPartners) n++;
      if (buildColor) n++;
      if (buildArch) n++;
      return n;
    }
    function tileCopy(c) {
      const bag = bags.get(c.id);
      const row = chosen(c.id);
      if (row) return COPIES.makeCopy(c.id, {gold: !!row.gold, uid: row.uid});
      if (buildFinish === 'gold' && bag && bag.gold) return COPIES.makeCopy(c.id, {gold: true, uid: bag.gold.uid});
      if (bag && bag.gold && !bag.standard) return COPIES.makeCopy(c.id, {gold: true, uid: bag.gold.uid});
      return COPIES.makeCopy(c.id, {gold: false, uid: bag && bag.standard ? bag.standard.uid : null});
    }
    function tileHtml(c) {
      const row = chosen(c.id);
      const combo = window.TOB_COMBOS && window.TOB_COMBOS.cardInCombo(c);
      return `<article class="db-item${row ? ' in' : ''}${c.id === buildFocus ? ' focus' : ''}" data-cid="${c.id}">
        <button type="button" class="db-row" data-focus="${c.id}">
          <span class="db-puck">${cardHTML(tileCopy(c))}</span>
          <span class="db-name">${esc(c.name)}</span>
          <span class="db-meta">${c.pts} pts${combo ? '<i class="db-cdot" title="Combo card"></i>' : ''}</span>
        </button>
      </article>`;
    }
    function patchTile(id) {
      const node = document.querySelector('#dbRows .db-item[data-cid="' + id + '"]');
      const c = CARDS[id];
      if (!node || !c) return;
      node.classList.toggle('in', !!chosen(id));
      node.classList.toggle('focus', id === buildFocus);
      const puck = node.querySelector('.db-puck');
      if (puck) puck.innerHTML = cardHTML(tileCopy(c));
    }
    function paintCount(n) {
      const el = document.getElementById('dbCount');
      if (!el) return;
      const searching = !!buildQ.trim();
      el.textContent = searching ? (n + (n === 1 ? ' result' : ' results')) : (n + ' cards');
    }
    function suggestMarkup(view) {
      if (view.q) return '';
      const suggestIds = [];
      view.partnerIds.forEach(id => { if (suggestIds.length < 8) suggestIds.push(id); });
      const colors = {};
      sel.forEach(row => { const c = CARDS[row.id]; if (c) colors[c.color] = (colors[c.color] || 0) + 1; });
      const goal = Object.entries(colors).sort((a, b) => b[1] - a[1])[0];
      if (goal) buildPool.forEach(c => {
        if (suggestIds.length >= 8) return;
        if (c.color === goal[0] && ownedIds.has(c.id) && !view.selIds.has(c.id) && suggestIds.indexOf(c.id) === -1) suggestIds.push(c.id);
      });
      if (!suggestIds.length) return '';
      return `<b>Suggested for this deck</b><div class="db-sugrow">${suggestIds.map(id => {
        const c = CARDS[id];
        if (!c) return '';
        const bag = bags.get(id);
        const copy = COPIES.makeCopy(id, {gold: !!(bag && bag.gold && !bag.standard)});
        return `<button type="button" class="db-sug" data-focus="${id}"><span class="db-puck sug-puck">${cardHTML(copy)}</span><span>${esc(c.name)}</span></button>`;
      }).join('')}</div>`;
    }
    function setSuggest(html) {
      const el = document.getElementById('dbSuggest');
      if (!el) return 0;
      const h0 = el.getBoundingClientRect().height;
      el.innerHTML = html;
      el.hidden = !html;
      return (el.hidden ? 0 : el.getBoundingClientRect().height) - h0;
    }
    function fillRows(view) {
      const rows = document.getElementById('dbRows');
      if (!rows) return;
      rows.className = 'db-rows ' + buildView + (sel.length >= 12 ? ' deckfull' : '');
      rows.innerHTML = view.cards.length ? view.cards.map(tileHtml).join('') : '<p class="db-empty">No cards match. Clear a filter to see more.</p>';
      paintCount(view.cards.length);
      setSuggest(suggestMarkup(view));
    }
    function syncOne(id, view) {
      const rows = document.getElementById('dbRows');
      if (!rows) return;
      const card = view.cards.find(c => c.id === id);
      const existing = rows.querySelector('.db-item[data-cid="' + id + '"]');
      rows.classList.toggle('deckfull', sel.length >= 12);
      if (!card) {
        if (existing) existing.remove();
        if (!rows.querySelector('.db-item')) rows.innerHTML = '<p class="db-empty">No cards match. Clear a filter to see more.</p>';
      } else if (!existing) {
        const empty = rows.querySelector('.db-empty');
        if (empty) empty.remove();
        const holder = document.createElement('div');
        holder.innerHTML = tileHtml(card);
        const node = holder.firstElementChild;
        const idx = view.cards.findIndex(c => c.id === id);
        const items = rows.querySelectorAll('.db-item');
        if (items[idx]) rows.insertBefore(node, items[idx]);
        else rows.appendChild(node);
      } else patchTile(id);
      paintCount(view.cards.length);
    }
    function pillsHtml() {
      const pill = (key, label) => `<button type="button" class="db-pill" data-clear="${key}">${esc(label)} ×</button>`;
      const bits = [];
      if (buildFinish !== 'all') bits.push(pill('finish', buildFinish === 'gold' ? 'Gold' : 'Standard'));
      if (buildCombo) bits.push(pill('combo', 'Has combo'));
      if (buildOwned) bits.push(pill('owned', 'Owned'));
      if (buildNotIn) bits.push(pill('notin', 'Not in deck'));
      if (buildPartners) bits.push(pill('partners', 'Combo partners'));
      if (buildColor) bits.push(pill('color', cap(buildColor)));
      if (buildArch) bits.push(pill('arch', buildArch));
      if (!bits.length) return '';
      bits.push('<button type="button" class="db-pill db-clear" data-clear="all">Clear</button>');
      return bits.join('');
    }
    function drawerHtml(view) {
      const fin = (id, label) => `<button type="button" class="db-chip${buildFinish === id ? ' on' : ''}" data-bfinish="${id}">${label}</button>`;
      const tog = (key, label, on) => `<button type="button" class="db-chip${on ? ' on' : ''}" data-qtog="${key}">${label}</button>`;
      return `<div class="db-dlabel">Finish</div>
        <div class="db-quick">${fin('all', 'All')}${fin('gold', 'Gold')}${fin('standard', 'Standard')}</div>
        <div class="db-dlabel">Limit</div>
        <div class="db-quick">${tog('combo', 'Has combo', buildCombo)}${tog('owned', 'Owned', buildOwned)}${tog('notin', 'Not in deck', buildNotIn)}${tog('partners', 'Combo partners', buildPartners)}</div>
        <div class="db-dlabel">Color</div>
        <div class="db-quick">${Object.keys(COLORS).map(c => `<button type="button" class="db-chip${buildColor === c ? ' on' : ''}" data-color="${c}"><i style="background:${COLORS[c]}"></i>${esc(cap(c))} <em>${view.colorCounts[c] || 0}</em></button>`).join('')}</div>
        <div class="db-dlabel">Archetype</div>
        <div class="db-quick">${arches.map(a => `<button type="button" class="db-chip${buildArch === a ? ' on' : ''}" data-arch="${esc(a)}">${esc(a)} <em>${view.archCounts[a] || 0}</em></button>`).join('')}</div>
        <button type="button" class="btn" id="btnAutoGold">Auto-use gold</button>`;
    }
    function paintDrawer(view) {
      const drawer = document.getElementById('dbDrawer');
      if (!drawer) return;
      drawer.classList.toggle('open', buildFiltersOpen);
      if (!buildFiltersOpen) return;
      const top = drawer.scrollTop;
      drawer.innerHTML = drawerHtml(view || visibleCards());
      drawer.scrollTop = top;
    }
    function paintChrome(view) {
      const root = document.getElementById('deckBuilder');
      if (!root) return;
      root.classList.toggle('pane-deck', buildDeckOpen);
      root.classList.toggle('pane-cards', !buildDeckOpen);
      root.classList.toggle('is-search', !!buildQ.trim());
      const n = activeFilterCount();
      const badge = document.getElementById('dbFcount');
      if (badge) { badge.textContent = String(n); badge.hidden = !n; }
      const filtersBtn = document.getElementById('btnFilters');
      if (filtersBtn) {
        filtersBtn.classList.toggle('on', buildFiltersOpen || n > 0);
        filtersBtn.setAttribute('aria-expanded', buildFiltersOpen ? 'true' : 'false');
      }
      root.querySelectorAll('[data-view]').forEach(btn => {
        const on = btn.dataset.view === buildView;
        btn.classList.toggle('go', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      root.querySelectorAll('[data-pane]').forEach(btn => {
        btn.classList.toggle('go', (btn.dataset.pane === 'deck') === buildDeckOpen);
      });
      const rows = document.getElementById('dbRows');
      if (rows) {
        rows.classList.toggle('grid', buildView === 'grid');
        rows.classList.toggle('list', buildView === 'list');
        rows.classList.toggle('deckfull', sel.length >= 12);
      }
      const sort = document.getElementById('buildSort');
      if (sort && sort.value !== buildSort) sort.value = buildSort;
      const pills = document.getElementById('dbPills');
      if (pills) pills.innerHTML = pillsHtml();
      paintDrawer(view);
    }
    function refreshList(fromPointer) {
      const scroller = listScroller();
      const top = fromPointer && pressScroll != null ? pressScroll : (scroller ? scroller.scrollTop : 0);
      const snap = searchSnap();
      const view = visibleCards();
      fillRows(view);
      paintChrome(view);
      if (scroller) scroller.scrollTop = top;
      restoreSearch(snap);
    }
    const mark = state => state === 'miss' ? 'is-miss' : state === 'in' ? 'is-in' : 'is-own';
    const markText = state => state === 'in' ? 'In deck' : state === 'own' ? 'Owned' : 'Not owned';
    function factHtml(card, selIds) {
      return comboFacts(card, selIds, ownedIds).map(fact => `<div class="db-fact"><span class="db-badge">COMBO</span> <b>${esc(fact.name)}</b> +${fact.bonus}<ul>${fact.partners.map(p => `<li class="${mark(p.state)}">${markText(p.state)} · ${esc(p.name)}</li>`).join('')}</ul></div>`).join('');
    }
    function detailHtml(card) {
      if (!card) return '<p class="db-power">Tap a card to read its skill and combos.</p>';
      const row = chosen(card.id);
      const bag = bags.get(card.id);
      const extras = extraPowers(card).map(line => `<p class="db-power">${esc(line)}</p>`).join('');
      const both = bag && bag.gold && bag.standard;
      const face = COPIES.makeCopy(card.id, {gold: !!(row && row.gold), uid: row && row.uid});
      const selIds = new Set(sel.map(item => item.id));
      const canAdd = !!row || sel.length < 12;
      return `<div class="db-puck db-hero">${cardHTML(face, null, true)}</div>
        <div class="db-dname">${esc(card.name)}</div>
        <p class="db-meta"><span class="db-chipstat">${card.pts} pts</span><span class="db-chipstat"><i style="background:${COLORS[card.color]}"></i>${esc(cap(card.color))}</span><span class="db-chipstat">${esc(card.archetype || card.group || 'No type')}</span>${row && row.gold ? '<span class="db-chipstat">Gold</span>' : ''}</p>
        <p class="db-power">${esc(card.power && card.power !== 'No Power' ? card.power : 'No power.')}</p>
        ${extras}
        ${factHtml(card, selIds) || '<p class="db-power">No named crew or archetype pair on this card.</p>'}
        <div class="db-tools">
          ${both ? `<button type="button" class="btn" data-goldpick="${card.id}">${row && row.gold ? 'Use standard' : 'Use gold'}</button>` : ''}
          <button type="button" class="btn go" data-add="${card.id}" ${canAdd ? '' : 'disabled'}>${row ? 'Remove from deck' : 'Add to deck'}</button>
        </div>`;
    }
    function deckHtml() {
      const pts = sel.reduce((sum, row) => sum + (CARDS[row.id] ? CARDS[row.id].pts : 0), 0);
      const colors = {};
      sel.forEach(row => { const c = CARDS[row.id]; if (c) colors[c.color] = (colors[c.color] || 0) + 1; });
      const selIds = new Set(sel.map(row => row.id));
      const report = deckComboReport(selIds, ownedIds);
      const deckRows = sel.map(row => {
        const c = CARDS[row.id];
        if (!c) return '';
        const bag = bags.get(row.id);
        const copy = COPIES.makeCopy(row.id, {gold: !!row.gold, uid: row.uid});
        const both = bag && bag.gold && bag.standard;
        return `<article class="yd-row${buildFlash === row.id ? ' db-flash' : ''}" data-cid="${c.id}">
          <button type="button" class="yd-main" data-focus="${c.id}">
            <span class="db-puck yd-puck">${cardHTML(copy)}</span>
            <span class="db-copy">
              <span class="db-name">${esc(c.name)}</span>
              <span class="db-meta">${c.pts} pts · ${esc(cap(c.color))} · ${esc(c.archetype || c.group)}${row.gold ? ' · Gold' : ''}</span>
              <span class="db-power">${esc(c.power && c.power !== 'No Power' ? c.power : 'No power.')}</span>
            </span>
          </button>
          <span class="yd-tools">
            ${both ? `<button type="button" class="btn yd-gold" data-goldpick="${c.id}">${row.gold ? 'Gold' : 'Std'}</button>` : ''}
            <button type="button" class="db-remove" data-remove="${c.id}" aria-label="Remove ${esc(c.name)}">Remove</button>
          </span>
        </article>`;
      }).join('');
      return `<div class="db-deckhead">YOUR DECK <b>${sel.length}/12</b> · ${pts} pts</div>
        <div class="db-decktools"><button type="button" class="btn" id="btnClearDeck" ${sel.length ? '' : 'disabled'}>Clear deck</button></div>
        <div class="db-colors">${Object.entries(colors).map(([c, n]) => `<span class="db-colorchip" style="--cc:${COLORS[c]}"><i style="background:${COLORS[c]}"></i>${n} ${esc(cap(c))}</span>`).join('') || '<span class="db-colorchip">No colors yet</span>'}</div>
        <div class="yd-list">${deckRows || '<p class="db-empty">Your deck is empty. Add cards from the list. They show up here.</p>'}</div>
        <div class="db-active"><b>Active combos in this deck</b>${report.active.length ? report.active.map(line => `<p>${esc(line)}</p>`).join('') : '<p>None yet. Add a full crew or both sides of a pair.</p>'}</div>
        <div class="db-active"><b>Partners you own</b>${report.suggest.length ? report.suggest.map(line => `<p>${esc(line)}</p>`).join('') : '<p>No missing partner sitting in your collection.</p>'}</div>`;
    }
    function paintDeck() {
      const deck = document.getElementById('dbDeck');
      const pts = sel.reduce((sum, row) => sum + (CARDS[row.id] ? CARDS[row.id].pts : 0), 0);
      if (deck) deck.innerHTML = deckHtml();
      const tray = document.getElementById('btnOpenDeck');
      if (tray) tray.textContent = `Deck ${sel.length}/12 · ${pts} pts`;
      const save = document.getElementById('btnSaveDeck');
      if (save) save.disabled = sel.length !== 12;
      buildFlash = '';
    }
    function paintDetail() {
      const html = detailHtml(CARDS[buildFocus]);
      const detail = document.getElementById('dbDetail');
      if (detail) detail.innerHTML = html;
      const sheet = document.getElementById('dbSheet');
      if (!sheet) return;
      const top = sheet.scrollTop;
      sheet.classList.toggle('open', !!buildSheet);
      sheet.innerHTML = buildSheet ? `<button type="button" class="btn" id="btnCloseSheet">Close</button>${html}` : '';
      if (buildSheet) sheet.scrollTop = top;
    }
    function afterDeck(changedId) {
      const snap = searchSnap();
      const scroller = listScroller();
      const top = pressScroll != null ? pressScroll : (scroller ? scroller.scrollTop : 0);
      const view = visibleCards();
      let delta = 0;
      if (buildPartners) {
        fillRows(view);
        paintChrome(view);
      } else {
        delta = setSuggest(suggestMarkup(view));
        if (buildNotIn) syncOne(changedId, view);
        else {
          patchTile(changedId);
          const rows = document.getElementById('dbRows');
          if (rows) rows.classList.toggle('deckfull', sel.length >= 12);
        }
        paintChrome(view);
      }
      paintDeck();
      paintDetail();
      if (scroller) scroller.scrollTop = top > 0 ? top + delta : top;
      restoreSearch(snap);
    }
    function pickGold(id) {
      const bag = bags.get(id);
      if (buildFinish === 'gold' && bag && bag.gold) return {id, gold: true, uid: bag.gold.uid};
      if (bag && bag.gold && !bag.standard) return {id, gold: true, uid: bag.gold.uid};
      if (bag && bag.standard) return {id, gold: false, uid: bag.standard.uid};
      return {id, gold: false, uid: null};
    }
    function toggleDeck(id) {
      if (chosen(id)) sel = sel.filter(row => row.id !== id);
      else if (sel.length < 12) { sel.push(pickGold(id)); buildFlash = id; }
      else return;
      afterDeck(id);
    }
    function toggleGold(id) {
      const bag = bags.get(id);
      if (!bag || !bag.gold || !bag.standard) return;
      const row = chosen(id);
      const next = row && row.gold ? {id, gold: false, uid: bag.standard.uid} : {id, gold: true, uid: bag.gold.uid};
      if (row) sel = sel.map(item => item.id === id ? next : item);
      else if (sel.length < 12) { sel.push(next); buildFlash = id; }
      else return;
      afterDeck(id);
    }
    function setFocus(id, sheet) {
      buildFocus = id;
      buildSheet = !!sheet;
      document.querySelectorAll('#dbRows .db-item.focus').forEach(node => node.classList.remove('focus'));
      const node = document.querySelector('#dbRows .db-item[data-cid="' + id + '"]');
      if (node) node.classList.add('focus');
      paintDetail();
    }
    function showPane(deck) {
      const scroller = listScroller();
      if (deck && scroller) savedListScroll = scroller.scrollTop;
      buildDeckOpen = !!deck;
      buildSheet = false;
      paintChrome();
      paintDetail();
      if (!deck) requestAnimationFrame(() => {
        const box = listScroller();
        if (box) box.scrollTop = savedListScroll;
      });
    }
    function clearFilters(k) {
      if (k === 'all' || k === 'q') {
        buildQ = '';
        const box = document.getElementById('buildQ');
        if (box) box.value = '';
      }
      if (k === 'all' || k === 'finish') buildFinish = 'all';
      if (k === 'all' || k === 'combo') buildCombo = false;
      if (k === 'all' || k === 'owned') buildOwned = false;
      if (k === 'all' || k === 'notin') buildNotIn = false;
      if (k === 'all' || k === 'partners') buildPartners = false;
      if (k === 'all' || k === 'color') buildColor = '';
      if (k === 'all' || k === 'arch') buildArch = '';
      refreshList(true);
    }
    const sortOpt = (value, label) => `<option value="${value}"${buildSort === value ? ' selected' : ''}>${label}</option>`;
    ov.innerHTML = `<div id="deckBuilder" class="${buildDeckOpen ? 'pane-deck' : 'pane-cards'}">
      <header class="db-top">
        <div class="db-title">DECK BUILDER</div>
        <button type="button" class="btn go" id="btnSaveDeck" ${sel.length === 12 ? '' : 'disabled'}>Save & play</button>
        <button type="button" class="btn" id="btnBack">${buildFrom === 'deck' ? 'Deck select' : 'Home'}</button>
      </header>
      <div class="db-switch">
        <button type="button" class="btn${buildDeckOpen ? '' : ' go'}" data-pane="cards">Cards</button>
        <button type="button" class="btn${buildDeckOpen ? ' go' : ''}" data-pane="deck">My Deck</button>
      </div>
      <div class="db-body">
        <section class="db-listcol">
          <div class="db-bar">
            <div class="db-bar-row">
              <input id="buildQ" value="${esc(buildQ)}" placeholder="Search" aria-label="Search name, power, or combo" autocomplete="off" spellcheck="false">
              <button type="button" class="db-filterbtn" id="btnFilters" aria-expanded="false">Filters <span class="db-fcount" id="dbFcount" hidden>0</span></button>
              <select id="buildSort" aria-label="Sort">${sortOpt('name', 'A–Z')}${sortOpt('pts-desc', 'Pts ↓')}${sortOpt('pts-asc', 'Pts ↑')}${sortOpt('color', 'Color')}${sortOpt('arch', 'Type')}${sortOpt('recent', 'Recent')}${sortOpt('owned', 'Owned')}</select>
              <div class="db-view" role="group" aria-label="Layout">
                <button type="button" class="db-iconbtn${buildView === 'grid' ? ' go' : ''}" data-view="grid" aria-label="Grid">Grid</button>
                <button type="button" class="db-iconbtn${buildView === 'list' ? ' go' : ''}" data-view="list" aria-label="List">List</button>
              </div>
            </div>
            <div class="db-pills" id="dbPills"></div>
            <div class="db-drawer" id="dbDrawer"></div>
          </div>
          <div class="db-suggest" id="dbSuggest" hidden></div>
          <div class="db-countline" id="dbCount"></div>
          <div class="db-rows ${buildView}" id="dbRows"></div>
        </section>
        <section class="db-detail" id="dbDetail"></section>
        <aside class="db-deckcol" id="dbDeck"></aside>
      </div>
      <button type="button" class="db-tray" id="btnOpenDeck">Deck ${sel.length}/12</button>
      <div class="db-sheet" id="dbSheet"></div>
    </div>`;
    const root = document.getElementById('deckBuilder');
    root.addEventListener('pointerdown', () => {
      const scroller = listScroller();
      pressScroll = scroller ? scroller.scrollTop : 0;
    }, true);
    root.addEventListener('input', ev => {
      if (ev.target && ev.target.id === 'buildQ') {
        buildQ = ev.target.value;
        refreshList();
      }
    });
    root.addEventListener('change', ev => {
      if (ev.target && ev.target.id === 'buildSort') {
        buildSort = ev.target.value;
        refreshList();
      }
    });
    root.addEventListener('click', ev => {
      const t = ev.target.closest('button');
      if (!t || !root.contains(t)) return;
      if (t.id === 'btnBack') { buildFrom === 'deck' ? showDeckSelect() : showHome(); return; }
      if (t.id === 'btnSaveDeck') {
        localStorage.setItem('tob_custom', JSON.stringify(sel));
        if (isOnlinePlayer()) window.TOB_AUTH.saveDeck(sel);
        quickStart('custom');
        return;
      }
      if (t.id === 'btnFilters') { buildFiltersOpen = !buildFiltersOpen; paintChrome(); return; }
      if (t.id === 'btnOpenDeck') { showPane(true); return; }
      if (t.id === 'btnCloseSheet') { buildSheet = false; paintDetail(); return; }
      if (t.id === 'btnClearDeck') {
        if (!sel.length || !window.confirm('Remove every card from your deck?')) return;
        sel = [];
        try { localStorage.setItem('tob_custom', '[]'); } catch (e) { /* ignore */ }
        refreshList(true);
        paintDeck();
        paintDetail();
        return;
      }
      if (t.id === 'btnAutoGold') {
        sel = sel.map(row => {
          const bag = bags.get(row.id);
          if (bag && bag.gold) return {id: row.id, gold: true, uid: bag.gold.uid};
          return row;
        });
        const view = visibleCards();
        sel.forEach(row => patchTile(row.id));
        setSuggest(suggestMarkup(view));
        paintDeck();
        paintDetail();
        return;
      }
      if (t.dataset.pane) { showPane(t.dataset.pane === 'deck'); return; }
      if (t.dataset.view) { buildView = t.dataset.view; paintChrome(); return; }
      if (t.dataset.bfinish) { buildFinish = t.dataset.bfinish; refreshList(true); return; }
      if (t.dataset.qtog) {
        const k = t.dataset.qtog;
        if (k === 'combo') buildCombo = !buildCombo;
        if (k === 'owned') buildOwned = !buildOwned;
        if (k === 'notin') buildNotIn = !buildNotIn;
        if (k === 'partners') buildPartners = !buildPartners;
        refreshList(true);
        return;
      }
      if (t.dataset.color) { buildColor = buildColor === t.dataset.color ? '' : t.dataset.color; refreshList(true); return; }
      if (t.dataset.arch) { buildArch = buildArch === t.dataset.arch ? '' : t.dataset.arch; refreshList(true); return; }
      if (t.dataset.clear) { clearFilters(t.dataset.clear); return; }
      if (t.dataset.remove) { ev.stopPropagation(); toggleDeck(t.dataset.remove); return; }
      if (t.dataset.goldpick) { toggleGold(t.dataset.goldpick); return; }
      if (t.dataset.add) { toggleDeck(t.dataset.add); return; }
      if (t.dataset.focus) {
        if (buildFiltersOpen) { buildFiltersOpen = false; paintChrome(); }
        setFocus(t.dataset.focus, matchMedia('(max-width: 899px)').matches);
      }
    });
    refreshList();
    paintDeck();
    paintDetail();
    deckDrag = {
      add(id) { if (!chosen(id) && sel.length < 12) toggleDeck(id); },
      remove(id) { if (chosen(id)) toggleDeck(id); },
      move(id, beforeId) {
        const from = sel.findIndex(row => row.id === id);
        let to = sel.findIndex(row => row.id === beforeId);
        if (from < 0 || to < 0 || from === to) return;
        const [row] = sel.splice(from, 1);
        if (from < to) to -= 1;
        sel.splice(to, 0, row);
        afterDeck(id);
      },
    };
    if (!showBuilder._keys) {
      showBuilder._keys = true;
      document.addEventListener('keydown', e => {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (!document.getElementById('deckBuilder')) return;
        const tag = ((e.target && e.target.tagName) || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        const box = document.getElementById('buildQ');
        if (box) box.focus();
      });
    }
  }
  let aucTab = 'browse', aucLot = null, aucQ = '', aucArch = '', aucGold = '', aucSort = 'ending', aucTimer = null;
  let aucPage = 1, aucOwn = 'all', aucRarity = '', aucMin = '', aucMax = '', aucFeatured = false, aucHasBids = false, aucWishOnly = false, aucKind = 'all', aucView = 'list';
  function rarityName(card) {
    const pts = card && card.pts | 0;
    if (pts >= 8) return 'Legendary';
    if (pts >= 6) return 'Rare';
    if (pts >= 4) return 'Uncommon';
    return 'Common';
  }
  function wishIds() {
    try { return new Set(JSON.parse(localStorage.getItem('tob_wish') || '[]')); }
    catch (e) { return new Set(); }
  }
  function toggleWish(id) {
    const set = wishIds();
    if (set.has(id)) set.delete(id); else set.add(id);
    localStorage.setItem('tob_wish', JSON.stringify([...set]));
  }
  function aucClock(ends) {
    let ms = Math.max(0, ends - Date.now());
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return (d ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(sec);
  }
  function auctionNotices() {
    const house = window.TOB_AUCTIONS;
    if (!house || !house.settle) return;
    try { house.settle(); } catch (e) { /* ignore */ }
    const notes = house.pullNotices ? house.pullNotices() : [];
    if (notes && notes.length) toast(notes.map(n => n.text).join(' '));
  }
  async function showAuctions() {
    stopHomeClock();
    stopTimer();
    hidePreview();
    closeUserMenu();
    const profile = await liveProfile();
    if (!profile) return showAuth('login');
    const houseNow = window.TOB_AUCTIONS;
    if (houseNow && houseNow.refresh) {
      try { await houseNow.refresh(); } catch (e) { toast('Could not refresh the auction house.'); }
    }
    auctionNotices();
    const house = window.TOB_AUCTIONS;
    const me = profile.username;
    const admin = packState.role === 'admin';
    const all = house.list();
    const active = all.filter(lot => lot.status === 'open' && lot.ends > Date.now());
    const mineName = String(me || '').toLowerCase();
    const q = aucQ.trim().toLowerCase();
    const minP = aucMin === '' ? null : Number(aucMin);
    const maxP = aucMax === '' ? null : Number(aucMax);
    const wishes = wishIds();
    const lotOwned = lot => (profile.collection || []).some(rec => rec && rec.id === lot.card.id);
    const filterLots = source => {
      let rows = source.filter(lot => {
        if (!lot || !lot.card) return false;
        if (q && String(lot.card.name || '').toLowerCase().indexOf(q) === -1) return false;
        if (aucArch && lot.card.archetype !== aucArch) return false;
        if (aucGold === 'gold' && !lot.card.gold) return false;
        if (aucGold === 'standard' && lot.card.gold) return false;
        if (aucRarity && rarityName(CARDS[lot.card.id] || lot.card) !== aucRarity) return false;
        const price = lot.bidder ? (lot.bid || 0) : lot.start;
        if (minP != null && !Number.isNaN(minP) && price < minP) return false;
        if (maxP != null && !Number.isNaN(maxP) && price > maxP) return false;
        if (aucHasBids && !lot.bidder) return false;
        if (aucWishOnly && !wishes.has(lot.card.id)) return false;
        if (aucOwn === 'owned' && !lotOwned(lot)) return false;
        if (aucOwn === 'unowned' && lotOwned(lot)) return false;
        if (aucKind === 'packs') return false;
        return true;
      });
      rows.sort((a, b) => aucSort === 'high' ? (b.bid || b.start) - (a.bid || a.start) : aucSort === 'low' ? (a.bid || a.start) - (b.bid || b.start) : a.ends - b.ends);
      if (aucFeatured && rows.length) rows = rows.slice(0, 1);
      return rows;
    };
    const feature = aucLot ? all.find(lot => lot.id === aucLot) : null;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const thumb = lot => {
      const copy = COPIES.makeCopy(lot.card.id, {gold: !!lot.card.gold, uid: lot.card.uid});
      return copy ? cardHTML(copy, null, true) : '';
    };
    const aucRow = lot => {
      const owned = lotOwned(lot);
      const price = lot.bidder ? (lot.bid || 0) : lot.start;
      const label = lot.status !== 'open' ? String(lot.status || '').toUpperCase() : (lot.bidder ? 'CURRENT' : 'START');
      const bids = (lot.bids || []).length;
      const serial = String(lot.card.uid || lot.id || '').replace(/[^a-z0-9]/gi, '').slice(-6);
      const rare = rarityName(CARDS[lot.card.id] || lot.card);
      const clock = lot.status === 'open' ? `<b class="auc-left" data-ends="${lot.ends}">${aucClock(lot.ends)}</b>` : `<b class="auc-left">${esc(lot.status)}</b>`;
      const wish = wishes.has(lot.card.id) ? 'on' : '';
      if (aucView === 'cards') {
        return `<div class="orbit-tile"><div class="orbit-mini">${thumb(lot)}</div><span class="own-tag${owned ? ' is-own' : ''}">${owned ? 'Owned' : 'Unowned'}</span><b>${esc(lot.card.name)}</b><span class="rarity r-${rare.toLowerCase()}">${rare}</span><button type="button" class="btn ghost" data-wish="${esc(lot.card.id)}">${wish ? 'Wishlisted' : 'Wishlist'}</button><button type="button" class="btn ghost" data-lot="${esc(lot.id)}">View</button></div>`;
      }
      return `<div class="orbit-lot"><div class="orbit-mini">${thumb(lot)}</div><div class="orbit-lotmain"><span class="own-tag${owned ? ' is-own' : ''}">${owned ? 'Owned' : 'Unowned'}</span> <b>${esc(lot.card.name)}</b> <span class="rarity r-${rare.toLowerCase()}">${rare}</span> <span class="serial">#${esc(serial)}</span></div><div class="orbit-price"><span>${label}</span><b>${price}</b><span>${bids} bid${bids === 1 ? '' : 's'}</span></div>${clock}<button type="button" class="btn ghost" data-wish="${esc(lot.card.id)}">${wish ? '★' : '☆'}</button><button type="button" class="btn ghost" data-lot="${esc(lot.id)}">View</button></div>`;
    };
    const pager = (page, pages) => `<div class="auc-pager"><button type="button" class="btn ghost" id="aucPrev" ${page <= 1 ? 'disabled' : ''}>&lt;</button><span>${page}/${pages}</span><button type="button" class="btn ghost" id="aucNext" ${page >= pages ? 'disabled' : ''}>&gt;</button></div>`;
    const pageOf = list => {
      const pages = Math.max(1, Math.ceil(list.length / 8));
      const page = Math.min(Math.max(1, aucPage), pages);
      aucPage = page;
      const slice = list.slice((page - 1) * 8, page * 8);
      const grid = aucView === 'cards' ? ' auc-cards' : '';
      return `${pager(page, pages)}<div class="auc-list${grid}">${slice.map(aucRow).join('') || '<p class="prof-note">Nothing here yet.</p>'}</div>${pager(page, pages)}`;
    };
    let body = '';
    if (aucTab === 'detail' && feature) {
      const floor = house.minBid(feature);
      const open = feature.status === 'open' && feature.ends > Date.now();
      const history = (feature.bids || []).slice().reverse().map(b => `<li><b>${esc(b.user)}</b> bid ${b.amount}</li>`).join('') || '<li>No bids yet.</li>';
      body = `<section class="auc-feature">
        <div class="auc-copy">
          <div class="auc-kicker">LOT ${esc(feature.id)}</div>
          <div class="auc-name">${esc(feature.card.name)}</div>
          <div class="auc-meta">Seller <b>${esc(feature.seller)}</b></div>
          <div class="auc-meta">Starting price <b>${feature.start}</b></div>
          <div class="auc-meta">High bid <b>${feature.bidder ? feature.bid : '—'}</b></div>
          <div class="auc-meta">High bidder <b>${feature.bidder ? esc(feature.bidder) : '—'}</b></div>
          <div class="portal-clock"><span>TIME REMAINING</span><b class="auc-digits"${open ? ` data-ends="${feature.ends}"` : ''}>${open ? aucClock(feature.ends) : feature.status.toUpperCase()}</b></div>
          ${open && mineName !== String(feature.seller).toLowerCase() ? `<div class="auc-bidrow"><input id="aucAmount" type="number" min="${floor}" value="${floor}" aria-label="Your bid"><button type="button" class="portal-cta" id="btnPlaceBid">BID NOW</button></div><p class="prof-note">Minimum ${floor}. A bid in the last 60 seconds adds 60 seconds.</p>` : ''}
          ${open && mineName === String(feature.seller).toLowerCase() && !feature.bidder ? `<button type="button" class="btn" id="btnAucCancel">Cancel listing</button>` : ''}
          ${admin && open ? `<div class="prof-actions"><button type="button" class="btn" id="btnAucForce">Force end</button><button type="button" class="btn" id="btnAucAdminCancel">Admin cancel</button></div>` : ''}
          <p class="prof-err" id="aucErr"></p>
          <div class="auc-kicker">BID HISTORY</div>
          <ul class="auc-history">${history}</ul>
        </div>
        <div class="auc-stage">${thumb(feature)}</div>
      </section>`;
    } else if (aucTab === 'listings' || aucTab === 'bids') {
      const source = aucTab === 'bids'
        ? all.filter(lot => (lot.bids || []).some(b => String(b.user).toLowerCase() === mineName) || String(lot.bidder || '').toLowerCase() === mineName)
        : all.filter(lot => String(lot.seller).toLowerCase() === mineName);
      const durs = house.durations().concat(admin ? house.adminDurations() : []);
      const owned = aucTab === 'listings' ? (profile.collection || []).filter(rec => rec && CARDS[rec.id]) : [];
      body = `${aucTab === 'listings' ? `<form class="auc-form" id="aucListForm">
          <select id="aucUid" aria-label="Card to list">${owned.map(rec => `<option value="${esc(rec.uid)}">${esc(CARDS[rec.id].name)}${rec.gold ? ' · GOLD' : ''}</option>`).join('') || '<option value="">No cards to list</option>'}</select>
          <input id="aucStart" type="number" min="1" value="50" aria-label="Starting price">
          <select id="aucDur" aria-label="Duration">${durs.map(d => `<option value="${d.ms}">${d.label}</option>`).join('')}</select>
          <button type="submit" class="btn go">List card</button>
        </form><p class="prof-note">House cut is ${house.feePct()}% of the winning bid. The copy leaves your collection until the auction ends.</p><p class="prof-err" id="aucErr"></p>` : ''}
        ${pageOf(source)}`;
    } else {
      const source = filterLots(aucTab === 'all' ? all : active);
      const tools = `<div class="auc-tools"><div class="seg">${[['all','All'],['cards','Cards'],['packs','Packs']].map(([id, label]) => `<button type="button" class="btn${aucKind === id ? ' go' : ''}" data-auckind="${id}">${label}</button>`).join('')}</div><div class="seg">${[['list','List'],['cards','Cards']].map(([id, label]) => `<button type="button" class="btn${aucView === id ? ' go' : ''}" data-aucview="${id}">${label}</button>`).join('')}</div></div>`;
      body = `${tools}${source.length ? pageOf(source) : '<p class="prof-note">No live auctions. List a card from My Auctions.</p>'}`;
    }
    const tabs = [['browse', 'CURRENT'], ['bids', 'MY BIDS'], ['listings', 'MY AUCTIONS'], ['all', 'ALL']];
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `<div id="auctionScreen"><div class="auc-wrap">
      <div class="auc-head"><div class="auc-tabs">${tabs.map(([id, label]) => `<button type="button" class="btn${aucTab === id || (id === 'all' && aucTab === 'history') ? ' go' : ''}" data-auctab="${id}">${label}</button>`).join('')}</div></div>
      ${body}
      <div class="go-btns"><button type="button" class="btn" id="btnAucHome">BACK</button></div>
    </div></div>`;
    const say = msg => { const node = $('#aucErr'); if (node) node.textContent = msg || ''; else if (msg) toast(msg); };
    $('#btnAucHome').onclick = () => { if (aucTab === 'detail') { aucTab = 'browse'; aucLot = null; showAuctions(); } else showHome(); };
    ov.querySelectorAll('[data-auctab]').forEach(btn => { btn.onclick = () => { aucTab = btn.dataset.auctab; aucLot = null; showAuctions(); }; });
    ov.querySelectorAll('[data-lot]').forEach(btn => { btn.onclick = () => { aucLot = btn.dataset.lot; aucTab = 'detail'; showAuctions(); }; });
    const bidBtn = $('#btnPlaceBid');
    if (bidBtn) bidBtn.onclick = async () => {
      const res = await Promise.resolve(house.bid(feature.id, $('#aucAmount').value));
      if (!res || !res.ok) { say((res && res.error) || 'Bid failed.'); return; }
      const fresh = await liveProfile();
      if (fresh) rememberPacks(fresh);
      toast('Bid placed.');
      showAuctions();
    };
    const cancelBtn = $('#btnAucCancel');
    if (cancelBtn) cancelBtn.onclick = async () => {
      const res = await Promise.resolve(house.cancel(feature.id));
      say(res && res.ok ? '' : ((res && res.error) || 'Could not cancel.'));
      if (res && res.ok) { aucTab = 'listings'; aucLot = null; liveProfile().then(showAuctions); }
    };
    const forceBtn = $('#btnAucForce');
    if (forceBtn) forceBtn.onclick = async () => { await Promise.resolve(house.adminEnd(feature.id)); aucTab = 'all'; aucLot = null; showAuctions(); };
    const adminCancel = $('#btnAucAdminCancel');
    if (adminCancel) adminCancel.onclick = async () => { await Promise.resolve(house.adminCancel(feature.id)); aucTab = 'all'; aucLot = null; showAuctions(); };
    const form = $('#aucListForm');
    if (form) form.onsubmit = async (ev) => {
      ev.preventDefault();
      const res = await Promise.resolve(house.create({uid: $('#aucUid').value, start: $('#aucStart').value, ms: $('#aucDur').value}));
      if (!res || !res.ok) { say((res && res.error) || 'Could not list that card.'); return; }
      toast('Listed ' + res.lot.card.name + '.');
      liveProfile().then(() => showAuctions());
    };
    ov.querySelectorAll('[data-auckind]').forEach(btn => { btn.onclick = () => { aucKind = btn.dataset.auckind; aucPage = 1; showAuctions(); }; });
    ov.querySelectorAll('[data-aucview]').forEach(btn => { btn.onclick = () => { aucView = btn.dataset.aucview; aucPage = 1; showAuctions(); }; });
    ov.querySelectorAll('[data-wish]').forEach(btn => { btn.onclick = (ev) => { ev.stopPropagation(); toggleWish(btn.dataset.wish); showAuctions(); }; });
    const prev = $('#aucPrev');
    const next = $('#aucNext');
    if (prev) prev.onclick = () => { aucPage -= 1; showAuctions(); };
    if (next) next.onclick = () => { aucPage += 1; showAuctions(); };
    document.querySelectorAll('#aucPrev, #aucNext').forEach(btn => {
      if (btn === prev || btn === next) return;
      btn.onclick = btn.id === 'aucPrev' ? () => { aucPage -= 1; showAuctions(); } : () => { aucPage += 1; showAuctions(); };
    });
    paintAuctionSide();
    clearInterval(aucTimer);
    aucTimer = setInterval(() => {
      if (!$('#auctionScreen')) { clearInterval(aucTimer); return; }
      const ended = house.settle();
      if (ended) { showAuctions(); return; }
      document.querySelectorAll('[data-ends]').forEach(node => { node.textContent = aucClock(Number(node.dataset.ends)); });
    }, 1000);
  }
  function showRules(tab) {
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const which = tab === 'combos' ? 'combos' : tab === 'auctions' ? 'auctions' : 'rules';
    const combosOn = which === 'combos';
    const book = window.TOB_COMBOS || {pairs: [], sets: []};
    const comboBody = `<div class="tag">Combos score when the pieces are face-up on your side. Color goals are unchanged.</div>
      <ul class="combolist">
        <li><b>Archetype pair +3.</b> Field both types. ${book.pairs.map(p => `${p.name} (${p.a} + ${p.b})`).join('; ')}.</li>
        <li><b>Named crew.</b> Every listed toon, face-up on your side. Duos +6, trios +8.</li>
        <li><b>Diverse team.</b> Mayor Bigsby scores +1 for each different archetype you have, up to +4.</li>
        <li><b>All-in.</b> Captain Shieldwall scores +5 if every face-up card on your side shares one archetype.</li>
        <li><b>Rivalry.</b> A few toons score +4 when the card across from them is a rival archetype.</li>
        <li><b>Enablers.</b> Glorbina counts as any archetype. Madame Moonquill, Bud Buddy, and Bleep-O make neighbors count as their ally type.</li>
      </ul>
      <div class="combolist">${book.sets.map(s => `<div class="combochip"><b>${s.name}</b> +${s.bonus} · ${s.ids.map(id => CARDS[id] ? CARDS[id].name : id).join(', ')}</div>`).join('')}</div>`;
    const auctionBody = `<div class="tag">List a copy you own. While it is up, it is not in your collection. A bid locks the bidder’s coins until someone bids higher.</div>
      <ul class="combolist">
        <li><b>Starting price.</b> The first bid must meet it. Later bids must beat the high bid by 5% or 10 coins, whichever is more.</li>
        <li><b>Time.</b> Choose 1 hour, 6 hours, 24 hours, or 3 days. A bid in the last 60 seconds adds 60 seconds.</li>
        <li><b>End.</b> The winner gets that exact copy, gold included. The seller gets the coins, minus the house cut. No bids, and the card comes back. Cancel only before the first bid.</li>
        <li>You can’t bid on your own lot. On this device, only players saved in this browser can bid.</li>
      </ul>`;
    ov.innerHTML = `<div class="panel rules"><div class="sb-title">HOW TO PLAY</div>
      <div class="auth-tabs"><button type="button" class="btn${which === 'rules' ? ' go' : ''}" id="btnRulesTab">Rules</button><button type="button" class="btn${combosOn ? ' go' : ''}" id="btnCombosTab">Combos</button><button type="button" class="btn${which === 'auctions' ? ' go' : ''}" id="btnAuctionsTab">Auctions</button></div>
      ${which === 'combos' ? comboBody : which === 'auctions' ? auctionBody : `<ol>
      <li><b>Decks:</b> 12 different cards each. Every card has a color, points, a power (or none) and features. Both decks are shuffled and each deck's <b>bottom card</b> is shown: its color is a <b>goal color</b>. Black and Silver are not goal colors; if both bottom cards share a color there is just one goal color.</li>
      <li><b>Round 1:</b> You draw 6. Put 4 cards in the 4 inner slots and press READY. Cards flip one by one and are scored.</li>
      <li><b>Cancel-outs:</b> If the same character is in play twice (either board, even your own), the lower-value version survives and the others are cancelled. The exact same card on both boards cancels both.</li>
      <li><b>Powers</b> change points or colors. Multipliers (x2) apply to the printed points first, then bonuses (+3). "Next to" means any touching slot on your side; "opposite" is the card across from it.</li>
      <li><b>Discard</b> 0–2 of your leftover cards and draw back up to 6.</li>
      <li><b>Round 2:</b> Three new slots open below. Play 3 cards; the first 2 flip, the last stays face down.</li>
      <li><b>Swap:</b> You may trade your face-down card for one in your hand for −10 points.</li>
      <li><b>Silver:</b> If you have Silver cards in play, choose one color they all count as.</li>
      <li><b>Winning:</b> With 2 goal colors, having more cards of <b>both</b> colors wins outright. With 1 goal color, whoever has more of it gets +15. Then the higher score wins. Equal scores = tie.</li>
      <li><b>Combos</b> are on the Combos tab. <b>Auctions</b> are on the Auctions tab.</li>
      <li>Every phase has a ${PHASE_SECONDS}-second countdown. If it hits zero, the game finishes the phase for you: empty slots get filled with the best cards from your hand, and you discard nothing.</li></ol>`}
      <div class="go-btns"><button class="btn go" id="btnClose">GOT IT!</button></div></div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('.usermenu')) closeUserMenu();
    if (!e.target.closest('.nav-drop')) {
      const playPop = $('#playPop');
      const morePop = $('#morePop');
      if (playPop) playPop.classList.add('hidden');
      if (morePop) morePop.classList.add('hidden');
    }
    const keepTip = e.target.closest('.pullslot, .stagecard, .thumb, #packTip, .panel.collection .ccard, .panel.mine .ccard, .feed-card');
    if (!packCanHover() && !keepTip) hidePackTip();
    if (!packCanHover()) {
      const feed = e.target.closest && e.target.closest('.feed-card');
      if (feed) showFeedTip(feed);
      const held = collectionCard(e.target);
      if (held) showCollectionTip(held);
    }
    const pop = $('#preview');
    const keep = e.target.closest('.preview-sheet, .handcard, .ccard, .card, .goalcard, .deckcard');
    if (pop && !pop.classList.contains('hidden') && !keep) { pop.classList.add('hidden'); pop.classList.remove('force'); }
    const t = e.target.closest('button, .handcard, .slot, .deckpick, .goalcard');
    if (!t) return;
    if (t.id === 'btnNavMenu') {
      const nav = $('#orbitNav');
      if (!nav) return;
      const open = nav.classList.toggle('is-open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (t.id === 'btnPlayMenu' || t.id === 'btnMore') {
      const pop = document.getElementById(t.id === 'btnPlayMenu' ? 'playPop' : 'morePop');
      const other = document.getElementById(t.id === 'btnPlayMenu' ? 'morePop' : 'playPop');
      if (other) other.classList.add('hidden');
      if (pop) {
        const open = pop.classList.toggle('hidden') === false;
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    if (t.id === 'btnLogoHome') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('signup');
      return showHome();
    }
    if (t.id === 'btnNavLogin') return showAuth('login');
    if (t.id === 'btnTrades') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('login');
      if (window.TOB_TRADES) return window.TOB_TRADES.show();
    }
    if (t.id === 'sidePromo') {
      if (window.TOB_PVP) return window.TOB_PVP.show();
    }
    if (t.id === 'btnShopPacks') { shopTab = 'packs'; return showPacks(); }
    if (t.id === 'btnShopCards') { shopTab = 'cards'; return showPacks(); }
    if (t.id === 'btnShopGallery') return showCollection();
    if (t.id === 'btnBuyOpenPack') return buyPack(true);
    if (t.id === 'btnReady') return finishPlay(false);
    if (t.id === 'btnDiscard') return finishDiscard();
    if (t.id === 'btnPreviewClose' || t.id === 'previewBackdrop') { $('#preview').classList.add('hidden'); return; }
    if (t.id === 'btnSwapYes') { G.swapMode = true; setMsg('Tap a card in your hand to put in your last slot (−10).'); setActions('<button class="btn" id="btnSwapNo">CANCEL – NO SWAP</button>'); render(); return; }
    if (t.id === 'btnSwapNo') return afterSwap(null);
    if (t.classList.contains('colorbtn')) return G && G.rankedId ? finishRankedSilver(t.dataset.color) : finishSilver(t.dataset.color, G.pendingSilver);
    if (t.id === 'btnAgain' || t.id === 'btnAgain2') return quickStart();
    if (t.id === 'btnRankedBack' || t.id === 'btnRankedBack2') {
      G = null;
      if (window.TOB_PVP) return window.TOB_PVP.show();
      return;
    }
    if (t.id === 'btnHome' || t.id === 'btnDeckHome') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('signup');
      if (routeHash() === 'settings' || routeHash() === 'profile') history.pushState(null, '', location.pathname + location.search);
      return showHome();
    }
    if (t.classList.contains('feed-card')) return;
    if (t.dataset.feedUser) return showProfile(t.dataset.feedUser);
    if (t.id === 'btnPlay' || t.id === 'btnPlayTab') return showDeckSelect();
    if (t.id === 'btnPvp') return window.TOB_PVP && window.TOB_PVP.show();
    if (t.id === 'btnPick' || t.id === 'btnNew') {
      if (!window.TOB_AUTH.currentUser()) return showAuth('signup');
      return showDeckSelect();
    }
    if (t.id === 'btnBoard') { $('#overlay').classList.add('hidden'); return; }
    if (t.id === 'btnBuild') return showBuilder('deck');
    if (t.id === 'btnDecks') return showBuilder('home');
    if (t.id === 'btnCollection') return showCollection();
    if (t.id === 'btnRules' || t.id === 'btnRules2' || t.id === 'btnRulesTab') return showRules('rules');
    if (t.id === 'btnCombosTab') return showRules('combos');
    if (t.id === 'btnAuctionsTab') return showRules('auctions');
    if (t.id === 'btnAuctions') return showAuctions();
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
    if (t.id === 'btnProfile' || t.id === 'btnProfileGreet' || t.id === 'btnUserProfile') {
      closeUserMenu();
      const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
      if (hash !== 'profile' && hash !== 'settings') history.pushState(null, '', '#profile');
      return showProfile();
    }
    if (t.id === 'btnHomeOut') { doLogOut(); return; }
    if (t.dataset.buytheme) return buyThemePack(t.dataset.buytheme);
    if (t.id === 'btnBuyPack') return buyPack();
    if (t.id === 'btnOpenPack' || t.id === 'btnOpenAnother') return openPack();
    if (t.id === 'btnDaily') return claimDaily();
    if (t.id === 'btnNextPull') return advancePull(+t.dataset.i);
    if (t.id === 'btnRevealAll') return revealAll();
    if (t.id === 'btnPackBuilder') return showBuilder('home');
    if (!packCanHover() && t.dataset.pull != null && (t.classList.contains('pullslot') || t.classList.contains('thumb'))) {
      showPackTip(t, currentPulls && currentPulls[+t.dataset.pull]);
      return;
    }
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
    if (window.TOB.battleLock || !G) return;
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
    if (window.TOB.battleLock) return;
    if (performance.now() - lastPlace < 500) return;
    const h = e.target.closest('.handcard');
    if (!h || !h.isConnected || !G || !G.phase.startsWith('PLAY')) return;
    const free = activeSlots().find(s => !G.boards.p[s]); if (free != null) placeCard(+h.dataset.idx, free);
  });
  let deckDrag = null;
  const cardDrags = [];
  let cardDrag = null;
  let swallowClick = false;
  function registerCardDrag(spec) {
    const at = cardDrags.findIndex(item => item.id === spec.id);
    if (at >= 0) cardDrags[at] = spec;
    else cardDrags.push(spec);
  }
  function dragSource(e) {
    if (e.button > 0) return null;
    for (const spec of cardDrags) {
      const el = e.target.closest && e.target.closest(spec.selector);
      if (!el || (spec.canStart && !spec.canStart(el, e))) continue;
      if (e.pointerType === 'mouse' && spec.nativeDrag) return null;
      return {el, spec};
    }
    return null;
  }
  function dragTargets(spec, source) {
    const selector = typeof spec.targets === 'function' ? spec.targets(source) : spec.targets;
    return [...document.querySelectorAll(selector)].filter(node => !spec.accept || spec.accept(source, node));
  }
  function clearDragMarks() {
    document.querySelectorAll('.drop-ready, .drop-hot').forEach(node => node.classList.remove('drop-ready', 'drop-hot'));
  }
  function endCardDrag(e, commit) {
    if (!cardDrag || e.pointerId !== cardDrag.pointerId) return;
    const current = cardDrag;
    cardDrag = null;
    clearDragMarks();
    current.source.classList.remove('dragging');
    if (current.ghost) current.ghost.remove();
    if (!current.dragging) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (!commit) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const target = dragTargets(current.spec, current.source).find(node => hit && (node === hit || node.contains(hit)));
    if (target) current.spec.drop(current.source, target);
  }
  document.addEventListener('pointerdown', e => {
    const found = dragSource(e);
    if (!found) return;
    cardDrag = {pointerId: e.pointerId, x: e.clientX, y: e.clientY, source: found.el, spec: found.spec, dragging: false, ghost: null};
  });
  document.addEventListener('pointermove', e => {
    if (!cardDrag || e.pointerId !== cardDrag.pointerId) return;
    const dx = e.clientX - cardDrag.x;
    const dy = e.clientY - cardDrag.y;
    if (!cardDrag.dragging) {
      if (Math.hypot(dx, dy) < 10) return;
      cardDrag.dragging = true;
      cardDrag.source.classList.add('dragging');
      if (cardDrag.source.setPointerCapture) cardDrag.source.setPointerCapture(e.pointerId);
      const face = cardDrag.source.querySelector('.card');
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = face ? face.outerHTML : cardDrag.source.innerHTML;
      document.body.appendChild(ghost);
      cardDrag.ghost = ghost;
      dragTargets(cardDrag.spec, cardDrag.source).forEach(node => node.classList.add('drop-ready'));
    }
    e.preventDefault();
    cardDrag.ghost.style.left = e.clientX + 'px';
    cardDrag.ghost.style.top = e.clientY + 'px';
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    document.querySelectorAll('.drop-hot').forEach(node => node.classList.remove('drop-hot'));
    const hot = dragTargets(cardDrag.spec, cardDrag.source).find(node => hit && (node === hit || node.contains(hit)));
    if (hot) hot.classList.add('drop-hot');
  }, {passive: false});
  document.addEventListener('pointerup', e => endCardDrag(e, true));
  document.addEventListener('pointercancel', e => endCardDrag(e, false));
  document.addEventListener('click', e => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  registerCardDrag({
    id: 'play',
    selector: '.handcard',
    nativeDrag: true,
    canStart(el) { return !!(G && G.phase.startsWith('PLAY') && el.dataset.idx != null); },
    targets: '.slot.open',
    drop(source, target) { placeCard(+source.dataset.idx, +target.dataset.slot); },
  });
  registerCardDrag({
    id: 'deck-add',
    selector: '.db-item',
    canStart(el, e) { return !!(deckDrag && el.dataset.cid && !e.target.closest('.db-remove, .yd-gold')); },
    targets: '#dbDeck, #btnOpenDeck',
    drop(source) { deckDrag.add(source.dataset.cid); },
  });
  registerCardDrag({
    id: 'deck-row',
    selector: '.yd-row',
    canStart(el, e) { return !!(deckDrag && el.dataset.cid && !e.target.closest('.db-remove, .yd-gold, [data-goldpick]')); },
    targets: '.yd-row, #dbRows',
    accept(source, target) { return target !== source; },
    drop(source, target) {
      const row = target.closest('.yd-row');
      if (row && row.dataset.cid) deckDrag.move(source.dataset.cid, row.dataset.cid);
      else deckDrag.remove(source.dataset.cid);
    },
  });
  window.TOB_DRAG = {register: registerCardDrag};
  document.addEventListener('dragstart', e => { const h = e.target.closest('.handcard'); if (h) e.dataTransfer.setData('text/plain', h.dataset.idx); });
  document.addEventListener('dragover', e => { const s = e.target.closest('.slot.open'); if (s) { e.preventDefault(); s.classList.add('hover'); } });
  document.addEventListener('dragleave', e => { const s = e.target.closest('.slot'); if (s) s.classList.remove('hover'); });
  document.addEventListener('drop', e => { if (window.TOB.battleLock) return; const s = e.target.closest('.slot.open'); if (!s) return; e.preventDefault(); placeCard(+e.dataTransfer.getData('text/plain'), +s.dataset.slot); });
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
  function tierFromRating(rating) {
    const n = rating | 0;
    if (n >= 1700) return 'Champion';
    if (n >= 1550) return 'Diamond';
    if (n >= 1400) return 'Platinum';
    if (n >= 1250) return 'Gold';
    if (n >= 1100) return 'Silver';
    return 'Bronze';
  }
  function paintSideProfile() {
    const box = document.getElementById('sideProfile');
    if (!box) return;
    const user = window.TOB_AUTH && window.TOB_AUTH.currentUser && window.TOB_AUTH.currentUser();
    const profile = siteProfile;
    if (!user) {
      box.innerHTML = '<div class="side-letter side-ava">?</div><div class="side-name">Hello</div><p class="side-note">Log in to track cards, coins, and trades.</p>';
      return;
    }
    const name = user.username || 'Player';
    const owned = (profile && profile.collection) || [];
    const unique = new Set(owned.map(rec => rec && rec.id).filter(Boolean)).size;
    const avatarId = profile && profile.avatar && isPublicCard(profile.avatar) ? profile.avatar : '';
    const face = avatarId
      ? `<img class="side-ava" src="assets/cards/${encodeURIComponent(avatarId)}.webp" alt="">`
      : `<div class="side-letter side-ava">${escPack(name.slice(0, 1).toUpperCase())}</div>`;
    const tier = profile && profile.rating != null ? tierFromRating(profile.rating) : '';
    const daily = profile ? dailyClockText() : '';
    box.innerHTML = `${face}<div class="side-name">${escPack(name)}</div>
      <div class="side-stat"><span>Points</span><b>${profile ? (profile.coins | 0) : 0}</b></div>
      <div class="side-stat"><span>Unique cards</span><b>${unique}</b></div>
      <div class="side-stat"><span>Total cards</span><b>${owned.length}</b></div>
      ${daily ? `<div class="side-stat"><span>Daily reset</span><b id="sideDaily">${escPack(daily)}</b></div>` : ''}
      ${tier ? `<div class="side-stat"><span>Rank</span><b class="tier tier-${tier.toLowerCase()}">${escPack(tier)}</b></div>` : ''}`;
  }
  function paintSidePanel(page) {
    const panel = document.getElementById('sitePanel');
    if (!panel) return;
    const copy = {
      home: ['Today', 'Live auctions and public matches sit on the board. The daily pack resets at midnight.'],
      shop: ['Shop', 'Buy keeps a standard pack unopened. Buy & Open tears it now. Themed packs open immediately.'],
      trades: ['Trades', 'Offer your cards and coins, and ask for theirs. Accept checks both collections again.'],
      pvp: ['Ranked', 'Queue matches change your rating. Friend rooms and private challenges do not.'],
      decks: ['Decks', 'Twelve cards. Drag or tap to build, then take the deck into Solo or Ranked.'],
      gallery: ['Gallery', 'Every public toon. Tap a card for its power, color, and combos.'],
      collection: ['Binder', 'Gold copies are cosmetic. They score the same as the standard print.'],
      profile: ['Profile', 'Pin a showcase, answer friend requests, and check your record.'],
      play: ['In a match', 'Drag a card onto a glowing slot, or tap the card and then tap the slot.'],
      auth: ['Welcome', 'Make an account to keep your toons, or play a guest match on this device.'],
    };
    const pair = copy[page] || copy.home;
    panel.innerHTML = `<div class="side-h">${pair[0]}</div><p class="side-note">${pair[1]}</p>`;
  }
  function paintAuctionSide() {
    const panel = document.getElementById('sitePanel');
    if (!panel) return;
    const arches = [...new Set(CARD_LIST.map(c => c.archetype).filter(Boolean))].sort();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const rarities = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    panel.innerHTML = `<div class="side-h">Filters</div>
      <label class="field">Search<input id="aucQ" value="${esc(aucQ)}" placeholder="Card name" aria-label="Search auctions"></label>
      <div class="chip-row">${rarities.map(name => `<button type="button" class="btn chip${aucRarity === name ? ' go' : ''}" data-aucrare="${name}">${name}</button>`).join('')}</div>
      <label class="field">Series<select id="aucArch" aria-label="Series"><option value="">All series</option>${arches.map(a => `<option value="${esc(a)}"${aucArch === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="field">Finish<select id="aucGold" aria-label="Finish"><option value="">Any</option><option value="gold"${aucGold === 'gold' ? ' selected' : ''}>Gold</option><option value="standard"${aucGold === 'standard' ? ' selected' : ''}>Standard</option></select></label>
      <label class="field">Min<input id="aucMin" type="number" min="0" value="${esc(aucMin)}" aria-label="Minimum price"></label>
      <label class="field">Max<input id="aucMax" type="number" min="0" value="${esc(aucMax)}" aria-label="Maximum price"></label>
      <label class="field">Sort by<select id="aucSort" aria-label="Sort"><option value="ending"${aucSort === 'ending' ? ' selected' : ''}>Ending Soon</option><option value="high"${aucSort === 'high' ? ' selected' : ''}>Highest price</option><option value="low"${aucSort === 'low' ? ' selected' : ''}>Lowest price</option></select></label>
      <div class="chip-row">
        <button type="button" class="btn chip${aucFeatured ? ' go' : ''}" id="aucFeatured">Featured</button>
        <button type="button" class="btn chip${aucHasBids ? ' go' : ''}" id="aucHasBids">Has Bids</button>
        <button type="button" class="btn chip${aucWishOnly ? ' go' : ''}" id="aucWishOnly">Wishlist</button>
      </div>
      <div class="seg">${[['all','All'],['owned','Owned'],['unowned','Unowned']].map(([id, label]) => `<button type="button" class="btn chip${aucOwn === id ? ' go' : ''}" data-aucown="${id}">${label}</button>`).join('')}</div>`;
    const apply = () => {
      aucQ = ($('#aucQ') && $('#aucQ').value) || '';
      aucArch = $('#aucArch') ? $('#aucArch').value : '';
      aucGold = $('#aucGold') ? $('#aucGold').value : '';
      aucSort = $('#aucSort') ? $('#aucSort').value : 'ending';
      aucMin = $('#aucMin') ? $('#aucMin').value : '';
      aucMax = $('#aucMax') ? $('#aucMax').value : '';
      aucPage = 1;
      showAuctions();
    };
    ['aucQ', 'aucArch', 'aucGold', 'aucSort', 'aucMin', 'aucMax'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.onchange = apply;
    });
    panel.querySelectorAll('[data-aucrare]').forEach(btn => { btn.onclick = () => { aucRarity = aucRarity === btn.dataset.aucrare ? '' : btn.dataset.aucrare; aucPage = 1; showAuctions(); }; });
    panel.querySelectorAll('[data-aucown]').forEach(btn => { btn.onclick = () => { aucOwn = btn.dataset.aucown; aucPage = 1; showAuctions(); }; });
    const featBtn = $('#aucFeatured'); if (featBtn) featBtn.onclick = () => { aucFeatured = !aucFeatured; aucPage = 1; showAuctions(); };
    const bidBtn = $('#aucHasBids'); if (bidBtn) bidBtn.onclick = () => { aucHasBids = !aucHasBids; aucPage = 1; showAuctions(); };
    const wishBtn = $('#aucWishOnly'); if (wishBtn) wishBtn.onclick = () => { aucWishOnly = !aucWishOnly; aucPage = 1; showAuctions(); };
  }
  function orbitPage() {
    if (document.getElementById('auctionScreen')) return 'auctions';
    if (document.getElementById('packScreen')) return 'shop';
    if (document.getElementById('tradeScreen')) return 'trades';
    if (document.getElementById('pvpScreen')) return 'pvp';
    if (document.getElementById('deckBuilder')) return 'decks';
    if (document.getElementById('homeScreen')) return 'home';
    if (document.getElementById('profileScreen')) return 'profile';
    if (document.querySelector('#overlay .panel.collection')) return 'gallery';
    if (document.querySelector('#overlay .panel.mine')) return 'collection';
    if (document.querySelector('#overlay .panel.auth')) return 'auth';
    const ov = document.getElementById('overlay');
    if (ov && ov.classList.contains('hidden')) return 'play';
    return 'home';
  }
  function paintOrbit() {
    const ov = document.getElementById('overlay');
    if (ov && !ov.classList.contains('hidden')) window.TOB.battleLock = null;
    paintSideProfile();
    const page = orbitPage();
    const active = {home:'btnHome', shop:'btnPacks', auctions:'btnAuctions', trades:'btnTrades', pvp:'btnPlayMenu', decks:'btnDecks', gallery:'btnCollection', collection:'btnMyCollection', profile:'btnProfile', play:'btnPlayMenu', auth:'btnNavLogin'}[page];
    document.querySelectorAll('#orbitNav .navpill').forEach(btn => btn.classList.toggle('on', btn.id === active));
    if (page === 'auctions') paintAuctionSide();
    else paintSidePanel(page);
    if (window.TOB_TRADES && window.TOB_TRADES.paintBadge) window.TOB_TRADES.paintBadge();
  }
  let bannerStep = 0;
  setInterval(() => {
    const slides = document.querySelectorAll('.banner-slide');
    if (slides.length < 2) return;
    slides.forEach(slide => slide.classList.remove('on'));
    bannerStep = (bannerStep + 1) % slides.length;
    slides[bannerStep].classList.add('on');
    const daily = document.getElementById('sideDaily');
    if (daily) daily.textContent = dailyClockText();
  }, 4000);
  inspect(null);
  const overlayNode = document.getElementById('overlay');
  if (overlayNode && window.MutationObserver) {
    const orbitWatch = new MutationObserver(() => paintOrbit());
    orbitWatch.observe(overlayNode, {childList: true, attributes: true, attributeFilter: ['class']});
  }
  boot();

  function applyRemoteEconomy() {
    const map = window.TOB_ECONOMY_REMOTE;
    if (!map) return;
    ECONOMY.winCoins = map.win_coins != null ? map.win_coins : ECONOMY.winCoins;
    ECONOMY.lossCoins = map.loss_coins != null ? map.loss_coins : ECONOMY.lossCoins;
    ECONOMY.packPrice = map.pack_price != null ? map.pack_price : ECONOMY.packPrice;
    ECONOMY.themePrice = map.theme_price != null ? map.theme_price : ECONOMY.themePrice;
    ECONOMY.themeWeekPrice = map.theme_week_price != null ? map.theme_week_price : ECONOMY.themeWeekPrice;
    ECONOMY.auctionFee = map.auction_fee != null ? map.auction_fee : ECONOMY.auctionFee;
  }
  window.addEventListener('tob-auctions', () => {
    if (document.getElementById('auctionScreen')) showAuctions();
  });
  function routeHash() {
    return (location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0].toLowerCase();
  }
  function openHashedPage() {
    const key = routeHash();
    if (key !== 'settings' && key !== 'profile') return false;
    if (!window.TOB_AUTH.currentUser()) { showAuth('login'); return true; }
    if (!document.getElementById('profileScreen')) showProfile();
    return true;
  }
  async function boot() {
    try { await window.TOB_AUTH.ready; }
    catch (e) { /* the sign-in screen surfaces initError */ }
    applyRemoteEconomy();
    renderUser();
    if (AUTO) {
      if (!window.TOB_AUTH.currentUser()) await window.TOB_AUTH.playAsGuest();
      renderUser();
      await liveProfile();
      quickStart(qs.get('deck') || null);
    } else if (openHashedPage()) {
      if (window.TOB_AUTH.currentUser()) await liveProfile();
    } else if (window.TOB_AUTH.currentUser()) {
      await liveProfile();
      showHome();
    } else showAuth('signup');
  }
  window.addEventListener('hashchange', () => { openHashedPage(); });

  function demoCombo() {
    const deck = ['redbeard', 'polly', 'zoomer', 'hank', 'nell', 'fritz', 'pip', 'daisy', 'ember', 'glimmer', 'bleep', 'boltz'];
    const opp = ['bonesy', 'gloop', 'wisp', 'manor', 'fangly', 'bertha', 'timid', 'pumpkin', 'mayor', 'mel', 'blaze', 'dj'];
    startGame(deck, opp, 'Baron Boo');
    G.phase = 'REVEAL';
    G.round = 1;
    G.boards.p = [CARDS.redbeard, CARDS.polly, CARDS.zoomer, CARDS.hank, null, null, null];
    G.boards.o = [CARDS.gloop, CARDS.wisp, null, null, null, null, null];
    G.shown = {p: [true, true, true, true, false, false, false], o: [true, true, false, false, false, false, false]};
    G.pHand = [];
    G.goals = ['black', 'black'];
    G.targets = [];
    G.seenCombos = new Set();
    setMsg('Cards flip. Crews call out when they connect.');
    render();
    announceCombos();
  }
  let homeLiveChannel = null;
  let friendChannel = null;
  function watchHomeLive() {
    const db = window.TOB_AUTH && window.TOB_AUTH.client && window.TOB_AUTH.client();
    if (!db || homeLiveChannel) return;
    const poke = () => { if (document.getElementById('homeScreen')) refreshLivePanel(); };
    homeLiveChannel = db.channel('home-live')
      .on('postgres_changes', {event: '*', schema: 'public', table: 'auctions'}, poke)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'bids'}, poke)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'match_public'}, poke)
      .subscribe();
  }
  function watchFriendRequests() {
    const db = window.TOB_AUTH && window.TOB_AUTH.client && window.TOB_AUTH.client();
    const user = window.TOB_AUTH.currentUser();
    if (!db || !user || user.guest || friendChannel) return;
    friendChannel = db.channel('friend-requests')
      .on('postgres_changes', {event: '*', schema: 'public', table: 'friend_requests'}, () => {
        refreshFriendBadge();
        if (document.getElementById('profileScreen')) showProfile();
      })
      .subscribe();
  }
  async function previewHomeLive() {
    if (!window.TOB_AUTH.currentUser()) await window.TOB_AUTH.playAsGuest();
    const lot = (id, name, gold, bid, start, mins) => ({
      id: 'lot-' + id, status: 'open', ends: Date.now() + mins * 60000,
      bidder: bid ? 'Nova' : '', bid: bid || 0, start,
      card: {id, name, gold, uid: id + (gold ? ':g:0' : ':s:0')},
    });
    livePreview = {
      lots: [
        lot('zoomer', 'Captain Zoomer', true, 180, 100, 4),
        lot('nell', 'Nova Nell', false, 0, 50, 18),
        lot('bleep', 'Bleep-O', false, 40, 20, 40),
        lot('daisy', 'Daisy Dynamo', true, 90, 60, 75),
        lot('ob_onyxion', 'Onyxion', false, 10, 10, 5),
      ],
      games: [
        {id: 'm1', host_name: 'Nova', guest_name: 'Pip', host_avatar: 'nell', guest_avatar: 'zoomer', phase: 'place1', host_board: [{id: 'nell'}, {id: 'bleep'}, null, null, null, null, null], guest_board: [{id: 'zoomer'}, null, null, null, null, null, null]},
        {id: 'm2', host_name: 'Hank', guest_name: 'Daisy', host_avatar: 'daisy', guest_avatar: 'cometkid', phase: 'place2', host_board: [{id: 'daisy'}, {id: 'nell'}, {id: 'bleep'}, {id: 'zoomer'}, null, null, null], guest_board: [{id: 'cometkid'}, {id: 'lunara'}, {id: 'nell'}, {id: 'daisy'}, {id: 'bleep'}, null, null]},
        {id: 'm3', host_name: 'Comet', guest_name: 'Lunara', host_avatar: 'cometkid', guest_avatar: 'lunara', phase: 'score', host_score: 18, guest_score: 12},
      ],
    };
    showHome();
  }
  window.TOB_UI = {card: cardHTML};
  window.TOB_GAME = {demoCombo, showRules, showHome, showAuth, openAuction, liveNowMarkup, previewHomeLive, playRankedBot};
})();
