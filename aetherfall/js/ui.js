import { adminBan, adminGrant, adminLog, adminSearch, adminUnban, clearStageOnline, currentSession, getProgressOnline, levelOnline, logInAccount, logOutAccount, openSession, partyOnline, signUpAccount, summonOnline } from "./account.js";
import { renderBattleScreen, stopBattle } from "./battle-ui.js";
import { blip, powerup, rarityFanfare, resume, setMuted, summonCharge } from "./audio.js";
import { AWAKEN_COST, COST_1, COST_10, MAX_AWAKEN, MAX_LEVEL, PITY_AT } from "./balance.js";
import { icon } from "./icons.js";
import { presentView, releaseView, thumbURL } from "./present.js";
import { playSummon } from "./summon-scene.js";
import { againOffer, payForPull, pull, rateTable, resolvePull } from "./gacha.js";
import { leaderBonus, levelCost, partyPower, sortRoster, tryLevelUp, unitPower, unitStats } from "./progress.js";
import { loadSave, resetSave, writeSave } from "./save.js";
import { DIFFICULTIES, MAPS, STAGES_PER_MAP, buildEncounter, clearGold, enemyElement, firstClearGems, isBoss, isStageUnlocked, loadProgress, mapStars, progressFromRows, recommendedPower, recordClear, saveProgress, stageTitle, starsFromResult } from "./stages.js";
import { BANNERS, ELEMENT_NAME, ELEMENTS, ROLE_NAME, ROLES, UNITS, unitById } from "./units.js";

const state = {
  save: null,
  frame: 0,
  bannerId: "wanderer",
  filters: { rarity: "all", element: "all", role: "all", sort: "rarity", owned: "all" },
  partyPick: null,
  drag: null,
  results: null,
  fxStop: null,
  mode: "offline",
  username: "",
  admin: false,
  preview: new URLSearchParams(globalThis.location?.search || "").get("preview"),
  banReason: "",
  accountNote: "",
  clears: {},
  storyRemote: false,
};

let toastTimer = 0;

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (key === "class") node.className = val;
    else if (key === "text") node.textContent = String(val);
    else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2).toLowerCase(), val);
    else node.setAttribute(key, val === true ? "" : String(val));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function num(value) {
  return Number(value).toLocaleString("en-US");
}

function starRow(rarity) {
  return h("p", { class: `stars r${rarity}`, "aria-label": `${rarity} star` },
    ...Array.from({ length: rarity }, () => icon("star")),
  );
}

function go(name, extra) {
  if (state.fxStop) return;
  const next = extra ? `#/${name}/${encodeURIComponent(extra)}` : `#/${name}`;
  if (location.hash === next) draw();
  else location.hash = next;
}

function goHash(hash) {
  if (state.fxStop) return;
  if (location.hash === hash) draw({ scroll: true });
  else location.hash = hash;
}

