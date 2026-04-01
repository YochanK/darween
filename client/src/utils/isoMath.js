import { TILE_SIZE } from './constants.js';

/**
 * Convert tile coordinates to Three.js world position.
 * In our isometric setup, the map lies on the XZ plane.
 */
export function tileToWorld(tileX, tileY) {
  return {
    x: tileX * TILE_SIZE,
    y: 0,
    z: tileY * TILE_SIZE,
  };
}

/**
 * Convert world position back to tile coordinates.
 */
export function worldToTile(worldX, worldZ) {
  return {
    tileX: Math.floor(worldX / TILE_SIZE),
    tileY: Math.floor(worldZ / TILE_SIZE),
  };
}
