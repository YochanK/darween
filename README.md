# Darween

A real-time multiplayer creature evolution game. Players compete in matches where AI-driven creatures forage, fight, breed, and evolve on a procedurally generated map.

## Features

- **Real-time multiplayer** — WebSocket-based rooms, up to 20 players
- **Creature AI** — 9-state machine (foraging, combat, reproduction, day/night awareness)
- **Genetic evolution** — breeding with stat mutations and gene traits
- **Isometric 3D** — Three.js rendering with Kenney cube-pets models
- **Procedural terrain** — Perlin noise maps with grass, sand, water, and rock tiles
- **RPG UI** — retro pixel aesthetic with Press Start 2P font

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11+, FastAPI, Uvicorn, WebSockets |
| Frontend | JavaScript (ES modules), Three.js, Vite |
| Package managers | uv (Python), npm (JS) |
| Testing | Playwright (E2E) |

## Getting Started

**Install dependencies:**
```bash
make install
```

**Run in development (both servers):**
```bash
make dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173

**Run servers individually:**
```bash
make server   # backend only
make client   # frontend only
```

**Build for production:**
```bash
make build    # outputs to client/dist/
```

**Run E2E tests** (requires both servers running):
```bash
make test
```

**Clean up:**
```bash
make clean
```

## Project Structure

```
darween/
├── client/               # Vite + Three.js frontend
│   └── src/
│       ├── main.js       # entry point
│       ├── game/         # Three.js scene, renderers, camera
│       ├── ui/           # lobby, room, selection, HUD screens
│       └── network/      # WebSocket client
├── server/               # FastAPI backend
│   ├── main.py           # app entry, WebSocket endpoint
│   ├── game_loop.py      # 10 tick/sec simulation loop
│   ├── game_state.py     # authoritative state
│   ├── creature.py       # AI state machine
│   ├── archetypes.py     # 5 creature types + 3 genes
│   ├── config.py         # all game constants
│   └── ...               # combat, food, pathfinding, map gen, etc.
├── test_*.js             # Playwright E2E tests
└── Makefile
```

## Creature Archetypes

Fox, Lion, Bunny, Elephant, Monkey — each with unique stats and one of three gene traits: **Sugar Rush**, **Predator Instinct**, or **Aquatic Adaptation**.

## Credits

3D models and UI assets from [Kenney.nl](https://kenney.nl) (CC0).
