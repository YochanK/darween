/**
 * Screen state machine: manages transitions between UI screens.
 * Screens: LOBBY -> ROOM -> SELECTION -> GAME -> RESULTS
 */
export class UIManager {
  constructor() {
    this.overlay = document.getElementById('ui-overlay');
    this.currentScreen = null;
    this.screens = {};
  }

  /** Register a screen by name. */
  register(name, screen) {
    this.screens[name] = screen;
  }

  /** Switch to a named screen. */
  show(name, data = {}) {
    if (this.currentScreen && this.screens[this.currentScreen]?.hide) {
      this.screens[this.currentScreen].hide();
    }

    // Clear overlay
    this.overlay.innerHTML = '';
    this.currentScreen = name;

    const screen = this.screens[name];
    if (screen?.render) {
      const el = screen.render(data);
      if (el) this.overlay.appendChild(el);
    }
  }
}
