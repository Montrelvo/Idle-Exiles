import { add, capacity, consume, encounter, items, maxHp, maxMp, remove, rollNpc, skill, train, weight } from "./rules.mjs";
import { distance, generateWorld, home, legacyWorld, neighbors, protectedTile, randomFor, terrain, tileAt, validTile } from "./world.mjs";

const recruits = [
  ["Mara", 3863], ["Ivo", 3819], ["Sable", 3805], ["Rowan", 3938],
  ["Tess", 3863], ["Neri", 3819], ["Bryn", 3805], ["Orin", 3938],
];
const recruitInterval = 30000;
const maxPool = 12;
export const buildings = {
  smith: { name: "Smith", timber: 3, stone: 3, recipes: {
    sword: { ore: 3 }, shield: { ore: 2 }, helm: { ore: 2 },
    vest: { hide: 3 }, gloves: { hide: 1 }, greaves: { hide: 2 }, boots: { hide: 2 },
  } },
  apothecary: { name: "Apothecary", timber: 3, stone: 2, recipes: { tonic: { herb: 2 } } },
  tavern: { name: "Tavern", timber: 4, stone: 2, recipes: { meal: { meat: 2 } } },
};
export const upgrades = [
  { name: "Hearth", timber: 4, stone: 3, description: "Range 3 from camp or outposts. Unlocks the vault expedition." },
  { name: "Awaken the Totem", timber: 7, stone: 6, description: "Requires the Ember. Extends range to 4." },
];
export const missionNames = { scout: "Scouting", gather: "Gathering", hunt: "Hunting", claim: "Building an outpost", vault: "Delving the vault" };
const times = { scout: 7000, gather: 9000, hunt: 12000, claim: 10000, vault: 16000 };
export const reachable = (game, id) => [home, ...game.outposts].some(anchor => distance(anchor, id) <= game.tier + 1);
export const frontier = (game, id) => !game.revealed.includes(id) && neighbors(id).some(other => game.revealed.includes(other));
export const busy = (game, npc) => game.missions.find(mission => mission.npcs.includes(npc));
function unassigned(game) {
  const assigned = new Set(game.teams.flatMap(team => team.npcs));
  return game.roster.flatMap((_, id) => assigned.has(id) ? [] : [id]);
}
export const poolSize = game => unassigned(game).length;
export const availableRecruits = game => unassigned(game).filter(id => game.roster[id].hp > 0 && !busy(game, id));
export const poolUpgrade = game => game.poolMax < maxPool
  ? { timber: game.poolMax - 2, stone: game.poolMax - 3 } : null;
const affordable = (game, price) => game.timber >= price.timber && game.stone >= price.stone;
const pay = (game, price) => { game.timber -= price.timber; game.stone -= price.stone; };

export function newCamp(seed = Math.floor(Math.random() * 4294967296), now = Date.now()) {
  const random = randomFor(seed ^ 0x4d617261);
  return {
    version: 3, seed, serial: 0, world: generateWorld(seed), clock: now,
    teams: [], poolMax: 6, nextRecruit: now + recruitInterval,
    tier: 1, timber: 1, stone: 1, ember: false, roster: recruits.slice(0, 4).map(([name, sprite]) => rollNpc(name, sprite, random)),
    revealed: [home, ...neighbors(home)], outposts: [], missions: [],
    stations: Object.fromEntries(Object.keys(buildings).map(id => [id, { built: false, inventory: {} }])),
    log: ["The ward is lit. Form a team of two or more and send it beyond the Totem."],
  };
}

export function restoreCamp(save, now = Date.now()) {
  if ([2, 3].includes(save?.version) && save.world?.length === legacyWorld.length && save.roster?.length) {
    return save.version === 3 ? save : migrateTeams(save, now);
  }
  if (save?.version !== 1 || ![save.revealed, save.outposts, save.missions, save.log].every(Array.isArray)) return null;
  const game = newCamp(undefined, now);
  Object.assign(game, {
    tier: save.tier, timber: save.timber, stone: save.stone, ember: save.ember,
    revealed: save.revealed, outposts: save.outposts, world: [...legacyWorld],
    missions: save.missions.map(order => ({ ...order, buffs: [], seed: game.serial++ + game.seed, legacy: true })),
    log: ["Camp records upgraded. Your map, supplies and outstanding orders were preserved.", ...save.log].slice(0, 10),
  });
  return migrateTeams(game, now);
}

