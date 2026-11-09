# Idle Exiles — The Totem Camp

You are the Totem God, bound to a camp in an uncharted valley. Dispatch people to scout, gather supplies, and build outposts that put more of the world within reach.

## Play locally

From this directory, run:

```sh
npm ci
python -m http.server 8765 --bind 127.0.0.1
```

Open [the camp](http://127.0.0.1:8765/) in a WebGL-capable browser.

## First orders

- Select a tile on the map. With the map focused, use the arrow keys to change the selection and Enter to dispatch.
- Pick an NPC with the roster buttons or keys **1–3**, then use the dispatch button. Ivo scouts fastest and Sable brings back extra supplies.
- Send workers to the grove and stone seam next to camp to build the Hearth. Scout along the edge of the fog. Build outposts at waystones to extend dispatch range.
- The Hearth unlocks the vault company. When you find the vault within range, send all three NPCs to retrieve the Ember. Bring it home and upgrade the camp again to awaken the Totem.
- Expeditions finish at their return time. The browser stores your camp and settles overdue missions when you reopen it.

## Sources

The Windows installers for the Exile trilogy and Blades of Exile were unpacked statically. Their help files and the [Blades of Exile source](https://codeberg.org/Montrelvo/Blades-Of-Exile-REA) informed the vault's action points, mage and priest spells, and parrying. The camp economy, fog, expeditions, map, and victory conditions are original game design. The vault encounter plays out automatically.

[Installer evidence and mechanics notes](https://github.com/Montrelvo/Reverse-Anything/blob/375fb4bd2d511213e768cc38cc458b2cb9fcc426/experiments/exile-installer-findings.md)

The supplied Project Utumno PNG supplies the terrain and NPC art. The companion CSV and JSON identify cells by zero-based row-major index on a 64-column grid of 32-pixel tiles. The metadata credits the [Dungeon Crawl 32×32 tiles](https://opengameart.org/content/dungeon-crawl-32x32-tiles) under CC0.
