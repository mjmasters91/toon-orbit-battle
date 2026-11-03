/* Player trades. The server settles them. Until 0009 is applied, the page says so. */
(function (root) {
  let tab = 'in';
  let soon = false;
  let book = null;
  let channel = null;
  let incomingN = 0;
  let draft = {user: '', offer: [], want: [], offerCoins: 0, wantCoins: 0, message: '', counter: null};
  let theirs = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function toast(msg) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = msg;
    node.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => node.classList.add('hidden'), 2400);
  }
  function bodyOf(res) {
    let data = res && res.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = null; }
    }
    return data || {};
  }
  function missing(res) {
    const msg = (res && res.error) || '';
    return /does not exist|could not find|PGRST202|42883|schema cache/i.test(msg);
  }
  function fail(res) {
    if (!res || !res.ok) return (res && res.error) || 'Trade failed.';
    const data = bodyOf(res);
    if (data.ok === false) return data.error || 'Trade failed.';
    return '';
  }
  function rpc(name, args) {
    if (!root.TOB_AUTH || !root.TOB_AUTH.rpc) return Promise.resolve({ok: false, error: 'Trades coming soon.'});
    return root.TOB_AUTH.rpc(name, args || {});
  }
  function signedIn() {
    const user = root.TOB_AUTH && root.TOB_AUTH.currentUser && root.TOB_AUTH.currentUser();
    return !!(user && !user.guest && root.TOB_AUTH.mode === 'supabase');
  }
  function puck(entry) {
    const copy = root.TOB_COPIES && root.TOB_COPIES.makeCopy(entry.id, {gold: !!entry.gold});
    const face = copy && root.TOB && root.TOB.renderCopy ? root.TOB.renderCopy(copy, null, true) : esc(entry.name || entry.id);
    const n = (entry.n | 0) > 1 ? `<span class="copycount">x${entry.n | 0}</span>` : '';
    return `<span class="trade-puck">${face}${n}</span>`;
  }
  function side(label, cards, coins) {
    const faces = (cards || []).map(puck).join('') || '<span class="trade-empty">No cards</span>';
    return `<div><div class="side-h">${label}</div><div class="trade-pucks">${faces}</div>${coins ? `<div class="trade-points">${coins} coins</div>` : ''}</div>`;
  }
  function asList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* leave empty */ }
    }
    return [];
  }
  function paintBadge() {
    document.querySelectorAll('[data-tradebadge]').forEach(el => {
      el.textContent = incomingN ? String(incomingN) : '';
      el.classList.toggle('on', incomingN > 0);
      el.setAttribute('aria-label', incomingN ? incomingN + ' incoming trades' : '');
    });
  }
  async function refreshBadge() {
    if (!signedIn()) { incomingN = 0; paintBadge(); return; }
    const res = await rpc('my_trades');
    if (missing(res)) { incomingN = 0; paintBadge(); return; }
    if (!res.ok) return;
    applyBook(bodyOf(res));
  }
  function reset() {
    incomingN = 0;
    book = null;
    const db = root.TOB_AUTH && root.TOB_AUTH.client && root.TOB_AUTH.client();
    if (channel && db) {
      try { db.removeChannel(channel); } catch (e) { /* already gone */ }
    }
    channel = null;
    paintBadge();
  }
  function watch() {
    const db = root.TOB_AUTH && root.TOB_AUTH.client && root.TOB_AUTH.client();
    const user = root.TOB_AUTH && root.TOB_AUTH.currentUser && root.TOB_AUTH.currentUser();
    if (!db || !user || user.guest || channel) return;
    refreshBadge();
    channel = db.channel('trades-' + user.id)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'trades'}, () => {
        refreshBadge();
        if (document.getElementById('tradeScreen')) show();
      })
      .subscribe();
  }
  function groupMine(profile) {
    const rows = [];
    const map = new Map();
    ((profile && profile.collection) || []).forEach(rec => {
      if (!rec || !rec.id || String(rec.id).indexOf('ob_') === 0) return;
      const card = root.TOB_CARDS && root.TOB_CARDS.CARDS[rec.id];
      if (!card || card.adminOnly) return;
      const key = rec.id + (rec.gold ? ':g' : ':s');
      let row = map.get(key);
      if (!row) {
        row = {id: rec.id, gold: !!rec.gold, n: 0, name: card.name};
        map.set(key, row);
        rows.push(row);
      }
      row.n += 1;
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name) || (a.gold - b.gold));
  }
  function picked(list, entry) {
    return list.find(row => row.id === entry.id && !!row.gold === !!entry.gold);
  }
  function togglePick(list, entry) {
    const have = picked(list, entry);
    if (have) list.splice(list.indexOf(have), 1);
    else list.push({id: entry.id, gold: !!entry.gold, n: 1, name: entry.name});
  }
  function applyBook(data) {
    book = data || {};
    book.incoming = asList(book.incoming);
    book.outgoing = asList(book.outgoing);
    book.incoming.forEach(row => {
      row.offer_cards = asList(row.offer_cards);
      row.want_cards = asList(row.want_cards);
    });
    book.outgoing.forEach(row => {
      row.offer_cards = asList(row.offer_cards);
      row.want_cards = asList(row.want_cards);
    });
    incomingN = book.incoming.length;
    paintBadge();
  }
  async function load() {
    soon = false;
    book = null;
    const res = await rpc('my_trades');
    if (missing(res)) { soon = true; incomingN = 0; paintBadge(); return; }
    if (!signedIn()) return;
    if (!res.ok) { toast(res.error || 'Could not load trades.'); return; }
    applyBook(bodyOf(res));
  }
  function tradeRow(row, incoming) {
    const buttons = incoming
      ? `<div class="go-btns"><button type="button" class="btn go" data-accept="${esc(row.id)}">Accept</button><button type="button" class="btn" data-decline="${esc(row.id)}">Decline</button><button type="button" class="btn" data-counter="${esc(row.id)}">Counter</button></div>`
      : (row.status === 'open' ? `<div class="go-btns"><button type="button" class="btn" data-cancel="${esc(row.id)}">Cancel</button></div>` : `<p class="trade-empty">${esc(row.status)}</p>`);
    return `<article class="trade-row">
      <div class="trade-top"><b>${esc(incoming ? row.from_name : row.to_name)}</b><span class="trade-empty">${esc(row.status)}</span></div>
      ${row.message ? `<p>${esc(row.message)}</p>` : ''}
      <div class="trade-sides">${side('They give', incoming ? row.offer_cards : row.want_cards, incoming ? row.offer_coins : row.want_coins)}${side('You give', incoming ? row.want_cards : row.offer_cards, incoming ? row.want_coins : row.offer_coins)}</div>
      ${buttons}
    </article>`;
  }
  function picks(list, rows, kind) {
    return `<div class="trade-pucks">${rows.map(row => {
      const on = picked(list, row) ? ' on' : '';
      return `<button type="button" class="trade-pick${on}" data-${kind}="${esc(row.id)}" data-gold="${row.gold ? '1' : '0'}" data-name="${esc(row.name)}">${puck(row)}</button>`;
    }).join('') || '<p class="trade-empty">No cards.</p>'}</div>`;
  }
  function createHTML(profile) {
    const friends = (profile && profile.friends) || [];
    const mine = groupMine(profile);
    const theirCards = (theirs && theirs.cards) || [];
    return `<form class="trade-form" id="tradeForm">
      <label class="field">Player<input id="tradeUser" list="tradeFriends" value="${esc(draft.user)}" maxlength="16" autocomplete="off" aria-label="Player username"></label>
      <datalist id="tradeFriends">${friends.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>
      <button type="button" class="btn" id="tradeLook">Look up collection</button>
      <div class="side-h">Your offer</div>
      ${picks(draft.offer, mine, 'offer')}
      <label class="field">Your coins<input id="tradeOfferCoins" type="number" min="0" value="${draft.offerCoins | 0}"></label>
      <div class="side-h">You want${theirs ? ' from ' + esc(theirs.username) : ''}</div>
      ${theirs ? picks(draft.want, theirCards, 'want') : '<p class="trade-empty">Look up a player to browse their collection.</p>'}
      ${theirs ? `<p class="side-note">They have <b class="trade-points">${theirs.coins | 0}</b> coins.</p>` : ''}
      <label class="field">Coins you want<input id="tradeWantCoins" type="number" min="0" value="${draft.wantCoins | 0}"></label>
      <label class="field">Message<input id="tradeMsg" maxlength="200" value="${esc(draft.message)}"></label>
      <button type="submit" class="btn go">${draft.counter ? 'Send counter' : 'Send trade'}</button>
    </form>`;
  }
  async function show() {
    const ov = document.getElementById('overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    const profile = root.TOB_AUTH && root.TOB_AUTH.loadProfile ? await root.TOB_AUTH.loadProfile() : null;
    await load();
    if (tab === 'new' && draft.user && !theirs && signedIn() && !soon) {
      const looked = await rpc('trade_browse', {p_username: draft.user});
      if (!fail(looked)) theirs = bodyOf(looked);
    }
    const coins = book && book.coins != null ? book.coins : (profile ? profile.coins | 0 : 0);
    const tabs = [['in', 'INCOMING'], ['out', 'OUTGOING'], ['new', 'CREATE TRADE']];
    let body = '';
    if (soon) body = '<p class="trade-empty">Trades coming soon.</p>';
    else if (!signedIn()) body = '<p class="trade-empty">Log in to trade.</p>';
    else if (tab === 'new') body = createHTML(profile);
    else if (tab === 'out') {
      const rows = (book && book.outgoing) || [];
      body = rows.map(row => tradeRow(row, false)).join('') || '<p class="trade-empty">No outgoing trades.</p>';
    } else {
      const rows = (book && book.incoming) || [];
      body = rows.map(row => tradeRow(row, true)).join('') || '<p class="trade-empty">No incoming trades.</p>';
    }
    ov.innerHTML = `<div id="tradeScreen"><div class="trade-wrap">
      <div class="trade-top">
        <div class="auc-tabs">${tabs.map(([id, label]) => `<button type="button" class="btn${tab === id ? ' go' : ''}" data-tradetab="${id}">${label}</button>`).join('')}</div>
        <b class="trade-points">${coins} pts</b>
      </div>
      ${body}
    </div></div>`;
    ov.querySelectorAll('[data-tradetab]').forEach(btn => { btn.onclick = () => { tab = btn.dataset.tradetab; show(); }; });
    const act = async (id, fn) => {
      const err = fail(await fn(id));
      toast(err || 'Updated.');
      if (profile && root.TOB_AUTH.loadProfile) {
        const fresh = await root.TOB_AUTH.loadProfile();
        if (fresh && root.TOB && root.TOB.renderCopy) { /* profile refresh is enough */ }
      }
      show();
    };
    ov.querySelectorAll('[data-accept]').forEach(btn => { btn.onclick = () => act(btn.dataset.accept, id => rpc('accept_trade', {p_id: id})); });
    ov.querySelectorAll('[data-decline]').forEach(btn => { btn.onclick = () => act(btn.dataset.decline, id => rpc('decline_trade', {p_id: id})); });
    ov.querySelectorAll('[data-cancel]').forEach(btn => { btn.onclick = () => act(btn.dataset.cancel, id => rpc('cancel_trade', {p_id: id})); });
    ov.querySelectorAll('[data-counter]').forEach(btn => {
      btn.onclick = () => {
        const row = ((book && book.incoming) || []).find(item => item.id === btn.dataset.counter);
        if (!row) return;
        draft = {
          user: row.from_name,
          offer: (row.want_cards || []).map(card => ({id: card.id, gold: !!card.gold, n: card.n | 0 || 1, name: card.name})),
          want: (row.offer_cards || []).map(card => ({id: card.id, gold: !!card.gold, n: card.n | 0 || 1, name: card.name})),
          offerCoins: row.want_coins | 0,
          wantCoins: row.offer_coins | 0,
          message: '',
          counter: row.id,
        };
        theirs = null;
        tab = 'new';
        show();
      };
    });
    const snap = () => {
      const userBox = document.getElementById('tradeUser');
      const offerBox = document.getElementById('tradeOfferCoins');
      const wantBox = document.getElementById('tradeWantCoins');
      const msgBox = document.getElementById('tradeMsg');
      if (userBox) draft.user = userBox.value;
      if (offerBox) draft.offerCoins = Math.max(0, parseInt(offerBox.value, 10) || 0);
      if (wantBox) draft.wantCoins = Math.max(0, parseInt(wantBox.value, 10) || 0);
      if (msgBox) draft.message = msgBox.value;
    };
    ov.querySelectorAll('[data-offer]').forEach(btn => {
      btn.onclick = () => { snap(); togglePick(draft.offer, {id: btn.dataset.offer, gold: btn.dataset.gold === '1', name: btn.dataset.name}); show(); };
    });
    ov.querySelectorAll('[data-want]').forEach(btn => {
      btn.onclick = () => { snap(); togglePick(draft.want, {id: btn.dataset.want, gold: btn.dataset.gold === '1', name: btn.dataset.name}); show(); };
    });
    const look = document.getElementById('tradeLook');
    if (look) look.onclick = async () => {
      draft.user = (document.getElementById('tradeUser') || {}).value || '';
      const res = await rpc('trade_browse', {p_username: draft.user});
      const err = fail(res);
      if (err) { toast(missing(res) ? 'Trades coming soon.' : err); return; }
      theirs = bodyOf(res);
      show();
    };
    const form = document.getElementById('tradeForm');
    if (form) form.onsubmit = async (ev) => {
      ev.preventDefault();
      const user = (document.getElementById('tradeUser') || {}).value || draft.user;
      const offerCoins = Math.max(0, parseInt((document.getElementById('tradeOfferCoins') || {}).value, 10) || 0);
      const wantCoins = Math.max(0, parseInt((document.getElementById('tradeWantCoins') || {}).value, 10) || 0);
      const message = (document.getElementById('tradeMsg') || {}).value || '';
      const cards = list => list.map(row => ({id: row.id, gold: !!row.gold, n: row.n | 0 || 1}));
      const args = {
        p_offer_cards: cards(draft.offer),
        p_offer_coins: offerCoins,
        p_want_cards: cards(draft.want),
        p_want_coins: wantCoins,
        p_message: message,
      };
      const res = draft.counter
        ? await rpc('counter_trade', Object.assign({p_id: draft.counter}, args))
        : await rpc('create_trade', Object.assign({p_username: user}, args));
      const err = fail(res);
      if (err) { toast(missing(res) ? 'Trades coming soon.' : err); return; }
      toast(draft.counter ? 'Counter sent.' : 'Trade sent.');
      draft = {user: '', offer: [], want: [], offerCoins: 0, wantCoins: 0, message: '', counter: null};
      theirs = null;
      tab = 'out';
      show();
    };
    watch();
  }

  root.TOB_TRADES = {show, watch, paintBadge, refresh: refreshBadge, reset};
})(window);
