"""Creature entity and AI state machine with steering-based movement."""

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
    MAX_FORCE,
    SEPARATION_RADIUS,
    SEPARATION_WEIGHT,
    SLOWING_RADIUS,
    WANDER_CIRCLE_DISTANCE,
    WANDER_CIRCLE_RADIUS,
    WANDER_ANGLE_DELTA,
    ALERT_DURATION,
    PURSUIT_GIVE_UP_DIST,
    FIGHT_RANGE,
    FIGHT_ORBIT_DIST,
    FIGHT_LUNGE_CHANCE,
    FIGHT_LUNGE_SPEED_MULT,
)
from spatial_hash import SpatialHash


# ── AI States ───────────────────────────────────────────────────────────────

class AIState(Enum):
    IDLE = auto()
    SEEKING_FOOD = auto()
    MOVING_TO_FOOD = auto()
    WANDER = auto()
    ALERT = auto()
    FLEE = auto()
    PURSUE = auto()
    FIGHT = auto()
    SEEKING_ENEMY = auto()
    RETURNING_HOME = auto()
    AT_HOME = auto()
    WANDERING = auto()  # legacy alias — treated same as WANDER


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
    # Steering fields
    vx: float = 0.0
    vy: float = 0.0
    wander_angle: float = 0.0
    emoji: str | None = None
    alert_timer: float = 0.0
    target_creature_id: int | None = None


# ── Helpers ─────────────────────────────────────────────────────────────────

def _terrain_speed_at(x: float, y: float, terrain: np.ndarray, map_size: int) -> float:
    tx = max(0, min(int(x), map_size - 1))
    ty = max(0, min(int(y), map_size - 1))
    return TERRAIN_SPEEDS.get(int(terrain[ty, tx]), 0.0)


def _distance(ax: float, ay: float, bx: float, by: float) -> float:
    dx = ax - bx
    dy = ay - by
    return math.sqrt(dx * dx + dy * dy)


def _clamp_vec(fx: float, fy: float, max_mag: float) -> tuple[float, float]:
    mag = math.sqrt(fx * fx + fy * fy)
    if mag > max_mag and mag > 0:
        scale = max_mag / mag
        return fx * scale, fy * scale
    return fx, fy


# ── Speed computation ──────────────────────────────────────────────────────

def _compute_max_speed(
    creature: Creature,
    terrain: np.ndarray,
    map_size: int,
    elapsed_time: float,
) -> float:
    speed = creature.stats.get("speed", 5) * BASE_CREATURE_SPEED / 5.0

    t_speed = _terrain_speed_at(creature.x, creature.y, terrain, map_size)
    if t_speed <= 0.0:
        return 0.0
    speed *= t_speed

    endurance = creature.stats.get("endurance", 5)
    degradation = 1.0 - (elapsed_time / DAY_DURATION) * (10 - endurance) / 10.0 * 0.4
    speed *= max(0.1, degradation)

    if creature.speed_boost_timer > 0.0:
        speed *= creature.speed_boost

    return speed


# ── Steering forces ───────────────────────────────────────────────────────

def _seek(creature: Creature, tx: float, ty: float, max_speed: float) -> tuple[float, float]:
    dx = tx - creature.x
    dy = ty - creature.y
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 0.001:
        return 0.0, 0.0
    desired_vx = (dx / dist) * max_speed
    desired_vy = (dy / dist) * max_speed
    fx = desired_vx - creature.vx
    fy = desired_vy - creature.vy
    return _clamp_vec(fx, fy, MAX_FORCE)


def _arrive(
    creature: Creature,
    tx: float,
    ty: float,
    max_speed: float,
    slowing_radius: float = SLOWING_RADIUS,
) -> tuple[float, float]:
    dx = tx - creature.x
    dy = ty - creature.y
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 0.001:
        return -creature.vx, -creature.vy  # brake

    # Scale desired speed within slowing radius
    desired_speed = max_speed
    if dist < slowing_radius:
        desired_speed = max_speed * (dist / slowing_radius)

    desired_vx = (dx / dist) * desired_speed
    desired_vy = (dy / dist) * desired_speed
    fx = desired_vx - creature.vx
    fy = desired_vy - creature.vy
    return _clamp_vec(fx, fy, MAX_FORCE)


