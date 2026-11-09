import {
  busy, describe, dispatch, frontier, height, home, missionFor, missionNames,
  newCamp, reachable, resolveDue, roster, terrain, upgrade, upgrades, width, world,
} from "./camp.mjs";

const atlas = "./assets/ProjectUtumno_full.png";
const storageKey = "idle-exiles-camp-v1";
const byId = id => document.getElementById(id);
const canvas = byId("board");
const Phaser = globalThis.Phaser;
const tileSize = 32;
let game = loadCamp();
let selected = home;
let activeNpc = 1;
let previousLog;

function loadCamp() {
  try {
    const save = JSON.parse(localStorage.getItem(storageKey));
    if (save?.version === 1 && [1, 2, 3].includes(save.tier)
      && [save.revealed, save.outposts, save.missions, save.log].every(Array.isArray)) return save;
  } catch {
    // The camp can still run in a browser with storage disabled.
  }
  return newCamp();
}

function saveCamp() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(game));
  } catch {
    byId("reset").previousElementSibling.textContent = "Browser storage is unavailable. This camp lasts for this session.";
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
        const tiles = world.flatMap((row, y) => [...row].map((type, x) => {
          const cx = tileCenter(x);
          const cy = tileCenter(y);
          const base = this.add.image(cx, cy, "atlas", 590);
          const shade = this.add.rectangle(cx, cy, tileSize, tileSize, 0x000000);
          const feature = this.add.image(cx, cy, "atlas", terrain[type].tile ?? 0);
          const trail = this.add.image(cx + 4, cy - 4, "atlas", 0).setScale(.72);
          return { id: y * width + x, type, base, shade, feature, trail };
        }));
        const outline = this.add.rectangle(0, 0, tileSize - 3, tileSize - 3).setStrokeStyle(1, 0xffb559);
        paint = () => {
          for (const { id, type, base, shade, feature, trail } of tiles) {
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
            if (mission) trail.setFrame(roster[mission.npcs[0]].sprite);
          }
          outline.setPosition(tileCenter(selected % width), tileCenter(Math.floor(selected / width)));
        };
        tick();
        byId("loading").hidden = true;
      },
    },
  });
}

const partyButtons = roster.map((npc, index) => {
  const button = document.createElement("button");
  button.className = "member";
  const portrait = document.createElement("span");
  portrait.className = "portrait";
  portrait.style.backgroundPosition = (-(npc.sprite % 64) * 32) + "px " + (-Math.floor(npc.sprite / 64) * 32) + "px";
  const label = document.createElement("span");
  label.textContent = (index + 1) + ". " + npc.name + " · " + npc.role;
  const stats = document.createElement("span");
  stats.className = "stats";
  label.append(stats);
  button.append(portrait, label);
  button.onclick = () => selectNpc(index);
  byId("party").append(button);
  return { button, stats };
});

let paint;
function refresh(now) {
  paint?.();
  for (const [index, npc] of roster.entries()) {
    const { button, stats } = partyButtons[index];
    const mission = busy(game, index);
    button.setAttribute("aria-pressed", String(index === activeNpc));
    stats.textContent = mission ? missionNames[mission.kind] + " · " + Math.ceil((mission.due - now) / 1000) + "s"
      : "At camp · " + npc.specialty;
  }
  byId("survey").textContent = game.revealed.length + " / " + (width * height) + " charted";
  byId("location").textContent = describe(game, selected);
  const order = missionFor(game, selected, activeNpc);
  byId("dispatch").textContent = order.label ?? "Dispatch";
  byId("dispatch").disabled = !order.kind;
  byId("order-note").textContent = order.reason ?? (order.npcs.length === 1 ? roster[activeNpc].name : "Whole company")
    + " · returns in " + (order.duration / 1000) + "s";
  byId("supplies").textContent = "Tier " + game.tier + " · " + game.timber + " timber · " + game.stone + " stone · " + game.outposts.length
    + (game.outposts.length === 1 ? " outpost" : " outposts") + (game.ember ? " · Ember recovered" : "");
  const next = upgrades[game.tier - 1];
  byId("upgrade").hidden = !next;
  byId("upgrade-note").textContent = next
    ? next.description + " Cost: " + next.timber + " timber and " + next.stone + " stone."
    : "The Totem is awake. Chart and settle the remaining frontier.";
  if (next) {
    byId("upgrade").textContent = next.name;
    byId("upgrade").disabled = game.timber < next.timber || game.stone < next.stone || (game.tier === 2 && !game.ember);
  }
  if (previousLog !== game.log) {
    previousLog = game.log;
    byId("log").replaceChildren(...game.log.map(message => {
      const entry = document.createElement("li");
      entry.textContent = message;
      return entry;
    }));
  }
}

function selectNpc(index) {
  activeNpc = index;
  refresh(Date.now());
}

function tick() {
  const now = Date.now();
  if (resolveDue(game, now)) saveCamp();
  refresh(now);
}

try {
  setupScene();
  canvas.addEventListener("pointerup", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * height / rect.height);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      selected = y * width + x;
      tick();
    }
  });
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
  document.addEventListener("keydown", event => {
    if (["1", "2", "3"].includes(event.key)) selectNpc(Number(event.key) - 1);
  });
  byId("dispatch").onclick = () => {
    if (dispatch(game, selected, activeNpc, Date.now())) saveCamp();
    tick();
  };
  byId("upgrade").onclick = () => {
    if (upgrade(game)) saveCamp();
    tick();
  };
  byId("reset").onclick = () => {
    if (!confirm("Start over and replace this camp?")) return;
    game = newCamp();
    selected = home;
    activeNpc = 1;
    saveCamp();
    tick();
  };
  tick();
  setInterval(tick, 1000);
} catch (error) {
  byId("loading").textContent = "Phaser could not start the frontier map.";
  console.error(error);
}
