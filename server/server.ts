import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'node:http';

const app = new Hono();

// Serve static files from public directory
app.use('/*', serveStatic({ root: './public' }));

// Create HTTP server compatible with both Hono and Socket.io
const PORT = process.env.PORT || 3000;
const httpServer = createServer(async (req, res) => {
  // Skip Socket.io requests - they're handled by Socket.io middleware
  if (req.url?.startsWith('/socket.io/')) {
    return;
  }

  // Convert Node.js request/response to Web API Request/Response for Hono
  const url = `http://${req.headers.host}${req.url}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  });

  // Read request body if present
  let body: BodyInit | undefined = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    if (chunks.length > 0) {
      body = new Uint8Array(Buffer.concat(chunks));
    }
  }

  const request = new Request(url, {
    method: req.method,
    headers: headers,
    body: body,
  });

  const response = await app.fetch(request);
  
  // Convert Web API Response back to Node.js response
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  
  const responseBody = await response.arrayBuffer();
  res.end(Buffer.from(responseBody));
});

// Initialize Socket.io with HTTP server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store rooms and their participants
const rooms = new Map<string, Set<string>>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    
    // Add socket to room tracking
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(socket.id);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
    
    // Send list of existing peers to the new user
    const peersInRoom = Array.from(rooms.get(roomId)!).filter(id => id !== socket.id);
    socket.emit('existing-peers', peersInRoom);

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('offer', (data: { offer: RTCSessionDescriptionInit; target: string; roomId: string }) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('answer', (data: { answer: RTCSessionDescriptionInit; target: string }) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; target: string }) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  socket.on('chat-message', (data: { message: string; roomId: string; sender: string }) => {
    io.to(data.roomId).emit('chat-message', {
      message: data.message,
      sender: data.sender,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from all rooms
    rooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        
        // Clean up empty rooms
        if (participants.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

