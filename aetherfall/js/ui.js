import { adminBan, adminGrant, adminLog, adminSearch, adminUnban, currentSession, levelOnline, logInAccount, logOutAccount, openSession, partyOnline, signUpAccount, summonOnline } from "./account.js";
import { blip, powerup, rarityFanfare, resume, setMuted, summonCharge } from "./audio.js";
import { AWAKEN_COST, COST_1, COST_10, MAX_AWAKEN, MAX_LEVEL, PITY_AT } from "./balance.js";
import { playSummon } from "./fx.js";
import { payForPull, pull, rateTable, resolvePull } from "./gacha.js";
import { leaderBonus, levelCost, partyPower, sortRoster, tryLevelUp, unitPower, unitStats } from "./progress.js";
import { paint } from "./pixel.js";
import { loadSave, resetSave, writeSave } from "./save.js";
import { FRAME_COUNT, SPRITE_W, paintIcon, paintPortrait, paintUnit, renderBanner, renderLogo } from "./sprites.js";
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
    ...Array.from({ length: rarity }, () => icon("star", 1)),
  );
}

function go(name, extra) {
  if (state.fxStop) return;
  const next = extra ? `#/${name}/${encodeURIComponent(extra)}` : `#/${name}`;
  if (location.hash === next) draw();
  else location.hash = next;
}

