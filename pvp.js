/* Live PvP. The server checks decks, turns, and payouts. Both clients
   score the shared board with the same engine. Guests cannot queue. */
(function (root) {
  const $ = (s, r) => (r || document).querySelector(s);
  let mode = 'off';
  let channel = null;
  let poll = null;
  let activeId = null;
  let seat = 'host';

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
    return out.length === 12 ? out : null;
  }
  async function myDeck() {
    const profile = await root.TOB_AUTH.loadProfile();
    const deck = deckFromProfile(profile);
    if (!deck) {
      const admin = profile && profile.role === 'admin';
      return {ok: false, error: admin ? 'Build a 12-card deck first.' : 'Build a 12-card deck without Obsidian cards first.'};
    }
    return {ok: true, deck, profile};
  }
  function toast(msg) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = msg;
    node.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => node.classList.add('hidden'), 2600);
  }
  function shell(inner) {
    const ov = document.getElementById('overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `<div id="pvpScreen">${inner}</div>`;
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
        <section class="pvp-card"><h2>Sign in to play friends</h2><p>Guest matches stay on this device. An online account can challenge friends, share a room code, or join the queue.</p>
        <button type="button" class="btn go" id="pvpSign">Sign in</button></section>`);
      return;
    }
    if (mode !== 'on') {
      shell(`<header class="pvp-top"><div class="pvp-title">PVP</div><button type="button" class="btn" id="pvpHome">Home</button></header>
        <section class="pvp-card"><h2>PvP coming soon</h2><p>Live matches turn on after the matches table is ready. Your other games still work.</p></section>`);
      return;
    }
    shell(`<header class="pvp-top"><div class="pvp-title">PVP</div><button type="button" class="btn" id="pvpHome">Home</button></header>
      <section class="pvp-card"><h2>Play a friend</h2><p>Share a room code or open the link. Rooms expire in 10 minutes.</p>
        <label class="pvp-private"><input type="checkbox" id="pvpPrivate"> Private match</label>
        <button type="button" class="btn go" id="pvpRoom">Create room</button>
        <form class="pvp-join" id="pvpJoin"><input id="pvpCode" maxlength="5" placeholder="Room code" aria-label="Room code"><button class="btn" type="submit">Join</button></form>
      </section>
      <section class="pvp-card"><h2>Quick match</h2><p>Wait for the next player with a 12-card deck.</p>
        <button type="button" class="btn go" id="pvpQueue">Join queue</button>
      </section>
      <div id="pvpExtra">${extra || ''}</div>`);
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
    if (cancel) cancel.onclick = async () => { await rpc('cancel_lobby', {p_match: match.id}); stopWatch(); paintHub(); };
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
    return E.evaluate(boards, shown, {goals, silver, penalty: {p: 0, o: 0}, final: true});
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
    const oppName = opp === 'host' ? match.host_name : match.guest_name;
    const oppAva = opp === 'host' ? match.host_avatar : match.guest_avatar;
    const myTurn = state.turn === mine;
    const ev = state.phase === 'score' ? scoreOf(state) : null;
    const hand = ((state[mine] && state[mine].hand) || []).map((card, i) => `<button type="button" class="pvp-hand" data-hand="${i}">${cardFace(card)}</button>`).join('');
    const row = (who) => (state[who].board || []).map((card, i) => `<div class="pvp-slot${card ? ' filled' : ''}" data-slot="${i}" data-who="${who}">${card ? cardFace(card) : ''}</div>`).join('');
    shell(`<header class="pvp-top">
        <img class="pvp-ava" src="assets/cards/${encodeURIComponent(oppAva || 'zoomer')}.webp" alt="">
        <div class="pvp-title">${esc(oppName || 'Opponent')}</div>
        <div class="pvp-turn">${myTurn ? 'Your turn' : 'Their turn'}</div>
        <button type="button" class="btn" id="pvpResign">Resign</button>
      </header>
      <div class="pvp-clock" id="pvpClock"></div>
      <section class="pvp-board">
        <div class="pvp-row opp">${row(opp)}</div>
        <div class="pvp-row mine">${row(mine)}</div>
      </section>
      <div class="pvp-score">${ev ? `You ${seat === 'host' ? ev.score.p : ev.score.o} · Them ${seat === 'host' ? ev.score.o : ev.score.p}` : esc(phaseLabel(state.phase))}</div>
      <div class="pvp-hands">${hand}</div>
      <div class="pvp-actions" id="pvpActions"></div>`);
    wireMatch(match, ev);
    if (ev && ev.combos && ev.combos.length) callout(ev.combos[0]);
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
    const actions = $('#pvpActions');
    const resign = $('#pvpResign');
    if (resign) resign.onclick = async () => {
      if (!window.confirm('Resign this match?')) return;
      await rpc('resign_match', {p_match: match.id});
      toast('You resigned.');
      stopWatch();
      paintHub();
    };
    if (state.phase === 'discard' && state.turn === seat) {
      actions.innerHTML = '<button type="button" class="btn go" id="pvpDiscard">Discard selected</button>';
      $('#pvpDiscard').onclick = async () => {
        const idx = [...document.querySelectorAll('.pvp-hand.on')].map(node => +node.dataset.hand);
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
    document.querySelectorAll('.pvp-hand').forEach(btn => {
      btn.onclick = () => btn.classList.toggle('on');
    });
    document.querySelectorAll('.pvp-slot').forEach(slot => {
      slot.onclick = async () => {
        if (slot.dataset.who !== seat || state.turn !== seat) return;
        const picked = document.querySelector('.pvp-hand.on');
        if (!picked) { toast('Select a card in your hand.'); return; }
        await sendMove(match.id, {t: 'place', slot: +slot.dataset.slot, hand: +picked.dataset.hand});
      };
    });
    document.querySelectorAll('[data-silver]').forEach(btn => {
      btn.onclick = () => sendMove(match.id, {t: 'silver', color: btn.dataset.silver || null});
    });
    tickClock(match.turn_deadline);
  }
  function tickClock(deadline) {
    const node = $('#pvpClock');
    if (!node || !deadline) return;
    const left = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
    node.textContent = left ? left + 's' : 'Time';
  }
  async function sendMove(id, move) {
    const res = await rpc('submit_move', {p_match: id, p_move: move});
    if (!res.ok) { toast(res.error || 'Illegal move.'); return; }
    const match = await loadMatch(id);
    if (match) paintMatch(match);
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
      if (match.turn_deadline && new Date(match.turn_deadline).getTime() < Date.now()) {
        rpc('claim_forfeit', {p_match: match.id});
      }
    } else if (match.status === 'finished') {
      toast(match.result === 'forfeit' ? 'Match ended by forfeit.' : 'Match finished.');
      stopWatch();
      paintHub();
    }
  }
  async function openMatch(id) {
    const match = await loadMatch(id);
    if (!match) { toast('Match not found.'); return; }
    watch(id);
    if (match.status === 'lobby') paintLobby(match);
    else paintMatch(match);
  }
  async function createRoom() {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error); return; }
    const priv = document.getElementById('pvpPrivate');
    const args = {p_deck: deck.deck};
    if (priv && priv.checked) args.p_private = true;
    const res = await rpc('create_room', args);
    if (!res.ok) { toast(res.error || 'Could not create a room.'); return; }
    openMatch(res.data.id);
  }
  async function joinCode(code) {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error); return; }
    const res = await rpc('join_room', {p_code: code, p_deck: deck.deck});
    if (!res.ok) { toast(res.error || 'Could not join that room.'); return; }
    openMatch(res.data.id);
  }
  async function queue() {
    const deck = await myDeck();
    if (!deck.ok) { toast(deck.error); return; }
    const res = await rpc('enqueue_pvp', {p_deck: deck.deck});
    if (!res.ok) { toast(res.error || 'Could not join the queue.'); return; }
    if (res.data && res.data.id) openMatch(res.data.id);
    else {
      paintLobby({id: null, code: 'QUEUE', guest: null});
      const cancel = $('#pvpCancel');
      if (cancel) cancel.onclick = async () => { await rpc('dequeue_pvp'); paintHub(); };
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
    if (home) home.onclick = () => { stopWatch(); if (root.TOB_GAME && root.TOB_GAME.showHome) root.TOB_GAME.showHome(); };
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
    const cards = root.TOB_CARDS.CARDS;
    const face = (entry) => {
      if (!entry || !entry.id || !cards[entry.id] || String(entry.id).indexOf('ob_') === 0 || cards[entry.id].adminOnly) return '';
      return ui().card(Object.assign({}, cards[entry.id], {gold: !!entry.gold}), null, true);
    };
    const row = (seat) => (seat.board || []).map(card => `<div class="pvp-slot${card ? ' filled' : ''}">${face(card)}</div>`).join('');
    const score = () => {
      try {
        const ev = scoreOf({
          phase: 'score',
          host: {board: data.host.board, goal: {color: data.host.goalColor}, silver: data.host.silver},
          guest: {board: data.guest.board, goal: {color: data.guest.goalColor}, silver: data.guest.silver},
        });
        return `${data.host.name} ${ev.score.p} · ${data.guest.name} ${ev.score.o}`;
      } catch (e) { return data.phase || 'Live'; }
    };
    shell(`<header class="pvp-top">
        <button type="button" class="btn" id="pvpHome">Back</button>
        <div class="pvp-title">WATCHING</div>
        <div class="pvp-turn">${data.spectators || 1} watching</div>
      </header>
      <section class="pvp-card pvp-spec">
        <div class="pvp-vs"><img src="assets/cards/${encodeURIComponent(safeAvatar(data.host.avatar))}.webp" alt=""><b>${esc(data.host.name)}</b><span>vs</span><b>${esc(data.guest.name)}</b><img src="assets/cards/${encodeURIComponent(safeAvatar(data.guest.avatar))}.webp" alt=""></div>
        <div class="pvp-board"><div class="pvp-row">${row(data.host)}</div><div class="pvp-row">${row(data.guest)}</div></div>
        <p class="pvp-score">${esc(score())}</p>
        <p class="pvp-note">Spectators see the revealed board only. Hands and decks stay hidden.</p>
      </section>`);
    const home = $('#pvpHome');
    if (home) home.onclick = () => { stopWatch(); if (root.TOB_GAME && root.TOB_GAME.showHome) root.TOB_GAME.showHome(); };
  }
  async function refreshSpectate(id) {
    const res = await rpc('spectate_match', {p_match: id, p_viewer: viewerKey()});
    if (!res.ok || !res.data) return;
    if (!document.getElementById('pvpScreen')) { stopWatch(); return; }
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
    paintMatch({id: 'preview', host_name: 'You', guest_name: 'Nova', host_avatar: 'ember', guest_avatar: 'twinkle', state, turn_deadline: new Date(Date.now() + 45000).toISOString()});
  }
  root.TOB_PVP = {show, boot, challenge, spectate, previewLobby, previewMatch, previewSpectate, probe};
})(window);
