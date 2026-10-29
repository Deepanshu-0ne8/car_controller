const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuration from environment variables
const PORT = process.env.PORT || 3000;
const rawOrigins = process.env.CORS_ORIGIN || '*';
const allowedOrigins = rawOrigins === '*' ? '*' : rawOrigins.split(',').map(s => s.trim());

// Express CORS headers for API endpoints (dynamic reflection for Vercel & local)
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static frontend files if hosted directly
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Socket.IO configuration with full cross-origin and transport fallback
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins (dynamically reflect for Vercel, localhost, and mobile apps)
      callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  },
  transports: ['polling', 'websocket'] // Start with polling (wakes Render free tier), then upgrade to WebSocket
});

// Runtime telemetry state
let currentState = {
  lastCommand: 'STOP',
  speed: 100,
  activeControllers: 0,
  lastUpdated: Date.now()
};

// Healthcheck endpoints for Render uptime monitoring & keep-alive pings
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'esp8266-rc-server',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    state: currentState,
    connectedSockets: io.engine.clientsCount,
    uptime: Math.round(process.uptime())
  });
});

// Fallback route to serve index.html for direct access
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  res.sendFile(indexPath);
});

// Formatted console logger
function logWithTimestamp(message) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${now}] ${message}`);
}

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  currentState.activeControllers++;
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  logWithTimestamp(`🔌 Client connected: ${socket.id} (${clientIp}) | Active: ${currentState.activeControllers}`);

  // Transmit initial state
  socket.emit('state_update', currentState);

  // Listen for drive commands
  socket.on('control', (data) => {
    let command = 'STOP';
    let speed = 100;

    if (typeof data === 'string') {
      command = data.toUpperCase();
    } else if (data && typeof data === 'object') {
      command = (data.command || 'STOP').toUpperCase();
      speed = Number.isInteger(data.speed) ? data.speed : 100;
    }

    const validCommands = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP'];
    if (!validCommands.includes(command)) {
      command = 'STOP';
    }

    currentState.lastCommand = command;
    currentState.speed = speed;
    currentState.lastUpdated = Date.now();

    const emojiMap = {
      FORWARD: '⬆️  FORWARD',
      BACKWARD: '⬇️  BACKWARD',
      LEFT: '⬅️  LEFT',
      RIGHT: '➡️  RIGHT',
      STOP: '⏹️  STOP'
    };
    logWithTimestamp(`🎮 [CMD] ${emojiMap[command] || command} (Speed: ${speed}%) from ${socket.id}`);

    // Broadcast to ESP8266 client
    socket.broadcast.emit('car_command', {
      command,
      speed,
      timestamp: Date.now(),
      sender: socket.id
    });

    // Shorthand string event for lightweight Arduino WebSocket parsers
    socket.broadcast.emit('cmd', command);

    // Confirmation ACK
    socket.emit('command_ack', { command, speed, timestamp: Date.now() });

    // Sync all connected monitoring dashboards
    io.emit('state_update', currentState);
  });

  // Latency heartbeat
  socket.on('ping_check', (clientTimestamp) => {
    socket.emit('pong_reply', clientTimestamp);
  });

  // Client disconnect
  socket.on('disconnect', (reason) => {
    currentState.activeControllers = Math.max(0, currentState.activeControllers - 1);
    logWithTimestamp(`❌ Client disconnected: ${socket.id} (${reason}) | Remaining: ${currentState.activeControllers}`);

    // Dead-man safety net: If all controllers close/disconnect, immediately halt car
    if (currentState.activeControllers === 0 && currentState.lastCommand !== 'STOP') {
      currentState.lastCommand = 'STOP';
      currentState.lastUpdated = Date.now();
      logWithTimestamp(`🚨 SAFETY AUTO-STOP: No controllers active, stopping motors.`);
      io.emit('car_command', { command: 'STOP', speed: 0, reason: 'safety_disconnect' });
      io.emit('cmd', 'STOP');
      io.emit('state_update', currentState);
    }
  });
});

// Detect LAN IPs for local testing
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

// Graceful shutdown handling for Render containers
process.on('SIGTERM', () => {
  logWithTimestamp('🛑 SIGTERM received. Shutting down gracefully...');
  io.emit('car_command', { command: 'STOP', speed: 0, reason: 'server_shutdown' });
  io.emit('cmd', 'STOP');
  server.close(() => {
    logWithTimestamp('Server closed.');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`🚀 ESP8266 RC Car Controller Server Running!`);
  console.log(`======================================================`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  CORS Origin: ${rawOrigins}`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  if (localIps.length > 0) {
    console.log(`  LAN URL:     http://${localIps[0]}:${PORT} (Phone on same Wi-Fi)`);
  }
  console.log(`  Healthcheck: http://localhost:${PORT}/health`);
  console.log(`======================================================\n`);
});
