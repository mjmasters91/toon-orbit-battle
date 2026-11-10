import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { banReasonFrom, mapServerState, migrationMissing, playerEmail, summonPresentation, validatePassword, validateUsername } from "../js/account-logic.js";
import { STARTER_IDS, UNITS } from "../js/units.js";

test("usernames match the shared account rules", () => {
  assert.equal(validateUsername("mjmasters91").username, "mjmasters91");
  assert.equal(validateUsername(" Sender ").username, "Sender");
  assert.match(validateUsername("ab").error, /3-16/);
  assert.match(validateUsername("guest").error, /reserved/);
  assert.match(validateUsername("bad name").error, /underscores/);
  assert.equal(playerEmail("Sender"), "sender@players.toonorbit.app");
});

test("passwords stay in the same bounds as the other game", () => {
  assert.equal(validatePassword("secret1").password, "secret1");
  assert.match(validatePassword("").error, /password/i);
  assert.match(validatePassword("12345").error, /6/);
});

test("a missing migration is distinct from a ban", () => {
  assert.equal(migrationMissing({ code: "PGRST202", message: "Could not find the function public.af_ensure_player" }), true);
  assert.equal(migrationMissing({ message: "Not enough gems." }), false);
  assert.equal(banReasonFrom({ message: "This account is banned: duplicated tickets" }), "duplicated tickets");
  assert.equal(banReasonFrom({ message: "Not enough gems." }), null);
});

test("server state becomes the save shape without trusting extra fields", () => {
  const save = mapServerState({
    player: {
      username: "gatekeeper",
      gems: 4500,
      gold: 8000,
      tickets: 1,
      pity_wanderer: 4,
      pity_cinders: 0,
      party: ["pip", null, "tam", "puck"],
      leader: 0,
      admin: true,
    },
    units: [
      { unit_id: "pip", level: 2, awaken: 0, shards: 10 },
      { unit_id: "tam", level: 1, awaken: 1, shards: 0 },
    ],
  }, true);
  assert.equal(save.username, "gatekeeper");
  assert.equal(save.admin, true);
  assert.equal(save.pity.wanderer, 4);
  assert.equal(save.units.pip.level, 2);
  assert.deepEqual(save.party, ["pip", null, "tam", "puck"]);
  assert.equal(save.muted, true);
  const shown = summonPresentation([{ unitId: "rin", rarity: 4, name: "Rin Wisp", isNew: false, shardsAdded: 25, awakensGained: 0, guaranteed: true }]);
  assert.equal(shown[0].guaranteed, true);
  assert.equal(shown[0].shardsAdded, 25);
});

test("the migration names every unit and does not carry a secret key", () => {
  const sql = readFileSync(new URL("../sql/0001_aetherfall_accounts.sql", import.meta.url), "utf8");
  for (const unit of UNITS) assert.match(sql, new RegExp(`'${unit.id}'`));
  for (const id of STARTER_IDS) assert.match(sql, new RegExp(`'${id}'`));
  assert.match(sql, /4500/);
  assert.match(sql, /8000/);
  assert.match(sql, /mjmasters91/);
  assert.match(sql, /sender/);
  assert.match(sql, /af_summon/);
  assert.match(sql, /af_admin_log/);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /sb_secret/i);
});
