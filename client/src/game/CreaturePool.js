import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTeamColor, createTeamMaterial } from './TeamColors.js';

/** Archetype names matching the GLB filenames. */
const ARCHETYPES = ['fox', 'lion', 'bunny', 'elephant', 'monkey'];

/**
 * Creates a canvas texture for an emoji string.
 * @param {string} emoji
 * @returns {THREE.CanvasTexture}
 */
function _createEmojiTexture(emoji) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Manages creation, positioning, tinting, and removal of creature meshes.
 *
 * Each creature is an individual cloned mesh positioned in the scene.
 * (InstancedMesh optimisation can be layered on later for 10k+ creatures.)
 */
export class CreaturePool {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    /** @type {Map<string, THREE.Object3D>} loaded archetype templates (name -> gltf scene) */
    this._templates = new Map();

    /** @type {Map<string, THREE.AnimationClip[]>} archetype animation clips */
    this._clips = new Map();

    /** @type {Map<string, THREE.Object3D>} active creature meshes by creature id */
    this._creatures = new Map();

    /** @type {Map<string, { archetype: string, teamColorIndex: number }>} metadata per creature */
    this._meta = new Map();

    /** @type {Map<string, THREE.Sprite>} emoji sprites above creatures */
    this._emojiSprites = new Map();

    /** @type {Map<string, string>} current emoji per creature (to detect changes) */
    this._currentEmojis = new Map();

    /** @type {Map<string, THREE.SpriteMaterial>} cached emoji materials by emoji string */
    this._emojiMaterials = new Map();

