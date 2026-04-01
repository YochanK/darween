"""Authoritative server game state."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from config import (
    MAX_HP,
    STARTING_CREATURES,
    WIN_POPULATION,
    COMBAT_DAMAGE,
    COMBAT_COOLDOWN,
    TERRAIN_SPEEDS,
)
from creature import AIState, Apple, Creature
from pathfinding import compute_distance_field
from spatial_hash import SpatialHash


# ── Small helpers ───────────────────────────────────────────────────────────

@dataclass
class TeamState:
    archetype: str
    gene: str
    username: str
    color_index: int
    stats: dict[str, int] = field(default_factory=lambda: {
        "births": 0,
        "deaths": 0,
        "damage_dealt": 0,
        "damage_taken": 0,
    })


_id_counter = itertools.count(1)


def _next_id() -> int:
    return next(_id_counter)


# ── GameState ───────────────────────────────────────────────────────────────

class GameState:
    """Single source of truth for a running game."""

    def __init__(self) -> None:
        self.terrain: np.ndarray = np.zeros((1, 1), dtype=np.int32)
        self.map_size: int = 0
        self.houses: dict[str, tuple[int, int]] = {}

        self.creatures: dict[int, Creature] = {}
        self.apples: dict[int, Apple] = {}
        self.teams: dict[str, TeamState] = {}

        self.phase: str = "DAY"
        self.tick: int = 0
        self.time_in_phase: float = 0.0
        self.turn_number: int = 1

        self.distance_fields: dict[str, np.ndarray] = {}
        self.spatial_hash: SpatialHash = SpatialHash()

        # Separate spatial hash for apples so creature queries don't mix
        self.apple_spatial_hash: SpatialHash = SpatialHash()

    # ── Initialization ──────────────────────────────────────────────────

    def initialize(
        self,
        terrain: np.ndarray,
        map_size: int,
        houses: dict[str, tuple[int, int]],
        teams_info: dict[str, dict[str, Any]],
    ) -> None:
        """Set up the game world.

        Parameters
        ----------
        terrain : (map_size, map_size) int32 numpy array
        map_size : side length in tiles
        houses : {team_id: (x, y)} house positions
        teams_info : {team_id: {archetype, gene, username, color_index, stats}}
            where *stats* is the stat dict from the archetype.
        """
        self.terrain = terrain
        self.map_size = map_size
        self.houses = dict(houses)

        # Build teams
        for tid, info in teams_info.items():
            self.teams[tid] = TeamState(
                archetype=info["archetype"],
                gene=info["gene"],
                username=info["username"],
                color_index=info["color_index"],
            )

        # Pre-compute distance fields (one Dijkstra per house)
        for tid, (hx, hy) in self.houses.items():
            self.distance_fields[tid] = compute_distance_field(
                (hx, hy), self.terrain, self.map_size,
            )

        # Spawn starting creatures at each house
        for tid, (hx, hy) in self.houses.items():
            archetype_stats = teams_info[tid]["stats"]
            gene = teams_info[tid]["gene"]
            for _ in range(STARTING_CREATURES):
                cid = _next_id()
                c = Creature(
                    id=cid,
                    team_id=tid,
                    x=float(hx) + 0.5,
                    y=float(hy) + 0.5,
                    stats=dict(archetype_stats),
                    hp=MAX_HP,
                    gene=gene,
                    ai_state=AIState.SEEKING_FOOD,
                )
                self.creatures[cid] = c

        self._rebuild_spatial_hashes()

    # ── Spatial hash management ─────────────────────────────────────────

    def _rebuild_spatial_hashes(self) -> None:
        self.spatial_hash.clear()
        for c in self.creatures.values():
            if c.hp > 0:
                self.spatial_hash.insert(c.id, c.x, c.y)

        self.apple_spatial_hash.clear()
        for a in self.apples.values():
            self.apple_spatial_hash.insert(a.id, a.x, a.y)

    def rebuild_spatial_hashes(self) -> None:
        """Public alias so the game loop can trigger a rebuild."""
        self._rebuild_spatial_hashes()

    # ── Apple management ────────────────────────────────────────────────

    def add_apple(self, x: float, y: float, apple_type: str = "normal") -> Apple:
        aid = _next_id()
        apple = Apple(id=aid, x=x, y=y, type=apple_type)
        self.apples[aid] = apple
        return apple

    def remove_apple(self, apple_id: int) -> None:
        self.apples.pop(apple_id, None)

    # ── Combat resolution ───────────────────────────────────────────────

    def resolve_combat(self, a: Creature, b: Creature) -> list[dict[str, Any]]:
        """Resolve one round of combat between two creatures.

        Both must be alive and off cooldown. Returns event dicts.
        """
        events: list[dict[str, Any]] = []
        if a.hp <= 0 or b.hp <= 0:
            return events
        if a.combat_cooldown > 0 or b.combat_cooldown > 0:
            return events
        if a.team_id == b.team_id:
            return events

        # Damage calculation: base COMBAT_DAMAGE scaled by attack vs defense
        a_dmg = max(1, COMBAT_DAMAGE + (a.stats.get("attack", 5) - b.stats.get("defense", 5)) // 2)
        b_dmg = max(1, COMBAT_DAMAGE + (b.stats.get("attack", 5) - a.stats.get("defense", 5)) // 2)

        b.hp = max(0, b.hp - a_dmg)
        a.hp = max(0, a.hp - b_dmg)

        # Track stats
        a_team = self.teams.get(a.team_id)
        b_team = self.teams.get(b.team_id)
        if a_team:
            a_team.stats["damage_dealt"] += a_dmg
            a_team.stats["damage_taken"] += b_dmg
        if b_team:
            b_team.stats["damage_dealt"] += b_dmg
            b_team.stats["damage_taken"] += a_dmg

        a.combat_cooldown = COMBAT_COOLDOWN
        b.combat_cooldown = COMBAT_COOLDOWN
        a.animation = "attack"
        b.animation = "attack"

        events.append({
            "type": "combat",
            "attacker_id": a.id,
            "defender_id": b.id,
            "a_dmg": a_dmg,
            "b_dmg": b_dmg,
        })

        # Death checks
        for c in (a, b):
            if c.hp <= 0:
                team = self.teams.get(c.team_id)
                if team:
                    team.stats["deaths"] += 1
                # Gene: predator instinct
                killer = b if c is a else a
                if killer.gene == "predator_instinct" and killer.hp > 0:
                    killer.food += 1
                events.append({
                    "type": "creature_died",
                    "creature_id": c.id,
                    "team_id": c.team_id,
                    "killer_id": killer.id,
                })

        return events

    # ── Win condition ───────────────────────────────────────────────────

    def check_win_condition(self) -> str | None:
        """Return winning team_id if any team has >= WIN_POPULATION, else None."""
        counts: dict[str, int] = {}
        for c in self.creatures.values():
            if c.hp > 0:
                counts[c.team_id] = counts.get(c.team_id, 0) + 1
        for tid, count in counts.items():
            if count >= WIN_POPULATION:
                return tid
        return None

    # ── Snapshots ───────────────────────────────────────────────────────

    def get_state_snapshot(self) -> dict[str, Any]:
        """Lightweight state for STATE_UPDATE messages (positions + anims)."""
        creature_list = []
        for c in self.creatures.values():
            if c.hp > 0:
                creature_list.append({
                    "id": c.id,
                    "team_id": c.team_id,
                    "x": round(c.x, 2),
                    "y": round(c.y, 2),
                    "hp": c.hp,
                    "food": c.food,
                    "animation": c.animation,
                })

        apple_list = [
            {"id": a.id, "x": round(a.x, 2), "y": round(a.y, 2), "type": a.type}
            for a in self.apples.values()
        ]

        team_stats = {
            tid: {
                "population": sum(
                    1 for c in self.creatures.values()
                    if c.team_id == tid and c.hp > 0
                ),
                **ts.stats,
            }
            for tid, ts in self.teams.items()
        }

        return {
            "tick": self.tick,
            "phase": self.phase,
            "time_in_phase": round(self.time_in_phase, 2),
            "turn_number": self.turn_number,
            "creatures": creature_list,
            "apples": apple_list,
            "team_stats": team_stats,
        }

    def get_full_state(self) -> dict[str, Any]:
        """Complete state for STATE_FULL sync messages."""
        creature_list = []
        for c in self.creatures.values():
            creature_list.append({
                "id": c.id,
                "team_id": c.team_id,
                "x": round(c.x, 2),
                "y": round(c.y, 2),
                "hp": c.hp,
                "food": c.food,
                "ai_state": c.ai_state.name,
                "stats": c.stats,
                "gene": c.gene,
                "animation": c.animation,
            })

        apple_list = [
            {"id": a.id, "x": round(a.x, 2), "y": round(a.y, 2), "type": a.type}
            for a in self.apples.values()
        ]

        teams_data = {}
        for tid, ts in self.teams.items():
            population = sum(
                1 for c in self.creatures.values()
                if c.team_id == tid and c.hp > 0
            )
            teams_data[tid] = {
                "archetype": ts.archetype,
                "gene": ts.gene,
                "username": ts.username,
                "color_index": ts.color_index,
                "population": population,
                **ts.stats,
            }

        return {
            "tick": self.tick,
            "phase": self.phase,
            "time_in_phase": round(self.time_in_phase, 2),
            "turn_number": self.turn_number,
            "map_size": self.map_size,
            "houses": {tid: list(pos) for tid, pos in self.houses.items()},
            "creatures": creature_list,
            "apples": apple_list,
            "teams": teams_data,
        }
