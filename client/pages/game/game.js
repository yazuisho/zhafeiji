const app = getApp();
const {
  GRID_SIZE, PLANE_COUNT, PLANE_ALL_OFFSETS,
  CELL_EMPTY, CELL_PLANE, CELL_HIT, CELL_MISS,
  PHASE_PLACEMENT, PHASE_BATTLE, PHASE_GAMEOVER,
} = require('../../utils/constants');
const {
  getPlaneCells, canPlace, placePlane, createEmptyGrid,
} = require('../../utils/gameLogic');

const rotationLabels = ['↑ 上', '→ 右', '↓ 下', '← 左'];

function makeCellGrid(isAttack) {
  const init = isAttack ? 4 : CELL_EMPTY;
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: init, preview: false }))
  );
}

function stateGridFromCellGrid(cellGrid) {
  return cellGrid.map(row => row.map(c => c.state));
}

Page({
  data: {
    phase: PHASE_PLACEMENT,
    currentGrid: [],
    viewMode: 'mybase',
    myGridData: [],
    attackGridData: [],

    planeCount: 0,
    maxPlanes: PLANE_COUNT,
    currentRotation: 0,
    currentRotationLabel: rotationLabels[0],
    placedPlanes: [],

    rowLabels: 'ABCDEFGHIJ'.split(''),

    isMyTurn: false,
    lastResult: null,
    attackHits: 0,
    destroyedCount: 0,
    waitingForResult: false,
    winnerName: '',
    opponentReady: false,
  },

  onLoad() {
    const gs = app.globalData.gameState;
    const pid = app.globalData.playerId;

    const myGrid = makeCellGrid(false);
    const atkGrid = makeCellGrid(true);

    this.setData({
      myGridData: myGrid,
      attackGridData: atkGrid,
      currentGrid: myGrid,
    });

    if (gs) {
      this.setData({
        isMyTurn: gs.currentTurn === pid,
      });
    }

    this.setupWS();
  },

  setupWS() {
    const ws = app.globalData.ws;
    const pid = app.globalData.playerId;

    ws.setHandlers({
      placement_update: (msg) => {
        if (msg.playerId === pid && msg.plane === null) {
          this.setData({ planeCount: msg.planeCount });
        }
      },
      game_start: (msg) => {
        this.setData({
          phase: PHASE_BATTLE,
          viewMode: 'attack',
          currentGrid: this.data.attackGridData,
          isMyTurn: msg.currentTurn === pid,
        });
      },
      attack_result: (msg) => {
        const isMe = msg.attackerId === pid;
        const myGrid = [...this.data.myGridData];
        const atkGrid = [...this.data.attackGridData];

        if (isMe) {
          atkGrid[msg.row][msg.col] = { ...atkGrid[msg.row][msg.col], state: msg.hit ? CELL_HIT : CELL_MISS };
          let hits = this.data.attackHits + (msg.hit ? 1 : 0);
          let destroyed = this.data.destroyedCount + (msg.destroyed ? 1 : 0);
          const updates = {
            attackGridData: atkGrid,
            lastResult: { hit: msg.hit, destroyed: msg.destroyed },
            attackHits: hits,
            destroyedCount: destroyed,
            isMyTurn: msg.currentTurn === pid,
            waitingForResult: false,
          };
          if (this.data.viewMode === 'attack') updates.currentGrid = atkGrid;
          this.setData(updates);
        } else {
          myGrid[msg.row][msg.col] = { ...myGrid[msg.row][msg.col], state: msg.hit ? CELL_HIT : CELL_MISS };
          const updates = {
            myGridData: myGrid,
            isMyTurn: msg.currentTurn === pid,
          };
          if (this.data.viewMode === 'mybase') updates.currentGrid = myGrid;
          this.setData(updates);
        }
      },
      game_over: (msg) => {
        this.setData({
          phase: PHASE_GAMEOVER,
          winnerName: msg.winner === pid ? '你' : msg.winnerName,
        });
      },
      error: (msg) => {
        wx.showToast({ title: msg.message, icon: 'none' });
      },
    });
  },

  onCellTap(e) {
    const row = Number(e.currentTarget.dataset.row);
    const col = Number(e.currentTarget.dataset.col);
    if (isNaN(row) || isNaN(col)) return;

    if (this.data.phase === PHASE_PLACEMENT) {
      this.handlePlacementTap(row, col);
    } else if (this.data.phase === PHASE_BATTLE && this.data.viewMode === 'attack' && this.data.isMyTurn && !this.data.waitingForResult) {
      this.handleAttackTap(row, col);
    }
  },

  handlePlacementTap(row, col) {
    const rot = this.data.currentRotation;
    const grid = this.data.myGridData;
    const stateGrid = stateGridFromCellGrid(grid);

    if (!canPlace(stateGrid, row, col, rot)) {
      wx.showToast({ title: '位置无效或重叠', icon: 'none' });
      return;
    }

    const cells = getPlaneCells(row, col, rot);
    cells.forEach(({ row: r, col: c }) => { grid[r][c].state = CELL_PLANE; });

    const planes = [...this.data.placedPlanes, { row, col, rotation: rot, cells }];

    this.setData({
      myGridData: grid,
      currentGrid: grid,
      placedPlanes: planes,
      planeCount: planes.length,
    });

    app.globalData.ws.send({ type: 'place_plane', row, col, rotation: rot });
  },

  onRotate() {
    const rot = (this.data.currentRotation + 1) % 4;
    this.setData({ currentRotation: rot, currentRotationLabel: rotationLabels[rot] });
  },

  onClearPlanes() {
    const grid = makeCellGrid(false);
    this.setData({
      myGridData: grid,
      currentGrid: grid,
      placedPlanes: [],
      planeCount: 0,
    });
    this.data.placedPlanes.forEach(p => {
      app.globalData.ws.send({ type: 'remove_plane', row: p.row, col: p.col, rotation: p.rotation });
    });
  },

  onReady() {
    if (this.data.planeCount < this.data.maxPlanes) return;
    app.globalData.ws.send({ type: 'ready' });
    wx.showToast({ title: '已就绪，等待对手...', icon: 'none' });
  },

  handleAttackTap(row, col) {
    const grid = this.data.attackGridData;
    if (grid[row][col].state !== 4) {
      wx.showToast({ title: '已攻击过', icon: 'none' });
      return;
    }
    this.setData({ waitingForResult: true });
    app.globalData.ws.send({ type: 'attack', row, col });
  },

  onToggleView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      viewMode: mode,
      currentGrid: mode === 'mybase' ? this.data.myGridData : this.data.attackGridData,
    });
  },

  onGoHome() {
    app.globalData.ws.send({ type: 'leave_room' });
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
