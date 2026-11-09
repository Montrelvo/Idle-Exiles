# Idle Exiles — The Totem Camp

You are the Totem God, bound to a camp in an uncharted valley. Form teams to scout, gather, hunt and build outposts. Bring the Ember home to awaken the Totem.

## Play on Windows

Download the setup executable or portable Windows x64 ZIP from [GitHub Releases](https://github.com/Montrelvo/Idle-Exiles/releases). Setup installs for the current user and adds a Start menu shortcut. To play the portable edition, extract the entire folder and run **Idle-Exiles.exe**. Both editions run offline and use the same desktop save. Existing desktop saves keep their old map, resources, outposts, and pending orders.

## First orders

- Check at least two names in the roster, select a tile, then choose and dispatch an order. With the map focused, use arrows to select a tile and Enter to dispatch.
- Double-click a revealed tile or use **Inspect tile** to see the team working there and the time left on its order.
- Open an NPC's portrait to see their stats, skills, pack and equipped gear. Use **Unload field resources** after gathering or hunting. Timber and stone go to camp construction. Ore and hides go to the smith, herbs to the apothecary, and monster meat to the tavern.
- Build the workshops with timber and stone. Craft and take equipment or tonics from workshop stock through the NPC panel. Pack tavern stew when dispatching a team to buff its attacks for that mission.
- The Totem wards the five starting tiles from monsters. NPCs at camp recover HP and MP while idle, including after reopening the game. The Hearth unlocks the Ember Vault. Outposts extend the dispatch range.

## Rules

| Stat | Effects |
| --- | --- |
| Constitution | Max HP is 12 + 4 × Constitution. It also contributes to carrying capacity and Survival. |
| Strength | Adds natural armor, block chance and block mitigation. Helps with melee, gathering and carrying. |
| Dexterity | Adds dodge chance, deflect chance and deflect mitigation. Helps with scouting and Defense. |
| Intelligence | Max MP is 2 × Intelligence. Helps with Arcana. |
| Wisdom | Reduces incoming magic damage and helps with Medicine. This resistance rule is provisional. |

Carry capacity is 6 + 2 × Strength + Constitution. Equipped gear counts toward it. NPCs roll base stats from 3 to 8, and missions build practice in the skills they use. Each skill starts at 75% of its linked stat rounded down and gains a rank every three practice points, up to rank 12. Below rank 4, equipment is less effective and consumables can be wasted. At rank 8 or higher, gear and consumables get a 50% bonus to their item power.

New camps use a saved seed. The five warded tiles guarantee nearby timber and stone. A den and herb patch sit outside the ward. Waystones form a connected expansion route that lets an upgraded camp chart the entire map. On other eligible tiles, timber has a 16% chance, stone 12%, herbs 12%, monsters 11%, and meadow 49%. Combat resolves automatically when a hunting or vault mission ends.

## Run from source

With Node.js 22.12 or newer, run npm ci and then npm start. On Windows x64, npm run package:win creates the portable ZIP in dist. With NSIS installed or its compiler path set through MAKENSIS, npm run package:win -- --installer also creates Setup.

For the browser edition, start python -m http.server 8765 --bind 127.0.0.1 after installing dependencies and open [the camp](http://127.0.0.1:8765/). Browser and desktop saves are separate.

## Sources

The Windows installers for the Exile trilogy and Blades of Exile were unpacked statically. Their help files and the [Blades of Exile source](https://codeberg.org/Montrelvo/Blades-Of-Exile-REA) informed the separation of spell resources and the idea of spending actions on defense. The campaign, camps, and stat formulas are original game rules.

[Installer evidence and mechanics notes](https://github.com/Montrelvo/Reverse-Anything/blob/375fb4bd2d511213e768cc38cc458b2cb9fcc426/experiments/exile-installer-findings.md)

Project Utumno provides terrain and NPC art from [Dungeon Crawl 32×32 tiles](https://opengameart.org/content/dungeon-crawl-32x32-tiles) under CC0.
