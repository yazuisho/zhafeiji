const GRID_SIZE = 10;
const PLANE_COUNT = 3;
const PLANE_ALL_OFFSETS = [
  [[0, -2], [0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]],
  [[2, 0], [1, 0], [0, -1], [0, 0], [0, 1], [-1, 0], [-2, 0]],
  [[0, 2], [0, 1], [1, 0], [0, 0], [-1, 0], [0, -1], [0, -2]],
  [[-2, 0], [-1, 0], [0, 1], [0, 0], [0, -1], [1, 0], [2, 0]],
];
const CELL_EMPTY = 0;
const CELL_PLANE = 1;
const CELL_HIT = 2;
const CELL_MISS = 3;
const PHASE_PLACEMENT = 'placement';
const PHASE_BATTLE = 'battle';
const PHASE_GAMEOVER = 'gameover';
const MSG_TYPES = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLACE_PLANE: 'place_plane',
  REMOVE_PLANE: 'remove_plane',
  READY: 'ready',
  ATTACK: 'attack',
  ROOM_CREATED: 'room_created',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PLACEMENT_UPDATE: 'placement_update',
  READY_UPDATE: 'ready_update',
  GAME_START: 'game_start',
  ATTACK_RESULT: 'attack_result',
  GAME_OVER: 'game_over',
  ERROR: 'error',
};
module.exports = {
  GRID_SIZE, PLANE_COUNT, PLANE_ALL_OFFSETS,
  CELL_EMPTY, CELL_PLANE, CELL_HIT, CELL_MISS,
  PHASE_PLACEMENT, PHASE_BATTLE, PHASE_GAMEOVER,
  MSG_TYPES,
};
