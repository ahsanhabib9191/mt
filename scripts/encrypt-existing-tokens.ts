import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { encrypt, decrypt } from '../lib/utils/crypto';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { connectDB, disconnectDB } from '../lib/db/client';

dotenv.config();

async function run(dryRun = true) {
  await connectDB();

  const cursor = MetaConnectionModel.find({}).cursor();
  let processed = 0;
  let updated = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    processed++;
    let changed = false;

    // accessToken
    try {
      // Attempt to decrypt; if it throws or produces gibberish, consider it plaintext
      const maybePlain = doc.accessToken;
      try {
        const dec = decrypt(maybePlain);
        // If decrypt succeeds, token already encrypted. No change
      } catch (_e) {
        // Not encrypted yet; encrypt
        doc.accessToken = encrypt(maybePlain);
        changed = true;
      }
    } catch (e) {
      console.error(`Error handling accessToken for doc ${doc._id}:`, e);
    }

    // refreshToken
    if (doc.refreshToken) {
      const maybePlainR = doc.refreshToken;
      try {
        const dec = decrypt(maybePlainR);
      } catch (_e) {
        doc.refreshToken = encrypt(maybePlainR);
        changed = true;
      }
    }

    if (changed) {
      updated++;
      if (!dryRun) {
        await doc.save();
      }
    }
  }

  console.log(`Processed ${processed} MetaConnection docs. Updated ${updated}. Dry run: ${dryRun}`);
  await disconnectDB();
}

const dry = process.env.DRY_RUN !== 'false';
run(dry).catch(async (err) => {
  console.error('Migration failed:', err);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
