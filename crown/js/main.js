import { currentSession } from "./account.js";
import {
  allianceAnswerOnline,
  allianceBoardOnline,
  allianceBrowseOnline,
  allianceCreateOnline,
  allianceDisbandOnline,
  allianceInviteOnline,
  allianceKickOnline,
  allianceLeaveOnline,
  allianceRequestOnline,
  allianceRoleOnline,
  allianceStateOnline,
  allianceTransferOnline,
  attackOnline,
  buySpyOnline,
  oddsOnline,
  reportsOnline,
  spyOnline,
  targetsOnline,
  adminBanOnline,
  adminGrantOnline,
  adminLogOnline,
  adminSearchOnline,
  adminUnbanOnline,
  buildOnline,
  createOnlineKingdom,
  exploreOnline,
  leaderboardOnline,
  logInAccount,
  logOutAccount,
  openKingdom,
  realmOnline,
  refreshKingdom,
  researchOnline,
  signUpAccount,
  trainOnline,
} from "./api.js";
import { clearDemo, freshDemo, loadDemo, saveDemo } from "./demo.js";
import {
  grantResources,
  networth,
  orderBuild,
  orderExplore,
  orderResearch,
  orderTrain,
  settle,
} from "./engine.js";
import { BUILDING_ORDER, NPC_TABLE, TICK_SECONDS, UNIT_ORDER } from "./rules.js";
import { buySpies, createPact, disbandPact, inviteKingdom, kickMember, leavePact, previewOdds, requestJoin, answerRequest, sendArmy, sendSpy, setOfficer, settleMarches, transferPact, warView } from "./war.js";
import { realmRowsFrom, render, tickLabel } from "./ui.js";

const root = document.querySelector("#app");

const model = {
  screen: "boot",
  mode: "demo",
  tab: "throne",
  notice: "",
  tone: "info",
  player: null,
  kingdom: null,
  npcs: [],
  realmRows: [],
  leaderboard: [],
  adminResults: [],
  adminLog: [],
  banned: false,
  banReason: "",
  hasDemo: false,
  busy: false,
  drafts: blankDrafts(),
};

function blankDrafts() {
  const build = {};
  for (const id of BUILDING_ORDER) build[id] = 1;
  const train = {};
  for (const id of UNIT_ORDER) train[id] = id === "militia" ? 10 : 1;
  return { build, train, explore: 8, landType: "", foundName: "", search: "", warSearch: "", target: "", raid: "conquest" };
}

function renderApp() {
  render(root, model, actions);
}

function note(text, tone = "info") {
  model.notice = text || "";
  model.tone = tone;
}

function signed(value) {
  const n = Math.floor(Number(value) || 0);
  return n > 0 ? `+${n}` : String(n);
}

function noteFrom(summary) {
  if (!summary) return;
  const done = (summary.finished || []).filter(Boolean);
  const bits = [];
  if (summary.gold) bits.push(`gold ${signed(summary.gold)}`);
  if (summary.food) bits.push(`food ${signed(summary.food)}`);
  if (summary.peasants) bits.push(`people ${signed(summary.peasants)}`);
  if (summary.research) bits.push(`research ${signed(summary.research)}`);
  if (summary.mana) bits.push(`mana ${signed(summary.mana)}`);
  if (!summary.ticks && !bits.length && !done.length) return;
  let head = "";
  if (summary.ticks === 1) head = "A tick passed";
  else if (summary.ticks > 1) head = `${summary.ticks} ticks passed`;
  const body = [head, bits.join(" · ")].filter(Boolean).join(" · ");
  note(`${body}${body ? "." : ""} ${done.join(" ")}`.trim());
}

function persist() {
  if (model.mode !== "demo" || !model.kingdom) return;
  saveDemo({
    kingdom: model.kingdom,
    npcs: model.npcs,
    alliances: model.alliances,
    members: model.members,
    requests: model.requests,
    reports: model.reports,
    adminLog: model.adminLog,
    banned: model.banned,
    banReason: model.banReason,
  });
}

