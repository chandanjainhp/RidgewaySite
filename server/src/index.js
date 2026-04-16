import dotenv from 'dotenv';
import app from './app.js';
import { connectDatabases } from './db/index.js';
import { seedOvernightData } from './db/seed.js';
import { startWorker, stopWorker } from './queues/worker.js';

dotenv.config({ path: './.env' });

const port = process.env.PORT || 8000;
let server;

connectDatabases()
  .then(async () => {
    // Start the investigation worker after databases are connected
    await startWorker();

    server = app.listen(port, () => {
      console.log(`🚀 Server listening on http://localhost:${port}`);
    });

    if (process.env.NODE_ENV !== 'production') {
      await seedOvernightData();
    }
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
