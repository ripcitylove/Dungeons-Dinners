<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product Northstar

DnD Legends is a multiplayer D&D 5e experience where **every user is a player** and **the AI is the Dungeon Master**.

- There is no human DM role. The AI runs the world: enemies, NPCs, encounters, loot, story.
- Every person at the table plays a character. No one sits out to manage the game.
- Do not build DM-control UIs (enemy spawners, encounter editors, stat overrides). The AI handles all of that autonomously.
- Features should serve the players: character creation, inventory, spells, party coordination, and immersive narrative.
- The AI DM should follow D&D 5e rules faithfully and make encounters feel earned, dangerous, and rewarding.
