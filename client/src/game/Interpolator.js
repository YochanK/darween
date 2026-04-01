/**
 * Smooth position interpolation for networked creatures.
 *
 * Stores the last two server positions for each creature and linearly
 * interpolates between them with a configurable buffer delay (default 100ms)
 * to absorb network jitter.
 */
export class Interpolator {
  /**
   * @param {number} bufferMs - Interpolation buffer in milliseconds (default 100)
   */
  constructor(bufferMs = 100) {
    this.bufferMs = bufferMs;

    /**
     * Map of creatureId -> { prev, curr }
     * Each entry holds two snapshots: { x, y, time }
     */
    this._states = new Map();
  }

  /**
   * Feed a new authoritative server position for a creature.
   * @param {string} creatureId
   * @param {number} serverX
   * @param {number} serverY
   * @param {number} timestamp - Server or local timestamp in ms
   */
  update(creatureId, serverX, serverY, timestamp) {
    const entry = this._states.get(creatureId);

    if (!entry) {
      // First position - set both prev and curr to the same snapshot
      const snapshot = { x: serverX, y: serverY, time: timestamp };
      this._states.set(creatureId, { prev: snapshot, curr: snapshot });
    } else {
      // Shift current to previous, store new current
      entry.prev = entry.curr;
      entry.curr = { x: serverX, y: serverY, time: timestamp };
    }
  }

  /**
   * Get an interpolated position for a creature at the given render time.
   * The render time is offset by the interpolation buffer to allow smooth
   * blending between the last two known positions.
   *
   * @param {string} creatureId
   * @param {number} renderTime - Current time in ms (e.g. performance.now())
   * @returns {{ x: number, y: number } | null} Interpolated position, or null if unknown
   */
  getPosition(creatureId, renderTime) {
    const entry = this._states.get(creatureId);
    if (!entry) return null;

    const { prev, curr } = entry;

    // Render time with buffer offset
    const bufferedTime = renderTime - this.bufferMs;

    // Duration between the two snapshots
    const duration = curr.time - prev.time;

    if (duration <= 0) {
      // No movement delta - return current position as-is
      return { x: curr.x, y: curr.y };
    }

    // How far along between prev and curr should we render?
    const t = Math.max(0, Math.min(1, (bufferedTime - prev.time) / duration));

    return {
      x: prev.x + (curr.x - prev.x) * t,
      y: prev.y + (curr.y - prev.y) * t,
    };
  }

  /**
   * Remove interpolation state for a creature.
   * @param {string} creatureId
   */
  remove(creatureId) {
    this._states.delete(creatureId);
  }

  /** Remove all tracked creatures. */
  clear() {
    this._states.clear();
  }
}
