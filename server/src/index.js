import dotenv from 'dotenv';
import app from './app.js';
import { connectDatabases } from './db/index.js';
import { seedOvernightData, seedTestUsers, seedIncidents } from './db/seed.js';
import { startWorker, stopWorker } from './queues/worker.js';

dotenv.config({ path: './.env' });

const port = process.env.PORT || 8000;
let server;

connectDatabases()
  .then(async () => {
    // Step 1: Start the investigation worker
    await startWorker();

    // Steps 2-4: Seed completes before the port opens (dev only)
    if (process.env.NODE_ENV !== 'production') {
      try {
        await seedOvernightData();
      } catch (error) {
        console.error('[Startup] seedOvernightData failed:', error.message);
      }

      try {
        await seedTestUsers();
      } catch (error) {
        console.error('[Startup] seedTestUsers failed:', error.message);
      }

      try {
        await seedIncidents();
      } catch (error) {
        console.error('[Startup] seedIncidents failed:', error.message);
      }
    }

    // Step 5: All seeding done — now open the port
    console.log('✅ SEED COMPLETE - starting server');

    const startServer = (attemptNumber = 1) => {
      server = app.listen(port, () => {
        console.log(`🚀 Server listening on http://localhost:${port}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${port} is already in use.`);
          if (attemptNumber < 3) {
            console.log(`⏳ Retrying in 2 seconds (attempt ${attemptNumber}/3)...`);
            setTimeout(() => {
              startServer(attemptNumber + 1);
            }, 2000);
          } else {
            console.error(
              '❌ Failed to start server after 3 attempts. Please kill existing processes on port ' +
                port
            );
            process.exit(1);
          }
        } else {
          console.error('Server error:', error);
          process.exit(1);
        }
      });

      server.setsockopt?.('SO_REUSEADDR', 1);
    };

    startServer();
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...');
  await stopWorker();
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server gracefully...');
  await stopWorker();
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
