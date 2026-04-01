/** Message type constants matching server/protocol.py */

// Client -> Server
export const CREATE_ROOM = 'CREATE_ROOM';
export const JOIN_ROOM = 'JOIN_ROOM';
export const SELECT_ARCHETYPE = 'SELECT_ARCHETYPE';
export const SELECT_GENE = 'SELECT_GENE';
export const CONFIRM_SELECTION = 'CONFIRM_SELECTION';
export const START_GAME = 'START_GAME';
export const PONG = 'PONG';

// Server -> Client
export const ROOM_CREATED = 'ROOM_CREATED';
export const ROOM_JOINED = 'ROOM_JOINED';
export const PLAYER_JOINED = 'PLAYER_JOINED';
export const PLAYER_LEFT = 'PLAYER_LEFT';
export const SELECTION_UPDATE = 'SELECTION_UPDATE';
export const GAME_START = 'GAME_START';
export const STATE_UPDATE = 'STATE_UPDATE';
export const STATE_FULL = 'STATE_FULL';
export const PHASE_CHANGE = 'PHASE_CHANGE';
export const COMBAT_EVENT = 'COMBAT_EVENT';
export const CREATURE_DIED = 'CREATURE_DIED';
export const REPRODUCTION_RESULT = 'REPRODUCTION_RESULT';
export const GAME_OVER = 'GAME_OVER';
export const PING = 'PING';
export const ERROR = 'ERROR';
