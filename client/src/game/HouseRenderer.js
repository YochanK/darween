import * as THREE from 'three';
import { getTeamColor } from './TeamColors.js';

/**
 * Renders team houses as colored cube+pyramid structures.
 */
export class HouseRenderer {
  constructor(scene) {
    this.scene = scene;
    this.houses = [];
  }

  /**
   * Build houses from team data.
   * @param {Object} houses - {team_id: [x, y]}
   * @param {Object} teams - {team_id: {color_index, ...}}
   */
  build(houses, teams) {
    // Clear existing
    for (const group of this.houses) {
      this.scene.remove(group);
    }
    this.houses = [];

    const baseGeo = new THREE.BoxGeometry(2, 1.5, 2);
    const roofGeo = new THREE.ConeGeometry(1.8, 1.2, 4);

    for (const [teamId, [hx, hy]] of Object.entries(houses)) {
      const colorIndex = teams[teamId]?.color_index ?? 0;
      const color = getTeamColor(colorIndex);

      const group = new THREE.Group();

      // Base
      const baseMat = new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.7) });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, 0.75, 0);
      base.castShadow = true;
      group.add(base);

      // Roof
      const roofMat = new THREE.MeshLambertMaterial({ color });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, 2.1, 0);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Door (small dark box)
      const doorGeo = new THREE.BoxGeometry(0.5, 0.8, 0.1);
      const doorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 0.4, 1.01);
      group.add(door);

      group.position.set(hx, 0, hy);
      this.scene.add(group);
      this.houses.push(group);
    }
  }

  dispose() {
    for (const group of this.houses) {
      this.scene.remove(group);
      group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this.houses = [];
  }
}