def _flee(creature: Creature, tx: float, ty: float, max_speed: float) -> tuple[float, float]:
    dx = creature.x - tx
    dy = creature.y - ty
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 0.001:
        angle = random.random() * 2 * math.pi
        dx, dy = math.cos(angle), math.sin(angle)
        dist = 1.0
    desired_vx = (dx / dist) * max_speed
    desired_vy = (dy / dist) * max_speed
    fx = desired_vx - creature.vx
    fy = desired_vy - creature.vy
    return _clamp_vec(fx, fy, MAX_FORCE)


def _wander_steer(creature: Creature, max_speed: float) -> tuple[float, float]:
    # Direction the creature is currently heading
    speed = math.sqrt(creature.vx * creature.vx + creature.vy * creature.vy)
    if speed > 0.01:
        heading_x = creature.vx / speed
        heading_y = creature.vy / speed
    else:
        heading_x = math.cos(creature.wander_angle)
        heading_y = math.sin(creature.wander_angle)

    # Circle center projected ahead
    circle_cx = creature.x + heading_x * WANDER_CIRCLE_DISTANCE
    circle_cy = creature.y + heading_y * WANDER_CIRCLE_DISTANCE

    # Nudge wander angle
    creature.wander_angle += random.uniform(-WANDER_ANGLE_DELTA, WANDER_ANGLE_DELTA)

    # Target point on circle edge
    target_x = circle_cx + math.cos(creature.wander_angle) * WANDER_CIRCLE_RADIUS
    target_y = circle_cy + math.sin(creature.wander_angle) * WANDER_CIRCLE_RADIUS

    return _seek(creature, target_x, target_y, max_speed)


def _pursue(creature: Creature, target: Creature, max_speed: float) -> tuple[float, float]:
    dx = target.x - creature.x
    dy = target.y - creature.y
    dist = math.sqrt(dx * dx + dy * dy)
    if dist < 0.001:
        return 0.0, 0.0

    # Estimate time to intercept
    speed = math.sqrt(creature.vx * creature.vx + creature.vy * creature.vy)
    if speed > 0.01:
        t = dist / speed
    else:
        t = dist / max(max_speed, 0.1)
    t = min(t, 1.0)  # cap prediction horizon

    # Predicted position
    pred_x = target.x + target.vx * t
    pred_y = target.y + target.vy * t
    return _seek(creature, pred_x, pred_y, max_speed)


# ── Separation ─────────────────────────────────────────────────────────────

def _separation(
    creature: Creature,
    creatures: dict[int, Creature],
    spatial_hash: SpatialHash,
) -> tuple[float, float]:
    nearby = spatial_hash.query_radius(creature.x, creature.y, SEPARATION_RADIUS)
    fx, fy = 0.0, 0.0
    for eid in nearby:
        if eid == creature.id:
            continue
        other = creatures.get(eid)
        if other is None or other.hp <= 0:
            continue
        dx = creature.x - other.x
        dy = creature.y - other.y
        dist = math.sqrt(dx * dx + dy * dy)
        if dist < 0.01:
            angle = random.random() * 2 * math.pi
            fx += math.cos(angle) * SEPARATION_WEIGHT
            fy += math.sin(angle) * SEPARATION_WEIGHT
        elif dist < SEPARATION_RADIUS:
            strength = SEPARATION_WEIGHT * (1.0 - dist / SEPARATION_RADIUS)
            fx += (dx / dist) * strength
            fy += (dy / dist) * strength
    return fx, fy


# ── Velocity integration ──────────────────────────────────────────────────

def _integrate(
    creature: Creature,
    fx: float,
    fy: float,
    max_speed: float,
    dt: float,
    map_size: int,
) -> None:
    creature.vx += fx * dt
    creature.vy += fy * dt

    # Clamp velocity to max_speed
    speed = math.sqrt(creature.vx * creature.vx + creature.vy * creature.vy)
    if speed > max_speed and speed > 0:
        creature.vx = (creature.vx / speed) * max_speed
        creature.vy = (creature.vy / speed) * max_speed

    creature.x += creature.vx * dt
    creature.y += creature.vy * dt

    # Clamp position to map bounds
    creature.x = max(0.0, min(creature.x, map_size - 1.0))
    creature.y = max(0.0, min(creature.y, map_size - 1.0))


