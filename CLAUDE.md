# CLAUDE.md

## Project Overview

**Darween** is a real-time multiplayer creature evolution game. FastAPI backend + Three.js frontend communicating over WebSockets. The backend is authoritative; the frontend is purely a renderer.

## Development Commands

```bash
make install   # install all deps (uv + npm)
make dev       # start both servers (backend :8000, frontend :5173)
make server    # backend only
make client    # frontend only
make build     # production build → client/dist/
make test      # run Playwright E2E tests (requires servers running)
make clean     # remove build artifacts and virtualenvs
```

## Architecture

### Backend (`server/`)

- `main.py` — FastAPI app; single WebSocket endpoint at `/ws`; serves `client/dist/` in prod
- `game_loop.py` — runs at 10 ticks/sec; calls `game_state.update()` then broadcasts state to all clients
- `game_state.py` — authoritative simulation; manages rooms, teams, win conditions
- `creature.py` — `Creature` class with a 9-state AI machine: `IDLE`, `SEEKING_FOOD`, `MOVING_TO_FOOD`, `WANDER`, `ALERT`, `FLEE`, `PURSUE`, `FIGHT`, `SEEKING_ENEMY`
- `archetypes.py` — 5 archetypes (fox, lion, bunny, elephant, monkey) × 3 genes (Sugar Rush, Predator Instinct, Aquatic Adaptation)
- `config.py` — single source of truth for all numeric constants (tick rate, terrain speeds, day/night duration, etc.); change values here, not inline
- `rooms.py` — room state machine: `LOBBY` → `SELECTION` → `INGAME`
- `protocol.py` — message type constants for the WS protocol
- `pathfinding.py` — A* over the terrain grid
- `spatial_hash.py` — spatial index for efficient collision/proximity queries
- `map_gen.py` — Perlin noise terrain; map size scales with player count

### Frontend (`client/src/`)

- `main.js` — wires up socket, UIManager, event listeners
- `game/GameScene.js` — master Three.js scene; owns all renderers
- `game/IsometricCamera.js` — isometric projection + pan/zoom
- `game/CreaturePool.js` — object pool for creature meshes (Kenney cube-pets GLBs)
- `ui/GameHUD.js` — in-game overlay (team stats, speed controls)
- `ui/LobbyScreen.js` / `RoomScreen.js` / `SelectionScreen.js` — pre-game flow
- `network/socket.js` — WebSocket wrapper with reconnect logic

### Network Protocol

Messages are JSON objects with a `type` field (defined in `server/protocol.py`). The server broadcasts full state snapshots each tick; the client does not send game commands, only UI actions (join, select archetype, start game).

## Key Conventions

- All game constants live in `server/config.py` — don't hardcode magic numbers elsewhere.
- Creature AI logic belongs in `server/creature.py`; combat math in `server/combat.py`; food spawning in `server/food.py`. Keep concerns separated.
- The frontend never simulates — it only renders the latest state snapshot received from the server.
- Python deps: managed with `uv` (`server/pyproject.toml`). JS deps: npm (`client/package.json`). Do not mix.

## Testing

Playwright E2E tests in `/test_*.js`. They launch real browsers and require both dev servers to be running. Tests cover: lobby flow, room creation, archetype selection, game start, HUD, creature behavior.
