const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Express CORS headers for API endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Initialize Socket.IO v2.4.1 (Engine.IO v3 for ESP8266 SocketIoClient support)
const io = socketIo(server, {
  origins: '*:*',
  serveClient: true,
  pingTimeout: 30000,
  pingInterval: 25000
});

// Safe origin reflection for Socket.IO v2
if (typeof io.origins === 'function') {
  io.origins((origin, callback) => {
    callback(null, true);
  });
}

// Runtime telemetry state
let currentState = {
  lastCommand: 'STOP',
  speed: 100,
  activeClients: 0,
  lastUpdated: Date.now()
};

// Healthcheck endpoints for Render / Vercel uptime checks
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'esp8266-rc-server',
    socketio_version: '2.4.1',
    engineio_version: 'v3 (ESP8266 Compatible)',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    state: currentState,
    connectedSockets: Object.keys(io.sockets.sockets || {}).length,
    uptime: Math.round(process.uptime())
  });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function logWithTimestamp(message) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${now}] ${message}`);
}

// Socket.IO v2 Connection Handler
io.on('connection', (socket) => {
  currentState.activeClients++;
  logWithTimestamp(`🔌 Connected: ${socket.id} | Active Clients: ${currentState.activeClients}`);

  // Send initial state
  socket.emit('state_update', currentState);

  // PRIMARY EVENT: Listen for 'cmd' from frontend controller
  socket.on('cmd', (data) => {
    let command = 'STOP';

    if (typeof data === 'string') {
      command = data.toUpperCase().trim();
    } else if (data && typeof data === 'object') {
      command = (data.command || data.cmd || 'STOP').toUpperCase().trim();
    }

    const validCommands = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP'];
    if (!validCommands.includes(command)) {
      command = 'STOP';
    }

    currentState.lastCommand = command;
    currentState.lastUpdated = Date.now();

    const emojiMap = {
      FORWARD: '⬆️  FORWARD',
      BACKWARD: '⬇️  BACKWARD',
      LEFT: '⬅️  LEFT',
      RIGHT: '➡️  RIGHT',
      STOP: '⏹️  STOP'
    };
    logWithTimestamp(`🎮 [cmd] ${emojiMap[command] || command} from ${socket.id}`);

    // Broadcast string command to all other clients (ESP8266 listening on 'cmd')
    socket.broadcast.emit('cmd', command);

    // Also send structured event if needed
    socket.broadcast.emit('car_command', command);

    // Confirmation ACK back to sender
    socket.emit('cmd_ack', command);

    // Update telemetry state
    io.emit('state_update', currentState);
  });

  // Alias support for 'control' event
  socket.on('control', (data) => {
    let command = 'STOP';
    if (typeof data === 'string') {
      command = data.toUpperCase();
    } else if (data && typeof data === 'object') {
      command = (data.command || data.cmd || 'STOP').toUpperCase();
    }
    socket.broadcast.emit('cmd', command);
  });

  // Latency ping-pong
  socket.on('ping_check', (clientTimestamp) => {
    socket.emit('pong_reply', clientTimestamp);
  });

  // Disconnect handler
  socket.on('disconnect', (reason) => {
    currentState.activeClients = Math.max(0, currentState.activeClients - 1);
    logWithTimestamp(`❌ Disconnected: ${socket.id} (${reason}) | Remaining: ${currentState.activeClients}`);

    // Auto-stop safety if no clients are connected
    if (currentState.activeClients === 0 && currentState.lastCommand !== 'STOP') {
      currentState.lastCommand = 'STOP';
      currentState.lastUpdated = Date.now();
      logWithTimestamp(`🚨 SAFETY AUTO-STOP: No controllers connected, halting motors.`);
      io.emit('cmd', 'STOP');
      io.emit('state_update', currentState);
    }
  });
});

// LAN IP helper for local testing
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`🚀 ESP8266 RC Controller Server (Socket.IO v2.4.1 / EIO v3)`);
  console.log(`======================================================`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  if (localIps.length > 0) {
    console.log(`  LAN URL:     http://${localIps[0]}:${PORT} (Phone Wi-Fi)`);
  }
  console.log(`  Healthcheck: http://localhost:${PORT}/health`);
  console.log(`  ESP8266 Lib: SocketIoClient (Compatible with EIO v3)`);
  console.log(`======================================================\n`);
});