function showGate(message, tone = "info") {
  model.screen = "gate";
  model.hasDemo = Boolean(loadDemo());
  note(message || "", tone);
  renderApp();
}

async function loadWar() {
  if (model.mode !== "online") {
    syncDemoBoard();
    return;
  }
  const [targets, reports] = await Promise.all([targetsOnline(model.drafts.warSearch || ""), reportsOnline()]);
  if (!targets.ok) note(targets.error, "bad");
  else model.targets = targets.kingdoms || [];
  if (!reports.ok) note(reports.error, "bad");
  else model.reports = reports.reports || [];
}

async function loadAlliances() {
  if (model.mode !== "online") {
    model.allianceView = warView(worldFrom(model, model.kingdom));
    return;
  }
  const [state, browse] = await Promise.all([allianceStateOnline(), allianceBrowseOnline("")]);
  if (!state.ok) {
    note(state.error, "bad");
    return;
  }
  const board = browse.ok ? browse.data.alliances || [] : [];
  model.allianceView = {
    mine: state.data.alliance,
    members: state.data.members || [],
    requests: state.data.requests || [],
    browse: board,
  };
  if (model.kingdom && state.data.alliance) {
    model.kingdom.allianceTag = state.data.alliance.tag;
    model.kingdom.allianceRole = state.data.alliance.role;
    model.kingdom.allianceId = state.data.alliance.id;
  } else if (model.kingdom) {
    model.kingdom.allianceTag = null;
    model.kingdom.allianceRole = null;
    model.kingdom.allianceId = null;
  }
}

async function absorbAlliance(data) {
  const browse = model.allianceView?.browse;
  model.allianceView = {
    mine: data.alliance,
    members: data.members || [],
    requests: data.requests || [],
    browse: browse || [],
  };
  const fresh = await allianceBrowseOnline("");
  if (fresh.ok) model.allianceView.browse = fresh.data.alliances || [];
  if (model.kingdom) {
    model.kingdom.allianceTag = data.alliance?.tag || null;
    model.kingdom.allianceRole = data.alliance?.role || null;
    model.kingdom.allianceId = data.alliance?.id || null;
  }
}

async function pactAction(local, remote) {
  if (model.mode === "demo") {
    try {
      applyWorld(local());
      syncDemoBoard();
      persist();
    } catch (error) {
      note(error.message, "bad");
    }
    renderApp();
    return;
  }
  const res = await remote();
  if (!res.ok) note(res.error, "bad");
  else await absorbAlliance(res.data);
  renderApp();
}

function worldFrom(save, kingdom) {
  return {
    kingdom,
    npcs: save.npcs || [],
    alliances: save.alliances || [],
    members: save.members || [],
    requests: save.requests || [],
    reports: save.reports || [],
  };
}

function applyWorld(world) {
  model.kingdom = world.kingdom;
  model.npcs = world.npcs;
  model.alliances = world.alliances;
  model.members = world.members;
  model.requests = world.requests;
  model.reports = world.reports;
  model.allianceView = warView(world);
  model.kingdom.underAttack = (model.kingdom.marches || []).some((march) => march.kind === "army" && march.phase === "out" && march.target === model.kingdom.name);
}

function enterDemo(save, caughtUp) {
  const result = caughtUp || settle(save.kingdom, Date.now(), { maxTicks: 100000 });
  const marched = settleMarches(worldFrom(save, result.state), Date.now());
  model.mode = "demo";
  model.player = { username: "Local ruler", admin: false };
  applyWorld(marched);
  model.adminLog = save.adminLog || [];
  model.banned = Boolean(save.banned);
  model.banReason = save.banReason || "";
  syncDemoBoard();
  model.screen = "play";
  model.tab = "throne";
  noteFrom(result.summary);
  persist();
  renderApp();
}