# ── Path following (steering-based) ───────────────────────────────────────

def _follow_path_steering(
    creature: Creature,
    max_speed: float,
) -> tuple[float, float, bool]:
    """Return steering force toward current waypoint + whether path is done."""
    if not creature.path:
        return 0.0, 0.0, True

    wx, wy = creature.path[0]
    tx = wx + 0.5
    ty = wy + 0.5
    dist = _distance(creature.x, creature.y, tx, ty)

    if dist < 0.15:
        creature.path.pop(0)
        if not creature.path:
            return 0.0, 0.0, True
        wx, wy = creature.path[0]
        tx = wx + 0.5
        ty = wy + 0.5

    fx, fy = _arrive(creature, tx, ty, max_speed, slowing_radius=0.3)
    return fx, fy, False


# ── Distance field following (steering-based) ─────────────────────────────

def _follow_distance_field_steering(
    creature: Creature,
    terrain: np.ndarray,
    map_size: int,
    distance_field: np.ndarray,
    max_speed: float,
) -> tuple[float, float, bool]:
    """Return steering force toward home via distance field. Returns (fx, fy, arrived)."""
    cx = max(0, min(int(creature.x), map_size - 1))
    cy = max(0, min(int(creature.y), map_size - 1))

    if distance_field[cy, cx] <= 1.0:
        return 0.0, 0.0, True

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
        return 0.0, 0.0, False  # stuck

    fx, fy = _seek(creature, best_nx + 0.5, best_ny + 0.5, max_speed)
    return fx, fy, False


# ── Finder helpers ─────────────────────────────────────────────────────────

def _find_nearest_apple(
    creature: Creature,
    apples: dict[int, Apple],
    spatial_hash: SpatialHash,
    radius: float,
) -> Apple | None:
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


