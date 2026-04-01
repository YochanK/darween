import * as THREE from 'three';
import { IsometricCamera } from './IsometricCamera.js';
import { MapRenderer } from './MapRenderer.js';
import { CreaturePool } from './CreaturePool.js';
import { Interpolator } from './Interpolator.js';
import { DayNightCycle } from './DayNightCycle.js';
import { FoodRenderer } from './FoodRenderer.js';
import { HouseRenderer } from './HouseRenderer.js';

/**
 * Master Three.js scene: creates renderer, scene, camera, lights,
 * and manages the render loop.
 */
export class GameScene {
  constructor(container) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.shadowMap.enabled = true;
    container.insertBefore(this.renderer.domElement, container.firstChild);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.isoCamera = new IsometricCamera(window.innerWidth, window.innerHeight);
    this.camera = this.isoCamera.camera;

    // Lights (daytime default)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff4e0, 0.8);
    this.directionalLight.position.set(50, 80, 50);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    // Sub-renderers
    this.mapRenderer = new MapRenderer(this.scene);
    this.creaturePool = new CreaturePool(this.scene);
    this.interpolator = new Interpolator(100);
    this.dayNightCycle = new DayNightCycle(this.directionalLight, this.ambientLight);
    this.foodRenderer = new FoodRenderer(this.scene);
    this.houseRenderer = new HouseRenderer(this.scene);

    // Latest data from the server
    this._creatureData = null;
    this._appleData = null;
    this._teamsData = null;

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    // Animation
    this._clock = new THREE.Clock();
    this._animating = false;
    this._lastTime = 0;
  }

  /**
   * Load map data from server and render it.
   */
  loadMap(mapData, mapSize, houses) {
    this.mapRenderer.build(mapData, mapSize);

    // Center camera on map
    const center = mapSize / 2;
    this.isoCamera.lookAt(center, center);

    // Store houses for later (after teams data is available)
    this._housesData = houses;
  }

  /**
   * Load creature archetype models and build houses.
   */
  async loadCreatures(teamsData) {
    this._teamsData = teamsData;
    await this.creaturePool.loadModels();

    // Now build houses with team colors
    if (this._housesData) {
      this.houseRenderer.build(this._housesData, teamsData);
    }
  }

  /**
   * Feed new creature state from the server.
   */
  updateCreatures(creatureData) {
    const now = performance.now();
    for (const [id, data] of Object.entries(creatureData)) {
      this.interpolator.update(id, data.x, data.y, now);
    }
    this._creatureData = creatureData;
  }

  /**
   * Update apple data from server.
   */
  updateApples(apples) {
    this._appleData = apples;
    this.foodRenderer.updateApples(apples);
  }

  /**
   * Set the current phase for lighting.
   */
  setPhase(phase) {
    this.dayNightCycle.setPhase(phase);
  }

  /** Start the render loop. */
  start() {
    if (this._animating) return;
    this._animating = true;
    this._animate();
  }

  _animate() {
    if (!this._animating) return;
    requestAnimationFrame(() => this._animate());

    const elapsed = this._clock.getElapsedTime();
    const dt = elapsed - this._lastTime;
    this._lastTime = elapsed;

    // Update sub-systems
    this.mapRenderer.update(elapsed);
    this.dayNightCycle.update(dt);
    this.foodRenderer.update(elapsed);

    // Apply interpolated positions to creatures each frame
    if (this._creatureData) {
      const now = performance.now();
      const interpolated = {};
      for (const [id, data] of Object.entries(this._creatureData)) {
        const pos = this.interpolator.getPosition(id, now);
        interpolated[id] = {
          ...data,
          x: pos ? pos.x : data.x,
          y: pos ? pos.y : data.y,
        };
      }
      this.creaturePool.updateCreatures(interpolated);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.isoCamera.resize(w, h);
  }

  dispose() {
    this._animating = false;
    this.mapRenderer.dispose();
    this.creaturePool.dispose();
    this.interpolator.clear();
    this.foodRenderer.dispose();
    this.houseRenderer.dispose();
    this.renderer.dispose();
  }
}
