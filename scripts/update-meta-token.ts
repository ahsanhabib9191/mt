
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import logger from '../lib/utils/logger';

dotenv.config();

async function main() {
    const newToken = process.argv[2];

    if (!newToken) {
        console.error('❌ Usage: npx tsx scripts/update-meta-token.ts <YOUR_NEW_ACCESS_TOKEN>');
        process.exit(1);
    }

    try {
        await connectDB();

        // Find the most recent active or expired connection
        const connection = await MetaConnectionModel.findOne({}).sort({ updatedAt: -1 });

        if (!connection) {
            console.error('❌ No Meta Connection found in database. Please run the setup first.');
            process.exit(1);
        }

        console.log(`Found connection for Account: ${connection.adAccountId}`);
        console.log('Updating access token...');

        // Update Token and set to ACTIVE
        connection.accessToken = newToken;
        connection.status = 'ACTIVE';
        connection.tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Assume 60 days for long-lived

        await connection.save();

        console.log('✅ Token updated successfully!');
        console.log('You can now run: npx tsx scripts/run-optimization.ts');

    } catch (error) {
        console.error('Error updating token:', error);
    } finally {
        await disconnectDB();
    }
}

main();
