"""WebSocket connection manager and message router."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import WebSocket

from protocol import MessageType, ping, error

logger = logging.getLogger("darween.ws")


class ConnectionManager:
    def __init__(self):
        # room_code -> {player_id -> WebSocket}
        self.connections: dict[str, dict[str, WebSocket]] = {}
        # player_id -> room_code (reverse lookup)
        self.player_rooms: dict[str, str] = {}

    async def connect(self, room_code: str, player_id: str, websocket: WebSocket):
        """Register a player connection in a room."""
        await websocket.accept()
        if room_code not in self.connections:
            self.connections[room_code] = {}
        self.connections[room_code][player_id] = websocket
        self.player_rooms[player_id] = room_code

    def disconnect(self, player_id: str):
        """Remove a player connection."""
        room_code = self.player_rooms.pop(player_id, None)
        if room_code and room_code in self.connections:
            self.connections[room_code].pop(player_id, None)
            if not self.connections[room_code]:
                del self.connections[room_code]
        return room_code

    async def send_to(self, player_id: str, message: dict):
        """Send a message to a specific player."""
        room_code = self.player_rooms.get(player_id)
        if not room_code:
            return
        ws = self.connections.get(room_code, {}).get(player_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning(f"Failed to send to player {player_id}")

    async def broadcast(self, room_code: str, message: dict, exclude: str | None = None):
        """Broadcast a message to all players in a room."""
        connections = self.connections.get(room_code, {})
        tasks = []
        for pid, ws in connections.items():
            if pid != exclude:
                tasks.append(self._safe_send(ws, message))
        if tasks:
            await asyncio.gather(*tasks)

    async def broadcast_all(self, room_code: str, message: dict):
        """Broadcast to all players including sender."""
        await self.broadcast(room_code, message, exclude=None)

    async def _safe_send(self, ws: WebSocket, message: dict):
        try:
            await ws.send_json(message)
        except Exception:
            pass

    def get_room_player_ids(self, room_code: str) -> list[str]:
        """Get all player IDs connected to a room."""
        return list(self.connections.get(room_code, {}).keys())
