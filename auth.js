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
  function normStats(stats) {
    stats = stats || {};
    return {
      wins: stats.wins | 0,
      losses: stats.losses | 0,
      games: stats.games | 0,
    };
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
  /* Usernames that become admin when the account is first created. No passwords live here. */
  const ADMIN_USERNAMES = ['mjmasters91', 'sender'];
  function packProfile(profile, username) {
    profile = profile || {};
    const granted = profile.welcomeGranted === true;
    let packs = Math.max(0, profile.packs | 0);
    if (!granted) packs += 3;
    const name = username || profile.username || '';
    const lower = name.toLowerCase();
    let role = profile.role === 'admin' || profile.role === 'player' ? profile.role : '';
    if (!role) role = ADMIN_USERNAMES.indexOf(lower) !== -1 ? 'admin' : 'player';
    if (lower === 'guest') role = 'player';
    return {
      username: name,
      createdAt: profile.createdAt || new Date().toISOString(),
      starterDeck: profile.starterDeck || null,
      stats: normStats(profile.stats),
      collection: normCollection(profile.collection),
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
  class SupabaseAuthProvider extends AuthProvider {
    constructor(cfg) {
      super();
      this.cfg = cfg;
      this.client = null;
      this.user = null;
      this.username = '';
      this.initError = '';
      this.ready = this._init();
    }
    async _init() {
      try {
        const mod = await import('https://esm.sh/@supabase/supabase-js@2');
        this.client = mod.createClient(this.cfg.url, this.cfg.anonKey);
        const {data, error} = await this.client.auth.getSession();
        if (error) throw error;
        this.user = data.session && data.session.user || null;
        if (this.user) {
          const profile = await this.loadProfile();
          this.username = (profile && profile.username) || (this.user.user_metadata && this.user.user_metadata.username) || '';
        }
      } catch (e) {
        this.initError = 'Could not reach the account service. Check the Supabase URL and key.';
      }
    }
    currentUser() {
      if (!this.user) return null;
      return {username: this.username || this.user.email || 'Player', id: this.user.id, email: this.user.email || ''};
    }
    _friendly(error) {
      const msg = (error && (error.message || error.error_description)) || 'Something went wrong. Try again.';
      if (error && (error.code === '23505' || /duplicate|unique/i.test(msg))) return 'That username is taken.';
      if (/invalid login/i.test(msg)) return 'Wrong email or password.';
      if (/already registered/i.test(msg)) return 'That email is already registered.';
      return msg;
    }
    async signUp({email, password, username}) {
      if (this.initError || !this.client) return {ok: false, error: this.initError || 'Accounts are not available right now.'};
      const mail = String(email || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return {ok: false, error: 'Enter a valid email.'};
      const name = validateUsername(username);
      if (name.error) return {ok: false, error: name.error};
      const pass = validatePassword(password);
      if (pass.error) return {ok: false, error: pass.error};
      const {data, error} = await this.client.auth.signUp({
        email: mail,
        password: pass.password,
        options: {data: {username: name.username}},
      });
      if (error) return {ok: false, error: this._friendly(error)};
      if (!data.session) {
        return {ok: false, error: 'Confirm your email, then log in. For instant play, turn off email confirmation in the Supabase project.'};
      }
      this.user = data.user;
      this.username = name.username;
      const row = {
        id: data.user.id,
        username: name.username,
        starter_deck: null,
        stats: {wins: 0, losses: 0, games: 0, packs: 3, coins: 0, role: 'player', welcomeGranted: true, lastDaily: null},
        collection: [],
      };
      const ins = await this.client.from('profiles').insert(row);
      if (ins.error) return {ok: false, error: this._friendly(ins.error)};
      return {ok: true, user: this.currentUser()};
    }
    async logIn({email, password}) {
      if (this.initError || !this.client) return {ok: false, error: this.initError || 'Accounts are not available right now.'};
      const mail = String(email || '').trim();
      const pass = validatePassword(password);
      if (!mail) return {ok: false, error: 'Enter your email.'};
      if (pass.error) return {ok: false, error: pass.error === 'Enter a password.' ? pass.error : 'Wrong email or password.'};
      const {data, error} = await this.client.auth.signInWithPassword({email: mail, password: pass.password});
      if (error) return {ok: false, error: this._friendly(error)};
      this.user = data.user;
      const profile = await this.loadProfile();
      this.username = (profile && profile.username) || (data.user.user_metadata && data.user.user_metadata.username) || mail;
      return {ok: true, user: this.currentUser()};
    }
    async logOut() {
      if (this.client) await this.client.auth.signOut();
      this.user = null;
      this.username = '';
      return {ok: true};
    }
    async loadProfile() {
      if (!this.user || !this.client) return null;
      const {data, error} = await this.client.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
      if (error || !data) return null;
      this.username = data.username || this.username;
      const stats = data.stats || {};
      return {
        username: data.username,
        createdAt: data.created_at,
        starterDeck: data.starter_deck || null,
        stats: normStats(stats),
        collection: normCollection(data.collection),
        packs: stats.packs | 0,
        coins: stats.coins | 0,
        role: stats.role === 'admin' || stats.role === 'player' ? stats.role : undefined,
        welcomeGranted: stats.welcomeGranted === true,
        lastDaily: typeof stats.lastDaily === 'string' ? stats.lastDaily : null,
      };
    }
    async saveProfile(profile) {
      if (!this.user || !this.client) return {ok: false, error: 'Log in first.'};
      const packed = packProfile(profile, this.username || profile.username);
      const {error} = await this.client.from('profiles').update({
        username: packed.username,
        starter_deck: packed.starterDeck,
        stats: {
          wins: packed.stats.wins, losses: packed.stats.losses, games: packed.stats.games,
          packs: packed.packs, coins: packed.coins, role: packed.role, welcomeGranted: true, lastDaily: packed.lastDaily,
        },
        collection: packed.collection,
      }).eq('id', this.user.id);
      if (error) return {ok: false, error: this._friendly(error)};
      this.username = packed.username;
      return {ok: true};
    }
  }

  const cfg = root.TOB_SUPABASE || {};
  const remote = !!(cfg.url && cfg.anonKey);
  const provider = remote ? new SupabaseAuthProvider(cfg) : new LocalAuthProvider();
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
  const ready = Promise.resolve(provider.ready).then(() => {
    if (provider.currentUser()) guestOn = false;
    else guestOn = localStorage.getItem(GUEST_FLAG) === '1';
  }).catch(() => { guestOn = false; });

  root.TOB_AUTH = {
    mode: remote ? 'supabase' : 'local',
    providerName: remote ? 'SupabaseAuthProvider' : 'LocalAuthProvider',
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
      return provider.logIn(creds).then(res => {
        if (res && res.ok) {
          guestOn = false;
          localStorage.removeItem(GUEST_FLAG);
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
