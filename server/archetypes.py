"""5 creature archetypes with stat definitions and 3 gene types."""

from __future__ import annotations

ARCHETYPES = {
    "fox": {
        "name": "Fox",
        "role": "Scout",
        "model": "animal-fox",
        "stats": {
            "life": 10,
            "speed": 8,
            "attack": 4,
            "defense": 3,
            "bravery": 4,
            "visibility": 9,
            "endurance": 5,
            "sociability": 4,
            "fertility": 5,
        },
    },
    "lion": {
        "name": "Lion",
        "role": "Warrior",
        "model": "animal-lion",
        "stats": {
            "life": 10,
            "speed": 5,
            "attack": 8,
            "defense": 5,
            "bravery": 9,
            "visibility": 5,
            "endurance": 6,
            "sociability": 4,
            "fertility": 3,
        },
    },
    "bunny": {
        "name": "Bunny",
        "role": "Breeder",
        "model": "animal-bunny",
        "stats": {
            "life": 10,
            "speed": 7,
            "attack": 2,
            "defense": 3,
            "bravery": 2,
            "visibility": 5,
            "endurance": 4,
            "sociability": 5,
            "fertility": 9,
        },
    },
    "elephant": {
        "name": "Elephant",
        "role": "Tank",
        "model": "animal-elephant",
        "stats": {
            "life": 10,
            "speed": 3,
            "attack": 5,
            "defense": 9,
            "bravery": 6,
            "visibility": 4,
            "endurance": 9,
            "sociability": 5,
            "fertility": 3,
        },
    },
    "monkey": {
        "name": "Monkey",
        "role": "Social",
        "model": "animal-monkey",
        "stats": {
            "life": 10,
            "speed": 6,
            "attack": 5,
            "defense": 5,
            "bravery": 5,
            "visibility": 6,
            "endurance": 6,
            "sociability": 9,
            "fertility": 6,
        },
    },
}

GENES = {
    "sugar_rush": {
        "name": "Sugar Rush",
        "description": "Eating an apple gives +50% speed for 3 seconds",
        "icon": "⚡",
    },
    "predator_instinct": {
        "name": "Predator Instinct",
        "description": "Killing an enemy grants +1 food",
        "icon": "🦷",
    },
    "aquatic_adaptation": {
        "name": "Aquatic Adaptation",
        "description": "Move at normal speed in water",
        "icon": "🌊",
    },
}

VALID_ARCHETYPES = set(ARCHETYPES.keys())
VALID_GENES = set(GENES.keys())
