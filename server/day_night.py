"""Day/night cycle timer and phase events."""

from __future__ import annotations

from enum import Enum

from config import DAY_DURATION, NIGHT_DURATION, NIGHT_WARNING_TIME


class Phase(str, Enum):
    DAY = "DAY"
    NIGHT = "NIGHT"


class Event(str, Enum):
    DAY_START = "DAY_START"
    NIGHT_WARNING = "NIGHT_WARNING"
    NIGHT_START = "NIGHT_START"
    NIGHT_END = "NIGHT_END"


class DayNightCycle:
    def __init__(self):
        self.phase = Phase.DAY
        self.time_in_phase = 0.0
        self.turn_number = 1
        self._night_warned = False

    def update(self, dt: float) -> list[Event]:
        """Advance the clock and return any triggered events."""
        events = []
        self.time_in_phase += dt

        if self.phase == Phase.DAY:
            # Night warning
            if not self._night_warned and self.time_in_phase >= DAY_DURATION - NIGHT_WARNING_TIME:
                self._night_warned = True
                events.append(Event.NIGHT_WARNING)

            # Transition to night
            if self.time_in_phase >= DAY_DURATION:
                self.phase = Phase.NIGHT
                self.time_in_phase = 0.0
                self._night_warned = False
                events.append(Event.NIGHT_START)

        elif self.phase == Phase.NIGHT:
            # Transition to day
            if self.time_in_phase >= NIGHT_DURATION:
                self.phase = Phase.DAY
                self.time_in_phase = 0.0
                self.turn_number += 1
                events.append(Event.NIGHT_END)
                events.append(Event.DAY_START)

        return events

    @property
    def time_remaining(self) -> float:
        if self.phase == Phase.DAY:
            return max(0, DAY_DURATION - self.time_in_phase)
        return max(0, NIGHT_DURATION - self.time_in_phase)
