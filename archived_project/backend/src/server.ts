// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import captureRoutes from './routes/capture';
import recordingsRoutes from './routes/recordings';
import streamRoutes from './routes/stream';

// Import services
import { wsServer } from './websocketServer';
import { streamManager } from './services/streamManager';
import { prisma } from './db/client';

// Create Express app
const app = express();
const PORT = process.env.API_PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const isWebSocket = req.headers.upgrade === 'websocket';
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}${isWebSocket ? ' [WebSocket Upgrade]' : ''}`);

  // Let WebSocket upgrade requests pass through
  if (isWebSocket) {
    console.log('🔌 WebSocket upgrade detected - skipping middleware');
    return next();
  }

  next();
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/capture', captureRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/recordings', streamRoutes);

// Serve static files (frontend) in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all non-API routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only serve index.html if it's not an API route and not a static file
    if (!req.path.startsWith('/api/') && !req.path.match(/\.\w+$/)) {
      res.sendFile(path.join(publicPath, 'index.html'));
    } else {
      next();
    }
  });
} else {
  // Development mode - show API info
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Vinyl Capture API',
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      endpoints: {
        capture: {
          start: 'POST /api/capture/start',
          stop: 'POST /api/capture/stop',
          status: 'GET /api/capture/status'
        },
        recordings: {
          list: 'GET /api/recordings',
          get: 'GET /api/recordings/:id',
          update: 'PATCH /api/recordings/:id',
          delete: 'DELETE /api/recordings/:id',
          stream: 'GET /api/recordings/:id/stream',
          download: 'GET /api/recordings/:id/download'
        }
      }
    });
  });
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
wsServer.initialize(server);
console.log('WebSocket servers initialized');

// Log streaming status
if (process.env.ENABLE_LIVE_STREAMING === 'true') {
  console.log('Live streaming enabled');

  // Log StreamManager progress
  streamManager.on('progress', (data) => {
    console.log(`Streaming progress: ${data.chunkCount} chunks, ${data.clients} clients, ${data.latency}ms latency`);
  });
} else {
  console.log('Live streaming disabled');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║      Vinyl Capture Server Started     ║
╠════════════════════════════════════════╣
║  API Port: ${PORT}                      ║
║  WebSocket: Enabled (/ws, /live)       ║
║  Live Streaming: ${process.env.ENABLE_LIVE_STREAMING === 'true' ? 'Enabled' : 'Disabled'}         ║
║  Environment: ${process.env.NODE_ENV}            ║
║  Device: ${process.env.AUDIO_DEVICE}             ║
╚════════════════════════════════════════╝
  `);
});