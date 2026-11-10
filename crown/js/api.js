import { logInAccount, logOutAccount, rpc, signUpAccount } from "./account.js";
import { emptyBuildings, emptyResearch, emptyUnits } from "./rules.js";

function ms(value) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function mapKingdom(row) {
  if (!row) return null;
  return {
    version: 1,
    id: row.id,
    name: row.name,
    landType: row.land_type,
    realmName: row.realm_name,
    realmSeat: row.realm_seat,
    realmId: row.realm_id,
    realmCount: row.realm_count,
    isNpc: false,
    createdAt: ms(row.created_at || row.last_tick_at),
    lastTickAt: ms(row.last_tick_at),
    exploreResetAt: ms(row.explore_reset_at),
    exploredToday: row.explored_today,
    nextJobId: 1,
    gold: row.gold,
    goldBank: row.gold_bank,
    food: row.food,
    foodBank: row.food_bank,
    mana: row.mana,
    manaBank: row.mana_bank,
    researchPoints: row.research_points,
    researchBank: row.research_bank,
    popProgress: row.pop_progress,
    peasants: row.peasants,
    land: row.land,
    buildings: { ...emptyBuildings(), ...(row.buildings || {}) },
    units: { ...emptyUnits(), ...(row.units || {}) },
    research: { ...emptyResearch(), ...(row.research || {}) },
    jobs: (row.jobs || []).map((job) => ({
      id: job.id,
      kind: job.kind,
      building: job.building,
      unit: job.unit,
      count: job.count,
      settlers: job.settlers,
      startedAt: ms(job.started_at),
      completesAt: ms(job.completes_at),
    })),
    chronicle: (row.chronicle || []).map((line) => ({ at: ms(line.at), text: line.text })),
  };
}

export function mapPayload(payload) {
  return {
    player: {
      username: payload?.player?.username || "",
      admin: Boolean(payload?.player?.admin),
      banned: Boolean(payload?.player?.banned),
      banReason: payload?.player?.ban_reason || "",
    },
    kingdom: mapKingdom(payload?.kingdom),
    behind: Boolean(payload?.behind),
  };
}

async function follow(first) {
  if (!first.ok) return first;
  let data = first.data;
  let hops = 0;
  while (data?.behind && hops < 6) {
    const again = await rpc("cc_get_state");
    if (!again.ok) return again;
    data = again.data;
    hops += 1;
  }
  return { ok: true, ...mapPayload(data) };
}

export async function openKingdom() {
  return follow(await rpc("cc_ensure_player"));
}

export async function refreshKingdom() {
  return follow(await rpc("cc_get_state"));
}

export async function createOnlineKingdom(name, landType) {
  return follow(await rpc("cc_create_kingdom", { p_name: name, p_land_type: landType }));
}

export async function buildOnline(building, count) {
  return follow(await rpc("cc_build", { p_building: building, p_count: count }));
}

export async function exploreOnline(acres) {
  return follow(await rpc("cc_explore", { p_acres: acres }));
}

export async function trainOnline(unit, count) {
  return follow(await rpc("cc_train", { p_unit: unit, p_count: count }));
}

export async function researchOnline(track) {
  return follow(await rpc("cc_research", { p_track: track }));
}

export async function realmOnline() {
  const res = await rpc("cc_realm");
  if (!res.ok) return res;
  return { ok: true, realm: res.data.realm, kingdoms: res.data.kingdoms || [] };
}

export async function leaderboardOnline() {
  const res = await rpc("cc_leaderboard");
  if (!res.ok) return res;
  return { ok: true, kingdoms: res.data.kingdoms || [] };
}

export async function adminSearchOnline(query) {
  return rpc("cc_admin_search", { p_query: query || "" });
}

export async function adminGrantOnline({ name, gold, food, land, note }) {
  return rpc("cc_admin_grant", {
    p_name: name,
    p_gold: gold,
    p_food: food,
    p_land: land,
    p_note: note || "",
  });
}

export async function adminBanOnline(username, reason) {
  return rpc("cc_admin_ban", { p_username: username, p_reason: reason });
}

export async function adminUnbanOnline(username) {
  return rpc("cc_admin_unban", { p_username: username });
}

export async function adminLogOnline() {
  return rpc("cc_admin_log");
}

export { logInAccount, logOutAccount, signUpAccount };
