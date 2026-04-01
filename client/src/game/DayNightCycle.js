import * as THREE from 'three';

/**
 * Controls lighting transitions between day and night phases.
 */
export class DayNightCycle {
  constructor(directionalLight, ambientLight) {
    this.dirLight = directionalLight;
    this.ambLight = ambientLight;

    // Day settings
    this.dayDirColor = new THREE.Color(0xfff4e0);
    this.dayDirIntensity = 0.8;
    this.dayAmbColor = new THREE.Color(0xffffff);
    this.dayAmbIntensity = 0.5;

    // Night settings
    this.nightDirColor = new THREE.Color(0x3344aa);
    this.nightDirIntensity = 0.15;
    this.nightAmbColor = new THREE.Color(0x4466cc);
    this.nightAmbIntensity = 0.12;

    this.phase = 'DAY';
    this._transitionProgress = 1.0; // 1 = fully in current phase
    this._transitionSpeed = 1.0 / 3.0; // 3 second transitions
  }

  /**
   * Set the current phase.
   * @param {'DAY'|'NIGHT'} phase
   */
  setPhase(phase) {
    if (phase !== this.phase) {
      this.phase = phase;
      this._transitionProgress = 0.0;
    }
  }

  /** Call each frame. */
  update(dt) {
    if (this._transitionProgress < 1.0) {
      this._transitionProgress = Math.min(1.0, this._transitionProgress + dt * this._transitionSpeed);
    }

    const t = this._smoothstep(this._transitionProgress);

    if (this.phase === 'DAY') {
      // Transitioning to day
      this.dirLight.color.lerpColors(this.nightDirColor, this.dayDirColor, t);
      this.dirLight.intensity = THREE.MathUtils.lerp(this.nightDirIntensity, this.dayDirIntensity, t);
      this.ambLight.color.lerpColors(this.nightAmbColor, this.dayAmbColor, t);
      this.ambLight.intensity = THREE.MathUtils.lerp(this.nightAmbIntensity, this.dayAmbIntensity, t);
    } else {
      // Transitioning to night
      this.dirLight.color.lerpColors(this.dayDirColor, this.nightDirColor, t);
      this.dirLight.intensity = THREE.MathUtils.lerp(this.dayDirIntensity, this.nightDirIntensity, t);
      this.ambLight.color.lerpColors(this.dayAmbColor, this.nightAmbColor, t);
      this.ambLight.intensity = THREE.MathUtils.lerp(this.dayAmbIntensity, this.nightAmbIntensity, t);
    }
  }

  _smoothstep(t) {
    return t * t * (3 - 2 * t);
  }
}
