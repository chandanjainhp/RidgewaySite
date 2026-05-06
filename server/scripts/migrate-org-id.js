import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabases } from '../src/db/index.js';

dotenv.config({ path: '../.env' });

async function migrate() {
  await connectDatabases();
  console.log('Connected to DB');

  const models = ['events', 'incidents', 'investigations', 'briefings'];

  for (const model of models) {
    const collection = mongoose.connection.collection(model);
    const result = await collection.updateMany(
      { orgId: { $exists: false } },
      { $set: { orgId: null } }
    );
    console.log(`Updated ${result.modifiedCount} documents in ${model}`);
  }

  // Also update User models if needed
  const resultUsers = await mongoose.connection.collection('users').updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId: null, role: 'operator' } }
  );
  console.log(`Updated ${resultUsers.modifiedCount} documents in users`);

  console.log('Migration complete');
  process.exit(0);
}

migrate().catch(console.error);
