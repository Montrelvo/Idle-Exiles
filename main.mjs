import {
  busy, describe, dispatch, frontier, height, home, missionFor, missionNames,
  newCamp, reachable, resolveDue, roster, terrain, upgrade, upgrades, width, world,
} from "./camp.mjs";

const atlas = "./assets/ProjectUtumno_full.png";
const storageKey = "idle-exiles-camp-v1";
const byId = id => document.getElementById(id);
const canvas = byId("board");
const B = globalThis.BABYLON;
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

function setupScene() {
  const engine = new B.Engine(canvas, false, {}, true);
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(.04, .045, .045, 1);
  const camera = new B.FreeCamera("frontier", new B.Vector3(0, 0, -12), scene);
  camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = 0;
  camera.orthoRight = width;
  camera.orthoTop = 0;
  camera.orthoBottom = -height;
  camera.minZ = .1;
  const sprites = new B.SpriteManager("Project Utumno", atlas, width * height * 3, 32, scene, .01, B.Texture.NEAREST_SAMPLINGMODE);

  function spriteAt(id, name, index, depth) {
    const sprite = new B.Sprite(name, sprites);
    sprite.cellIndex = index;
    sprite.position.set(id % width + .5, -Math.floor(id / width) - .5, depth);
    return sprite;
  }

  const tiles = world.flatMap((row, y) => [...row].map((type, x) => {
    const id = y * width + x;
    const base = spriteAt(id, "ground", 590, 1);
    const feature = spriteAt(id, "landmark", terrain[type].tile ?? 0, 0);
    const trail = spriteAt(id, "dispatch", 0, -1);
    trail.width = trail.height = .72;
    trail.position.x += .14;
    trail.position.y += .14;
    return { id, type, base, feature, trail };
  }));
  const outline = B.MeshBuilder.CreateLines("selection", { points: [
    [-.45, -.45], [.45, -.45], [.45, .45], [-.45, .45], [-.45, -.45],
  ].map(([x, y]) => new B.Vector3(x, y, 0)) }, scene);
  outline.color = new B.Color3(1, .71, .35);
  engine.runRenderLoop(() => scene.render());
  new ResizeObserver(() => engine.resize()).observe(canvas);
  scene.executeWhenReady(() => { byId("loading").hidden = true; });

  return () => {
    for (const { id, type, base, feature, trail } of tiles) {
      const known = game.revealed.includes(id);
      const border = frontier(game, id) && reachable(game, id);
      const outpost = game.outposts.includes(id);
      const glow = known ? .7 + ((id * 5) % 7) * .035 : border ? .24 : .105;
      base.cellIndex = known ? (type === "S" || type === "V" ? 257 : 590) : 1149;
      base.color = new B.Color4(glow, glow, glow, 1);
      feature.isVisible = known && terrain[type].tile !== undefined;
      feature.cellIndex = outpost ? 1358 : terrain[type].tile ?? 0;
      const mission = game.missions.find(order => order.id === id);
      trail.isVisible = Boolean(mission);
      if (mission) trail.cellIndex = roster[mission.npcs[0]].sprite;
    }
    outline.position.set(selected % width + .5, -Math.floor(selected / width) - .5, -2);
  };
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
  paint = setupScene();
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
  byId("loading").textContent = "The frontier needs WebGL and the installed Babylon.js dependency.";
  console.error(error);
}
