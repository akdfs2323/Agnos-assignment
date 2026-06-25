const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory cache for patient sessions
// Key: sessionId, Value: { id, data, status, lastActive }
const sessions = new Map();

// Helper to clean up completed/stale sessions (older than 4 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > 4 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // Check if it's the REST fallback sync API
    // We can expose the in-memory sessions to the API route by attaching it to the global object
    global.socketIoSessions = sessions;

    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Connected: ${socket.id}`);

    // When staff connects, send all active sessions
    socket.on('staff:join', () => {
      socket.join('staff-room');
      console.log(`[Socket.io] Staff joined room: ${socket.id}`);
      socket.emit('staff:session-list', Array.from(sessions.values()));
    });

    // When a patient starts/resumes a session
    socket.on('patient:join', ({ sessionId }) => {
      socket.join(`patient-${sessionId}`);
      socket.sessionId = sessionId;
      console.log(`[Socket.io] Patient joined: ${sessionId} (Socket: ${socket.id})`);

      // If session exists, load it; otherwise create it
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          id: sessionId,
          data: {},
          status: 'filling', // 'filling' | 'inactive' | 'submitted'
          lastActive: Date.now()
        });
      }
      
      // Notify staff
      io.to('staff-room').emit('staff:update', sessions.get(sessionId));
    });

    // When a patient updates their form
    socket.on('patient:update', ({ sessionId, data, status }) => {
      const currentSession = sessions.get(sessionId) || { id: sessionId };
      
      const updatedSession = {
        id: sessionId,
        data: data || currentSession.data || {},
        status: status || currentSession.status || 'filling',
        lastActive: Date.now()
      };

      sessions.set(sessionId, updatedSession);
      console.log(`[Socket.io] Update from patient ${sessionId}: status=${updatedSession.status}`);

      // Broadcast to staff
      io.to('staff-room').emit('staff:update', updatedSession);
    });

    // Handle patient disconnect / tab close
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Disconnected: ${socket.id}`);
      
      if (socket.sessionId) {
        const session = sessions.get(socket.sessionId);
        if (session && session.status !== 'submitted') {
          // Set to inactive after 5 seconds if they don't reconnect
          setTimeout(() => {
            const currentSession = sessions.get(socket.sessionId);
            if (currentSession && currentSession.status !== 'submitted') {
              // Double check if another socket for this session is connected
              const activeRooms = io.sockets.adapter.rooms.get(`patient-${socket.sessionId}`);
              if (!activeRooms || activeRooms.size === 0) {
                currentSession.status = 'inactive';
                currentSession.lastActive = Date.now();
                sessions.set(socket.sessionId, currentSession);
                
                console.log(`[Socket.io] Patient ${socket.sessionId} marked INACTIVE due to disconnect`);
                io.to('staff-room').emit('staff:update', currentSession);
              }
            }
          }, 5000);
        }
      }
    });
  });

  // Make sessions globally accessible for API routes
  global.socketIoSessions = sessions;

  let currentPort = Number(port);
  const startServer = (p) => {
    httpServer.listen(p, () => {
      console.log(`\n==================================================`);
      console.log(`🚀 [Server] > Ready on http://localhost:${p}`);
      console.log(`==================================================\n`);
    });
  };

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  [Server] Port ${currentPort} is in use. Trying port ${currentPort + 1}...`);
      currentPort++;
      startServer(currentPort);
    } else {
      console.error('Server error:', err);
    }
  });

  startServer(currentPort);
});
