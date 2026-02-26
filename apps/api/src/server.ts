import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './db/connection';
import { sendSuccess } from './utils/response';
import { ClientToServerEvents, ServerToClientEvents } from './types';

// Routes
import campaignRoutes from './routes/campaigns';
import characterRoutes from './routes/characters';
import profileRoutes from './routes/profile';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup with typed events
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  }
);

// Make io accessible to routes (for broadcasting from REST endpoints)
app.set('io', io);

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' })); // Character snapshots can be large
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/profile', profileRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/campaigns', characterRoutes); // Nested: /api/campaigns/:id/characters/*

// Socket.io connection handling
io.on('connection', socket => {
  console.log(`Client connected: ${socket.id}`);

  // Campaign room management
  socket.on('join_campaign', ({ campaignId }) => {
    socket.join(`campaign:${campaignId}`);
    console.log(`${socket.id} joined campaign: ${campaignId}`);
  });

  socket.on('leave_campaign', ({ campaignId }) => {
    socket.leave(`campaign:${campaignId}`);
    console.log(`${socket.id} left campaign: ${campaignId}`);
  });

  // Real-time character sync: player pushes snapshot, broadcast to campaign room
  socket.on(
    'sync_character',
    async ({ campaignId, characterId, characterSnapshot: _snapshot }) => {
      // Import character service lazily to avoid circular deps
      const characterService = await import('./services/character.service');

      try {
        // We don't have user context in socket events easily,
        // so the REST sync endpoint is the primary way to persist.
        // This socket event is for broadcasting the update to the DM in real-time.
        const summaries =
          await characterService.getCampaignCharacterSummaries(campaignId);
        const updated = summaries.find(s => s.character_id === characterId);

        if (updated) {
          // Broadcast to everyone in the campaign room except the sender
          socket
            .to(`campaign:${campaignId}`)
            .emit('campaign_character_synced', {
              campaignId,
              characterSummary: updated,
            });
        }
      } catch (error) {
        console.error('Socket sync_character error:', error);
      }
    }
  );

  // Encounter room management
  socket.on('join_encounter', ({ encounterId }) => {
    socket.join(`encounter:${encounterId}`);
    console.log(`${socket.id} joined encounter: ${encounterId}`);
  });

  socket.on('leave_encounter', ({ encounterId }) => {
    socket.leave(`encounter:${encounterId}`);
    console.log(`${socket.id} left encounter: ${encounterId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${_req.method} ${_req.path} not found`,
    },
  });
});

// Global error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
);

// Start server
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('RollKeeper Backend Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`HTTP Server: http://localhost:${PORT}`);
      console.log(`Socket.io: ws://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health Check: http://localhost:${PORT}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, io, httpServer };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
