export const map = [
  "#################",
  "#...#.....#....>#",
  "#...#.....#.....#",
  "#...#..#..#..#..#",
  "#......#.....#..#",
  "#......###.#....#",
  "#..A.......#..C.#",
  "#......#...#....#",
  "#......#........#",
  "#......#...#....#",
  "#################",
];

export const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const tile = ({ x, y }) => map[y]?.[x] ?? "#";

export function newEncounter() {
  return {
    party: [
      { name: "Mara", role: "Vanguard", x: 14, y: 8, maxHp: 26, apMax: 4, damage: 7, maxSp: 0 },
      { name: "Ivo", role: "Arcanist", x: 13, y: 8, maxHp: 17, apMax: 4, damage: 4, maxSp: 8 },
      { name: "Sable", role: "Warden", x: 15, y: 8, maxHp: 20, apMax: 4, damage: 5, maxSp: 8 },
    ].map(pc => ({ ...pc, hp: pc.maxHp, ap: pc.apMax, sp: pc.maxSp, parry: false })),
    foes: [
      { name: "Vault guard", x: 14, y: 7, hp: 20, damage: 6 },
    ],
    outcome: null,
  };
}

function occupied(game, pos) {
  return [...game.party, ...game.foes].find(actor => actor.hp > 0 && distance(actor, pos) === 0);
}

function hit(target, damage) {
  const amount = target.parry ? Math.ceil(damage / 2) : damage;
  target.hp = Math.max(0, target.hp - amount);
}

function usable(game, pc) {
  return !game.outcome && pc?.hp > 0 && pc.ap > 0;
}

export function act(game, pc, pos) {
  if (!usable(game, pc) || distance(pc, pos) !== 1 || tile(pos) === "#") return;
  const target = occupied(game, pos);
  if (target) {
    if (!game.foes.includes(target)) return;
    pc.ap = Math.max(0, pc.ap - 4);
    hit(target, pc.damage);
    return;
  }
  Object.assign(pc, pos);
  pc.ap--;
}

function path(start, goal, canEnter, limit = Infinity) {
  const queue = [{ x: start.x, y: start.y, depth: 0, first: null }];
  const seen = new Set([`${start.x},${start.y}`]);
  for (const cell of queue) {
    if (distance(cell, goal) === 0) return cell;
    if (cell.depth >= limit) continue;
    for (const [dx, dy] of directions) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || tile(next) === "#" || !canEnter(next)) continue;
      seen.add(key);
      queue.push({ ...next, depth: cell.depth + 1, first: cell.first ?? next });
    }
  }
  return null;
}

export function cast(game, pc, pos) {
  if (!usable(game, pc) || pc.sp < 2) return false;
  const target = occupied(game, pos);
  const healing = pc.role === "Warden";
  const eligible = healing ? game.party : game.foes;
  if (!target || !eligible.includes(target) || (healing && target.hp === target.maxHp)) return false;
  const range = healing ? 3 : 5;
  if (!path(pc, pos, () => true, range)) return false;
  pc.ap = Math.max(0, pc.ap - (healing ? 5 : 6));
  pc.sp -= 2;
  if (healing) {
    const amount = Math.min(8, target.maxHp - target.hp);
    target.hp += amount;
  } else hit(target, 10);
  return true;
}

export function parry(game, pc) {
  if (!usable(game, pc)) return;
  pc.ap = 0;
  pc.parry = true;
}

export function endRound(game) {
  if (game.outcome) return;
  for (const foe of game.foes.filter(foe => foe.hp > 0)) {
    const routes = game.party.filter(pc => pc.hp > 0).flatMap(pc => {
      const route = path(foe, pc, pos => !occupied(game, pos) || distance(pos, pc) === 0, 6);
      return route ? [{ pc, route }] : [];
    }).sort((a, b) => a.route.depth - b.route.depth);
    const nearest = routes[0];
    if (!nearest) continue;
    if (nearest.route.depth === 1) hit(nearest.pc, foe.damage);
    else Object.assign(foe, nearest.route.first);
  }
  if (game.party.every(pc => pc.hp === 0)) {
    game.outcome = "Expedition lost";
    return;
  }
  for (const pc of game.party) {
    pc.ap = pc.hp ? pc.apMax : 0;
    pc.parry = false;
  }
}
