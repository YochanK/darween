import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TERRAIN_GRASS, TERRAIN_SAND, TERRAIN_WATER, TERRAIN_ROCK, TILE_SIZE } from '../utils/constants.js';

const TREE_MODELS = [
  '/assets/models/landscape/tree.glb',
  '/assets/models/landscape/tree-crooked.glb',
  '/assets/models/landscape/tree-high.glb',
  '/assets/models/landscape/tree-high-crooked.glb',
  '/assets/models/landscape/tree-high-round.glb',
];

const ROCK_MODELS = [
  '/assets/models/landscape/rock-large.glb',
  '/assets/models/landscape/rock-small.glb',
  '/assets/models/landscape/rock-wide.glb',
];

/**
 * Enhanced terrain renderer with procedural trees, 3D rocks, animated water,
 * and grass color variation for a lush cartoon landscape.
 */
export class MapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    // Decoration groups
    this.trees = [];
    this.rocks = [];
    this.waterMeshes = [];
    this._mapData = null;
    this._mapSize = 0;
    this._loader = new GLTFLoader();
    this._treeVariants = null; // cached per-mesh data per model variant
    this._rockVariants = null;
  }

  async build(mapData, mapSize) {
    this._mapData = mapData;
    this._mapSize = mapSize;

    // Clear previous
    this._clearGroup(this.mapGroup);
    this.trees = [];
    this.rocks = [];
    this.waterMeshes = [];

    // Load Kenney models on first call
    if (!this._treeVariants) await this._loadModels();

    // 1. Build base terrain tiles with color variation
    this._buildTerrain(mapData, mapSize);

    // 2. Add water plane with transparency
    this._buildWater(mapData, mapSize);

    // 3. Scatter trees on grass tiles
    this._buildTrees(mapData, mapSize);

    // 4. Place rocks on rock tiles
    this._buildRocks(mapData, mapSize);

    // 5. Add grass tufts on grass tiles
    this._buildGrassTufts(mapData, mapSize);

    // 6. Add sand details (small pebbles, dry grass)
    this._buildSandDetails(mapData, mapSize);

    // 7. Add flowers for color
    this._buildFlowers(mapData, mapSize);
  }

  // ── Base terrain ────────────────────────────────────────────────────

  _buildTerrain(mapData, mapSize) {
    const tileGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    tileGeo.rotateX(-Math.PI / 2);

    // Grass with color variation
    const grassTiles = [];
    const sandTiles = [];
    const rockTiles = [];

    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const type = mapData[y * mapSize + x];
        if (type === TERRAIN_GRASS) grassTiles.push({ x, y });
        else if (type === TERRAIN_SAND) sandTiles.push({ x, y });
        else if (type === TERRAIN_ROCK) rockTiles.push({ x, y });
      }
    }

    // Grass - varied greens
    if (grassTiles.length > 0) {
      const grassMesh = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0x5cb85c }), grassTiles.length);
      const color = new THREE.Color();
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < grassTiles.length; i++) {
        const { x, y } = grassTiles[i];
        matrix.setPosition(x * TILE_SIZE, 0, y * TILE_SIZE);
        grassMesh.setMatrixAt(i, matrix);
        // Vary green per tile using a hash
        const h = this._hash(x, y);
        color.setHSL(0.3 + h * 0.05, 0.5 + h * 0.2, 0.32 + h * 0.08);
        grassMesh.setColorAt(i, color);
      }
      grassMesh.instanceMatrix.needsUpdate = true;
      grassMesh.instanceColor.needsUpdate = true;
      grassMesh.receiveShadow = true;
      this.mapGroup.add(grassMesh);
    }

    // Sand - warm variation
    if (sandTiles.length > 0) {
      const sandMesh = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xe8d68c }), sandTiles.length);
      const color = new THREE.Color();
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < sandTiles.length; i++) {
        const { x, y } = sandTiles[i];
        matrix.setPosition(x * TILE_SIZE, -0.03, y * TILE_SIZE);
        sandMesh.setMatrixAt(i, matrix);
        const h = this._hash(x, y);
        color.setHSL(0.1 + h * 0.02, 0.4 + h * 0.15, 0.6 + h * 0.1);
        sandMesh.setColorAt(i, color);
      }
      sandMesh.instanceMatrix.needsUpdate = true;
      sandMesh.instanceColor.needsUpdate = true;
      sandMesh.receiveShadow = true;
      this.mapGroup.add(sandMesh);
    }

    // Rock base tiles — rounded discs, warm gravel tone, flush with ground
    if (rockTiles.length > 0) {
      const rockDiscGeo = new THREE.CircleGeometry(TILE_SIZE * 0.72, 14);
      rockDiscGeo.rotateX(-Math.PI / 2);
      const rockMesh = new THREE.InstancedMesh(rockDiscGeo, new THREE.MeshLambertMaterial({ color: 0x8a8578 }), rockTiles.length);
      const color = new THREE.Color();
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < rockTiles.length; i++) {
        const { x, y } = rockTiles[i];
        matrix.setPosition(x * TILE_SIZE, 0.01, y * TILE_SIZE);
        rockMesh.setMatrixAt(i, matrix);
        const h = this._hash(x, y);
        color.setHSL(0.07 + h * 0.04, 0.08 + h * 0.06, 0.42 + h * 0.10);
        rockMesh.setColorAt(i, color);
      }
      rockMesh.instanceMatrix.needsUpdate = true;
      rockMesh.instanceColor.needsUpdate = true;
      rockMesh.receiveShadow = true;
      this.mapGroup.add(rockMesh);

      // Scatter gravel fringe at rock → non-rock borders
      const NDX = [0, 1, 0, -1];
      const NDZ = [1, 0, -1, 0];
      const gravel = [];
      for (const { x, y } of rockTiles) {
        for (let d = 0; d < 4; d++) {
          const nx = x + NDX[d], ny = y + NDZ[d];
          if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;
          if (mapData[ny * mapSize + nx] === TERRAIN_ROCK) continue;
          const count = 3 + Math.floor(this._hash(x * 5 + d, y * 7 + d) * 4);
          for (let g = 0; g < count; g++) {
            const push = 0.30 + this._hash(x + g * 7, y + g * 11 + d) * 0.35;
            const side = (this._hash(x * 9 + g * 3 + d, y * 13 + g) - 0.5) * 0.85;
            gravel.push({
              x: x * TILE_SIZE + NDX[d] * push + (1 - Math.abs(NDX[d])) * side,
              z: y * TILE_SIZE + NDZ[d] * push + (1 - Math.abs(NDZ[d])) * side,
              s: 0.04 + this._hash(x + g * 13 + d, y + g * 17) * 0.06,
            });
          }
        }
      }
      if (gravel.length > 0) {
        const gGeo = new THREE.SphereGeometry(1, 4, 3);
        const gMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
        const gMesh = new THREE.InstancedMesh(gGeo, gMat, gravel.length);
        const gColor = new THREE.Color();
        for (let i = 0; i < gravel.length; i++) {
          const g = gravel[i];
          matrix.makeScale(g.s, g.s * 0.4, g.s);
          matrix.setPosition(g.x, g.s * 0.15, g.z);
          gMesh.setMatrixAt(i, matrix);
          const h = this._hash(Math.floor(g.x * 9), Math.floor(g.z * 9));
          gColor.setHSL(0.07 + h * 0.04, 0.06 + h * 0.06, 0.40 + h * 0.15);
          gMesh.setColorAt(i, gColor);
        }
        gMesh.instanceMatrix.needsUpdate = true;
        gMesh.instanceColor.needsUpdate = true;
        this.mapGroup.add(gMesh);
      }
    }
  }

  // ── Water ───────────────────────────────────────────────────────────

  _buildWater(mapData, mapSize) {
    const waterTiles = [];
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] === TERRAIN_WATER) waterTiles.push({ x, y });
      }
    }
    if (waterTiles.length === 0) return;

    // Use overlapping circular discs instead of square tiles so the
    // lake edges are naturally rounded.  Radius > 0.5 * TILE_SIZE so
    // adjacent discs overlap, filling the interior seamlessly while
    // leaving organic rounded edges.
    const discGeo = new THREE.CircleGeometry(TILE_SIZE * 0.72, 16);
    discGeo.rotateX(-Math.PI / 2);

    // Deep water layer
    const deepMat = new THREE.MeshPhongMaterial({
      color: 0x1a6b8a,
      transparent: true,
      opacity: 0.85,
      shininess: 80,
      specular: 0x88ccff,
    });
    const deepMesh = new THREE.InstancedMesh(discGeo, deepMat, waterTiles.length);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < waterTiles.length; i++) {
      matrix.setPosition(waterTiles[i].x * TILE_SIZE, -0.15, waterTiles[i].y * TILE_SIZE);
      deepMesh.setMatrixAt(i, matrix);
    }
    deepMesh.instanceMatrix.needsUpdate = true;
    this.mapGroup.add(deepMesh);

    // Surface shimmer layer
    const surfaceMat = new THREE.MeshPhongMaterial({
      color: 0x4db8d9,
      transparent: true,
      opacity: 0.35,
      shininess: 120,
      specular: 0xffffff,
    });
    const surfaceMesh = new THREE.InstancedMesh(discGeo, surfaceMat, waterTiles.length);
    for (let i = 0; i < waterTiles.length; i++) {
      matrix.setPosition(waterTiles[i].x * TILE_SIZE, -0.12, waterTiles[i].y * TILE_SIZE);
      surfaceMesh.setMatrixAt(i, matrix);
    }
    surfaceMesh.instanceMatrix.needsUpdate = true;
    this.mapGroup.add(surfaceMesh);

    this.waterMeshes.push({ mesh: surfaceMesh, tiles: waterTiles });

    // Lily pads on ~10% of water tiles
    const lilyPlacements = [];
    for (const { x, y } of waterTiles) {
      if (this._hash(x * 19 + 3, y * 23 + 7) > 0.10) continue;
      const count = 1 + Math.floor(this._hash(x + 71, y + 83) * 2);
      for (let l = 0; l < count; l++) {
        lilyPlacements.push({
          x: x * TILE_SIZE + (this._hash(x * 2 + l, y * 4) - 0.5) * 0.6,
          z: y * TILE_SIZE + (this._hash(x * 6, y * 2 + l) - 0.5) * 0.6,
          scale: 0.08 + this._hash(x + l * 3, y + l * 5) * 0.06,
        });
      }
    }
    if (lilyPlacements.length > 0) {
      const lilyGeo = new THREE.CircleGeometry(1, 6);
      lilyGeo.rotateX(-Math.PI / 2);
      const lilyMat = new THREE.MeshLambertMaterial({ color: 0x3a7d32, side: THREE.DoubleSide });
      const lilyMesh = new THREE.InstancedMesh(lilyGeo, lilyMat, lilyPlacements.length);
      const m = new THREE.Matrix4();
      for (let i = 0; i < lilyPlacements.length; i++) {
        const p = lilyPlacements[i];
        m.makeScale(p.scale, p.scale, p.scale);
        m.setPosition(p.x, -0.09, p.z);
        lilyMesh.setMatrixAt(i, m);
      }
      lilyMesh.instanceMatrix.needsUpdate = true;
      this.mapGroup.add(lilyMesh);
    }

    // ── Shore foam: scatter irregular circles at every water→land edge ──
    const NDX = [0, 1, 0, -1];
    const NDZ = [1, 0, -1, 0];
    const foamPts = [];
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_WATER) continue;
        for (let d = 0; d < 4; d++) {
          const nx = x + NDX[d], ny = y + NDZ[d];
          if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;
          if (mapData[ny * mapSize + nx] === TERRAIN_WATER) continue;
          // border edge found — sprinkle 3–6 foam dots along it
          const count = 3 + Math.floor(this._hash(x * 7 + d * 3, y * 11 + d) * 4);
          for (let f = 0; f < count; f++) {
            const t = this._hash(x * 13 + f * 7 + d, y * 17 + f * 5) - 0.5;
            const push = 0.1 + this._hash(x + f * 9, y + f * 11 + d) * 0.32;
            foamPts.push({
              x: x * TILE_SIZE + NDX[d] * push + (1 - Math.abs(NDX[d])) * t * 0.85,
              z: y * TILE_SIZE + NDZ[d] * push + (1 - Math.abs(NDZ[d])) * t * 0.85,
              r: 0.06 + this._hash(x * 5 + f, y * 7 + f + d) * 0.10,
            });
          }
        }
      }
    }
    if (foamPts.length > 0) {
      const foamGeo = new THREE.CircleGeometry(1, 8);
      foamGeo.rotateX(-Math.PI / 2);
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.65 });
      const foamMesh = new THREE.InstancedMesh(foamGeo, foamMat, foamPts.length);
      const m = new THREE.Matrix4();
      for (let i = 0; i < foamPts.length; i++) {
        const p = foamPts[i];
        m.makeScale(p.r, p.r, p.r);
        m.setPosition(p.x, -0.07, p.z);
        foamMesh.setMatrixAt(i, m);
      }
      foamMesh.instanceMatrix.needsUpdate = true;
      this.mapGroup.add(foamMesh);
    }
  }

  // ── Model loading ───────────────────────────────────────────────────

  async _loadModels() {
    const load = (path) => new Promise((resolve, reject) =>
      this._loader.load(path, resolve, undefined, reject)
    );

    // Load the shared colormap atlas (external to the GLBs).
    // flipY=false is required because glTF UV origin is top-left, whereas
    // Three.js TextureLoader defaults to flipY=true (bottom-left origin).
    const colormap = await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        '/assets/models/landscape/colormap.png',
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

    const extractMeshData = (gltfScene) => {
      gltfScene.updateMatrixWorld(true);
      const nodes = [];
      gltfScene.traverse(child => {
        if (child.isMesh) {
          // GLBs reference an external texture that won't resolve in the browser,
          // so we supply the colormap manually and use MeshLambertMaterial
          // to match the scene's lighting style.
          const mat = new THREE.MeshLambertMaterial({
            map: colormap,
            side: child.material.side,
          });
          nodes.push({
            geometry: child.geometry,
            material: mat,
            localMatrix: child.matrixWorld.clone(),
          });
        }
      });
      return nodes;
    };

    const [trees, rocks] = await Promise.all([
      Promise.all(TREE_MODELS.map(load)),
      Promise.all(ROCK_MODELS.map(load)),
    ]);

    this._treeVariants = trees.map(g => extractMeshData(g.scene));
    this._rockVariants = rocks.map(g => extractMeshData(g.scene));
  }

  // ── Trees ───────────────────────────────────────────────────────────

  _buildTrees(mapData, mapSize) {
    const placements = [];
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_GRASS) continue;
        if (x < 3 || x >= mapSize - 3 || y < 3 || y >= mapSize - 3) continue;

        // Zone-based density: 7×7 tile zones split into forest vs plains.
        const zx = Math.floor(x / 7);
        const zy = Math.floor(y / 7);
        const zone = this._hash(zx * 97 + 31, zy * 113 + 17);
        let threshold;
        if (zone < 0.50)      threshold = 0.012;                    // plains – rare lone tree
        else if (zone < 0.72) threshold = 0.04;                     // light scatter
        else                  threshold = 0.20 + (zone - 0.72) * 1.0; // dense forest 20–48 %

        const h = this._hash(x * 3 + 7, y * 5 + 13);
        if (h > threshold) continue;
        placements.push({ x, y, h });
      }
    }
    if (placements.length === 0) return;

    // Distribute placements across variants
    const nV = this._treeVariants.length;
    const buckets = Array.from({ length: nV }, () => []);
    for (const p of placements) {
      buckets[Math.floor(this._hash(p.x * 31 + 5, p.y * 37 + 11) * nV)].push(p);
    }

    const matrix = new THREE.Matrix4();
    const mPos = new THREE.Matrix4();
    const mRot = new THREE.Matrix4();
    const mScale = new THREE.Matrix4();

    for (let v = 0; v < nV; v++) {
      if (buckets[v].length === 0) continue;
      for (const node of this._treeVariants[v]) {
        const mesh = new THREE.InstancedMesh(node.geometry, node.material, buckets[v].length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        for (let i = 0; i < buckets[v].length; i++) {
          const { x, y, h } = buckets[v][i];
          const ox = (this._hash(x + 1, y) - 0.5) * 0.4;
          const oz = (this._hash(x, y + 1) - 0.5) * 0.4;
          const s = 1.4 + h * 0.8; // scale variation: 1.4–2.2
          const ry = this._hash(x * 7, y * 11) * Math.PI * 2;

          mScale.makeScale(s, s, s);
          mRot.makeRotationY(ry);
          mPos.makeTranslation(x * TILE_SIZE + ox, 0, y * TILE_SIZE + oz);

          matrix.multiplyMatrices(mPos, mRot);
          matrix.multiply(mScale);
          matrix.multiply(node.localMatrix);
          mesh.setMatrixAt(i, matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.mapGroup.add(mesh);
        this.trees.push(mesh);
      }
    }
  }

  // ── Rocks ───────────────────────────────────────────────────────────

  _buildRocks(mapData, mapSize) {
    const placements = [];

    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_ROCK) continue;
        // One primary rock per tile
        placements.push({
          x, y,
          ox: (this._hash(x * 7, y * 3) - 0.5) * 0.3,
          oz: (this._hash(x * 3, y * 7) - 0.5) * 0.3,
          s: 0.55 + this._hash(x, y) * 0.35,
          ry: this._hash(x * 11, y * 13) * Math.PI * 2,
        });
        // 1–2 accent rocks around it
        const count = 1 + Math.floor(this._hash(x + 50, y + 50) * 2);
        for (let r = 0; r < count; r++) {
          placements.push({
            x, y,
            ox: (this._hash(x * 7 + r + 3, y * 3 + r) - 0.5) * 0.7,
            oz: (this._hash(x * 3 + r, y * 7 + r + 3) - 0.5) * 0.7,
            s: 0.28 + this._hash(x + r * 11, y + r * 13) * 0.22,
            ry: this._hash(x * 5 + r, y * 9 + r) * Math.PI * 2,
          });
        }
      }
    }

    if (placements.length === 0) return;

    const nV = this._rockVariants.length;
    const buckets = Array.from({ length: nV }, () => []);
    for (const p of placements) {
      buckets[Math.floor(this._hash(p.x * 17 + p.ox * 3, p.y * 23 + p.oz * 3) * nV)].push(p);
    }

    const matrix = new THREE.Matrix4();
    const mPos = new THREE.Matrix4();
    const mRot = new THREE.Matrix4();
    const mScale = new THREE.Matrix4();

    for (let v = 0; v < nV; v++) {
      if (buckets[v].length === 0) continue;
      for (const node of this._rockVariants[v]) {
        const mesh = new THREE.InstancedMesh(node.geometry, node.material, buckets[v].length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        for (let i = 0; i < buckets[v].length; i++) {
          const p = buckets[v][i];
          mScale.makeScale(p.s, p.s, p.s);
          mRot.makeRotationY(p.ry);
          mPos.makeTranslation(p.x * TILE_SIZE + p.ox, 0, p.y * TILE_SIZE + p.oz);

          matrix.multiplyMatrices(mPos, mRot);
          matrix.multiply(mScale);
          matrix.multiply(node.localMatrix);
          mesh.setMatrixAt(i, matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        this.mapGroup.add(mesh);
        this.rocks.push(mesh);
      }
    }
  }

  // ── Grass tufts ─────────────────────────────────────────────────────

  _buildGrassTufts(mapData, mapSize) {
    const placements = [];

    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_GRASS) continue;
        // ~20% of grass tiles get tufts
        if (this._hash(x * 13 + 3, y * 17 + 5) > 0.20) continue;

        const count = 1 + Math.floor(this._hash(x + 99, y + 77) * 3);
        for (let t = 0; t < count; t++) {
          placements.push({
            x: x * TILE_SIZE + (this._hash(x * 2 + t, y * 3) - 0.5) * 0.7,
            z: y * TILE_SIZE + (this._hash(x * 4, y * 2 + t) - 0.5) * 0.7,
            scale: 0.04 + this._hash(x + t * 5, y + t * 7) * 0.06,
          });
        }
      }
    }

    if (placements.length === 0) return;

    // Thin cone for grass blade
    const bladeGeo = new THREE.ConeGeometry(1, 3, 4);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x4a8c3f });
    const bladeMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, placements.length);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      matrix.makeScale(p.scale, p.scale, p.scale);
      matrix.setPosition(p.x, p.scale * 1.5, p.z);
      bladeMesh.setMatrixAt(i, matrix);

      const h = this._hash(Math.floor(p.x * 10), Math.floor(p.z * 10));
      color.setHSL(0.28 + h * 0.08, 0.6, 0.3 + h * 0.1);
      bladeMesh.setColorAt(i, color);
    }

    bladeMesh.instanceMatrix.needsUpdate = true;
    bladeMesh.instanceColor.needsUpdate = true;
    this.mapGroup.add(bladeMesh);
  }

  // ── Sand details ────────────────────────────────────────────────────

  _buildSandDetails(mapData, mapSize) {
    const pebbles = [];
    const NDX = [0, 1, 0, -1];
    const NDZ = [1, 0, -1, 0];

    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_SAND) continue;

        // Interior pebbles — denser than before
        if (this._hash(x * 11 + 7, y * 13 + 3) < 0.55) {
          const count = 2 + Math.floor(this._hash(x + 31, y + 47) * 4);
          for (let p = 0; p < count; p++) {
            pebbles.push({
              x: x * TILE_SIZE + (this._hash(x * 6 + p, y * 4) - 0.5) * 0.75,
              z: y * TILE_SIZE + (this._hash(x * 8, y * 6 + p) - 0.5) * 0.75,
              scale: 0.03 + this._hash(x + p * 9, y + p * 11) * 0.05,
            });
          }
        }

        // Border fringe: spill sand-coloured dots into adjacent non-sand tiles
        // to break the hard rectangular edge
        for (let d = 0; d < 4; d++) {
          const nx = x + NDX[d], ny = y + NDZ[d];
          if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;
          if (mapData[ny * mapSize + nx] === TERRAIN_SAND) continue;
          const count = 4 + Math.floor(this._hash(x * 5 + d, y * 7 + d) * 5);
          for (let f = 0; f < count; f++) {
            const push = 0.35 + this._hash(x + f * 7, y + f * 11 + d) * 0.3;
            const side = (this._hash(x * 9 + f * 3 + d, y * 13 + f) - 0.5) * 0.9;
            pebbles.push({
              x: x * TILE_SIZE + NDX[d] * push + (1 - Math.abs(NDX[d])) * side,
              z: y * TILE_SIZE + NDZ[d] * push + (1 - Math.abs(NDZ[d])) * side,
              scale: 0.04 + this._hash(x + f * 13 + d, y + f * 17) * 0.08,
            });
          }
        }
      }
    }

    if (pebbles.length === 0) return;

    const pebbleGeo = new THREE.SphereGeometry(1, 4, 3);
    const pebbleMat = new THREE.MeshLambertMaterial({ color: 0xb8a88a });
    const pebbleMesh = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbles.length);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < pebbles.length; i++) {
      const p = pebbles[i];
      matrix.makeScale(p.scale, p.scale * 0.5, p.scale);
      matrix.setPosition(p.x, p.scale * 0.2 - 0.02, p.z);
      pebbleMesh.setMatrixAt(i, matrix);

      const h = this._hash(Math.floor(p.x * 7), Math.floor(p.z * 7));
      color.setHSL(0.08 + h * 0.05, 0.2 + h * 0.1, 0.55 + h * 0.15);
      pebbleMesh.setColorAt(i, color);
    }

    pebbleMesh.instanceMatrix.needsUpdate = true;
    pebbleMesh.instanceColor.needsUpdate = true;
    this.mapGroup.add(pebbleMesh);
  }

  // ── Flowers ──────────────────────────────────────────────────────────

  _buildFlowers(mapData, mapSize) {
    const placements = [];
    const FLOWER_COLORS = [0xff6b8a, 0xffb347, 0xff69b4, 0xffd700, 0xda70d6, 0xff4444, 0x87ceeb];

    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (mapData[y * mapSize + x] !== TERRAIN_GRASS) continue;
        if (this._hash(x * 17 + 11, y * 23 + 7) > 0.06) continue; // ~6% of grass

        const count = 1 + Math.floor(this._hash(x + 41, y + 59) * 4);
        for (let f = 0; f < count; f++) {
          placements.push({
            x: x * TILE_SIZE + (this._hash(x * 3 + f, y * 5) - 0.5) * 0.7,
            z: y * TILE_SIZE + (this._hash(x * 7, y * 3 + f) - 0.5) * 0.7,
            colorIdx: Math.floor(this._hash(x + f * 13, y + f * 17) * FLOWER_COLORS.length),
          });
        }
      }
    }

    if (placements.length === 0) return;

    const flowerGeo = new THREE.SphereGeometry(0.06, 5, 4);
    const flowerMat = new THREE.MeshLambertMaterial({ color: 0xff6b8a });
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, placements.length);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      matrix.makeTranslation(p.x, 0.06, p.z);
      flowerMesh.setMatrixAt(i, matrix);
      color.set(FLOWER_COLORS[p.colorIdx]);
      flowerMesh.setColorAt(i, color);
    }

    flowerMesh.instanceMatrix.needsUpdate = true;
    flowerMesh.instanceColor.needsUpdate = true;
    this.mapGroup.add(flowerMesh);
  }

  // ── Animation ───────────────────────────────────────────────────────

  update(time) {
    // Animate water surface
    for (const { mesh, tiles } of this.waterMeshes) {
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < tiles.length; i++) {
        const { x, y } = tiles[i];
        const wave = Math.sin(time * 1.5 + x * 0.5 + y * 0.3) * 0.02;
        matrix.setPosition(x * TILE_SIZE, -0.12 + wave, y * TILE_SIZE);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────

  /** Deterministic hash for (x, y) -> [0, 1) */
  _hash(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  _clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      group.remove(child);
    }
  }

  dispose() {
    this._clearGroup(this.mapGroup);
    this.trees = [];
    this.rocks = [];
    this.waterMeshes = [];
  }
}
