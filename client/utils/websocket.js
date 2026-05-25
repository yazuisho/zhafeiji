let socketTask = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let messageQueue = [];
let isConnected = false;
let handlers = {};
let serverUrl = '';

function connect(url) {
  serverUrl = url;
  if (socketTask) return;
  socketTask = wx.connectSocket({ url, timeout: 5000 });

  socketTask.onOpen(() => {
    isConnected = true;
    console.log('WebSocket connected');
    messageQueue.forEach(msg => send(msg));
    messageQueue = [];
    startHeartbeat();
    if (handlers.onConnect) handlers.onConnect();
  });

  socketTask.onClose(() => {
    isConnected = false;
    stopHeartbeat();
    socketTask = null;
    console.log('WebSocket closed, reconnecting in 3s...');
    if (handlers.onDisconnect) handlers.onDisconnect();
    reconnectTimer = setTimeout(() => connect(serverUrl), 3000);
  });

  socketTask.onError(err => {
    console.error('WebSocket error', err);
    if (handlers.onError) handlers.onError(err);
  });

  socketTask.onMessage(res => {
    try {
      const msg = JSON.parse(res.data);
      const handler = handlers[msg.type];
      if (handler) handler(msg);
      if (handlers.onMessage) handlers.onMessage(msg);
    } catch (e) {
      console.error('parse msg error', e);
    }
  });
}

function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  stopHeartbeat();
  if (socketTask) { socketTask.close(); socketTask = null; }
  isConnected = false;
}

function send(data) {
  const str = JSON.stringify(data);
  if (!isConnected) { messageQueue.push(data); return; }
  wx.sendSocketMessage({ data: str });
}

function setHandlers(h) { handlers = h; }

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    send({ type: 'ping' });
  }, 15000);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

module.exports = { connect, disconnect, send, setHandlers };
