import {
  build, buildings, busy, craft, describe, dispatch, equip, frontier, missionFor, missionNames,
  newCamp, ordersAt, reachable, recruit, resolveDue, restoreCamp, returnItem, take, unequip, unload, upgrade, upgrades, useTonic,
} from "./camp.mjs";
import { capacity, items, maxHp, maxMp, skill, skills, slots, stats, weight } from "./rules.mjs";
import { height, home, protectedTile, terrain, tileAt, width } from "./world.mjs";

const atlas = "./assets/ProjectUtumno_full.png";
const storageKey = "idle-exiles-camp-v1";
const byId = id => document.getElementById(id);
const canvas = byId("board");
const Phaser = globalThis.Phaser;
const tileSize = 32;
const initialTeam = () => new Set([0, 1]);
let game = loadCamp();
let selected = home;
let members = initialTeam();
let inspectedNpc = null;
let inspectedTile = null;
let paint;
let party = [];
let previousLog;
let previousStations;
let previousLoadout;
let previousOrders;

function loadCamp() {
  try {
    const save = restoreCamp(JSON.parse(localStorage.getItem(storageKey)));
    if (save) return save;
  } catch {
    // An unavailable local save should still allow a new camp.
  }
  return newCamp();
}

function saveCamp() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(game));
  } catch {
    byId("reset").previousElementSibling.textContent = "Device storage is unavailable. This camp lasts for this session.";
  }
}

const tileCenter = index => (index + .5) * tileSize;

function setupScene() {
  new Phaser.Game({
    type: Phaser.CANVAS,
    canvas,
    width: width * tileSize,
    height: height * tileSize,
    pixelArt: true,
    input: false,
    audio: { noAudio: true },
    backgroundColor: "#101010",
    scene: {
      preload() {
        this.load.on("loaderror", () => {
          byId("loading").textContent = "The terrain atlas could not be loaded.";
        });
        this.load.spritesheet("atlas", atlas, { frameWidth: tileSize, frameHeight: tileSize });
      },
      create() {
        if (!this.textures.exists("atlas")) return;
        const tiles = game.world.map((_, id) => {
          const x = id % width;
          const y = Math.floor(id / width);
          const cx = tileCenter(x);
          const cy = tileCenter(y);
          const base = this.add.image(cx, cy, "atlas", 590);
          const shade = this.add.rectangle(cx, cy, tileSize, tileSize, 0x000000);
          const feature = this.add.image(cx, cy, "atlas", 0);
          const ward = this.add.rectangle(cx, cy, tileSize - 1, tileSize - 1, 0x48abc8, .14);
          ward.setVisible(protectedTile(id));
          const trail = this.add.image(cx + 4, cy - 4, "atlas", 0).setScale(.72);
          return { id, base, shade, feature, trail };
        });
        const outline = this.add.rectangle(0, 0, tileSize - 3, tileSize - 3).setStrokeStyle(1, 0xffb559);
        paint = () => {
          for (const { id, base, shade, feature, trail } of tiles) {
            const type = tileAt(game, id);
            const known = game.revealed.includes(id);
            const border = frontier(game, id) && reachable(game, id);
            const outpost = game.outposts.includes(id);
            const glow = known ? .7 + ((id * 5) % 7) * .035 : border ? .24 : .105;
            base.setFrame(known ? (type === "S" || type === "V" ? 257 : 590) : 1149);
            shade.setAlpha(1 - glow);
            feature.setVisible(known && terrain[type].tile !== undefined);
            feature.setFrame(outpost ? 1358 : terrain[type].tile ?? 0);
            const mission = game.missions.find(order => order.id === id);
            trail.setVisible(Boolean(mission));
            if (mission) trail.setFrame(game.roster[mission.npcs[0]].sprite);
          }
          outline.setPosition(tileCenter(selected % width), tileCenter(Math.floor(selected / width)));
        };
        tick();
        byId("loading").hidden = true;
      },
    },
  });
}


const labels = { scout: "Scout", gather: "Gather resources", hunt: "Hunt monsters", claim: "Build outpost (2 timber + 2 stone)", vault: "Recover the Ember" };
const secondsLeft = (due, now) => Math.max(0, Math.ceil((due - now) / 1000));
const inventoryText = inventory => Object.entries(inventory).map(([id, count]) => items[id].name + " ×" + count).join(" · ") || "Empty";
const canPay = cost => game.timber >= cost.timber && game.stone >= cost.stone;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function action(label, handler, disabled = false) {
  const button = element("button", label);
  button.type = "button";
  button.disabled = disabled;
  button.onclick = () => mutate(handler);
  return button;
}