function current() {
  if (state.preview === "login") return { name: "login" };
  if (state.preview === "hub") return { name: "home" };
  if (state.preview === "admin") return { name: "admin" };
  const hash = decodeURIComponent((location.hash || "").replace(/^#\/?/, ""));
  if (!hash || hash === "title") return { name: "title" };
  if (hash.startsWith("unit/")) return { name: "detail", id: hash.slice(5) };
  const parts = hash.split("/");
  if (parts[0] === "story") {
    const difficulty = DIFFICULTIES.includes(parts[1]) ? parts[1] : "normal";
    const map = parts[2] == null || parts[2] === "" ? null : Number(parts[2]);
    return { name: map == null || Number.isNaN(map) ? "story" : "stages", difficulty, map };
  }
  if (parts[0] === "battle") {
    return {
      name: "battle",
      difficulty: DIFFICULTIES.includes(parts[1]) ? parts[1] : "normal",
      map: Number(parts[2]),
      stage: Number(parts[3]),
    };
  }
  if (["home", "summon", "units", "party", "login", "signup", "admin", "banned"].includes(hash)) return { name: hash };
  return { name: "home" };
}

function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function thumb(id, label) {
  const img = h("img", { class: "thumb", alt: label || "", src: thumbURL(id) || "" });
  img.draggable = false;
  return img;
}

function memberById(id) {
  if (!id) return null;
  const def = unitById(id);
  const record = state.save.units[id];
  if (!def || !record?.owned) return null;
  return { def, record };
}

function rosterRows() {
  return UNITS.map((def) => {
    const record = state.save.units[def.id];
    const owned = Boolean(record?.owned);
    const stats = unitStats(def, owned ? record : { level: 1, awaken: 0 });
    return { def, record: owned ? record : null, power: unitPower(stats), stats };
  });
}

function paintAll() {}

function pill(kind, value) {
  const label = kind === "gem" ? "Aether gems" : kind === "ticket" ? "Tenfold tickets" : "Gold";
  return h("span", { class: `pill ${kind}`, "aria-label": `${label} ${value}` }, icon(kind), h("b", { text: num(value) }));
}

function chrome() {
  const el = document.getElementById("chrome");
  const route = current();
  if (route.name === "title" || route.name === "login" || route.name === "signup" || route.name === "banned") {
    el.hidden = true;
    el.replaceChildren();
    return;
  }
  el.hidden = false;
  const who = state.mode === "online" || state.preview
    ? h("div", { class: "who" },
      h("span", { class: "name", text: state.username || "Player" }),
      state.admin ? h("button", { class: "logout", type: "button", id: "open-admin", text: "Admin", onclick: () => go("admin") }) : null,
      h("button", { class: "logout", type: "button", id: "logout", text: "Logout", onclick: () => void logout() }),
    )
    : h("span", { class: "offline-tag", text: "Offline" });
  el.replaceChildren(h("header", { class: "topbar" },
    h("button", { class: "icon-btn", type: "button", "aria-label": "Home", onclick: () => go("home") }, icon("home")),
    h("div", { class: "pills" }, pill("gem", state.save.gems), pill("ticket", state.save.tickets), pill("gold", state.save.gold)),
    who,
    h("button", {
      class: "icon-btn",
      type: "button",
      id: "open-settings",
      "aria-label": "Settings",
      onclick: openSettings,
    }, icon(state.save.muted ? "mute" : "sound")),
  ));
}

function nav() {
  const el = document.getElementById("nav");
  const route = current();
  if (route.name === "title" || route.name === "login" || route.name === "signup" || route.name === "banned") {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const items = [["home", "Home", "home"], ["summon", "Summon", "summon"], ["story", "Story", "story"], ["units", "Units", "units"], ["party", "Party", "party"]];
  el.replaceChildren(...items.map(([id, label, glyph]) => h("button", {
    type: "button",
    "data-go": id,
    class: route.name === id || (id === "units" && route.name === "detail") || (id === "story" && (route.name === "stages" || route.name === "battle")) ? "active" : "",
    onclick: () => go(id),
  }, icon(glyph), h("span", { text: label }))));
}

function viewTitle() {
  const online = state.mode === "online" && state.username;
  return h("section", { class: "title-screen" },
    h("div", { class: "stage title-stage", "data-stage": "title" }),
    h("h1", { class: "wordmark", text: "Aetherfall" }),
    h("p", { class: "tag", text: "Veinwalkers of the shattered sky" }),
    online ? h("button", {
      class: "btn xl",
      id: "start",
      type: "button",
      text: `Continue as ${state.username}`,
      onclick: () => { blip(); go("home"); },
    }) : null,
    h("button", { class: "btn xl", id: "login-open", type: "button", text: "Log in", onclick: () => go("login") }),
    h("button", { class: "btn ghost", id: "signup-open", type: "button", text: "Sign up", onclick: () => go("signup") }),
    h("button", { class: "btn ghost", id: "play-offline", type: "button", text: "Play offline on this device", onclick: playOffline }),
    state.accountNote ? h("p", { class: "account-note", text: state.accountNote }) : null,
    h("button", { class: "btn ghost", type: "button", text: "Settings", onclick: openSettings }),
    h("p", { class: "fine", text: "A party of four. A gate that still answers." }),
  );
}

function partyActor(id, index) {
  if (!id || !unitById(id)) {
    return h("div", { class: "actor" }, h("p", { class: "actor-name", text: "Vacant" }));
  }
  const unit = unitById(id);
  const leader = state.save.leader === index;
  return h("figure", { class: "actor" },
    h("span", { class: leader ? "crown" : "crown ghost", text: leader ? "Leader" : "" }),
    h("figcaption", {},
      h("p", { class: "actor-name", text: unit.name }),
      starRow(unit.rarity),
    ),
  );
}

function powerBanner(members) {
  const summary = partyPower(members, state.save.leader);
  const leader = members[state.save.leader];
  const bonus = leader ? leaderBonus(leader.def.role) : null;
  return h("div", { class: "power-banner frame" },
    h("span", { text: "Party power" }),
    h("strong", { id: "party-power", text: num(summary.power) }),
    h("em", { text: bonus ? `${leader.def.name}: ${bonus.label}` : "Name a leader for a bonus" }),
  );
}

function viewHome() {
  const members = state.save.party.map(memberById);
  const leaderId = state.save.party[state.save.leader] || state.save.party.find(Boolean) || "pip";
  return h("section", { class: "screen" },
    previewNote(),
    state.mode === "offline" && !state.preview ? h("p", { class: "account-note", text: "Offline on this device. Log in to keep gems and tickets on the server." }) : null,
    h("p", { class: "eyebrow", text: "Gatehold" }),
    h("h2", { text: "The cracked terrace" }),
    h("p", { class: "lede", text: "Four places in the wind. The gate hums behind the stones." }),
    state.save.tickets > 0 ? h("p", { class: "gift", text: "A Tenfold Ticket is waiting at the gate." }) : null,
    h("div", { class: "stage pedestal-stage", "data-stage": "leader", "data-unit": leaderId }),
    powerBanner(members),
    h("div", { class: "party-line" }, ...state.save.party.map((id, index) => partyActor(id, index))),
    h("div", { class: "dais", "aria-hidden": "true" }),
    h("div", { class: "home-actions" },
      h("button", { class: "btn", id: "open-story", type: "button", onclick: () => go("story"), text: "Story" }),
      h("button", { class: "btn ghost", type: "button", onclick: () => go("summon"), text: "Summon" }),
      h("button", { class: "btn ghost", type: "button", onclick: () => go("party"), text: "Edit party" }),
    ),
  );
}

function pullTag(row) {
  if (row.isNew) return h("p", { class: "tag-new", text: "NEW" });
  const bits = [`Shards +${row.shardsAdded}`];
  if (row.awakensGained) bits.push(`Awaken +${row.awakensGained}`);
  return h("p", { class: "tag-dupe", text: bits.join(" · ") });
}

function resultCard(row) {
  const unit = unitById(row.unitId);
  return h("article", { class: `result-card rarity-${row.rarity}` },
    thumb(row.unitId, row.name),
    starRow(row.rarity),
    h("h3", { text: row.name }),
    h("p", { class: "meta", text: `${ELEMENT_NAME[unit.element]} · ${ROLE_NAME[unit.role]}` }),
    pullTag(row),
    row.guaranteed ? h("p", { class: "fine", text: "Gate promise" }) : null,
    row.pityTriggered ? h("p", { class: "fine", text: "Pity" }) : null,
  );
}

function viewResults(pack) {
  const best = [...pack.presentation].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))[0];
  const unit = unitById(best.unitId);
  return h("section", { class: "screen" },
    h("p", { class: "eyebrow", text: pack.banner.name }),
    h("h2", { text: "The gate answers" }),
    h("article", { class: `hero-card rarity-${best.rarity}` },
      h("div", { class: "stage hero-stage", "data-stage": "hero", "data-unit": best.unitId, role: "img", "aria-label": best.name }),
      h("div", {},
        starRow(best.rarity),
        h("h3", { text: best.name }),
        h("p", { class: "meta", text: `${ELEMENT_NAME[unit.element]} · ${ROLE_NAME[unit.role]}` }),
        pullTag(best),
      ),
    ),
    againButton(pack),
    h("div", { class: "results", id: "results" }, ...pack.presentation.map((row) => resultCard(row))),
    h("p", { class: "fine", text: `Pity is now ${state.save.pity[pack.banner.id]} / ${PITY_AT}.` }),
    h("div", { class: "row" },
      h("button", { class: "btn ghost", type: "button", text: "Choose a gate", onclick: () => { state.results = null; draw(); } }),
      h("button", { class: "btn ghost", type: "button", text: "Roster", onclick: () => go("units") }),
    ),
  );
}

function rateBlock(banner) {
  const table = rateTable(banner);
  const pity = state.save.pity[banner.id] || 0;
  return h("div", { class: "rates frame" },
    h("h3", { text: "Rates" }),
    ...table.rows.map((row) => h("p", { class: "rate-line" },
      h("span", { class: `stars r${row.rarity}`, text: `${row.rarity}-star` }),
      ` ${(row.chance * 100).toFixed(1)}%`,
    )),
    ...table.featured.map((row) => h("p", {
      class: "rate-up",
      text: `${unitById(row.id).name} - ${Math.round(banner.rateUp * 100)}% of ${row.rarity}-star (${(row.chance * 100).toFixed(1)}% overall)`,
    })),
    h("p", { class: "fine", text: `A 5-star is guaranteed at pull ${table.pity}.` }),
    h("p", { class: "fine", text: "A 10-pull always includes at least one 4-star or 5-star." }),
    h("div", { class: "pity" },
      h("span", { text: `Pity ${pity} / ${table.pity}` }),
      h("div", { class: "bar", "aria-hidden": "true" }, h("i", { style: `width:${(pity / table.pity) * 100}%` })),
    ),
  );
}

function againButton(pack) {
  const count = pack.count === 1 ? 1 : 10;
  const offer = againOffer(count, state.save);
  return h("button", {
    class: "btn summon-again",
    id: "summon-again",
    type: "button",
    disabled: !offer.ok,
    onclick: () => {
      if (!offer.ok || state.pulling) return;
      state.bannerId = pack.banner.id;
      void doPull(count);
    },
  },
    h("span", { text: offer.label }),
    h("small", { text: offer.detail }),
  );
}

function askPull(count) {
  const banner = BANNERS.find((row) => row.id === state.bannerId);
  const payment = payForPull(state.save, count);
  if (!payment.ok) {
    toast("Not enough gems.");
    return;
  }
  const price = payment.method === "ticket" ? "1 Tenfold Ticket" : `${num(payment.cost)} gems`;
  confirmDialog({
    title: count === 10 ? "Tenfold summon" : "Single summon",
    text: `Spend ${price} at ${banner.name}?`,
    yes: "Summon",
    onYes: () => doPull(count),
  });
}

function rememberMute() {
  try {
    localStorage.setItem("aetherfall_prefs_v1", JSON.stringify({ muted: Boolean(state.save?.muted) }));
  } catch { /* ignore */ }
  if (state.mode !== "online") writeSave(state.save);
}

function applyRemote(save) {
  save.muted = state.save?.muted ?? false;
  state.save = save;
  state.username = save.username || state.username;
  state.admin = Boolean(save.admin);
}

function noteAccountProblem(res) {
  if (res?.banned) {
    state.banReason = res.reason || "No reason was recorded.";
    go("banned");
    return true;
  }
  return false;
}

async function doPull(count) {
  if (state.pulling) return;
  const banner = BANNERS.find((row) => row.id === state.bannerId);
  const payment = payForPull(state.save, count);
  if (!payment.ok) {
    toast("Not enough gems.");
    return;
  }
  state.pulling = true;
  try {
    if (state.mode === "online") {
      const res = await summonOnline(banner.id, count);
      if (!res.ok) {
        if (noteAccountProblem(res)) return;
        toast(res.error || "The gate did not answer.");
        return;
      }
      applyRemote(res.save);
      state.results = { banner, count, presentation: res.presentation };
      playFx(res.presentation);
      return;
    }
    const rolled = pull({
      count,
      pity: state.save.pity[banner.id] || 0,
      rng: Math.random,
      banner,
      catalog: UNITS,
    });
    const resolved = resolvePull(state.save.units, rolled.results, UNITS);
    state.save.gems = payment.gems;
    state.save.tickets = payment.tickets;
    state.save.pity[banner.id] = rolled.pityAfter;
    state.save.units = resolved.owned;
    writeSave(state.save);
    state.results = { banner, count, presentation: resolved.presentation };
    playFx(resolved.presentation);
  } finally {
    state.pulling = false;
  }
}

function finishFx() {
  if (!state.fxStop && !document.getElementById("fx-layer")) return;
  const stop = state.fxStop;
  state.fxStop = null;
  if (stop) stop();
  document.getElementById("modal-root").replaceChildren();
  draw({ scroll: true });
}

function playFx(presentation) {
  summonCharge();
  const root = document.getElementById("modal-root");
  const stage = h("div", { class: "fx-stage", id: "fx-stage" });
  const best = presentation.reduce((max, row) => Math.max(max, row.rarity), 3);
  root.replaceChildren(h("div", {
    class: "fx-layer",
    id: "fx-layer",
    role: "button",
    tabindex: "0",
    "aria-label": "Skip summon",
    onclick: () => finishFx(),
    onkeydown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        finishFx();
      }
    },
  },
    stage,
    h("p", { class: "fx-caption", text: best >= 5 ? "The Vein breaks open. Tap to skip." : "Light gathers in the crystal. Tap to skip." }),
    h("button", { class: "btn ghost", id: "skip-summon", type: "button", text: "Skip", onclick: (event) => { event.stopPropagation(); finishFx(); } }),
  ));
  state.fxStop = playSummon(stage, presentation, {
    onBurst: (rarity) => {
      rarityFanfare(rarity);
      if (rarity >= 5 && navigator.vibrate) {
        try { navigator.vibrate([30, 40, 80]); } catch { /* ignore */ }
      }
    },
    onDone: finishFx,
  });
}

