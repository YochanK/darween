"""Creature entity and AI state machine."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any

import numpy as np

from config import (
    TERRAIN_SPEEDS,
    MAX_HP,
    FOOD_PER_DAY,
    BASE_CREATURE_SPEED,
    APPLE_PICKUP_RADIUS,
    SUGAR_RUSH_DURATION,
    SUGAR_RUSH_SPEED_MULT,
    DAY_DURATION,
)
from spatial_hash import SpatialHash


# ── AI States ───────────────────────────────────────────────────────────────

class AIState(Enum):
    IDLE = auto()
    SEEKING_FOOD = auto()
    MOVING_TO_FOOD = auto()
    SEEKING_ENEMY = auto()
    FIGHTING = auto()
    RETURNING_HOME = auto()
    AT_HOME = auto()
    WANDERING = auto()


# ── Apple data (lightweight reference) ──────────────────────────────────────

@dataclass
class Apple:
    id: int
    x: float
    y: float
    type: str  # "normal", "golden", "rotten"


# ── Creature dataclass ─────────────────────────────────────────────────────

@dataclass
class Creature:
    id: int
    team_id: str
    x: float
    y: float
    stats: dict[str, int]       # life, speed, attack, defense, ...
    hp: int = MAX_HP
    food: int = 0
    ai_state: AIState = AIState.IDLE
    target_x: float = 0.0
    target_y: float = 0.0
    path: list[tuple[int, int]] = field(default_factory=list)
    gene: str = ""
    combat_cooldown: float = 0.0
    speed_boost: float = 1.0
    speed_boost_timer: float = 0.0
    animation: str = "idle"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _terrain_speed_at(x: float, y: float, terrain: np.ndarray, map_size: int) -> float:
    """Return terrain speed multiplier at a world position."""
    tx = max(0, min(int(x), map_size - 1))
    ty = max(0, min(int(y), map_size - 1))
    return TERRAIN_SPEEDS.get(int(terrain[ty, tx]), 0.0)


def _distance(ax: float, ay: float, bx: float, by: float) -> float:
    dx = ax - bx
    dy = ay - by
    return math.sqrt(dx * dx + dy * dy)


def _move_toward(
    creature: Creature,
    tx: float,
    ty: float,
    dt: float,
    terrain: np.ndarray,
    map_size: int,
    elapsed_time: float,
) -> bool:
    """Move *creature* toward (tx, ty). Return True if arrived."""
    dx = tx - creature.x
    dy = ty - creature.y
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 0.05:
        creature.x = tx
        creature.y = ty
        return True

    # Base speed scaled by stat (stat 5 = normal)
    speed = creature.stats.get("speed", 5) * BASE_CREATURE_SPEED / 5.0

    # Terrain multiplier
    t_speed = _terrain_speed_at(creature.x, creature.y, terrain, map_size)
    if t_speed <= 0.0:
        return False
    speed *= t_speed

    # Endurance degradation over the day
    endurance = creature.stats.get("endurance", 5)
    degradation = (1.0 - (elapsed_time / DAY_DURATION) * (10 - endurance) / 10.0 * 0.4)
    speed *= max(0.1, degradation)

    # Speed boost (sugar rush)
    if creature.speed_boost_timer > 0.0:
        speed *= creature.speed_boost

    step = speed * dt
    if step >= dist:
        creature.x = tx
        creature.y = ty
        return True

    creature.x += (dx / dist) * step
    creature.y += (dy / dist) * step
    # Clamp to map
    creature.x = max(0.0, min(creature.x, map_size - 1.0))
    creature.y = max(0.0, min(creature.y, map_size - 1.0))
    return False


def _follow_path(
    creature: Creature,
    dt: float,
    terrain: np.ndarray,
    map_size: int,
    elapsed_time: float,
) -> bool:
    """Advance creature along its waypoint path. Return True when path is done."""
    if not creature.path:
        return True

    # Target the next waypoint (tile centre)
    wx, wy = creature.path[0]
    tx = wx + 0.5
    ty = wy + 0.5
    arrived = _move_toward(creature, tx, ty, dt, terrain, map_size, elapsed_time)
    if arrived:
        creature.path.pop(0)
    return len(creature.path) == 0


def _follow_distance_field(
    creature: Creature,
    dt: float,
    terrain: np.ndarray,
    map_size: int,
    distance_field: np.ndarray,
    elapsed_time: float,
) -> bool:
    """Move creature one step along the distance-field gradient toward home.

    Returns True when the creature is within 1 tile of the target (dist == 0).
    """
    cx = max(0, min(int(creature.x), map_size - 1))
    cy = max(0, min(int(creature.y), map_size - 1))

    if distance_field[cy, cx] <= 1.0:
        return True

    # Pick the neighbour with the lowest distance value
    best_val = distance_field[cy, cx]
    best_nx, best_ny = cx, cy
    for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = cx + ddx, cy + ddy
        if 0 <= nx < map_size and 0 <= ny < map_size:
            v = distance_field[ny, nx]
            if v < best_val:
                best_val = v
                best_nx, best_ny = nx, ny

    if (best_nx, best_ny) == (cx, cy):
        return False  # stuck / unreachable

    _move_toward(
        creature,
        best_nx + 0.5,
        best_ny + 0.5,
        dt,
        terrain,
        map_size,
        elapsed_time,
    )
    return False


def _find_nearest_apple(
    creature: Creature,
    apples: dict[int, Apple],
    spatial_hash: SpatialHash,
    radius: float,
) -> Apple | None:
    """Find the nearest apple within *radius* of the creature."""
    nearby_ids = spatial_hash.query_radius(creature.x, creature.y, radius)
    best: Apple | None = None
    best_dist = math.inf
    for aid in nearby_ids:
        apple = apples.get(aid)
        if apple is None:
            continue
        d = _distance(creature.x, creature.y, apple.x, apple.y)
        if d < best_dist:
            best_dist = d
            best = apple
    return best


def _find_nearest_enemy(
    creature: Creature,
    creatures: dict[int, Creature],
    spatial_hash: SpatialHash,
    radius: float,
) -> Creature | None:
    """Find the nearest enemy creature within *radius*."""
    nearby_ids = spatial_hash.query_radius(creature.x, creature.y, radius)
    best: Creature | None = None
    best_dist = math.inf
    for eid in nearby_ids:
        other = creatures.get(eid)
        if other is None or other.team_id == creature.team_id or other.hp <= 0:
            continue
        d = _distance(creature.x, creature.y, other.x, other.y)
        if d < best_dist:
            best_dist = d
            best = other
    return best


def _find_nearest_ally(
    creature: Creature,
    creatures: dict[int, Creature],
    spatial_hash: SpatialHash,
    radius: float,
) -> Creature | None:
    """Find the nearest allied creature within *radius* (excluding self)."""
    nearby_ids = spatial_hash.query_radius(creature.x, creature.y, radius)
    best: Creature | None = None
    best_dist = math.inf
    for eid in nearby_ids:
        other = creatures.get(eid)
        if other is None or other.id == creature.id or other.team_id != creature.team_id:
            continue
        d = _distance(creature.x, creature.y, other.x, other.y)
        if d < best_dist:
            best_dist = d
            best = other
    return best


def _apply_sociability_bias(
    creature: Creature,
    tx: float,
    ty: float,
    creatures: dict[int, Creature],
    spatial_hash: SpatialHash,
) -> tuple[float, float]:
    """Bias target position toward nearest ally based on sociability stat."""
    sociability = creature.stats.get("sociability", 5)
    if sociability <= 0:
        return tx, ty
    ally = _find_nearest_ally(creature, creatures, spatial_hash, 10.0)
    if ally is None:
        return tx, ty
    factor = sociability / 20.0
    return (
        tx + (ally.x - tx) * factor,
        ty + (ally.y - ty) * factor,
    )


def _pick_random_walkable(
    cx: float,
    cy: float,
    radius: int,
    terrain: np.ndarray,
    map_size: int,
) -> tuple[int, int] | None:
    """Choose a random walkable tile within *radius* of (cx, cy)."""
    ix, iy = int(cx), int(cy)
    candidates: list[tuple[int, int]] = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            nx, ny = ix + dx, iy + dy
            if 0 <= nx < map_size and 0 <= ny < map_size:
                if TERRAIN_SPEEDS.get(int(terrain[ny, nx]), 0.0) > 0.0:
                    candidates.append((nx, ny))
    if not candidates:
        return None
    return random.choice(candidates)


# ── Main update ─────────────────────────────────────────────────────────────

def update_creature(
    creature: Creature,
    dt: float,
    terrain: np.ndarray,
    map_size: int,
    apple_spatial_hash: SpatialHash,
    creature_spatial_hash: SpatialHash,
    apples: dict[int, Apple],
    creatures: dict[int, Creature],
    distance_field: np.ndarray | None,
    phase: str,
    elapsed_time: float,
) -> list[dict[str, Any]]:
    """Advance one creature by *dt* seconds.

    Parameters
    ----------
    apple_spatial_hash : spatial hash containing apple entities
    creature_spatial_hash : spatial hash containing creature entities

    Returns a list of event dicts (e.g. apple pickups) that the caller
    should process.
    """
    events: list[dict[str, Any]] = []

    if creature.hp <= 0:
        return events

    # Decrement speed boost timer
    if creature.speed_boost_timer > 0.0:
        creature.speed_boost_timer -= dt
        if creature.speed_boost_timer <= 0.0:
            creature.speed_boost = 1.0
            creature.speed_boost_timer = 0.0

    # Decrement combat cooldown
    if creature.combat_cooldown > 0.0:
        creature.combat_cooldown -= dt
        if creature.combat_cooldown < 0.0:
            creature.combat_cooldown = 0.0

    visibility = creature.stats.get("visibility", 5)
    bravery = creature.stats.get("bravery", 5)

    # ── NIGHT behaviour ─────────────────────────────────────────────────
    if phase == "NIGHT":
        if creature.ai_state not in (AIState.RETURNING_HOME, AIState.AT_HOME):
            creature.ai_state = AIState.RETURNING_HOME

        if creature.ai_state == AIState.RETURNING_HOME:
            creature.animation = "walk"
            if distance_field is not None:
                arrived = _follow_distance_field(
                    creature, dt, terrain, map_size, distance_field, elapsed_time,
                )
                if arrived:
                    creature.ai_state = AIState.AT_HOME
                    creature.animation = "idle"
            else:
                creature.ai_state = AIState.AT_HOME
                creature.animation = "idle"

        # AT_HOME: do nothing
        return events

    # ── DAY behaviour ───────────────────────────────────────────────────

    if creature.ai_state == AIState.IDLE or creature.ai_state == AIState.SEEKING_FOOD:
        creature.animation = "idle"
        # Try to find an apple
        apple = _find_nearest_apple(
            creature, apples, apple_spatial_hash, visibility * 2.0,
        )
        if apple is not None:
            from pathfinding import a_star

            # Sociability bias on target
            atx, aty = _apply_sociability_bias(
                creature, apple.x, apple.y, creatures, creature_spatial_hash,
            )
            creature.target_x = apple.x  # store actual apple position
            creature.target_y = apple.y
            creature.path = a_star(
                (int(creature.x), int(creature.y)),
                (int(atx), int(aty)),
                terrain,
                map_size,
            )
            creature.ai_state = AIState.MOVING_TO_FOOD
        else:
            # Wander
            dest = _pick_random_walkable(
                creature.x, creature.y, 5, terrain, map_size,
            )
            if dest is not None:
                from pathfinding import a_star

                creature.path = a_star(
                    (int(creature.x), int(creature.y)),
                    dest,
                    terrain,
                    map_size,
                )
                creature.ai_state = AIState.WANDERING

    elif creature.ai_state == AIState.MOVING_TO_FOOD:
        creature.animation = "walk"
        done = _follow_path(creature, dt, terrain, map_size, elapsed_time)

        # Check if close enough to pick up any apple
        best_apple = _find_nearest_apple(
            creature, apples, apple_spatial_hash, APPLE_PICKUP_RADIUS,
        )
        if best_apple is not None:
            creature.food += 1
            events.append({
                "type": "apple_pickup",
                "creature_id": creature.id,
                "apple_id": best_apple.id,
                "apple_type": best_apple.type,
            })
            # Gene: sugar rush
            if creature.gene == "sugar_rush":
                creature.speed_boost = SUGAR_RUSH_SPEED_MULT
                creature.speed_boost_timer = SUGAR_RUSH_DURATION
            creature.ai_state = AIState.SEEKING_FOOD

        elif done:
            # Path exhausted without pickup
            creature.ai_state = AIState.SEEKING_FOOD

    elif creature.ai_state == AIState.WANDERING:
        creature.animation = "walk"
        done = _follow_path(creature, dt, terrain, map_size, elapsed_time)
        if done:
            creature.ai_state = AIState.SEEKING_FOOD

    elif creature.ai_state == AIState.SEEKING_ENEMY:
        creature.animation = "walk"
        enemy = _find_nearest_enemy(
            creature, creatures, creature_spatial_hash, float(visibility),
        )
        if enemy is not None:
            from pathfinding import a_star

            etx, ety = _apply_sociability_bias(
                creature, enemy.x, enemy.y, creatures, creature_spatial_hash,
            )
            creature.path = a_star(
                (int(creature.x), int(creature.y)),
                (int(etx), int(ety)),
                terrain,
                map_size,
            )
            creature.target_x = enemy.x
            creature.target_y = enemy.y
            creature.ai_state = AIState.FIGHTING
        else:
            creature.ai_state = AIState.SEEKING_FOOD

    elif creature.ai_state == AIState.FIGHTING:
        creature.animation = "walk"
        done = _follow_path(creature, dt, terrain, map_size, elapsed_time)
        if done:
            creature.ai_state = AIState.SEEKING_ENEMY

    # ── Bravery check: switch to combat mode ────────────────────────────
    if creature.ai_state in (AIState.SEEKING_FOOD, AIState.MOVING_TO_FOOD, AIState.WANDERING):
        if creature.food >= FOOD_PER_DAY and creature.hp == MAX_HP:
            if random.random() < bravery / 10.0:
                creature.ai_state = AIState.SEEKING_ENEMY

    return events
