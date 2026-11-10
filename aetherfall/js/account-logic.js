/** Pure account helpers. No network, so the node tests can import this file. */

export const PLAYER_EMAIL_DOMAIN = "@players.toonorbit.app";

export function validateUsername(username) {
  const name = String(username || "").trim();
  if (!name) return { error: "Enter a username." };
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return { error: "Use 3-16 letters, numbers, or underscores." };
  if (name.toLowerCase() === "guest") return { error: "That username is reserved." };
  return { username: name };
}

export function validatePassword(password) {
  const pass = String(password || "");
  if (!pass) return { error: "Enter a password." };
  if (pass.length < 6) return { error: "Password needs at least 6 characters." };
  if (pass.length > 128) return { error: "Password needs to be 128 characters or fewer." };
  return { password: pass };
}

export function playerEmail(username) {
  return String(username || "").trim().toLowerCase() + PLAYER_EMAIL_DOMAIN;
}

export function migrationMissing(error) {
  const message = String(error?.message || error || "");
  const code = String(error?.code || "");
  return /PGRST202|PGRST205|42883|42P01|does not exist|Could not find the function|schema cache/i.test(`${code} ${message}`);
}

export function banReasonFrom(error) {
  const message = String(error?.message || error || "");
  const match = message.match(/banned:\s*(.*)$/i);
  if (!match && !/banned/i.test(message)) return null;
  return (match?.[1] || "").trim() || "No reason was recorded.";
}

export function mapServerState(payload, muted = false) {
  const player = payload?.player;
  if (!player) throw new Error("missing player");
  const units = {};
  for (const row of payload.units || []) {
    if (!row?.unit_id) continue;
    units[row.unit_id] = {
      owned: true,
      level: row.level,
      awaken: row.awaken,
      shards: row.shards,
    };
  }
  const party = [null, null, null, null];
  const incoming = Array.isArray(player.party) ? player.party : [];
  for (let i = 0; i < 4; i++) party[i] = incoming[i] || null;
  return {
    version: 1,
    gems: player.gems,
    gold: player.gold,
    tickets: player.tickets,
    muted: Boolean(muted),
    leader: player.leader,
    pity: {
      wanderer: player.pity_wanderer,
      cinders: player.pity_cinders,
    },
    units,
    party,
    username: player.username,
    admin: Boolean(player.admin),
  };
}

export function summonPresentation(results) {
  return (results || []).map((row) => ({
    unitId: row.unitId,
    rarity: row.rarity,
    name: row.name,
    isNew: Boolean(row.isNew),
    shardsAdded: row.shardsAdded || 0,
    awakensGained: row.awakensGained || 0,
    guaranteed: Boolean(row.guaranteed),
    pityTriggered: Boolean(row.pityTriggered),
  }));
}
