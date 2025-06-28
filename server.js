// server.js - Updated with simple trust proxy configuration
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { helmetConfig, corsConfig } = require('./config/security');
const { limiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/api');

// Import connection pool and parallel verifier
const connectionPool = require('./utils/connectionPoolManager');
const parallelVerifier = require('./utils/parallelEmailVerifier');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple trust proxy configuration
// For production (behind AWS ALB): true
// For development (direct access): false
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
} else {
    app.set('trust proxy', false);
}

// Security middleware
app.use(helmet(helmetConfig));
app.use(cors(corsConfig));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting with custom configuration
app.use(limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', apiRoutes);

// Catch-all route for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown handler
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('🛑 Received shutdown signal, starting graceful shutdown...');
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // Shutdown parallel verifier workers
  await parallelVerifier.shutdown();
  
  // Wait for active connections to complete (max 30 seconds)
  const shutdownTimeout = setTimeout(() => {
    console.log('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
  
  // Monitor active connections
  const checkConnections = setInterval(() => {
    const poolStatus = connectionPool.getPoolStatus();
    if (poolStatus.totalActiveConnections === 0) {
      clearInterval(checkConnections);
      clearTimeout(shutdownTimeout);
      console.log('✅ All connections closed, shutting down');
      process.exit(0);
    } else {
      console.log(`⏳ Waiting for ${poolStatus.totalActiveConnections} active connections to complete...`);
    }
  }, 1000);
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Trust proxy: ${app.get('trust proxy')}`);
  console.log(`👥 Max concurrent users: ${connectionPool.maxConcurrentUsers}`);
  console.log(`🔧 Worker threads: ${parallelVerifier.maxWorkers}`);
  
  // Log system capabilities
  const os = require('os');
  console.log(`💻 System: ${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB RAM`);
});

// Monitor server health
setInterval(() => {
  const poolStatus = connectionPool.getPoolStatus();
  const workerStatus = parallelVerifier.getStatus();
  
  console.log(`📊 Server Status - Active Users: ${poolStatus.activeUsers}/${poolStatus.maxConcurrentUsers}, Queue: ${poolStatus.queueLength}, Workers: ${workerStatus.workers.busy}/${workerStatus.workers.total}`);
}, 30000); // Log every 30 seconds