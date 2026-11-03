/* Toon Orbit Battle — pluggable accounts.
   AuthProvider: signUp, logIn, logOut, currentUser, loadProfile, saveProfile.
   LocalAuthProvider is the default. SupabaseAuthProvider takes over only when
   supabase-config.js has a non-empty url and anonKey. */
(function (root) {
  const ITER = 100000;
  const ACCOUNTS_KEY = 'tob_accounts';
  const SESSION_KEY = 'tob_session';
  const GUEST_KEY = 'tob_guest';
  const GUEST_FLAG = 'tob_guest_session';

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function hex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function fromHex(text) {
    const out = new Uint8Array(text.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(text.substr(i * 2, 2), 16);
    return out;
  }
  function sameBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function normMap(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(k => {
      const n = obj[k] | 0;
      if (n > 0 && /^[A-Za-z0-9_ ]{1,40}$/.test(k)) out[k] = n;
    });
    return out;
  }
  function normStats(stats) {
    stats = stats || {};
    const wins = Math.max(0, stats.wins | 0);
    const losses = Math.max(0, stats.losses | 0);
    const games = Math.max(stats.games | 0, wins + losses);
    const streak = Math.max(0, stats.streak | 0);
    const best = Math.max(streak, stats.bestStreak | 0);
    return {
      wins, losses, games, streak,
      bestStreak: best,
      packsOpened: Math.max(0, stats.packsOpened | 0),
      auctionsSold: Math.max(0, stats.auctionsSold | 0),
      auctionsWon: Math.max(0, stats.auctionsWon | 0),
      decks: normMap(stats.decks),
      archetypes: normMap(stats.archetypes),
    };
  }
  function normNames(list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach(name => {
      const n = String(name || '').trim();
      const key = n.toLowerCase();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(n) || seen.has(key)) return;
      seen.add(key);
      out.push(n);
    });
    return out.slice(0, 40);
  }
  function normIds(list) {
    const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
    const out = [];
    (list || []).forEach(id => {
      if (!cards || !cards[id] || out.includes(id)) return;
      out.push(id);
    });
    return out.slice(0, 6);
  }
  function normCollection(list) {
    const cards = root.TOB_CARDS && root.TOB_CARDS.CARDS;
    const out = [];
    (list || []).forEach(rec => {
      if (!rec || !cards || !cards[rec.id]) return;
      out.push({id: rec.id, gold: !!rec.gold, uid: String(rec.uid || ('c' + out.length + '-' + rec.id))});
    });
    return out;
  }
  /* Usernames that are admins. No passwords live here. Compared trim + case-insensitive. */
  const ADMIN_USERNAMES = ['mjmasters91', 'sender'];
  function adminKey(name) {
    return String(name || '').trim().toLowerCase();
  }
  function isListedAdmin(name) {
    return ADMIN_USERNAMES.indexOf(adminKey(name)) !== -1;
  }
  function packProfile(profile, username) {
    profile = profile || {};
    const granted = profile.welcomeGranted === true;
    let packs = Math.max(0, profile.packs | 0);
    if (!granted) packs += 3;
    const name = String(username || profile.username || '').trim();
    const lower = adminKey(name);
    let role = profile.role === 'admin' || profile.role === 'player' ? profile.role : '';
    if (!role) role = isListedAdmin(name) ? 'admin' : 'player';
    if (isListedAdmin(name)) role = 'admin';
    if (lower === 'guest') role = 'player';
    return {
      username: name,
      createdAt: profile.createdAt || new Date().toISOString(),
      starterDeck: profile.starterDeck || null,
      stats: normStats(profile.stats),
      collection: normCollection(profile.collection),
      avatar: (root.TOB_CARDS && root.TOB_CARDS.CARDS && root.TOB_CARDS.CARDS[profile.avatar]) ? profile.avatar : null,
      showcase: normIds(profile.showcase),
      friends: normNames(profile.friends),
      packs,
      coins: Math.max(0, profile.coins | 0),
      role,
      welcomeGranted: true,
      lastDaily: typeof profile.lastDaily === 'string' ? profile.lastDaily : null,
    };
  }
  function emptyProfile(username) {
    return packProfile({createdAt: new Date().toISOString(), starterDeck: null, stats: {wins: 0, losses: 0, games: 0}, collection: []}, username);
  }
  function validateUsername(username) {
    const name = String(username || '').trim();
    if (!name) return {error: 'Enter a username.'};
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return {error: 'Use 3–16 letters, numbers, or underscores.'};
    if (name.toLowerCase() === 'guest') return {error: 'That username is reserved.'};
    return {username: name};
  }
  function validatePassword(password) {
    const pass = String(password || '');
    if (!pass) return {error: 'Enter a password.'};
    if (pass.length < 6) return {error: 'Password needs at least 6 characters.'};
    if (pass.length > 128) return {error: 'Password needs to be 128 characters or fewer.'};
    return {password: pass};
  }
  async function pbkdf2(password, salt, iterations) {
    if (!root.crypto || !root.crypto.subtle) {
      throw new Error('no-subtle');
    }
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations, hash: 'SHA-256'}, key, 256);
    return new Uint8Array(bits);
  }
  function cryptoError() {
    return {ok: false, error: 'This browser can’t store a password safely. Try a current version of Chrome, Firefox, or Safari.'};
  }
  function readAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAccounts(data) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(data));
  }

  /* Required surface. Providers implement every method. currentUser is sync. */
  class AuthProvider {
    signUp() { return Promise.reject(new Error('signUp is not implemented')); }
    logIn() { return Promise.reject(new Error('logIn is not implemented')); }
    logOut() { return Promise.reject(new Error('logOut is not implemented')); }
    currentUser() { return null; }
    loadProfile() { return Promise.resolve(null); }
    saveProfile() { return Promise.reject(new Error('saveProfile is not implemented')); }
    searchUsers() { return Promise.resolve([]); }
    loadPublicProfile() { return Promise.resolve(null); }
    listFriends() { return Promise.resolve([]); }
    addFriend() { return Promise.resolve({ok: false, error: 'Friends are not available.'}); }
    removeFriend() { return Promise.resolve({ok: false, error: 'Friends are not available.'}); }
  }

  class LocalAuthProvider extends AuthProvider {
    constructor() {
      super();
      this._key = null;
      this._user = null;
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved && readAccounts()[saved]) this._adopt(saved);
      this.ready = Promise.resolve();
      this.initError = '';
    }
    _adopt(key) {
      const rec = readAccounts()[key];
      if (!rec) { this._key = null; this._user = null; return; }
      this._key = key;
      this._user = {username: rec.username, id: key};
    }
    currentUser() { return this._user ? {username: this._user.username, id: this._user.id} : null; }
    async signUp({username, password}) {
      const name = validateUsername(username);
      if (name.error) return {ok: false, error: name.error};
      const pass = validatePassword(password);
      if (pass.error) return {ok: false, error: pass.error};
      const key = name.username.toLowerCase();
      const accounts = readAccounts();
      if (accounts[key]) return {ok: false, error: 'That username is taken.'};
      let salt, hash;
      try {
        salt = crypto.getRandomValues(new Uint8Array(16));
        hash = await pbkdf2(pass.password, salt, ITER);
      } catch (e) { return cryptoError(); }
      accounts[key] = {
        username: name.username,
        salt: hex(salt),
        hash: hex(hash),
        iterations: ITER,
        profile: emptyProfile(name.username),
      };
      try { writeAccounts(accounts); }
      catch (e) { return {ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}; }
      localStorage.setItem(SESSION_KEY, key);
      this._adopt(key);
      return {ok: true, user: this.currentUser()};
    }
    async logIn({username, password}) {
      const name = validateUsername(username);
      if (name.error) return {ok: false, error: name.error};
      const pass = validatePassword(password);
      if (pass.error) return {ok: false, error: pass.error === 'Enter a password.' ? pass.error : 'Wrong password.'};
      const key = name.username.toLowerCase();
      const rec = readAccounts()[key];
      let hash;
      try {
        const salt = rec ? fromHex(rec.salt) : new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        hash = await pbkdf2(pass.password, salt, rec && rec.iterations ? rec.iterations : ITER);
      } catch (e) { return cryptoError(); }
      if (!rec) return {ok: false, error: 'No account with that username.'};
      if (!sameBytes(hash, fromHex(rec.hash))) return {ok: false, error: 'Wrong password.'};
      try { localStorage.setItem(SESSION_KEY, key); }
      catch (e) { return {ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}; }
      this._adopt(key);
      return {ok: true, user: this.currentUser()};
    }
    async logOut() {
      localStorage.removeItem(SESSION_KEY);
      this._key = null;
      this._user = null;
      return {ok: true};
    }
    async loadProfile() {
      if (!this._key) return null;
      const rec = readAccounts()[this._key];
      return rec ? clone(rec.profile) : null;
    }
    async searchUsers(username) {
      const key = String(username || '').trim().toLowerCase();
      if (!key) return [];
      const rec = readAccounts()[key];
      return rec ? [{username: rec.username, id: key}] : [];
    }
    async loadPublicProfile(username) {
      const key = String(username || '').trim().toLowerCase();
      if (key === 'guest') {
        const guest = readGuest();
        return guest ? clone(guest) : null;
      }
      const rec = readAccounts()[key];
      return rec ? clone(rec.profile) : null;
    }
    async listFriends() {
      const profile = await this.loadProfile();
      return (profile && profile.friends) || [];
    }
    async addFriend(username) {
      const found = await this.searchUsers(username);
      if (!found.length) return {ok: false, error: 'No account with that username on this device.'};
      const me = this.currentUser();
      if (me && found[0].username.toLowerCase() === me.username.toLowerCase()) return {ok: false, error: 'That’s you.'};
      const profile = await this.loadProfile();
      if (!profile) return {ok: false, error: 'Log in first.'};
      if ((profile.friends || []).some(f => f.toLowerCase() === found[0].username.toLowerCase())) return {ok: false, error: 'Already friends.'};
      profile.friends = (profile.friends || []).concat([found[0].username]);
      return this.saveProfile(profile);
    }
    async removeFriend(username) {
      const profile = await this.loadProfile();
      if (!profile) return {ok: false, error: 'Log in first.'};
      const key = String(username || '').trim().toLowerCase();
      profile.friends = (profile.friends || []).filter(f => f.toLowerCase() !== key);
      return this.saveProfile(profile);
    }
    async saveProfile(profile) {
      if (!this._key) return {ok: false, error: 'Log in first.'};
      const accounts = readAccounts();
      const rec = accounts[this._key];
      if (!rec) return {ok: false, error: 'Log in first.'};
      const createdAt = (rec.profile && rec.profile.createdAt) || (profile && profile.createdAt) || new Date().toISOString();
      rec.profile = packProfile(profile, rec.username);
      rec.profile.createdAt = createdAt;
      try { writeAccounts(accounts); }
      catch (e) { return {ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}; }
      return {ok: true};
    }
  }

  /* SUPABASE AUTH PROVIDER
     ----------------------------------------------------------------
     Dormant unless supabase-config.js sets url and anonKey.
     Email + password go through supabase-js. The profile and the
     collection live in public.profiles, protected by row-level security
     (see README). Nothing here runs while the config values are empty.
     ---------------------------------------------------------------- */
  function playerEmail(username) {
    return String(username || '').trim().toLowerCase() + '@players.toonorbit.app';
  }
  class SupabaseAuthProvider extends AuthProvider {
    constructor(client) {
      super();
      this.client = client;
      this.user = null;
      this.username = '';
      this.initError = '';
      this.ready = this._init();
    }
    async _init() {
      try {
        const {data, error} = await this.client.auth.getSession();
        if (error) throw error;
        this.user = data.session && data.session.user || null;
        if (this.user) {
          const profile = await this.loadProfile();
          this.username = (profile && profile.username) || (this.user.user_metadata && this.user.user_metadata.username) || '';
        }
        this.client.auth.onAuthStateChange((_event, session) => {
          this.user = session && session.user || null;
          if (!this.user) this.username = '';
        });
      } catch (e) {
        this.initError = 'Could not reach the account service. You appear to be offline.';
      }
    }
    currentUser() {
      if (!this.user) return null;
      return {username: this.username || (this.user.user_metadata && this.user.user_metadata.username) || 'Player', id: this.user.id, email: this.user.email || ''};
    }
    _friendly(error) {
      const msg = (error && (error.message || error.error_description || error.details)) || 'Something went wrong. Try again.';
      if (/failed to fetch|network|offline|load failed/i.test(msg)) return 'You appear to be offline.';
      if (/invalid login|invalid credentials/i.test(msg)) return 'Wrong username or password.';
      if (/already registered|already been registered|user already/i.test(msg)) return 'That username is taken.';
      if (error && (error.code === '23505' || /duplicate|unique/i.test(msg))) return 'That username is taken.';
      if (/email not confirmed/i.test(msg)) return 'Turn off Confirm email in the Supabase Auth settings, then try again.';
      return msg;
    }
    async _rpc(name, args) {
      const {data, error} = await this.client.rpc(name, args || {});
      if (error) return {ok: false, error: this._friendly(error)};
      return {ok: true, data: data};
    }
    async signUp({username, password}) {
      if (this.initError || !this.client) return {ok: false, error: this.initError || 'Accounts are not available right now.'};
      const name = validateUsername(username);
      if (name.error) return {ok: false, error: name.error};
      const pass = validatePassword(password);
      if (pass.error) return {ok: false, error: pass.error};
      const {data, error} = await this.client.auth.signUp({
        email: playerEmail(name.username),
        password: pass.password,
        options: {data: {username: name.username}},
      });
      if (error) return {ok: false, error: this._friendly(error)};
      if (!data.session) {
        return {ok: false, error: 'Turn off Confirm email in the Supabase Auth settings, then sign up again.'};
      }
      this.user = data.user;
      this.username = name.username;
      return {ok: true, user: this.currentUser()};
    }
    async logIn({username, password}) {
      if (this.initError || !this.client) return {ok: false, error: this.initError || 'Accounts are not available right now.'};
      const name = validateUsername(username);
      if (name.error) return {ok: false, error: name.error};
      const pass = validatePassword(password);
      if (pass.error) return {ok: false, error: pass.error === 'Enter a password.' ? pass.error : 'Wrong username or password.'};
      const {data, error} = await this.client.auth.signInWithPassword({
        email: playerEmail(name.username),
        password: pass.password,
      });
      if (error) return {ok: false, error: this._friendly(error)};
      this.user = data.user;
      const profile = await this.loadProfile();
      this.username = (profile && profile.username) || name.username;
      return {ok: true, user: this.currentUser()};
    }
    async logOut() {
      if (this.client) await this.client.auth.signOut();
      this.user = null;
      this.username = '';
      return {ok: true};
    }
    _expand(rows) {
      const out = [];
      (rows || []).forEach(row => {
        const n = Math.max(0, row.count | 0);
        const gold = !!row.gold;
        const id = row.card_id;
        for (let i = 0; i < n; i++) out.push({id, gold, uid: id + (gold ? ':g:' : ':s:') + i});
      });
      return out;
    }
    async loadProfile() {
      if (!this.user || !this.client) return null;
      const {data, error} = await this.client.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
      if (error || !data) return null;
      this.username = data.username || this.username;
      const cards = await this.client.from('collection').select('card_id,gold,count').eq('user_id', this.user.id);
      const decks = await this.client.from('decks').select('name,cards').eq('user_id', this.user.id);
      const friends = await this._rpc('my_friends');
      const custom = ((decks.data) || []).find(row => row.name === 'custom');
      if (custom && Array.isArray(custom.cards)) {
        try { localStorage.setItem('tob_custom', JSON.stringify(custom.cards)); } catch (e) { /* ignore */ }
      }
      return packProfile({
        username: data.username,
        createdAt: data.created_at,
        starterDeck: data.starter_deck || null,
        stats: {
          wins: data.wins, losses: data.losses, games: data.games,
          streak: data.streak, bestStreak: data.best_streak, packsOpened: data.packs_opened,
          auctionsSold: data.auctions_sold, auctionsWon: data.auctions_won,
        },
        collection: cards.error ? [] : this._expand(cards.data),
        avatar: data.avatar,
        showcase: data.showcase,
        friends: friends.ok && Array.isArray(friends.data) ? friends.data.map(row => row.username) : [],
        packs: data.unopened_packs,
        coins: data.coins,
        role: data.role,
        welcomeGranted: true,
        lastDaily: data.last_daily,
      }, data.username);
    }
    async loadPublicProfile(username) {
      if (!this.client) return null;
      const name = String(username || '').trim();
      if (!name) return null;
      const {data, error} = await this.client.from('public_profiles').select('*').ilike('username', name).maybeSingle();
      if (error || !data) return null;
      return packProfile({
        username: data.username,
        stats: {wins: data.wins, losses: data.losses, games: (data.wins | 0) + (data.losses | 0)},
        showcase: data.showcase,
        avatar: data.avatar,
        collection: [],
        role: 'player',
        welcomeGranted: true,
        packs: 0,
        coins: 0,
      }, data.username);
    }
    async searchUsers(username) {
      if (!this.client) return [];
      const name = String(username || '').trim();
      if (!name) return [];
      const {data, error} = await this.client.from('public_profiles').select('id, username').ilike('username', name).limit(5);
      if (error || !data) return [];
      return data.map(row => ({username: row.username, id: row.id}));
    }
    async listFriends() {
      const res = await this._rpc('my_friends');
      if (!res.ok || !Array.isArray(res.data)) return [];
      return res.data.map(row => row.username);
    }
    addFriend(username) { return this._rpc('send_friend_request', {p_username: username}); }
    removeFriend(username) { return this._rpc('remove_friend', {p_username: username}); }
    async saveProfile(profile) {
      if (!this.user || !this.client) return {ok: false, error: 'Log in first.'};
      const avatar = await this._rpc('set_avatar', {p_card: profile && profile.avatar || ''});
      if (!avatar.ok) return avatar;
      const showcase = await this._rpc('set_showcase', {p_ids: (profile && profile.showcase) || []});
      if (!showcase.ok) return showcase;
      return {ok: true};
    }
    chooseStarter(deck) { return this._rpc('choose_starter', {p_deck: deck}); }
    buyPack() { return this._rpc('buy_pack'); }
    claimDaily() { return this._rpc('claim_daily'); }
    openPack(mode, theme) { return this._rpc('open_pack', {p_mode: mode, p_theme: theme || null}); }
    recordMatch(result, deck) { return this._rpc('record_match_result', {p_result: result, p_deck: deck || null}); }
    saveDeck(cards) { return this._rpc('save_deck', {p_name: 'custom', p_cards: cards || []}); }
  }

  const cfg = root.TOB_SUPABASE || {};
  let provider = new LocalAuthProvider();
  let modeName = 'local';
  let onlineSoon = false;
  let guestOn = false;

  function readGuest() {
    try { return JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function currentUser() {
    if (guestOn) return {username: 'Guest', guest: true, id: 'guest'};
    const user = provider.currentUser();
    if (!user) return null;
    return {username: user.username, guest: false, id: user.id, email: user.email || null};
  }
  async function ensureBootstrapAdmin() {
    const user = currentUser();
    if (!user || user.guest || !isListedAdmin(user.username)) return;
    const profile = await provider.loadProfile();
    if (!profile) return;
    const clean = String(profile.username || user.username).trim();
    if (profile.role === 'admin' && profile.username === clean) return;
    profile.role = 'admin';
    profile.username = clean;
    await provider.saveProfile(profile);
  }
  const ready = (async () => {
    try { await provider.ready; } catch (e) { /* local auth still works */ }
    if (cfg.url && cfg.anonKey && root.supabase && root.supabase.createClient) {
      try {
        const client = root.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false},
        });
        const probe = await client.from('profiles').select('id').limit(1);
        const msg = probe.error ? ((probe.error.message || '') + ' ' + (probe.error.code || '')) : '';
        const missing = /PGRST205|42P01|schema cache|does not exist|Could not find the table/i.test(msg);
        const offline = /Failed to fetch|NetworkError|Load failed/i.test(msg);
        const present = !probe.error || /42501|permission denied/i.test(msg);
        if (present && !missing && !offline) {
          const remoteProvider = new SupabaseAuthProvider(client);
          await remoteProvider.ready;
          if (!remoteProvider.initError) {
            provider = remoteProvider;
            modeName = 'supabase';
            if (root.TOB_BIND_AUCTIONS) root.TOB_BIND_AUCTIONS(client);
            const settings = await client.from('settings').select('key,value');
            if (settings.data) {
              const map = {};
              settings.data.forEach(row => { map[row.key] = row.value; });
              root.TOB_ECONOMY_REMOTE = map;
            }
          } else onlineSoon = true;
        } else onlineSoon = true;
      } catch (e) {
        onlineSoon = true;
      }
    }
    if (provider.currentUser()) guestOn = false;
    else guestOn = localStorage.getItem(GUEST_FLAG) === '1';
    if (modeName !== 'supabase') {
      try { await ensureBootstrapAdmin(); } catch (e) { /* stay on the sign-in screen */ }
    }
  })().catch(() => { guestOn = localStorage.getItem(GUEST_FLAG) === '1'; });

  root.TOB_AUTH = {
    get mode() { return modeName; },
    get onlineSoon() { return onlineSoon; },
    get providerName() { return modeName === 'supabase' ? 'SupabaseAuthProvider' : 'LocalAuthProvider'; },
    ready,
    get initError() { return provider.initError || ''; },
    signUp(creds) {
      return provider.signUp(creds).then(res => {
        if (res && res.ok) {
          guestOn = false;
          localStorage.removeItem(GUEST_FLAG);
        }
        return res;
      });
    },
    logIn(creds) {
      return provider.logIn(creds).then(async res => {
        if (res && res.ok) {
          guestOn = false;
          localStorage.removeItem(GUEST_FLAG);
          try { await ensureBootstrapAdmin(); } catch (e) { /* the account still opens */ }
        }
        return res;
      });
    },
    async logOut() {
      guestOn = false;
      localStorage.removeItem(GUEST_FLAG);
      if (provider.currentUser()) await provider.logOut();
      return {ok: true};
    },
    currentUser,
    loadProfile() {
      if (guestOn) return Promise.resolve(clone(readGuest()));
      return provider.loadProfile();
    },
    saveProfile(profile) {
      if (guestOn) {
        const packed = packProfile(profile, 'Guest');
        try { localStorage.setItem(GUEST_KEY, JSON.stringify(packed)); }
        catch (e) { return Promise.resolve({ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}); }
        return Promise.resolve({ok: true});
      }
      return provider.saveProfile(profile);
    },
    searchUsers(username) { return provider.searchUsers(username); },
    loadPublicProfile(username) {
      const key = String(username || '').trim().toLowerCase();
      if (key === 'guest') return Promise.resolve(clone(readGuest()));
      return provider.loadPublicProfile(username);
    },
    async listFriends() {
      if (guestOn) {
        const guest = readGuest();
        return (guest && guest.friends) || [];
      }
      return provider.listFriends();
    },
    async addFriend(username) {
      if (!guestOn) return provider.addFriend(username);
      const found = await provider.searchUsers(username);
      if (!found.length) return {ok: false, error: 'No account with that username on this device.'};
      const guest = readGuest() || emptyProfile('Guest');
      if ((guest.friends || []).some(f => f.toLowerCase() === found[0].username.toLowerCase())) return {ok: false, error: 'Already friends.'};
      guest.friends = (guest.friends || []).concat([found[0].username]);
      return this.saveProfile(guest);
    },
    async removeFriend(username) {
      if (!guestOn) return provider.removeFriend(username);
      const guest = readGuest();
      if (!guest) return {ok: false, error: 'Log in first.'};
      const key = String(username || '').trim().toLowerCase();
      guest.friends = (guest.friends || []).filter(f => f.toLowerCase() !== key);
      return this.saveProfile(guest);
    },
    async playAsGuest() {
      if (provider.currentUser()) await provider.logOut();
      let profile = readGuest();
      if (!profile) profile = emptyProfile('Guest');
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(packProfile(profile, 'Guest')));
        localStorage.setItem(GUEST_FLAG, '1');
      } catch (e) {
        return Promise.resolve({ok: false, error: 'This browser blocked saving. Check storage settings and try again.'});
      }
      guestOn = true;
      return Promise.resolve({ok: true, user: currentUser()});
    },
    peekGuest() { return clone(readGuest()); },
    clearGuest() { localStorage.removeItem(GUEST_KEY); },
    listProfiles() {
      const accounts = readAccounts();
      const list = Object.keys(accounts).map(k => clone(accounts[k].profile)).filter(Boolean);
      const guest = readGuest();
      if (guest) list.push(clone(guest));
      list.sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')));
      return list;
    },
    rpc(name, args) {
      if (modeName !== 'supabase' || !provider._rpc) return Promise.resolve({ok: false, error: 'Online accounts are not on yet.'});
      return provider._rpc(name, args);
    },
    chooseStarter(deck) { return modeName === 'supabase' ? provider.chooseStarter(deck) : Promise.resolve({ok: true}); },
    buyPack() { return provider.buyPack(); },
    claimDaily() { return provider.claimDaily(); },
    openPack(mode, theme) { return provider.openPack(mode, theme); },
    recordMatch(result, deck) { return provider.recordMatch(result, deck); },
    saveDeck(cards) { return provider.saveDeck(cards); },
    adminSave(username, profile) {
      const name = String(username || '');
      if (name.toLowerCase() === 'guest') {
        const packed = packProfile(profile, 'Guest');
        try { localStorage.setItem(GUEST_KEY, JSON.stringify(packed)); }
        catch (e) { return {ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}; }
        return {ok: true, profile: packed};
      }
      const accounts = readAccounts();
      const key = name.toLowerCase();
      if (!accounts[key]) return {ok: false, error: 'No player with that name.'};
      const packed = packProfile(profile, accounts[key].username);
      accounts[key].profile = packed;
      try { writeAccounts(accounts); }
      catch (e) { return {ok: false, error: 'This browser blocked saving. Check storage settings and try again.'}; }
      return {ok: true, profile: packed};
    },
  };
})(this);
