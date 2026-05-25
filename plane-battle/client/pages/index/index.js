const app = getApp();

Page({
  data: {
    playerName: '',
    roomCode: '',
  },
  onLoad() {
    const name = wx.getStorageSync('playerName') || '';
    this.setData({ playerName: name });
  },
  onNameInput(e) {
    this.setData({ playerName: e.detail.value });
  },
  onCodeInput(e) {
    this.setData({ roomCode: e.detail.value.toUpperCase() });
  },
  onCreateRoom() {
    const name = this.data.playerName.trim() || '玩家' + Math.random().toString(36).slice(2, 5);
    wx.setStorageSync('playerName', name);
    app.globalData.playerName = name;
    wx.navigateTo({ url: `/pages/room/room?role=host&name=${encodeURIComponent(name)}` });
  },
  onJoinRoom() {
    const code = this.data.roomCode.trim();
    if (!code) { wx.showToast({ title: '请输入房间码', icon: 'none' }); return; }
    const name = this.data.playerName.trim() || '玩家' + Math.random().toString(36).slice(2, 5);
    wx.setStorageSync('playerName', name);
    app.globalData.playerName = name;
    wx.navigateTo({ url: `/pages/room/room?role=guest&code=${code}&name=${encodeURIComponent(name)}` });
  },
});
