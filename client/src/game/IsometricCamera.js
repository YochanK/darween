import * as THREE from 'three';

/**
 * Orthographic camera positioned for true isometric view.
 * Camera sits at (d, d, d) looking at the origin, giving equal foreshortening on all axes.
 */
export class IsometricCamera {
  constructor(viewportWidth, viewportHeight) {
    this.viewSize = 40; // how many world units visible vertically
    this.minZoom = 0.3;
    this.maxZoom = 4;

    const aspect = viewportWidth / viewportHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.viewSize * aspect / 2,
      this.viewSize * aspect / 2,
      this.viewSize / 2,
      -this.viewSize / 2,
      0.1,
      1000
    );

    // True isometric: camera along (1,1,1) direction
    const d = 100;
    this.camera.position.set(d, d, d);
    this.camera.lookAt(0, 0, 0);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();

    // Pan state
    this.panOffset = new THREE.Vector3(0, 0, 0);

    // Input state
    this._isDragging = false;
    this._lastMouse = { x: 0, y: 0 };
    this._viewportWidth = viewportWidth;
    this._viewportHeight = viewportHeight;

    this._setupControls();
  }

  /** Center camera on a world position. */
  lookAt(x, z) {
    this.panOffset.set(x, 0, z);
    this._updateCameraPosition();
  }

  /** Resize handler. */
  resize(width, height) {
    this._viewportWidth = width;
    this._viewportHeight = height;
    const aspect = width / height;
    this.camera.left = -this.viewSize * aspect / 2;
    this.camera.right = this.viewSize * aspect / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();
  }

  _updateCameraPosition() {
    const d = 100;
    this.camera.position.set(
      d + this.panOffset.x,
      d,
      d + this.panOffset.z
    );
    this.camera.lookAt(
      this.panOffset.x,
      0,
      this.panOffset.z
    );
  }

  _setupControls() {
    const canvas = document.querySelector('#app');
    if (!canvas) return;

    // Zoom with scroll wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.camera.zoom * zoomDelta)
      );
      this.camera.updateProjectionMatrix();
    }, { passive: false });

    // Pan with middle-click or right-click drag
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this._isDragging = true;
        this._lastMouse = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };

      // Convert screen movement to world movement
      // In isometric view, screen X maps to world X-Z diagonal
      const panSpeed = this.viewSize / (this._viewportHeight * this.camera.zoom);
      this.panOffset.x -= (dx + dy) * panSpeed * 0.7;
      this.panOffset.z -= (-dx + dy) * panSpeed * 0.7;
      this._updateCameraPosition();
    });

    canvas.addEventListener('mouseup', () => {
      this._isDragging = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