function demoAdminRows(query) {
  const q = String(query || "").trim().toLowerCase();
  const rows = [model.kingdom, ...model.npcs].filter((kingdom) => kingdom && (!q || kingdom.name.toLowerCase().includes(q)));
  return rows.map((kingdom) => ({
    name: kingdom.name,
    username: kingdom.isNpc ? null : "you",
    landType: kingdom.landType,
    land_type: kingdom.landType,
    land: kingdom.land,
    gold: kingdom.gold,
    food: kingdom.food,
    networth: networth(kingdom),
    isNpc: Boolean(kingdom.isNpc),
    is_npc: Boolean(kingdom.isNpc),
    banned: !kingdom.isNpc && model.banned,
    ban_reason: model.banReason,
  }));
}

function syncDemoBoard() {
  const rows = realmRowsFrom(model.kingdom, model.npcs).map((row) => {
    const source = row.you ? model.kingdom : model.npcs.find((npc) => npc.name === row.name);
    return { ...row, tag: source?.allianceTag || "" };
  });
  model.realmRows = rows;
  model.leaderboard = rows;
  model.adminResults = demoAdminRows(model.drafts.search);
  model.targets = demoTargets(model.drafts.warSearch);
  model.allianceView = warView(worldFrom(model, model.kingdom));
}

function demoTargets(query) {
  const q = String(query || "").trim().toLowerCase();
  return model.npcs
    .filter((npc) => !q || npc.name.toLowerCase().includes(q))
    .map((npc) => ({
      id: npc.name,
      name: npc.name,
      tag: npc.allianceTag || "",
      realm_name: npc.realmName,
      networth: networth(npc),
      land: npc.land,
      is_npc: true,
      allied: Boolean(model.kingdom.allianceId && npc.allianceId === model.kingdom.allianceId),
      protected: false,
      tier: npc.npcTier || 1,
    }))
    .sort((a, b) => b.networth - a.networth);
}

async function loadBoard() {
  if (model.mode === "demo") {
    syncDemoBoard();
    return;
  }
  const [realm, board] = await Promise.all([realmOnline(), leaderboardOnline()]);
  if (!realm.ok) note(realm.error, "bad");
  else {
    model.realmRows = realm.kingdoms || [];
    if (model.kingdom && realm.realm) model.kingdom.realmCount = realm.realm.count;
  }
  if (board.ok) model.leaderboard = board.kingdoms || [];
  else note(board.error, "bad");
}

function applyOnline(res, quiet) {
  const before = model.kingdom;
  model.mode = "online";
  model.player = res.player;
  model.kingdom = res.kingdom;
  model.banned = false;
  if (!res.kingdom) {
    model.screen = "found";
    return;
  }
  model.screen = "play";
  if (!quiet && before) {
    const summary = {
      ticks: res.kingdom.lastTickAt !== before.lastTickAt ? 1 : 0,
      gold: res.kingdom.gold - before.gold,
      food: res.kingdom.food - before.food,
      peasants: res.kingdom.peasants - before.peasants,
      research: res.kingdom.researchPoints - before.researchPoints,
      mana: res.kingdom.mana - before.mana,
      finished: [],
    };
    const previous = new Set((before.chronicle || []).map((line) => `${line.at}|${line.text}`));
    summary.finished = (res.kingdom.chronicle || []).filter((line) => !previous.has(`${line.at}|${line.text}`)).map((line) => line.text);
    if (summary.ticks || summary.finished.length || summary.gold || summary.food) noteFrom(summary);
  }
}