function migrateTeams(save, now) {
  const teams = [];
  const missions = save.missions.map(mission => {
    if (mission.npcs.length < 2) return mission;
    const team = { name: "Expedition " + (teams.length + 1), npcs: [...mission.npcs],
      order: { tile: mission.id, kind: mission.kind, meal: false } };
    teams.push(team);
    return { ...mission, team: teams.length - 1 };
  });
  const game = { ...save, version: 3, teams, missions, poolMax: 6, nextRecruit: null };
  game.poolMax = Math.max(game.poolMax, 2 * Math.ceil(poolSize(game) / 2));
  scheduleRecruit(game, now);
  return game;
}

function record(game, message) {
  game.log = [message, ...game.log].slice(0, 10);
}

function scheduleRecruit(game, now) {
  if (poolSize(game) >= game.poolMax) game.nextRecruit = null;
  else game.nextRecruit ??= now + recruitInterval;
}

function recruitDue(game, now) {
  scheduleRecruit(game, now);
  if (game.nextRecruit === null || now < game.nextRecruit) return false;
  const arrivals = Math.min(game.poolMax - poolSize(game), 1 + Math.floor((now - game.nextRecruit) / recruitInterval));
  for (let i = 0; i < arrivals; i++) {
    const id = game.roster.length;
    const [base, sprite] = recruits[id % recruits.length];
    const cycle = Math.floor(id / recruits.length);
    const name = cycle ? base + " " + (cycle + 1) : base;
    game.roster.push(rollNpc(name, sprite, randomFor(game.seed ^ Math.imul(id + 1, 0x9e3779b9))));
    record(game, name + " found shelter at the Totem.");
  }
  game.nextRecruit += arrivals * recruitInterval;
  scheduleRecruit(game, now);
  return true;
}

export function upgradePool(game, now) {
  const price = poolUpgrade(game);
  if (!price || !affordable(game, price)) return false;
  pay(game, price);
  game.poolMax += 2;
  scheduleRecruit(game, now);
  record(game, "The camp can shelter " + game.poolMax + " unassigned recruits.");
  return true;
}

export function createTeam(game, name, members, now) {
  name = name.trim();
  if (!name || name.length > 32 || game.teams.some(team => team.name.toLowerCase() === name.toLowerCase())) return false;
  const available = new Set(availableRecruits(game));
  if (members.length < 2 || new Set(members).size !== members.length || members.some(id => !available.has(id))) return false;
  game.teams.push({ name, npcs: [...members], order: null });
  scheduleRecruit(game, now);
  record(game, name + " formed at the Totem.");
  return true;
}

export function describe(game, id) {
  if (!game.revealed.includes(id)) return frontier(game, id) ? "Uncharted frontier" : "Uncharted";
  if (game.outposts.includes(id)) return "Camp outpost";
  return terrain[tileAt(game, id)].name;
}

export function ordersAt(game, id) {
  if (!validTile(id)) return [];
  if (!game.revealed.includes(id)) return frontier(game, id) ? ["scout"] : [];
  const tile = tileAt(game, id);
  if (tile === "C") return [];
  if (tile === "V") return game.ember ? [] : ["vault"];
  const orders = [];
  if (tile === "R" && !game.outposts.includes(id)) orders.push("claim");
  if (["F", "S", "A", "."].includes(tile)) orders.push("gather");
  if (!protectedTile(id)) orders.push("hunt");
  return orders;
}

export function missionFor(game, id, members, kind, meal = false) {
  if (!ordersAt(game, id).includes(kind)) return { reason: protectedTile(id) ? "The Totem ward keeps monsters outside." : "Choose a frontier tile or a revealed work site." };
  if (!reachable(game, id)) return { reason: "Beyond dispatch range. Upgrade camp or claim an outpost." };
  if (game.missions.some(mission => mission.id === id)) return { reason: "A team is already assigned to this tile." };
  if (!Array.isArray(members) || new Set(members).size !== members.length || members.length < 2) return { reason: "Choose at least two NPCs to form a team." };
  if (members.some(id => !game.roster[id] || busy(game, id) || game.roster[id].hp <= 0)) return { reason: "Every member must be at camp and able to travel." };
  if (kind === "claim" && !affordable(game, { timber: 2, stone: 2 })) return { reason: "An outpost costs 2 timber and 2 stone." };
  if (kind === "vault" && game.tier < 2) return { reason: "Build the Hearth before sending a vault team." };
  if (meal && (!game.stations.tavern.built || !game.stations.tavern.inventory.meal)) return { reason: "Cook a meal at the tavern first." };
  const skillId = kind === "scout" ? "scouting" : kind === "gather" || kind === "claim" ? "gathering" : "survival";
  const best = Math.max(...members.map(id => skill(game.roster[id], skillId)));
  return { kind, duration: Math.max(3000, times[kind] - best * 350) };
}

