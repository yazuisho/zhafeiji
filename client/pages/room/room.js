const app = getApp();

Page({
  data: {
    roomCode: '',
    role: '',
    players: [],
    hostId: '',
    isReady: false,
    isHost: false,
    allReady: false,
  },
  onLoad(query) {
    const role = query.role || 'host';
    const code = query.code || '';
    const name = query.name || '玩家';
    app.globalData.playerName = name;

    this.setData({
      role,
      roomCode: code,
      isHost: role === 'host',
      players: [],
      hostId: '',
    });

    const ws = app.globalData.ws;
    ws.setHandlers({
      room_created: (msg) => {
        app.globalData.roomCode = msg.roomCode;
        app.globalData.playerId = msg.playerId;
        this.setData({
          roomCode: msg.roomCode,
          players: [{ id: msg.playerId, name, ready: false }],
          hostId: msg.playerId,
        });
      },
      player_joined: (msg) => {
        this.setData({ players: msg.players });
      },
      ready_update: (msg) => {
        const players = this.data.players.map(p =>
          p.id === msg.playerId ? { ...p, ready: true } : p
        );
        const allReady = players.length === 2 && players.every(p => p.ready);
        const isReady = msg.playerId === app.globalData.playerId ? true : this.data.isReady;
        this.setData({ players, allReady, isReady });
      },
      player_left: (msg) => {
        this.setData({ players: msg.players, allReady: false, isReady: false });
      },
      game_start: (msg) => {
        app.globalData.gameState = {
          currentTurn: msg.currentTurn,
          players: msg.players,
        };
        wx.redirectTo({ url: '/pages/game/game' });
      },
      error: (msg) => {
        wx.showToast({ title: msg.message, icon: 'none' });
      },
    });

  },
  onCopyCode() {
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => wx.showToast({ title: '已复制房间码', icon: 'success' }),
    });
  },
  onToggleReady() {
    if (this.data.isReady) return;
    app.globalData.ws.send({ type: 'ready' });
  },
  onLeaveRoom() {
    app.globalData.ws.send({ type: 'leave_room' });
    wx.navigateBack();
  },
});
