import * as THREE from 'three';
import { TERRAIN_COLORS, TERRAIN_HEIGHTS, TILE_SIZE } from '../utils/constants.js';

/**
 * Renders the terrain map as individual tile meshes grouped by terrain type.
 * Uses merged BufferGeometry per terrain type for minimal draw calls.
 */
export class MapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
  }

  /**
   * Build the terrain mesh from server map data.
   * @param {number[]} mapData - Flat array of terrain type integers
   * @param {number} mapSize - Width/height of the square map
   */
  build(mapData, mapSize) {
    // Clear previous
    while (this.mapGroup.children.length > 0) {
      const child = this.mapGroup.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      this.mapGroup.remove(child);
    }

    // Group tiles by terrain type
    const tilesByType = {};
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const type = mapData[y * mapSize + x];
        if (!tilesByType[type]) tilesByType[type] = [];
        tilesByType[type].push({ x, y });
      }
    }

    // Create merged geometry for each terrain type
    const tileGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    tileGeo.rotateX(-Math.PI / 2); // lay flat on XZ plane

    for (const [typeStr, tiles] of Object.entries(tilesByType)) {
      const type = parseInt(typeStr);
      const matrices = [];

      for (const { x, y } of tiles) {
        const height = TERRAIN_HEIGHTS[type] || 0;
        const matrix = new THREE.Matrix4();
        matrix.setPosition(x * TILE_SIZE, height, y * TILE_SIZE);
        matrices.push(matrix);
      }

      // Use InstancedMesh for efficiency
      const material = new THREE.MeshLambertMaterial({
        color: TERRAIN_COLORS[type],
      });

      const instancedMesh = new THREE.InstancedMesh(tileGeo, material, tiles.length);
      for (let i = 0; i < matrices.length; i++) {
        instancedMesh.setMatrixAt(i, matrices[i]);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.receiveShadow = true;

      this.mapGroup.add(instancedMesh);
    }

    // Add a subtle grid outline
    this._addGridBorder(mapSize);

    // Water animation - slight wave effect
    this._animateWater(tilesByType[2] || []);
  }

  _addGridBorder(mapSize) {
    const size = mapSize * TILE_SIZE;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, 0),
      new THREE.Vector3(size, 0.01, 0),
      new THREE.Vector3(size, 0.01, size),
      new THREE.Vector3(0, 0.01, size),
      new THREE.Vector3(0, 0.01, 0),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0x333333, opacity: 0.3, transparent: true });
    this.mapGroup.add(new THREE.Line(geo, mat));
  }

  _animateWater(waterTiles) {
    // Store for animation updates
    this.waterTiles = waterTiles;
  }

  /** Call each frame for water animation. */
  update(time) {
    // Water shimmer could be added here via uniform updates
  }

  dispose() {
    while (this.mapGroup.children.length > 0) {
      const child = this.mapGroup.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      this.mapGroup.remove(child);
    }
  }
}