# Vulnerable states that can be interrupted by alert
_ALERTABLE_STATES = frozenset({
    AIState.SEEKING_FOOD, AIState.MOVING_TO_FOOD,
    AIState.WANDER, AIState.WANDERING, AIState.IDLE,
})


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
    """Advance one creature by *dt* seconds. Returns event dicts."""
    events: list[dict[str, Any]] = []

    if creature.hp <= 0:
        return events

    # Decrement timers
    if creature.speed_boost_timer > 0.0:
        creature.speed_boost_timer -= dt
        if creature.speed_boost_timer <= 0.0:
            creature.speed_boost = 1.0
            creature.speed_boost_timer = 0.0

    if creature.combat_cooldown > 0.0:
        creature.combat_cooldown -= dt
        if creature.combat_cooldown < 0.0:
            creature.combat_cooldown = 0.0

    visibility = creature.stats.get("visibility", 5)
    bravery = creature.stats.get("bravery", 5)
    max_speed = _compute_max_speed(creature, terrain, map_size, elapsed_time)

    steer_fx, steer_fy = 0.0, 0.0

    # ── NIGHT behaviour ─────────────────────────────────────────────────
    if phase == "NIGHT":
        creature.emoji = None
        if creature.ai_state not in (AIState.RETURNING_HOME, AIState.AT_HOME):
            creature.ai_state = AIState.RETURNING_HOME
            creature.target_creature_id = None

        if creature.ai_state == AIState.RETURNING_HOME:
            creature.animation = "walk"
            if distance_field is not None:
                sfx, sfy, arrived = _follow_distance_field_steering(
                    creature, terrain, map_size, distance_field, max_speed,
                )
                steer_fx, steer_fy = sfx, sfy
                if arrived:
                    creature.ai_state = AIState.AT_HOME
                    creature.animation = "idle"
                    creature.vx = 0.0
                    creature.vy = 0.0
            else:
                creature.ai_state = AIState.AT_HOME
                creature.animation = "idle"

        if creature.ai_state == AIState.AT_HOME:
            creature.vx = 0.0
            creature.vy = 0.0
            sep_fx, sep_fy = _separation(creature, creatures, creature_spatial_hash)
            _integrate(creature, sep_fx, sep_fy, max_speed, dt, map_size)
            return events

        # Apply separation + integrate for RETURNING_HOME
        sep_fx, sep_fy = _separation(creature, creatures, creature_spatial_hash)
        _integrate(creature, steer_fx + sep_fx, steer_fy + sep_fy, max_speed, dt, map_size)
        return events

    # ── DAY behaviour ───────────────────────────────────────────────────

    if creature.ai_state in (AIState.IDLE, AIState.SEEKING_FOOD):
        creature.animation = "idle"
        creature.emoji = None
        creature.target_creature_id = None

        # Try to find an apple
        apple = _find_nearest_apple(
            creature, apples, apple_spatial_hash, visibility * 2.0,
        )
        if apple is not None:
            from pathfinding import a_star
            atx, aty = _apply_sociability_bias(
                creature, apple.x, apple.y, creatures, creature_spatial_hash,
            )
            creature.target_x = apple.x
            creature.target_y = apple.y
            creature.path = a_star(
                (int(creature.x), int(creature.y)),
                (int(atx), int(aty)),
                terrain,
                map_size,
            )
            creature.ai_state = AIState.MOVING_TO_FOOD
        else:
            creature.ai_state = AIState.WANDER
            creature.wander_angle = random.uniform(0, 2 * math.pi)

    if creature.ai_state == AIState.MOVING_TO_FOOD:
        creature.animation = "walk"
        creature.emoji = None
        sfx, sfy, done = _follow_path_steering(creature, max_speed)
        steer_fx, steer_fy = sfx, sfy

        # Check apple pickup
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
            if creature.gene == "sugar_rush":
                creature.speed_boost = SUGAR_RUSH_SPEED_MULT
                creature.speed_boost_timer = SUGAR_RUSH_DURATION
            creature.ai_state = AIState.SEEKING_FOOD
        elif done:
            creature.ai_state = AIState.SEEKING_FOOD

    elif creature.ai_state in (AIState.WANDER, AIState.WANDERING):
        creature.animation = "walk"
        creature.emoji = None
        steer_fx, steer_fy = _wander_steer(creature, max_speed)

        # Periodically look for food
        apple = _find_nearest_apple(
            creature, apples, apple_spatial_hash, visibility * 2.0,
        )
        if apple is not None:
            from pathfinding import a_star
            atx, aty = _apply_sociability_bias(
                creature, apple.x, apple.y, creatures, creature_spatial_hash,
            )
            creature.target_x = apple.x
            creature.target_y = apple.y
            creature.path = a_star(
                (int(creature.x), int(creature.y)),
                (int(atx), int(aty)),
                terrain,
                map_size,
            )
            creature.ai_state = AIState.MOVING_TO_FOOD

    elif creature.ai_state == AIState.ALERT:
        creature.animation = "idle"
        creature.emoji = "!"
        creature.alert_timer -= dt
        # Frozen — only separation applied
        steer_fx, steer_fy = 0.0, 0.0

        if creature.alert_timer <= 0.0:
            creature.alert_timer = 0.0
            if bravery >= 5:
                creature.ai_state = AIState.PURSUE
                creature.emoji = None
            else:
                creature.ai_state = AIState.FLEE
                creature.emoji = None

    elif creature.ai_state == AIState.FLEE:
        creature.animation = "walk"
        creature.emoji = None
        target = creatures.get(creature.target_creature_id) if creature.target_creature_id else None

        if target is None or target.hp <= 0:
            creature.ai_state = AIState.SEEKING_FOOD
            creature.target_creature_id = None
        else:
            dist = _distance(creature.x, creature.y, target.x, target.y)
            if dist > PURSUIT_GIVE_UP_DIST:
                creature.ai_state = AIState.SEEKING_FOOD
                creature.target_creature_id = None
            else:
                steer_fx, steer_fy = _flee(creature, target.x, target.y, max_speed)

    elif creature.ai_state == AIState.PURSUE:
        creature.animation = "walk"
        creature.emoji = None
        target = creatures.get(creature.target_creature_id) if creature.target_creature_id else None

        if target is None or target.hp <= 0:
            creature.ai_state = AIState.SEEKING_FOOD
            creature.target_creature_id = None
        else:
            dist = _distance(creature.x, creature.y, target.x, target.y)
            if dist > PURSUIT_GIVE_UP_DIST:
                creature.ai_state = AIState.SEEKING_FOOD
                creature.target_creature_id = None
            elif dist <= FIGHT_RANGE:
                creature.ai_state = AIState.FIGHT
                creature.emoji = "\u2694\ufe0f"
                # Also set target to FIGHT if they're in pursue/alert
                if target.ai_state in (AIState.PURSUE, AIState.ALERT, AIState.FLEE):
                    target.ai_state = AIState.FIGHT
                    target.emoji = "\u2694\ufe0f"
                    target.target_creature_id = creature.id
            else:
                steer_fx, steer_fy = _pursue(creature, target, max_speed)

    elif creature.ai_state == AIState.FIGHT:
        creature.animation = "walk"
        creature.emoji = "\u2694\ufe0f"
        target = creatures.get(creature.target_creature_id) if creature.target_creature_id else None

        if target is None or target.hp <= 0:
            creature.ai_state = AIState.SEEKING_FOOD
            creature.target_creature_id = None
            creature.emoji = None
        else:
            dist = _distance(creature.x, creature.y, target.x, target.y)
            if dist > PURSUIT_GIVE_UP_DIST:
                creature.ai_state = AIState.SEEKING_FOOD
                creature.target_creature_id = None
                creature.emoji = None
            else:
                # Orbit + occasional lunge
                dx = target.x - creature.x
                dy = target.y - creature.y
                if dist > 0.01:
                    # Perpendicular vector for orbiting
                    perp_x = -dy / dist
                    perp_y = dx / dist
                    # Orbit target point
                    orbit_x = target.x - (dx / dist) * FIGHT_ORBIT_DIST + perp_x * 0.3
                    orbit_y = target.y - (dy / dist) * FIGHT_ORBIT_DIST + perp_y * 0.3

                    if random.random() < FIGHT_LUNGE_CHANCE:
                        # Lunge directly at target
                        steer_fx, steer_fy = _seek(
                            creature, target.x, target.y,
                            max_speed * FIGHT_LUNGE_SPEED_MULT,
                        )
                    else:
                        steer_fx, steer_fy = _seek(creature, orbit_x, orbit_y, max_speed)

    elif creature.ai_state == AIState.SEEKING_ENEMY:
        # Legacy state — transition to alert-based system
        creature.animation = "walk"
        enemy = _find_nearest_enemy(
            creature, creatures, creature_spatial_hash, float(visibility),
        )
        if enemy is not None:
            creature.target_creature_id = enemy.id
            creature.ai_state = AIState.ALERT
            creature.alert_timer = ALERT_DURATION
            creature.emoji = "!"
            # Alert the enemy too
            if enemy.ai_state in _ALERTABLE_STATES:
                enemy.ai_state = AIState.ALERT
                enemy.alert_timer = ALERT_DURATION
                enemy.emoji = "!"
                enemy.target_creature_id = creature.id
        else:
            creature.ai_state = AIState.SEEKING_FOOD

    # ── Bravery check: switch to combat alert ──────────────────────────
    if creature.ai_state in _ALERTABLE_STATES:
        if creature.food >= FOOD_PER_DAY and creature.hp == MAX_HP:
            if random.random() < bravery / 10.0:
                enemy = _find_nearest_enemy(
                    creature, creatures, creature_spatial_hash, float(visibility) * 2.0,
                )
                if enemy is not None:
                    creature.target_creature_id = enemy.id
                    creature.ai_state = AIState.ALERT
                    creature.alert_timer = ALERT_DURATION
                    creature.emoji = "!"
                    # Alert the enemy independently
                    if enemy.ai_state in _ALERTABLE_STATES:
                        enemy.ai_state = AIState.ALERT
                        enemy.alert_timer = ALERT_DURATION
                        enemy.emoji = "!"
                        enemy.target_creature_id = creature.id

    # ── Apply separation + integrate ───────────────────────────────────
    sep_fx, sep_fy = _separation(creature, creatures, creature_spatial_hash)
    _integrate(creature, steer_fx + sep_fx, steer_fy + sep_fy, max_speed, dt, map_size)

    # Keep creature on walkable terrain — if on rock, push back
    t_speed = _terrain_speed_at(creature.x, creature.y, terrain, map_size)
    if t_speed <= 0.0:
        creature.vx = -creature.vx * 0.5
        creature.vy = -creature.vy * 0.5
        creature.x += creature.vx * dt
        creature.y += creature.vy * dt
        creature.x = max(0.0, min(creature.x, map_size - 1.0))
        creature.y = max(0.0, min(creature.y, map_size - 1.0))

    return events
