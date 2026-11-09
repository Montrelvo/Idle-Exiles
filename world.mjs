export const width = 13;
export const height = 9;
export const home = 4 * width + 6;
const cells = Array.from({ length: width * height }, (_, id) => id);
export const validTile = id => Number.isInteger(id) && id >= 0 && id < cells.length;
export const distance = (a, b) => Math.abs(a % width - b % width)
  + Math.abs(Math.floor(a / width) - Math.floor(b / width));
export const neighbors = id => [id - 1, id + 1, id - width, id + width]
  .filter(other => validTile(other) && distance(id, other) === 1);
export const protectedTile = id => validTile(id) && distance(home, id) <= 1;
export const tileAt = (game, id) => game.world[id];

export const terrain = {
  ".": { name: "Meadow" },
  F: { name: "Timber grove", tile: 850 },
  S: { name: "Stone seam", tile: 5 },
  H: { name: "Monster den", tile: 3882 },
  A: { name: "Herb patch", tile: 18 },
  R: { name: "Old waystone", tile: 818 },
  C: { name: "Totem camp", tile: 795 },
  V: { name: "Ember Vault", tile: 757 },
};

export const legacyWorld = [
  "....F.....F..", ".FR..S....RF.", "....R....R...", "..F...R...S..", ".S...FCS.R.V.",
  "...R....F....", "....S..R...F.", ".RF.......R..", ".....F.......",
].join("").split("");

export function randomFor(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function generateWorld(seed) {
  const random = randomFor(seed);
  const world = cells.map(() => ".");
  const pick = choices => choices[Math.floor(random() * choices.length)];
  world[home] = "C";
  const nearby = neighbors(home);
  const grove = pick(nearby);
  world[grove] = "F";
  world[pick(nearby.filter(id => id !== grove))] = "S";
  const east = random() < .5;
  const relay = 4 * width + (east ? 9 : 3);
  const vault = pick([3, 4, 5]) * width + (east ? 11 : 1);
  world[relay] = "R";
  world[vault] = "V";
  const nearField = cells.filter(id => distance(home, id) === 2 && world[id] === ".");
  const den = pick(nearField);
  world[den] = "H";
  world[pick(nearField.filter(id => id !== den))] = "A";
  const anchors = [home, relay];
  const covered = (id, range) => anchors.some(anchor => distance(anchor, id) <= range);
  let uncovered = cells.filter(id => !covered(id, 4));
  while (uncovered.length) {
    const candidates = cells.filter(id => world[id] === "." && !protectedTile(id) && covered(id, 3))
      .map(id => ({ id, score: uncovered.filter(other => distance(id, other) <= 4).length + random() }));
    candidates.sort((a, b) => b.score - a.score);
    const anchor = candidates[0].id;
    world[anchor] = "R";
    anchors.push(anchor);
    uncovered = uncovered.filter(id => !covered(id, 4));
  }
  for (const id of cells.filter(id => world[id] === "." && !protectedTile(id))) {
    const roll = random();
    world[id] = roll < .16 ? "F" : roll < .28 ? "S" : roll < .40 ? "A" : roll < .51 ? "H" : ".";
  }
  return world;
}
