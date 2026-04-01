"""Room management: creation, joining, state machine."""

from __future__ import annotations

import random
import string
from dataclasses import dataclass, field

from config import MAX_PLAYERS, ROOM_CODE_LENGTH
from protocol import PlayerInfo, RoomState


@dataclass
class Room:
    code: str
    host_id: str
    state: RoomState = RoomState.LOBBY
    players: dict[str, PlayerInfo] = field(default_factory=dict)

    @property
    def player_count(self) -> int:
        return len(self.players)

    @property
    def all_confirmed(self) -> bool:
        return all(p.confirmed for p in self.players.values())

    def player_list(self) -> list[PlayerInfo]:
        return list(self.players.values())


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    def create_room(self, player_id: str, username: str) -> Room:
        """Create a new room and add the host."""
        code = self._generate_code()
        room = Room(code=code, host_id=player_id)
        room.players[player_id] = PlayerInfo(
            player_id=player_id,
            username=username,
            is_host=True,
        )
        self.rooms[code] = room
        return room

    def join_room(self, code: str, player_id: str, username: str) -> Room:
        """Join an existing room. Raises ValueError on failure."""
        room = self.rooms.get(code)
        if not room:
            raise ValueError(f"Room '{code}' not found")
        if room.state != RoomState.LOBBY:
            raise ValueError("Game already in progress")
        if room.player_count >= MAX_PLAYERS:
            raise ValueError("Room is full")
        if player_id in room.players:
            raise ValueError("Already in this room")

        room.players[player_id] = PlayerInfo(
            player_id=player_id,
            username=username,
        )
        return room

    def leave_room(self, code: str, player_id: str) -> Room | None:
        """Remove a player from a room. Returns the room or None if deleted."""
        room = self.rooms.get(code)
        if not room or player_id not in room.players:
            return None

        del room.players[player_id]

        if room.player_count == 0:
            del self.rooms[code]
            return None

        # Transfer host if needed
        if room.host_id == player_id:
            room.host_id = next(iter(room.players))
            room.players[room.host_id].is_host = True

        return room

    def get_room(self, code: str) -> Room | None:
        return self.rooms.get(code)

    def _generate_code(self) -> str:
        """Generate a unique 6-char alphanumeric room code."""
        while True:
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=ROOM_CODE_LENGTH))
            if code not in self.rooms:
                return code
