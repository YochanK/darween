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
 * Clone a base material and apply team-color tinting via shader injection.
 * The tint blends 35% of the team color into the diffuse color.
 *
 * @param {THREE.Material} baseMaterial - Material to clone
 * @param {THREE.Color} teamColor - THREE.Color to tint with
 * @returns {THREE.Material} Cloned material with team color tinting
 */
export function createTeamMaterial(baseMaterial, teamColor) {
  const mat = baseMaterial.clone();

  // Store team color as a uniform-friendly value
  const tintColor = teamColor.clone();

  mat.onBeforeCompile = (shader) => {
    // Add team color uniform
    shader.uniforms.uTeamColor = { value: tintColor };

    // Inject uniform declaration into fragment shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec3 uTeamColor;`
    );

    // Inject tinting after the diffuse color is computed
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTeamColor, 0.35);`
    );
  };

  // Ensure Three.js recompiles the shader for this material
  mat.customProgramCacheKey = () => `team_${tintColor.getHexString()}`;

  return mat;
}