function viewSummon() {
  if (state.results) return viewResults(state.results);
  const banner = BANNERS.find((row) => row.id === state.bannerId) || BANNERS[0];
  const ticket = state.save.tickets > 0;
  const can1 = state.save.gems >= COST_1;
  const can10 = ticket || state.save.gems >= COST_10;
  return h("section", { class: "screen" },
    h("p", { class: "eyebrow", text: "Summon" }),
    h("h2", { text: "Choose a gate" }),
    h("div", { class: "stage altar-stage", "data-stage": "altar" }),
    h("div", { class: "banners" }, ...BANNERS.map((row) => h("button", {
      type: "button",
      class: `banner ${row.id === banner.id ? "selected" : ""}`,
      onclick: () => {
        state.bannerId = row.id;
        blip();
        draw();
      },
    },
      h("div", { class: `banner-plate ${row.id}`, "aria-hidden": "true" }),
      h("h3", { text: row.name }),
      h("p", { text: row.blurb }),
      row.id === banner.id ? h("p", { class: "tag-new", text: "Selected" }) : null,
    ))),
    rateBlock(banner),
    h("div", { class: "pulls" },
      h("button", { class: "btn", id: "pull-1", type: "button", disabled: !can1, onclick: () => askPull(1) },
        h("span", { text: "Summon ×1" }),
        h("small", { text: `${num(COST_1)} gems` }),
      ),
      h("button", { class: "btn", id: "pull-10", type: "button", disabled: !can10, onclick: () => askPull(10) },
        h("span", { text: "Summon ×10" }),
        h("small", { text: ticket ? "1 Tenfold Ticket" : `${num(COST_10)} gems` }),
      ),
    ),
  );
}

function chips(key, options) {
  return h("div", { class: "chips", role: "group", "aria-label": key }, ...options.map(([value, label]) => h("button", {
    type: "button",
    class: state.filters[key] === value ? "chip on" : "chip",
    onclick: () => {
      state.filters[key] = value;
      draw();
    },
    text: label,
  })));
}

