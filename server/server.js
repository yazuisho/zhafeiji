const { WebSocketServer } = require('ws');
const http = require('http');

const GRID_SIZE = 10;
const PLANE_ALL_OFFSETS = [
  [[0, -2], [0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]],
  [[2, 0], [1, 0], [0, -1], [0, 0], [0, 1], [-1, 0], [-2, 0]],
  [[0, 2], [0, 1], [1, 0], [0, 0], [-1, 0], [0, -1], [0, -2]],
  [[-2, 0], [-1, 0], [0, 1], [0, 0], [0, -1], [1, 0], [2, 0]],
];

const rooms = new Map();
const playerSockets = new Map();

function generateRoomCode() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  return code;
}

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function getPlaneCells(row, col, rot) {
  return PLANE_ALL_OFFSETS[rot].map(([dx, dy]) => ({ row: row + dy, col: col + dx }));
}

function canPlace(grid, row, col, rot) {
  return getPlaneCells(row, col, rot).every(({ row: r, col: c }) =>
    r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && grid[r][c] === 0
  );
}

function placePlane(grid, row, col, rot) {
  const cells = getPlaneCells(row, col, rot);
  cells.forEach(({ row: r, col: c }) => { grid[r][c] = 1; });
  return cells;
}

function checkAllDestroyed(grid, planes) {
  return planes.every(p => p.cells.every(({ row: r, col: c }) => grid[r][c] === 2));
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(room, data, excludeId) {
  room.players.forEach(p => {
    if (p.id !== excludeId && p.ws.readyState === 1) send(p.ws, data);
  });
}

function broadcastAll(room, data) {
  room.players.forEach(p => { if (p.ws.readyState === 1) send(p.ws, data); });
}

function getPlayerByWs(ws) {
  for (const [, room] of rooms) {
    for (const p of room.players) {
      if (p.ws === ws) return { player: p, room };
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Plane Battle Server Running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New connection');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong' });
      return;
    }

    switch (msg.type) {
      case 'create_room': {
        const code = generateRoomCode();
        const playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const player = { id: playerId, name: msg.playerName || 'Player', ws, grid: createEmptyGrid(), planes: [], ready: false };
        rooms.set(code, { code, players: [player], phase: 'placement' });
        playerSockets.set(ws, code);
        send(ws, { type: 'room_created', roomCode: code, playerId });
        console.log(`Room ${code} created by ${player.name}`);
        break;
      }
      case 'join_room': {
        const room = rooms.get(msg.roomCode);
        if (!room) { send(ws, { type: 'error', message: 'Room not found' }); break; }
        if (room.players.length >= 2) { send(ws, { type: 'error', message: 'Room is full' }); break; }
        const playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const player = { id: playerId, name: msg.playerName || 'Player', ws, grid: createEmptyGrid(), planes: [], ready: false };
        room.players.push(player);
        playerSockets.set(ws, room.code);
        send(ws, { type: 'room_created', roomCode: room.code, playerId });
        broadcastAll(room, {
          type: 'player_joined',
          players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
        });
        console.log(`${player.name} joined room ${room.code}`);
        break;
      }
      case 'place_plane': {
        const pData = getPlayerByWs(ws);
        if (!pData) { send(ws, { type: 'error', message: 'Not in a room' }); break; }
        const { player, room } = pData;
        const { row, col, rotation } = msg;
        if (!canPlace(player.grid, row, col, rotation)) { send(ws, { type: 'error', message: 'Cannot place here' }); break; }
        const cells = placePlane(player.grid, row, col, rotation);
        player.planes.push({ row, col, rotation, cells });
        broadcast(room, {
          type: 'placement_update',
          playerId: player.id,
          plane: { row, col, rotation },
          planeCount: player.planes.length,
        }, player.id);
        send(ws, { type: 'placement_update', playerId: player.id, plane: { row, col, rotation }, planeCount: player.planes.length });
        break;
      }
      case 'remove_plane': {
        const pData2 = getPlayerByWs(ws);
        if (!pData2) { send(ws, { type: 'error', message: 'Not in a room' }); break; }
        const { player: p2, room: r2 } = pData2;
        const idx = p2.planes.findIndex(pl => pl.row === msg.row && pl.col === msg.col && pl.rotation === msg.rotation);
        if (idx === -1) { send(ws, { type: 'error', message: 'Plane not found' }); break; }
        const removed = p2.planes.splice(idx, 1)[0];
        removed.cells.forEach(({ row: r, col: c }) => { p2.grid[r][c] = 0; });
        send(ws, { type: 'placement_update', playerId: p2.id, plane: null, planeCount: p2.planes.length });
        break;
      }
      case 'clear_planes': {
        const pData3 = getPlayerByWs(ws);
        if (!pData3) break;
        const { player: p3 } = pData3;
        p3.planes.forEach(pl => {
          pl.cells.forEach(({ row: r, col: c }) => { p3.grid[r][c] = 0; });
        });
        p3.planes = [];
        send(ws, { type: 'placement_update', playerId: p3.id, plane: null, planeCount: 0 });
        break;
      }
      case 'ready': {
        const pData4 = getPlayerByWs(ws);
        if (!pData4) break;
        const { player: p4, room: r4 } = pData4;
        p4.ready = true;
        broadcastAll(r4, { type: 'ready_update', playerId: p4.id });
        if (r4.players.length === 2 && r4.players.every(p => p.ready)) {
          r4.phase = 'battle';
          r4.currentTurn = r4.players[0].id;
          broadcastAll(r4, {
            type: 'game_start',
            currentTurn: r4.currentTurn,
            players: r4.players.map(p => ({ id: p.id, name: p.name })),
          });
          console.log(`Room ${r4.code} game started`);
        }
        break;
      }
      case 'attack': {
        const pData5 = getPlayerByWs(ws);
        if (!pData5) { send(ws, { type: 'error', message: 'Not in a room' }); break; }
        const { player: attacker, room: r5 } = pData5;
        if (r5.currentTurn !== attacker.id) { send(ws, { type: 'error', message: 'Not your turn' }); break; }
        const { row: ar, col: ac } = msg;
        if (ar < 0 || ar >= GRID_SIZE || ac < 0 || ac >= GRID_SIZE) { send(ws, { type: 'error', message: 'Invalid coordinate' }); break; }
        const defender = r5.players.find(p => p.id !== attacker.id);
        if (!defender) { send(ws, { type: 'error', message: 'No opponent' }); break; }
        if (defender.grid[ar][ac] === 2 || defender.grid[ar][ac] === 3) { send(ws, { type: 'error', message: 'Already attacked' }); break; }

        let hit = false, destroyed = false, destroyedIndex = -1;
        if (defender.grid[ar][ac] === 1) {
          defender.grid[ar][ac] = 2;
          hit = true;
          const dIdx = defender.planes.findIndex(pl => pl.cells.some(c => c.row === ar && c.col === ac));
          if (dIdx !== -1 && defender.planes[dIdx].cells.every(c => defender.grid[c.row][c.col] === 2)) {
            destroyed = true;
            destroyedIndex = dIdx;
          }
        } else {
          defender.grid[ar][ac] = 3;
        }

        const gameOver = checkAllDestroyed(defender.grid, defender.planes);
        if (gameOver) {
          r5.phase = 'gameover';
          broadcastAll(r5, { type: 'game_over', winner: attacker.id, winnerName: attacker.name });
          break;
        }

        const nextTurn = hit ? attacker.id : defender.id;
        r5.currentTurn = nextTurn;

        broadcastAll(r5, {
          type: 'attack_result',
          attackerId: attacker.id,
          row: ar, col: ac, hit, destroyed, destroyedIndex,
          currentTurn: nextTurn,
        });
        break;
      }
      case 'leave_room': {
        const pData6 = getPlayerByWs(ws);
        if (!pData6) break;
        const { player: p6, room: r6 } = pData6;
        r6.players = r6.players.filter(p => p.id !== p6.id);
        playerSockets.delete(ws);
        if (r6.players.length === 0) { rooms.delete(r6.code); console.log(`Room ${r6.code} closed`); }
        else broadcastAll(r6, { type: 'player_left', players: r6.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })) });
        break;
      }
    }
  });

  ws.on('close', () => {
    const pData = getPlayerByWs(ws);
    if (!pData) return;
    const { player, room } = pData;
    room.players = room.players.filter(p => p.id !== player.id);
    playerSockets.delete(ws);
    if (room.players.length === 0) { rooms.delete(room.code); console.log(`Room ${room.code} closed`); }
    else broadcastAll(room, { type: 'player_left', players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Plane Battle Server running on port ${PORT}`);
});
