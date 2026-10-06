# Space Attack: Last Star

A small browser arcade boss fight. Pilot Olimar's supplied ship, dodge Sans's increasingly complex bone attacks, and bring the rotating Pikmin crew to the battle. Animated sprite art, a layered parallax starfield, drifting planets, and a Pikmin-inspired crew panel give the fight more depth.

## Play

Open `index.html` in a modern browser. No install or build step is needed.

- Press **Start Flight** to watch the ship arrive and Sans enter. The intro ends in a brief standoff: move with **WASD** or the **arrow keys**, fire first with **Space**, or let Sans make the first move.
- Hold **Space** to fire. Every tenth shot sends the next Pikmin power.
- Dodge the falling bones. Each life absorbs four hits; the game starts with three lives.
- Every 5% of boss health lost increases the attack pressure. Every 10% unlocks another move; at 10% health Sans enters a final frenzy.
- Defeat Sans before losing all lives.
- Press **Fly Again** after a win or loss, or press **R**.
- The uploaded **Megalovania remix** starts when you launch a run. Use its audio controls to pause or change volume. **SFX ON / SFX OFF** controls the separate battle sounds.
- If Sans falls, the ship charges a final shot; press **Space** when prompted to fire it and watch the victory fly-off. Losing all lives triggers a ship explosion and stops the music.

## Pikmin rotation

Red deals double damage; Electric stuns for 3 seconds; Blue slows the boss; White poisons for 10 seconds at 2 damage per second; Purple deals four times damage. Ice is currently out of the rotation.

## Art and music

- `sprites/Sans.png` and `sprites/pikmine sprites.png` are the uploaded sprite sheets. The game uses transparent crops for Sans, animated Olimar, Pikmin icons, and flower overlays. The ship uses the supplied `assets/olimar-ship.png` image.
- The uploaded music file is bundled locally at `music/MEGALOVANIA (remix) - Smash Bros Ultimate music.mp3`; no network connection is needed for the soundtrack.
- The clips in `sound effect/` play on Sans's funny, letter-by-letter attack quips, battle start, Pikmin launches and misses, Sans hits and defeat, and the ship's final explosion. Normal ship fire uses a soft synthesized sine blip.
- The Pikmin sprite sheet includes the credit “Mattdog1000000 by Michael Peterson”; the original sheet is retained in `sprites/`.

## Project notes

- `PROMPTS.md` records the project brief and the active-work timer.
- `REFLECTION.md` is a worksheet for the player's own post-play reflection.
- The project uses no framework or installed packages.