function viewUnits() {
  const rows = sortRoster(rosterRows().filter((row) => {
    const filters = state.filters;
    if (filters.rarity !== "all" && String(row.def.rarity) !== filters.rarity) return false;
    if (filters.element !== "all" && row.def.element !== filters.element) return false;
    if (filters.role !== "all" && row.def.role !== filters.role) return false;
    if (filters.owned === "owned" && !row.record) return false;
    if (filters.owned === "missing" && row.record) return false;
    return true;
  }), state.filters.sort);
  const owned = rosterRows().filter((row) => row.record).length;
  const select = h("select", {
    id: "sort",
    "aria-label": "Sort roster",
    onchange: (event) => {
      state.filters.sort = event.target.value;
      draw();
    },
  }, ...[
    ["rarity", "Rarity"],
    ["level", "Level"],
    ["name", "Name"],
    ["element", "Element"],
    ["role", "Role"],
    ["power", "Power"],
  ].map(([value, label]) => h("option", { value, text: label, selected: state.filters.sort === value })));
  return h("section", { class: "screen" },
    h("p", { class: "eyebrow", text: "Roster" }),
    h("h2", { text: "Veinwalkers" }),
    h("p", { class: "lede", text: `${owned} / ${UNITS.length} summoned` }),
    chips("rarity", [["all", "All"], ["5", "5-star"], ["4", "4-star"], ["3", "3-star"]]),
    chips("element", [["all", "All elements"], ...ELEMENTS.map((id) => [id, ELEMENT_NAME[id]])]),
    chips("role", [["all", "All roles"], ...ROLES.map((id) => [id, ROLE_NAME[id]])]),
    chips("owned", [["all", "Everyone"], ["owned", "Owned"], ["missing", "Missing"]]),
    h("label", { class: "sort", for: "sort" }, "Sort", select),
    rows.length === 0 ? h("p", { class: "empty", text: "No one matches those marks." }) : null,
    h("div", { class: "grid", id: "roster" }, ...rows.map((row) => h("button", {
      type: "button",
      class: `unit-card rarity-${row.def.rarity} ${row.record ? "" : "locked"}`,
      "data-element": row.def.element,
      onclick: () => go("unit", row.def.id),
    },
      thumb(row.def.id, row.record ? row.def.name : `${row.def.name}, not summoned`),
      starRow(row.def.rarity),
      h("h3", { text: row.def.name }),
      h("p", { class: "meta" }, icon(row.def.element), ` ${ROLE_NAME[row.def.role]}`),
      h("p", { class: "fine", text: row.record ? `Lv ${row.record.level}` : "Not summoned" }),
    ))),
  );
}

function statRow(key, value) {
  const caps = { hp: 2200, atk: 380, def: 340, spd: 170, mag: 380 };
  const pct = Math.max(8, Math.min(100, Math.round((value / caps[key]) * 100)));
  return h("div", { class: `stat ${key}` },
    h("span", { text: key.toUpperCase() }),
    h("div", { class: "bar", "aria-hidden": "true" }, h("i", { style: `width:${pct}%` })),
    h("b", { text: String(value) }),
  );
}

function viewDetail(id) {
  const def = unitById(id);
  if (!def) {
    return h("section", { class: "screen" },
      h("p", { text: "That name is not in the Vein." }),
      h("button", { class: "btn", type: "button", text: "Back", onclick: () => go("units") }),
    );
  }
  const record = state.save.units[def.id];
  const owned = Boolean(record?.owned);
  const stats = unitStats(def, owned ? record : { level: 1, awaken: 0 });
  const cost = owned ? levelCost(record.level) : null;
  const nextAwaken = owned && record.awaken < MAX_AWAKEN ? AWAKEN_COST[record.awaken] : null;
  return h("section", { class: "screen detail" },
    h("button", { class: "btn ghost back", type: "button", text: "Roster", onclick: () => go("units") }),
    h("div", { class: `splash stage detail-stage rarity-${def.rarity}`, "data-stage": "detail", "data-unit": def.id, role: "img", "aria-label": def.name }),
    h("p", { class: "fine", text: "Drag the figure to turn it." }),
    starRow(def.rarity),
    h("h2", { text: def.name }),
    h("p", { class: "meta badges" },
      h("span", { class: `badge ${def.element}` }, icon(def.element), ELEMENT_NAME[def.element]),
      h("span", { class: "badge", text: ROLE_NAME[def.role] }),
    ),
    h("p", { class: "flavor", text: def.flavor }),
    owned ? h("p", { class: "level", text: `Level ${record.level} / ${MAX_LEVEL}` }) : h("p", { class: "gift", text: "Not summoned yet." }),
    owned ? h("p", { class: "pips", text: `Awaken ${record.awaken} / ${MAX_AWAKEN}` }) : null,
    owned ? h("p", { class: "fine", text: nextAwaken ? `Shards ${record.shards} / ${nextAwaken}` : "Awaken maxed. Extra shards are kept." }) : null,
    h("div", { class: "stats" }, ...["hp", "atk", "def", "spd", "mag"].map((key) => statRow(key, stats[key]))),
    h("div", { class: "skills" }, ...def.skills.map((skill) => h("article", { class: "skill" },
      h("h3", {}, skill.name, h("em", { text: skill.kind })),
      h("p", { text: skill.text }),
    ))),
    owned ? h("button", {
      class: "btn",
      id: "level-up",
      type: "button",
      disabled: cost == null || state.save.gold < cost,
      onclick: () => levelUp(def.id),
      text: cost == null ? "Level cap" : `Level up · ${num(cost)} gold`,
    }) : null,
  );
}

async function levelUp(id) {
  if (state.mode === "online") {
    const res = await levelOnline(id);
    if (!res.ok) {
      if (noteAccountProblem(res)) return;
      toast(res.error || "Could not level up.");
      return;
    }
    applyRemote(res.save);
    powerup();
    draw();
    return;
  }
  const result = tryLevelUp(state.save.units[id], state.save.gold);
  if (!result.ok) {
    toast(result.reason === "max" ? "Already at the level cap." : "Not enough gold.");
    return;
  }
  state.save.gold = result.gold;
  state.save.units[id] = result.record;
  writeSave(state.save);
  powerup();
  draw();
}

function place(id, slot) {
  if (!state.save.units[id]?.owned) return;
  const party = state.save.party.slice();
  const existing = party.indexOf(id);
  if (existing === slot) {
    state.partyPick = null;
    draw();
    return;
  }
  const displaced = party[slot];
  party[slot] = id;
  if (existing !== -1) party[existing] = displaced;
  state.save.party = party;
  if (!party[state.save.leader]) {
    const fallback = party.findIndex(Boolean);
    state.save.leader = fallback === -1 ? 0 : fallback;
  }
  state.partyPick = null;
  commitParty();
}

function clearSlot(index) {
  const party = state.save.party.slice();
  party[index] = null;
  state.save.party = party;
  if (!party[state.save.leader]) {
    const fallback = party.findIndex(Boolean);
    state.save.leader = fallback === -1 ? 0 : fallback;
  }
  commitParty();
}

function setLeader(index) {
  if (!state.save.party[index]) return;
  state.save.leader = index;
  commitParty();
}

function commitParty() {
  blip();
  if (state.mode !== "online") {
    writeSave(state.save);
    draw();
    return;
  }
  const party = state.save.party.slice();
  const leader = state.save.leader;
  draw();
  void partyOnline(party, leader).then((res) => {
    if (!res.ok) {
      if (noteAccountProblem(res)) return;
      toast(res.error || "Could not save the party.");
      return;
    }
    applyRemote(res.save);
  });
}