async function online(work, { quiet = false, board = false, log = false } = {}) {
  if (model.busy) return { ok: false, error: "Wait for the stewards." };
  model.busy = true;
  renderApp();
  try {
    const res = await work();
    if (!res.ok) {
      note(res.error, "bad");
      if (res.banned) model.screen = "gate";
      return res;
    }
    if (res.kingdom || res.player) applyOnline(res, quiet);
    if (board && model.kingdom) await loadBoard();
    if (log && model.player?.admin) {
      const recent = await adminLogOnline();
      if (recent.ok) model.adminLog = recent.data.entries || [];
    }
    return res;
  } finally {
    model.busy = false;
    renderApp();
  }
}

function demoOrder(run) {
  try {
    const settled = settle(model.kingdom, Date.now(), { maxTicks: 100000 });
    const result = run(settled.state);
    const marched = settleMarches(worldFrom(model, result.state), Date.now());
    applyWorld(marched);
    noteFrom(result.summary.ticks || result.summary.finished?.length ? result.summary : { ticks: 0, finished: [], gold: 0, food: 0, peasants: 0, research: 0, mana: 0 });
    const last = model.kingdom.chronicle[model.kingdom.chronicle.length - 1];
    if (last && !result.summary.ticks) note(last.text);
    syncDemoBoard();
    persist();
    renderApp();
  } catch (error) {
    note(error.message || "That order failed.", "bad");
    renderApp();
  }
}

