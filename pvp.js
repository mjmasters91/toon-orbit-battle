/* Live PvP. The server checks decks, turns, and payouts. Both clients
   score the shared board with the same engine. Guests cannot queue. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s);
  let mode = 'off';
  let channel = null;
  let poll = null;
  let activeId = null;
  let seat = 'host';
  let searching = false;
  let searchStarted = 0;
  let botTried = false;
  let queuePoll = null;
  let queueChannel = null;
  let clockTimer = null;
  const BOT_WAIT = 18000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function ui() { return root.TOB_UI || {}; }
  function rpc(name, args) {
    return root.TOB_AUTH && root.TOB_AUTH.rpc ? root.TOB_AUTH.rpc(name, args) : Promise.resolve({ok: false, error: 'Sign in to play friends.'});
  }
  function client() {
    return root.TOB_AUTH && root.TOB_AUTH.client ? root.TOB_AUTH.client() : null;
  }
  function me() {
    return root.TOB_AUTH && root.TOB_AUTH.currentUser ? root.TOB_AUTH.currentUser() : null;
  }
  async function probe() {
    const user = me();
    if (!user || user.guest || !root.TOB_AUTH || root.TOB_AUTH.mode !== 'supabase') return 'guest';
    const db = client();
    if (!db) {
      console.error('PvP probe: Supabase client is missing, so PvP stays off.');
      return 'soon';
    }
    const {error} = await db.from('matches').select('id').limit(1);
    if (!error) return 'on';
    console.error('PvP probe: matches select failed', error.code || '', error.message || error);
    return 'soon';
  }
  function deckFromProfile(profile) {
    const raw = [];
    const allowOb = !!(profile && profile.role === 'admin');
    try {
      const saved = JSON.parse(localStorage.getItem('tob_custom') || '[]');
      if (Array.isArray(saved)) raw.push(...saved);
    } catch (e) { /* ignore */ }
    const owned = {};
    ((profile && profile.collection) || []).forEach(rec => {
      if (!rec || (!allowOb && String(rec.id).indexOf('ob_') === 0)) return;
      const key = rec.id + (rec.gold ? ':g' : ':s');
      owned[key] = (owned[key] || 0) + 1;
    });
    const take = (id, gold) => {
      const key = id + (gold ? ':g' : ':s');
      if (!owned[key]) return null;
      owned[key] -= 1;
      return {id, gold: !!gold};
    };
    const out = [];
    raw.forEach(entry => {
      if (out.length >= 12) return;
      const id = typeof entry === 'string' ? entry : entry && entry.id;
      const gold = !!(entry && entry.gold);
      if (!id || (!allowOb && String(id).indexOf('ob_') === 0)) return;
      const card = take(id, gold) || take(id, !gold);
      if (card) out.push(card);
    });
    if (out.length < 12) {
      Object.keys(owned).forEach(key => {
        while (out.length < 12 && owned[key] > 0) {
          owned[key] -= 1;
          const gold = key.slice(-2) === ':g';
          out.push({id: key.slice(0, -2), gold});
        }
      });
    }
    return out;
  }
  async function myDeck() {
    const profile = await root.TOB_AUTH.loadProfile();
    if (!profile) return {ok: false, error: 'Could not load your account.'};
    const deck = deckFromProfile(profile);
    if (!deck || deck.length !== 12) {
      const n = deck ? deck.length : 0;
      const admin = profile.role === 'admin';
      const error = admin
        ? 'Your deck has ' + n + ' of 12 cards. Add cards you own. Obsidian cards count for admins.'
        : 'Your deck has ' + n + ' of 12 cards. Build one without Obsidian cards.';
      return {ok: false, error};
    }
    return {ok: true, deck, profile};
  }
  function toast(msg, bad) {
    const node = document.getElementById('toast');
    if (node && msg) {
      node.textContent = msg;
      node.classList.remove('hidden');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => node.classList.add('hidden'), 3200);
    }
    const line = document.getElementById('pvpStatus');
    if (line && msg) {
      line.textContent = msg;
      line.classList.toggle('bad', !!bad);
    }
    if (bad) console.error('PvP', msg);
  }
  function shell(inner) {
    if (root.TOB) root.TOB.battleLock = null;
    stopClock();
    const oppLabel = document.querySelector('.side.opp .sidelabel');
    const meLabel = document.querySelector('.side.me .sidelabel');
    if (oppLabel) oppLabel.textContent = 'Opponent';
    if (meLabel) meLabel.textContent = 'You';
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `<div id="pvpScreen">${inner}</div>`;
  }
  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  }
  function openBattle(kind) {
    const ov = document.getElementById('overlay');
    if (ov) {
      ov.classList.add('hidden');
      ov.innerHTML = '';
    }
    if (root.TOB) root.TOB.battleLock = kind || 'pvp';
  }
  function startBattleClock(deadline) {
    stopClock();
    const total = (root.TOB && root.TOB.phaseSeconds) || 90;
    const text = (left) => (root.TOB && root.TOB.clockText) ? root.TOB.clockText(left) : String(left);
    const tick = () => {
      const node = document.getElementById('timer');
      if (!node) return;
      if (!deadline) {
        node.textContent = '';
        node.className = '';
        node.style.removeProperty('--p');
        node.removeAttribute('aria-label');
        return;
      }
      const left = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
      node.textContent = text(left);
      node.style.setProperty('--p', String(left / total));
      node.className = (left >= 60 ? 'wide' : '') + (left <= 10 ? ' warn' : '');
      node.setAttribute('aria-label', left + ' seconds left');
    };
    tick();
    clockTimer = setInterval(tick, 250);
  }
  function cardFace(entry) {
    const drawCard = ui().card;
    if (!entry || !drawCard) return '';
    const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
    const def = cards && cards[entry.id];
    if (!def) return '';
    const copy = Object.assign({}, def, {gold: !!entry.gold});
    return drawCard(copy, null, true);
  }
  function paintHub(extra) {
    const user = me();
    if (!user || user.guest) {
      shell(`<header class="pvp-top"><div class="pvp-title">PVP</div><button type="button" class="btn" id="pvpHome">Home</button></header>
        <div class="pvp-layout">
          <div class="pvp-main">
            <section class="pvp-card"><h2>Sign in to play friends</h2><p>Guest matches stay on this device. An online account can challenge friends, share a room code, or join the queue.</p>
            <button type="button" class="btn go" id="pvpSign">Sign in</button></section>
          </div>
          ${boardShell()}
        </div>`);
      return;
    }
    if (mode !== 'on') {
      shell(`<header class="pvp-top"><div class="pvp-title">PVP</div><button type="button" class="btn" id="pvpHome">Home</button></header>
        <section class="pvp-card"><h2>PvP coming soon</h2><p>Live matches turn on after the matches table is ready. Your other games still work.</p></section>`);
      return;
    }
    shell(`<header class="pvp-top"><div class="pvp-title">PVP</div><button type="button" class="btn" id="pvpHome">Home</button></header>
      <p class="pvp-status" id="pvpStatus" role="status">${esc(extra || '')}</p>
      <section class="pvp-card pvp-rank" id="pvpRank"></section>
      <div class="pvp-layout">
        <div class="pvp-main">
          <div class="pvp-plays">
            <section class="pvp-card pvp-play"><h2>Play a friend</h2><p>Share a room code or open the link. Rooms expire in 10 minutes.</p>
              <label class="pvp-private"><input type="checkbox" id="pvpPrivate"> Private match</label>
              <button type="button" class="btn go" id="pvpRoom">Create room</button>
              <form class="pvp-join" id="pvpJoin"><input id="pvpCode" maxlength="5" placeholder="Room code" aria-label="Room code"><button class="btn" type="submit">Join</button></form>
            </section>
            <section class="pvp-card pvp-play"><h2>Quick match</h2><p>Ranked. If nobody joins, a bot of your tier steps in.</p>
              <button type="button" class="btn go" id="pvpQueue">Join queue</button>
            </section>
          </div>
          <div id="pvpExtra"></div>
        </div>
        ${boardShell()}
      </div>`);
    if (extra) { const line = document.getElementById('pvpStatus'); if (line) line.classList.add('bad'); }
  }
  function showHub(note) {
    stopWatch();
    paintHub(note);
    bindHub();
    loadStandings();
  }
  function boardShell() {
    return `<aside class="pvp-side"><section class="pvp-card"><h2>Standings</h2><div id="pvpStandings"><p class="pvp-note">Loading standings…</p></div></section></aside>`;
  }
  function tierMark(tier, division) {
    const name = tier || 'Bronze';
    const slug = name.toLowerCase();
    return `<span class="tier tier-${slug}">${esc(name + (division ? ' ' + division : ''))}</span>`;
  }
  function safePublicAvatar(id) {
    if (!id || String(id).indexOf('ob_') === 0) return 'zoomer';
    return id;
  }
  async function loadStandings() {
    const box = document.getElementById('pvpStandings');
    const rank = document.getElementById('pvpRank');
    if (!box) return;
    let res;
    try { res = await rpc('pvp_standings'); }
    catch (err) {
      console.error('PvP standings', err);
      res = {ok: false, error: err && err.message};
    }
    if (!res || !res.ok) {
      box.innerHTML = '<p class="pvp-note">Standings coming soon.</p>';
      if (rank) rank.innerHTML = '';
      return;
    }
    const data = rpcBody(res);
    const meRank = data.me;
    const board = Array.isArray(data.board) ? data.board : [];
    if (rank) {
      if (!meRank) rank.innerHTML = '';
      else {
        const next = meRank.next == null ? 'Top tier' : 'Next tier at ' + meRank.next;
        const pct = Math.max(0, Math.min(100, Math.round(Number(meRank.progress || 0) * 100)));
        rank.innerHTML = `<h2>My rank</h2>
          <div class="rank-card">
            ${tierMark(meRank.tier, meRank.division)}
            <b>#${meRank.rank}</b>
            <span class="stand-rating">${meRank.rating}</span>
            <span class="stand-wl">${meRank.wins}-${meRank.losses}</span>
          </div>
          <div class="rank-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <p class="pvp-note">${esc(next)}</p>`;
      }
    }
    box.innerHTML = board.length ? board.map(row => `<div class="stand-row${meRank && row.rank === meRank.rank ? ' mine' : ''}">
      <b>${row.rank}</b>
      <img src="assets/cards/${encodeURIComponent(safePublicAvatar(row.avatar))}.webp" alt="">
      <span class="stand-name">${esc(row.username)}</span>
      ${tierMark(row.tier, row.division)}
      <span class="stand-rating">${row.rating}</span>
      <span class="stand-wl">${row.wins}-${row.losses}</span>
    </div>`).join('') : '<p class="pvp-note">No ranked games yet.</p>';
  }
  function paintLobby(match) {
    const code = match.code || '';
    const link = 'https://mjmasters91.github.io/toon-orbit-battle/?room=' + encodeURIComponent(code);
    shell(`<header class="pvp-top"><div class="pvp-title">WAITING</div><button type="button" class="btn" id="pvpCancel">Cancel</button></header>
      <section class="pvp-card pvp-lobby">
        <p class="pvp-kicker">Room</p>
        <div class="pvp-code">${esc(code || 'FRIEND')}</div>
        <p>Send this link. The room expires in about 10 minutes.</p>
        <p class="pvp-link">${esc(link)}</p>
        <p id="pvpWait">${match.guest ? 'Starting…' : 'Waiting for an opponent…'}</p>
      </section>`);
    const cancel = $('#pvpCancel');
    if (cancel) cancel.onclick = async () => { await rpc('cancel_lobby', {p_match: match.id}); showHub(); };
  }
  function scoreOf(state) {
    const cards = root.TOB_CARDS.CARDS;
    const E = root.TOB_ENGINE;
    const asCard = (entry) => {
      if (!entry || !entry.id || !cards[entry.id]) return null;
      return Object.assign({}, cards[entry.id], {gold: !!entry.gold});
    };
    const board = (seat) => (state[seat].board || []).map(asCard);
    const boards = {p: board('host'), o: board('guest')};
    const shown = {p: boards.p.map(Boolean), o: boards.o.map(Boolean)};
    const goalColor = (entry) => (entry && (entry.color || (cards[entry.id] && cards[entry.id].color))) || null;
    const goals = [goalColor(state.host.goal), goalColor(state.guest.goal)];
    const silver = {p: state.host.silver || null, o: state.guest.silver || null};
    return E.evaluate(boards, shown, {goals, silver, penalty: {p: 0, o: 0}, final: state.phase === 'score'});
  }
  function goalLine(colors) {
    const list = (colors || []).filter(Boolean);
    const palette = root.TOB_CARDS.COLORS;
    const bonus = root.TOB_ENGINE.COLOR_BONUS;
    const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
    if (!list.length) return 'No goal color — points only.';
    const bits = list.map(c => `<span class="gem" style="background:${palette[c] || '#fff'}"></span>${cap(c)}`).join(' &amp; ');
    if (list.length === 1) return `Goal color: ${bits} (most cards = +${bonus})`;
    return `Goal colors: ${bits} (more of BOTH wins!)`;
  }
  function scorePanel(leftName, rightName, leftScore, rightScore, goalTxt, ev, mineSeat) {
    let rows = '';
    if (ev && ev.targets && ev.targets.length && mineSeat) {
      const colors = root.TOB_CARDS.COLORS;
      const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
      rows = `<table class="sb-colors"><tr><th>Color</th><th>You</th><th>Opp</th></tr>` + ev.targets.map(c => {
        const mine = mineSeat === 'host' ? ((ev.counts.p && ev.counts.p[c]) || 0) : ((ev.counts.o && ev.counts.o[c]) || 0);
        const them = mineSeat === 'host' ? ((ev.counts.o && ev.counts.o[c]) || 0) : ((ev.counts.p && ev.counts.p[c]) || 0);
        return `<tr><td><span class="gem" style="background:${colors[c]}"></span>${cap(c)}</td><td>${mine}</td><td>${them}</td></tr>`;
      }).join('') + '</table>';
    }
    return `<div class="sb-title">Score</div>
      <div class="sb-goal">${goalTxt}</div>
      <div class="sb-scores">
        <div class="sb-side me"><div class="sb-name">${esc(leftName)}</div><div class="sb-num">${leftScore}</div></div>
        <div class="sb-vs">VS</div>
        <div class="sb-side opp"><div class="sb-name">${esc(rightName)}</div><div class="sb-num">${rightScore}</div></div>
      </div>${rows}`;
  }
  function paintBoard(opts) {
    openBattle(opts.spectate ? 'spectate' : 'pvp');
    const phase = opts.phase;
    const hideBack = phase === 'place1' || phase === 'discard';
    const active = phase === 'place1' ? [0, 1, 2, 3] : phase === 'place2' ? [4, 5, 6] : [];
    const slot = (card, i, who) => {
      const locked = hideBack && i >= 4;
      const open = !opts.spectate && opts.myTurn && !card && active.indexOf(i) >= 0;
      const face = card ? cardFace(card) : `<div class="slotnum">${i + 1}</div>`;
      return `<div class="slot${open ? ' open' : ''}${locked ? ' locked' : ''}" data-pvp="1" data-slot="${i}" data-who="${who}">${face}</div>`;
    };
    const row = (board, who, idx) => idx.map(i => slot((board || [])[i], i, who)).join('');
    document.getElementById('o-outer').innerHTML = row(opts.topBoard, opts.topWho, [4, 5, 6]);
    document.getElementById('o-inner').innerHTML = row(opts.topBoard, opts.topWho, [0, 1, 2, 3]);
    document.getElementById('p-inner').innerHTML = row(opts.botBoard, opts.botWho, [0, 1, 2, 3]);
    document.getElementById('p-outer').innerHTML = row(opts.botBoard, opts.botWho, [4, 5, 6]);
    const oppLabel = document.querySelector('.side.opp .sidelabel');
    const meLabel = document.querySelector('.side.me .sidelabel');
    if (oppLabel) oppLabel.textContent = opts.topName;
    if (meLabel) meLabel.textContent = opts.botName;
    document.getElementById('o-hand').innerHTML = Array.from({length: opts.topHandCount || 0}, () => '<div class="minback"></div>').join('');
    const hand = document.getElementById('hand');
    hand.innerHTML = opts.spectate ? '' : (opts.botHand || []).map((card, i) => `<div class="handcard" data-hand="${i}">${cardFace(card)}</div>`).join('');
    document.getElementById('scoreboard').innerHTML = opts.scoreHtml;
    document.getElementById('phaseMsg').textContent = opts.message || '';
    document.getElementById('actions').innerHTML = opts.actions || '';
    startBattleClock(opts.deadline);
  }
  function stateHash(state, ev) {
    const pack = (seat) => (state[seat].board || []).map(c => c && c.id ? c.id + (c.gold ? 'g' : 's') : '-').join(',');
    const winner = !ev.result ? 'tie' : ev.result.winner === 'p' ? 'host' : ev.result.winner === 'o' ? 'guest' : 'tie';
    return [state.phase, pack('host'), pack('guest'), state.host.silver || '', state.guest.silver || '', ev.score.p, ev.score.o, winner].join('|');
  }
  function paintMatch(match) {
    const state = match.state || {};
    const mine = seat;
    const opp = seat === 'host' ? 'guest' : 'host';
    const bot = !!match.is_bot;
    const oppName = bot ? (match.bot_name || match.guest_name || 'Orbit Bot') : (opp === 'host' ? match.host_name : match.guest_name);
    const myTurn = state.turn === mine;
    let ev = null;
    try { ev = scoreOf(state); } catch (e) { ev = null; }
    const myScore = ev ? (seat === 'host' ? ev.score.p : ev.score.o) : 0;
    const theirScore = ev ? (seat === 'host' ? ev.score.o : ev.score.p) : 0;
    const note = bot && state.phase === 'score' ? ' The server scores this bot match.' : '';
    paintBoard({
      spectate: false,
      phase: state.phase,
      myTurn,
      topName: oppName || 'Opponent',
      botName: 'You',
      topWho: opp,
      botWho: mine,
      topBoard: (state[opp] && state[opp].board) || [],
      botBoard: (state[mine] && state[mine].board) || [],
      topHandCount: ((state[opp] && state[opp].hand) || []).length,
      botHand: (state[mine] && state[mine].hand) || [],
      scoreHtml: scorePanel('YOU', (oppName || 'Opp').toUpperCase(), myScore, theirScore, goalLine(ev && ev.targets), ev, seat),
      message: phaseLabel(state.phase) + note,
      deadline: match.turn_deadline,
    });
    wireMatch(match, ev);
    if (ev && ev.combos && ev.combos.length && state.phase === 'score') callout(ev.combos[0]);
  }
  function phaseLabel(phase) {
    if (phase === 'place1') return 'Place a card in the front row';
    if (phase === 'discard') return 'Discard up to 2, or keep your hand';
    if (phase === 'place2') return 'Place a card in the back row';
    if (phase === 'silver') return 'Choose a color for your silver cards';
    if (phase === 'score') return 'Match complete';
    return 'Waiting';
  }
  function callout(combo) {
    let el = document.getElementById('comboCall');
    if (!el) { el = document.createElement('div'); el.id = 'comboCall'; document.body.appendChild(el); }
    el.innerHTML = `<b>${esc(combo.name)}!</b> <span>+${combo.bonus}</span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  function wireMatch(match, ev) {
    const state = match.state || {};
    const actions = $('#actions');
    if (!actions) return;
    const resignMatch = async () => {
      if (match.id === 'preview') return;
      if (!window.confirm('Resign this match?')) return;
      await rpc('resign_match', {p_match: match.id});
      toast('You resigned.');
      stopWatch();
      paintHub();
    };
    if (state.phase === 'discard' && state.turn === seat) {
      actions.innerHTML = '<button type="button" class="btn go" id="pvpDiscard">Discard selected</button>';
      $('#pvpDiscard').onclick = async () => {
        const idx = [...document.querySelectorAll('.handcard[data-hand].sel')].map(node => +node.dataset.hand);
        await sendMove(match.id, {t: 'discard', idx});
      };
    } else if (state.phase === 'silver' && state.turn === seat) {
      const colors = root.TOB_ENGINE.PLAYABLE_COLORS;
      actions.innerHTML = colors.map(c => `<button type="button" class="btn" data-silver="${c}">${esc(c)}</button>`).join('') + '<button type="button" class="btn" data-silver="">Skip</button>';
    } else if (state.phase === 'score') {
      actions.innerHTML = '<button type="button" class="btn go" id="pvpFinish">Confirm result</button><button type="button" class="btn" id="pvpRematch">Rematch</button>';
      $('#pvpFinish').onclick = () => confirmResult(match, ev);
      $('#pvpRematch').onclick = () => rematch(match);
    }
    if (match.id !== 'preview') {
      actions.insertAdjacentHTML('beforeend', '<button type="button" class="btn" id="pvpResign">Resign</button>');
      const resignBtn = document.getElementById('pvpResign');
      if (resignBtn) resignBtn.onclick = resignMatch;
    }
    document.querySelectorAll('.handcard[data-hand]').forEach(btn => {
      btn.onclick = () => {
        if (state.phase !== 'discard') {
          document.querySelectorAll('.handcard[data-hand].sel').forEach(node => { if (node !== btn) node.classList.remove('sel'); });
        }
        btn.classList.toggle('sel');
      };
    });
    if (root.TOB_DRAG) {
      root.TOB_DRAG.register({
        id: 'pvp',
        selector: '.handcard[data-hand]',
        canStart() {
          const phase = (match.state || {}).phase;
          return state.turn === seat && (phase === 'place1' || phase === 'place2');
        },
        targets: '.slot[data-pvp]',
        accept(source, target) {
          if (target.dataset.who !== seat || target.querySelector('.card')) return false;
          const slot = +target.dataset.slot;
          const phase = (match.state || {}).phase;
          if (phase === 'place1') return slot >= 0 && slot <= 3;
          if (phase === 'place2') return slot >= 4 && slot <= 6;
          return false;
        },
        drop(source, target) {
          sendMove(match.id, {t: 'place', slot: +target.dataset.slot, hand: +source.dataset.hand});
        },
      });
    }
    document.querySelectorAll('.slot[data-pvp]').forEach(slot => {
      slot.onclick = async () => {
        if (slot.dataset.who !== seat || state.turn !== seat) return;
        const picked = document.querySelector('.handcard[data-hand].sel');
        if (!picked) { toast('Select a card in your hand.'); return; }
        await sendMove(match.id, {t: 'place', slot: +slot.dataset.slot, hand: +picked.dataset.hand});
      };
    });
    document.querySelectorAll('[data-silver]').forEach(btn => {
      btn.onclick = () => sendMove(match.id, {t: 'silver', color: btn.dataset.silver || null});
    });
    startBattleClock(match.turn_deadline);
  }
  async function sendMove(id, move) {
    const res = await rpc('submit_move', {p_match: id, p_move: move});
    if (!res.ok) { toast(res.error || 'Illegal move.', true); return; }
    const match = await loadMatch(id);
    if (!match) return;
    if (match.status === 'finished') {
      const delta = seat === 'host' ? match.host_delta : match.guest_delta;
      const change = delta == null ? '' : (delta > 0 ? ' +' : ' ') + delta + ' rating';
      toast((match.winner === (seat === 'host' ? match.host : match.guest) ? 'You won.' : match.result === 'tie' ? 'Tie.' : 'You lost.') + change);
      stopWatch();
      showHub();
      return;
    }
    paintMatch(match);
  }
  async function confirmResult(match, ev) {
    const winnerSide = !ev.result || !ev.result.winner ? 'tie' : ev.result.winner === 'p' ? 'host' : 'guest';
    const mine = winnerSide === 'tie' ? 'tie' : winnerSide === seat ? 'me' : 'them';
    const res = await rpc('finish_match', {p_match: match.id, p_winner: mine, p_hash: stateHash(match.state, ev)});
    if (!res.ok) { toast(res.error || 'Could not confirm the result.'); return; }
    toast(res.data && res.data.disputed ? 'Results did not match. No coins awarded.' : res.data && res.data.waiting ? 'Waiting for your opponent to confirm.' : 'Result saved.');
  }
  async function rematch(match) {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error); return; }
    const opp = seat === 'host' ? match.guest_name : match.host_name;
    const res = await rpc('create_challenge', {p_username: opp, p_deck: deck.deck});
    if (!res.ok) { toast(res.error || 'Could not offer a rematch.'); return; }
    toast('Rematch sent.');
    openMatch(res.data.id);
  }
  async function loadMatch(id) {
    const db = client();
    if (!db) return null;
    const {data, error} = await db.from('matches').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const user = me();
    seat = data.host === user.id ? 'host' : 'guest';
    return data;
  }
  function stopWatch() {
    if (poll) clearInterval(poll);
    poll = null;
    activeId = null;
    if (channel && client()) {
      client().removeChannel(channel);
      channel = null;
    }
  }
  function watch(id) {
    stopWatch();
    activeId = id;
    const db = client();
    if (!db) return;
    channel = db.channel('pvp-' + id)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'matches', filter: 'id=eq.' + id}, () => refreshActive())
      .subscribe();
    poll = setInterval(refreshActive, 4000);
  }
  async function refreshActive() {
    if (!activeId) return;
    await rpc('pvp_heartbeat', {p_match: activeId});
    const match = await loadMatch(activeId);
    if (!match) return;
    if (match.status === 'lobby') paintLobby(match);
    else if (match.status === 'active' || match.status === 'disputed') {
      paintMatch(match);
      if (match.turn_deadline && new Date(match.turn_deadline).getTime() + 5000 < Date.now()) {
        rpc('claim_forfeit', {p_match: match.id});
      }
    } else if (match.status === 'finished') {
      toast(match.result === 'forfeit' ? 'Match ended by forfeit.' : 'Match finished.');
      showHub();
    }
  }
  async function commitRanked(matchId, moves) {
    for (const move of moves) {
      const res = await rpc('submit_move', {p_match: matchId, p_move: move});
      if (!res || !res.ok) return {ok: false, error: (res && res.error) || 'The server rejected that move.'};
    }
    const match = await loadMatch(matchId);
    if (!match) return {ok: false, error: 'That match could not be reloaded.'};
    return {ok: true, match};
  }
  function bumpBotClock(matchId) {
    return rpc('bump_bot_clock', {p_match: matchId});
  }
  async function openMatch(id) {
    const match = await loadMatch(id);
    if (!match) { toast('Match not found.', true); return; }
    if (match.is_bot && match.status === 'active' && root.TOB_GAME && root.TOB_GAME.playRankedBot) {
      stopWatch();
      root.TOB_GAME.playRankedBot(match);
      return;
    }
    watch(id);
    if (match.status === 'lobby') paintLobby(match);
    else paintMatch(match);
  }
  async function createRoom() {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error, true); return; }
    const priv = document.getElementById('pvpPrivate');
    const args = {p_deck: deck.deck};
    if (priv && priv.checked) args.p_private = true;
    const res = await rpc('create_room', args);
    if (!res.ok) { toast(res.error || 'Could not create a room.', true); return; }
    openMatch(res.data.id);
  }
  async function joinCode(code) {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error, true); return; }
    const res = await rpc('join_room', {p_code: code, p_deck: deck.deck});
    if (!res.ok) { toast(res.error || 'Could not join that room.', true); return; }
    openMatch(res.data.id);
  }
  function rpcBody(res) {
    if (!res) return {};
    let data = res.data != null ? res.data : res;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { return {}; }
    }
    return data && typeof data === 'object' ? data : {};
  }
  function stopQueue() {
    searching = false;
    if (queuePoll) clearInterval(queuePoll);
    queuePoll = null;
    const db = client();
    if (queueChannel && db) db.removeChannel(queueChannel);
    queueChannel = null;
  }
  function keepaliveDequeue() {
    if (!searching) return;
    searching = false;
    const cfg = root.TOB_SUPABASE || {};
    let token = '';
    try {
      const key = Object.keys(localStorage).find(k => k.indexOf('auth-token') !== -1);
      if (key) {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        token = saved.access_token || (saved.currentSession && saved.currentSession.access_token) || '';
      }
    } catch (e) { /* the session key is optional */ }
    if (!cfg.url || !cfg.anonKey || !token) {
      rpc('dequeue_pvp');
      return;
    }
    fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/dequeue_pvp', {
      method: 'POST',
      keepalive: true,
      headers: {apikey: cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: '{}',
    }).catch(err => console.error('PvP dequeue', err));
  }
  function leaveQueue() {
    if (!searching) return;
    const pending = rpc('dequeue_pvp');
    stopQueue();
    pending.catch(err => console.error('PvP dequeue', err));
  }
  async function findQueueMatch() {
    const db = client();
    const user = me();
    if (!db || !user || user.guest) return null;
    const {data, error} = await db.from('matches').select('id,status,kind').or('host.eq.' + user.id + ',guest.eq.' + user.id).eq('status', 'active').in('kind', ['queue', 'bot']).order('created_at', {ascending: false}).limit(1);
    if (error) { console.error('PvP queue poll', error); return null; }
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    return rows[0] || null;
  }
  async function claimQueueMatch() {
    if (!searching) return;
    const match = await findQueueMatch();
    if (!match || !match.id) return;
    stopQueue();
    openMatch(match.id);
  }
  async function maybeBot() {
    if (!searching || botTried || Date.now() - searchStarted < BOT_WAIT) return;
    botTried = true;
    const wait = document.getElementById('pvpWait');
    if (wait) wait.textContent = 'No players found, matching you with a bot…';
    toast('No players found, matching you with a bot…');
    let res;
    try { res = await rpc('start_bot_match'); }
    catch (err) { console.error('PvP bot', err); res = {ok: false, error: err && err.message}; }
    if (!searching) return;
    if (!res || !res.ok) {
      botTried = false;
      if (/start_bot_match|does not exist|PGRST202|schema cache/i.test((res && res.error) || '')) {
        toast('Ranked bots are coming soon. Still searching…');
        botTried = true;
      } else toast((res && res.error) || 'Could not start a bot match.', true);
      return;
    }
    const id = rpcBody(res).id;
    if (!id || !searching) return;
    stopQueue();
    openMatch(id);
  }
  function watchQueue() {
    stopQueue();
    searching = true;
    searchStarted = Date.now();
    botTried = false;
    const db = client();
    const user = me();
    queuePoll = setInterval(() => {
      claimQueueMatch().catch(err => console.error('PvP queue poll', err));
      maybeBot().catch(err => console.error('PvP bot', err));
    }, 2000);
    if (db && user && !user.guest) {
      queueChannel = db.channel('pvp-queue-' + user.id)
        .on('postgres_changes', {event: '*', schema: 'public', table: 'matches'}, () => claimQueueMatch())
        .subscribe();
    }
  }
  function paintSearching() {
    shell(`<header class="pvp-top"><div class="pvp-title">QUICK MATCH</div><button type="button" class="btn" id="pvpCancel">Cancel</button></header>
      <section class="pvp-card pvp-lobby">
        <p class="pvp-kicker">Queue</p>
        <p id="pvpWait">Searching for an opponent…</p>
        <p class="pvp-status" id="pvpStatus" role="status">Searching for an opponent…</p>
      </section>`);
    const cancel = $('#pvpCancel');
    if (cancel) cancel.onclick = async () => {
      try { await rpc('dequeue_pvp'); }
      catch (err) { console.error('PvP dequeue', err); }
      stopQueue();
      showHub();
    };
    watchQueue();
  }
  async function queue() {
    const btn = document.getElementById('pvpQueue');
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
    try {
      if (mode !== 'on') mode = await probe();
      if (mode !== 'on') {
        toast(mode === 'guest' ? 'Sign in to play friends.' : 'PvP is not ready yet.', true);
        return;
      }
      toast('Checking your deck…');
      const deck = await myDeck();
      if (!deck.ok) { toast(deck.error, true); return; }
      toast('Joining the queue…');
      const res = await rpc('enqueue_pvp', {p_deck: deck.deck});
      if (!res || !res.ok) { toast((res && res.error) || 'Could not join the queue.', true); return; }
      const body = rpcBody(res);
      if (body.queued === false || body.id) {
        if (!body.id) { toast('The queue answered without a match.', true); return; }
        stopQueue();
        await openMatch(body.id);
        return;
      }
      paintSearching();
    } catch (err) {
      console.error('PvP queue failed', err);
      toast((err && err.message) || 'Could not join the queue.', true);
    } finally {
      const again = document.getElementById('pvpQueue');
      if (again) { again.disabled = false; again.textContent = 'Join queue'; }
    }
  }
  async function challenge(name, priv) {
    const user = me();
    if (!user || user.guest || (root.TOB_AUTH && root.TOB_AUTH.mode !== 'supabase')) {
      toast('Sign in to play friends.');
      return;
    }
    if (mode !== 'on') mode = await probe();
    if (mode !== 'on') { toast('PvP coming soon.'); return; }
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error); return; }
    const box = document.getElementById('pvpPrivate') || document.getElementById('friendPrivate');
    const isPrivate = typeof priv === 'boolean' ? priv : !!(box && box.checked);
    const args = {p_username: name, p_deck: deck.deck};
    if (isPrivate) args.p_private = true;
    const res = await rpc('create_challenge', args);
    if (!res.ok) { toast(res.error || 'Could not send the challenge.'); return; }
    toast('Challenge sent to ' + name + '.');
    openMatch(res.data.id);
  }
  async function pollInvites() {
    if (mode !== 'on') return;
    const db = client();
    const user = me();
    if (!db || !user || user.guest) return;
    const {data} = await db.from('match_invites').select('id,match_id,from_id,status').eq('to_id', user.id).eq('status', 'pending');
    if (!data || !data.length) return;
    const invite = data[0];
    if (document.getElementById('pvpInvite')) return;
    const bar = document.createElement('div');
    bar.id = 'pvpInvite';
    bar.className = 'pvp-invite';
    bar.innerHTML = `<span>Challenge received</span><button type="button" class="btn go" id="pvpAccept">Accept</button><button type="button" class="btn" id="pvpDecline">Decline</button>`;
    document.body.appendChild(bar);
    $('#pvpAccept').onclick = async () => {
      const deck = await myDeck();
      bar.remove();
      if (!deck.ok) { toast(deck.error); return; }
      const res = await rpc('respond_invite', {p_invite: invite.id, p_accept: true, p_deck: deck.deck});
      if (!res.ok) { toast(res.error || 'Could not accept.'); return; }
      openMatch(res.data.id);
    };
    $('#pvpDecline').onclick = async () => {
      await rpc('respond_invite', {p_invite: invite.id, p_accept: false, p_deck: []});
      bar.remove();
    };
  }
  function bindHub() {
    const home = $('#pvpHome');
    if (home) home.onclick = () => { leaveQueue(); showHub(); if (root.TOB_GAME && root.TOB_GAME.showHome) root.TOB_GAME.showHome(); };
    const sign = $('#pvpSign');
    if (sign) sign.onclick = () => root.TOB_GAME && root.TOB_GAME.showAuth && root.TOB_GAME.showAuth('login');
    const room = $('#pvpRoom');
    if (room) room.onclick = createRoom;
    const join = $('#pvpJoin');
    if (join) join.onsubmit = (ev) => { ev.preventDefault(); joinCode($('#pvpCode').value); };
    const q = $('#pvpQueue');
    if (q) q.onclick = queue;
  }
  async function show(opts) {
    mode = await probe();
    paintHub(opts && opts.note);
    bindHub();
    loadStandings();
    if (mode === 'on') pollInvites();
  }
  async function boot() {
    const params = new URLSearchParams(location.search);
    const code = params.get('room');
    mode = await probe();
    if (code && mode === 'on') joinCode(code);
    if (mode === 'on') setInterval(pollInvites, 8000);
  }
  function viewerKey() {
    let key = sessionStorage.getItem('tob_viewer');
    if (!key) {
      key = 'v' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('tob_viewer', key);
    }
    return key;
  }
  function safeAvatar(id) {
    if (!id || String(id).indexOf('ob_') === 0) return 'zoomer';
    const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
    if (cards && cards[id] && cards[id].adminOnly) return 'zoomer';
    return id;
  }
  function paintSpectate(data) {
    const state = {
      phase: data.phase,
      host: {board: (data.host && data.host.board) || [], goal: data.host && data.host.goalColor ? {color: data.host.goalColor} : null, silver: data.host && data.host.silver},
      guest: {board: (data.guest && data.guest.board) || [], goal: data.guest && data.guest.goalColor ? {color: data.guest.goalColor} : null, silver: data.guest && data.guest.silver},
    };
    let ev = null;
    try { ev = scoreOf(state); } catch (e) { ev = null; }
    const known = [data.host && data.host.goalColor, data.guest && data.guest.goalColor].filter(Boolean);
    const goalTxt = known.length ? goalLine(known) : 'Goal colors show when the match ends.';
    paintBoard({
      spectate: true,
      phase: data.phase,
      myTurn: false,
      topName: (data.host && data.host.name) || 'Host',
      botName: (data.guest && data.guest.name) || 'Guest',
      topWho: 'host',
      botWho: 'guest',
      topBoard: state.host.board,
      botBoard: state.guest.board,
      topHandCount: 0,
      scoreHtml: scorePanel(((data.host && data.host.name) || 'Host').toUpperCase(), ((data.guest && data.guest.name) || 'Guest').toUpperCase(), ev ? ev.score.p : 0, ev ? ev.score.o : 0, goalTxt, null, null),
      message: (data.spectators || 1) + ' watching. Revealed cards only. Hands stay hidden.',
      deadline: null,
      actions: '<button type="button" class="btn" id="pvpHome">Back</button>',
    });
    const home = $('#pvpHome');
    if (home) home.onclick = () => {
      stopWatch();
      if (root.TOB) root.TOB.battleLock = null;
      stopClock();
      if (root.TOB_GAME && root.TOB_GAME.showHome) root.TOB_GAME.showHome();
    };
  }
  async function refreshSpectate(id) {
    const res = await rpc('spectate_match', {p_match: id, p_viewer: viewerKey()});
    if (!res.ok || !res.data) return;
    if (!root.TOB || root.TOB.battleLock !== 'spectate') { stopWatch(); return; }
    paintSpectate(res.data);
  }
  async function spectate(id) {
    const db = client();
    if (!db) { toast('Spectating is not available right now.'); return; }
    const res = await rpc('spectate_match', {p_match: id, p_viewer: viewerKey()});
    if (!res.ok || !res.data) { toast((res && res.error) || 'That match is not open to spectators.'); return; }
    paintSpectate(res.data);
    stopWatch();
    activeId = id;
    poll = setInterval(() => refreshSpectate(id), 2000);
    channel = db.channel('spec-' + id)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'match_public', filter: 'id=eq.' + id}, () => refreshSpectate(id))
      .subscribe();
  }
  function previewSpectate() {
    const take = (id) => ({id, gold: false});
    paintSpectate({
      phase: 'place1', spectators: 3,
      host: {name: 'Nova', avatar: 'ember', board: [take('ember'), take('glimmer'), null, null, null, null, null], silver: null, goalColor: 'red'},
      guest: {name: 'Pip', avatar: 'twinkle', board: [take('twinkle'), null, null, null, null, null, null], silver: null, goalColor: 'purple'},
    });
  }
  function previewLobby() {
    mode = 'on';
    paintLobby({id: 'preview', code: 'DRAGN', guest: null, status: 'lobby'});
    const cancel = $('#pvpCancel');
    if (cancel) cancel.onclick = () => {};
  }
  function previewMatch() {
    const cards = root.TOB_CARDS.CARDS;
    const take = (id) => ({id, gold: false, color: cards[id].color});
    const state = {
      phase: 'score', turn: 'guest',
      host: {hand: [], board: [take('ember'), take('glimmer'), take('sirbumble'), null, null, null, null], goal: {color: 'red'}, silver: null},
      guest: {hand: [take('zoomer')], board: [take('twinkle'), take('dewdrop'), null, null, null, null, null], goal: {color: 'purple'}, silver: null},
    };
    seat = 'host';
    paintMatch({id: 'preview', host_name: 'You', guest_name: 'Nova', host_avatar: 'ember', guest_avatar: 'twinkle', state, turn_deadline: new Date(Date.now() + 90000).toISOString()});
  }
  document.addEventListener('click', (ev) => {
    if (!searching) return;
    const btn = ev.target.closest && ev.target.closest('button');
    if (!btn || btn.id === 'pvpCancel' || btn.closest('#pvpScreen')) return;
    leaveQueue();
  }, true);
  window.addEventListener('pagehide', keepaliveDequeue);
  root.TOB_PVP = {show, boot, challenge, spectate, previewLobby, previewMatch, previewSpectate, probe, leaveQueue, commitRanked, bumpBotClock};
})(window);
