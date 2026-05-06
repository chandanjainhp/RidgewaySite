import mongoose from 'mongoose';
import Review from '../models/review.model.js';

const run = async () => {
  const mongodbUrl = process.env.MONGODB_URL;
  if (!mongodbUrl) {
    console.error('[migrate] MONGODB_URL not set');
    process.exit(1);
  }

  await mongoose.connect(mongodbUrl);
  console.log('[migrate] Connected to MongoDB');

  const result = await Review.updateMany(
    { orgId: { $exists: false } },
    { $set: { orgId: null } }
  );

  console.log(`[migrate] Updated ${result.modifiedCount} review documents (orgId set to null)`);

  await mongoose.disconnect();
  console.log('[migrate] Done');
  process.exit(0);
};

run().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1);
});