function hideGhost() {
  document.getElementById("drag-ghost")?.remove();
}

function showGhost(id, x, y) {
  let ghost = document.getElementById("drag-ghost");
  if (!ghost) {
    ghost = h("div", { id: "drag-ghost", class: "drag-ghost" }, thumb(id, ""));
    document.body.append(ghost);
  }
  ghost.style.transform = `translate(${Math.round(x - 36)}px, ${Math.round(y - 70)}px)`;
}

function bindDrag(node, id, onTap) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    state.drag = { id, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId, onTap };
    try { node.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  node.addEventListener("pointermove", (event) => {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.moved = true;
    showGhost(drag.id, event.clientX, event.clientY);
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    document.querySelectorAll(".slot.over").forEach((el) => el.classList.remove("over"));
    const slot = hit?.closest?.("[data-slot]");
    if (slot) slot.classList.add("over");
  });
  node.addEventListener("pointerup", (event) => endDrag(event));
  node.addEventListener("pointercancel", (event) => endDrag(event));
}

function endDrag(event) {
  const drag = state.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  state.drag = null;
  hideGhost();
  document.querySelectorAll(".slot.over").forEach((el) => el.classList.remove("over"));
  if (!drag.moved) {
    drag.onTap?.();
    return;
  }
  state.suppressClick = true;
  setTimeout(() => {
    state.suppressClick = false;
  }, 0);
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const slot = hit?.closest?.("[data-slot]");
  if (slot) place(drag.id, Number(slot.dataset.slot));
}

function viewParty() {
  const members = state.save.party.map(memberById);
  const owned = UNITS.filter((def) => state.save.units[def.id]?.owned);
  return h("section", { class: "screen" },
    h("p", { class: "eyebrow", text: "Formation" }),
    h("h2", { text: "Party" }),
    h("div", { class: "stage party-stage", "data-stage": "party", "data-units": state.save.party.filter(Boolean).join(",") }),
    h("p", { class: "fine", text: "Drag the formation to turn it." }),
    powerBanner(members),
    h("p", { class: "fine", text: "Tap a veinwalker, then a slot. Drag onto a slot if you like. The crown is the leader." }),
    h("div", { class: "slots" }, ...[0, 1, 2, 3].map((index) => {
      const id = state.save.party[index];
      const leader = Boolean(id) && state.save.leader === index;
      const node = h("div", {
        class: `slot ${state.partyPick ? "hot" : ""} ${leader ? "leader" : ""}`,
        "data-slot": String(index),
      },
        h("div", { class: "slot-top" },
          h("span", { text: `Slot ${index + 1}` }),
          h("button", {
            type: "button",
            class: "mini",
            disabled: !id,
            text: leader ? "Leader" : "Crown",
            "aria-label": `Make slot ${index + 1} the leader`,
            onpointerdown: (event) => event.stopPropagation(),
            onclick: (event) => {
              event.stopPropagation();
              setLeader(index);
            },
          }),
        ),
        id ? h("p", { class: "actor-name", text: unitById(id).name }) : h("div", { class: "empty-slot", text: "Empty" }),
        id ? h("button", {
          type: "button",
          class: "mini",
          text: "Remove",
          onpointerdown: (event) => event.stopPropagation(),
          onclick: (event) => {
            event.stopPropagation();
            clearSlot(index);
          },
        }) : null,
        h("button", {
          type: "button",
          class: "slot-hit",
          "aria-label": id ? `Slot ${index + 1}, ${unitById(id).name}` : `Empty slot ${index + 1}`,
          onclick: () => {
            if (state.suppressClick) return;
            if (state.partyPick) place(state.partyPick, index);
          },
        }),
      );
      if (id) bindDrag(node, id, null);
      return node;
    })),
    h("h3", { text: "Owned" }),
    h("div", { class: "bench", id: "bench" }, ...owned.map((def) => {
      const picked = state.partyPick === def.id;
      const inParty = state.save.party.includes(def.id);
      const card = h("button", {
        type: "button",
        class: `bench-card ${picked ? "picked" : ""} ${inParty ? "in-party" : ""}`,
        "data-unit": def.id,
        onclick: () => {
          if (state.suppressClick) return;
          state.partyPick = state.partyPick === def.id ? null : def.id;
          blip();
          draw();
        },
      },
        thumb(def.id, def.name),
        h("span", { text: def.name }),
        inParty ? h("em", { text: "In party" }) : null,
      );
      bindDrag(card, def.id, null);
      return card;
    })),
  );
}

function previewNote() {
  if (!state.preview) return null;
  return h("p", { class: "preview-banner", text: "Screenshot preview. Not a live account." });
}

function playOffline() {
  state.mode = "offline";
  state.username = "";
  state.admin = false;
  state.preview = null;
  state.save = loadSave();
  setMuted(state.save.muted);
  blip();
  go("home");
}

async function logout() {
  if (state.preview) {
    state.preview = null;
    history.replaceState(null, "", location.pathname);
    go("title");
    return;
  }
  await logOutAccount();
  state.mode = "offline";
  state.username = "";
  state.admin = false;
  state.banReason = "";
  state.save = loadSave();
  setMuted(state.save.muted);
  go("title");
}

function enterOnline(res) {
  if (!res.ok) {
    if (res.banned) {
      state.banReason = res.reason || "No reason was recorded.";
      state.mode = "online";
      go("banned");
      return;
    }
    if (res.missing) {
      state.accountNote = "The account tables are not on this server yet. You can play offline until that SQL is applied.";
      state.mode = "offline";
      go("title");
      return;
    }
    return res.error || "Could not open the account.";
  }
  state.mode = "online";
  state.accountNote = "";
  applyRemote(res.save);
  go("home");
  return "";
}

function viewAuth(kind) {
  const signup = kind === "signup";
  return h("section", { class: "screen auth-screen" },
    previewNote(),
    h("button", { class: "btn ghost back", type: "button", text: "Title", onclick: () => go("title") }),
    h("h2", { text: signup ? "Sign up" : "Log in" }),
    h("p", { class: "lede", text: "Same username and password as Toon Orbit Battle, or a new one." }),
    h("form", {
      class: "auth-form frame",
      id: signup ? "signup-form" : "login-form",
      onsubmit: (event) => {
        event.preventDefault();
        void submitAuth(signup);
      },
    },
      h("label", { text: "Username" }, h("input", { id: "auth-name", name: "username", autocomplete: "username", maxlength: "16", required: true })),
      h("label", { text: "Password" }, h("input", {
        id: "auth-pass",
        name: "password",
        type: "password",
        autocomplete: signup ? "new-password" : "current-password",
        minlength: "6",
        required: true,
      })),
      h("p", { class: "form-error", id: "auth-error" }),
      h("button", { class: "btn", type: "submit", id: signup ? "signup-submit" : "login-submit", text: signup ? "Create account" : "Log in" }),
    ),
  );
}

