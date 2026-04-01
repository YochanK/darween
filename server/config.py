"""Game constants for Darween. Many scale with player count."""

import math

# Room
MAX_PLAYERS = 20
ROOM_CODE_LENGTH = 6

# Timing
DAY_DURATION = 120  # seconds
NIGHT_DURATION = 20  # seconds
TICK_RATE = 10  # server ticks per second
TICK_INTERVAL = 1.0 / TICK_RATE

# Map
MAP_BASE_SIZE = 64  # tiles; actual = MAP_BASE_SIZE + num_players * 16
TERRAIN_GRASS = 0
TERRAIN_SAND = 1
TERRAIN_WATER = 2
TERRAIN_ROCK = 3
TERRAIN_NAMES = {0: "grass", 1: "sand", 2: "water", 3: "rock"}
TERRAIN_SPEEDS = {
    TERRAIN_GRASS: 1.0,
    TERRAIN_SAND: 0.5,
    TERRAIN_WATER: 0.25,
    TERRAIN_ROCK: 0.0,  # impassable
}

# Creatures
MAX_HP = 10
STARTING_CREATURES = 5
WIN_POPULATION = 500
FOOD_PER_DAY = 5  # minimum food to survive the night
FOOD_TO_REPRODUCE = 6  # 5 needed + 1 extra
COMBAT_DAMAGE = 2
COMBAT_COOLDOWN = 2.0  # seconds between fights per creature
BASE_CREATURE_SPEED = 3.0  # tiles per second (at speed stat 5)

# Food / Apples
APPLE_SPAWN_INTERVAL = 3.0  # base seconds between spawns
MAX_APPLES_PER_PLAYER = 20
GOLDEN_APPLE_CHANCE = 0.05
ROTTEN_APPLE_CHANCE = 0.08
APPLE_PICKUP_RADIUS = 0.5  # tiles

# Genes
SUGAR_RUSH_DURATION = 3.0  # seconds
SUGAR_RUSH_SPEED_MULT = 1.5
ROTTEN_APPLE_DAMAGE = 5

# Reproduction
MUTATION_CHANCE = 0.2  # per stat
MUTATION_RANGE = 1  # +/- this amount
MIN_STAT = 1
MAX_STAT = 10

# Network
HEARTBEAT_INTERVAL = 5.0  # seconds
FULL_SYNC_INTERVAL = 2.0  # seconds
NIGHT_WARNING_TIME = 10.0  # seconds before night


def map_size_for_players(num_players: int) -> int:
    """Calculate map size based on player count."""
    return MAP_BASE_SIZE + num_players * 16


def apple_spawn_interval(num_players: int) -> float:
    """Faster apple spawns with more players."""
    return APPLE_SPAWN_INTERVAL / math.sqrt(max(1, num_players))


def max_apples(num_players: int) -> int:
    """Max apples on map scales with players."""
    return num_players * MAX_APPLES_PER_PLAYER


def pathfinding_budget(total_creatures: int) -> int:
    """Max new A* computations per tick."""
    return max(50, total_creatures // 20)
