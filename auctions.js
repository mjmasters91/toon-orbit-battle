/* Auction house. LocalAuctionHouse keeps every lot in localStorage so
   accounts on this device can trade. SupabaseAuctionHouse calls the
   security-definer RPCs in the README when online accounts are on. */
(function (root) {
  const KEY = 'tob_auctions';
  const DURATIONS = [
    {id: '1h', label: '1 hour', ms: 60 * 60 * 1000},
    {id: '6h', label: '6 hours', ms: 6 * 60 * 60 * 1000},
    {id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000},
    {id: '3d', label: '3 days', ms: 3 * 24 * 60 * 60 * 1000},
  ];
  const ADMIN_DURATIONS = [{id: '2m', label: '2 minutes', ms: 2 * 60 * 1000}];

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function keyOf(name) { return String(name || '').trim().toLowerCase(); }
  function feePct() {
    try {
      const n = Math.round(Number(JSON.parse(localStorage.getItem('tob_economy') || '{}').auctionFee));
      if (Number.isFinite(n) && n >= 0 && n <= 50) return n;
    } catch (e) { /* default */ }
    return 0;
  }
  function increment(amount) { return Math.max(10, Math.ceil(amount * 0.05)); }
  function minBid(lot) { return lot.bidder ? lot.bid + increment(lot.bid) : lot.start; }
  function netOf(amount, pct) { return amount - Math.floor(amount * (pct || 0) / 100); }

  function readBook() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (data && Array.isArray(data.lots)) return data;
    } catch (e) { /* fresh book */ }
    return {seq: 1, lots: [], notices: {}};
  }
  function writeBook(book) { localStorage.setItem(KEY, JSON.stringify(book)); }
  function readState() {
    let accounts = {};
    let guest = null;
    try { accounts = JSON.parse(localStorage.getItem('tob_accounts') || '{}') || {}; } catch (e) { accounts = {}; }
    try { guest = JSON.parse(localStorage.getItem('tob_guest') || 'null'); } catch (e) { guest = null; }
    return {accounts, guest};
  }
  function writeState(state) {
    localStorage.setItem('tob_accounts', JSON.stringify(state.accounts));
    if (state.guest) localStorage.setItem('tob_guest', JSON.stringify(state.guest));
  }
  function profileOf(state, name) {
    const key = keyOf(name);
    if (key === 'guest') return state.guest;
    const rec = state.accounts[key];
    return rec ? rec.profile : null;
  }
  function note(book, name, text) {
    const key = keyOf(name);
    if (!key || !text) return;
    book.notices = book.notices || {};
    const list = book.notices[key] || [];
    list.push({id: 'n' + Date.now() + list.length, text, at: Date.now()});
    book.notices[key] = list.slice(-20);
  }
  function hasUid(profile, uid) {
    return (profile.collection || []).some(rec => rec && rec.uid === uid);
  }
  function giveCard(profile, card) {
    if (!card || hasUid(profile, card.uid)) return false;
    profile.collection = (profile.collection || []).concat([{id: card.id, gold: !!card.gold, uid: card.uid}]);
    return true;
  }
  function takeCard(profile, uid) {
    const list = profile.collection || [];
    const i = list.findIndex(rec => rec && rec.uid === uid);
    if (i < 0) return null;
    const [rec] = list.splice(i, 1);
    profile.collection = list;
    return rec;
  }
  function markOnce(profile, token) {
    profile.auctionLedger = profile.auctionLedger || [];
    if (profile.auctionLedger.indexOf(token) !== -1) return false;
    profile.auctionLedger.push(token);
    if (profile.auctionLedger.length > 200) profile.auctionLedger = profile.auctionLedger.slice(-200);
    return true;
  }
  function bumpStat(profile, field, token) {
    profile.stats = profile.stats || {};
    if (!markOnce(profile, token)) return;
    profile.stats[field] = (profile.stats[field] | 0) + 1;
  }

  class AuctionHouse {
    durations() { return DURATIONS.slice(); }
    adminDurations() { return ADMIN_DURATIONS.slice(); }
    feePct() { return feePct(); }
    minBid(lot) { return minBid(lot); }
    list() { return []; }
    settle() { return 0; }
    pullNotices() { return []; }
  }

  class LocalAuctionHouse extends AuctionHouse {
    constructor() {
      super();
      this._busy = false;
    }
    _me() {
      const auth = root.TOB_AUTH;
      return auth && auth.currentUser ? auth.currentUser() : null;
    }
    _run(fn) {
      if (this._busy) return {ok: false, error: 'Please wait a moment.'};
      this._busy = true;
      try { return fn(); }
      catch (e) { return {ok: false, error: 'Could not update the auction house.'}; }
      finally { this._busy = false; }
    }
    list() { this.settle(); return clone(readBook().lots); }
    get(id) { return clone((readBook().lots || []).find(lot => lot.id === id) || null); }
    pullNotices() {
      const me = this._me();
      if (!me) return [];
      const book = readBook();
      const key = keyOf(me.username);
      const notes = (book.notices && book.notices[key]) || [];
      if (notes.length && book.notices) book.notices[key] = [];
      if (notes.length) writeBook(book);
      return clone(notes);
    }
    settle() {
      const state = readState();
      const book = readBook();
      let n = 0;
      (book.lots || []).forEach(lot => {
        if (!lot || lot.status !== 'open' || lot.ends > Date.now()) return;
        const card = lot.card;
        if (lot.bidder) {
          const winner = profileOf(state, lot.bidder);
          const seller = profileOf(state, lot.seller);
          if (winner) giveCard(winner, card);
          if (seller) {
            const pay = netOf(lot.bid | 0, lot.feePct | 0);
            if (markOnce(seller, lot.id + ':pay')) seller.coins = (seller.coins | 0) + pay;
            bumpStat(seller, 'auctionsSold', lot.id + ':sold');
          }
          if (winner) bumpStat(winner, 'auctionsWon', lot.id + ':won');
          lot.status = 'sold';
          lot.payout = netOf(lot.bid | 0, lot.feePct | 0);
          note(book, lot.bidder, 'You won ' + (card && card.name ? card.name : 'a card') + '.');
          note(book, lot.seller, 'Your auction sold for ' + (lot.payout | 0) + ' coins.');
        } else {
          const seller = profileOf(state, lot.seller);
          if (seller) giveCard(seller, card);
          lot.status = 'unsold';
          note(book, lot.seller, 'Your auction ended with no bids. The card is back.');
        }
        n++;
      });
      if (n) { writeState(state); writeBook(book); }
      return n;
    }
    create(opts) {
      return this._run(() => {
        this.settle();
        const me = this._me();
        if (!me) return {ok: false, error: 'Log in first.'};
        const start = Math.round(Number(opts && opts.start));
        const ms = Math.round(Number(opts && opts.ms));
        if (!Number.isFinite(start) || start < 1 || start > 1000000) return {ok: false, error: 'Set a starting price of at least 1.'};
        if (!Number.isFinite(ms) || ms < 60000 || ms > 14 * 24 * 60 * 60 * 1000) return {ok: false, error: 'Pick a duration.'};
        const state = readState();
        const profile = profileOf(state, me.username);
        if (!profile) return {ok: false, error: 'Log in first.'};
        const rec = takeCard(profile, opts.uid);
        if (!rec) return {ok: false, error: 'That copy is not in your collection.'};
        const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
        const def = cards && cards[rec.id];
        if (!def) { profile.collection = (profile.collection || []).concat([rec]); return {ok: false, error: 'Unknown card.'}; }
        if (def.adminOnly || String(rec.id).indexOf('ob_') === 0) {
          profile.collection = (profile.collection || []).concat([rec]);
          return {ok: false, error: 'Obsidian Order cards stay out of the auction house.'};
        }
        let custom = [];
        try { custom = JSON.parse(localStorage.getItem('tob_custom') || '[]'); } catch (e) { custom = []; }
        const still = (profile.collection || []).some(c => c && c.id === rec.id);
        const deckIds = custom.map(entry => typeof entry === 'string' ? entry : entry && entry.id);
        if (!still && deckIds.indexOf(rec.id) !== -1) {
          profile.collection = (profile.collection || []).concat([rec]);
          return {ok: false, error: 'That is the only copy in your custom deck. Take it out of the deck first.'};
        }
        const book = readBook();
        const lot = {
          id: 'a' + (book.seq++),
          card: {id: rec.id, gold: !!rec.gold, uid: rec.uid, name: def.name, archetype: def.archetype || ''},
          seller: profile.username || me.username,
          start, bid: 0, bidder: null, bids: [],
          created: Date.now(), ends: Date.now() + ms,
          status: 'open', feePct: feePct(),
        };
        book.lots.push(lot);
        writeState(state);
        writeBook(book);
        return {ok: true, lot: clone(lot)};
      });
    }
    bid(id, amount) {
      return this._run(() => {
        this.settle();
        const me = this._me();
        if (!me) return {ok: false, error: 'Log in first.'};
        const offer = Math.round(Number(amount));
        const book = readBook();
        const lot = (book.lots || []).find(row => row.id === id);
        if (!lot || lot.status !== 'open') return {ok: false, error: 'That auction is closed.'};
        if (lot.ends <= Date.now()) return {ok: false, error: 'That auction just ended.'};
        if (keyOf(lot.seller) === keyOf(me.username)) return {ok: false, error: 'You can’t bid on your own auction.'};
        const floor = minBid(lot);
        if (!Number.isFinite(offer) || offer < floor) return {ok: false, error: 'Bid at least ' + floor + ' coins.'};
        const state = readState();
        const bidder = profileOf(state, me.username);
        if (!bidder) return {ok: false, error: 'Log in first.'};
        if ((bidder.coins | 0) < offer) return {ok: false, error: 'You don’t have enough Orbit Coins.'};
        const prevName = lot.bidder;
        const prevAmt = lot.bid | 0;
        bidder.coins = (bidder.coins | 0) - offer;
        if (prevName) {
          const prev = profileOf(state, prevName);
          if (prev) prev.coins = (prev.coins | 0) + prevAmt;
          note(book, prevName, 'You were outbid on ' + (lot.card.name || 'a card') + '.');
        }
        lot.bid = offer;
        lot.bidder = bidder.username || me.username;
        lot.bids = lot.bids || [];
        lot.bids.push({user: lot.bidder, amount: offer, at: Date.now()});
        if (lot.ends - Date.now() < 60000) lot.ends += 60000;
        writeState(state);
        writeBook(book);
        return {ok: true, lot: clone(lot)};
      });
    }
    cancel(id) {
      return this._run(() => this._close(id, false));
    }
    adminCancel(id) {
      return this._run(() => this._close(id, true));
    }
    adminEnd(id) {
      return this._run(() => {
        const book = readBook();
        const lot = (book.lots || []).find(row => row.id === id);
        if (!lot || lot.status !== 'open') return {ok: false, error: 'That auction is closed.'};
        lot.ends = Date.now() - 1;
        writeBook(book);
        this.settle();
        return {ok: true};
      });
    }
    _close(id, admin) {
      this.settle();
      const me = this._me();
      if (!me) return {ok: false, error: 'Log in first.'};
      const book = readBook();
      const lot = (book.lots || []).find(row => row.id === id);
      if (!lot || lot.status !== 'open') return {ok: false, error: 'That auction is closed.'};
      if (!admin && keyOf(lot.seller) !== keyOf(me.username)) return {ok: false, error: 'Only the seller can cancel.'};
      if (!admin && lot.bidder) return {ok: false, error: 'You can cancel only before the first bid.'};
      const state = readState();
      const seller = profileOf(state, lot.seller);
      if (seller) giveCard(seller, lot.card);
      if (lot.bidder) {
        const prev = profileOf(state, lot.bidder);
        if (prev && markOnce(prev, lot.id + ':refund')) prev.coins = (prev.coins | 0) + (lot.bid | 0);
        note(book, lot.bidder, 'An auction you bid on was cancelled. Your coins are back.');
      }
      lot.status = 'cancelled';
      note(book, lot.seller, 'Your auction was cancelled. The card is back.');
      writeState(state);
      writeBook(book);
      return {ok: true};
    }
  }

  class SupabaseAuctionHouse extends AuctionHouse {
    constructor(client) {
      super();
      this.client = client;
      this._lots = [];
      this._notes = [];
      const self = this;
      client.channel('tob-auctions')
        .on('postgres_changes', {event: '*', schema: 'public', table: 'auctions'}, () => {
          self.refresh().then(() => {
            try { root.dispatchEvent(new CustomEvent('tob-auctions')); } catch (e) { /* ignore */ }
          });
        })
        .subscribe();
    }
    _me() {
      const auth = root.TOB_AUTH;
      return auth && auth.currentUser ? auth.currentUser() : null;
    }
    async _rpc(name, args) {
      const {data, error} = await this.client.rpc(name, args || {});
      if (error) return {ok: false, error: error.message || 'Auction request failed.'};
      return {ok: true, data: data};
    }
    list() { return this._lots.slice(); }
    get(id) { return this._lots.find(lot => lot.id === id) || null; }
    pullNotices() {
      const notes = this._notes.slice();
      this._notes = [];
      return notes;
    }
    async refresh() {
      await this._rpc('settle_auction', {p_lot: null});
      const {data, error} = await this.client.from('auctions').select('id,card_id,gold,start_bid,current_bid,ends_at,status,seller,high_bidder,created_at').order('ends_at');
      if (error || !data) return;
      const ids = [...new Set(data.map(row => row.seller).concat(data.map(row => row.high_bidder)).filter(Boolean))];
      const names = {};
      if (ids.length) {
        const profs = await this.client.from('public_profiles').select('id,username').in('id', ids);
        (profs.data || []).forEach(row => { names[row.id] = row.username; });
      }
      const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
      this._lots = data.map(row => {
        const def = cards && cards[row.card_id];
        return {
          id: row.id,
          card: {id: row.card_id, gold: !!row.gold, uid: row.card_id + (row.gold ? ':g:a' : ':s:a'), name: def ? def.name : row.card_id, archetype: def ? (def.archetype || '') : ''},
          seller: names[row.seller] || 'Player',
          start: row.start_bid,
          bid: row.current_bid | 0,
          bidder: row.high_bidder ? (names[row.high_bidder] || 'Player') : null,
          bids: [],
          created: new Date(row.created_at).getTime(),
          ends: new Date(row.ends_at).getTime(),
          status: row.status,
          feePct: feePct(),
        };
      });
    }
    async create(opts) {
      const me = this._me();
      if (!me) return {ok: false, error: 'Log in first.'};
      const auth = root.TOB_AUTH;
      const profile = auth && auth.loadProfile ? await auth.loadProfile() : null;
      const rec = ((profile && profile.collection) || []).find(row => row && row.uid === opts.uid);
      if (!rec) return {ok: false, error: 'That copy is not in your collection.'};
      const res = await this._rpc('create_auction', {p_card: rec.id, p_gold: !!rec.gold, p_start: opts.start, p_ms: opts.ms});
      if (!res.ok) return res;
      await this.refresh();
      if (auth && auth.loadProfile) await auth.loadProfile();
      return {ok: true, lot: this.get(res.data && res.data.id)};
    }
    async bid(id, amount) {
      const res = await this._rpc('place_bid', {p_lot: id, p_amount: amount});
      if (res.ok) await this.refresh();
      return res;
    }
    async cancel(id) {
      const res = await this._rpc('cancel_auction', {p_lot: id, p_admin: false});
      if (res.ok) await this.refresh();
      return res;
    }
    async adminCancel(id) {
      const res = await this._rpc('cancel_auction', {p_lot: id, p_admin: true});
      if (res.ok) await this.refresh();
      return res;
    }
    async adminEnd(id) {
      const res = await this._rpc('admin_end_auction', {p_lot: id});
      if (res.ok) await this.refresh();
      return res;
    }
    settle() { return 0; }
  }

  const house = new LocalAuctionHouse();
  house.DURATIONS = DURATIONS;
  house.ADMIN_DURATIONS = ADMIN_DURATIONS;
  house.increment = increment;
  root.TOB_AUCTIONS = house;
  root.TOB_BIND_AUCTIONS = function (client) {
    const remote = new SupabaseAuctionHouse(client);
    remote.DURATIONS = DURATIONS;
    remote.ADMIN_DURATIONS = ADMIN_DURATIONS;
    remote.increment = increment;
    remote.refresh = remote.refresh.bind(remote);
    root.TOB_AUCTIONS = remote;
  };
})(this);
