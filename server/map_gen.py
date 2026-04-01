"""Procedural isometric map generation using Perlin noise."""

import math
import random
from collections import deque

import numpy as np
from noise import pnoise2

from config import (
    TERRAIN_GRASS,
    TERRAIN_ROCK,
    TERRAIN_SAND,
    TERRAIN_WATER,
)


def generate_map(map_size: int, num_players: int, seed: int | None = None) -> tuple[np.ndarray, list[tuple[int, int]]]:
    """
    Generate a terrain map and house positions.

    Returns:
        (terrain, houses) where terrain is a 2D numpy array of terrain types
        and houses is a list of (x, y) tile coordinates for each team's house.
    """
    if seed is None:
        seed = random.randint(0, 100_000)

    terrain = _generate_terrain(map_size, seed)
    houses = _place_houses(map_size, num_players)

    # Clear area around each house
    for hx, hy in houses:
        _clear_area(terrain, hx, hy, radius=3)

    # Ensure all houses are connected
    _ensure_connectivity(terrain, houses)

    return terrain, houses


def _generate_terrain(map_size: int, seed: int) -> np.ndarray:
    """Generate terrain using layered Perlin noise."""
    terrain = np.full((map_size, map_size), TERRAIN_GRASS, dtype=np.int8)

    for y in range(map_size):
        for x in range(map_size):
            # Elevation: 2 octaves
            elevation = pnoise2(
                x * 0.08 + seed,
                y * 0.08 + seed,
                octaves=2,
                persistence=0.5,
            )
            elevation = (elevation + 1) / 2  # normalize to [0, 1]

            # Moisture: 1 octave with offset seed
            moisture = pnoise2(
                x * 0.06 + seed + 500,
                y * 0.06 + seed + 500,
                octaves=1,
            )
            moisture = (moisture + 1) / 2

            # Classify terrain
            if elevation < 0.30:
                terrain[y][x] = TERRAIN_WATER
            elif elevation < 0.38 or (elevation < 0.45 and moisture > 0.6):
                terrain[y][x] = TERRAIN_SAND
            elif elevation > 0.75:
                terrain[y][x] = TERRAIN_ROCK
            else:
                terrain[y][x] = TERRAIN_GRASS

    return terrain


def _place_houses(map_size: int, num_players: int) -> list[tuple[int, int]]:
    """Place houses in a circle at 70% radius from center."""
    center = map_size / 2
    radius = map_size * 0.35  # 70% of half-size = 35% of full size
    houses = []

    for i in range(num_players):
        angle = (2 * math.pi * i / num_players) - math.pi / 2  # start from top
        hx = int(center + radius * math.cos(angle))
        hy = int(center + radius * math.sin(angle))
        # Clamp to map bounds with margin
        hx = max(4, min(map_size - 5, hx))
        hy = max(4, min(map_size - 5, hy))
        houses.append((hx, hy))

    return houses


def _clear_area(terrain: np.ndarray, cx: int, cy: int, radius: int = 3):
    """Force a square area around a position to grass."""
    map_size = terrain.shape[0]
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < map_size and 0 <= ny < map_size:
                terrain[ny][nx] = TERRAIN_GRASS


def _is_walkable(terrain_type: int) -> bool:
    """Check if a terrain type is walkable (not rock)."""
    return terrain_type != TERRAIN_ROCK


def _ensure_connectivity(terrain: np.ndarray, houses: list[tuple[int, int]]):
    """Ensure all houses are reachable from each other via walkable tiles."""
    if len(houses) < 2:
        return

    map_size = terrain.shape[0]

    # Find connected components using flood fill from first house
    visited = set()
    _flood_fill(terrain, houses[0], visited, map_size)

    # Check which houses are unreachable and carve paths
    for i in range(1, len(houses)):
        if houses[i] not in visited:
            # Carve a path from this house to the nearest connected house
            _carve_path(terrain, houses[i], houses[0], width=2)
            # Re-flood to update visited
            visited.clear()
            _flood_fill(terrain, houses[0], visited, map_size)


def _flood_fill(terrain: np.ndarray, start: tuple[int, int], visited: set, map_size: int):
    """BFS flood fill from start on walkable tiles."""
    queue = deque([start])
    visited.add(start)

    while queue:
        x, y = queue.popleft()
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < map_size and 0 <= ny < map_size and (nx, ny) not in visited:
                if _is_walkable(terrain[ny][nx]):
                    visited.add((nx, ny))
                    queue.append((nx, ny))


def _carve_path(terrain: np.ndarray, start: tuple[int, int], end: tuple[int, int], width: int = 2):
    """Carve a grass path between two points using Bresenham-like line."""
    map_size = terrain.shape[0]
    x0, y0 = start
    x1, y1 = end

    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy

    while True:
        # Carve wide path
        for wy in range(-width, width + 1):
            for wx in range(-width, width + 1):
                nx, ny = x0 + wx, y0 + wy
                if 0 <= nx < map_size and 0 <= ny < map_size:
                    if terrain[ny][nx] == TERRAIN_ROCK:
                        terrain[ny][nx] = TERRAIN_GRASS

        if x0 == x1 and y0 == y1:
            break

        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
