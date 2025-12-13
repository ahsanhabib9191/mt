import 'dotenv/config';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { MetaConnection } from '../lib/db/models/MetaConnection';
import logger from '../lib/utils/logger';
import { encrypt } from '../lib/utils/crypto';

async function main() {
    try {
        const accessToken = process.argv[2];
        const adAccountId = process.argv[3];

        if (!accessToken || !adAccountId) {
            console.error('Usage: ts-node scripts/seed-connection.ts <access_token> <ad_account_id>');
            console.error('Example: ts-node scripts/seed-connection.ts EAAB... act_123456');
            process.exit(1);
        }

        await connectDB();

        // Validate account ID format
        const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        logger.info('Seeding Meta Connection...', { adAccountId: formattedAccountId });

        // Create or update connection
        // We use a dummy tenantId "default_tenant" for testing
        const tenantId = 'default_tenant';

        const result = await MetaConnectionModel.findOneAndUpdate(
            { adAccountId: formattedAccountId },
            {
                tenantId,
                adAccountId: formattedAccountId,
                accessToken: encrypt(accessToken), // Encrypt explicitly!
                status: 'ACTIVE',
                lastSyncedAt: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        logger.info('Result:', { id: result?._id, adAccountId: result?.adAccountId });

        logger.info('✅ Meta Connection seeded successfully!');
        logger.info('You can now run: npm run sync:meta');

    } catch (error) {
        logger.error('Failed to seed connection', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    } finally {
        await disconnectDB();
    }
}

main();
