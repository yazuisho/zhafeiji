const ws = require('./utils/websocket');

App({
  globalData: {
    ws,
    serverUrl: 'ws://localhost:3000',
    playerId: '',
    playerName: '',
    roomCode: '',
    gameState: null,
  },
  onLaunch() {
    const sys = wx.getSystemInfoSync();
    this.globalData.pixelRatio = sys.pixelRatio;
    this.globalData.windowWidth = sys.windowWidth;
    this.globalData.windowHeight = sys.windowHeight;
    // Connect WebSocket once globally
    ws.connect(this.globalData.serverUrl);
  },
  onHide() {
    // Keep connection alive
  },
});
