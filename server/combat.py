"""Rock/paper/scissors combat resolution."""

from __future__ import annotations

import random
import time
from dataclasses import dataclass

from config import COMBAT_COOLDOWN, COMBAT_DAMAGE


@dataclass
class CombatResult:
    attacker_id: str
    defender_id: str
    winner: str  # "attacker", "defender", or "draw"
    damage: int
    killed: bool = False


def resolve_combat(attacker, defender) -> CombatResult | None:
    """
    Resolve combat between two creatures using RPS.
    Returns CombatResult or None if combat can't happen (cooldown).
    """
    now = time.time()

    # Check cooldowns
    if attacker.combat_cooldown > now or defender.combat_cooldown > now:
        return None

    # Set cooldowns
    attacker.combat_cooldown = now + COMBAT_COOLDOWN
    defender.combat_cooldown = now + COMBAT_COOLDOWN

    # Rock Paper Scissors
    a_choice = random.randint(0, 2)
    d_choice = random.randint(0, 2)

    if a_choice == d_choice:
        return CombatResult(
            attacker_id=attacker.id,
            defender_id=defender.id,
            winner="draw",
            damage=0,
        )

    attacker_wins = (a_choice - d_choice) % 3 == 1

    if attacker_wins:
        damage = max(1, COMBAT_DAMAGE - defender.stats.get("defense", 5) // 3)
        defender.hp -= damage
        killed = defender.hp <= 0

        # Predator instinct gene
        if attacker.gene == "predator_instinct" and killed:
            attacker.food += 1

        return CombatResult(
            attacker_id=attacker.id,
            defender_id=defender.id,
            winner="attacker",
            damage=damage,
            killed=killed,
        )
    else:
        damage = max(1, COMBAT_DAMAGE - attacker.stats.get("defense", 5) // 3)
        attacker.hp -= damage
        killed = attacker.hp <= 0

        # Predator instinct gene
        if defender.gene == "predator_instinct" and killed:
            defender.food += 1

        return CombatResult(
            attacker_id=attacker.id,
            defender_id=defender.id,
            winner="defender",
            damage=damage,
            killed=killed,
        )
