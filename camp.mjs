import { act, cast, endRound, newEncounter, parry } from "./rules.mjs";

export const world = [
  "....F.....F..",
  ".FR..S....RF.",
  "....R....R...",
  "..F...R...S..",
  ".S...FCS.R.V.",
  "...R....F....",
  "....S..R...F.",
  ".RF.......R..",
  ".....F.......",
];
export const width = world[0].length;
export const height = world.length;
export const home = 4 * width + 6;
export const terrain = {
  ".": { name: "Meadow" },
  F: { name: "Timber grove", tile: 850 },
  S: { name: "Stone seam", tile: 5 },
  R: { name: "Old waystone", tile: 818 },
  C: { name: "Totem camp", tile: 795 },
  V: { name: "Ember Vault", tile: 757 },
};

const roster = [
  { name: "Mara", role: "Vanguard", sprite: 3863, specialty: "Leads the vault company" },
  { name: "Ivo", role: "Pathfinder", sprite: 3819, specialty: "Scouts twice as fast" },
  { name: "Sable", role: "Quartermaster", sprite: 3805, specialty: "Brings home extra supplies" },
];
export { roster };
export const upgrades = [
  { name: "Hearth", timber: 4, stone: 3, description: "Range 3 from camp or outposts. Unlocks the vault company." },
  { name: "Awaken the Totem", timber: 7, stone: 6, description: "Requires the Ember. Extends range to 4." },
];
export const missionNames = { scout: "Scouting", gather: "Gathering", claim: "Building an outpost", vault: "Delving the vault" };
const times = { scout: 6000, gather: 7000, claim: 9000, vault: 12000 };
const tileAt = id => world[Math.floor(id / width)]?.[id % width];
export const distance = (a, b) => Math.abs(a % width - b % width)
  + Math.abs(Math.floor(a / width) - Math.floor(b / width));
const valid = id => Number.isInteger(id) && id >= 0 && id < width * height;
export const neighbors = id => [id - 1, id + 1, id - width, id + width].filter(other => valid(other) && distance(id, other) === 1);
export const reachable = (game, id) => [home, ...game.outposts].some(anchor => distance(anchor, id) <= game.tier + 1);
export const frontier = (game, id) => !game.revealed.includes(id) && neighbors(id).some(other => game.revealed.includes(other));
export const busy = (game, npc) => game.missions.find(mission => mission.npcs.includes(npc));
const affordable = (game, timber, stone) => game.timber >= timber && game.stone >= stone;

export function newCamp() {
  return {
    version: 1, tier: 1, timber: 1, stone: 1, ember: false,
    revealed: [home, ...neighbors(home)], outposts: [], missions: [],
    log: ["Your spirit is bound to the Totem. Choose a frontier tile and send a scout."],
  };
}

function record(game, message) {
  game.log = [message, ...game.log].slice(0, 8);
}

export function describe(game, id) {
  if (!game.revealed.includes(id)) return frontier(game, id) ? "Uncharted frontier" : "Uncharted";
  if (game.outposts.includes(id)) return "Camp outpost";
  return terrain[tileAt(id)].name;
}

export function missionFor(game, id, npc) {
  if (!valid(id)) return { reason: "Choose a tile on the map." };
  const known = game.revealed.includes(id);
  const tile = known ? tileAt(id) : null;
  const kind = !known ? "scout" : tile === "V" ? "vault" : tile === "R" ? "claim"
    : tile === "F" || tile === "S" ? "gather" : null;
  if (game.missions.some(mission => mission.id === id)) return { reason: "A crew is already on its way here." };
  if (!known && !frontier(game, id)) return { reason: "Scout the edge of known ground first." };
  if (game.outposts.includes(id)) return { reason: "This outpost extends your dispatch range." };
  if (tile === "V" && game.ember) return { reason: "The vault’s ember is already at camp." };
  if (!kind) return { reason: tile === "C" ? "Your Totem can issue orders from here." : "No work at this location." };
  if (!reachable(game, id)) return { reason: "Beyond dispatch range. Upgrade camp or establish a closer outpost." };
  if (kind === "claim" && !affordable(game, 2, 2)) return { reason: "An outpost costs 2 timber and 2 stone." };
  if (kind === "vault" && game.tier < 2) return { reason: "Build the Hearth before sending a vault company." };
  const npcs = kind === "vault" ? roster.map((_, index) => index) : [npc];
  if (npcs.some(member => busy(game, member))) return { reason: kind === "vault" ? "The vault requires all three NPCs." : "This NPC is away." };
  const duration = kind === "scout" && npc === 1 ? times.scout / 2 : times[kind];
  const label = { scout: "Send scout", gather: "Gather supplies", claim: "Build outpost · 2 timber + 2 stone", vault: "Send vault company" }[kind];
  return { kind, npcs, duration, label };
}

export function dispatch(game, id, npc, now) {
  const order = missionFor(game, id, npc);
  if (!order.kind) return false;
  if (order.kind === "claim") {
    game.timber -= 2;
    game.stone -= 2;
  }
  game.missions.push({ id, kind: order.kind, npcs: order.npcs, due: now + order.duration });
  record(game, `${order.kind === "vault" ? "The company" : roster[npc].name} sets out. ${missionNames[order.kind]}.`);
  return true;
}

function reveal(game, ids) {
  game.revealed = [...new Set([...game.revealed, ...ids])];
}

// The company resolves the vault guard encounter using the same AP and spell rules as field combat.
export function breachVault() {
  const fight = newEncounter();
  const [mara, ivo, sable] = fight.party;
  const [guard] = fight.foes;
  parry(fight, mara);
  cast(fight, ivo, guard);
  endRound(fight);
  cast(fight, sable, mara);
  act(fight, mara, guard);
  cast(fight, ivo, guard);
  return guard.hp === 0;
}

export function resolveDue(game, now) {
  const ready = game.missions.filter(mission => mission.due <= now).sort((a, b) => a.due - b.due);
  if (!ready.length) return false;
  game.missions = game.missions.filter(mission => mission.due > now);
  for (const mission of ready) {
    const npc = roster[mission.npcs[0]].name;
    if (mission.kind === "scout") {
      reveal(game, [mission.id]);
      record(game, `${npc} returns. Discovered ${describe(game, mission.id)}.`);
    } else if (mission.kind === "gather") {
      const resource = tileAt(mission.id) === "F" ? "timber" : "stone";
      const amount = mission.npcs[0] === 2 ? 3 : 2;
      game[resource] += amount;
      record(game, `${npc} returns with ${amount} ${resource}.`);
    } else if (mission.kind === "claim") {
      game.outposts.push(mission.id);
      reveal(game, neighbors(mission.id));
      record(game, `${npc} raises a banner. Dispatch range now extends from this outpost.`);
    } else if (breachVault()) {
      game.ember = true;
      record(game, "Mara held the guard while Ivo struck and Sable healed. The Ember is home.");
    } else record(game, "The company withdrew from the vault and returned to camp.");
  }
  return true;
}

export function upgrade(game) {
  const next = upgrades[game.tier - 1];
  if (!next || !affordable(game, next.timber, next.stone) || (game.tier === 2 && !game.ember)) return false;
  game.timber -= next.timber;
  game.stone -= next.stone;
  game.tier++;
  record(game, game.tier === 2 ? "The Hearth is lit. The company can now enter the vault." : "The Ember awakens your Totem. The frontier is yours to explore.");
  return true;
}
