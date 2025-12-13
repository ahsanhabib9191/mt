import 'dotenv/config';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import logger from '../lib/utils/logger';

async function main() {
    try {
        await connectDB();
        logger.info('Resetting Meta Connections...');

        await MetaConnectionModel.deleteMany({});
        logger.info('✅ All connections deleted.');

    } catch (error) {
        logger.error('Failed', error);
    } finally {
        await disconnectDB();
    }
}

main();