async function submitAuth(signup) {
  const name = document.getElementById("auth-name")?.value || "";
  const password = document.getElementById("auth-pass")?.value || "";
  const errorEl = document.getElementById("auth-error");
  const res = signup ? await signUpAccount(name, password) : await logInAccount(name, password);
  const message = enterOnline(res);
  if (message && errorEl) errorEl.textContent = message;
}

function viewBanned() {
  return h("section", { class: "screen ban-screen" },
    h("h2", { text: "This account is banned" }),
    h("p", { text: state.banReason || "No reason was recorded." }),
    h("button", { class: "btn", id: "logout", type: "button", text: "Logout", onclick: () => void logout() }),
  );
}

const PREVIEW_PLAYERS = [
  { username: "gatekeeper", gems: 4500, gold: 8000, tickets: 1, banned: false, ban_reason: "" },
  { username: "moss.thief", gems: 120, gold: 400, tickets: 0, banned: true, ban_reason: "Duplicated tickets" },
  { username: "brine.calder", gems: 900, gold: 2400, tickets: 3, banned: false, ban_reason: "" },
];

function viewAdmin() {
  if (state.preview === "admin") return adminLayout(PREVIEW_PLAYERS, [{ action: "grant", username: "gatekeeper", gems: 300, gold: 0, tickets: 1, note: "welcome back" }]);
  if (state.mode !== "online" || !state.admin) {
    return h("section", { class: "screen" },
      h("h2", { text: "Admins only" }),
      h("p", { class: "lede", text: state.accountNote || "Log in with an admin account after the account tables are applied." }),
      h("button", { class: "btn", type: "button", text: "Title", onclick: () => go("title") }),
    );
  }
  return adminLayout([], []);
}

function adminLayout(players, log) {
  return h("section", { class: "screen admin-screen" },
    previewNote(),
    h("p", { class: "eyebrow", text: "Gatehold office" }),
    h("h2", { text: "Players" }),
    h("form", {
      class: "auth-form",
      id: "admin-search-form",
      onsubmit: (event) => {
        event.preventDefault();
        void loadAdmin(document.getElementById("admin-query")?.value || "");
      },
    },
      h("label", { text: "Search username" }, h("input", { id: "admin-query", value: state.adminQuery || "" })),
      h("button", { class: "btn", type: "submit", text: "Search" }),
    ),
    h("div", { id: "admin-list", class: "admin-list" }, ...players.map(adminCard)),
    h("h3", { text: "Recent actions" }),
    h("ul", { id: "admin-log", class: "admin-log" }, ...log.map((entry) => h("li", { text: adminLogLine(entry) }))),
  );
}

function adminLogLine(entry) {
  if (entry.action === "ban") return `Ban ${entry.username}: ${entry.note || ""}`;
  if (entry.action === "unban") return `Unban ${entry.username}`;
  return `Grant ${entry.username}: ${entry.tickets || 0} tickets, ${entry.gems || 0} gems, ${entry.gold || 0} gold`;
}

function adminCard(player) {
  return h("article", { class: "admin-card frame" },
    h("h3", { text: player.username }),
    h("p", { text: `${num(player.gems)} gems · ${num(player.tickets)} tickets · ${num(player.gold)} gold` }),
    h("p", { class: player.banned ? "form-error" : "fine", text: player.banned ? `Banned: ${player.ban_reason || "No reason"}` : "Not banned" }),
    h("form", {
      class: "grant-form",
      onsubmit: (event) => {
        event.preventDefault();
        if (state.preview) { toast("Preview only. Not a live account."); return; }
        const data = new FormData(event.target);
        void grantPlayer(player.username, data);
      },
    },
      h("label", { text: "Tickets" }, h("input", { name: "tickets", type: "number", min: "0", value: "0" })),
      h("label", { text: "Gems" }, h("input", { name: "gems", type: "number", min: "0", value: "0" })),
      h("label", { text: "Gold" }, h("input", { name: "gold", type: "number", min: "0", value: "0" })),
      h("label", { text: "Note" }, h("input", { name: "note", maxlength: "200" })),
      h("button", { class: "btn", type: "submit", text: "Grant" }),
    ),
    h("form", {
      class: "grant-form",
      onsubmit: (event) => {
        event.preventDefault();
        if (state.preview) { toast("Preview only. Not a live account."); return; }
        const reason = new FormData(event.target).get("reason");
        void banPlayer(player.username, reason);
      },
    },
      h("label", { text: "Ban reason" }, h("input", { name: "reason", maxlength: "200" })),
      h("button", { class: "btn danger", type: "submit", text: "Ban" }),
      player.banned ? h("button", { class: "btn ghost", type: "button", text: "Unban", onclick: () => void unbanPlayer(player.username) }) : null,
    ),
  );
}

async function loadAdmin(query) {
  if (state.preview) return;
  state.adminQuery = query;
  const [found, log] = await Promise.all([adminSearch(query), adminLog()]);
  const list = document.getElementById("admin-list");
  const logEl = document.getElementById("admin-log");
  if (!found.ok) {
    if (noteAccountProblem(found)) return;
    if (list) list.replaceChildren(h("p", { class: "form-error", text: found.error || "Could not load players." }));
    return;
  }
  const players = found.data?.players || [];
  if (list) list.replaceChildren(...(players.length ? players.map(adminCard) : [h("p", { class: "empty", text: "No players match." })]));
  if (log.ok && logEl) logEl.replaceChildren(...(log.data?.entries || []).map((entry) => h("li", { text: adminLogLine(entry) })));
}

async function grantPlayer(username, data) {
  const res = await adminGrant({
    username,
    tickets: Number(data.get("tickets") || 0),
    gems: Number(data.get("gems") || 0),
    gold: Number(data.get("gold") || 0),
    note: String(data.get("note") || ""),
  });
  if (!res.ok) {
    toast(res.error || "Could not grant.");
    return;
  }
  toast(`Granted to ${username}.`);
  await loadAdmin(state.adminQuery || "");
}

async function banPlayer(username, reason) {
  const res = await adminBan(username, String(reason || ""));
  if (!res.ok) {
    toast(res.error || "Could not ban.");
    return;
  }
  toast(`${username} is banned.`);
  await loadAdmin(state.adminQuery || "");
}

async function unbanPlayer(username) {
  const res = await adminUnban(username);
  if (!res.ok) {
    toast(res.error || "Could not unban.");
    return;
  }
  toast(`${username} can play again.`);
  await loadAdmin(state.adminQuery || "");
}

const DIFF_LABEL = { normal: "Normal", hard: "Hard", nightmare: "Nightmare" };

function battleParty() {
  const slots = state.save.party.map(memberById);
  const leader = slots[state.save.leader];
  const bonus = leader ? leaderBonus(leader.def.role) : null;
  const mul = bonus ? 1 + bonus.pct / 100 : 1;
  return slots.filter(Boolean).map((member) => {
    const stats = unitStats(member.def, member.record);
    if (bonus) {
      stats[bonus.stat] = Math.round(stats[bonus.stat] * mul);
      if (bonus.also) stats[bonus.also] = Math.round(stats[bonus.also] * mul);
    }
    return {
      id: member.def.id,
      spriteId: member.def.id,
      name: member.def.name,
      element: member.def.element,
      role: member.def.role,
      skills: member.def.skills,
      ...stats,
    };
  });
}

