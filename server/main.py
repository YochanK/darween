"""FastAPI application entry point for Darween game server."""

from __future__ import annotations

import json
import logging
import uuid

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import numpy as np

from archetypes import ARCHETYPES
from config import map_size_for_players
from game_loop import GameLoop
from game_state import GameState
from map_gen import generate_map
from protocol import (
    MessageType,
    RoomState,
    error,
    game_start,
    player_joined,
    player_left,
    room_created,
    room_joined,
    selection_update,
)
from rooms import RoomManager
from ws_handler import ConnectionManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("darween")

app = FastAPI(title="Darween")

room_manager = RoomManager()
conn_manager = ConnectionManager()
game_loops: dict[str, GameLoop] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    player_id = str(uuid.uuid4())[:8]
    current_room_code = None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(error("Invalid JSON"))
                continue

            msg_type = msg.get("type")

            # ─── CREATE_ROOM ──────────────────────────────────────────
            if msg_type == MessageType.CREATE_ROOM:
                username = msg.get("username", "Player")
                room = room_manager.create_room(player_id, username)
                current_room_code = room.code

                # Register connection
                if room.code not in conn_manager.connections:
                    conn_manager.connections[room.code] = {}
                conn_manager.connections[room.code][player_id] = websocket
                conn_manager.player_rooms[player_id] = room.code

                await websocket.send_json(room_created(room.code, player_id))
                logger.info(f"Room {room.code} created by {username} ({player_id})")

            # ─── JOIN_ROOM ────────────────────────────────────────────
            elif msg_type == MessageType.JOIN_ROOM:
                code = msg.get("room_code", "").upper()
                username = msg.get("username", "Player")

                try:
                    room = room_manager.join_room(code, player_id, username)
                    current_room_code = code

                    # Register connection
                    if code not in conn_manager.connections:
                        conn_manager.connections[code] = {}
                    conn_manager.connections[code][player_id] = websocket
                    conn_manager.player_rooms[player_id] = code

                    # Send room info to joining player
                    await websocket.send_json(
                        room_joined(code, player_id, room.player_list())
                    )

                    # Notify others
                    await conn_manager.broadcast(
                        code,
                        player_joined(room.players[player_id]),
                        exclude=player_id,
                    )
                    logger.info(f"{username} ({player_id}) joined room {code}")

                except ValueError as e:
                    await websocket.send_json(error(str(e)))

            # ─── SELECT_ARCHETYPE ─────────────────────────────────────
            elif msg_type == MessageType.SELECT_ARCHETYPE:
                if not current_room_code:
                    continue
                room = room_manager.get_room(current_room_code)
                if not room or player_id not in room.players:
                    continue

                archetype = msg.get("archetype")
                room.players[player_id].archetype = archetype

                await conn_manager.broadcast_all(
                    current_room_code,
                    selection_update(
                        player_id,
                        archetype,
                        room.players[player_id].gene,
                        room.players[player_id].confirmed,
                    ),
                )

            # ─── SELECT_GENE ──────────────────────────────────────────
            elif msg_type == MessageType.SELECT_GENE:
                if not current_room_code:
                    continue
                room = room_manager.get_room(current_room_code)
                if not room or player_id not in room.players:
                    continue

                gene = msg.get("gene")
                room.players[player_id].gene = gene

                await conn_manager.broadcast_all(
                    current_room_code,
                    selection_update(
                        player_id,
                        room.players[player_id].archetype,
                        gene,
                        room.players[player_id].confirmed,
                    ),
                )

            # ─── CONFIRM_SELECTION ────────────────────────────────────
            elif msg_type == MessageType.CONFIRM_SELECTION:
                if not current_room_code:
                    continue
                room = room_manager.get_room(current_room_code)
                if not room or player_id not in room.players:
                    continue

                p = room.players[player_id]
                if not p.archetype or not p.gene:
                    await websocket.send_json(error("Select archetype and gene first"))
                    continue

                p.confirmed = True

                await conn_manager.broadcast_all(
                    current_room_code,
                    selection_update(player_id, p.archetype, p.gene, True),
                )

            # ─── START_GAME ───────────────────────────────────────────
            elif msg_type == MessageType.START_GAME:
                if not current_room_code:
                    continue
                room = room_manager.get_room(current_room_code)
                if not room:
                    continue
                if room.host_id != player_id:
                    await websocket.send_json(error("Only the host can start"))
                    continue

                if room.state == RoomState.LOBBY:
                    # Move everyone to selection screen
                    room.state = RoomState.SELECTING
                    await conn_manager.broadcast_all(
                        current_room_code,
                        {"type": "GOTO_SELECTION"},
                    )
                    logger.info(f"Room {current_room_code} entering selection phase")
                    continue

                if room.state != RoomState.SELECTING:
                    continue
                if not room.all_confirmed:
                    await websocket.send_json(error("Not all players confirmed"))
                    continue

                # Transition to PLAYING
                room.state = RoomState.PLAYING
                num_players = room.player_count
                size = map_size_for_players(num_players)
                terrain, houses = generate_map(size, num_players)

                # Build teams data with archetype stats
                teams = {}
                player_ids = list(room.players.keys())
                for i, pid in enumerate(player_ids):
                    p = room.players[pid]
                    archetype_data = ARCHETYPES.get(p.archetype, {})
                    teams[pid] = {
                        "archetype": p.archetype,
                        "gene": p.gene,
                        "username": p.username,
                        "color_index": i,
                        "stats": archetype_data.get("stats", {}),
                    }

                houses_dict = {
                    player_ids[i]: list(houses[i]) for i in range(num_players)
                }

                # Send GAME_START to all clients
                await conn_manager.broadcast_all(
                    current_room_code,
                    game_start(
                        terrain.flatten().tolist(),
                        size,
                        houses_dict,
                        teams,
                    ),
                )

                # Initialize game state and start game loop
                gs = GameState()
                terrain_2d = np.array(terrain).reshape(size, size)
                houses_tuples = {pid: tuple(pos) for pid, pos in houses_dict.items()}
                gs.initialize(terrain_2d, size, houses_tuples, teams)

                async def broadcast_to_room(msg):
                    await conn_manager.broadcast_all(current_room_code, {
                        "type": "STATE_UPDATE",
                        **msg,
                    })

                loop = GameLoop(gs, broadcast_to_room)
                game_loops[current_room_code] = loop
                loop.start()

                logger.info(f"Game started in room {current_room_code} with {num_players} players")

            # ─── PONG ────────────────────────────────────────────────
            elif msg_type == MessageType.PONG:
                pass  # heartbeat acknowledged

    except WebSocketDisconnect:
        logger.info(f"Player {player_id} disconnected")
        if current_room_code:
            conn_manager.disconnect(player_id)
            room = room_manager.leave_room(current_room_code, player_id)
            if room:
                await conn_manager.broadcast_all(
                    current_room_code,
                    player_left(player_id),
                )


# Serve client in production
try:
    app.mount("/assets", StaticFiles(directory="../client/dist/assets"), name="assets")
except Exception:
    pass

@app.get("/")
async def serve_index():
    try:
        return FileResponse("../client/dist/index.html")
    except Exception:
        return {"message": "Client not built. Run 'npm run build' in client/"}


def run():
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
