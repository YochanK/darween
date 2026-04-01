"""Grid-based spatial partitioning for fast proximity queries."""

from __future__ import annotations

from collections import defaultdict


CELL_SIZE = 8  # 8x8 tiles per cell


class SpatialHash:
    """Spatial hash grid that maps entities to fixed-size cells."""

    __slots__ = ("_cells", "_entity_positions")

    def __init__(self) -> None:
        self._cells: dict[tuple[int, int], list[int]] = defaultdict(list)
        self._entity_positions: dict[int, tuple[float, float]] = {}

    # ── Mutation ─────────────────────────────────────────────────────────

    def clear(self) -> None:
        """Remove all entities from the grid."""
        self._cells.clear()
        self._entity_positions.clear()

    def insert(self, entity_id: int, x: float, y: float) -> None:
        """Add an entity at world position (x, y)."""
        cx = int(x) // CELL_SIZE
        cy = int(y) // CELL_SIZE
        self._cells[(cx, cy)].append(entity_id)
        self._entity_positions[entity_id] = (x, y)

    # ── Queries ──────────────────────────────────────────────────────────

    def query_cell(self, x: float, y: float) -> list[int]:
        """Return all entity ids in the same cell as (x, y)."""
        cx = int(x) // CELL_SIZE
        cy = int(y) // CELL_SIZE
        return list(self._cells.get((cx, cy), []))

    def query_radius(self, x: float, y: float, radius: float) -> list[int]:
        """Return all entity ids within *radius* tiles of (x, y).

        Checks every cell that the bounding square overlaps, then filters
        by exact Euclidean distance.
        """
        r2 = radius * radius
        min_cx = int(x - radius) // CELL_SIZE
        max_cx = int(x + radius) // CELL_SIZE
        min_cy = int(y - radius) // CELL_SIZE
        max_cy = int(y + radius) // CELL_SIZE

        result: list[int] = []
        for cx in range(min_cx, max_cx + 1):
            for cy in range(min_cy, max_cy + 1):
                for eid in self._cells.get((cx, cy), []):
                    ex, ey = self._entity_positions[eid]
                    dx = ex - x
                    dy = ey - y
                    if dx * dx + dy * dy <= r2:
                        result.append(eid)
        return result

    def get_position(self, entity_id: int) -> tuple[float, float] | None:
        """Return the stored position of an entity, or None."""
        return self._entity_positions.get(entity_id)