function starMarks(count) {
  return h("span", { class: "stage-stars", "aria-label": `${count} stars` },
    ...[1, 2, 3].map((n) => h("i", { class: n <= count ? "on" : "" })),
  );
}

function viewStory(route) {
  const difficulty = route.difficulty || "normal";
  return h("section", { class: "screen", id: "map-select" },
    h("p", { class: "eyebrow", text: "Story" }),
    h("h2", { text: "World paths" }),
    h("p", { class: "lede", text: "Five roads. Twenty-six steps each. The later roads wait until the one before them is walked." }),
    h("div", { class: "diff-tabs", id: "diff-tabs" }, ...DIFFICULTIES.map((id) => h("button", {
      type: "button",
      class: `chip ${id === difficulty ? "on" : ""}`,
      "data-diff": id,
      text: DIFF_LABEL[id],
      onclick: () => goHash(`#/story/${id}`),
    }))),
    h("div", { class: "map-list" }, ...MAPS.map((map, index) => {
      const open = isStageUnlocked(state.clears, difficulty, index, 1);
      const tally = mapStars(state.clears, difficulty, index);
      return h("button", {
        type: "button",
        class: `map-card frame ${open ? "" : "locked"}`,
        id: `map-${map.id}`,
        "data-map": map.id,
        disabled: !open,
        onclick: () => { if (open) goHash(`#/story/${difficulty}/${index}`); },
      },
        h("div", { class: `land ${map.id}`, "aria-hidden": "true" }),
        h("div", {},
          h("p", { class: "eyebrow", text: `${DIFF_LABEL[difficulty]} · ${ELEMENT_NAME[map.element]}` }),
          h("h3", { text: map.name }),
          h("p", { text: open ? map.blurb : "Locked until this path is cleared on the previous difficulty." }),
          h("p", { class: "meta", text: open ? `${tally.cleared}/${STAGES_PER_MAP} · ${tally.stars} stars` : "Locked" }),
        ),
      );
    })),
  );
}

function viewStages(route) {
  const map = MAPS[route.map];
  if (!map) return viewStory({ difficulty: route.difficulty });
  const tally = mapStars(state.clears, route.difficulty, route.map);
  return h("section", { class: "screen", id: "stage-list" },
    h("button", { class: "btn ghost", type: "button", text: "World paths", onclick: () => goHash(`#/story/${route.difficulty}`) }),
    h("p", { class: "eyebrow", text: `${DIFF_LABEL[route.difficulty]} · ${ELEMENT_NAME[map.element]}` }),
    h("h2", { text: map.name }),
    h("p", { class: "lede", text: map.blurb }),
    h("p", { class: "meta", id: "map-tally", text: `${tally.cleared} cleared · ${tally.stars} / ${tally.max} stars` }),
    h("ol", { class: "stage-list" }, ...Array.from({ length: STAGES_PER_MAP }, (_, i) => {
      const stage = i + 1;
      const open = isStageUnlocked(state.clears, route.difficulty, route.map, stage);
      const row = state.clears[`${route.difficulty}:${route.map}:${stage}`];
      const element = enemyElement(route.map, stage, 0);
      return h("li", {}, h("button", {
        type: "button",
        class: `stage-row ${isBoss(stage) ? "boss" : ""} ${open ? "" : "locked"}`,
        id: `stage-${stage}`,
        disabled: !open,
        onclick: () => { if (open) goHash(`#/battle/${route.difficulty}/${route.map}/${stage}`); },
      },
        h("span", { class: "stage-no", text: String(stage).padStart(2, "0") }),
        h("span", { class: "stage-copy" },
          h("strong", { text: stageTitle(route.map, stage) }),
          h("em", { text: `Power ${num(recommendedPower(route.difficulty, route.map, stage))} · ${ELEMENT_NAME[element]}${isBoss(stage) ? " · Boss" : ""}` }),
        ),
        row ? starMarks(row.stars) : h("span", { class: "stage-stars", "aria-label": "not cleared" }),
      ));
    })),
  );
}

function viewBattle(route) {
  const map = MAPS[route.map];
  const stage = route.stage;
  const open = map && isStageUnlocked(state.clears, route.difficulty, route.map, stage);
  if (!open) {
    return h("section", { class: "screen" },
      h("h2", { text: "That stage is locked" }),
      h("button", { class: "btn", type: "button", text: "Back to paths", onclick: () => go("story") }),
    );
  }
  const mount = h("div", { id: "battle-mount" });
  queueMicrotask(() => startMountedBattle(mount, route));
  return mount;
}

function startMountedBattle(mount, route) {
  if (!mount.isConnected) return;
  const allies = battleParty();
  if (allies.length < 1) {
    toast("Set a party before the path.");
    go("party");
    return;
  }
  const encounter = buildEncounter(route.difficulty, route.map, route.stage);
  mount.replaceChildren();
  renderBattleScreen(mount, {
    allies,
    encounter,
    title: stageTitle(route.map, route.stage),
    rewardLine: (battle) => {
      const stars = starsFromResult({ won: true, deaths: battle.deaths, turns: battle.turns, stage: route.stage });
      const key = `${route.difficulty}:${route.map}:${route.stage}`;
      const gems = state.clears[key] ? 0 : firstClearGems(route.difficulty, route.stage);
      const gold = clearGold(route.difficulty, route.map, route.stage, stars);
      return `${stars} stars · ${gems ? `${gems} gems · ` : ""}${num(gold)} gold`;
    },
    onExit: (kind) => {
      if (kind === "retry") draw({ scroll: true });
      else goHash(`#/story/${route.difficulty}/${route.map}`);
    },
    onVictory: (result) => { void claimStage(route, result); },
  });
}

