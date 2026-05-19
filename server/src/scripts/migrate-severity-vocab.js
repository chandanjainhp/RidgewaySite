import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Incident from '../models/incident.model.js';
import Investigation from '../models/investigation.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/sentinel';

const migrate = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const severityMap = {
      'escalate': 'serious',
      'monitor': 'minor',
      'harmless': 'harmless',
      'uncertain': 'uncertain'
    };

    let incidentUpdates = 0;
    for (const [oldSev, newSev] of Object.entries(severityMap)) {
      if (oldSev !== newSev) {
        const res = await Incident.updateMany(
          { severity: oldSev },
          { $set: { severity: newSev } }
        );
        incidentUpdates += res.modifiedCount;
      }
    }
    console.log(`Updated ${incidentUpdates} incidents.`);

    let invUpdates = 0;
    for (const [oldSev, newSev] of Object.entries(severityMap)) {
      if (oldSev !== newSev) {
        const res = await Investigation.updateMany(
          { 'finalClassification.severity': oldSev },
          { $set: { 'finalClassification.severity': newSev } }
        );
        invUpdates += res.modifiedCount;
      }
    }
    console.log(`Updated ${invUpdates} investigations.`);

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

migrate();
