import * as THREE from 'three';

const APPLE_COLORS = {
  normal: 0xff3333,   // red
  golden: 0xffd700,   // gold
  rotten: 0x6b7b3a,   // brown-green
};

/**
 * Renders apples on the map as small spheres.
 */
export class FoodRenderer {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map(); // apple_id -> mesh
    this.geometry = new THREE.IcosahedronGeometry(0.2, 1);
    this.materials = {
      normal: new THREE.MeshLambertMaterial({ color: APPLE_COLORS.normal }),
      golden: new THREE.MeshLambertMaterial({ color: APPLE_COLORS.golden, emissive: 0x996600, emissiveIntensity: 0.3 }),
      rotten: new THREE.MeshLambertMaterial({ color: APPLE_COLORS.rotten }),
    };
    this._time = 0;
  }

  /**
   * Update apple positions from server data.
   * @param {Array<{id, x, y, type}>} apples
   */
  updateApples(apples) {
    const currentIds = new Set();

    for (const apple of apples) {
      currentIds.add(apple.id);

      if (!this.meshes.has(apple.id)) {
        // Create new apple mesh
        const typeName = typeof apple.type === 'number'
          ? ['normal', 'golden', 'rotten'][apple.type] || 'normal'
          : apple.type;
        const mat = this.materials[typeName] || this.materials.normal;
        const mesh = new THREE.Mesh(this.geometry, mat);
        mesh.position.set(apple.x, 0.25, apple.y);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.meshes.set(apple.id, mesh);
      }
    }

    // Remove apples no longer present
    for (const [id, mesh] of this.meshes) {
      if (!currentIds.has(id)) {
        this.scene.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  /** Animate apple bobbing. */
  update(time) {
    this._time = time;
    for (const [id, mesh] of this.meshes) {
      mesh.position.y = 0.25 + Math.sin(time * 3 + parseInt(id, 36) * 0.5) * 0.08;
    }
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
    }
    this.meshes.clear();
    this.geometry.dispose();
    Object.values(this.materials).forEach(m => m.dispose());
  }
}
