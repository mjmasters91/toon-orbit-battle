import { banReasonFrom, mapServerState, migrationMissing, playerEmail, summonPresentation, validatePassword, validateUsername } from "./account-logic.js";

const URL = "https://orbzytpukjywqkbkbtcs.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_g6lbXdi9r10i5d6TvHquaw_drhIG58X";

let client = null;

export function accountClient() {
  const lib = globalThis.supabase;
  if (!lib?.createClient) return null;
  if (!client) {
    client = lib.createClient(URL, PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

function friendlyAuth(error) {
  const msg = error?.message || "Something went wrong. Try again.";
  if (/failed to fetch|network|offline|load failed/i.test(msg)) return "You appear to be offline.";
  if (/invalid login|invalid credentials/i.test(msg)) return "Wrong username or password.";
  if (/already registered|already been registered|user already/i.test(msg)) return "That username is taken.";
  if (/email not confirmed/i.test(msg)) return "Confirm email is still on for this project. Turn it off, then try again.";
  return msg;
}

function fromRpcError(error) {
  const banned = banReasonFrom(error);
  if (banned) return { ok: false, banned: true, reason: banned, error: `This account is banned. ${banned}` };
  if (migrationMissing(error)) {
    return { ok: false, missing: true, error: "Aetherfall accounts are not on this server yet." };
  }
  return { ok: false, error: error?.message || "The server did not answer." };
}

async function rpc(name, args) {
  const db = accountClient();
  if (!db) return { ok: false, error: "The account library did not load." };
  const { data, error } = await db.rpc(name, args || {});
  if (error) return fromRpcError(error);
  return { ok: true, data };
}

export async function currentSession() {
  const db = accountClient();
  if (!db) return null;
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function signUpAccount(username, password) {
  const name = validateUsername(username);
  if (name.error) return { ok: false, error: name.error };
  const pass = validatePassword(password);
  if (pass.error) return { ok: false, error: pass.error };
  const db = accountClient();
  if (!db) return { ok: false, error: "The account library did not load." };
  const { data, error } = await db.auth.signUp({
    email: playerEmail(name.username),
    password: pass.password,
    options: { data: { username: name.username } },
  });
  if (error) return { ok: false, error: friendlyAuth(error) };
  if (!data?.session) {
    return { ok: false, error: "Confirm email is still on, so this account cannot sign in yet." };
  }
  return openSession();
}

export async function logInAccount(username, password) {
  const name = validateUsername(username);
  if (name.error) return { ok: false, error: name.error };
  const pass = validatePassword(password);
  if (pass.error) return { ok: false, error: pass.error === "Enter a password." ? pass.error : "Wrong username or password." };
  const db = accountClient();
  if (!db) return { ok: false, error: "The account library did not load." };
  const { error } = await db.auth.signInWithPassword({
    email: playerEmail(name.username),
    password: pass.password,
  });
  if (error) return { ok: false, error: friendlyAuth(error) };
  return openSession();
}

export async function logOutAccount() {
  const db = accountClient();
  if (db) await db.auth.signOut();
}

export async function openSession() {
  const ensured = await rpc("af_ensure_player");
  if (!ensured.ok) return ensured;
  return { ok: true, save: mapServerState(ensured.data), raw: ensured.data };
}

export async function summonOnline(bannerId, count) {
  const res = await rpc("af_summon", { p_banner: bannerId, p_count: count });
  if (!res.ok) return res;
  return {
    ok: true,
    save: mapServerState(res.data.state),
    presentation: summonPresentation(res.data.results),
  };
}

export async function levelOnline(unitId) {
  const res = await rpc("af_level_up", { p_unit: unitId });
  if (!res.ok) return res;
  return { ok: true, save: mapServerState(res.data) };
}

export async function partyOnline(party, leader) {
  const res = await rpc("af_set_party", { p_party: party, p_leader: leader });
  if (!res.ok) return res;
  return { ok: true, save: mapServerState(res.data) };
}

export async function clearStageOnline({ difficulty, map, stage, stars, turns, seconds }) {
  return rpc("af_clear_stage", {
    p_difficulty: difficulty,
    p_map: map,
    p_stage: stage,
    p_stars: stars,
    p_turns: turns,
    p_seconds: seconds,
  });
}

export async function getProgressOnline() {
  return rpc("af_get_progress");
}

export async function adminSearch(query) {
  return rpc("af_admin_search", { p_query: query || "" });
}

export async function adminGrant({ username, gems, gold, tickets, note }) {
  return rpc("af_admin_grant", {
    p_username: username,
    p_gems: gems,
    p_gold: gold,
    p_tickets: tickets,
    p_note: note || "",
  });
}

export async function adminBan(username, reason) {
  return rpc("af_admin_ban", { p_username: username, p_reason: reason });
}

export async function adminUnban(username) {
  return rpc("af_admin_unban", { p_username: username });
}

export async function adminLog() {
  return rpc("af_admin_log_recent");
}