export function setTeamOrder(game, index, tile, kind, meal) {
  const team = game.teams[index];
  if (!team || !ordersAt(game, tile).includes(kind) || !reachable(game, tile)) return false;
  team.order = { tile, kind, meal };
  return true;
}

export function dispatchTeam(game, index, now) {
  const team = game.teams[index];
  if (!team?.order) return false;
  const { tile: id, kind, meal } = team.order;
  const members = team.npcs;
  const order = missionFor(game, id, members, kind, meal);
  if (!order.kind) return false;
  if (kind === "claim") pay(game, { timber: 2, stone: 2 });
  const seed = (game.seed ^ Math.imul(++game.serial, 0x9e3779b9)) >>> 0;
  const random = randomFor(seed);
  const leader = members.map(index => game.roster[index]).reduce((best, npc) => skill(npc, "survival") > skill(best, "survival") ? npc : best);
  const buff = meal ? consume(leader, "meal", game.stations.tavern.inventory, random) : 0;
  game.missions.push({ id, kind, team: index, npcs: [...members], buffs: members.map(() => buff), seed, due: now + order.duration });
  record(game, team.name + " set out. " + missionNames[kind]
    + (meal ? (buff ? " with a stew buff." : ". The stew was wasted.") : "."));
  return true;
}

function reveal(game, ids) {
  game.revealed = [...new Set([...game.revealed, ...ids])];
}

function distribute(team, loot) {
  let carried = 0;
  let left = 0;
  for (const [id, count] of Object.entries(loot)) {
    for (let i = 0; i < count; i++) {
      const npc = team.find(member => member.hp > 0 && weight(member) + items[id].weight <= capacity(member));
      if (npc) { add(npc.pack, id); carried++; }
      else left++;
    }
  }
  return " Recovered " + carried + " units." + (left ? " Left " + left + " behind for lack of carry space." : " Unload supplies at camp.");
}

function finish(game, mission) {
  const team = mission.npcs.map(id => game.roster[id]);
  const names = team.map(npc => npc.name).join(" and ");
  if (mission.kind === "scout") {
    reveal(game, [mission.id]);
    team.forEach(npc => train(npc, "scouting", 2));
    record(game, names + " charted " + describe(game, mission.id) + ".");
  } else if (mission.kind === "gather") {
    const type = tileAt(game, mission.id);
    const amount = 2 + Math.floor(team.reduce((sum, npc) => sum + skill(npc, "gathering"), 0) / 4);
    team.forEach(npc => train(npc, "gathering", 2));
    const loot = type === "F" ? { timber: amount } : type === "S" ? { stone: amount, ore: 2 } : { herb: amount };
    if (mission.legacy) {
      game.timber += loot.timber ?? 0;
      game.stone += loot.stone ?? 0;
      record(game, names + " finished their original supply order.");
    } else record(game, names + " returned from gathering." + distribute(team, loot));
  } else if (mission.kind === "claim") {
    game.outposts.push(mission.id);
    reveal(game, neighbors(mission.id));
    team.forEach(npc => train(npc, "gathering"));
    record(game, names + " built an outpost. Dispatch range now extends from it.");
  } else if (protectedTile(mission.id)) {
    record(game, "The Totem ward repelled the encounter.");
  } else if (encounter(team, mission.kind === "vault", mission.buffs, randomFor(mission.seed))) {
    team.forEach(npc => train(npc, "survival", 2));
    if (mission.kind === "vault") game.ember = true;
    const den = tileAt(game, mission.id) === "H";
    record(game, names + (mission.kind === "vault" ? " recovered the Ember." : " defeated a monster.")
      + distribute(team, { meat: den ? 4 : 2, hide: den ? 3 : 1 }));
  } else record(game, names + " retreated to the Totem to recover.");
}

