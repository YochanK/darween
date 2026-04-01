import * as THREE from 'three';

/**
 * 20 team colors evenly distributed around the HSL color wheel.
 * hsl(i * 18, 70%, 50%) for i in 0..19
 */
export const TEAM_COLORS = Array.from({ length: 20 }, (_, i) => {
  const color = new THREE.Color();
  color.setHSL((i * 18) / 360, 0.7, 0.5);
  return color;
});

/**
 * Get a team color by index (wraps around if out of range).
 * @param {number} colorIndex
 * @returns {THREE.Color}
 */
export function getTeamColor(colorIndex) {
  const idx = ((colorIndex % TEAM_COLORS.length) + TEAM_COLORS.length) % TEAM_COLORS.length;
  return TEAM_COLORS[idx];
}

/**
 * Clone a base material and apply team-color tinting.
 * MeshStandardMaterial.color multiplies with the base color texture,
 * so lerping from white toward the team color tints the model naturally.
 *
 * @param {THREE.Material} baseMaterial - Material to clone
 * @param {THREE.Color} teamColor - THREE.Color to tint with
 * @returns {THREE.Material} Cloned material with team color tinting
 */
export function createTeamMaterial(baseMaterial, teamColor) {
  const mat = baseMaterial.clone();
  const tint = new THREE.Color(1, 1, 1);
  tint.lerp(teamColor, 0.75);
  mat.color.copy(tint);
  return mat;
}