const actions = {
  auth: async (mode, username, password) => {
    const result = mode === "signup" ? await signUpAccount(username, password) : await logInAccount(username, password);
    if (!result.ok) {
      note(result.error, "bad");
      renderApp();
      return;
    }
    const opened = await openKingdom();
    if (!opened.ok) {
      showGate(opened.error, opened.missing ? "info" : "bad");
      return;
    }
    model.mode = "online";
    model.player = opened.player;
    model.kingdom = opened.kingdom;
    model.screen = opened.kingdom ? "play" : "found";
    model.tab = "throne";
    note("");
    if (opened.kingdom) await loadBoard();
    renderApp();
  },
  demo: () => {
    const saved = loadDemo();
    if (saved) {
      enterDemo(saved);
      return;
    }
    model.mode = "demo";
    model.screen = "found";
    model.drafts.landType = "";
    model.drafts.foundName = "";
    note("");
    renderApp();
  },
  abandon: () => {
    if (!window.confirm("Abandon this local kingdom?")) return;
    clearDemo();
    model.kingdom = null;
    model.npcs = [];
    model.hasDemo = false;
    showGate("The local banner was taken down.");
  },
  back: () => showGate(""),
  resume: () => {
    if (!model.kingdom) return;
    model.screen = "play";
    model.tab = "throne";
    note("");
    renderApp();
  },
  pickLand: (id) => {
    model.drafts.landType = id;
    renderApp();
  },
  found: async (name, landType) => {
    if (!landType) {
      note("Choose a land type.", "bad");
      renderApp();
      return;
    }
    if (model.mode === "online" && model.player) {
      await online(() => createOnlineKingdom(name, landType), { quiet: true, board: true });
      if (model.kingdom) note(`The banner of ${model.kingdom.name} was raised.`);
      renderApp();
      return;
    }
    if (NPC_TABLE.some((row) => row.name.toLowerCase() === String(name || "").trim().toLowerCase())) {
      note("That kingdom name is already claimed.", "bad");
      renderApp();
      return;
    }
    try {
      const save = freshDemo({ name, landType, now: Date.now() });
      enterDemo(save, { state: save.kingdom, summary: { ticks: 0, finished: [], gold: 0, food: 0, peasants: 0, research: 0, mana: 0 } });
      note(`The banner of ${save.kingdom.name} was raised.`);
      renderApp();
    } catch (error) {
      note(error.message, "bad");
      renderApp();
    }
  },
  tab: async (id) => {
    model.tab = id;
    if (id === "realm") await loadBoard();
    if (id === "war") {
      await loadWar();
      renderApp();
      return;
    }
    if (id === "alliances") {
      await loadAlliances();
      renderApp();
      return;
    }
    if (id === "steward" && model.mode === "online") {
      const res = await online(() => adminSearchOnline(model.drafts.search || ""), { quiet: true, log: true });
      if (res?.ok) model.adminResults = res.data.kingdoms || [];
      renderApp();
      return;
    }
    if (id === "steward" && model.mode === "demo") model.adminResults = demoAdminRows(model.drafts.search);
    renderApp();
  },
  setBuild: (id, count) => {
    model.drafts.build[id] = count;
    renderApp();
  },
  setTrain: (id, count) => {
    model.drafts.train[id] = count;
    renderApp();
  },
  build: (id) => {
    const count = model.drafts.build[id] || 1;
    if (model.mode === "demo") {
      demoOrder((state) => orderBuild(state, id, count, Date.now()));
      return;
    }
    online(() => buildOnline(id, count));
  },
  explore: () => {
    const acres = Math.floor(Number(model.drafts.explore));
    if (model.mode === "demo") {
      demoOrder((state) => orderExplore(state, acres, Date.now()));
      return;
    }
    online(() => exploreOnline(acres));
  },
  train: (id) => {
    const count = model.drafts.train[id] || 1;
    if (model.mode === "demo") {
      demoOrder((state) => orderTrain(state, id, count, Date.now()));
      return;
    }
    online(() => trainOnline(id, count));
  },
  research: (id) => {
    if (model.mode === "demo") {
      demoOrder((state) => orderResearch(state, id, Date.now()));
      return;
    }
    online(() => researchOnline(id));
  },
  bell: () => {
    if (model.mode !== "demo" || !model.kingdom) return;
    const target = model.kingdom.lastTickAt + TICK_SECONDS * 1000;
    const result = settle(model.kingdom, target, { maxTicks: 1 });
    const marched = settleMarches(worldFrom(model, result.state), target);
    applyWorld(marched);
    noteFrom(result.summary);
    syncDemoBoard();
    persist();
    renderApp();
  },
  refreshBoard: async () => {
    await loadBoard();
    renderApp();
  },
  adminSearch: async (query) => {
    model.drafts.search = String(query || "");
    if (model.mode === "demo") {
      model.adminResults = demoAdminRows(model.drafts.search);
      renderApp();
      return;
    }
    const res = await online(() => adminSearchOnline(model.drafts.search), { quiet: true, log: true });
    if (res?.ok) model.adminResults = res.data.kingdoms || [];
    renderApp();
  },
  grant: async (name, gold, food, land) => {
    if (model.mode === "demo") {
      try {
        if (name !== model.kingdom.name) throw new Error("In a demo you can grant only your own kingdom.");
        const settled = settle(model.kingdom, Date.now(), { maxTicks: 100000 });
        model.kingdom = grantResources(settled.state, { gold, food, land });
        model.adminLog.unshift({ at: Date.now(), action: "grant", label: name, gold, food, land, note: "Local desk" });
        model.adminLog = model.adminLog.slice(0, 20);
        note(`Granted ${gold} gold, ${food} food, and ${land} land to ${name}.`);
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await online(() => adminGrantOnline({ name, gold, food, land, note: "Steward grant" }), { quiet: true });
    if (!res?.ok) return;
    note(`Granted to ${name}.`);
    const found = await adminSearchOnline(model.drafts.search || name);
    if (found.ok) model.adminResults = found.data.kingdoms || [];
    const recent = await adminLogOnline();
    if (recent.ok) model.adminLog = recent.data.entries || [];
    if (model.kingdom && name.toLowerCase() === model.kingdom.name.toLowerCase()) {
      const fresh = await refreshKingdom();
      if (fresh.ok) applyOnline(fresh, true);
    }
    renderApp();
  },
  ban: async (username, reason) => {
    if (model.mode === "demo") {
      if (username !== "you") {
        note("Established houses are not accounts.", "bad");
        renderApp();
        return;
      }
      if (!String(reason || "").trim()) {
        note("A ban needs a reason.", "bad");
        renderApp();
        return;
      }
      model.banned = true;
      model.banReason = String(reason).trim();
      model.adminLog.unshift({ at: Date.now(), action: "ban", label: "you", note: model.banReason });
      note("The local banner is banished.");
      syncDemoBoard();
      persist();
      renderApp();
      return;
    }
    const res = await online(() => adminBanOnline(username, reason), { quiet: true });
    if (!res?.ok) return;
    note(`Banned ${username}.`);
    const found = await adminSearchOnline(model.drafts.search || "");
    if (found.ok) model.adminResults = found.data.kingdoms || [];
    const recent = await adminLogOnline();
    if (recent.ok) model.adminLog = recent.data.entries || [];
    renderApp();
  },
  unban: async (username) => {
    if (model.mode === "demo") {
      model.banned = false;
      model.banReason = "";
      model.adminLog.unshift({ at: Date.now(), action: "unban", label: "you" });
      note("The ban was lifted.");
      syncDemoBoard();
      persist();
      renderApp();
      return;
    }
    const res = await online(() => adminUnbanOnline(username), { quiet: true });
    if (!res?.ok) return;
    note(`Lifted the ban on ${username}.`);
    const found = await adminSearchOnline(model.drafts.search || "");
    if (found.ok) model.adminResults = found.data.kingdoms || [];
    const recent = await adminLogOnline();
    if (recent.ok) model.adminLog = recent.data.entries || [];
    renderApp();
  },
  loadTargets: async (query) => {
    model.drafts.warSearch = String(query || "");
    await loadWar();
    renderApp();
  },
  pickTarget: (row) => {
    model.drafts.target = row.name;
    model.drafts.targetId = row.id;
    model.odds = "";
    renderApp();
  },
  estimate: async (target, sent) => {
    if (model.mode === "demo") {
      const preview = previewOdds(worldFrom(model, model.kingdom), target.name, sent);
      model.odds = preview.note;
      renderApp();
      return;
    }
    const res = await oddsOnline(target.id, sent);
    if (!res.ok) note(res.error, "bad");
    else model.odds = `${res.data.band}. ${res.data.note} Strength on the road: ${res.data.offense}.`;
    renderApp();
  },
  attack: async (target, type, sent) => {
    if (model.mode === "demo") {
      try {
        const world = sendArmy(worldFrom(model, model.kingdom), target.name, type, sent, Date.now());
        applyWorld(world);
        note(`Your host marched on ${target.name}.`);
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    await online(() => attackOnline(target.id, type, sent));
    await loadWar();
    renderApp();
  },
  spy: async (target) => {
    if (model.mode === "demo") {
      try {
        applyWorld(sendSpy(worldFrom(model, model.kingdom), target.name, Date.now()));
        note(`A spy slipped toward ${target.name}.`);
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    await online(() => spyOnline(target.id));
    renderApp();
  },
  buySpy: async (count) => {
    if (model.mode === "demo") {
      try {
        applyWorld(buySpies(worldFrom(model, model.kingdom), count));
        note("A spy joined the household.");
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    await online(() => buySpyOnline(count));
  },
  createPact: async (name, tag, description) => {
    if (model.mode === "demo") {
      try {
        applyWorld(createPact(worldFrom(model, model.kingdom), name, tag, description));
        note(`The pact ${tag.toUpperCase()} is sworn.`);
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await allianceCreateOnline(name, tag, description);
    if (!res.ok) note(res.error, "bad");
    else {
      note("The pact is sworn.");
      await absorbAlliance(res.data);
    }
    renderApp();
  },
  joinPact: async (row) => {
    if (model.mode === "demo") {
      try {
        let world = requestJoin(worldFrom(model, model.kingdom), row.id);
        const pending = world.requests.find((request) => request.status === "pending" && request.allianceId === row.id);
        world = answerRequest(world, pending.id, true);
        applyWorld(world);
        note(`You joined ${row.name}.`);
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await allianceRequestOnline(row.id);
    if (!res.ok) note(res.error, "bad");
    else {
      note("Your request is with the pact.");
      await absorbAlliance(res.data);
    }
    renderApp();
  },
  answer: async (request, accept) => {
    if (model.mode === "demo") {
      try {
        applyWorld(answerRequest(worldFrom(model, model.kingdom), request.id, accept));
        note(accept ? "The request was accepted." : "The request was declined.");
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await allianceAnswerOnline(request.id, accept);
    if (!res.ok) note(res.error, "bad");
    else await absorbAlliance(res.data);
    renderApp();
  },
  invite: async (name) => {
    if (model.mode === "demo") {
      try {
        applyWorld(inviteKingdom(worldFrom(model, model.kingdom), String(name || "")));
        note(`An invitation went to ${name}.`);
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await allianceInviteOnline(String(name || ""));
    if (!res.ok) note(res.error, "bad");
    else await absorbAlliance(res.data);
    renderApp();
  },
  leavePact: async () => {
    if (model.mode === "demo") {
      try {
        applyWorld(leavePact(worldFrom(model, model.kingdom)));
        note("You left the pact.");
        syncDemoBoard();
        persist();
      } catch (error) {
        note(error.message, "bad");
      }
      renderApp();
      return;
    }
    const res = await allianceLeaveOnline();
    if (!res.ok) note(res.error, "bad");
    else await absorbAlliance(res.data);
    const fresh = await refreshKingdom();
    if (fresh.ok) applyOnline(fresh, true);
    renderApp();
  },
  kick: async (name) => {
    await pactAction(() => kickMember(worldFrom(model, model.kingdom), name), () => allianceKickOnline(name));
  },
  officer: async (name, officer) => {
    await pactAction(() => setOfficer(worldFrom(model, model.kingdom), name, officer), () => allianceRoleOnline(name, officer));
  },
  transfer: async (name) => {
    await pactAction(() => transferPact(worldFrom(model, model.kingdom), name), () => allianceTransferOnline(name));
  },
  disband: async () => {
    await pactAction(() => disbandPact(worldFrom(model, model.kingdom)), () => allianceDisbandOnline());
  },
  logout: async () => {
    await logOutAccount();
    model.player = null;
    model.kingdom = null;
    model.mode = "demo";
    showGate("Signed out.");
  },
};

function within(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function boot() {
  renderApp();
  const session = await within(currentSession(), 2500);
  if (!session) {
    showGate("");
    return;
  }
  const opened = await openKingdom();
  if (!opened.ok) {
    showGate(opened.error, opened.missing || opened.banned ? "info" : "bad");
    return;
  }
  model.mode = "online";
  model.player = opened.player;
  model.kingdom = opened.kingdom;
  model.screen = opened.kingdom ? "play" : "found";
  model.tab = "throne";
  note("");
  if (opened.kingdom) await loadBoard();
  renderApp();
}

setInterval(() => {
  const clock = document.getElementById("tick-clock");
  if (clock && model.kingdom) clock.textContent = tickLabel(model.kingdom);
  if (model.busy || model.screen !== "play" || !model.kingdom) return;
  if (Date.now() < model.kingdom.lastTickAt + TICK_SECONDS * 1000) return;
  if (model.mode === "demo") {
    const result = settle(model.kingdom, Date.now(), { maxTicks: 5000 });
    const marched = settleMarches(worldFrom(model, result.state), Date.now());
    const moved = result.summary.ticks || result.summary.finished.length || (marched.reports || []).length !== (model.reports || []).length;
    if (!moved) return;
    applyWorld(marched);
    noteFrom(result.summary);
    syncDemoBoard();
    persist();
    renderApp();
    return;
  }
  online(() => refreshKingdom(), { quiet: false });
}, 1000);

boot();
