"""End-of-night reproduction logic."""

from __future__ import annotations

import random
import uuid

from config import (
    FOOD_PER_DAY,
    FOOD_TO_REPRODUCE,
    MAX_HP,
    MAX_STAT,
    MIN_STAT,
    MUTATION_CHANCE,
    MUTATION_RANGE,
)


def process_reproduction(creatures_by_team: dict[str, list], houses: dict[str, tuple]) -> dict[str, list]:
    """
    Process end-of-night for all teams.
    Returns dict of team_id -> list of new creature dicts to create.
    Also applies starvation damage to underfed creatures.
    """
    new_creatures_by_team = {}

    for team_id, creatures in creatures_by_team.items():
        house = houses.get(team_id)
        if not house:
            continue

        # Starvation: creatures with food < 5 lose 1 HP
        for c in creatures:
            if c.food < FOOD_PER_DAY:
                c.hp -= 1

        # Eligible to reproduce: HP == MAX_HP and food >= FOOD_TO_REPRODUCE
        eligible = [c for c in creatures if c.hp == MAX_HP and c.food >= FOOD_TO_REPRODUCE]
        random.shuffle(eligible)
        pairs = len(eligible) // 2

        new_creatures = []
        for i in range(pairs):
            parent_a = eligible[i * 2]
            parent_b = eligible[i * 2 + 1]

            avg_fertility = (parent_a.stats.get("fertility", 5) + parent_b.stats.get("fertility", 5)) / 2.0
            fertility_mult = avg_fertility / 10.0
            base_offspring = random.choice([1, 2, 3])
            count = max(1, round(base_offspring * fertility_mult))

            for _ in range(count):
                child_stats = _merge_stats(parent_a.stats, parent_b.stats)
                new_creatures.append({
                    "id": str(uuid.uuid4())[:8],
                    "team_id": team_id,
                    "x": float(house[0]) + random.uniform(-1, 1),
                    "y": float(house[1]) + random.uniform(-1, 1),
                    "stats": child_stats,
                    "gene": parent_a.gene,  # inherit team gene
                })

        # Reset all food
        for c in creatures:
            c.food = 0

        new_creatures_by_team[team_id] = new_creatures

    return new_creatures_by_team


def _merge_stats(stats_a: dict, stats_b: dict) -> dict:
    """Average parent stats with mutation chance."""
    merged = {}
    all_keys = set(stats_a.keys()) | set(stats_b.keys())
    for key in all_keys:
        avg = (stats_a.get(key, 5) + stats_b.get(key, 5)) / 2.0
        val = round(avg)
        # Mutation
        if random.random() < MUTATION_CHANCE:
            val += random.choice([-MUTATION_RANGE, MUTATION_RANGE])
            val = max(MIN_STAT, min(MAX_STAT, val))
        merged[key] = val
    return merged