    /** Group to hold all creature meshes for easy management. */
    this.creatureGroup = new THREE.Group();
    this.scene.add(this.creatureGroup);
  }

  /**
   * Load all 5 archetype GLB models.
   * Must be called (and awaited) before updateCreatures.
   */
  async loadModels() {
    const loader = new GLTFLoader();

    const promises = ARCHETYPES.map((name) => {
      const url = `/assets/models/animal-${name}.glb`;
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (gltf) => {
            this._templates.set(name, gltf.scene);
            this._clips.set(name, gltf.animations || []);
            resolve();
          },
          undefined,
          (err) => {
            console.warn(`Failed to load model: ${url}`, err);
            // Resolve anyway so other models still load
            resolve();
          },
        );
      });
    });

    await Promise.all(promises);
    console.log(`CreaturePool: loaded ${this._templates.size}/${ARCHETYPES.length} archetype models`);

    // Pre-create emoji materials for common emojis
    this._getOrCreateEmojiMaterial('!');
    this._getOrCreateEmojiMaterial('\u2694\ufe0f');
  }

  /**
   * Get or create a cached SpriteMaterial for the given emoji.
   * @param {string} emoji
   * @returns {THREE.SpriteMaterial}
   */
  _getOrCreateEmojiMaterial(emoji) {
    let mat = this._emojiMaterials.get(emoji);
    if (!mat) {
      const texture = _createEmojiTexture(emoji);
      mat = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true,
      });
      this._emojiMaterials.set(emoji, mat);
    }
    return mat;
  }

  /**
   * Synchronise the visible creatures with the latest server data.
   *
   * @param {Object<string, { x: number, y: number, team_color_index: number, archetype: string, anim_state: string, emoji: string|null }>} creatureData
   *   Dict of creature_id -> creature info
   */
  updateCreatures(creatureData) {
    const incomingIds = new Set(Object.keys(creatureData));

    // Remove creatures that are no longer present
    for (const [id] of this._creatures) {
      if (!incomingIds.has(id)) {
        this.removeCreature(id);
      }
    }

    // Create or update each creature
    for (const [id, data] of Object.entries(creatureData)) {
      const { x, y, team_color_index, archetype, anim_state, emoji } = data;

      let mesh = this._creatures.get(id);
      const meta = this._meta.get(id);

      // Need to (re)create if the mesh doesn't exist or archetype/team changed
      const needsCreate = !mesh
        || !meta
        || meta.archetype !== archetype
        || meta.teamColorIndex !== team_color_index;

      if (needsCreate) {
        // Remove old mesh if switching archetype or team
        if (mesh) {
          this._removeMesh(id);
        }

        mesh = this._createCreatureMesh(archetype, team_color_index);
        if (!mesh) continue; // template not loaded

        this._creatures.set(id, mesh);
        this._meta.set(id, { archetype, teamColorIndex: team_color_index });
        this.creatureGroup.add(mesh);
      }

      // Position: (x, 0.5, y) so creature sits on top of tiles
      mesh.position.set(x, 0.5, y);

      // Emoji bubble
      this._updateEmoji(id, emoji, x, y);
    }
  }

  /**
   * Update the emoji sprite for a creature.
   * @param {string} id
   * @param {string|null} emoji
   * @param {number} x
   * @param {number} y
   */
  _updateEmoji(id, emoji, x, y) {
    const currentEmoji = this._currentEmojis.get(id) || null;

    if (emoji && emoji !== currentEmoji) {
      // New or changed emoji — create/update sprite
      let sprite = this._emojiSprites.get(id);
      if (sprite) {
        this.creatureGroup.remove(sprite);
      }
      const mat = this._getOrCreateEmojiMaterial(emoji);
      sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.5, 0.5, 1);
      sprite.position.set(x, 1.3, y);
      this._emojiSprites.set(id, sprite);
      this._currentEmojis.set(id, emoji);
      this.creatureGroup.add(sprite);
    } else if (emoji && emoji === currentEmoji) {
      // Same emoji — just update position
      const sprite = this._emojiSprites.get(id);
      if (sprite) {
        sprite.position.set(x, 1.3, y);
      }
    } else if (!emoji && currentEmoji) {
      // Remove emoji
      const sprite = this._emojiSprites.get(id);
      if (sprite) {
        this.creatureGroup.remove(sprite);
      }
      this._emojiSprites.delete(id);
      this._currentEmojis.delete(id);
    }
  }

  /**
   * Remove a single creature by id.
   * @param {string} id
   */
  removeCreature(id) {
    this._removeMesh(id);
    this._meta.delete(id);
    // Clean up emoji sprite
    const sprite = this._emojiSprites.get(id);
    if (sprite) {
      this.creatureGroup.remove(sprite);
    }
    this._emojiSprites.delete(id);
    this._currentEmojis.delete(id);
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  /**
   * Clone a template mesh for the given archetype and apply team color.
   * @param {string} archetype
   * @param {number} teamColorIndex
   * @returns {THREE.Object3D | null}
   */
  _createCreatureMesh(archetype, teamColorIndex) {
    const template = this._templates.get(archetype);
    if (!template) {
      // Fallback: use a small colored box if the model is missing
      return this._createFallbackMesh(teamColorIndex);
    }

    const clone = template.clone();
    const teamColor = getTeamColor(teamColorIndex);

    // Apply team color tinting to all mesh materials in the cloned scene
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = createTeamMaterial(child.material, teamColor);
        child.castShadow = true;
      }
    });

    // Scale to fit nicely on 1x1 tiles
    clone.scale.setScalar(0.8);

    return clone;
  }

  /**
   * Fallback mesh when the GLB model failed to load.
   * @param {number} teamColorIndex
   * @returns {THREE.Mesh}
   */
  _createFallbackMesh(teamColorIndex) {
    const geo = new THREE.CapsuleGeometry(0.2, 0.3, 4, 8);
    const teamColor = getTeamColor(teamColorIndex);
    const mat = new THREE.MeshLambertMaterial({ color: teamColor });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.scale.setScalar(0.8);
    return mesh;
  }

  /**
   * Remove mesh from the scene and dispose its resources.
   * @param {string} id
   */
  _removeMesh(id) {
    const mesh = this._creatures.get(id);
    if (!mesh) return;

    this.creatureGroup.remove(mesh);

    // Dispose geometry and materials
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });

    this._creatures.delete(id);
  }

  /** Remove all creatures. */
  clear() {
    for (const [id] of this._creatures) {
      this._removeMesh(id);
    }
    // Clear emoji sprites
    for (const [id, sprite] of this._emojiSprites) {
      this.creatureGroup.remove(sprite);
    }
    this._emojiSprites.clear();
    this._currentEmojis.clear();
    this._meta.clear();
  }

  dispose() {
    this.clear();
    // Dispose emoji materials
    for (const [, mat] of this._emojiMaterials) {
      mat.map?.dispose();
      mat.dispose();
    }
    this._emojiMaterials.clear();
    this.scene.remove(this.creatureGroup);
  }
}