function current() {
  if (state.preview === "login") return { name: "login" };
  if (state.preview === "hub") return { name: "home" };
  if (state.preview === "admin") return { name: "admin" };
  const hash = decodeURIComponent((location.hash || "").replace(/^#\/?/, ""));
  if (!hash || hash === "title") return { name: "title" };
  if (hash.startsWith("unit/")) return { name: "detail", id: hash.slice(5) };
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

function icon(name, scale = 2) {
  return h("canvas", { class: "pixel icon", "data-icon": name, "data-scale": String(scale), "aria-hidden": "true" });
}

function sprite(id, scale, label) {
  return h("canvas", {
    class: "pixel sprite",
    "data-sprite": id,
    "data-scale": String(scale),
    role: "img",
    "aria-label": label,
  });
}

function portrait(id, scale, label) {
  return h("canvas", {
    class: "pixel portrait",
    "data-portrait": id,
    "data-scale": String(scale),
    role: "img",
    "aria-label": label,
  });
}

function partyScale() {
  const avail = Math.min(window.innerWidth, 1040) - 28;
  return Math.max(1, Math.min(3, Math.floor(avail / 4 / SPRITE_W)));
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

function paintSprites() {
  document.querySelectorAll("canvas[data-sprite]").forEach((canvas) => {
    paintUnit(canvas, canvas.dataset.sprite, state.frame, Number(canvas.dataset.scale));
  });
  document.querySelectorAll("canvas[data-portrait]").forEach((canvas) => {
    paintPortrait(canvas, canvas.dataset.portrait, state.frame, Number(canvas.dataset.scale));
  });
}

function paintAll() {
  paintSprites();
  document.querySelectorAll("canvas[data-icon]").forEach((canvas) => {
    paintIcon(canvas, canvas.dataset.icon, Number(canvas.dataset.scale || 2));
  });
  document.querySelectorAll("canvas[data-banner]").forEach((canvas) => {
    paint(canvas, renderBanner(canvas.dataset.banner), 1);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
  });
  const logo = document.querySelector("canvas[data-logo]");
  if (logo) {
    paint(logo, renderLogo(), 1);
    logo.style.width = `min(92vw, ${logo.width}px)`;
    logo.style.height = "auto";
  }
}

function pill(kind, value) {
  const label = kind === "gem" ? "Aether gems" : kind === "ticket" ? "Tenfold tickets" : "Gold";
  return h("span", { class: `pill ${kind}`, "aria-label": `${label} ${value}` }, icon(kind, 2), h("b", { text: num(value) }));
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
    h("button", { class: "icon-btn", type: "button", "aria-label": "Home", onclick: () => go("home") }, icon("home", 2)),
    h("div", { class: "pills" }, pill("gem", state.save.gems), pill("ticket", state.save.tickets), pill("gold", state.save.gold)),
    who,
    h("button", {
      class: "icon-btn",
      type: "button",
      id: "open-settings",
      "aria-label": "Settings",
      onclick: openSettings,
    }, icon(state.save.muted ? "mute" : "sound", 2)),
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
  const items = [["home", "Home"], ["summon", "Summon"], ["units", "Units"], ["party", "Party"]];
  el.replaceChildren(...items.map(([id, label]) => h("button", {
    type: "button",
    "data-go": id,
    class: route.name === id || (id === "units" && route.name === "detail") ? "active" : "",
    onclick: () => go(id),
  }, icon(id === "home" ? "home" : id, 2), h("span", { text: label }))));
}

function viewTitle() {
  const online = state.mode === "online" && state.username;
  return h("section", { class: "title-screen" },
    h("canvas", { class: "pixel logo", "data-logo": "1", role: "img", "aria-label": "Aetherfall" }),
    h("h1", { class: "sr-only", text: "Aetherfall" }),
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

function partyActor(id, index, scale) {
  if (!id || !unitById(id)) {
    return h("div", { class: "actor" }, h("div", { class: "empty-slot", text: "Empty" }), h("p", { class: "actor-name", text: "Vacant" }));
  }
  const unit = unitById(id);
  const leader = state.save.leader === index;
  return h("figure", { class: "actor" },
    h("span", { class: leader ? "crown" : "crown ghost", text: leader ? "Leader" : "" }),
    sprite(id, scale, unit.name),
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
  const scale = partyScale();
  return h("section", { class: "screen" },
    previewNote(),
    state.mode === "offline" && !state.preview ? h("p", { class: "account-note", text: "Offline on this device. Log in to keep gems and tickets on the server." }) : null,
    h("p", { class: "eyebrow", text: "Gatehold" }),
    h("h2", { text: "The cracked terrace" }),
    h("p", { class: "lede", text: "Four places in the wind. The gate hums behind the stones." }),
    state.save.tickets > 0 ? h("p", { class: "gift", text: "A Tenfold Ticket is waiting at the gate." }) : null,
    powerBanner(members),
    h("div", { class: "party-line" }, ...state.save.party.map((id, index) => partyActor(id, index, scale))),
    h("div", { class: "dais", "aria-hidden": "true" }),
    h("div", { class: "home-actions" },
      h("button", { class: "btn", type: "button", onclick: () => go("summon"), text: "Summon" }),
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
    sprite(row.unitId, 2, row.name),
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
      best.rarity >= 5 ? portrait(best.unitId, 2, best.name) : sprite(best.unitId, 3, best.name),
      h("div", {},
        starRow(best.rarity),
        h("h3", { text: best.name }),
        h("p", { class: "meta", text: `${ELEMENT_NAME[unit.element]} · ${ROLE_NAME[unit.role]}` }),
        pullTag(best),
      ),
    ),
    h("div", { class: "results", id: "results" }, ...pack.presentation.map((row) => resultCard(row))),
    h("p", { class: "fine", text: `Pity is now ${state.save.pity[pack.banner.id]} / ${PITY_AT}.` }),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", text: "Summon again", onclick: () => { state.results = null; draw(); } }),
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
  const banner = BANNERS.find((row) => row.id === state.bannerId);
  if (state.mode === "online") {
    const res = await summonOnline(banner.id, count);
    if (!res.ok) {
      if (noteAccountProblem(res)) return;
      toast(res.error || "The gate did not answer.");
      return;
    }
    applyRemote(res.save);
    state.results = { banner, presentation: res.presentation };
    playFx(res.presentation);
    return;
  }
  const payment = payForPull(state.save, count);
  if (!payment.ok) {
    toast("Not enough gems.");
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
  state.results = { banner, presentation: resolved.presentation };
  playFx(resolved.presentation);
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
  const canvas = h("canvas", { class: "pixel", id: "fx-canvas", "aria-hidden": "true" });
  const best = presentation.reduce((max, row) => Math.max(max, row.rarity), 3);
  root.replaceChildren(h("div", { class: "fx-layer", id: "fx-layer" },
    canvas,
    h("p", { class: "fx-caption", text: best >= 5 ? "The Vein breaks open." : "Light gathers in the crystal." }),
    h("button", { class: "btn ghost", id: "skip-summon", type: "button", text: "Skip", onclick: finishFx }),
  ));
  state.fxStop = playSummon(canvas, presentation, {
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
    h("div", { class: "banners" }, ...BANNERS.map((row) => h("button", {
      type: "button",
      class: `banner ${row.id === banner.id ? "selected" : ""}`,
      onclick: () => {
        state.bannerId = row.id;
        blip();
        draw();
      },
    },
      h("canvas", { class: "pixel banner-art", "data-banner": row.art, "aria-hidden": "true" }),
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
      sprite(row.def.id, 2, row.record ? row.def.name : `${row.def.name}, not summoned`),
      starRow(row.def.rarity),
      h("h3", { text: row.def.name }),
      h("p", { class: "meta" }, icon(row.def.element, 1), ` ${ROLE_NAME[row.def.role]}`),
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
    h("div", { class: `splash rarity-${def.rarity}` },
      portrait(def.id, 2, def.name),
    ),
    starRow(def.rarity),
    h("h2", { text: def.name }),
    h("p", { class: "meta badges" },
      h("span", { class: `badge ${def.element}` }, icon(def.element, 1), ELEMENT_NAME[def.element]),
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
    ghost = h("div", { id: "drag-ghost", class: "drag-ghost" }, sprite(id, 2, ""));
    document.body.append(ghost);
    paintUnit(ghost.querySelector("canvas"), id, state.frame, 2);
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
  const scale = Math.max(2, partyScale());
  return h("section", { class: "screen" },
    h("p", { class: "eyebrow", text: "Formation" }),
    h("h2", { text: "Party" }),
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
        id ? sprite(id, scale, unitById(id).name) : h("div", { class: "empty-slot", text: "Empty" }),
        id ? h("p", { class: "actor-name", text: unitById(id).name }) : null,
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
        sprite(def.id, 2, def.name),
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
  return viewHome();
}

function draw(options = {}) {
  const route = current();
  if (route.name !== "summon") state.results = null;
  const app = document.getElementById("app");
  app.classList.toggle("on-title", route.name === "title");
  const view = document.getElementById("view");
  view.dataset.screen = route.name;
  chrome();
  nav();
  view.replaceChildren(viewFor(route));
  paintAll();
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
    draw();
  });
  setInterval(() => {
    state.frame = (state.frame + 1) % FRAME_COUNT;
    paintSprites();
  }, 140);
  if (!location.hash) location.hash = state.banReason ? "#/banned" : "#/title";
  draw({ scroll: true });
  if (current().name === "admin" && state.mode === "online" && state.admin) void loadAdmin("");
}
