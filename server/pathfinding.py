"""A* pathfinding and Dijkstra distance fields for the tile map."""

from __future__ import annotations

import heapq
import math

import numpy as np

from config import TERRAIN_SPEEDS


# 4-directional neighbours (dx, dy)
_DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _terrain_cost(terrain_type: int) -> float:
    """Return movement cost for a terrain tile, or inf if impassable."""
    speed = TERRAIN_SPEEDS.get(terrain_type, 0.0)
    if speed <= 0.0:
        return math.inf
    return 1.0 / speed


def _heuristic(ax: int, ay: int, bx: int, by: int) -> float:
    """Manhattan distance heuristic (consistent for 4-dir movement)."""
    return abs(ax - bx) + abs(ay - by)


def _in_bounds(x: int, y: int, map_size: int) -> bool:
    return 0 <= x < map_size and 0 <= y < map_size


# ── A* ──────────────────────────────────────────────────────────────────────

def a_star(
    start: tuple[int, int],
    goal: tuple[int, int],
    terrain: np.ndarray,
    map_size: int,
) -> list[tuple[int, int]]:
    """Return a list of (x, y) waypoints from *start* to *goal* (inclusive).

    Uses A* with terrain-weighted edge costs.  Returns an empty list if no
    path exists.

    Parameters
    ----------
    start : (x, y) integer tile coordinates
    goal  : (x, y) integer tile coordinates
    terrain : 2-D numpy array of terrain type ints, shape (map_size, map_size)
    map_size : width/height of the square map
    """
    sx, sy = int(start[0]), int(start[1])
    gx, gy = int(goal[0]), int(goal[1])

    # Quick rejection
    if not _in_bounds(sx, sy, map_size) or not _in_bounds(gx, gy, map_size):
        return []
    if _terrain_cost(int(terrain[sy, sx])) == math.inf:
        return []
    if _terrain_cost(int(terrain[gy, gx])) == math.inf:
        return []
    if (sx, sy) == (gx, gy):
        return [(sx, sy)]

    # Open set: (f_score, counter, x, y)
    counter = 0
    open_set: list[tuple[float, int, int, int]] = []
    heapq.heappush(open_set, (_heuristic(sx, sy, gx, gy), counter, sx, sy))

    g_score: dict[tuple[int, int], float] = {(sx, sy): 0.0}
    came_from: dict[tuple[int, int], tuple[int, int]] = {}

    while open_set:
        _f, _c, cx, cy = heapq.heappop(open_set)

        if (cx, cy) == (gx, gy):
            # Reconstruct path
            path: list[tuple[int, int]] = [(gx, gy)]
            node = (gx, gy)
            while node in came_from:
                node = came_from[node]
                path.append(node)
            path.reverse()
            return path

        current_g = g_score.get((cx, cy), math.inf)
        if _f > current_g + _heuristic(cx, cy, gx, gy) + 1e-9:
            continue  # stale entry

        for dx, dy in _DIRS:
            nx, ny = cx + dx, cy + dy
            if not _in_bounds(nx, ny, map_size):
                continue
            cost = _terrain_cost(int(terrain[ny, nx]))
            if cost == math.inf:
                continue
            tentative_g = current_g + cost
            if tentative_g < g_score.get((nx, ny), math.inf):
                g_score[(nx, ny)] = tentative_g
                came_from[(nx, ny)] = (cx, cy)
                counter += 1
                f = tentative_g + _heuristic(nx, ny, gx, gy)
                heapq.heappush(open_set, (f, counter, nx, ny))

    return []  # no path found


# ── Dijkstra distance field ────────────────────────────────────────────────

def compute_distance_field(
    target: tuple[int, int],
    terrain: np.ndarray,
    map_size: int,
) -> np.ndarray:
    """Return a 2-D numpy array of shortest-path distances to *target*.

    Uses Dijkstra (uniform-cost search) so each cell stores the true
    terrain-weighted cost to reach *target*.  Creatures can follow the
    gradient (move to the neighbour with the lowest value) to navigate
    home without per-creature A*.

    Unreachable cells are set to ``numpy.inf``.
    """
    tx, ty = int(target[0]), int(target[1])
    dist = np.full((map_size, map_size), np.inf, dtype=np.float64)

    if not _in_bounds(tx, ty, map_size):
        return dist

    dist[ty, tx] = 0.0
    # Heap: (distance, x, y)
    heap: list[tuple[float, int, int]] = [(0.0, tx, ty)]

    while heap:
        d, cx, cy = heapq.heappop(heap)
        if d > dist[cy, cx]:
            continue
        for dx, dy in _DIRS:
            nx, ny = cx + dx, cy + dy
            if not _in_bounds(nx, ny, map_size):
                continue
            cost = _terrain_cost(int(terrain[ny, nx]))
            if cost == math.inf:
                continue
            nd = d + cost
            if nd < dist[ny, nx]:
                dist[ny, nx] = nd
                heapq.heappush(heap, (nd, nx, ny))

    return dist
