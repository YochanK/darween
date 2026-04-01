// Terrain type codes (must match server/config.py)
export const TERRAIN_GRASS = 0;
export const TERRAIN_SAND = 1;
export const TERRAIN_WATER = 2;
export const TERRAIN_ROCK = 3;

// Terrain colors for rendering
export const TERRAIN_COLORS = {
  [TERRAIN_GRASS]: 0x4caf50,  // green
  [TERRAIN_SAND]: 0xe8d68c,   // beige
  [TERRAIN_WATER]: 0x42a5f5,  // blue
  [TERRAIN_ROCK]: 0x78909c,   // gray
};

// Terrain height offsets for isometric depth
export const TERRAIN_HEIGHTS = {
  [TERRAIN_GRASS]: 0,
  [TERRAIN_SAND]: -0.05,
  [TERRAIN_WATER]: -0.15,
  [TERRAIN_ROCK]: 0.2,
};

export const TILE_SIZE = 1.0;