function regenerate(game, until) {
  const seconds = Math.max(0, Math.floor((until - game.clock) / 1000));
  if (!seconds) return false;
  game.clock += seconds * 1000;
  let changed = false;
  game.roster.forEach((npc, id) => {
    if (busy(game, id)) return;
    const hp = Math.min(maxHp(npc), npc.hp + seconds * game.tier);
    const mp = Math.min(maxMp(npc), npc.mp + seconds);
    changed ||= npc.hp !== hp || npc.mp !== mp;
    npc.hp = hp;
    npc.mp = mp;
  });
  return changed;
}

export function resolveDue(game, now) {
  const ready = game.missions.filter(mission => mission.due <= now).sort((a, b) => a.due - b.due);
  for (const mission of ready) {
    regenerate(game, mission.due);
    game.missions = game.missions.filter(other => other !== mission);
    finish(game, mission);
  }
  const rested = regenerate(game, now);
  const recruited = recruitDue(game, now);
  return rested || recruited || ready.length > 0;
}

export function upgrade(game) {
  const next = upgrades[game.tier - 1];
  if (!next || !affordable(game, next) || (game.tier === 2 && !game.ember)) return false;
  pay(game, next);
  game.tier++;
  record(game, game.tier === 2 ? "The Hearth is lit. The vault expedition is available." : "The Ember awakens the Totem.");
  return true;
}

export function build(game, id) {
  const definition = buildings[id];
  if (!definition || game.stations[id].built || !affordable(game, definition)) return false;
  pay(game, definition);
  game.stations[id].built = true;
  record(game, definition.name + " is ready.");
  return true;
}

export function craft(game, station, id) {
  const inventory = game.stations[station]?.inventory;
  const recipe = buildings[station]?.recipes[id];
  if (!game.stations[station]?.built || !recipe || !Object.entries(recipe).every(([key, count]) => (inventory[key] ?? 0) >= count)) return false;
  for (const [key, count] of Object.entries(recipe)) remove(inventory, key, count);
  add(inventory, id);
  record(game, items[id].name + " crafted at the " + buildings[station].name + ".");
  return true;
}

export function unload(game, id) {
  const npc = game.roster[id];
  if (!npc || busy(game, id)) return false;
  let changed = false;
  for (const [item, count] of Object.entries(npc.pack)) {
    if (!["timber", "stone", "ore", "hide", "herb", "meat"].includes(item)) continue;
    const store = items[item].store;
    if (store === "stockpile") game[item] += count;
    else add(game.stations[store].inventory, item, count);
    delete npc.pack[item];
    changed = true;
  }
  if (changed) record(game, npc.name + " unloaded gathered supplies.");
  return changed;
}

export function take(game, index, station, id) {
  const npc = game.roster[index];
  const store = game.stations[station];
  const item = items[id];
  if (!npc || busy(game, index) || !store?.built || !store.inventory[id] || !item?.skill
    || id === "meal" || weight(npc) + item.weight > capacity(npc)) return false;
  remove(store.inventory, id);
  add(npc.pack, id);
  return true;
}

export function returnItem(game, index, id) {
  const npc = game.roster[index];
  const station = game.stations[items[id]?.store];
  if (!npc?.pack[id] || busy(game, index) || !items[id].skill || !station?.built) return false;
  remove(npc.pack, id);
  add(station.inventory, id);
  return true;
}

export function equip(game, index, id) {
  const npc = game.roster[index];
  const slot = items[id]?.slot;
  if (!npc?.pack[id] || busy(game, index) || !slot) return false;
  remove(npc.pack, id);
  if (npc.equipment[slot]) add(npc.pack, npc.equipment[slot]);
  npc.equipment[slot] = id;
  return true;
}

export function unequip(game, index, slot) {
  const npc = game.roster[index];
  if (!npc?.equipment[slot] || busy(game, index)) return false;
  add(npc.pack, npc.equipment[slot]);
  delete npc.equipment[slot];
  return true;
}

export function useTonic(game, index) {
  const npc = game.roster[index];
  if (!npc?.pack.tonic || busy(game, index) || npc.hp <= 0 || (npc.hp === maxHp(npc) && npc.mp === maxMp(npc))) return false;
  const amount = consume(npc, "tonic", npc.pack, randomFor(game.seed ^ Math.imul(++game.serial, 0x9e3779b9)));
  npc.hp = Math.min(maxHp(npc), npc.hp + amount);
  npc.mp = Math.min(maxMp(npc), npc.mp + Math.floor(amount / 2));
  record(game, amount ? npc.name + " used a restorative tonic." : npc.name + " wasted a tonic through poor Medicine skill.");
  return true;
}