function populateRoster() {
  party = game.roster.map((npc, index) => {
    const row = element("div", "", "roster-row");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.setAttribute("aria-label", "Include " + npc.name + " in team");
    check.onchange = () => {
      if (check.checked) members.add(index);
      else members.delete(index);
      tick();
    };
    const button = element("button", "", "member");
    const portrait = element("span", "", "portrait");
    portrait.style.backgroundPosition = (-(npc.sprite % 64) * 32) + "px " + (-Math.floor(npc.sprite / 64) * 32) + "px";
    const label = element("span", npc.name);
    const status = element("span", "", "stats");
    label.append(status);
    button.append(portrait, label);
    button.onclick = () => {
      inspectedNpc = index;
      previousLoadout = null;
      renderNpc();
      byId("npc-dialog").showModal();
    };
    row.append(check, button);
    return { row, check, status };
  });
  byId("party").replaceChildren(...party.map(entry => entry.row));
}

function renderNpc() {
  const index = inspectedNpc;
  const npc = game.roster[index];
  if (!npc) return;
  const away = Boolean(busy(game, index));
  byId("npc-title").textContent = npc.name;
  byId("npc-vitals").textContent = npc.hp + "/" + maxHp(npc) + " HP · " + npc.mp + "/" + maxMp(npc) + " MP · "
    + weight(npc) + "/" + capacity(npc) + " carry weight" + (away ? " · Away on a mission" : " · Within the Totem ward");
  const available = Object.entries(game.stations).flatMap(([station, store]) => store.built
    ? Object.keys(store.inventory).filter(id => items[id].skill && id !== "meal").map(id => [station, id]) : []);
  const signature = JSON.stringify([npc.stats, npc.practice, npc.pack, npc.equipment, away, available,
    npc.hp < maxHp(npc) || npc.mp < maxMp(npc)]);
  if (signature === previousLoadout) return;
  previousLoadout = signature;
  const statGrid = element("div", "", "stat-grid");
  for (const [id, label] of Object.entries(stats)) statGrid.append(element("span", label + " " + npc.stats[id]));
  const skillGrid = element("div", "", "stat-grid");
  for (const [id, [label]] of Object.entries(skills)) {
    skillGrid.append(element("span", label + " " + skill(npc, id) + " · " + (npc.practice[id] ?? 0) + " practice"));
  }
  const equipment = Object.entries(slots).map(([slot, label]) => {
    const item = npc.equipment[slot];
    const row = element("div", "", "detail-row");
    row.append(element("span", label + " · " + (item ? items[item].name : "Empty")));
    if (item) row.append(action("Unequip", () => unequip(game, index, slot), away));
    return row;
  });
  const pack = Object.keys(npc.pack).map(id => {
    const item = items[id];
    const row = element("div", "", "detail-row");
    row.append(element("span", item.name + " ×" + npc.pack[id]));
    if (item.slot) row.append(action("Equip", () => equip(game, index, id), away));
    if (id === "tonic") row.append(action("Use", () => useTonic(game, index), away || (npc.hp === maxHp(npc) && npc.mp === maxMp(npc))));
    if (item.skill) row.append(action("Return to workshop", () => returnItem(game, index, id), away));
    return row;
  });
  const supplies = available.map(([station, id]) =>
    action("Take " + items[id].name, () => take(game, index, station, id), away || weight(npc) + items[id].weight > capacity(npc)));
  byId("npc-loadout").replaceChildren(
    element("h3", "Stats"), statGrid, element("h3", "Skills"), skillGrid,
    element("h3", "Equipment"), ...equipment, element("h3", "Pack"), ...(pack.length ? pack : [element("p", "Empty")]),
    action("Unload field resources", () => unload(game, index), away || !Object.keys(npc.pack).some(id => !items[id].skill)),
    element("h3", "Take from workshops"), ...(supplies.length ? supplies : [element("p", "No gear or tonics ready.")]),
  );
}

function renderStations() {
  const signature = JSON.stringify([game.timber, game.stone, game.stations]);
  if (signature === previousStations) return;
  previousStations = signature;
  byId("stations").replaceChildren(...Object.entries(buildings).map(([id, definition]) => {
    const { built, inventory } = game.stations[id];
    const card = element("article", "", "station");
    card.append(element("h3", definition.name), element("p", inventoryText(inventory), "hint"));
    if (!built) card.append(action("Build · " + definition.timber + " timber / " + definition.stone + " stone", () => build(game, id), !canPay(definition)));
    else for (const [item, recipe] of Object.entries(definition.recipes)) {
      const enough = Object.entries(recipe).every(([material, count]) => (inventory[material] ?? 0) >= count);
      card.append(action("Make " + items[item].name + " · " + inventoryText(recipe), () => craft(game, id, item), !enough));
    }
    return card;
  }));
}

function renderTile(now) {
  if (inspectedTile === null) return;
  const mission = game.missions.find(order => order.id === inspectedTile);
  byId("tile-title").textContent = describe(game, inspectedTile);
  byId("tile-activity").textContent = mission
    ? mission.npcs.map(id => game.roster[id].name).join(" + ") + " · " + missionNames[mission.kind] + " · " + secondsLeft(mission.due, now) + "s remaining."
    : (protectedTile(inspectedTile) ? "Within the Totem ward. Monsters cannot enter. " : "") + "No team working here.";
}

