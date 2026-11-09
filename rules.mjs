export const stats = {
  con: "Constitution", str: "Strength", dex: "Dexterity", int: "Intelligence", wis: "Wisdom",
};
export const skills = {
  scouting: ["Scouting", "dex"], gathering: ["Gathering", "str"],
  melee: ["Weapon handling", "str"], defense: ["Defense", "dex"],
  arcana: ["Arcana", "int"], medicine: ["Medicine", "wis"], survival: ["Survival", "con"],
};
export const slots = {
  head: "Head", body: "Torso", mainHand: "Main hand", offHand: "Off hand",
  hands: "Hands", legs: "Legs", feet: "Feet",
};
export const items = {
  timber: { name: "Timber", weight: 2, store: "stockpile" },
  stone: { name: "Stone", weight: 3, store: "stockpile" },
  ore: { name: "Ore", weight: 2, store: "smith" },
  hide: { name: "Hide", weight: 1, store: "smith" },
  herb: { name: "Herbs", weight: 1, store: "apothecary" },
  meat: { name: "Monster meat", weight: 1, store: "tavern" },
  sword: { name: "Forged blade", weight: 4, slot: "mainHand", skill: "melee", power: 8, store: "smith" },
  vest: { name: "Hide vest", weight: 3, slot: "body", skill: "defense", power: 3, store: "smith" },
  shield: { name: "Iron shield", weight: 4, slot: "offHand", skill: "defense", power: 2, store: "smith" },
  helm: { name: "Iron helm", weight: 2, slot: "head", skill: "defense", power: 1, store: "smith" },
  gloves: { name: "Hide gloves", weight: 1, slot: "hands", skill: "defense", power: 1, store: "smith" },
  greaves: { name: "Hide greaves", weight: 2, slot: "legs", skill: "defense", power: 1, store: "smith" },
  boots: { name: "Hide boots", weight: 2, slot: "feet", skill: "defense", power: 1, store: "smith" },
  tonic: { name: "Restorative tonic", weight: 1, skill: "medicine", power: 14, store: "apothecary" },
  meal: { name: "Hunter’s stew", weight: 1, skill: "survival", power: 3, store: "tavern" },
};

export const maxHp = npc => 12 + 4 * npc.stats.con;
export const maxMp = npc => 2 * npc.stats.int;
export const capacity = npc => 6 + 2 * npc.stats.str + npc.stats.con;
export function weight(npc) {
  return Object.entries(npc.pack).reduce((sum, [id, count]) => sum + items[id].weight * count, 0)
    + Object.values(npc.equipment).reduce((sum, id) => sum + items[id].weight, 0);
}
export const skill = (npc, id) => Math.min(12, Math.floor(npc.stats[skills[id][1]] * .75) + Math.floor((npc.practice[id] ?? 0) / 3));
export const train = (npc, id, amount = 1) => { npc.practice[id] = (npc.practice[id] ?? 0) + amount; };
export const add = (inventory, id, count = 1) => { inventory[id] = (inventory[id] ?? 0) + count; };
export function remove(inventory, id, count = 1) {
  inventory[id] -= count;
  if (inventory[id] === 0) delete inventory[id];
}

export function rollNpc(name, sprite, random) {
  const values = Object.fromEntries(Object.keys(stats).map(id => [id, 3 + Math.floor(random() * 6)]));
  const npc = { name, sprite, stats: values, practice: {}, pack: {}, equipment: {} };
  return { ...npc, hp: maxHp(npc), mp: maxMp(npc) };
}

function proficiency(npc, id) {
  const level = skill(npc, items[id].skill);
  return level < 4 ? .5 : level >= 8 ? 1.5 : 1;
}

export function consume(npc, id, inventory, random) {
  if (!inventory[id] || !["tonic", "meal"].includes(id)) return null;
  remove(inventory, id);
  const factor = proficiency(npc, id);
  train(npc, items[id].skill);
  if (factor < 1 && random() < .5) return 0;
  return Math.round(items[id].power * factor);
}

export function damageTaken(npc, amount, magic, random) {
  const { str, dex, wis } = npc.stats;
  const defense = skill(npc, "defense");
  if (magic) return Math.max(1, amount - Math.floor(wis * .6));
  if (random() < Math.min(.35, dex * .025)) return 0;
  const gear = Object.values(npc.equipment).filter(id => items[id].skill === "defense");
  const armor = gear.reduce((sum, id) => sum + items[id].power * proficiency(npc, id), Math.floor(str / 3));
  const reaction = random();
  const block = Math.min(.3, str * .025 + defense * .008);
  const deflect = Math.min(.3, dex * .025 + defense * .008);
  const reduction = reaction < block ? Math.ceil(str / 2) : reaction < block + deflect ? Math.ceil(dex / 3) : 0;
  return Math.max(1, Math.round(amount - armor - reduction));
}

export function encounter(team, vault, buffs, random) {
  let enemy = vault ? 46 : 20 + Math.floor(random() * 8);
  for (let round = 0; round < 8; round++) {
    for (const [index, npc] of team.entries()) {
      if (npc.hp <= 0) continue;
      const blade = npc.equipment.mainHand;
      const arcana = skill(npc, "arcana");
      let damage;
      if (arcana >= 4 && npc.mp >= 2 && (!blade || round % 2 === 0)) {
        npc.mp -= 2;
        damage = 3 + Math.floor(npc.stats.int / 2 + arcana / 2);
        train(npc, "arcana");
      } else {
        const factor = blade ? proficiency(npc, blade) : 1;
        const weapon = blade && (factor >= 1 || random() >= .45) ? items[blade].power * factor : 0;
        damage = 2 + Math.floor(npc.stats.str / 2 + skill(npc, "melee") / 3 + weapon);
        train(npc, "melee");
      }
      enemy -= damage + (buffs[index] ?? 0);
      if (enemy <= 0) return true;
    }
    const targets = team.filter(npc => npc.hp > 0);
    if (!targets.length) return false;
    const target = targets[Math.floor(random() * targets.length)];
    target.hp = Math.max(0, target.hp - damageTaken(target, vault ? 16 : 11, vault && round % 3 === 2, random));
    train(target, "defense");
    if (target.hp > 0 && target.hp < maxHp(target) / 2 && target.pack.tonic) {
      target.hp = Math.min(maxHp(target), target.hp + consume(target, "tonic", target.pack, random));
    }
  }
  return false;
}
