"""Message schemas for client-server communication."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


# ─── Enums ───────────────────────────────────────────────────────────────────

class MessageType(str, Enum):
    # Client -> Server
    CREATE_ROOM = "CREATE_ROOM"
    JOIN_ROOM = "JOIN_ROOM"
    SELECT_ARCHETYPE = "SELECT_ARCHETYPE"
    SELECT_GENE = "SELECT_GENE"
    CONFIRM_SELECTION = "CONFIRM_SELECTION"
    START_GAME = "START_GAME"
    PONG = "PONG"
    SET_SPEED = "SET_SPEED"

    # Server -> Client
    ROOM_CREATED = "ROOM_CREATED"
    ROOM_JOINED = "ROOM_JOINED"
    PLAYER_JOINED = "PLAYER_JOINED"
    PLAYER_LEFT = "PLAYER_LEFT"
    SELECTION_UPDATE = "SELECTION_UPDATE"
    GAME_START = "GAME_START"
    STATE_UPDATE = "STATE_UPDATE"
    STATE_FULL = "STATE_FULL"
    PHASE_CHANGE = "PHASE_CHANGE"
    COMBAT_EVENT = "COMBAT_EVENT"
    CREATURE_DIED = "CREATURE_DIED"
    REPRODUCTION_RESULT = "REPRODUCTION_RESULT"
    GAME_OVER = "GAME_OVER"
    PING = "PING"
    ERROR = "ERROR"
    SPEED_CHANGED = "SPEED_CHANGED"


class RoomState(str, Enum):
    LOBBY = "LOBBY"
    SELECTING = "SELECTING"
    PLAYING = "PLAYING"
    FINISHED = "FINISHED"


class Phase(str, Enum):
    DAY = "DAY"
    NIGHT = "NIGHT"


# ─── Player Info ─────────────────────────────────────────────────────────────

class PlayerInfo(BaseModel):
    player_id: str
    username: str
    is_host: bool = False
    archetype: str | None = None
    gene: str | None = None
    confirmed: bool = False


# ─── Message Builders ────────────────────────────────────────────────────────

def room_created(room_code: str, player_id: str) -> dict:
    return {
        "type": MessageType.ROOM_CREATED,
        "room_code": room_code,
        "player_id": player_id,
    }


def room_joined(room_code: str, player_id: str, players: list[PlayerInfo]) -> dict:
    return {
        "type": MessageType.ROOM_JOINED,
        "room_code": room_code,
        "player_id": player_id,
        "players": [p.model_dump() for p in players],
    }


def player_joined(player: PlayerInfo) -> dict:
    return {
        "type": MessageType.PLAYER_JOINED,
        **player.model_dump(),
    }


def player_left(player_id: str) -> dict:
    return {
        "type": MessageType.PLAYER_LEFT,
        "player_id": player_id,
    }


def selection_update(player_id: str, archetype: str | None, gene: str | None, confirmed: bool) -> dict:
    return {
        "type": MessageType.SELECTION_UPDATE,
        "player_id": player_id,
        "archetype": archetype,
        "gene": gene,
        "confirmed": confirmed,
    }


def game_start(map_data: list[int], map_size: int, houses: dict, teams: dict) -> dict:
    return {
        "type": MessageType.GAME_START,
        "map_data": map_data,
        "map_size": map_size,
        "houses": houses,
        "teams": teams,
    }


def error(message: str) -> dict:
    return {
        "type": MessageType.ERROR,
        "message": message,
    }


def ping() -> dict:
    return {"type": MessageType.PING}


def phase_change(phase: str, turn_number: int, time_remaining: float) -> dict:
    return {
        "type": MessageType.PHASE_CHANGE,
        "phase": phase,
        "turn_number": turn_number,
        "time_remaining": time_remaining,
    }


def speed_changed(speed: float) -> dict:
    return {"type": MessageType.SPEED_CHANGED, "speed": speed}


def game_over(winner_team_id: str, final_stats: dict) -> dict:
    return {
        "type": MessageType.GAME_OVER,
        "winner_team_id": winner_team_id,
        "final_stats": final_stats,
    }
