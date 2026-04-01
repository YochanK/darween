"""Apple spawning and pickup logic."""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from enum import IntEnum

import numpy as np

from config import (
    APPLE_PICKUP_RADIUS,
    GOLDEN_APPLE_CHANCE,
    MAX_HP,
    ROTTEN_APPLE_CHANCE,
    ROTTEN_APPLE_DAMAGE,
    SUGAR_RUSH_DURATION,
    SUGAR_RUSH_SPEED_MULT,
    TERRAIN_GRASS,
    TERRAIN_SAND,
    apple_spawn_interval,
    max_apples,
)


class AppleType(IntEnum):
    NORMAL = 0
    GOLDEN = 1
    ROTTEN = 2


@dataclass
class Apple:
    id: str
    x: int
    y: int
    apple_type: AppleType


class FoodManager:
    def __init__(self, terrain: np.ndarray, map_size: int, num_players: int):
        self.terrain = terrain
        self.map_size = map_size
        self.num_players = num_players
        self.apples: dict[str, Apple] = {}
        self.spawn_timer = 0.0
        self.spawn_interval = apple_spawn_interval(num_players)
        self.max_apples_count = max_apples(num_players)
        # Track added/removed for delta updates
        self.added_this_tick: list[Apple] = []
        self.removed_this_tick: list[str] = []

    def update(self, dt: float):
        """Spawn new apples based on timer."""
        self.added_this_tick.clear()
        self.removed_this_tick.clear()

        self.spawn_timer += dt
        if self.spawn_timer >= self.spawn_interval and len(self.apples) < self.max_apples_count:
            self.spawn_timer = 0.0
            apple = self._spawn_apple()
            if apple:
                self.apples[apple.id] = apple
                self.added_this_tick.append(apple)

    def try_pickup(self, creature_x: float, creature_y: float) -> Apple | None:
        """Check if a creature at (x,y) can pick up an apple. Returns the apple or None."""
        for apple in list(self.apples.values()):
            dx = creature_x - apple.x
            dy = creature_y - apple.y
            if dx * dx + dy * dy <= APPLE_PICKUP_RADIUS * APPLE_PICKUP_RADIUS:
                del self.apples[apple.id]
                self.removed_this_tick.append(apple.id)
                return apple
        return None

    def apply_apple_effect(self, creature, apple: Apple):
        """Apply apple effects to a creature."""
        if apple.apple_type == AppleType.NORMAL:
            creature.food += 1
            if creature.gene == "sugar_rush":
                creature.speed_boost = SUGAR_RUSH_SPEED_MULT
                creature.speed_boost_timer = SUGAR_RUSH_DURATION
        elif apple.apple_type == AppleType.GOLDEN:
            creature.food += 1
            creature.hp = min(MAX_HP, creature.hp + 1)
        elif apple.apple_type == AppleType.ROTTEN:
            creature.hp -= ROTTEN_APPLE_DAMAGE

    def _spawn_apple(self) -> Apple | None:
        """Spawn an apple on a random walkable tile."""
        for _ in range(50):
            x = random.randint(0, self.map_size - 1)
            y = random.randint(0, self.map_size - 1)
            terrain_type = self.terrain[y][x]
            if terrain_type in (TERRAIN_GRASS, TERRAIN_SAND):
                # Check no apple already there
                if not any(a.x == x and a.y == y for a in self.apples.values()):
                    apple_type = self._roll_apple_type()
                    return Apple(
                        id=str(uuid.uuid4())[:8],
                        x=x,
                        y=y,
                        apple_type=apple_type,
                    )
        return None

    def _roll_apple_type(self) -> AppleType:
        roll = random.random()
        if roll < GOLDEN_APPLE_CHANCE:
            return AppleType.GOLDEN
        elif roll < GOLDEN_APPLE_CHANCE + ROTTEN_APPLE_CHANCE:
            return AppleType.ROTTEN
        return AppleType.NORMAL

    def get_apple_positions(self) -> dict[str, tuple[int, int, int]]:
        """Get all apple positions for spatial hash or state updates."""
        return {a.id: (a.x, a.y, int(a.apple_type)) for a in self.apples.values()}
