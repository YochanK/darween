import { GameScene } from './game/GameScene.js';
import { GameSocket } from './network/socket.js';
import { UIManager } from './ui/UIManager.js';
import { LobbyScreen } from './ui/LobbyScreen.js';
import { RoomScreen } from './ui/RoomScreen.js';
import { SelectionScreen } from './ui/SelectionScreen.js';
import { GameHUD } from './ui/GameHUD.js';

const app = document.getElementById('app');

// ─── Socket ──────────────────────────────────────────────────────────────
const socket = new GameSocket();

// ─── UI Manager ──────────────────────────────────────────────────────────
const ui = new UIManager();
const lobbyScreen = new LobbyScreen(socket, ui);
const roomScreen = new RoomScreen(socket, ui);
const selectionScreen = new SelectionScreen(socket, ui);

ui.register('lobby', lobbyScreen);
ui.register('room', roomScreen);
ui.register('selection', selectionScreen);

// ─── Three.js Scene (created later when game starts) ─────────────────────
let gameScene = null;

// ─── State ───────────────────────────────────────────────────────────────
let myPlayerId = null;
let myRoomCode = null;
let isHost = false;

// ─── Socket Events ───────────────────────────────────────────────────────

socket.on('connected', () => {
  console.log('Connected to server');
  ui.show('lobby');
});

socket.on('disconnected', () => {
  console.log('Disconnected from server');
});

socket.on('ROOM_CREATED', (msg) => {
  myPlayerId = msg.player_id;
  myRoomCode = msg.room_code;
  isHost = true;
  ui.show('room', {
    roomCode: msg.room_code,
    playerId: msg.player_id,
    players: [{ player_id: msg.player_id, username: 'You', is_host: true }],
    isHost: true,
  });
});

socket.on('ROOM_JOINED', (msg) => {
  myPlayerId = msg.player_id;
  myRoomCode = msg.room_code;
  const me = msg.players.find(p => p.player_id === msg.player_id);
  isHost = me?.is_host || false;
  ui.show('room', {
    roomCode: msg.room_code,
    playerId: msg.player_id,
    players: msg.players,
    isHost,
  });
});

socket.on('GOTO_SELECTION', () => {
  ui.show('selection', { isHost });
});

// Store teams data for mapping team_id -> archetype/color
let teamsData = {};
let gameHUD = null;

socket.on('GAME_START', async (msg) => {
  teamsData = msg.teams;

  // Initialize Three.js scene and render the map
  if (!gameScene) {
    gameScene = new GameScene(app);
  }

  // Clear UI and show game HUD
  const overlay = document.getElementById('ui-overlay');
  overlay.innerHTML = '';

  gameScene.loadMap(msg.map_data, msg.map_size, msg.houses);
  await gameScene.loadCreatures(teamsData);
  gameScene.start();

  // Create game HUD
  gameHUD = new GameHUD(overlay);
  gameHUD.onSpeedChange = (speed) => {
    socket.send({ type: 'SET_SPEED', speed });
  };
});

socket.on('STATE_UPDATE', (msg) => {
  if (!gameScene) return;

  // Update creatures
  if (msg.creatures) {
    const creatureData = {};
    for (const c of msg.creatures) {
      const team = teamsData[c.team_id];
      creatureData[c.id] = {
        x: c.x,
        y: c.y,
        team_color_index: team?.color_index ?? 0,
        archetype: team?.archetype ?? 'fox',
        anim_state: c.animation || 'idle',
        emoji: c.emoji || null,
      };
    }
    gameScene.updateCreatures(creatureData);
  }

  // Update apples
  if (msg.apples) {
    gameScene.updateApples(msg.apples);
  }

  // Update phase
  if (msg.phase) {
    gameScene.setPhase(msg.phase);
  }

  // Update HUD
  if (gameHUD) {
    gameHUD.update(msg, myPlayerId, teamsData);
    if (msg.speed != null) gameHUD.setSpeed(msg.speed);
  }
});

socket.on('ERROR', (msg) => {
  console.error('Server error:', msg.message);
});

// ─── Start ───────────────────────────────────────────────────────────────
socket.connect();
