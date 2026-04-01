"""Main async game loop running at a fixed tick rate."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable, Coroutine

from config import (
    TICK_INTERVAL,
    DAY_DURATION,
    NIGHT_DURATION,
    ROTTEN_APPLE_DAMAGE,
    MAX_HP,
    STARTING_CREATURES,
)
from creature import AIState, Apple, Creature, update_creature
from food import FoodManager, AppleType
from game_state import GameState
from reproduction import process_reproduction

logger = logging.getLogger(__name__)

BroadcastFn = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class GameLoop:
    """Runs the authoritative simulation and broadcasts state."""

    def __init__(self, state: GameState, broadcast: BroadcastFn) -> None:
        self.state = state
        self.broadcast = broadcast
        self._running = False
        self._task: asyncio.Task[None] | None = None
        # Initialize food manager
        num_players = len(state.teams)
        self.food_manager = FoodManager(state.terrain, state.map_size, num_players)

    # ── Lifecycle ───────────────────────────────────────────────────────

    def start(self) -> None:
        """Schedule the game loop on the current event loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.get_event_loop().create_task(self._loop())

    def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()

    # ── Main loop ───────────────────────────────────────────────────────

    async def _loop(self) -> None:
        logger.info("Game loop started (tick interval %.3fs)", TICK_INTERVAL)
        prev_time = time.monotonic()

        while self._running:
            now = time.monotonic()
            dt = now - prev_time
            prev_time = now

            try:
                await self._tick(dt)
            except Exception:
                logger.exception("Error in game tick %d", self.state.tick)

            # Sleep to maintain target tick rate
            elapsed = time.monotonic() - now
            sleep_time = TICK_INTERVAL - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    # ── Single tick ─────────────────────────────────────────────────────

    async def _tick(self, dt: float) -> None:
        gs = self.state
        gs.tick += 1

        # 1. Advance phase timer
        gs.time_in_phase += dt

        # 2. Phase transitions
        phase_events = self._check_phase_transitions()

        # 3. Rebuild spatial hashes for this tick
        gs.rebuild_spatial_hashes()

        # 4. Update all creatures
        all_events: list[dict[str, Any]] = []
        for creature in list(gs.creatures.values()):
            if creature.hp <= 0:
                continue
            df = gs.distance_fields.get(creature.team_id)
            events = update_creature(
                creature=creature,
                dt=dt,
                terrain=gs.terrain,
                map_size=gs.map_size,
                apple_spatial_hash=gs.apple_spatial_hash,
                creature_spatial_hash=gs.spatial_hash,
                apples=gs.apples,
                creatures=gs.creatures,
                distance_field=df,
                phase=gs.phase,
                elapsed_time=gs.time_in_phase,
            )
            all_events.extend(events)

        # Process apple pickups
        for ev in all_events:
            if ev["type"] == "apple_pickup":
                apple = gs.apples.get(ev["apple_id"])
                if apple is not None:
                    # Handle rotten apple damage
                    if apple.type == "rotten":
                        c = gs.creatures.get(ev["creature_id"])
                        if c is not None:
                            c.hp = max(0, c.hp - ROTTEN_APPLE_DAMAGE)
                    gs.remove_apple(ev["apple_id"])

        # 5. Combat proximity check (rebuild creature spatial hash first)
        gs.spatial_hash.clear()
        for c in gs.creatures.values():
            if c.hp > 0:
                gs.spatial_hash.insert(c.id, c.x, c.y)

        combat_events = self._check_combat()
        all_events.extend(combat_events)

        # 6. Spawn apples (placeholder)
        self._spawn_apples()

        # 7. Win condition
        winner = gs.check_win_condition()
        if winner is not None:
            await self._handle_game_over(winner)
            return

        # 8. Broadcast delta state
        snapshot = gs.get_state_snapshot()
        snapshot["events"] = all_events + phase_events
        await self.broadcast(snapshot)

    # ── Phase transitions ───────────────────────────────────────────────

    def _check_phase_transitions(self) -> list[dict[str, Any]]:
        gs = self.state
        events: list[dict[str, Any]] = []

        if gs.phase == "DAY" and gs.time_in_phase >= DAY_DURATION:
            # DAY -> NIGHT
            gs.phase = "NIGHT"
            gs.time_in_phase = 0.0
            self._on_night_start()
            events.append({
                "type": "phase_change",
                "phase": "NIGHT",
                "turn_number": gs.turn_number,
            })

        elif gs.phase == "NIGHT" and gs.time_in_phase >= NIGHT_DURATION:
            # NIGHT -> DAY
            self._on_night_end()
            gs.phase = "DAY"
            gs.time_in_phase = 0.0
            gs.turn_number += 1
            self._on_day_start()
            events.append({
                "type": "phase_change",
                "phase": "DAY",
                "turn_number": gs.turn_number,
            })

        return events

    def _on_day_start(self) -> None:
        """Reset creatures for a new day."""
        gs = self.state
        for c in gs.creatures.values():
            if c.hp > 0:
                c.food = 0
                c.ai_state = AIState.SEEKING_FOOD
                c.path = []
                c.animation = "idle"

    def _on_night_start(self) -> None:
        """Transition all creatures to return-home behaviour."""
        gs = self.state
        for c in gs.creatures.values():
            if c.hp > 0:
                c.ai_state = AIState.RETURNING_HOME
                c.path = []
                c.animation = "walk"

    def _on_night_end(self) -> None:
        """Handle end-of-night: starvation check + reproduction (placeholder)."""
        gs = self.state
        dead_ids: list[int] = []

        for c in gs.creatures.values():
            if c.hp <= 0:
                continue
            # Starvation: creatures that didn't gather enough food lose HP
            if c.food < 5:
                deficit = 5 - c.food
                c.hp = max(0, c.hp - deficit)
                if c.hp <= 0:
                    dead_ids.append(c.id)
                    team = gs.teams.get(c.team_id)
                    if team:
                        team.stats["deaths"] += 1

        # Reproduction placeholder -- will be implemented in reproduction.py
        self._reproduce()

    def _reproduce(self) -> None:
        """Run reproduction for all teams."""
        gs = self.state

        # Group creatures by team
        creatures_by_team: dict[str, list] = {}
        for c in gs.creatures.values():
            if c.hp > 0:
                if c.team_id not in creatures_by_team:
                    creatures_by_team[c.team_id] = []
                creatures_by_team[c.team_id].append(c)

        new_by_team = process_reproduction(creatures_by_team, gs.houses)

        # Create new creatures from reproduction results
        import itertools
        for team_id, new_list in new_by_team.items():
            team = gs.teams.get(team_id)
            if team:
                team.stats["births"] += len(new_list)
            for child_data in new_list:
                from game_state import _next_id
                cid = _next_id()
                child = Creature(
                    id=cid,
                    team_id=team_id,
                    x=child_data["x"],
                    y=child_data["y"],
                    stats=child_data["stats"],
                    hp=MAX_HP,
                    gene=child_data["gene"],
                    ai_state=AIState.AT_HOME,
                )
                gs.creatures[cid] = child

    # ── Combat ──────────────────────────────────────────────────────────

    def _check_combat(self) -> list[dict[str, Any]]:
        """Check proximity between enemy creatures and resolve fights."""
        gs = self.state
        events: list[dict[str, Any]] = []
        fought: set[tuple[int, int]] = set()

        for c in list(gs.creatures.values()):
            if c.hp <= 0 or c.combat_cooldown > 0:
                continue

            nearby = gs.spatial_hash.query_radius(c.x, c.y, 1.0)
            for eid in nearby:
                if eid == c.id:
                    continue
                pair = (min(c.id, eid), max(c.id, eid))
                if pair in fought:
                    continue
                other = gs.creatures.get(eid)
                if other is None or other.hp <= 0 or other.team_id == c.team_id:
                    continue
                fought.add(pair)
                combat_evts = gs.resolve_combat(c, other)
                events.extend(combat_evts)

        return events

    # ── Apple spawning ────────────────────────────────────────────────

    def _spawn_apples(self) -> None:
        """Spawn apples using the FoodManager."""
        gs = self.state
        dt = TICK_INTERVAL
        self.food_manager.update(dt)

        # Sync food manager apples to game state
        for apple in self.food_manager.added_this_tick:
            type_map = {AppleType.NORMAL: "normal", AppleType.GOLDEN: "golden", AppleType.ROTTEN: "rotten"}
            gs.add_apple(float(apple.x), float(apple.y), type_map.get(apple.apple_type, "normal"))

    # ── Game over ───────────────────────────────────────────────────────

    async def _handle_game_over(self, winner_team_id: str) -> None:
        self._running = False
        gs = self.state

        final_stats: dict[str, Any] = {}
        for tid, ts in gs.teams.items():
            population = sum(
                1 for c in gs.creatures.values()
                if c.team_id == tid and c.hp > 0
            )
            final_stats[tid] = {
                "username": ts.username,
                "archetype": ts.archetype,
                "population": population,
                **ts.stats,
            }

        from protocol import game_over
        await self.broadcast(game_over(winner_team_id, final_stats))
        logger.info("Game over! Winner: %s", winner_team_id)