function inspectTile() {
  if (!game.revealed.includes(selected)) return;
  inspectedTile = selected;
  renderTile(Date.now());
  byId("tile-dialog").showModal();
}

function refresh(now) {
  paint?.();
  if (party.length !== game.roster.length) populateRoster();
  party.forEach(({ check, status }, index) => {
    const npc = game.roster[index];
    const mission = busy(game, index);
    check.checked = members.has(index);
    status.textContent = mission ? missionNames[mission.kind] + " · " + secondsLeft(mission.due, now) + "s"
      : "At camp · " + npc.hp + " HP / " + npc.mp + " MP · " + weight(npc) + "/" + capacity(npc) + " wt";
  });
  byId("recruit").disabled = game.roster.length >= 8 || now < game.nextRecruit;
  byId("recruit").textContent = game.roster.length >= 8 ? "Camp roster full" : now < game.nextRecruit
    ? "Next recruit in " + secondsLeft(game.nextRecruit, now) + "s" : "Welcome a recruit";
  byId("survey").textContent = game.revealed.length + " / " + game.world.length + " charted";
  byId("location").textContent = describe(game, selected);
  byId("inspect-tile").disabled = !game.revealed.includes(selected);
  const orders = ordersAt(game, selected);
  const select = byId("mission-kind");
  const orderSignature = selected + orders.join(",");
  if (orderSignature !== previousOrders) {
    previousOrders = orderSignature;
    select.replaceChildren(...(orders.length ? orders.map(kind => new Option(labels[kind], kind)) : [new Option("No orders", "")]));
  }
  select.disabled = !orders.length;
  const mealAvailable = game.stations.tavern.built && Boolean(game.stations.tavern.inventory.meal);
  byId("meal-option").hidden = !mealAvailable;
  if (!mealAvailable) byId("meal").checked = false;
  const order = missionFor(game, selected, [...members], select.value, byId("meal").checked);
  byId("dispatch").disabled = !order.kind;
  byId("order-note").textContent = order.reason ?? members.size + " NPCs · returns in about " + Math.ceil(order.duration / 1000) + "s";
  byId("supplies").textContent = "Tier " + game.tier + " · " + game.timber + " timber · " + game.stone + " stone · " + game.outposts.length
    + (game.outposts.length === 1 ? " outpost" : " outposts") + (game.ember ? " · Ember recovered" : "");
  const next = upgrades[game.tier - 1];
  byId("upgrade").hidden = !next;
  byId("upgrade-note").textContent = next
    ? next.description + " Cost: " + next.timber + " timber and " + next.stone + " stone."
    : "The Totem is awake. Chart and settle the remaining frontier.";
  if (next) {
    byId("upgrade").textContent = next.name;
    byId("upgrade").disabled = !canPay(next) || (game.tier === 2 && !game.ember);
  }
  if (previousLog !== game.log) {
    previousLog = game.log;
    byId("log").replaceChildren(...game.log.map(message => element("li", message)));
  }
  renderStations();
  renderNpc();
  renderTile(now);
}

function tick() {
  const now = Date.now();
  if (resolveDue(game, now)) saveCamp();
  refresh(now);
}

function mutate(handler) {
  const now = Date.now();
  const settled = resolveDue(game, now);
  if (handler(now) || settled) saveCamp();
  refresh(now);
}

function pointAt(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * width / rect.width);
  const y = Math.floor((event.clientY - rect.top) * height / rect.height);
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  selected = y * width + x;
  tick();
  return true;
}

try {
  setupScene();
  canvas.addEventListener("pointerup", pointAt);
  canvas.addEventListener("dblclick", event => { if (pointAt(event)) inspectTile(); });
  canvas.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      byId("dispatch").click();
      return;
    }
    const offset = { ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowUp: [0, -1] }[event.key];
    if (!offset) return;
    event.preventDefault();
    const [dx, dy] = offset;
    const x = Math.max(0, Math.min(width - 1, selected % width + dx));
    const y = Math.max(0, Math.min(height - 1, Math.floor(selected / width) + dy));
    selected = y * width + x;
    tick();
  });
  byId("mission-kind").onchange = tick;
  byId("meal").onchange = tick;
  byId("inspect-tile").onclick = inspectTile;
  byId("tile-dialog").onclose = () => { inspectedTile = null; };
  byId("npc-dialog").onclose = () => { inspectedNpc = null; };
  byId("dispatch").onclick = () => mutate(now => dispatch(game, selected, [...members], byId("mission-kind").value, byId("meal").checked, now));
  byId("upgrade").onclick = () => mutate(() => upgrade(game));
  byId("recruit").onclick = () => mutate(now => recruit(game, now));
  byId("reset").onclick = () => {
    if (!confirm("Start over and replace this camp?")) return;
    game = newCamp();
    selected = home;
    members = initialTeam();
    party = [];
    previousOrders = null;
    saveCamp();
    tick();
  };
  tick();
  saveCamp();
  setInterval(tick, 1000);
} catch (error) {
  byId("loading").textContent = "Phaser could not start the frontier map.";
  console.error(error);
}