async function claimStage(route, result) {
  const stars = starsFromResult({ won: true, deaths: result.deaths, turns: result.turns, stage: route.stage });
  const gems = firstClearGems(route.difficulty, route.stage);
  const gold = clearGold(route.difficulty, route.map, route.stage, stars);
  if (state.mode === "online" && !state.preview) {
    const res = await clearStageOnline({
      difficulty: route.difficulty,
      map: route.map,
      stage: route.stage,
      stars,
      turns: result.turns,
      seconds: result.seconds,
    });
    if (res.ok) {
      state.save.gems = res.data.gems;
      state.save.gold = res.data.gold;
      state.clears = progressFromRows(res.data.progress);
      state.storyRemote = true;
      toast(res.data.first ? `First clear. ${res.data.gems_gained} gems, ${num(res.data.gold_gained)} gold.` : `${num(res.data.gold_gained)} gold.`);
      chrome();
      goHash(`#/story/${route.difficulty}/${route.map}`);
      return;
    }
    if (res.missing) {
      const local = recordClear(state.clears, route.difficulty, route.map, route.stage, stars, result.turns);
      saveProgress(state.clears);
      toast(local.first ? "Saved on this device. Story rewards stay here until the battle SQL is applied." : "Clear saved on this device.");
      goHash(`#/story/${route.difficulty}/${route.map}`);
      return;
    }
    toast(res.error || "The server refused that clear.");
    return;
  }
  const local = recordClear(state.clears, route.difficulty, route.map, route.stage, stars, result.turns);
  state.save.gems += local.gems;
  state.save.gold += local.gold;
  saveProgress(state.clears);
  writeSave(state.save);
  toast(local.first ? `${stars} stars. ${local.gems} gems and ${num(local.gold)} gold.` : `${stars} stars. ${num(gold)} gold.`);
  chrome();
  goHash(`#/story/${route.difficulty}/${route.map}`);
}

function viewFor(route) {
  if (route.name === "title") return viewTitle();
  if (route.name === "login") return viewAuth("login");
  if (route.name === "signup") return viewAuth("signup");
  if (route.name === "admin") return viewAdmin();
  if (route.name === "banned") return viewBanned();
  if (route.name === "home") return viewHome();
  if (route.name === "summon") return viewSummon();
  if (route.name === "units") return viewUnits();
  if (route.name === "party") return viewParty();
  if (route.name === "detail") return viewDetail(route.id);
  if (route.name === "story") return viewStory(route);
  if (route.name === "stages") return viewStages(route);
  if (route.name === "battle") return viewBattle(route);
  return viewHome();
}

function draw(options = {}) {
  const route = current();
  if (route.name === "battle" && document.getElementById("battle-app") && !options.scroll) return;
  stopBattle();
  if (route.name !== "summon") state.results = null;
  if (route.name !== "battle") releaseView();
  const app = document.getElementById("app");
  app.classList.toggle("on-title", route.name === "title");
  const view = document.getElementById("view");
  view.dataset.screen = route.name;
  chrome();
  nav();
  view.replaceChildren(viewFor(route));
  if (route.name !== "battle") presentView(route, state);
  if (options.scroll) window.scrollTo(0, 0);
  if (route.name === "admin" && state.mode === "online" && state.admin && !state.preview) void loadAdmin(state.adminQuery || "");
}

function confirmDialog({ title, text, yes, onYes }) {
  const root = document.getElementById("modal-root");
  root.replaceChildren(h("div", { class: "modal-back" },
    h("div", { class: "modal frame", role: "dialog", "aria-modal": "true" },
      h("h2", { text: title }),
      h("p", { text }),
      h("div", { class: "row" },
        h("button", { class: "btn ghost", type: "button", text: "Cancel", onclick: () => root.replaceChildren() }),
        h("button", { class: "btn", id: "confirm-yes", type: "button", text: yes, onclick: () => { root.replaceChildren(); onYes(); } }),
      ),
    ),
  ));
}

function openSettings() {
  const root = document.getElementById("modal-root");
  const sheet = () => h("div", { class: "modal-back" },
    h("div", { class: "modal frame", role: "dialog", "aria-modal": "true", "aria-labelledby": "settings-title" },
      h("h2", { id: "settings-title", text: "Settings" }),
      h("button", {
        class: "btn",
        id: "mute-toggle",
        type: "button",
        text: state.save.muted ? "Sound: off" : "Sound: on",
        onclick: () => {
          state.save.muted = !state.save.muted;
          setMuted(state.save.muted);
          rememberMute();
          if (!state.save.muted) blip();
          root.replaceChildren(sheet());
          chrome();
          paintAll();
        },
      }),
      state.mode === "online" ? null : h("button", {
        class: "btn danger",
        id: "reset-save",
        type: "button",
        text: "Wipe offline save",
        onclick: () => confirmDialog({
          title: "Wipe this save?",
          text: "Gems, the roster, the party, and pity on this device return to the first morning.",
          yes: "Wipe save",
          onYes: () => {
            state.save = resetSave();
            state.clears = {};
            saveProgress(state.clears);
            state.results = null;
            state.partyPick = null;
            setMuted(state.save.muted);
            toast("Save wiped.");
            draw();
          },
        }),
      }),
      h("p", { class: "fine", text: state.mode === "online" ? "Gems, tickets, and the roster for this account stay on the server." : "An offline save stays in this browser. Nothing is sent anywhere." }),
      h("button", { class: "btn ghost", type: "button", text: "Close", onclick: () => root.replaceChildren() }),
    ),
  );
  root.replaceChildren(sheet());
}

export async function boot(root) {
  state.save = loadSave();
  state.clears = loadProgress();
  try {
    const prefs = JSON.parse(localStorage.getItem("aetherfall_prefs_v1") || "null");
    if (prefs && typeof prefs.muted === "boolean") state.save.muted = prefs.muted;
  } catch { /* ignore */ }
  setMuted(state.save.muted);
  if (!state.preview) {
    try {
      const session = await currentSession();
      if (session) {
        const opened = await openSession();
        if (opened.ok) {
          state.mode = "online";
          applyRemote(opened.save);
          const progress = await getProgressOnline();
          if (progress.ok) {
            state.clears = progressFromRows(progress.data);
            state.storyRemote = true;
          } else if (!progress.missing) {
            state.accountNote = progress.error || state.accountNote;
          }
        } else if (opened.banned) {
          state.mode = "online";
          state.banReason = opened.reason || "No reason was recorded.";
          state.username = session.user?.user_metadata?.username || "";
        } else if (opened.missing) {
          state.accountNote = "The account tables are not on this server yet. You can play offline until that SQL is applied.";
        } else {
          state.accountNote = opened.error || "";
        }
      }
    } catch {
      state.accountNote = "Could not reach the account service.";
    }
  } else {
    state.username = "gatekeeper";
    state.admin = true;
    state.mode = "preview";
  }
  root.replaceChildren(
    h("div", { id: "chrome" }),
    h("main", { id: "view" }),
    h("nav", { id: "nav", class: "nav", "aria-label": "Game" }),
    h("div", { id: "modal-root" }),
    h("div", { id: "toast", class: "toast", role: "status" }),
  );
  window.addEventListener("hashchange", () => {
    if (state.fxStop) finishFx();
    else draw({ scroll: true });
  });
  document.addEventListener("pointerdown", () => resume(), { passive: true });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.fxStop) finishFx();
    else document.getElementById("modal-root").replaceChildren();
  });
  window.addEventListener("resize", () => {
    if (state.fxStop) return;
    if (document.getElementById("battle-app") || document.querySelector("[data-stage]")) return;
    draw();
  });
  if (!location.hash) location.hash = state.banReason ? "#/banned" : "#/title";
  draw({ scroll: true });
  if (current().name === "admin" && state.mode === "online" && state.admin) void loadAdmin("");
}
